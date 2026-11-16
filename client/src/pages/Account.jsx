import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api.js";
import { useAuth } from "../auth.jsx";
import Card from "../Card.jsx";
export default function Account() {
  const { user, favs } = useAuth(),
    [all, setAll] = useState([]);
  useEffect(() => {
    api("/assets").then(setAll);
  }, []);
  const tier =
      user.plan === "paid" || user.role === "admin"
        ? "High · 4096px"
        : "Medium · 1024px",
    mine = all.filter((a) => favs.includes(a.id));
  return (
    <div className="wrap page">
      <div className="profile">
        <div className="avatar">{user.name[0]}</div>
        <div>
          <h1>{user.name}</h1>
          <p>{user.email}</p>
        </div>
        <div className="pills">
          <span>Role: {user.role}</span>
          <span>Plan: {user.plan}</span>
          <span>Quality: {tier}</span>
        </div>
        {user.plan !== "paid" && user.role !== "admin" && (
          <Link className="btn" to="/pricing">
            Upgrade to Pro
          </Link>
        )}
      </div>
      <h2 className="sec">Favourites ({mine.length})</h2>
      {mine.length ? (
        <div className="grid">
          {mine.map((a, i) => (
            <Card key={a.id} a={a} i={i} />
          ))}
        </div>
      ) : (
        <div className="empty">Tap the ♡ on any asset to save it here.</div>
      )}
    </div>
  );
}
