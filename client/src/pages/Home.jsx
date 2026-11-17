import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { api } from "../api.js";
import { Hero, Viewer } from "../Scene.jsx";
import Card from "../Card.jsx";
import { Plans } from "./Pricing.jsx";
import { CATS } from "../meta.js";
import Select from "../Select.jsx";

gsap.registerPlugin(ScrollTrigger);
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
    rail = useRef();
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
      gsap.to(".txt", {
        opacity: 0,
        y: -80,
        ease: "none",
        scrollTrigger: {
          trigger: ".hero",
          start: "top top",
          end: "bottom 35%",
          scrub: true,
        },
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
    go = (e) => {
      e.preventDefault();
      nav(
        `/browse?q=${encodeURIComponent(q)}&category=${encodeURIComponent(cat)}`,
      );
    };
  return (
    <>
      <header className="hero">
        <div className="bg">
          <Hero />
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
