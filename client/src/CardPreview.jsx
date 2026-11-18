// Live 3D preview shown inside a card while it is hovered (one at a time, lazy-loaded).
//  - 3D models spin in with a springy entrance, orbit rings and particles, tilting with the mouse
//  - images become a fanned stack of prints with a holographic sheen
//  - stages assemble themselves block by block and light up
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { Canvas, useFrame } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import { EffectComposer, Bloom } from "@react-three/postprocessing";
import { isImg, isStage, imgSrc } from "./meta.js";
import { useRoomEnv, CX, stageUrl } from "./Stage.jsx";
import { AssemblingStage, clamp01, smooth } from "./Assemble.jsx";

const easeOut = (t) => 1 - Math.pow(1 - t, 3);
const easeBack = (t) => 1 + 2.4 * Math.pow(t - 1, 3) + 1.4 * Math.pow(t - 1, 2);

// time since this component mounted (the clock is shared by the whole canvas)
function useAge() {
  const t0 = useRef(null);
  return (clock) => {
    if (t0.current === null) t0.current = clock.elapsedTime;
    return clock.elapsedTime - t0.current;
  };
}

// ---------------------------------------------------------------- 3D models
function Orbiters({ color }) {
  const g = useRef(),
    pts = useMemo(() => {
      const n = 140,
        p = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) {
        const a = Math.random() * Math.PI * 2,
          r = 1.6 + Math.random() * 0.9,
          y = (Math.random() - 0.5) * 1.6;
        p.set([Math.cos(a) * r, y, Math.sin(a) * r], i * 3);
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute("position", new THREE.BufferAttribute(p, 3));
      return geo;
    }, []),
    ringMat = useMemo(() => new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(1.6), transparent: true, opacity: 0.85 }), [color]);
  useEffect(() => () => (pts.dispose(), ringMat.dispose()), [pts, ringMat]);
  useFrame((_, d) => {
    g.current.rotation.y += d * 0.6;
    g.current.children[1].rotation.z += d * 0.9;
    g.current.children[2].rotation.x += d * 0.7;
  });
  return (
    <group ref={g}>
      <points geometry={pts}>
        <pointsMaterial size={0.045} color={color} transparent opacity={0.9} blending={THREE.AdditiveBlending} depthWrite={false} />
      </points>
      <mesh material={ringMat} rotation-x={Math.PI / 2.4}>
        <torusGeometry args={[1.85, 0.012, 8, 128]} />
      </mesh>
      <mesh material={ringMat} rotation-y={Math.PI / 3}>
        <torusGeometry args={[2.05, 0.008, 8, 128]} />
      </mesh>
    </group>
  );
}

function ModelP({ a }) {
  const { scene } = useGLTF(`/models/${a.shape}.glb`),
    g = useRef(),
    age = useAge();
  const { obj, mat } = useMemo(() => {
    const mat = new THREE.MeshPhysicalMaterial({
      color: a.color,
      metalness: 0.5,
      roughness: 0.16,
      clearcoat: 1,
      clearcoatRoughness: 0.08,
      iridescence: 0.7,
      iridescenceIOR: 1.5,
      emissive: a.color,
      emissiveIntensity: 0.12,
    });
    const obj = scene.clone(true);
    obj.traverse((o) => o.isMesh && (o.material = mat));
    // normalise every model to the same on-screen size, centred
    const box = new THREE.Box3().setFromObject(obj),
      s = 2.3 / Math.max(...box.getSize(new THREE.Vector3()).toArray(), 1e-3),
      c = box.getCenter(new THREE.Vector3());
    obj.scale.setScalar(s);
    obj.position.copy(c).multiplyScalar(-s);
    return { obj, mat };
  }, [scene, a.color]);
  const env = useMemo(() => [mat], [mat]);
  useRoomEnv(env);
  useEffect(() => () => mat.dispose(), [mat]);
  useFrame(({ clock, pointer }) => {
    const t = age(clock),
      k = clamp01(t / 0.9),
      m = g.current;
    m.scale.setScalar(Math.max(0.001, easeBack(k)));
    // one fast spin-in turn that settles into a slow idle spin
    m.rotation.y = -(1 - easeOut(k)) * Math.PI * 2.2 + t * 0.7 + pointer.x * 0.6;
    m.rotation.x += (-pointer.y * 0.45 - m.rotation.x) * 0.08;
    m.position.y = Math.sin(t * 1.6) * 0.08;
  });
  return (
    <>
      <group ref={g}>
        <primitive object={obj} />
      </group>
      <Orbiters color={a.color} />
    </>
  );
}

// ---------------------------------------------------------------- images
const SHEEN_VERT = /* glsl */ `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
const SHEEN_FRAG = /* glsl */ `
uniform sampler2D uMap; uniform float uT, uDim; uniform vec3 uEdge;
varying vec2 vUv;
void main(){
  vec3 c = texture2D(uMap, vUv).rgb * uDim;
  float s = vUv.x + vUv.y * 0.5 - mod(uT * 0.55, 2.6) + 0.4;
  c += vec3(0.85, 0.95, 1.0) * exp(-s * s * 70.0) * 0.4 * uDim;       // light sweeping across the print
  vec2 e = min(vUv, 1.0 - vUv);
  c += uEdge * (1.0 - smoothstep(0.0, 0.025, min(e.x, e.y))) * 0.9;     // glowing border
  gl_FragColor = vec4(c, 1.0);
  #include <colorspace_fragment>
}`;
function useSvgTexture(src) {
  const [tex, setTex] = useState(null);
  useEffect(() => {
    let t = null;
    const img = new Image();
    img.onload = () => {
      // draw the vector art at a fixed resolution (the SVGs only declare a viewBox)
      const c = document.createElement("canvas");
      c.width = 1200;
      c.height = 800;
      c.getContext("2d").drawImage(img, 0, 0, 1200, 800);
      t = new THREE.CanvasTexture(c);
      t.colorSpace = THREE.SRGBColorSpace;
      t.anisotropy = 4;
      setTex(t);
    };
    img.src = src;
    return () => t?.dispose();
  }, [src]);
  return tex;
}
function ImgP({ a, onReady }) {
  const tex = useSvgTexture(imgSrc(a)),
    g = useRef(),
    frames = useRef(0),
    layers = useRef([]),
    age = useAge();
  const mats = useMemo(
    () =>
      [0.32, 0.5, 1].map(
        (dim) =>
          new THREE.ShaderMaterial({
            vertexShader: SHEEN_VERT,
            fragmentShader: SHEEN_FRAG,
            toneMapped: false,
            side: THREE.DoubleSide,
            uniforms: { uMap: { value: null }, uT: { value: 0 }, uDim: { value: dim }, uEdge: { value: new THREE.Color(a.color || "#7c5cff").multiplyScalar(dim) } },
          }),
      ),
    [a.color],
  );
  useEffect(() => () => mats.forEach((m) => m.dispose()), [mats]);
  useEffect(() => mats.forEach((m) => (m.uniforms.uMap.value = tex)), [tex, mats]);
  // back prints fan out behind the front one
  const FAN = [
    [-0.42, 0.1, -0.55, 0.12],
    [0.4, -0.06, -0.28, -0.09],
    [0, 0, 0, 0],
  ];
  useFrame(({ clock, pointer }) => {
    if (!tex) return;
    if (++frames.current === 3) onReady(); // the image texture is async, so report readiness here
    const t = age(clock),
      k = easeBack(clamp01(t / 0.8));
    mats.forEach((m) => (m.uniforms.uT.value = t));
    layers.current.forEach((l, i) => {
      const [x, y, z, r] = FAN[i];
      l.position.set(x * k, y * k, z * k - (1 - k) * 0.6);
      l.rotation.z = r * k;
    });
    const G = g.current;
    G.rotation.y += (pointer.x * 0.4 + Math.sin(t * 0.8) * 0.12 - G.rotation.y) * 0.08;
    G.rotation.x += (-pointer.y * 0.3 - G.rotation.x) * 0.08;
    G.position.y = Math.sin(t * 1.4) * 0.05;
    G.scale.setScalar(0.85 + 0.15 * k);
  });
  return (
    <group ref={g} visible={!!tex}>
      {mats.map((m, i) => (
        <mesh key={i} ref={(r) => (layers.current[i] = r)} material={m}>
          <planeGeometry args={[3, 2]} />
        </mesh>
      ))}
    </group>
  );
}

// ---------------------------------------------------------------- stages
function StageP({ a }) {
  const prog = useRef({ target: 0, v: 0 }).current,
    age = useAge(),
    T = useMemo(() => new THREE.Vector3(CX, 2.2, 0), []);
  useFrame(({ clock, camera, pointer }) => {
    const t = age(clock);
    prog.target = clamp01(t / 2.6);
    const e = smooth(0, 1, prog.v),
      th = (1 - e) * Math.PI * 1.15 + Math.sin(Math.max(0, t - 2.6) * 0.3) * 0.55 * e + pointer.x * 0.25,
      r = THREE.MathUtils.lerp(22, 15, e),
      h = THREE.MathUtils.lerp(9, 4.2, e);
    camera.position.set(T.x + Math.sin(th) * r, h + pointer.y * 0.8, T.z + Math.cos(th) * r);
    camera.lookAt(T);
  });
  return <AssemblingStage url={stageUrl(a)} prog={prog} cell={2.2} dust={40} speed={8} title="CONFERENCE" subtitle="BUSINESS SUMMIT 2026" />;
}

// tells the card once the scene has actually drawn (so it can cross-fade from the still image)
function Ready({ onReady }) {
  const n = useRef(0);
  useFrame(() => {
    if (++n.current === 3) onReady();
  });
  return null;
}

export default function CardPreview({ a, onReady }) {
  const stage = isStage(a),
    img = isImg(a);
  return (
    <Canvas
      dpr={[1, 1.75]}
      gl={{ antialias: !stage, alpha: !stage, powerPreference: "high-performance" }}
      camera={stage ? { position: [CX, 9, 22], fov: 42, near: 0.1, far: 200 } : { position: [0, 0, img ? 4.1 : 5.4], fov: 40 }}
    >
      {stage && <color attach="background" args={["#07070d"]} />}
      {stage && <fogExp2 attach="fog" args={["#07070d", 0.016]} />}
      {!stage && (
        <>
          <ambientLight intensity={0.35} />
          <directionalLight position={[3, 4, 5]} intensity={2.2} />
          <pointLight position={[-3, -1, 2]} intensity={14} color={a.color} />
          <pointLight position={[2, 2, -3]} intensity={10} color="#ffffff" />
        </>
      )}
      <Suspense fallback={null}>
        {stage ? <StageP a={a} /> : img ? <ImgP a={a} onReady={onReady} /> : <ModelP a={a} />}
        {!img && <Ready onReady={onReady} />}
      </Suspense>
      {stage && (
        <EffectComposer multisampling={0} disableNormalPass>
          <Bloom mipmapBlur luminanceThreshold={1} luminanceSmoothing={0.3} intensity={0.9} radius={0.6} />
        </EffectComposer>
      )}
    </Canvas>
  );
}
