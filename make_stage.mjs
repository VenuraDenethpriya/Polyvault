// Converts the raw 3ds Max export into a web-ready GLB for the Stages viewer.
//   node make_stage.mjs "Business Conference Stage/Business Conference Stage 1.glb" stage_raw.glb
//   npx gltfpack@0.22.0 -i stage_raw.glb -o client/public/stages/conference.glb -cc -kn -km -kv -vp 14 -vt 16
// (gltfpack adds meshopt compression + quantization: ~15 MB -> ~1.5 MB; drei's useGLTF decodes it)
// - bakes every node transform and merges the ~2.4K meshes into a few named parts
//   (one draw call each) so the viewer stays fast
// - drops the 90m floor quad (the viewer renders its own reflective floor)
// - gives every LED-screen face planar UVs (0..1) so a shader can play content on it
import fs from "fs";

const [, , IN, OUT] = process.argv;
if (!IN || !OUT) throw new Error("usage: node make_stage.mjs in.glb out.glb");

// ---------- read GLB ----------
const buf = fs.readFileSync(IN);
const jl = buf.readUInt32LE(12);
const J = JSON.parse(buf.subarray(20, 20 + jl).toString());
const binStart = 20 + jl + 8;
const BIN = buf.subarray(binStart, binStart + buf.readUInt32LE(20 + jl));
const COMP = { 5121: Uint8Array, 5123: Uint16Array, 5125: Uint32Array, 5126: Float32Array };
const N = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4 };
const read = (i) => {
  const a = J.accessors[i], v = J.bufferViews[a.bufferView], T = COMP[a.componentType];
  const n = N[a.type], off = (v.byteOffset || 0) + (a.byteOffset || 0);
  const stride = v.byteStride ? v.byteStride / T.BYTES_PER_ELEMENT : n;
  const src = new T(BIN.buffer, BIN.byteOffset + off, (a.count - 1) * stride + n);
  const out = new T(a.count * n);
  for (let k = 0; k < a.count; k++) for (let c = 0; c < n; c++) out[k * n + c] = src[k * stride + c];
  return out;
};

// ---------- math ----------
const trs = (n) => {
  if (n.matrix) return n.matrix;
  const t = n.translation || [0, 0, 0], [x, y, z, w] = n.rotation || [0, 0, 0, 1], s = n.scale || [1, 1, 1];
  return [
    (1 - 2 * (y * y + z * z)) * s[0], 2 * (x * y + w * z) * s[0], 2 * (x * z - w * y) * s[0], 0,
    2 * (x * y - w * z) * s[1], (1 - 2 * (x * x + z * z)) * s[1], 2 * (y * z + w * x) * s[1], 0,
    2 * (x * z + w * y) * s[2], 2 * (y * z - w * x) * s[2], (1 - 2 * (x * x + y * y)) * s[2], 0,
    t[0], t[1], t[2], 1,
  ];
};
const mul = (a, b) => {
  const o = new Array(16).fill(0);
  for (let i = 0; i < 4; i++) for (let k = 0; k < 4; k++) for (let l = 0; l < 4; l++) o[k * 4 + i] += a[l * 4 + i] * b[k * 4 + l];
  return o;
};
// inverse-transpose of upper 3x3 (for normals)
const nmat = (m) => {
  const [a, b, c, d, e, f, g, h, i] = [m[0], m[1], m[2], m[4], m[5], m[6], m[8], m[9], m[10]];
  const A = e * i - f * h, B = -(d * i - f * g), C = d * h - e * g;
  const det = a * A + b * B + c * C || 1;
  return [A / det, B / det, C / det,
    -(b * i - c * h) / det, (a * i - c * g) / det, -(a * h - b * g) / det,
    (b * f - c * e) / det, -(a * f - c * d) / det, (a * e - b * d) / det];
};

// ---------- part mapping (material index -> part) ----------
// see the per-material bounding boxes: 4/5/8 are flat LED faces, 7 the truss rig, 6 people + furniture
const PART = { 1: "deck", 2: "trim", 3: "structure", 4: "screen", 5: "screen", 6: "props", 7: "truss", 8: "screen", 9: "hall", 10: "hallLight", 11: "hall" };
const parts = {}; // name -> {pos:[], nrm:[], uv:[], idx:[]}
const screens = []; // each screen face kept separate (own UVs, own content)

const add = (name, P, Nn, I, uv) => {
  const p = (parts[name] ??= { pos: [], nrm: [], uv: uv ? [] : null, idx: [] });
  const base = p.pos.length / 3;
  for (const v of P) p.pos.push(v);
  for (const v of Nn) p.nrm.push(v);
  if (uv) for (const v of uv) p.uv.push(v);
  for (const v of I) p.idx.push(v + base);
};

const walk = (ni, parent) => {
  const n = J.nodes[ni], M = mul(parent, trs(n)), NM = nmat(M);
  if (n.mesh != null)
    for (const pr of J.meshes[n.mesh].primitives) {
      const part = PART[pr.material];
      if (!part) continue;
      const P0 = read(pr.attributes.POSITION), N0 = read(pr.attributes.NORMAL);
      const I = pr.indices != null ? read(pr.indices) : Uint32Array.from({ length: P0.length / 3 }, (_, k) => k);
      const P = new Float32Array(P0.length), Nn = new Float32Array(N0.length);
      for (let k = 0; k < P0.length; k += 3) {
        const [x, y, z] = [P0[k], P0[k + 1], P0[k + 2]];
        P[k] = M[0] * x + M[4] * y + M[8] * z + M[12];
        P[k + 1] = M[1] * x + M[5] * y + M[9] * z + M[13];
        P[k + 2] = M[2] * x + M[6] * y + M[10] * z + M[14];
        const [a, b, c] = [N0[k], N0[k + 1], N0[k + 2]];
        let nx = NM[0] * a + NM[3] * b + NM[6] * c, ny = NM[1] * a + NM[4] * b + NM[7] * c, nz = NM[2] * a + NM[5] * b + NM[8] * c;
        const l = Math.hypot(nx, ny, nz) || 1;
        Nn[k] = nx / l; Nn[k + 1] = ny / l; Nn[k + 2] = nz / l;
      }
      if (part === "screen") screens.push({ name: n.name || "screen", P, Nn, I });
      else add(part, P, Nn, I);
    }
  for (const c of n.children || []) walk(c, M);
};
const ID = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
for (const r of J.scenes[0].nodes) walk(r, ID);

// screens: planar UVs in each face's own plane (u = horizontal along the face, v = height)
screens.forEach((s, i) => {
  let nx = 0, nz = 0;
  for (let k = 0; k < s.Nn.length; k += 3) { nx += s.Nn[k]; nz += s.Nn[k + 2]; }
  const l = Math.hypot(nx, nz) || 1;
  const tx = nz / l, tz = -nx / l; // tangent = up x normal
  const us = [], vs = [];
  for (let k = 0; k < s.P.length; k += 3) { us.push(s.P[k] * tx + s.P[k + 2] * tz); vs.push(s.P[k + 1]); }
  const [u0, u1, v0, v1] = [Math.min(...us), Math.max(...us), Math.min(...vs), Math.max(...vs)];
  const uv = [];
  us.forEach((u, k) => uv.push((u - u0) / (u1 - u0 || 1), (vs[k] - v0) / (v1 - v0 || 1)));
  // name screens by size so the viewer can tell the main wall from the side pillars / chevrons
  const w = u1 - u0, h = v1 - v0;
  // main wall 8m, tall pillars ~1m, chevrons ~1.5m; the tiny side faces are chevron edges (not screens)
  if (w < 0.5) return add("structure", s.P, s.Nn, s.I);
  const kind = w > 6 ? "screenMain" : w < 1.2 ? "screenPillar" : "screenChevron";
  add(`${kind}_${i}`, s.P, s.Nn, s.I, uv);
  console.log(`screen ${i} ${s.name}: ${kind} ${w.toFixed(2)}x${h.toFixed(2)} n=(${(nx / l).toFixed(2)},${(nz / l).toFixed(2)})`);
});

// ---------- write GLB ----------
const out = { asset: { version: "2.0", generator: "polyvault make_stage" }, scenes: [{ nodes: [] }], nodes: [], meshes: [], accessors: [], bufferViews: [], buffers: [{ byteLength: 0 }], materials: [] };
const chunks = [];
let off = 0;
const view = (typed, target) => {
  const b = Buffer.from(typed.buffer, typed.byteOffset, typed.byteLength);
  const pad = (4 - (b.length % 4)) % 4;
  out.bufferViews.push({ buffer: 0, byteOffset: off, byteLength: b.length, target });
  chunks.push(b, Buffer.alloc(pad));
  off += b.length + pad;
  return out.bufferViews.length - 1;
};
const acc = (typed, type, ct, target, minmax) => {
  const a = { bufferView: view(typed, target), componentType: ct, count: typed.length / N[type], type };
  if (minmax) {
    const n = N[type], mn = Array(n).fill(Infinity), mx = Array(n).fill(-Infinity);
    for (let k = 0; k < typed.length; k++) { mn[k % n] = Math.min(mn[k % n], typed[k]); mx[k % n] = Math.max(mx[k % n], typed[k]); }
    Object.assign(a, { min: mn, max: mx });
  }
  out.accessors.push(a);
  return out.accessors.length - 1;
};
let tris = 0;
for (const [name, p] of Object.entries(parts)) {
  out.materials.push({ name, pbrMetallicRoughness: { baseColorFactor: [0.8, 0.8, 0.8, 1], metallicFactor: 0, roughnessFactor: 0.6 } });
  const big = p.pos.length / 3 > 65535;
  const attributes = {
    POSITION: acc(new Float32Array(p.pos), "VEC3", 5126, 34962, true),
    NORMAL: acc(new Float32Array(p.nrm), "VEC3", 5126, 34962),
  };
  if (p.uv) attributes.TEXCOORD_0 = acc(new Float32Array(p.uv), "VEC2", 5126, 34962);
  const indices = acc(big ? new Uint32Array(p.idx) : new Uint16Array(p.idx), "SCALAR", big ? 5125 : 5123, 34963);
  out.meshes.push({ name, primitives: [{ attributes, indices, material: out.materials.length - 1 }] });
  out.nodes.push({ name, mesh: out.meshes.length - 1 });
  out.scenes[0].nodes.push(out.nodes.length - 1);
  tris += p.idx.length / 3;
  console.log(name.padEnd(16), "verts", p.pos.length / 3, "tris", p.idx.length / 3);
}
out.buffers[0].byteLength = off;
const bin = Buffer.concat(chunks);
let js = Buffer.from(JSON.stringify(out));
js = Buffer.concat([js, Buffer.alloc((4 - (js.length % 4)) % 4, 0x20)]);
const head = Buffer.alloc(12);
head.writeUInt32LE(0x46546c67, 0); head.writeUInt32LE(2, 4); head.writeUInt32LE(12 + 8 + js.length + 8 + bin.length, 8);
const ch = (len, type) => { const b = Buffer.alloc(8); b.writeUInt32LE(len, 0); b.writeUInt32LE(type, 4); return b; };
fs.writeFileSync(OUT, Buffer.concat([head, ch(js.length, 0x4e4f534a), js, ch(bin.length, 0x004e4942), bin]));
console.log(`wrote ${OUT}: ${out.meshes.length} meshes, ${tris} tris, ${(fs.statSync(OUT).size / 1e6).toFixed(1)} MB`);
