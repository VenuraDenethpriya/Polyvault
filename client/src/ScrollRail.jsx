import { useEffect, useRef } from "react";

export default function ScrollRail() {
  const rail = useRef(), label = useRef();
  useEffect(() => {
    const update = () => {
      const max = document.documentElement.scrollHeight - window.innerHeight;
      const p = max > 0 ? Math.min(window.scrollY / max, 1) : 0;
      rail.current.style.setProperty("--p", p);
      label.current.textContent = Math.round(p * 100) + "%";
      rail.current.classList.toggle("on", window.scrollY > 80);
    };
    update();
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, []);
  const jump = (e) => {
    const b = e.currentTarget.getBoundingClientRect();
    const p = (e.clientY - b.top) / b.height;
    window.scrollTo({ top: p * (document.documentElement.scrollHeight - window.innerHeight), behavior: "smooth" });
  };
  return (
    <div className="rail-wrap" ref={rail} onClick={jump} title="Scroll progress">
      <div className="track"><div className="fill" /><div className="knob"><span ref={label}>0%</span></div></div>
    </div>
  );
}