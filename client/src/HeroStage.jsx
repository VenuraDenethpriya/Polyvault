// Home hero: the stage assembles itself as you scroll, while the camera makes one full 360° orbit
// and lands on the front view. `prog.target` (0..1) is set by the page from the scroll position.
import { Suspense, useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { Canvas, useFrame } from "@react-three/fiber";
import { EffectComposer, Bloom, Vignette, SMAA } from "@react-three/postprocessing";
import { AssemblingStage, smooth } from "./Assemble.jsx";
import { CX } from "./Stage.jsx";

const T = new THREE.Vector3(CX, 2.3, 0);

function Rig({ prog, wide }) {
  const p = useRef(new THREE.Vector3()),
    look = useRef(T.clone());
  useFrame(({ camera, pointer, size, clock }) => {
    const P = prog.v,
      e = smooth(0, 0.95, P),
      aspect = size.width / Math.max(1, size.height),
      fit = Math.min(2.2, Math.max(1, 1.45 / aspect)),
      // one full turn over the scroll, plus a gentle idle sway while nothing is built yet
      th = (1 - e) * Math.PI * 2 + Math.sin(clock.elapsedTime * 0.18) * 0.22 * (1 - e) + 0.18 * (1 - e),
      r = THREE.MathUtils.lerp(27, 18, e) * fit,
      h = THREE.MathUtils.lerp(12.5, 3.6, e);
    p.current.set(T.x + Math.sin(th) * r + pointer.x * 1.2, h + pointer.y * 0.7, T.z + Math.cos(th) * r);
    camera.position.lerp(p.current, 0.12);
    look.current.set(T.x, THREE.MathUtils.lerp(3.9, 2.6, e), T.z);
    camera.lookAt(look.current);
    // early on the stage sits beside the headline (right on desktop, lower on phones);
    // it glides to the centre as the copy fades out
    // ...and at the end it lifts to leave room for the closing copy underneath
    const k = 1 - smooth(0.02, 0.4, P),
      up = smooth(0.8, 1, P),
      w = size.width,
      hh = size.height,
      oy = (wide ? 0 : -hh * 0.16 * k) + hh * (wide ? 0.13 : 0.1) * up;
    if (k > 0.001 || up > 0.001) camera.setViewOffset(w, hh, wide ? -w * 0.2 * k : 0, oy, w, hh);
    else if (camera.view?.enabled) camera.clearViewOffset();
  });
  return null;
}

export default function HeroStage({ prog, active = true }) {
  const [wide, setWide] = useState(() => window.innerWidth > 760);
  useEffect(() => {
    const r = () => setWide(window.innerWidth > 760);
    addEventListener("resize", r);
    return () => removeEventListener("resize", r);
  }, []);
  return (
    <Canvas
      frameloop={active ? "always" : "never"}
      dpr={wide ? [1, 1.5] : 1}
      gl={{ antialias: false, powerPreference: "high-performance" }}
      camera={{ position: [CX, 12, 27], fov: 42, near: 0.1, far: 300 }}
    >
      <color attach="background" args={["#07070d"]} />
      <fogExp2 attach="fog" args={["#07070d", 0.014]} />
      <Suspense fallback={null}>
        <AssemblingStage prog={prog} cell={wide ? 1.7 : 2.2} dust={wide ? 160 : 70} confetti vortex />
      </Suspense>
      <Rig prog={prog} wide={wide} />
      <EffectComposer multisampling={0} disableNormalPass>
        <Bloom mipmapBlur luminanceThreshold={1} luminanceSmoothing={0.3} intensity={1} radius={0.7} />
        <Vignette offset={0.3} darkness={0.75} />
        {wide ? <SMAA /> : <></>}
      </EffectComposer>
    </Canvas>
  );
}
