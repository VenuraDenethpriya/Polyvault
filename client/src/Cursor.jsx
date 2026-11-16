import { useEffect, useRef } from "react";
import gsap from "gsap";

// Custom cursor. Activates as soon as a real mouse moves (works on touchscreen
// laptops and after leaving devtools device mode) and hides again on touch.
export default function Cursor() {
  const dot = useRef(),
    ring = useRef();
  useEffect(() => {
    const el = [dot.current, ring.current];
    const dx = gsap.quickTo(dot.current, "x", { duration: 0.1, ease: "power3" });
    const dy = gsap.quickTo(dot.current, "y", { duration: 0.1, ease: "power3" });
    const rx = gsap.quickTo(ring.current, "x", { duration: 0.45, ease: "power3" });
    const ry = gsap.quickTo(ring.current, "y", { duration: 0.45, ease: "power3" });

    const showAll = () => {
      document.body.classList.add("has-cursor");
      el.forEach((n) => n.classList.add("vis"));
    };
    const hideAll = () => {
      document.body.classList.remove("has-cursor");
      el.forEach((n) => n.classList.remove("vis"));
    };

    const move = (e) => {
      if (e.pointerType && e.pointerType !== "mouse") return;
      showAll();
      dx(e.clientX);
      dy(e.clientY);
      rx(e.clientX);
      ry(e.clientY);
    };
    const over = (e) => {
      const t = e.target;
      if (!(t instanceof Element)) return;
      ring.current.classList.toggle(
        "hover",
        !!t.closest("a,button,summary,select,input,.dd li,.tilt"),
      );
      ring.current.classList.toggle("drag", !!t.closest(".viewer,.stage"));
    };
    const down = (e) => {
      if (e.pointerType !== "mouse") return hideAll();
      ring.current.classList.add("down");
    };
    const up = () => ring.current.classList.remove("down");
    const leave = () => el.forEach((n) => n.classList.remove("vis"));

    window.addEventListener("pointermove", move);
    window.addEventListener("mouseover", over);
    window.addEventListener("pointerdown", down);
    window.addEventListener("pointerup", up);
    document.documentElement.addEventListener("mouseleave", leave);
    return () => {
      hideAll();
      window.removeEventListener("pointermove", move);
      window.removeEventListener("mouseover", over);
      window.removeEventListener("pointerdown", down);
      window.removeEventListener("pointerup", up);
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
