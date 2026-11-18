// Home "Categories" bento: asymmetric grid with a pointer-following spotlight + border glow,
// 3D tilt with parallax art, staggered entrance and per-tile ambient animation.
import { useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { CATS } from "./meta.js";

const STAGE_IMGS = ["/stages/conference-1.jpg", "/stages/conference-2.jpg", "/stages/conference-3.jpg"];
// fixed pseudo-random particle layout so it doesn't reshuffle on re-render
const DOTS = [12, 28, 41, 57, 69, 83, 35, 76].map((x, k) => ({ x, k }));

function Art({ s }) {
  return (
    <div className="bx-art" aria-hidden>
      <span className="bx-orbit o1">
        <i />
      </span>
      <span className="bx-orbit o2">
        <i />
      </span>
      <span className="bx-halo" />
      <i className="fl">
        <b className={"shape " + s} />
      </i>
      <span className="bx-floor" />
    </div>
  );
}

export default function Bento({ items = [] }) {
  const root = useRef();

  useEffect(() => {
    const el = root.current,
      tiles = [...el.querySelectorAll(".bx-tile")];
    // entrance once the grid scrolls into view
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
          el.classList.add("in");
          io.disconnect();
        }
      },
      { threshold: 0.12 },
    );
    io.observe(el);

    let raf = 0,
      ev = null;
    const paint = () => {
      raf = 0;
      const { clientX: x, clientY: y } = ev;
      for (const t of tiles) {
        const b = t.getBoundingClientRect(),
          lx = x - b.left,
          ly = y - b.top;
        // every tile gets the pointer position, so the glow spills over neighbouring borders
        t.style.setProperty("--mx", lx + "px");
        t.style.setProperty("--my", ly + "px");
        const over = lx >= 0 && ly >= 0 && lx <= b.width && ly <= b.height;
        if (over) {
          const px = lx / b.width - 0.5,
            py = ly / b.height - 0.5,
            k = b.width > 700 ? 3 : 8; // big tiles tilt less
          t.style.setProperty("--rx", (-py * k).toFixed(2) + "deg");
          t.style.setProperty("--ry", (px * k).toFixed(2) + "deg");
          t.style.setProperty("--px", px.toFixed(3));
          t.style.setProperty("--py", py.toFixed(3));
        } else if (t.style.getPropertyValue("--rx")) reset(t);
      }
    };
    const reset = (t) => ["--rx", "--ry", "--px", "--py"].forEach((p) => t.style.removeProperty(p));
    const move = (e) => {
      if (e.pointerType === "touch") return;
      ev = e;
      raf ||= requestAnimationFrame(paint);
    };
    const out = () => tiles.forEach(reset);
    el.addEventListener("pointermove", move);
    el.addEventListener("pointerleave", out);
    return () => {
      io.disconnect();
      cancelAnimationFrame(raf);
      el.removeEventListener("pointermove", move);
      el.removeEventListener("pointerleave", out);
    };
  }, []);

  const count = (n) => items.filter((a) => a.category === n).length;

  return (
    <div className="bx" ref={root}>
      {CATS.map(([n, d, s, c], i) => {
        const k = count(n),
          stage = s === "stage";
        return (
          <Link
            key={n}
            to={"/browse?category=" + encodeURIComponent(n)}
            className={"bx-tile b" + i + (stage ? " bx-stage" : "")}
            style={{ "--c": c, "--i": i }}
          >
            <span className="bx-glow" />
            <span className="bx-grid" />
            <span className="bx-sweep" />
            {stage ? (
              <div className="bx-show" aria-hidden>
                {STAGE_IMGS.map((src, j) => (
                  <img key={src} src={src} alt="" loading="lazy" style={{ "--j": j }} />
                ))}
                <span className="bx-beam l" />
                <span className="bx-beam r" />
                <span className="bx-scan" />
                <span className="bx-eq">
                  {Array.from({ length: 14 }, (_, j) => (
                    <i key={j} style={{ "--j": j }} />
                  ))}
                </span>
              </div>
            ) : (
              <>
                <Art s={s} />
                <span className="bx-dots" aria-hidden>
                  {DOTS.map(({ x, k }) => (
                    <em key={k} style={{ left: x + "%", "--k": k }} />
                  ))}
                </span>
              </>
            )}
            <div className="bx-top">
              {stage ? (
                <span className="bx-live">
                  <i /> New · 360° live 3D
                </span>
              ) : (
                <span className="bx-n">{String(i + 1).padStart(2, "0")}</span>
              )}
              {k > 0 && (
                <span className="bx-count">
                  {k} {k === 1 ? "asset" : "assets"}
                </span>
              )}
            </div>
            <div className="bx-copy">
              <h3>{n}</h3>
              <p>{d}</p>
              {stage && (
                <>
                  <span className="bx-feats">
                    {["⟲ 360° orbit", "◐ Recolour LEDs", "✦ Light show", "⬇ GLB download"].map((f, j) => (
                      <i key={f} style={{ "--j": j }}>
                        {f}
                      </i>
                    ))}
                  </span>
                  <span className="bx-cta">Enter the 360° studio →</span>
                </>
              )}
            </div>
            {!stage && <span className="bx-go">→</span>}
          </Link>
        );
      })}
    </div>
  );
}
