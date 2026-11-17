import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { api } from "../api.js";
import { Viewer } from "../Scene.jsx";
import Card from "../Card.jsx";
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
const FEATS = [
  [
    "Real-time 3D preview",
    "Rotate, zoom and recolour every asset in your browser before you download.",
    "sphere",
    "#7c5cff",
  ],
  [
    "Tiered quality downloads",
    "Guests get previews, members get medium, Pro gets full resolution.",
    "torus",
    "#00d4ff",
  ],
  [
    "Role-based platform",
    "Admins, developers and users each get their own tools and permissions.",
    "knot",
    "#ff4fd8",
  ],
  [
    "Secure by design",
    "JWT authentication, hashed passwords and server-enforced licensing.",
    "box",
    "#ffb84d",
  ],
];
const REV = [
  [
    "Polyvault cut our prototyping time in half. The live recolour is brilliant.",
    "Aria Chen",
    "Creative Director",
  ],
  [
    "Clean models, fair pricing and the Pro files are game-ready.",
    "Leo Park",
    "Indie Game Dev",
  ],
  [
    "We ship event microsites faster with these 3D assets.",
    "Maya Singh",
    "Web Developer",
  ],
];
export default function Home() {
  const nav = useNavigate(),
    [items, setItems] = useState([]),
    [q, setQ] = useState(""),
    [cat, setCat] = useState(""),
    [f, setF] = useState(0),
    rail = useRef(),
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
      gsap.utils
        .toArray(".reveal")
        .forEach((el) =>
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
  const hot = [...items].sort((a, b) => b.downloads - a.downloads).slice(0, 10),
    fresh = [...items].sort((a, b) => b.id - a.id).slice(0, 8),
    stage = items.find(isStage),
    go = (e) => {
      e.preventDefault();
      nav(
        `/browse?q=${encodeURIComponent(q)}&category=${encodeURIComponent(cat)}`,
      );
    };
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
              Premium 3D models, textures, icons and graphics. Preview in real
              time, then download in the quality your plan unlocks.
            </p>
            <form className="search anim" onSubmit={go}>
              {/* <select value={cat} onChange={(e) => setCat(e.target.value)}>
                <option value="">All</option>
                {CATS.map((c) => (
                  <option key={c[0]}>{c[0]}</option>
                ))}
              </select> */}
              <Select value={cat} onChange={setCat} options={CATS.map((c) => c[0])} />
              <input
                placeholder="Search 3D assets…"
                value={q}
                onChange={(e) => setQ(e.target.value)}
              />
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
            <p>Every stage in Polyvault runs in real time. Orbit it in 360°, recolour the LED screens and neon, and set the lights going.</p>
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
        <div className="head">
          <span className="badge">Categories</span>
          <h2>
            Everything you need to <em>build</em>
          </h2>
        </div>
        <div className="bento">
          {CATS.map(([n, d, s, c], i) => (
            <Link
              key={n}
              to={"/browse?category=" + encodeURIComponent(n)}
              className={"tile t" + i}
              style={{ "--c": c }}
            >
              {s === "stage" ? (
                <img className="tile-stage" src="/stages/conference-1.jpg" alt="" loading="lazy" />
              ) : (
                <div className="thumb">
                  <i className="fl">
                    <b className={"shape " + s} />
                  </i>
                </div>
              )}
              {s === "stage" && <span className="badge">New · 360° live 3D</span>}
              <h3>{n}</h3>
              <p>{d}</p>
            </Link>
          ))}
        </div>
      </section>
      <section className="wrap sect reveal">
        <div className="row between">
          <div className="head left">
            <span className="badge">Trending</span>
            <h2>Most downloaded this week</h2>
          </div>
          <div className="arrows">
            <button
              onClick={() =>
                rail.current.scrollBy({ left: -420, behavior: "smooth" })
              }
            >
              ←
            </button>
            <button
              onClick={() =>
                rail.current.scrollBy({ left: 420, behavior: "smooth" })
              }
            >
              →
            </button>
          </div>
        </div>
        <div className="rail" ref={rail}>
          {hot.map((a, i) => (
            <Card key={a.id} a={a} i={i} />
          ))}
        </div>
      </section>
      <section className="wrap sect reveal show">
        <div>
          <span className="badge">Why Polyvault</span>
          <h2>
            A marketplace that feels <em>alive</em>
          </h2>
          <div className="feats">
            {FEATS.map(([t, d], i) => (
              <button
                key={t}
                className={f === i ? "on" : ""}
                onMouseEnter={() => setF(i)}
                onClick={() => setF(i)}
              >
                <h3>{t}</h3>
                <p>{d}</p>
              </button>
            ))}
          </div>
        </div>
        <div className="stage">
          <Viewer type={FEATS[f][2]} color={FEATS[f][3]} />
        </div>
      </section>
      <section className="wrap sect reveal">
        <div className="stats">
          {[
            [items.length * 850 || 12000, "+", "Premium assets"],
            [48, "K", "Happy creators"],
            [2, "M", "Downloads served"],
            [99, "%", "Satisfaction"],
          ].map(([n, s, l]) => (
            <div key={l}>
              <Count to={n} suf={s} />
              <span>{l}</span>
            </div>
          ))}
        </div>
      </section>
      <section className="wrap sect reveal">
        <div className="row between">
          <div className="head left">
            <span className="badge">Just in</span>
            <h2>Fresh arrivals</h2>
          </div>
          <Link className="btn ghost" to="/browse">
            View all →
          </Link>
        </div>
        <div className="grid">
          {fresh.map((a, i) => (
            <Card key={a.id} a={a} i={i} />
          ))}
        </div>
      </section>
      <section className="wrap sect reveal">
        <div className="head">
          <span className="badge">How it works</span>
          <h2>
            From idea to download in <em>three steps</em>
          </h2>
        </div>
        <div className="steps">
          {[
            [
              "01",
              "Discover",
              "Search or browse curated categories of 3D assets.",
            ],
            ["02", "Preview", "Rotate, zoom and recolour in a live 3D viewer."],
            ["03", "Download", "Get the quality your plan unlocks, instantly."],
          ].map(([n, t, d]) => (
            <div key={n}>
              <b>{n}</b>
              <h3>{t}</h3>
              <p>{d}</p>
            </div>
          ))}
        </div>
      </section>
      <section className="wrap sect reveal">
        <div className="head">
          <span className="badge">Plans</span>
          <h2>
            Pick your <em>quality</em>
          </h2>
        </div>
        <Plans />
      </section>
      <section className="wrap sect reveal">
        <div className="head">
          <span className="badge">Loved by creators</span>
          <h2>What people are saying</h2>
        </div>
        <div className="quotes">
          {REV.map(([q, n, r]) => (
            <figure key={n}>
              <div className="stars">★★★★★</div>
              <blockquote>{q}</blockquote>
              <figcaption>
                <b>{n}</b>
                <span>{r}</span>
              </figcaption>
            </figure>
          ))}
        </div>
      </section>
      <section className="wrap sect reveal">
        <div className="cta">
          <h2>
            Ready to build something <em>extraordinary</em>?
          </h2>
          <p>Join free and start downloading in seconds.</p>
          <Link className="btn big" to="/register">
            Create free account
          </Link>
        </div>
      </section>
    </>
  );
}
