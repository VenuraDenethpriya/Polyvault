// 360° stage studio: the stage GLB with live LED screens, neon edges, sweeping
// moving-head beams, reflective floor, bloom, haze, confetti and colour themes.
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import {
  OrbitControls,
  useGLTF,
  MeshReflectorMaterial,
  Html,
  Line,
  useProgress,
} from "@react-three/drei";
import { EffectComposer, Bloom, Vignette, SMAA } from "@react-three/postprocessing";
import { LineSegments2 } from "three/examples/jsm/lines/LineSegments2.js";
import { LineSegmentsGeometry } from "three/examples/jsm/lines/LineSegmentsGeometry.js";
import { LineMaterial } from "three/examples/jsm/lines/LineMaterial.js";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { Link } from "react-router-dom";
import { api } from "./api.js";
import { useAuth } from "./auth.jsx";

export const stageUrl = (a) => `/stages/${a.shape.slice(6)}.glb`;

// stage centre (model units are metres, front of the stage faces +z)
export const CX = -0.8;

export const THEMES = [
  { name: "Electric", screenA: "#0b3cff", screenB: "#00c8ff", pillar: "#c13bff", neon: "#19e3ff", finish: "#2b2e38", beam: "#9fdcff" },
  { name: "Magenta", screenA: "#5a12ff", screenB: "#ff2bd6", pillar: "#ff5ca8", neon: "#ff3df0", finish: "#2a2233", beam: "#ff9cf0" },
  { name: "Gold", screenA: "#ff6a00", screenB: "#ffcc4d", pillar: "#ff9a1f", neon: "#ffc247", finish: "#1f1c1a", beam: "#ffe2a8" },
  { name: "Emerald", screenA: "#007a5a", screenB: "#21ffb5", pillar: "#00b3ff", neon: "#2bffbf", finish: "#1c2624", beam: "#b8ffe9" },
  { name: "Crimson", screenA: "#b0001e", screenB: "#ff5a36", pillar: "#ff2a6d", neon: "#ff3355", finish: "#2a1c1f", beam: "#ffb3a1" },
  { name: "Corporate", screenA: "#1d2b44", screenB: "#9fb7d9", pillar: "#6d8fc4", neon: "#ffffff", finish: "#e6e7eb", beam: "#fff4e0" },
];

// ---------------------------------------------------------------- resizable stage (Pro)
// Measured from the GLB, in metres: x -7.84..6.33, z -2.48 (back) .. 4.04 (front), deck top at
// 1 m, LED screens 1..4 m, truss from 7 m. The meshes are merged per material, so resizing is a
// per-vertex warp: x/z scale about the stage centre / back edge, and y is a monotone piecewise map
// (deck band, screen band, the gap up to the rig, then the rig itself just moves).
export const BASE = { w: 14.2, d: 6.5, deck: 1, screen: 3, rig: 7 };
export const LIMITS = {
  w: [8, 24],
  d: [4, 12],
  deck: [0.3, 1.8],
  screen: [1.5, 5],
  rig: [4, 10.5], // also kept >= deck + screen + 0.8 (see fixDims)
};
export const PRESETS = {
  Compact: { w: 10, d: 5, deck: 0.6, screen: 2.2, rig: 5.5 },
  Standard: BASE,
  Large: { w: 18, d: 8, deck: 1.2, screen: 3.6, rig: 8 },
  Arena: { w: 24, d: 10, deck: 1.6, screen: 4.6, rig: 10 },
};
const X0 = -7.84,
  X1 = 6.33,
  Z0 = -2.48,
  Z1 = 4.04;
export const fixDims = (d) => {
  const c = (k, v) => Math.min(LIMITS[k][1], Math.max(LIMITS[k][0], +v || BASE[k]));
  const o = { w: c("w", d.w), d: c("d", d.d), deck: c("deck", d.deck), screen: c("screen", d.screen) };
  o.rig = Math.min(10.5, Math.max(c("rig", d.rig), o.deck + o.screen + 0.8));
  return o;
};
export function makeWarp(dm = BASE) {
  const sx = dm.w / BASE.w,
    sz = dm.d / BASE.d,
    gap = (dm.rig - dm.deck - dm.screen) / 3;
  return {
    sx,
    sz,
    x: (v) => CX + (v - CX) * sx,
    z: (v) => Z0 + (v - Z0) * sz,
    y: (v) =>
      v <= 1 ? v * dm.deck : v <= 4 ? dm.deck + (v - 1) * (dm.screen / 3) : v <= 7 ? dm.deck + dm.screen + (v - 4) * gap : v - 7 + dm.rig,
    // dy/dy' slope, for transforming normals
    dy: (v) => (v <= 1 ? dm.deck : v <= 4 ? dm.screen / 3 : v <= 7 ? gap : 1),
  };
}
const IDENT = makeWarp();

export const VIEWS = {
  Front: { p: [CX, 3.4, 15], t: [CX, 2.6, 0] },
  Audience: { p: [CX + 2.5, 1.6, 9], t: [CX, 2.8, -1] },
  Aerial: { p: [CX + 9, 14, 12], t: [CX, 1.5, 0] },
  Left: { p: [CX - 13, 4, 7], t: [CX, 2.4, 0] },
  Right: { p: [CX + 13, 4, 7], t: [CX, 2.4, 0] },
  Backstage: { p: [CX + 3, 5, -15], t: [CX, 2.5, 0] },
};

// ---------------------------------------------------------------- LED screens
export const SCREEN_VERT = /* glsl */ `
varying vec2 vUv;
void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
export const SCREEN_FRAG = /* glsl */ `
uniform float uTime, uBright, uAspect, uKind, uDir;
uniform vec3 uA, uB, uC;
uniform sampler2D uText;
varying vec2 vUv;
// (smoothstep edges kept ascending and pow() bases non-negative: anything else is undefined
// in GLSL, and one NaN pixel gets smeared over the whole frame by the bloom pass)
float band(float x, float w){ return smoothstep(0.0, 0.02, x) * (1.0 - smoothstep(w, w + 0.03, x)); }
void main(){
  vec2 uv = vUv;
  vec2 p = vec2(uv.x * uAspect, uv.y);
  float t = uTime;
  vec3 col;
  if (uKind < 0.5) {
    // main wall: deep gradient, diagonal light bands, circuit stripes, centre chevron, text
    float wave = 0.5 + 0.5 * sin(p.x * 0.9 + t * 0.4);
    col = mix(uA * 0.18, uA * 0.9, smoothstep(0.0, 1.0, uv.y * 0.7 + wave * 0.3));
    float d1 = fract((p.x + p.y) * 0.55 - t * 0.12);
    float d2 = fract((p.x - p.y) * 0.55 + t * 0.07);
    col += uB * band(d1, 0.1) * 0.9 + uB * band(d2, 0.05) * 0.6;
    float stripes = step(0.82, fract((p.x - p.y) * 16.0)) * smoothstep(0.55, 1.0, sin(p.x * 1.7 - p.y * 2.0 + t * 1.3));
    col += mix(uB, vec3(1.0), 0.3) * stripes * 0.7;
    float cx = abs(p.x - uAspect * 0.5);
    float ch = fract((uv.y - cx * 0.75) * 1.6 - t * 0.25);
    col += mix(uB, vec3(1.0), 0.35) * band(ch, 0.05) * (1.0 - smoothstep(0.2, 1.6, cx)) * 0.9;
    float sx = (p.x - mod(t * 1.6, uAspect + 3.0) + 1.5) * 2.2;
    float sweep = exp(-sx * sx);
    col += uB * sweep * 0.45;
    vec4 tx = texture2D(uText, uv);
    col = mix(col, vec3(1.15), tx.a);
  } else if (uKind < 1.5) {
    // tall pillars: arrows scrolling upwards
    float cx = abs(uv.x - 0.5) * uAspect;
    float v = fract(uv.y * 4.0 - cx * 2.2 - t * 0.7);
    float arrow = band(v, 0.09) * (1.0 - smoothstep(0.25, 0.5, abs(uv.x - 0.5)));
    col = mix(uA * 0.25, uC * 0.55, uv.y);
    col += mix(uC, vec3(1.0), 0.35) * arrow * (0.5 + 0.9 * uv.y);
    float mid = clamp(1.0 - abs(uv.x - 0.5) * 2.0, 0.0, 1.0);
    col += uC * mid * mid * mid * mid * 0.35 * (0.6 + 0.4 * sin(t * 2.0 + uv.y * 5.0));
  } else {
    // chevron wings: gradient with a light stripe running outwards
    float x = uDir > 0.0 ? uv.x : 1.0 - uv.x;
    col = mix(uA * 0.35, uB * 0.9, x);
    float s = fract(x * 1.2 - t * 0.45);
    col += mix(uB, vec3(1.0), 0.4) * band(s, 0.14) * 1.2;
    col += uB * (smoothstep(0.9, 1.0, x) + 1.0 - smoothstep(0.0, 0.1, x)) * 0.8;
  }
  // LED pixel grid
  vec2 g = fract(p * 70.0);
  col *= 0.72 + 0.28 * smoothstep(0.0, 0.18, g.x) * smoothstep(0.0, 0.18, g.y);
  gl_FragColor = vec4(col * uBright, 1.0);
  #include <colorspace_fragment>
}`;

export function textTexture(title, sub) {
  const c = document.createElement("canvas");
  c.width = 2048;
  c.height = 768;
  const g = c.getContext("2d"),
    font = "Inter, 'Segoe UI', Arial, sans-serif";
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.fillStyle = "#fff";
  g.shadowColor = "#fff";
  g.shadowBlur = 28;
  // emblem
  g.lineWidth = 16;
  g.strokeStyle = "#fff";
  g.strokeRect(924, 70, 200, 150);
  g.fillRect(974, 110, 100, 70);
  let fs = 220;
  g.font = `800 ${fs}px ${font}`;
  while (g.measureText(title).width > 1850 && fs > 60) g.font = `800 ${(fs -= 8)}px ${font}`;
  g.fillText(title, 1024, 340);
  g.font = `600 84px ${font}`;
  if ("letterSpacing" in g) g.letterSpacing = "14px";
  g.fillText(sub, 1024, 520);
  const t = new THREE.CanvasTexture(c);
  t.anisotropy = 4;
  return t;
}

// ---------------------------------------------------------------- beams
const BEAM_VERT = /* glsl */ `
varying float vH; varying vec3 vN; varying vec3 vV;
void main(){
  vH = uv.y;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vV = normalize(-mv.xyz);
  vN = normalize(normalMatrix * normal);
  gl_Position = projectionMatrix * mv;
}`;
const BEAM_FRAG = /* glsl */ `
uniform vec3 uColor; uniform float uPower;
varying float vH; varying vec3 vN; varying vec3 vV;
void main(){
  float core = pow(abs(dot(vN, vV)), 2.0);
  float fall = pow(vH, 2.4);
  gl_FragColor = vec4(uColor * core * fall * uPower, 1.0);
}`;
const beamGeo = (() => {
  const g = new THREE.CylinderGeometry(0.06, 1.5, 15, 40, 1, true);
  g.translate(0, -7.5, 0);
  g.rotateX(-Math.PI / 2); // cone runs from the fixture along +z (Object3D.lookAt aims +z)
  return g;
})();

// fixtures measured from the model (hanging heads on the truss + floor heads on the deck)
const BEAMS = [
  ...[-5.2, -1.8, 0, 1.8, 3.6].map((x, i) => ({ p: [x, 6.3, 3.2], aim: [x * 0.6 + CX * 0.4, 0, 3 + i], sx: 2.5, sz: 4 })),
  ...[1.7, -1.8, -5.3].map((z) => ({ p: [-6.3, 6.3, z], aim: [-2, 0, z + 5], sx: 3, sz: 3 })),
  ...[1.6, -1.8, -5.3].map((z) => ({ p: [4.3, 6.3, z], aim: [0.5, 0, z + 5], sx: 3, sz: 3 })),
  { p: [-4.3, 1.4, 2.2], aim: [-7, 12, 6], sx: 4, sz: 3, up: 1 },
  { p: [2.8, 1.4, 2.2], aim: [5, 12, 6], sx: 4, sz: 3, up: 1 },
  { p: [-6.6, 1.4, -1], aim: [-10, 12, -2], sx: 3, sz: 3, up: 1 },
  { p: [4.9, 1.4, -1], aim: [8, 12, -2], sx: 3, sz: 3, up: 1 },
];

export function Beams({ cfg, warp = IDENT }) {
  const refs = useRef([]),
    mats = useMemo(
      () =>
        BEAMS.map(
          () =>
            new THREE.ShaderMaterial({
              vertexShader: BEAM_VERT,
              fragmentShader: BEAM_FRAG,
              uniforms: { uColor: { value: new THREE.Color() }, uPower: { value: 1 } },
              transparent: true,
              depthWrite: false,
              blending: THREE.AdditiveBlending,
              side: THREE.DoubleSide,
              toneMapped: false,
            }),
        ),
      [],
    ),
    tmp = useMemo(() => new THREE.Color(), []),
    pal = useMemo(() => [cfg.beam, cfg.screenB, cfg.pillar, cfg.neon].map((c) => new THREE.Color(c)), [cfg]);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime,
      sp = cfg.show ? 1.9 : 0.45;
    BEAMS.forEach((b, i) => {
      const g = refs.current[i];
      if (!g) return;
      const ph = i * 1.37;
      g.lookAt(
        warp.x(b.aim[0]) + Math.sin(t * sp + ph) * b.sx,
        b.aim[1] + (b.up ? Math.sin(t * sp * 0.8 + ph) * 2 : 0),
        warp.z(b.aim[2]) + Math.cos(t * sp * 0.7 + ph) * b.sz,
      );
      const u = mats[i].uniforms;
      if (cfg.show) {
        // light show: cycle the theme colours and pulse
        const k = (t * 0.5 + i * 0.25) % pal.length,
          a = Math.floor(k);
        tmp.copy(pal[a]).lerp(pal[(a + 1) % pal.length], k - a);
        u.uColor.value.copy(tmp);
        u.uPower.value = cfg.beamPower * 0.55 * (0.55 + 0.45 * Math.max(0, Math.sin(t * 6 + i)));
      } else {
        u.uColor.value.set(i % 4 === 3 ? cfg.screenB : cfg.beam);
        u.uPower.value = cfg.beamPower * 0.4;
      }
    });
  });
  return BEAMS.map((b, i) => (
    <group key={i} position={[warp.x(b.p[0]), warp.y(b.p[1]), warp.z(b.p[2])]} ref={(r) => (refs.current[i] = r)}>
      <mesh geometry={beamGeo} material={mats[i]} />
      <mesh>
        <sphereGeometry args={[0.13, 16, 16]} />
        <meshBasicMaterial color={[6, 6, 6]} toneMapped={false} />
      </mesh>
    </group>
  ));
}

// ---------------------------------------------------------------- haze dust
// Our own point sprites instead of drei's <Sparkles>: its shader divides by the distance to the
// sprite centre, which is exactly 0 on some pixels -> Inf, and bloom turns that into a black frame.
const DUST_VERT = /* glsl */ `
uniform float uTime, uSize;
attribute float aSeed;
varying float vTw;
void main(){
  vec3 p = position;
  p.y = mod(p.y + uTime * (0.08 + aSeed * 0.12), 7.0) + 0.8;   // slow upward drift, wraps
  p.x += sin(uTime * 0.3 + aSeed * 40.0) * 0.4;
  p.z += cos(uTime * 0.25 + aSeed * 30.0) * 0.4;
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = uSize * (0.6 + aSeed) / max(-mv.z, 0.5);
  vTw = 0.5 + 0.5 * sin(uTime * 2.0 + aSeed * 60.0);
}`;
const DUST_FRAG = /* glsl */ `
uniform vec3 uColor;
varying float vTw;
void main(){
  float d = length(gl_PointCoord - 0.5);
  float a = 1.0 - smoothstep(0.0, 0.5, d);
  gl_FragColor = vec4(uColor * a * a * (0.35 + 0.65 * vTw), 1.0);
}`;
export function Dust({ count, color }) {
  const geo = useMemo(() => {
      const g = new THREE.BufferGeometry(),
        p = new Float32Array(count * 3),
        s = new Float32Array(count);
      for (let i = 0; i < count; i++) {
        p.set([CX + (Math.random() - 0.5) * 16, Math.random() * 7, 0.5 + (Math.random() - 0.5) * 13], i * 3);
        s[i] = Math.random();
      }
      g.setAttribute("position", new THREE.BufferAttribute(p, 3));
      g.setAttribute("aSeed", new THREE.BufferAttribute(s, 1));
      return g;
    }, [count]),
    mat = useMemo(
      () =>
        new THREE.ShaderMaterial({
          vertexShader: DUST_VERT,
          fragmentShader: DUST_FRAG,
          uniforms: { uTime: { value: 0 }, uSize: { value: 60 }, uColor: { value: new THREE.Color() } },
          transparent: true,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
          toneMapped: false,
        }),
      [],
    );
  useEffect(() => () => geo.dispose(), [geo]);
  useFrame(({ clock, gl }) => {
    mat.uniforms.uTime.value = clock.elapsedTime;
    mat.uniforms.uSize.value = 60 * gl.getPixelRatio();
    mat.uniforms.uColor.value.set(color).multiplyScalar(0.8);
  });
  return <points geometry={geo} material={mat} frustumCulled={false} />;
}

// ---------------------------------------------------------------- confetti
export function Confetti({ burst, cfg }) {
  const n = 450,
    ref = useRef(),
    st = useRef(null),
    o = useMemo(() => new THREE.Object3D(), []);
  useEffect(() => {
    // give the mesh instance colours up front so the material compiles with them
    const w = new THREE.Color(1, 1, 1);
    for (let i = 0; i < n; i++) ref.current.setColorAt(i, w);
  }, []);
  useEffect(() => {
    if (!burst || !ref.current) return;
    const cols = [cfg.screenB, cfg.pillar, cfg.neon, "#ffffff", cfg.beam];
    st.current = Array.from({ length: n }, (_, i) => {
      ref.current.setColorAt(i, new THREE.Color(cols[i % cols.length]).multiplyScalar(1.6));
      return {
        p: new THREE.Vector3(CX + (Math.random() - 0.5) * 12, 7 + Math.random() * 3, (Math.random() - 0.5) * 9),
        v: new THREE.Vector3((Math.random() - 0.5) * 0.6, -1.2 - Math.random(), (Math.random() - 0.5) * 0.6),
        r: new THREE.Vector3(Math.random() * 6, Math.random() * 6, Math.random() * 6),
        s: 0.6 + Math.random() * 0.8,
      };
    });
    st.current.landed = 0;
    ref.current.instanceColor.needsUpdate = true;
  }, [burst]); // eslint-disable-line react-hooks/exhaustive-deps
  useFrame(({ clock }, d) => {
    const m = ref.current;
    if (!m) return;
    m.visible = !!st.current;
    if (!st.current) return;
    const t = clock.elapsedTime;
    let alive = 0;
    st.current.forEach((c, i) => {
      if (c.p.y > 0.02) {
        c.p.addScaledVector(c.v, d);
        c.p.x += Math.sin(t * 2 + i) * d * 0.4;
        c.r.x += d * 4;
        c.r.y += d * 3;
        alive++;
      }
      o.position.copy(c.p);
      o.rotation.set(c.r.x, c.r.y, c.r.z);
      o.scale.setScalar(c.s);
      o.updateMatrix();
      m.setMatrixAt(i, o.matrix);
    });
    m.instanceMatrix.needsUpdate = true;
    // let it lie on the floor for a few seconds, then clear
    if (alive) st.current.landed = 0;
    else if ((st.current.landed += d) > 4) st.current = null;
  });
  return (
    <instancedMesh ref={ref} args={[null, null, n]} visible={false}>
      <planeGeometry args={[0.09, 0.05]} />
      <meshBasicMaterial side={THREE.DoubleSide} toneMapped={false} />
    </instancedMesh>
  );
}

// ---------------------------------------------------------------- the stage model
// bake every mesh into world space once (float positions/normals/uvs), so resizing only has to
// remap plain arrays
function bakeScene(scene, M) {
  scene.updateMatrixWorld(true);
  const out = [],
    v = new THREE.Vector3();
  scene.traverse((o) => {
    if (!o.isMesh) return;
    const g = o.geometry,
      m = o.matrixWorld,
      nm = new THREE.Matrix3().getNormalMatrix(m),
      p = g.attributes.position,
      n = g.attributes.normal,
      uv = g.attributes.uv,
      P = new Float32Array(p.count * 3),
      N = n ? new Float32Array(n.count * 3) : null;
    for (let i = 0; i < p.count; i++) {
      v.fromBufferAttribute(p, i).applyMatrix4(m);
      P[i * 3] = v.x;
      P[i * 3 + 1] = v.y;
      P[i * 3 + 2] = v.z;
      if (N) {
        v.fromBufferAttribute(n, i).applyMatrix3(nm).normalize();
        N[i * 3] = v.x;
        N[i * 3 + 1] = v.y;
        N[i * 3 + 2] = v.z;
      }
    }
    let UV = null;
    if (uv) {
      const a = new Float32Array(uv.count * 2);
      for (let i = 0; i < uv.count; i++) {
        a[i * 2] = uv.getX(i);
        a[i * 2 + 1] = uv.getY(i);
      }
      UV = new THREE.BufferAttribute(a, 2);
    }
    const name = o.material.name || "";
    let material = M[name] || M.structure,
      kind = -1;
    if (name.startsWith("screen")) {
      kind = name.startsWith("screenMain") ? 0 : name.startsWith("screenPillar") ? 1 : 2;
      const c = new THREE.Box3().setFromBufferAttribute(new THREE.BufferAttribute(P, 3)).getCenter(new THREE.Vector3());
      material = new THREE.ShaderMaterial({
        vertexShader: SCREEN_VERT,
        fragmentShader: SCREEN_FRAG,
        toneMapped: false,
        side: THREE.DoubleSide,
        uniforms: {
          uTime: { value: 0 },
          uBright: { value: 1 },
          uAspect: { value: 1 },
          uKind: { value: kind },
          uDir: { value: c.x > CX ? 1 : -1 },
          uA: { value: new THREE.Color() },
          uB: { value: new THREE.Color() },
          uC: { value: new THREE.Color() },
          uText: { value: null },
        },
      });
    }
    out.push({ name: o.name, part: name, P, N, UV, index: g.index, material, kind });
  });
  return out;
}

function StageModel({ url, cfg, warp = IDENT, exportRef }) {
  const { scene } = useGLTF(url),
    size = useThree((s) => s.size);
  const M = useMemo(
    () => ({
      deck: new THREE.MeshStandardMaterial({ roughness: 0.28, metalness: 0.3 }),
      structure: new THREE.MeshStandardMaterial({ roughness: 0.5, metalness: 0.2 }),
      trim: new THREE.MeshStandardMaterial({ roughness: 0.5, metalness: 0.2 }),
      props: new THREE.MeshStandardMaterial({ color: "#d4d5dd", roughness: 0.6 }),
      truss: new THREE.MeshStandardMaterial({ color: "#d9dde6", metalness: 0.95, roughness: 0.22 }),
      hall: new THREE.MeshStandardMaterial({ color: "#121318", roughness: 0.9 }),
      hallLight: new THREE.MeshBasicMaterial({ color: new THREE.Color(2.4, 2.4, 2.6), toneMapped: false }),
      neon: new LineMaterial({ linewidth: 1.8, toneMapped: false }),
    }),
    [],
  );
  const chrome = useMemo(() => [M.truss], [M]);
  useRoomEnv(chrome);
  const text = useMemo(() => textTexture(cfg.title || " ", cfg.subtitle || " "), [cfg.title, cfg.subtitle]);
  useEffect(() => () => text.dispose(), [text]);

  const base = useMemo(() => bakeScene(scene, M), [scene, M]),
    screens = useMemo(() => base.filter((b) => b.kind >= 0).map((b) => b.material), [base]);

  // (re)build the meshes for the current dimensions + screen shaders + neon edge lines
  const { root, neon, neonPos, roof, geos } = useMemo(() => {
    const root = new THREE.Group(),
      edgeSrc = [],
      roof = [],
      geos = [];
    base.forEach((b) => {
      const hall = b.part.startsWith("hall"),
        g = new THREE.BufferGeometry(),
        P = hall ? b.P : new Float32Array(b.P.length),
        N = hall || !b.N ? b.N : new Float32Array(b.N.length);
      if (!hall)
        for (let i = 0; i < P.length; i += 3) {
          const y = b.P[i + 1];
          P[i] = warp.x(b.P[i]);
          P[i + 1] = warp.y(y);
          P[i + 2] = warp.z(b.P[i + 2]);
          if (N) {
            // normals transform with the inverse of the local stretch
            const nx = b.N[i] / warp.sx,
              ny = b.N[i + 1] / warp.dy(y),
              nz = b.N[i + 2] / warp.sz,
              l = Math.hypot(nx, ny, nz) || 1;
            N[i] = nx / l;
            N[i + 1] = ny / l;
            N[i + 2] = nz / l;
          }
        }
      g.setAttribute("position", new THREE.BufferAttribute(P, 3));
      if (N) g.setAttribute("normal", new THREE.BufferAttribute(N, 3));
      if (b.UV) g.setAttribute("uv", b.UV);
      if (b.index) g.setIndex(b.index);
      g.computeBoundingBox();
      g.computeBoundingSphere();
      geos.push(g);
      const m = new THREE.Mesh(g, b.material);
      m.name = b.name;
      m.userData.part = b.part;
      root.add(m);
      if (b.kind >= 0) {
        const sz = g.boundingBox.getSize(new THREE.Vector3());
        b.material.uniforms.uAspect.value = Math.max(sz.x, sz.z) / Math.max(sz.y, 0.01);
      }
      // stairs + deck get glowing neon edges, like LED tape on every step nosing
      if (b.part === "structure" || b.part === "deck" || b.part === "trim") edgeSrc.push(g);
      if (hall) roof.push(m);
    });
    const pos = [],
      top = warp.y(1.06);
    edgeSrc.forEach((g) => {
      const e = new THREE.EdgesGeometry(g, 35),
        a = e.attributes.position;
      // keep edges below the screens (stairs, deck lip, floor outline); skip the vertical screen frames.
      // Lines are lifted just above the floor: the reflector renders with an oblique near plane at
      // y=0, and fat-line segments crossing it produce NaN pixels (which bloom smears over the frame)
      const y = (i) => Math.max(a.getY(i), 0.015);
      for (let i = 0; i < a.count; i += 2)
        if (y(i) < top && y(i + 1) < top) pos.push(a.getX(i), y(i), a.getZ(i), a.getX(i + 1), y(i + 1), a.getZ(i + 1));
      e.dispose();
    });
    const lg = new LineSegmentsGeometry().setPositions(pos),
      neon = new LineSegments2(lg, M.neon);
    neon.computeLineDistances();
    geos.push(lg);
    return { root, neon, neonPos: pos, roof, geos };
  }, [base, warp, M]);
  // free the previous build's GPU buffers when the dimensions change
  useEffect(() => () => geos.forEach((g) => g.dispose()), [geos]);
  useEffect(() => {
    if (exportRef) exportRef.current = { root, neonPos };
  }, [exportRef, root, neonPos]);

  useEffect(() => {
    const finish = new THREE.Color(cfg.finish);
    M.deck.color.copy(finish);
    M.structure.color.copy(finish).multiplyScalar(0.7);
    M.trim.color.copy(finish).multiplyScalar(0.55);
    screens.forEach((s) => {
      s.uniforms.uA.value.set(cfg.screenA);
      s.uniforms.uB.value.set(cfg.screenB);
      s.uniforms.uC.value.set(cfg.pillar);
      s.uniforms.uText.value = text;
    });
  }, [cfg, screens, text, M]);
  useEffect(() => {
    M.neon.resolution.set(size.width, size.height);
  }, [size, M]);

  useFrame(({ clock, camera }) => {
    const t = clock.elapsedTime,
      speed = cfg.show ? 2.2 : 1;
    // the hall ceiling sits at ~11.4m: hide it when orbiting above so it never blocks the view
    const below = camera.position.y < 11;
    if (roof[0] && roof[0].visible !== below) roof.forEach((o) => (o.visible = below));
    screens.forEach((s) => {
      s.uniforms.uTime.value = t * speed;
      s.uniforms.uBright.value = cfg.brightness * (cfg.show ? 0.85 + 0.25 * Math.sin(t * 5) : 1);
    });
    const pulse = cfg.show ? 0.6 + 0.6 * Math.abs(Math.sin(t * 3)) : 1;
    M.neon.color.set(cfg.neon).multiplyScalar(1.8 * pulse * cfg.brightness);
  });
  return (
    <>
      <primitive object={root} />
      {cfg.neonOn && <primitive object={neon} />}
    </>
  );
}

// ---------------------------------------------------------------- camera
// eases the camera to a preset view; with no view picked yet it plays the intro dolly to "Front".
// Distances are stretched on narrow (portrait) canvases so the whole stage stays in frame.
// With a resized stage the presets scale with it (k), aimed at the middle of the screens (ty).
function CameraRig({ view, controls, k = 1, ty = 2.6 }) {
  const goal = useRef(null),
    camera = useThree((s) => s.camera),
    aspect = useThree((s) => s.size.width / Math.max(1, s.size.height));
  useEffect(() => {
    const v = VIEWS[view?.name || "Front"],
      t = new THREE.Vector3(v.t[0], (v.t[1] * ty) / 2.6, v.t[2]),
      fit = Math.min(2.2, Math.max(1, 1.45 / aspect)) * k;
    goal.current = { p: new THREE.Vector3(v.p[0], (v.p[1] * (1 + k)) / 2, v.p[2]).sub(t).multiplyScalar(fit).add(t), t };
  }, [view, aspect, k, ty]);
  useEffect(() => {
    const c = controls.current;
    if (!c) return;
    const stop = () => (goal.current = null);
    c.addEventListener("start", stop);
    return () => c.removeEventListener("start", stop);
  }, [controls]);
  useFrame((_, d) => {
    const g = goal.current,
      c = controls.current;
    if (!g || !c) return;
    const k = 1 - Math.exp(-d * 3);
    camera.position.lerp(g.p, k);
    c.target.lerp(g.t, k);
    c.update();
    if (camera.position.distanceTo(g.p) < 0.05) goal.current = null;
  });
  return null;
}

// keep the stage centred in the free area left of the studio panel (smoothly slides when toggled)
function ViewShift({ shift }) {
  const cur = useRef(0);
  useFrame(({ camera, size }) => {
    cur.current += (shift - cur.current) * 0.12;
    if (Math.abs(cur.current - shift) < 0.5) cur.current = shift;
    // re-applied every frame so it also follows canvas resizes
    if (cur.current) camera.setViewOffset(size.width, size.height, cur.current, 0, size.width, size.height);
    else if (camera.view?.enabled) camera.clearViewOffset();
  });
  return null;
}

function Loader() {
  const { progress } = useProgress();
  return (
    <Html center>
      <div className="stage-load">
        <b>{Math.round(progress)}%</b>
        <span>Building the stage…</span>
      </div>
    </Html>
  );
}

// soft studio reflections, applied only to the chrome truss. A scene-wide environment made
// the big glossy floor return NaN for some view directions, and the bloom pass then spread
// that over the whole frame.
export function useRoomEnv(mats) {
  const gl = useThree((s) => s.gl);
  useEffect(() => {
    const pm = new THREE.PMREMGenerator(gl),
      env = pm.fromScene(new RoomEnvironment(), 0.04).texture;
    mats.forEach((m) => {
      m.envMap = env;
      m.envMapIntensity = 0.35;
      m.needsUpdate = true;
    });
    return () => {
      env.dispose();
      pm.dispose();
    };
  }, [gl, mats]);
}

// warm key light from the front truss onto the presenters
export function KeySpot({ x, warp = IDENT }) {
  const l = useRef();
  useEffect(() => {
    l.current.target.position.set(warp.x(x * 0.7), warp.y(1), warp.z(-0.6));
    l.current.target.updateMatrixWorld();
  }, [x, warp]);
  return (
    <spotLight
      ref={l}
      position={[warp.x(x), warp.y(6.3), warp.z(3.4)]}
      angle={0.5}
      penumbra={0.7}
      intensity={70}
      decay={2}
      color="#fff2df"
    />
  );
}

// panel seating: white lounge chairs with side tables (the original scene's people/chairs
// were render proxies that never made it into the GLB, so we build simple ones here)
const SEATS = [-2.8, -1.3, 0.15, 1.65];
export function Seating({ warp = IDENT }) {
  const white = useMemo(() => new THREE.MeshStandardMaterial({ color: "#f1f1f5", roughness: 0.25, metalness: 0.1 }), []),
    dark = useMemo(() => new THREE.MeshStandardMaterial({ color: "#2a2b33", roughness: 0.4, metalness: 0.6 }), []),
    glass = useMemo(() => new THREE.MeshStandardMaterial({ color: "#bfe9ff", roughness: 0.05, transparent: true, opacity: 0.55 }), []);
  return SEATS.map((x) => (
    <group key={x} position={[warp.x(x), warp.y(1), warp.z(-0.6)]}>
      {/* chair: base, stem, cushion, bucket shell open towards the audience */}
      <mesh material={dark} position-y={0.015}>
        <cylinderGeometry args={[0.26, 0.28, 0.03, 32]} />
      </mesh>
      <mesh material={dark} position-y={0.2}>
        <cylinderGeometry args={[0.035, 0.035, 0.36, 12]} />
      </mesh>
      <mesh material={white} position-y={0.43}>
        <cylinderGeometry args={[0.3, 0.27, 0.1, 32]} />
      </mesh>
      <mesh material={white} position-y={0.62} rotation-x={-0.12}>
        <sphereGeometry args={[0.38, 32, 16, Math.PI * 0.8, Math.PI * 1.4, Math.PI * 0.32, Math.PI * 0.42]} />
      </mesh>
      {/* side table with a glass of water */}
      <group position={[0.68, 0, 0.1]}>
        <mesh material={dark} position-y={0.012}>
          <cylinderGeometry args={[0.15, 0.15, 0.025, 24]} />
        </mesh>
        <mesh material={dark} position-y={0.28}>
          <cylinderGeometry args={[0.018, 0.018, 0.55, 8]} />
        </mesh>
        <mesh material={white} position-y={0.56}>
          <cylinderGeometry args={[0.2, 0.2, 0.025, 32]} />
        </mesh>
        <mesh material={glass} position-y={0.63}>
          <cylinderGeometry args={[0.035, 0.03, 0.12, 16]} />
        </mesh>
      </group>
    </group>
  ));
}

function Floor({ high }) {
  return (
    <mesh rotation-x={-Math.PI / 2} position={[CX, 0, 0]}>
      <planeGeometry args={[160, 160]} />
      {high ? (
        <MeshReflectorMaterial
          blur={[400, 120]}
          resolution={1024}
          mixBlur={1}
          mixStrength={22}
          roughness={0.9}
          depthScale={1.1}
          minDepthThreshold={0.4}
          maxDepthThreshold={1.4}
          color="#0c0c12"
          metalness={0.6}
          mirror={0.6}
        />
      ) : (
        <meshStandardMaterial color="#0d0d13" roughness={0.35} metalness={0.6} />
      )}
    </mesh>
  );
}

// live measurement guides (Pro dimensions panel)
export const fmtLen = (m, unit) => (unit === "ft" ? (m * 3.28084).toFixed(1) + " ft" : m.toFixed(2).replace(/\.?0+$/, "") + " m");
function Guide({ a, b, label, unit, value }) {
  const mid = a.map((v, i) => (v + b[i]) / 2);
  return (
    <>
      <Line points={[a, b]} color="#cfe9ff" lineWidth={1.6} dashed dashSize={0.25} gapSize={0.12} depthTest={false} transparent opacity={0.9} />
      {[a, b].map((p, i) => (
        <mesh key={i} position={p} renderOrder={10}>
          <sphereGeometry args={[0.06, 12, 8]} />
          <meshBasicMaterial color="#cfe9ff" depthTest={false} toneMapped={false} />
        </mesh>
      ))}
      <Html position={mid} center zIndexRange={[4, 0]} style={{ pointerEvents: "none" }}>
        <div className="st-dim">
          <span>{label}</span>
          <b>{fmtLen(value, unit)}</b>
        </div>
      </Html>
    </>
  );
}
function Measure({ dims, warp, unit }) {
  const xl = warp.x(X0),
    xr = warp.x(X1),
    zb = warp.z(Z0),
    zf = warp.z(Z1),
    o = 0.7;
  return (
    <group>
      <Guide a={[xl, 0.04, zf + o]} b={[xr, 0.04, zf + o]} label="Width" value={dims.w} unit={unit} />
      <Guide a={[xr + o, 0.04, zb]} b={[xr + o, 0.04, zf]} label="Depth" value={dims.d} unit={unit} />
      <Guide a={[xr + o, 0, zf + o]} b={[xr + o, dims.deck, zf + o]} label="Deck" value={dims.deck} unit={unit} />
      <Guide
        a={[warp.x(3.24) + 0.35, dims.deck, warp.z(-2.33) + 0.15]}
        b={[warp.x(3.24) + 0.35, dims.deck + dims.screen, warp.z(-2.33) + 0.15]}
        label="Screens"
        value={dims.screen}
        unit={unit}
      />
      <Guide a={[xl - o, 0, zf]} b={[xl - o, dims.rig, zf]} label="Rig" value={dims.rig} unit={unit} />
    </group>
  );
}

export function StageScene({ url, cfg, view, burst, shift = 0, dims = BASE, measure = false, unit = "m", exportRef, seatsRef }) {
  const controls = useRef(),
    ref = useRef(),
    [on, setOn] = useState(true),
    high = cfg.quality === "high",
    warp = useMemo(() => makeWarp(dims), [dims]);
  useEffect(() => {
    // stop rendering while the viewer is scrolled out of sight
    const o = new IntersectionObserver(([e]) => setOn(e.isIntersecting));
    o.observe(ref.current);
    return () => o.disconnect();
  }, []);
  const lp = (x, y, z) => [warp.x(x), warp.y(y), warp.z(z)];
  return (
    <div ref={ref} style={{ position: "absolute", inset: 0 }}>
      <Canvas
        frameloop={on ? "always" : "never"}
        dpr={high ? [1, 1.75] : 1}
        gl={{ antialias: false, powerPreference: "high-performance", preserveDrawingBuffer: true }}
        camera={{ position: [CX - 1.5, 2.2, 6.5], fov: 45, near: 0.1, far: 300 }}
      >
        <color attach="background" args={["#05050a"]} />
        <fogExp2 attach="fog" args={["#05050a", cfg.haze ? 0.016 : 0.006]} />
        <hemisphereLight args={["#8890b0", "#000000", 0.35]} />
        <ambientLight intensity={0.08} />
        {[-4.2, CX, 2.6].map((x) => (
          <KeySpot key={x} x={x} warp={warp} />
        ))}
        <pointLight position={lp(CX, 2.6, -1)} distance={14 * Math.max(1, warp.sx)} decay={2} intensity={30} color={cfg.screenB} />
        <pointLight position={lp(CX - 5.5, 2.6, -0.5)} distance={8} decay={2} intensity={14} color={cfg.pillar} />
        <pointLight position={lp(CX + 5.5, 2.6, -0.5)} distance={8} decay={2} intensity={14} color={cfg.pillar} />
        <Suspense fallback={<Loader />}>
          <StageModel url={url} cfg={cfg} warp={warp} exportRef={exportRef} />
          <group ref={seatsRef}>{cfg.seats && <Seating warp={warp} />}</group>
          <Floor high={high} />
        </Suspense>
        {cfg.beams && <Beams cfg={cfg} warp={warp} />}
        {cfg.haze && <Dust count={high ? 260 : 120} color={cfg.beam} />}
        <Confetti burst={burst} cfg={cfg} />
        {measure && <Measure dims={dims} warp={warp} unit={unit} />}
        <OrbitControls
          ref={controls}
          makeDefault
          target={VIEWS.Front.t}
          enablePan={false}
          minDistance={4}
          maxDistance={60}
          maxPolarAngle={Math.PI / 2 - 0.04}
          autoRotate={cfg.rotate}
          autoRotateSpeed={0.7}
          enableDamping
        />
        <CameraRig
          view={view}
          controls={controls}
          k={Math.max(dims.w / BASE.w, dims.d / BASE.d, dims.rig / BASE.rig, 0.75)}
          ty={dims.deck + dims.screen * 0.53}
        />
        <ViewShift shift={shift} />
        {/* SMAA instead of MSAA: much cheaper on top of the reflector's extra scene pass */}
        <EffectComposer multisampling={0} disableNormalPass>
          <Bloom mipmapBlur luminanceThreshold={1} luminanceSmoothing={0.25} intensity={cfg.glow} radius={0.7} />
          <Vignette offset={0.25} darkness={0.7} />
          {high ? <SMAA /> : <></>}
        </EffectComposer>
      </Canvas>
    </div>
  );
}

// ---------------------------------------------------------------- studio UI
const DEFAULT = {
  ...THEMES[0],
  theme: "Electric",
  title: "CONFERENCE",
  subtitle: "BUSINESS SUMMIT 2026",
  beams: true,
  neonOn: true,
  haze: true,
  seats: true,
  show: false,
  rotate: true,
  beamPower: 1,
  brightness: 1,
  glow: 0.9,
  quality: "high",
};
const PICKS = [
  ["screenA", "Screen base"],
  ["screenB", "Screen accent"],
  ["pillar", "Pillar screens"],
  ["neon", "Neon edges"],
  ["finish", "Stage finish"],
  ["beam", "Light beams"],
];

// ---------------------------------------------------------------- custom GLB export (Pro)
// LED wall image for the exported model (the live shader can't go into a GLB)
function screenTexture(cfg, kind, aspect) {
  const h = 512,
    w = Math.round(h * Math.min(4, Math.max(0.25, aspect))),
    c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const g = c.getContext("2d"),
    gr = g.createLinearGradient(0, h, w, 0);
  gr.addColorStop(0, cfg.screenA);
  gr.addColorStop(1, kind === 1 ? cfg.pillar : cfg.screenB);
  g.fillStyle = gr;
  g.fillRect(0, 0, w, h);
  if (kind === 0) {
    const font = "Inter, 'Segoe UI', Arial, sans-serif";
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.fillStyle = "#fff";
    let fs = h * 0.22;
    g.font = `800 ${fs}px ${font}`;
    while (g.measureText(cfg.title).width > w * 0.9 && fs > 20) g.font = `800 ${(fs -= 4)}px ${font}`;
    g.fillText(cfg.title, w / 2, h * 0.45);
    g.font = `600 ${h * 0.08}px ${font}`;
    g.fillText(cfg.subtitle, w / 2, h * 0.66);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
async function buildGLB(src, seats, cfg, dims, title, withSeats) {
  const { GLTFExporter } = await import("three/examples/jsm/exporters/GLTFExporter.js");
  const out = new THREE.Scene(),
    std = new Map();
  out.name = title;
  src.root.children.forEach((o) => {
    if (!o.isMesh || o.userData.part.startsWith("hall")) return; // the venue hall isn't part of the stage
    let m = o.material;
    if (m.isShaderMaterial) {
      const kind = m.uniforms.uKind.value,
        tex = screenTexture(cfg, kind, m.uniforms.uAspect.value);
      m = new THREE.MeshStandardMaterial({
        name: "LED_" + ["Main", "Pillar", "Chevron"][kind],
        color: "#000",
        emissive: "#fff",
        emissiveMap: tex,
        map: tex,
        roughness: 0.35,
        side: THREE.DoubleSide,
      });
    } else {
      if (!std.has(m)) {
        const c = m.clone();
        c.envMap = null;
        c.name = o.userData.part;
        std.set(m, c);
      }
      m = std.get(m);
    }
    const mesh = new THREE.Mesh(o.geometry, m);
    mesh.name = o.userData.part;
    out.add(mesh);
  });
  if (cfg.neonOn && src.neonPos.length) {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(src.neonPos, 3));
    const l = new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: cfg.neon }));
    l.name = "neon_edges";
    out.add(l);
  }
  if (withSeats && seats) {
    const s = seats.clone(true);
    s.name = "seating";
    out.add(s);
  }
  out.userData = { generator: "Polyvault stage studio", units: "metres", dimensions: dims, theme: cfg.theme };
  const buf = await new GLTFExporter().parseAsync(out, { binary: true });
  return new Blob([buf], { type: "model/gltf-binary" });
}

const DIMS = [
  ["w", "Stage width", 0.1],
  ["d", "Stage depth", 0.1],
  ["deck", "Deck height", 0.05],
  ["screen", "Screen height", 0.05],
  ["rig", "Rig height", 0.1],
];
function SizePanel({ pro, user, dims, setDims, unit, setUnit, measure, setMeasure, seats, setSeats, onExport, ex, exMsg }) {
  const area = dims.w * dims.d;
  return (
    <div className={"st-size" + (pro ? "" : " locked")}>
      <h4>
        Dimensions <span className="st-pro">PRO</span>
      </h4>
      <div className="st-presets">
        {Object.entries(PRESETS).map(([n, p]) => (
          <button
            key={n}
            disabled={!pro}
            className={DIMS.every(([k]) => Math.abs(dims[k] - p[k]) < 1e-6) ? "on" : ""}
            onClick={() => setDims(fixDims(p))}
          >
            {n}
          </button>
        ))}
      </div>
      {DIMS.map(([k, l, step]) => {
        const lo = k === "rig" ? Math.max(LIMITS.rig[0], dims.deck + dims.screen + 0.8) : LIMITS[k][0];
        return (
          <label key={k} className="st-dimrow">
            <span>{l}</span>
            <b>{fmtLen(dims[k], unit)}</b>
            <input
              type="range"
              min={lo}
              max={LIMITS[k][1]}
              step={step}
              value={dims[k]}
              disabled={!pro}
              onChange={(e) => setDims(fixDims({ ...dims, [k]: +e.target.value }))}
              style={{ "--f": Math.min(1, Math.max(0, (dims[k] - lo) / (LIMITS[k][1] - lo))) }}
            />
          </label>
        );
      })}
      <div className="st-sizesum">
        <span>
          {fmtLen(dims.w, unit)} × {fmtLen(dims.d, unit)}
        </span>
        <span>{unit === "ft" ? Math.round(area * 10.7639) + " ft²" : area.toFixed(1) + " m²"} deck</span>
      </div>
      <div className="st-sizeopts">
        <button onClick={() => setUnit(unit === "m" ? "ft" : "m")}>⇄ {unit === "m" ? "Metres" : "Feet"}</button>
        <button className={measure ? "on" : ""} onClick={() => setMeasure(!measure)}>
          📏 Guides
        </button>
        <button className={seats ? "on" : ""} disabled={!pro} onClick={() => setSeats(!seats)}>
          {seats ? "●" : "○"} Seats in file
        </button>
      </div>
      {pro ? (
        <button className={"st-export " + ex} onClick={onExport} disabled={!!ex && ex !== "done"}>
          {ex === "auth"
            ? "Checking your plan…"
            : ex === "build"
            ? "Building GLB…"
            : ex === "done"
            ? "✓ Downloaded"
            : "⬇ Download custom GLB"}
        </button>
      ) : (
        <div className="st-lock">
          <b>🔒 Resize this stage to fit your venue</b>
          <p>Pro members can change every dimension and download the customised stage as a GLB.</p>
          <Link className="btn" to={user ? "/pricing" : "/login"} state={user ? undefined : { back: location.pathname }}>
            {user ? "Upgrade to Pro" : "Log in"}
          </Link>
        </div>
      )}
      {exMsg && <p className="st-exmsg">{exMsg}</p>}
    </div>
  );
}

export default function StageStudio({ a }) {
  const wrap = useRef(),
    [cfg, setCfg] = useState(DEFAULT),
    [view, setView] = useState(null),
    [burst, setBurst] = useState(0),
    // the panel is a side drawer on wide screens and a bottom sheet (closed by default) on phones
    [wide, setWide] = useState(() => window.innerWidth > 760),
    [open, setOpen] = useState(wide),
    { user } = useAuth(),
    pro = !!user && (user.plan === "paid" || user.role === "admin"),
    // dims = slider values, built = what the 3D model uses (debounced: a rebuild remaps ~0.5M vertices)
    [dims, setDims] = useState(BASE),
    [built, setBuilt] = useState(BASE),
    [unit, setUnit] = useState("m"),
    [measure, setMeasure] = useState(false),
    [seats, setSeats] = useState(true),
    [ex, setEx] = useState(""),
    [exMsg, setExMsg] = useState(""),
    exportRef = useRef(),
    seatsRef = useRef(),
    set = (k, v) => setCfg((c) => ({ ...c, [k]: v, ...(PICKS.some((p) => p[0] === k) && { theme: "Custom" }) }));
  useEffect(() => {
    const t = setTimeout(() => setBuilt(dims), 90);
    return () => clearTimeout(t);
  }, [dims]);
  const resize = (d) => {
    setDims(d);
    setMeasure(true);
  };
  const exportGLB = async () => {
    if (!pro || (ex && ex !== "done")) return;
    setExMsg("");
    setEx("auth");
    try {
      // the server checks the plan and counts the download; the file itself is built right here
      await api(`/assets/${a.id}/custom`, { method: "POST", body: built });
      setEx("build");
      await new Promise((r) => setTimeout(r, 30)); // let the button repaint before the heavy export
      const blob = await buildGLB(exportRef.current, seatsRef.current, cfg, built, a.title, seats && cfg.seats),
        u = URL.createObjectURL(blob);
      Object.assign(document.createElement("a"), {
        href: u,
        download: `${a.title} - ${built.w}x${built.d}m custom.glb`,
      }).click();
      setTimeout(() => URL.revokeObjectURL(u), 2000);
      setEx("done");
      setExMsg(`${(blob.size / 1048576).toFixed(1)} MB · ${fmtLen(built.w, "m")} × ${fmtLen(built.d, "m")} · real-world metres`);
      setTimeout(() => setEx(""), 2500);
    } catch (e) {
      setEx("");
      setExMsg(e.message || "Export failed");
    }
  };
  useEffect(() => {
    const r = () => setWide(window.innerWidth > 760);
    addEventListener("resize", r);
    return () => removeEventListener("resize", r);
  }, []);
  const full = () =>
    document.fullscreenElement ? document.exitFullscreen() : wrap.current.requestFullscreen?.();
  const snap = () => {
    const c = wrap.current.querySelector("canvas");
    Object.assign(document.createElement("a"), {
      href: c.toDataURL("image/png"),
      download: `${a.title} - ${cfg.theme}.png`,
    }).click();
  };
  return (
    <div className={"stage-studio" + (open ? " open" : "")} ref={wrap}>
      <StageScene
        url={stageUrl(a)}
        cfg={cfg}
        view={view}
        burst={burst}
        shift={open && wide ? 160 : 0}
        dims={built}
        measure={measure}
        unit={unit}
        exportRef={exportRef}
        seatsRef={seatsRef}
      />
      <div className="st-views">
        {Object.keys(VIEWS).map((v) => (
          <button key={v} onClick={() => setView({ name: v, k: Date.now() })}>
            {v}
          </button>
        ))}
      </div>
      <div className="st-hint">Drag to orbit 360° · scroll to zoom</div>
      <div className="st-quick">
        <button className={cfg.show ? "on" : ""} onClick={() => set("show", !cfg.show)} title="Light show">
          ✦ Show
        </button>
        <button onClick={() => setBurst((b) => b + 1)} title="Confetti">
          🎉
        </button>
        <button className={cfg.rotate ? "on" : ""} onClick={() => set("rotate", !cfg.rotate)} title="Auto-rotate">
          ⟳
        </button>
        <button onClick={snap} title="Save screenshot">
          📷
        </button>
        <button onClick={full} title="Fullscreen">
          ⛶
        </button>
        <button className="st-toggle" onClick={() => setOpen(!open)}>
          {open ? "Hide studio" : "🎨 Studio"}
        </button>
      </div>
      <aside className="st-panel">
        <SizePanel
          pro={pro}
          user={user}
          dims={dims}
          setDims={resize}
          unit={unit}
          setUnit={setUnit}
          measure={measure}
          setMeasure={setMeasure}
          seats={seats}
          setSeats={setSeats}
          onExport={exportGLB}
          ex={ex}
          exMsg={exMsg}
        />
        <h4>Themes</h4>
        <div className="st-themes">
          {THEMES.map((t) => (
            <button
              key={t.name}
              className={cfg.theme === t.name ? "on" : ""}
              onClick={() => setCfg((c) => ({ ...c, ...t, theme: t.name }))}
              style={{ "--a": t.screenA, "--b": t.screenB, "--n": t.neon }}
            >
              <i />
              {t.name}
            </button>
          ))}
        </div>
        <h4>Colours</h4>
        <div className="st-picks">
          {PICKS.map(([k, l]) => (
            <label key={k}>
              <input type="color" value={cfg[k]} onChange={(e) => set(k, e.target.value)} />
              {l}
            </label>
          ))}
        </div>
        <h4>Screen text</h4>
        <input className="st-text" value={cfg.title} maxLength={24} onChange={(e) => set("title", e.target.value.toUpperCase())} />
        <input className="st-text" value={cfg.subtitle} maxLength={40} onChange={(e) => set("subtitle", e.target.value.toUpperCase())} />
        <h4>Lighting</h4>
        {[
          ["brightness", "Screens", 0.2, 2],
          ["beamPower", "Beams", 0, 2.5],
          ["glow", "Bloom glow", 0, 3],
        ].map(([k, l, mn, mx]) => (
          <label key={k} className="st-range">
            <span>{l}</span>
            <input type="range" min={mn} max={mx} step="0.05" value={cfg[k]} onChange={(e) => set(k, +e.target.value)} />
          </label>
        ))}
        <div className="st-toggles">
          {[
            ["beams", "Moving beams"],
            ["neonOn", "Neon edges"],
            ["haze", "Haze & dust"],
            ["seats", "Panel seating"],
          ].map(([k, l]) => (
            <button key={k} className={cfg[k] ? "on" : ""} onClick={() => set(k, !cfg[k])}>
              {cfg[k] ? "●" : "○"} {l}
            </button>
          ))}
          <button onClick={() => set("quality", cfg.quality === "high" ? "low" : "high")}>
            ⚙ Quality: {cfg.quality === "high" ? "High" : "Fast"}
          </button>
        </div>
        <button
          className="st-reset"
          onClick={() => {
            setCfg(DEFAULT);
            setDims(BASE);
          }}
        >
          Reset stage
        </button>
      </aside>
    </div>
  );
}
