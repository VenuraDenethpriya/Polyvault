import { Suspense, useEffect, useMemo, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import {
  Float,
  OrbitControls,
  Environment,
  useGLTF,
} from "@react-three/drei";
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
