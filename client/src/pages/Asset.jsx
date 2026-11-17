import { lazy, Suspense, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api, download } from "../api.js";
import { useAuth } from "../auth.jsx";
import { Viewer } from "../Scene.jsx";
import Card from "../Card.jsx";
import Checkout from "../Checkout.jsx";
import { meta, SIZES, isImg, imgSrc, isStage, stageImg, STAGE_Q } from "../meta.js";
// the stage studio (postprocessing, reflector, fat lines) only loads for stage assets
const StageStudio = lazy(() => import("../Stage.jsx"));
const SW = ["#7c5cff", "#00d4ff", "#ff4fd8", "#ffb84d", "#3ddc97", "#ffffff"];
export default function Asset() {
  const { id } = useParams(),
    { user, favs, toggleFav, owned } = useAuth(),
    nav = useNavigate(),
    [checkout, setCheckout] = useState(false),
    [a, setA] = useState(),
    [rel, setRel] = useState([]),
    [color, setColor] = useState(),
    [spin, setSpin] = useState(true),
    [msg, setMsg] = useState(""),
    [tab, setTab] = useState("desc"),
    [hue, setHue] = useState(0),
    [zoom, setZoom] = useState(1);
  useEffect(() => {
    setMsg("");
    api("/assets/" + id).then((x) => {
      setA(x);
      setColor(x.color);
      api("/assets?category=" + encodeURIComponent(x.category)).then((r) =>
        setRel(r.filter((y) => y.id !== x.id)),
      );
    });
  }, [id]);
  if (!a)
    return (
      <div className="wrap page">
        <p>Loading…</p>
      </div>
    );
  const m = meta(a),
    stage = isStage(a),
    pro = !!user && (user.plan === "paid" || user.role === "admin"),
    mine = owned.includes(a.id),
    tier = !user ? 0 : pro || mine ? 2 : 1,
    on = favs.includes(a.id);
  const go = async (q) => {
    try {
      await download(a, q);
      setMsg("✓ Downloaded " + q + " quality");
      api("/assets/" + id).then(setA);
    } catch (e) {
      setMsg(e.message);
    }
  };
  return (
    <div className="wrap page">
      <div className="crumbs">
        <Link to="/">Home</Link> /{" "}
        <Link to={"/browse?category=" + encodeURIComponent(a.category)}>
          {a.category}
        </Link>{" "}
        / {a.title}
      </div>
      {stage && (
        <>
          <div className="stage-intro">
            <div>
              <span className="badge">New · 360° stage studio</span>
              <h1>{a.title}</h1>
              <p>Orbit all the way round, pick a theme, retitle the LED wall and run a light show.</p>
            </div>
          </div>
          <Suspense fallback={<div className="stage-studio" />}>
            <StageStudio a={a} />
          </Suspense>
        </>
      )}
      <div className="detail">
        <div>
          {stage ? null : isImg(a) ? (
            <div className="viewer imgv">
              <img
                src={imgSrc(a)}
                alt={a.title}
                style={{
                  filter: `hue-rotate(${hue}deg)`,
                  transform: `scale(${zoom})`,
                }}
              />
              <div className="tools">
                <span>Zoom</span>
                <button
                  onClick={() =>
                    setZoom((z) => Math.max(1, +(z - 0.25).toFixed(2)))
                  }
                >
                  −
                </button>
                <button
                  onClick={() =>
                    setZoom((z) => Math.min(3, +(z + 0.25).toFixed(2)))
                  }
                >
                  ＋
                </button>
                <span>Hue</span>
                <input
                  type="range"
                  min="0"
                  max="360"
                  value={hue}
                  onChange={(e) => setHue(+e.target.value)}
                />
                <button
                  onClick={() => {
                    setHue(0);
                    setZoom(1);
                  }}
                >
                  Reset
                </button>
              </div>
              <small>Preview only · downloads are the original</small>
            </div>
          ) : (
            <div className="viewer">
              <Viewer type={a.shape} color={color} spin={spin} />
              <div className="tools">
                <span>Colour</span>
                {SW.map((c) => (
                  <i
                    key={c}
                    style={{ background: c }}
                    className={color === c ? "on" : ""}
                    onClick={() => setColor(c)}
                  />
                ))}
                <input
                  type="color"
                  value={color}
                  onChange={(e) => setColor(e.target.value)}
                />
                <button onClick={() => setSpin(!spin)}>
                  {spin ? "⏸ Pause" : "▶ Spin"}
                </button>
              </div>
              <small>Drag to rotate · scroll to zoom</small>
            </div>
          )}
          <div className="tabs" style={stage ? { marginTop: 0 } : undefined}>
            {[
              ["desc", "Description"],
              ["det", "Details"],
              ["rev", "Reviews"],
            ].map(([k, l]) => (
              <button
                key={k}
                className={tab === k ? "on" : ""}
                onClick={() => setTab(k)}
              >
                {l}
              </button>
            ))}
          </div>
          {tab === "desc" && (
            <div className="tabc">
              <p>{m.desc}</p>
              {stage && (
                <div className="st-gallery">
                  {[1, 2, 3].map((n) => (
                    <a key={n} href={stageImg(a, n)} target="_blank" rel="noreferrer">
                      <img loading="lazy" src={stageImg(a, n)} alt={`${a.title} render ${n}`} />
                    </a>
                  ))}
                </div>
              )}
              <div className="chips">
                {m.tags.map((t) => (
                  <Link key={t} to={"/browse?q=" + t}>
                    #{t}
                  </Link>
                ))}
              </div>
            </div>
          )}
          {tab === "det" && (
            <table className="tabc">
              <tbody>
                {[
                  ...(stage
                    ? [
                        ["Format", "GLB (glTF 2.0) · web + full precision"],
                        ["Polygons", m.polys + " tris"],
                        ["Scale", "Real-world metres · 14 × 6.5 m stage, 1 m deck"],
                        ["Screens", "8 × 3 m LED wall, 2 pillars, 6 chevrons (UV-mapped)"],
                        ["Rigging", "10 × 9 m truss at 7.2 m with moving heads"],
                      ]
                    : isImg(a)
                    ? [
                        ["Format", "SVG vector (scales to any size)"],
                        ["Aspect ratio", "3:2 landscape"],
                      ]
                    : [
                        ["Format", "GLB (glTF 2.0) + SVG preview"],
                        ["Polygons", m.polys + " tris"],
                        ["Materials", "PBR metal / roughness"],
                      ]),
                  ["Category", a.category],
                  ["Licence", "Standard (Pro: commercial)"],
                ].map(([k, v]) => (
                  <tr key={k}>
                    <td>{k}</td>
                    <td>{v}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {tab === "rev" && (
            <div className="tabc">
              {[
                ["Leo P.", "Super clean mesh, loads fast."],
                ["Maya S.", "Recolouring in the viewer is great."],
              ].map(([n, t]) => (
                <p key={n}>
                  <b>★★★★★ {n}</b>
                  <br />
                  {t}
                </p>
              ))}
            </div>
          )}
        </div>
        <aside className="buy">
          <span className="cat">{a.category}</span>
          <h1>{a.title}</h1>
          <div className="meta">
            <span>
              ★ {m.rating} ({m.reviews})
            </span>
            <span>by {m.author}</span>
            <span>⬇ {a.downloads.toLocaleString()}</span>
          </div>
          <div className="price">
            ${a.price}
            <small> one-time · lower quality is free</small>
          </div>
          {mine ? (
            <div className="owned">✓ You own this asset · full quality unlocked</div>
          ) : pro ? (
            <div className="owned">★ Included with your Pro plan</div>
          ) : (
            <>
              <button
                className="btn big wide"
                onClick={() =>
                  user ? setCheckout(true) : nav("/login", { state: { back: "/asset/" + a.id } })
                }
              >
                Buy now · ${a.price}
              </button>
              <p className="hint">
                {user
                  ? stage
                    ? "One-time purchase. Unlocks the full-precision GLB + commercial licence."
                    : "One-time purchase. Unlocks 4096px + commercial licence for this asset."
                  : "Log in to buy this asset."}
              </p>
            </>
          )}
          {["low", "medium", "high"].map((q, i) => (
            <button
              key={q}
              className={"q " + (i > tier ? "lock" : "")}
              onClick={() => go(q)}
            >
              <span>{i > tier ? "🔒" : "⬇"}</span>
              <b>{stage ? STAGE_Q[q][0] : q[0].toUpperCase() + q.slice(1) + " quality"}</b>
              <em>{stage ? STAGE_Q[q][1] : SIZES[q] + "px"}</em>
              <small>
                {i > tier ? (i === 1 ? "Log in" : "Buy or go Pro") : "Ready"}
              </small>
            </button>
          ))}
          <p className="msg">{msg}</p>
          {!user && (
            <p className="hint">
              <Link to="/login">Log in</Link> for medium quality, upgrade to Pro
              for high.
            </p>
          )}
          <button className="btn ghost wide" onClick={() => toggleFav(a.id)}>
            {on ? "♥ Saved to favourites" : "♡ Add to favourites"}
          </button>
          <div className="lic">
            <b>Licence</b>
            <p>
              Use in unlimited personal projects. Pro includes a commercial
              licence.
            </p>
          </div>
        </aside>
      </div>
      {checkout && (
        <Checkout
          a={a}
          onClose={(q) => {
            setCheckout(false);
            if (q) go(q);
          }}
        />
      )}
      {rel.length > 0 && (
        <>
          <h2 className="sec">More in {a.category}</h2>
          <div className="grid">
            {rel.slice(0, 4).map((x, i) => (
              <Card key={x.id} a={x} i={i} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
