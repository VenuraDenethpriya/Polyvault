import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import {
  Float,
  OrbitControls,
  MeshDistortMaterial,
  Environment,
  Sparkles,
  useGLTF,
} from "@react-three/drei";
const G = {
  sphere: <sphereGeometry args={[1, 64, 64]} />,
  box: <boxGeometry args={[1.5, 1.5, 1.5]} />,
  torus: <torusGeometry args={[1, 0.35, 32, 100]} />,
  knot: <torusKnotGeometry args={[0.8, 0.28, 200, 32]} />,
  cone: <coneGeometry args={[1, 2, 48]} />,
};
function Shape({ type, color, pos = [0, 0, 0], scale = 1, distort = 0.3 }) {
  const r = useRef();
  useFrame((_, d) => {
    r.current.rotation.x += d * 0.3;
    r.current.rotation.y += d * 0.45;
  });
  return (
    <Float speed={2} floatIntensity={1.5}>
      <mesh ref={r} position={pos} scale={scale}>
        {G[type]}
        <MeshDistortMaterial
          color={color}
          distort={distort}
          speed={2}
          roughness={0.15}
          metalness={0.7}
        />
      </mesh>
    </Float>
  );
}
function Rig({ children }) {
  const g = useRef();
  useFrame(({ pointer, camera }) => {
    const s = Math.min(window.scrollY / window.innerHeight, 1.5); // scroll + mouse drive the 3D scene
    camera.position.x += (pointer.x * 1.5 - camera.position.x) * 0.05;
    camera.position.y += (pointer.y - camera.position.y) * 0.05;
    camera.position.z = 7 + s * 4;
    g.current.rotation.y = s * 2.2;
    camera.lookAt(0, 0, 0);
  });
  return <group ref={g}>{children}</group>;
}
function Model({ type, color, spin }) {
  const { scene } = useGLTF(`/models/${type}.glb`),
    r = useRef();
  const m = useMemo(() => {
    const c = scene.clone(true);
    c.traverse((o) => {
      if (o.isMesh) o.material = o.material.clone();
    });
    return c;
  }, [scene]);
  useEffect(() => {
    m.traverse((o) => o.isMesh && o.material.color.set(color || "#ffffff"));
  }, [m, color]);
  useFrame((_, d) => {
    if (spin) r.current.rotation.y += d * 0.5;
  });
  return (
    <Float speed={1.5}>
      <group ref={r}>
        <primitive object={m} />
      </group>
    </Float>
  );
}
export function Hero() {
  const ref = useRef(),
    [on, setOn] = useState(true); // pause rendering when scrolled out of view
  useEffect(() => {
    const o = new IntersectionObserver(([e]) => setOn(e.isIntersecting));
    o.observe(ref.current);
    return () => o.disconnect();
  }, []);
  return (
    <div ref={ref} style={{ width: "100%", height: "100%" }}>
      <Canvas
        frameloop={on ? "always" : "never"}
        dpr={[1, 1.5]}
        camera={{ position: [0, 0, 7], fov: 50 }}
      >
        <ambientLight intensity={0.5} />
        <directionalLight position={[5, 5, 5]} />
        <Environment preset="city" />
        <Sparkles count={90} scale={14} size={3} speed={0.4} color="#9d8cff" />
        <Rig>
          <Shape type="knot" color="#7c5cff" pos={[2.8, 0, 0]} scale={1.5} />
          <Shape type="sphere" color="#00d4ff" pos={[0, 2.2, -2]} scale={0.6} />
          <Shape type="torus" color="#ff4fd8" pos={[4.6, -2, -1]} scale={0.8} />
          <Shape type="box" color="#ffb84d" pos={[1.2, -2.4, -1]} scale={0.5} />
          <Shape type="cone" color="#3ddc97" pos={[5.2, 2.4, -2]} scale={0.5} />
        </Rig>
      </Canvas>
    </div>
  );
}
export const Viewer = ({ type, color, spin = true }) => (
  <Canvas camera={{ position: [0, 0, 5] }} dpr={[1, 1.5]}>
    <ambientLight intensity={0.6} />
    <directionalLight position={[4, 4, 4]} />
    <Environment preset="sunset" />
    <Suspense fallback={null}>
      <Model type={type} color={color} spin={spin} />
    </Suspense>
    <OrbitControls enablePan={false} minDistance={3} maxDistance={9} />
  </Canvas>
);
