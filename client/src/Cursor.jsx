import { useEffect, useRef } from "react";
import gsap from "gsap";

export default function Cursor() {
  const dot = useRef(), ring = useRef();
  useEffect(() => {
    // only on devices with a real mouse (skip touch screens)
    if (!window.matchMedia("(hover:hover) and (pointer:fine)").matches) return;
    document.body.classList.add("has-cursor");
    const dx = gsap.quickTo(dot.current, "x", { duration: 0.1, ease: "power3" });
    const dy = gsap.quickTo(dot.current, "y", { duration: 0.1, ease: "power3" });
    const rx = gsap.quickTo(ring.current, "x", { duration: 0.45, ease: "power3" });
    const ry = gsap.quickTo(ring.current, "y", { duration: 0.45, ease: "power3" });
    const el = [dot.current, ring.current];

    const move = (e) => {
      el.forEach((n) => n.classList.add("show"));
      dx(e.clientX); dy(e.clientY); rx(e.clientX); ry(e.clientY);
    };
    const over = (e) => {
      const t = e.target;
      ring.current.classList.toggle("hover", !!t.closest("a,button,summary,select,input,.dd li,.tilt"));
      ring.current.classList.toggle("drag", !!t.closest(".viewer,.stage"));
    };
    const down = () => ring.current.classList.add("down");
    const up = () => ring.current.classList.remove("down");
    const leave = () => el.forEach((n) => n.classList.remove("show"));

    window.addEventListener("mousemove", move);
    window.addEventListener("mouseover", over);
    window.addEventListener("mousedown", down);
    window.addEventListener("mouseup", up);
    document.documentElement.addEventListener("mouseleave", leave);
    return () => {
      document.body.classList.remove("has-cursor");
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mouseover", over);
      window.removeEventListener("mousedown", down);
      window.removeEventListener("mouseup", up);
      document.documentElement.removeEventListener("mouseleave", leave);
    };
  }, []);
  return (
    <>
      <div className="cur-dot" ref={dot} />
      <div className="cur-ring" ref={ring} />
    </>
  );
}