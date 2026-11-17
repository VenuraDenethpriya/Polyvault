// Site-wide motion helpers.
//  - any element with [data-io] gets the class "in" the first time it scrolls into view
//    (CSS does the actual animation, children can stagger with --i)
//  - any ".spot" element gets --mx/--my = pointer position inside it, for cursor spotlights
import { Children, cloneElement, isValidElement, useEffect } from "react";

export function Fx() {
  useEffect(() => {
    const still = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const io = new IntersectionObserver(
      (es) =>
        es.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add("in");
            io.unobserve(e.target);
          }
        }),
      { threshold: 0.15, rootMargin: "0px 0px -6% 0px" },
    );
    const seen = new WeakSet();
    const scan = (root) => {
      if (root.nodeType !== 1) return;
      const list = root.matches("[data-io]") ? [root] : [];
      list.push(...root.querySelectorAll("[data-io]"));
      for (const el of list) {
        if (seen.has(el)) continue;
        seen.add(el);
        if (still) el.classList.add("in");
        else io.observe(el);
      }
    };
    scan(document.body);
    // pages render after navigation / data loads, so keep picking up new elements
    const mo = new MutationObserver((ms) => ms.forEach((m) => m.addedNodes.forEach(scan)));
    mo.observe(document.body, { childList: true, subtree: true });

    let raf = 0,
      ev = null;
    const paint = () => {
      raf = 0;
      const el = ev.target.closest?.(".spot");
      if (!el) return;
      const b = el.getBoundingClientRect();
      el.style.setProperty("--mx", ev.clientX - b.left + "px");
      el.style.setProperty("--my", ev.clientY - b.top + "px");
    };
    const move = (e) => {
      if (e.pointerType === "touch") return;
      ev = e;
      raf ||= requestAnimationFrame(paint);
    };
    addEventListener("pointermove", move, { passive: true });
    return () => {
      io.disconnect();
      mo.disconnect();
      cancelAnimationFrame(raf);
      removeEventListener("pointermove", move);
    };
  }, []);
  return null;
}

// Splits a heading into words that rise into place one after another (inside a [data-io] parent).
// Plain strings are split per word; elements such as <em> move as one word; <br/> is kept.
export function Words({ children }) {
  let n = 0;
  const w = (c, k) => (
    <span className="w" key={k}>
      <span style={{ "--w": n++ }}>{c}</span>
    </span>
  );
  return Children.toArray(children).flatMap((c, i) => {
    if (typeof c === "string")
      return c.split(/(\s+)/).map((s, j) => (s.trim() ? w(s, i + "-" + j) : s));
    if (isValidElement(c) && c.type === "br") return cloneElement(c, { key: i });
    return [w(c, i)];
  });
}

export function Head({ badge, left, children }) {
  return (
    <div className={"head x-head" + (left ? " left" : "")} data-io>
      <span className="badge x-badge">{badge}</span>
      <h2>
        <Words>{children}</Words>
      </h2>
    </div>
  );
}
