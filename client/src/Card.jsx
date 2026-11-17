import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "./auth.jsx";
import { meta, isImg, imgSrc, isStage, stageImg } from "./meta.js";

// the live 3D hover preview (three.js) loads on first hover, in its own chunk
const CardPreview = lazy(() => import("./CardPreview.jsx"));
const canHover = typeof matchMedia === "function" && matchMedia("(hover: hover) and (pointer: fine)").matches;

export const Thumb = ({ a }) =>
  isStage(a) ? (
    <div className="thumb img">
      <img loading="lazy" src={stageImg(a)} alt={a.title} style={{ objectPosition: "50% 56%" }} />
      <span className="st-badge">360° · LIVE 3D</span>
    </div>
  ) : isImg(a) ? (
    <div className="thumb img">
      <img loading="lazy" src={imgSrc(a)} alt={a.title} />
    </div>
  ) : (
    <div className="thumb" style={{ "--c": a.color }}>
      <i className="fl">
        <b className={"shape " + a.shape} />
      </i>
    </div>
  );

export default function Card({ a, i = 0 }) {
  const { favs, toggleFav, owned } = useAuth(),
    r = useRef(),
    m = meta(a),
    on = favs.includes(a.id),
    // live = preview canvas mounted, show = canvas faded in over the still thumbnail
    [live, setLive] = useState(false),
    [show, setShow] = useState(false),
    hov = useRef(false),
    ready = useRef(false),
    tm = useRef();
  useEffect(() => () => clearTimeout(tm.current), []);

  const mv = (e) => {
    const b = r.current.getBoundingClientRect(),
      x = (e.clientX - b.left) / b.width - 0.5,
      y = (e.clientY - b.top) / b.height - 0.5;
    r.current.style.transform = `perspective(900px) rotateY(${x * 10}deg) rotateX(${-y * 10}deg) translateY(-8px) scale(1.06)`;
  };
  const enter = () => {
    hov.current = true;
    if (!canHover) return;
    clearTimeout(tm.current);
    // a short delay so sweeping the mouse across a grid doesn't spin up a 3D view per card
    if (live) ready.current && setShow(true);
    else tm.current = setTimeout(() => setLive(true), 160);
  };
  const leave = () => {
    hov.current = false;
    r.current.style.transform = "";
    clearTimeout(tm.current);
    setShow(false);
    // keep the canvas for the fade-out, then free the WebGL context
    tm.current = setTimeout(() => {
      setLive(false);
      ready.current = false;
    }, 400);
  };
  const onReady = () => {
    ready.current = true;
    if (hov.current) setShow(true);
  };

  return (
    <div className={"card" + (show ? " is-live" : "")} style={{ animationDelay: i * 45 + "ms", "--c": a.color }}>
      <div className="tilt" ref={r} onMouseEnter={enter} onMouseMove={mv} onMouseLeave={leave}>
        <Link to={"/asset/" + a.id} className="thumb-wrap">
          <Thumb a={a} />
          {live && (
            <div className={"live3d" + (show ? " on" : "")}>
              <Suspense fallback={null}>
                <CardPreview a={a} onReady={onReady} />
              </Suspense>
            </div>
          )}
          <span className="live-chip">
            <i /> Live 3D
          </span>
          <span className="open-chip">Click to open →</span>
        </Link>
        <button className={"heart " + (on ? "on" : "")} onClick={() => toggleFav(a.id)} aria-label="Favourite">
          {on ? "♥" : "♡"}
        </button>
        <Link to={"/asset/" + a.id} className="info">
          <span className="cat">{a.category}</span>
          <h3>{a.title}</h3>
          <div className="meta">
            <span>★ {m.rating}</span>
            <span>by {m.author}</span>
            {owned.includes(a.id) ? <b className="own">✓ Owned</b> : <b>${a.price}</b>}
          </div>
        </Link>
      </div>
    </div>
  );
}
