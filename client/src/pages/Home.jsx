import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { api } from "../api.js";
import { Viewer } from "../Scene.jsx";
import Card from "../Card.jsx";
import Bento from "../Bento.jsx";
import { Head, Words } from "../fx.jsx";
import { Plans } from "./Pricing.jsx";
import { CATS, isStage } from "../meta.js";
import Select from "../Select.jsx";

gsap.registerPlugin(ScrollTrigger);
// the hero's 3D stage (and its three.js/postprocessing code) loads in its own chunk
const HeroStage = lazy(() => import("../HeroStage.jsx"));
const still = () => matchMedia("(prefers-reduced-motion: reduce)").matches;

// Scroll-driven hero: the section is several screens tall and its content is sticky, so scrolling
// through it drives the stage assembly (0 -> 1) instead of moving the page.
function useHeroScroll(ref, prog) {
  const [on, setOn] = useState(true);
  useEffect(() => {
    const el = ref.current,
      pct = el.querySelector(".hero-pct");
    if (still()) {
      prog.target = prog.v = 1;
      el.style.setProperty("--hp", 1);
      el.classList.add("done");
      return;
    }
    let raf = 0;
    const upd = () => {
      raf = 0;
      const r = el.getBoundingClientRect(),
        p = Math.min(1, Math.max(0, -r.top / Math.max(1, r.height - innerHeight)));
      prog.target = p;
      el.style.setProperty("--hp", p.toFixed(4));
      el.classList.toggle("done", p > 0.86);
      el.classList.toggle("moved", p > 0.01);
      el.classList.toggle("gone", p > 0.2);
      if (pct) pct.textContent = Math.round(Math.min(1, p / 0.82) * 100) + "%";
    };
    const f = () => raf || (raf = requestAnimationFrame(upd));
    upd();
    addEventListener("scroll", f, { passive: true });
    addEventListener("resize", f);
    // stop rendering the 3D scene once the hero is scrolled away
    const o = new IntersectionObserver(([e]) => setOn(e.isIntersecting));
    o.observe(el);
    return () => {
      removeEventListener("scroll", f);
      removeEventListener("resize", f);
      cancelAnimationFrame(raf);
      o.disconnect();
    };
  }, [ref, prog]);
  return on;
}
function Count({ to, suf = "" }) {
  const r = useRef();
  useEffect(() => {
    const o = { v: 0 },
      t = gsap.to(o, {
        v: to,
        duration: 2,
        ease: "power2.out",
        scrollTrigger: { trigger: r.current, start: "top 92%" },
        onUpdate: () => {
          r.current.textContent = Math.round(o.v).toLocaleString() + suf;
        },
      });
    return () => {
      t.scrollTrigger?.kill();
      t.kill();
    };
  }, [to, suf]);
  return <b ref={r}>0{suf}</b>;
}

// small line icons (24x24, stroke = currentColor)
const I = (d) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    {d}
  </svg>
);
const ICO = {
  cube: I(<><path d="M12 2 3 7v10l9 5 9-5V7z" /><path d="m3 7 9 5 9-5M12 12v10" /></>),
  layers: I(<><path d="m12 2 10 5-10 5L2 7z" /><path d="m2 12 10 5 10-5M2 17l10 5 10-5" /></>),
  users: I(<><circle cx="9" cy="8" r="4" /><path d="M2 21a7 7 0 0 1 14 0M16 3.5a4 4 0 0 1 0 9M22 21a7 7 0 0 0-4-6.3" /></>),
  shield: I(<><path d="M12 2 4 5v6c0 5 3.4 9.4 8 11 4.6-1.6 8-6 8-11V5z" /><path d="m8.5 12 2.5 2.5 4.5-5" /></>),
  box: I(<><path d="M21 8v13H3V8M1 3h22v5H1zM10 12h4" /></>),
  heart: I(<path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8z" />),
  down: I(<><path d="M12 3v13M6 11l6 6 6-6M4 21h16" /></>),
  star: I(<path d="m12 2 3.1 6.3 6.9 1-5 4.9 1.2 6.8L12 17.8 5.8 21l1.2-6.8-5-4.9 6.9-1z" />),
  search: I(<><circle cx="11" cy="11" r="7" /><path d="m20 20-4-4" /></>),
  eye: I(<><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8S1 12 1 12z" /><circle cx="12" cy="12" r="3" /></>),
};

const FEATS = [
  ["Real-time 3D preview", "Rotate, zoom and recolour every asset in your browser before you download.", "sphere", "#7c5cff", ICO.cube],
  ["Tiered quality downloads", "Guests get previews, members get medium, Pro gets full resolution.", "torus", "#00d4ff", ICO.layers],
  ["Role-based platform", "Admins, developers and users each get their own tools and permissions.", "knot", "#ff4fd8", ICO.users],
  ["Secure by design", "JWT authentication, hashed passwords and server-enforced licensing.", "box", "#ffb84d", ICO.shield],
];
const STATS = [
  [null, "+", "Premium assets", ICO.box, "#7c5cff", "M0 26 L14 22 L28 24 L42 15 L56 17 L70 9 L84 11 L100 3"],
  [48, "K", "Happy creators", ICO.heart, "#ff4fd8", "M0 24 L16 25 L30 18 L46 20 L60 12 L76 14 L88 6 L100 7"],
  [2, "M", "Downloads served", ICO.down, "#00d4ff", "M0 27 L12 20 L26 23 L40 13 L54 16 L68 8 L84 10 L100 2"],
  [99, "%", "Satisfaction", ICO.star, "#3ddc97", "M0 12 L14 10 L28 11 L42 7 L56 8 L70 5 L84 6 L100 4"],
];
const STEPS = [
  ["01", "Discover", "Search or browse curated categories of 3D assets.", ICO.search, "#7c5cff"],
  ["02", "Preview", "Rotate, zoom and recolour in a live 3D viewer.", ICO.eye, "#00d4ff"],
  ["03", "Download", "Get the quality your plan unlocks, instantly.", ICO.down, "#ff4fd8"],
];
const REV = [
  ["Polyvault cut our prototyping time in half. The live recolour is brilliant.", "Aria Chen", "Creative Director", "#7c5cff"],
  ["Clean models, fair pricing and the Pro files are game-ready.", "Leo Park", "Indie Game Dev", "#00d4ff"],
  ["We ship event microsites faster with these 3D assets.", "Maya Singh", "Web Developer", "#ff4fd8"],
  ["The 360° stage studio sold our client on the concept in one call.", "Daniel Ruiz", "Event Producer", "#ffb84d"],
  ["Previewing in the browser before downloading saves me hours every week.", "Sofia Rossi", "3D Artist", "#3ddc97"],
  ["Finally a marketplace where the textures actually match the previews.", "Kenji Watanabe", "Technical Artist", "#ff7e5f"],
];
const FEAT_MS = 5000;

function Quote({ q: [t, n, r, c] }) {
  return (
    <figure className="x-q spot" style={{ "--c": c }}>
      <span className="x-qmark" aria-hidden>
        “
      </span>
      <div className="stars">★★★★★</div>
      <blockquote>{t}</blockquote>
      <figcaption>
        <i className="x-av">
          {n
            .split(" ")
            .map((s) => s[0])
            .join("")}
        </i>
        <span>
          <b>{n}</b>
          <span>{r}</span>
        </span>
      </figcaption>
    </figure>
  );
}

export default function Home() {
  const nav = useNavigate(),
    [items, setItems] = useState([]),
    [q, setQ] = useState(""),
    [cat, setCat] = useState(""),
    [f, setF] = useState(0),
    [hold, setHold] = useState(false),
    rail = useRef(),
    bar = useRef(),
    hero = useRef(),
    prog = useRef({ target: 0, v: 0 }).current,
    live = useHeroScroll(hero, prog);
  useEffect(() => {
    api("/assets").then(setItems);
  }, []);
  useEffect(() => {
    const c = gsap.context(() => {
      gsap.from(".hero .anim", {
        y: 50,
        opacity: 0,
        stagger: 0.12,
        duration: 0.9,
        ease: "power3.out",
      });
      gsap.utils.toArray(".reveal").forEach((el) =>
        gsap.from(el, {
          y: 60,
          opacity: 0,
          duration: 0.9,
          ease: "power3.out",
          scrollTrigger: { trigger: el, start: "top 88%" },
        }),
      );
    });
    return () => c.revert();
  }, []);
  useEffect(() => {
    ScrollTrigger.refresh();
  }, [items.length]);
  // the feature list cycles by itself until the visitor hovers one
  useEffect(() => {
    if (hold || still()) return;
    const t = setTimeout(() => setF((v) => (v + 1) % FEATS.length), FEAT_MS);
    return () => clearTimeout(t);
  }, [f, hold]);
  // trending rail: scroll position indicator
  const railPos = () => {
    const r = rail.current,
      b = bar.current;
    if (!r || !b) return;
    const w = Math.min(1, r.clientWidth / Math.max(1, r.scrollWidth));
    b.style.setProperty("--w", w);
    b.style.setProperty("--l", (r.scrollLeft / Math.max(1, r.scrollWidth - r.clientWidth)) * (1 - w));
  };
  useEffect(railPos, [items.length]);

  const hot = [...items].sort((a, b) => b.downloads - a.downloads).slice(0, 10),
    fresh = [...items].sort((a, b) => b.id - a.id).slice(0, 8),
    stage = items.find(isStage),
    go = (e) => {
      e.preventDefault();
      nav(`/browse?q=${encodeURIComponent(q)}&category=${encodeURIComponent(cat)}`);
    },
    slide = (d) => rail.current.scrollBy({ left: d * 420, behavior: "smooth" });
  return (
    <>
      <header className="hero hero-x" ref={hero}>
        <div className="hero-pin">
          <div className="bg">
            <Suspense fallback={null}>
              <HeroStage prog={prog} active={live} />
            </Suspense>
          </div>
          <div className="shade" />
          <div className="wrap txt">
            <span className="badge anim">✦ New · Unlimited 3D downloads</span>
            <h1 className="anim">
              Create <em>without</em> limits.
              <br />
              Download the <em>future</em>.
            </h1>
            <p className="anim">
              Premium 3D models, textures, icons and graphics. Preview in real time, then download in the quality your
              plan unlocks.
            </p>
            <form className="search anim" onSubmit={go}>
              <Select value={cat} onChange={setCat} options={CATS.map((c) => c[0])} />
              <input placeholder="Search 3D assets…" value={q} onChange={(e) => setQ(e.target.value)} />
              <button className="btn">Search</button>
            </form>
            <div className="pop anim">
              Popular:{" "}
              {["orb", "knot", "torus", "glass", "neon"].map((t) => (
                <Link key={t} to={"/browse?q=" + t}>
                  {t}
                </Link>
              ))}
            </div>
          </div>
          <div className="wrap hero-end">
            <span className="badge">✦ New category · Stages</span>
            <h2>
              Built live, <em>block by block</em>.
            </h2>
            <p>
              Every stage in Polyvault runs in real time. Orbit it in 360°, recolour the LED screens and neon, and set
              the lights going.
            </p>
            <div className="row">
              <Link className="btn big" to={stage ? "/asset/" + stage.id : "/browse?category=Stages"}>
                Open the 360° studio →
              </Link>
              <Link className="btn ghost big" to="/browse?category=Stages">
                Browse stages
              </Link>
            </div>
          </div>
          <div className="hero-cue">
            <i />
            <span>Scroll to build the stage</span>
            <b className="hero-pct">0%</b>
          </div>
        </div>
      </header>
      <div className="marquee">
        <div>
          {[...CATS, ...CATS, ...CATS].map((c, i) => (
            <span key={i}>◆ {c[0]}</span>
          ))}
        </div>
      </div>
      <section className="wrap sect reveal">
        <Head badge="Categories">
          Everything you need to <em>build</em>
        </Head>
        <Bento items={items} />
      </section>

      <section className="wrap sect reveal">
        <div className="row between">
          <Head badge="🔥 Trending" left>
            Most downloaded <em>this week</em>
          </Head>
          <div className="arrows x-arrows">
            <button onClick={() => slide(-1)} aria-label="Previous">
              ←
            </button>
            <button onClick={() => slide(1)} aria-label="Next">
              →
            </button>
          </div>
        </div>
        <div className="rail x-rail" ref={rail} onScroll={railPos}>
          {hot.map((a, i) => (
            <Card key={a.id} a={a} i={i} />
          ))}
        </div>
        <div className="x-railbar" ref={bar}>
          <i />
        </div>
      </section>

      <section className="wrap sect reveal show x-show">
        <div>
          <Head badge="Why Polyvault" left>
            A marketplace that feels <em>alive</em>
          </Head>
          <div className="x-feats" data-io>
            {FEATS.map(([t, d, , c, ic], i) => (
              <button
                key={t}
                className={"x-feat spot" + (f === i ? " on" : "")}
                style={{ "--c": c, "--i": i }}
                onMouseEnter={() => {
                  setF(i);
                  setHold(true);
                }}
                onMouseLeave={() => setHold(false)}
                onClick={() => setF(i)}
              >
                <span className="x-fi">{ic}</span>
                <span className="x-ft">
                  <h3>{t}</h3>
                  <p>{d}</p>
                </span>
                {f === i && !hold && <i className="x-fbar" key={f} style={{ "--t": FEAT_MS + "ms" }} />}
              </button>
            ))}
          </div>
        </div>
        <div className="stage x-stage" style={{ "--sc": FEATS[f][3] }} data-io>
          <span className="x-ring r1" />
          <span className="x-ring r2" />
          <span className="x-ring r3" />
          <Viewer type={FEATS[f][2]} color={FEATS[f][3]} />
          <div className="x-hud">
            <span>
              {String(f + 1).padStart(2, "0")} / {String(FEATS.length).padStart(2, "0")}
            </span>
            <b key={f}>{FEATS[f][0]}</b>
          </div>
          <span className="x-drag">⟲ Drag to rotate</span>
        </div>
      </section>

      <section className="wrap sect reveal">
        <div className="x-stats" data-io>
          {STATS.map(([n, s, l, ic, c, d], i) => (
            <div key={l} className="x-stat spot" style={{ "--c": c, "--i": i }}>
              <span className="x-si">{ic}</span>
              <Count to={n ?? (items.length * 850 || 12000)} suf={s} />
              <span className="x-sl">{l}</span>
              <svg className="x-spark" viewBox="0 0 100 30" preserveAspectRatio="none" aria-hidden>
                <path d={d + " L100 30 L0 30 Z"} className="fill" />
                <path d={d} pathLength="1" className="line" />
              </svg>
            </div>
          ))}
        </div>
      </section>

      <section className="wrap sect reveal">
        <div className="row between">
          <Head badge="Just in" left>
            Fresh <em>arrivals</em>
          </Head>
          <Link className="btn ghost x-all" to="/browse">
            View all <span>→</span>
          </Link>
        </div>
        <div className="grid">
          {fresh.map((a, i) => (
            <Card key={a.id} a={a} i={i} />
          ))}
        </div>
      </section>

      <section className="wrap sect reveal">
        <Head badge="How it works">
          From idea to download in <em>three steps</em>
        </Head>
        <div className="x-steps" data-io>
          <div className="x-line">
            <i />
          </div>
          {STEPS.map(([n, t, d, ic, c], i) => (
            <div key={n} className="x-step spot" style={{ "--c": c, "--i": i }}>
              <span className="x-node">
                <span>{ic}</span>
              </span>
              <b className="x-num">{n}</b>
              <h3>{t}</h3>
              <p>{d}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="wrap sect reveal">
        <Head badge="Plans">
          Pick your <em>quality</em>
        </Head>
        <Plans />
      </section>

      <section className="sect reveal x-quotes-sect">
        <div className="wrap">
          <Head badge="Loved by creators">
            What people are <em>saying</em>
          </Head>
        </div>
        <div className="x-quotes" data-io>
          {[REV, [...REV].reverse()].map((row, r) => (
            <div className={"x-qrow" + (r ? " rev" : "")} key={r}>
              <div className="x-qtrack">
                {[...row, ...row].map((v, i) => (
                  <Quote key={i} q={v} />
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="wrap sect reveal">
        <div className="cta x-cta spot" data-io>
          <span className="x-aur a1" />
          <span className="x-aur a2" />
          <span className="x-aur a3" />
          <span className="x-floor" />
          {[
            ["sphere", "#7c5cff"],
            ["torus", "#00d4ff"],
            ["diamond", "#ff4fd8"],
            ["cone", "#3ddc97"],
          ].map(([s, c], i) => (
            <i key={s} className={"x-fly f" + i} style={{ "--c": c }} aria-hidden>
              <i className="fl">
                <b className={"shape " + s} />
              </i>
            </i>
          ))}
          <span className="badge x-badge">✦ Free forever plan</span>
          <h2>
            <Words>
              Ready to build something <em>extraordinary</em>?
            </Words>
          </h2>
          <p>Join free and start downloading in seconds.</p>
          <div className="row x-ctab">
            <Link className="btn big x-glowbtn" to="/register">
              Create free account
            </Link>
            <Link className="btn ghost big" to="/browse">
              Explore assets
            </Link>
          </div>
          <div className="x-trust">
            <span>★ 4.9 average rating</span>
            <span>48K+ creators</span>
            <span>No credit card</span>
          </div>
        </div>
      </section>
    </>
  );
}
