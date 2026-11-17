// "Assembling stage": the stage GLB is sliced into grid blocks that fly in from outside the view,
// glowing while they travel, and lock into place as `prog.target` goes 0 -> 1. Once built, the
// lights come on: LED screens boot, neon edges, moving-head beams and a pulse ring on the floor.
// Used by the home hero (driven by scroll) and the stage card hover preview (driven by time).
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { useFrame, useThree } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import { LineSegments2 } from "three/examples/jsm/lines/LineSegments2.js";
import { LineSegmentsGeometry } from "three/examples/jsm/lines/LineSegmentsGeometry.js";
import { LineMaterial } from "three/examples/jsm/lines/LineMaterial.js";
import { CX, THEMES, SCREEN_VERT, SCREEN_FRAG, textTexture, Beams, Dust, Seating, Confetti, KeySpot, useRoomEnv } from "./Stage.jsx";

// build order: base first, then props and screens, the truss lands last
const ORDER = { deck: 0, trim: 0.05, structure: 0.1, props: 0.4, screenPillar: 0.5, screenChevron: 0.58, screenMain: 0.64, truss: 0.75 };
const orderOf = (mk) => ORDER[Object.keys(ORDER).find((k) => mk.startsWith(k))] ?? 0.2;

export const clamp01 = (x) => Math.min(1, Math.max(0, x));
export const smooth = (a, b, x) => {
  const t = clamp01((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};
const easeOut = (t) => 1 - Math.pow(1 - t, 3);
const easeBack = (t) => 1 + 2.2 * Math.pow(t - 1, 3) + 1.2 * Math.pow(t - 1, 2);

// ---------------------------------------------------------------- slicing (cached per GLB)
// Every triangle is cut along the grid planes (so big panels like the LED wall break into tiles
// too), then each piece is binned by its centroid into a block per cell and material.
const cache = new Map();
function slice(scene, cell) {
  const key = scene.uuid + ":" + cell;
  if (cache.has(key)) return cache.get(key);
  scene.updateMatrixWorld(true);
  const buckets = new Map(),
    screens = {},
    edges = [],
    v = new THREE.Vector3(),
    nv = new THREE.Vector3(),
    nm = new THREE.Matrix3(),
    ci = (x) => Math.floor(x / cell);
  let mi = 0;

  const add = (mk, poly, uv) => {
    let cx = 0, cy = 0, cz = 0;
    for (const p of poly) (cx += p[0]), (cy += p[1]), (cz += p[2]);
    const n = poly.length,
      k = `${mk}|${ci(cx / n)},${ci(cy / n)},${ci(cz / n)}`;
    let b = buckets.get(k);
    if (!b) buckets.set(k, (b = { mk, pos: [], nrm: [], uv: uv ? [] : null }));
    for (let i = 1; i < n - 1; i++)
      for (const p of [poly[0], poly[i], poly[i + 1]]) {
        b.pos.push(p[0], p[1], p[2]);
        b.nrm.push(p[3], p[4], p[5]);
        if (uv) b.uv.push(p[6], p[7]);
      }
  };
  const lerp = (a, b, t) => a.map((x, i) => x + (b[i] - x) * t);
  const split = (poly, ax, at) => {
    const lo = [], hi = [];
    for (let i = 0; i < poly.length; i++) {
      const a = poly[i], b = poly[(i + 1) % poly.length], da = a[ax] - at, db = b[ax] - at;
      (da <= 0 ? lo : hi).push(a);
      if ((da < 0 && db > 0) || (da > 0 && db < 0)) {
        const m = lerp(a, b, da / (da - db));
        lo.push(m);
        hi.push(m);
      }
    }
    return [lo, hi];
  };
  const emit = (mk, tri, uv) => {
    let pieces = [tri];
    for (let ax = 0; ax < 3; ax++) {
      const out = [];
      for (let p of pieces) {
        let mn = Infinity, mx = -Infinity;
        for (const q of p) (mn = Math.min(mn, q[ax])), (mx = Math.max(mx, q[ax]));
        for (let l = (ci(mn) + 1) * cell; l < mx; l += cell) {
          const [lo, hi] = split(p, ax, l);
          if (lo.length > 2) out.push(lo);
          p = hi;
        }
        if (p.length > 2) out.push(p);
      }
      pieces = out;
    }
    pieces.forEach((p) => add(mk, p, uv));
  };

  scene.traverse((o) => {
    if (!o.isMesh) return;
    const name = o.material.name || "structure";
    mi++;
    if (name.startsWith("hall")) return; // the hero has no hall: the stage floats in the dark
    const scr = name.startsWith("screen"),
      mk = scr ? `${name}#${mi}` : ORDER[name] !== undefined ? name : "structure",
      g = o.geometry,
      P = g.attributes.position,
      N = g.attributes.normal,
      U = scr ? g.attributes.uv : null,
      I = g.index;
    if (scr) {
      const box = new THREE.Box3().setFromObject(o),
        sz = box.getSize(new THREE.Vector3()),
        c = box.getCenter(new THREE.Vector3());
      screens[mk] = {
        kind: name.startsWith("screenMain") ? 0 : name.startsWith("screenPillar") ? 1 : 2,
        aspect: Math.max(sz.x, sz.z) / sz.y,
        dir: c.x > CX ? 1 : -1,
      };
    }
    if (name === "structure" || name === "deck" || name === "trim") {
      // neon tape along stair nosings and the deck lip (same rule as the studio)
      const e = new THREE.EdgesGeometry(g, 35).applyMatrix4(o.matrixWorld),
        a = e.attributes.position,
        y = (i) => Math.max(a.getY(i), 0.015);
      for (let i = 0; i < a.count; i += 2)
        if (y(i) < 1.06 && y(i + 1) < 1.06) edges.push(a.getX(i), y(i), a.getZ(i), a.getX(i + 1), y(i + 1), a.getZ(i + 1));
      e.dispose();
    }
    nm.getNormalMatrix(o.matrixWorld);
    const cnt = I ? I.count : P.count;
    for (let t = 0; t < cnt; t += 3) {
      const tri = [];
      for (let k = 0; k < 3; k++) {
        const i = I ? I.getX(t + k) : t + k;
        v.fromBufferAttribute(P, i).applyMatrix4(o.matrixWorld);
        const q = [v.x, v.y, v.z, 0, 1, 0, 0, 0];
        if (N) {
          nv.fromBufferAttribute(N, i).applyMatrix3(nm).normalize();
          (q[3] = nv.x), (q[4] = nv.y), (q[5] = nv.z);
        }
        if (U) (q[6] = U.getX(i)), (q[7] = U.getY(i));
        tri.push(q);
      }
      emit(mk, tri, !!U);
    }
  });

  const chunks = [];
  buckets.forEach((b) => {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute(b.pos, 3));
    geo.setAttribute("normal", new THREE.Float32BufferAttribute(b.nrm, 3));
    if (b.uv) geo.setAttribute("uv", new THREE.Float32BufferAttribute(b.uv, 2));
    geo.computeBoundingBox();
    const c = geo.boundingBox.getCenter(new THREE.Vector3());
    geo.translate(-c.x, -c.y, -c.z);
    geo.computeBoundingSphere();
    chunks.push({ geo, c, mk: b.mk, seed: Math.random() });
  });
  const out = { chunks, screens, edges };
  cache.set(key, out);
  return out;
}

// ---------------------------------------------------------------- holographic floor grid
const GRID_VERT = /* glsl */ `
varying vec3 vW;
void main(){ vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`;
const GRID_FRAG = /* glsl */ `
uniform vec3 uColor; uniform float uOn, uRing; uniform vec2 uC;
varying vec3 vW;
void main(){
  vec2 p = vW.xz;
  vec2 fw = max(fwidth(p), vec2(1e-4));            // never divide by 0 (bloom spreads NaN/Inf)
  vec2 g = abs(fract(p - 0.5) - 0.5) / fw;
  float line = 1.0 - min(min(g.x, g.y), 1.0);
  float d = length(p - uC);
  float fade = exp(-d * 0.09);
  float r = (d - uRing) * 0.9;
  float ring = exp(-r * r) * step(0.0, uRing) * exp(-uRing * 0.05);
  vec3 col = uColor * (line * fade * uOn * 0.3 + ring * (0.25 + line * 1.4));
  gl_FragColor = vec4(col, 1.0);
}`;
function Grid({ color, state }) {
  const mat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: GRID_VERT,
        fragmentShader: GRID_FRAG,
        uniforms: { uColor: { value: new THREE.Color(color) }, uOn: { value: 0 }, uRing: { value: -1 }, uC: { value: new THREE.Vector2(CX, 0) } },
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        toneMapped: false,
      }),
    [color],
  );
  useEffect(() => () => mat.dispose(), [mat]);
  useFrame(({ clock }) => {
    mat.uniforms.uOn.value = state.grid;
    mat.uniforms.uRing.value = state.tOn ? (clock.elapsedTime - state.tOn) * 11 : -1;
  });
  return (
    <>
      <mesh rotation-x={-Math.PI / 2} position={[CX, -0.002, 0]}>
        <planeGeometry args={[120, 120]} />
        <meshStandardMaterial color="#08080e" roughness={0.45} metalness={0.5} />
      </mesh>
      <mesh rotation-x={-Math.PI / 2} position={[CX, 0.004, 0]} material={mat}>
        <planeGeometry args={[120, 120]} />
      </mesh>
    </>
  );
}

// ---------------------------------------------------------------- opening vortex
// The hero opens with every block orbiting a glowing core inside tilted energy rings; scrolling
// pulls the blocks out of it into the stage while the rings and core fade away.
const VC = new THREE.Vector3(CX, 4.2, 0),
  TILT = new THREE.Quaternion().setFromEuler(new THREE.Euler(0.62, 0, -0.28)),
  V = new THREE.Vector3();
function Core({ color, accent, state }) {
  const g = useRef(),
    orb = useRef(),
    light = useRef(),
    mats = useMemo(
      () =>
        [color, accent, "#ffffff"].map(
          (c, i) => new THREE.MeshBasicMaterial({ color: new THREE.Color(c).multiplyScalar(i === 2 ? 1.2 : 2.6), transparent: true, toneMapped: false, depthWrite: false }),
        ),
      [color, accent],
    ),
    orbMat = useMemo(() => new THREE.MeshBasicMaterial({ color: new THREE.Color(color).lerp(new THREE.Color("#ffffff"), 0.25).multiplyScalar(2.6), toneMapped: false, transparent: true }), [color]);
  useEffect(() => () => [...mats, orbMat].forEach((m) => m.dispose()), [mats, orbMat]);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime,
      a = state.pre ?? 1;
    g.current.visible = a > 0.01;
    if (!g.current.visible) return;
    const [r1, r2, r3] = g.current.children;
    r1.rotation.z = t * 0.35;
    r2.rotation.z = -t * 0.22;
    r3.rotation.y = t * 0.5;
    mats[0].opacity = a;
    mats[1].opacity = a * 0.8;
    mats[2].opacity = a * 0.5;
    orbMat.opacity = a;
    const pulse = 1 + Math.sin(t * 2.4) * 0.12;
    orb.current.scale.setScalar(pulse * (0.4 + 0.6 * a));
    light.current.intensity = 60 * a * pulse;
    g.current.scale.setScalar(0.6 + 0.4 * a);
  });
  return (
    <group ref={g} position={VC} quaternion={TILT}>
      <mesh material={mats[0]} rotation-x={Math.PI / 2}>
        <torusGeometry args={[7.6, 0.035, 8, 220]} />
      </mesh>
      <mesh material={mats[1]} rotation-x={Math.PI / 2 + 0.25}>
        <torusGeometry args={[6.4, 0.025, 8, 200]} />
      </mesh>
      <mesh material={mats[2]} rotation-x={0.6}>
        <torusGeometry args={[3.2, 0.02, 8, 160]} />
      </mesh>
      <mesh ref={orb} material={orbMat}>
        <icosahedronGeometry args={[0.9, 3]} />
      </mesh>
      <pointLight ref={light} color={color} distance={16} decay={2} />
    </group>
  );
}

// ---------------------------------------------------------------- the assembling stage
export function AssemblingStage({
  url = "/stages/conference.glb",
  prog,
  theme = THEMES[0],
  title = "POLYVAULT",
  subtitle = "STAGES · LIVE 3D",
  cell = 1.8,
  dust = 120,
  confetti = false,
  speed = 5,
  vortex = false,
}) {
  const { scene } = useGLTF(url),
    data = useMemo(() => slice(scene, cell), [scene, cell]),
    size = useThree((s) => s.size),
    [burst, setBurst] = useState(0),
    st = useRef({ grid: 0, tOn: 0, done: false }).current,
    seats = useRef(),
    beamG = useRef(),
    lights = useRef([]);

  const M = useMemo(() => {
    const f = new THREE.Color(theme.finish);
    return {
      deck: new THREE.MeshStandardMaterial({ color: f, roughness: 0.28, metalness: 0.3 }),
      structure: new THREE.MeshStandardMaterial({ color: f.clone().multiplyScalar(0.7), roughness: 0.5, metalness: 0.2 }),
      trim: new THREE.MeshStandardMaterial({ color: f.clone().multiplyScalar(0.55), roughness: 0.5, metalness: 0.2 }),
      props: new THREE.MeshStandardMaterial({ color: "#d4d5dd", roughness: 0.6 }),
      truss: new THREE.MeshStandardMaterial({ color: "#d9dde6", metalness: 0.95, roughness: 0.22 }),
    };
  }, [theme]);
  const text = useMemo(() => textTexture(title, subtitle), [title, subtitle]);
  const screenMats = useMemo(() => {
    const o = {};
    Object.entries(data.screens).forEach(([k, s]) => {
      o[k] = new THREE.ShaderMaterial({
        vertexShader: SCREEN_VERT,
        fragmentShader: SCREEN_FRAG,
        toneMapped: false,
        side: THREE.DoubleSide,
        uniforms: {
          uTime: { value: 0 },
          uBright: { value: 0.06 },
          uAspect: { value: s.aspect },
          uKind: { value: s.kind },
          uDir: { value: s.dir },
          uA: { value: new THREE.Color(theme.screenA) },
          uB: { value: new THREE.Color(theme.screenB) },
          uC: { value: new THREE.Color(theme.pillar) },
          uText: { value: text },
        },
      });
    });
    return o;
  }, [data, theme, text]);

  // one mesh per block, each with its own flight path and a material clone so it can glow in flight
  const pieces = useMemo(
    () =>
      data.chunks.map((ch) => {
        const scr = ch.mk.startsWith("screen"),
          mat = scr ? screenMats[ch.mk] : M[ch.mk].clone(),
          mesh = new THREE.Mesh(ch.geo, mat),
          s = ch.seed,
          r = (k) => ((Math.sin((s + k) * 9301.17) * 43758.5453) % 1 + 1) % 1, // stable per-block randoms
          out = new THREE.Vector3(ch.c.x - CX, 0.4, ch.c.z + 1.5).normalize();
        // start somewhere outside the view, mostly "in front of the screen" (towards +z / the viewer)
        const from = ch.c
          .clone()
          .addScaledVector(out, 5 + r(1) * 10)
          .add(new THREE.Vector3((r(2) - 0.5) * 10, 2 + r(3) * 9, 7 + r(4) * 16));
        const raw = orderOf(ch.mk) * 0.7 + (ch.c.y / 8) * 0.15 + r(5) * 0.15;
        mesh.frustumCulled = false;
        return {
          mesh,
          mat,
          scr,
          mk: ch.mk,
          c: ch.c,
          from,
          rot: new THREE.Euler((r(6) - 0.5) * 6, (r(7) - 0.5) * 6, (r(8) - 0.5) * 6),
          d: 0.03 + raw * 0.6,
          dur: 0.2 + r(9) * 0.1,
          ph: r(10) * 6.28,
          q: -1,
          // vortex orbit (hero opening): inner blocks orbit faster, the disc thins out towards the rim
          R: 2.4 + Math.pow(r(11), 0.8) * 5.4,
          a0: r(12) * Math.PI * 2,
          vy: (r(13) - 0.5) * 2.6 * (1 - r(11) * 0.6),
          spin: new THREE.Vector3(r(14) - 0.5, r(15) - 0.5, r(16) - 0.5).multiplyScalar(2.2),
          out,
        };
      }),
    [data, M, screenMats],
  );
  const group = useMemo(() => {
    const g = new THREE.Group();
    pieces.forEach((p) => g.add(p.mesh));
    return g;
  }, [pieces]);
  const chrome = useMemo(() => pieces.filter((p) => p.mk === "truss").map((p) => p.mat), [pieces]);
  useRoomEnv(chrome);

  const neonMat = useMemo(() => new LineMaterial({ linewidth: 1.8, toneMapped: false, transparent: true }), []),
    neon = useMemo(() => {
      const l = new LineSegments2(new LineSegmentsGeometry().setPositions(data.edges), neonMat);
      l.computeLineDistances();
      return l;
    }, [data, neonMat]);
  const beamCfg = useMemo(() => ({ ...theme, show: false, beamPower: 0 }), [theme]),
    glow = useMemo(() => new THREE.Color(theme.neon), [theme]),
    tmp = useMemo(() => new THREE.Color(), []);

  useEffect(() => {
    neonMat.resolution.set(size.width, size.height);
  }, [size, neonMat]);
  useEffect(
    () => () => {
      pieces.forEach((p) => !p.scr && p.mat.dispose());
      Object.values(screenMats).forEach((m) => m.dispose());
      neon.geometry.dispose();
    },
    [pieces, screenMats, neon],
  );
  useEffect(() => () => text.dispose(), [text]);

  useFrame(({ clock }, dt) => {
    const t = clock.elapsedTime;
    // ease towards the target so wheel steps turn into one smooth, continuous motion
    prog.v += (prog.target - prog.v) * (1 - Math.exp(-Math.min(dt, 0.1) * speed));
    if (Math.abs(prog.target - prog.v) < 1e-4) prog.v = prog.target;
    const P = prog.v,
      pre = vortex ? 1 - smooth(0, 0.35, P) : 0; // how much of the opening vortex is still showing
    st.grid = smooth(0, 0.18, P);
    st.pre = pre;

    pieces.forEach((p) => {
      const q = clamp01((P - p.d) / p.dur);
      if (q === 1 && p.q === 1) return; // landed and settled: nothing to update
      const e = easeOut(q),
        w = (1 - e) * 0.35,
        m = p.mesh,
        k = 1 - e;
      if (vortex) {
        // start from its slot in the swirling vortex, then swoop out and around into place
        const a = p.a0 + t * (1.5 / p.R);
        V.set(Math.cos(a) * p.R, p.vy + Math.sin(t * 0.9 + p.ph) * 0.15, Math.sin(a) * p.R).applyQuaternion(TILT).add(VC);
        m.position.lerpVectors(V, p.c, e).addScaledVector(p.out, Math.sin(Math.PI * e) * 3.5);
        m.position.y += Math.sin(Math.PI * e) * 2;
        m.rotation.set((p.rot.x + t * p.spin.x) * k, (p.rot.y + t * p.spin.y) * k, (p.rot.z + t * p.spin.z) * k);
        m.scale.setScalar(0.4 + 0.6 * e);
      } else {
        m.position.lerpVectors(p.from, p.c, e);
        m.position.y += Math.sin(t * 1.3 + p.ph) * w;
        m.rotation.set(p.rot.x * k + Math.sin(t + p.ph) * w * 0.3, p.rot.y * k, p.rot.z * k);
        m.scale.setScalar(0.55 + 0.45 * e);
      }
      if (!p.scr) {
        // energy glow while travelling (and a shimmer in the vortex), gone once the block locks in
        const g = q < 1 ? (vortex ? 0.32 + 0.28 * Math.sin(t * 2.2 + p.ph) : 0.2) * (1 - q) + 0.75 * Math.sin(Math.PI * q) : 0;
        p.mat.emissive.copy(glow).multiplyScalar(g);
      }
      p.q = q;
    });

    // lights on: screens boot with a flicker, then neon, beams, ring pulse
    const L = smooth(0.8, 0.93, P),
      flick = L > 0 && L < 1 ? (Math.sin(t * 47) > -0.2 ? 1 : 0.25) : 1;
    Object.values(screenMats).forEach((m) => {
      m.uniforms.uTime.value = t;
      m.uniforms.uBright.value = 0.06 + pre * 0.5 + L * flick * 0.94;
    });
    neon.visible = L > 0.01;
    neonMat.color.copy(tmp.set(theme.neon)).multiplyScalar(1.8 * L * flick);
    beamCfg.beamPower = L;
    if (beamG.current) beamG.current.visible = L > 0.02;
    lights.current.forEach((l) => l && (l.intensity = l.userData.base * (0.15 + 0.85 * L)));
    if (L > 0.5 && !st.tOn) st.tOn = t;
    if (L < 0.05) st.tOn = 0;
    if (P > 0.97 && !st.done) {
      st.done = true;
      if (confetti) setBurst((b) => b + 1);
    }
    if (P < 0.6) st.done = false;
    // panel seating drops in just before the lights
    if (seats.current) {
      const s = clamp01((P - 0.62) / 0.14);
      seats.current.visible = s > 0;
      seats.current.position.y = (1 - easeBack(s)) * 5;
    }
  });

  const L = (i, base, props) => (
    <pointLight
      ref={(r) => {
        if (r) (r.userData.base = base), (lights.current[i] = r);
      }}
      intensity={base}
      decay={2}
      {...props}
    />
  );
  return (
    <>
      <hemisphereLight args={["#8890b0", "#000000", 0.45]} />
      <ambientLight intensity={0.1} />
      <directionalLight position={[CX + 6, 10, 12]} intensity={0.6} />
      {[-4.2, CX, 2.6].map((x) => (
        <KeySpot key={x} x={x} />
      ))}
      {L(0, 30, { position: [CX, 2.6, -1], distance: 14, color: theme.screenB })}
      {L(1, 14, { position: [CX - 5.5, 2.6, -0.5], distance: 8, color: theme.pillar })}
      {L(2, 14, { position: [CX + 5.5, 2.6, -0.5], distance: 8, color: theme.pillar })}
      <primitive object={group} />
      <primitive object={neon} />
      <group ref={seats} visible={false}>
        <Seating />
      </group>
      <group ref={beamG} visible={false}>
        <Beams cfg={beamCfg} />
      </group>
      <Grid color={theme.neon} state={st} />
      {vortex && <Core color={theme.neon} accent={theme.pillar} state={st} />}
      {dust > 0 && <Dust count={dust} color={theme.beam} />}
      {confetti && <Confetti burst={burst} cfg={theme} />}
    </>
  );
}
