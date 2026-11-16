import { useRef } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "./auth.jsx";
import { meta } from "./meta.js";
export const Thumb = ({ a }) => (
  <div className="thumb" style={{ "--c": a.color }}>
    <i className="fl">
      <b className={"shape " + a.shape} />
    </i>
  </div>
);
export default function Card({ a, i = 0 }) {
  const { favs, toggleFav } = useAuth(),
    r = useRef(),
    m = meta(a),
    on = favs.includes(a.id);
  const mv = (e) => {
    const b = r.current.getBoundingClientRect(),
      x = (e.clientX - b.left) / b.width - 0.5,
      y = (e.clientY - b.top) / b.height - 0.5;
    r.current.style.transform = `perspective(900px) rotateY(${x * 12}deg) rotateX(${-y * 12}deg) translateY(-6px)`;
  };
  return (
    <div className="card" style={{ animationDelay: i * 45 + "ms" }}>
      <div
        className="tilt"
        ref={r}
        onMouseMove={mv}
        onMouseLeave={() => {
          r.current.style.transform = "";
        }}
      >
        <Link to={"/asset/" + a.id}>
          <Thumb a={a} />
        </Link>
        <button
          className={"heart " + (on ? "on" : "")}
          onClick={() => toggleFav(a.id)}
          aria-label="Favourite"
        >
          {on ? "♥" : "♡"}
        </button>
        <Link to={"/asset/" + a.id} className="info">
          <span className="cat">{a.category}</span>
          <h3>{a.title}</h3>
          <div className="meta">
            <span>★ {m.rating}</span>
            <span>by {m.author}</span>
            <b>${a.price}</b>
          </div>
        </Link>
      </div>
    </div>
  );
}
