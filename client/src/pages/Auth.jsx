import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../auth.jsx";
import { Viewer } from "../Scene.jsx";
const DEMO = [
  ["Admin", "admin@demo.com", "admin123"],
  ["Developer", "dev@demo.com", "dev123"],
  ["User", "user@demo.com", "user123"],
  ["Pro user", "paid@demo.com", "paid123"],
];
export default function Auth({ mode }) {
  const { login } = useAuth(),
    nav = useNavigate(),
    back = useLocation().state?.back || "/",
    [f, setF] = useState({}),
    [err, setErr] = useState(""),
    [showPw, setShowPw] = useState(false),
    reg = mode === "register",
    set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const submit = async (e) => {
    e.preventDefault();
    try {
      await login(reg ? "/auth/register" : "/auth/login", f);
      nav(back);
    } catch (x) {
      setErr(x.message);
    }
  };
  return (
    <div className="authp">
      <div className="left">
        <Viewer type="knot" color="#7c5cff" />
        <div className="cap">
          <h2>
            Download the <em>future</em>
          </h2>
          <p>Join thousands of creators building with 3D.</p>
        </div>
      </div>
      <form onSubmit={submit}>
        <h1>{reg ? "Create your account" : "Welcome back"}</h1>
        {reg && (
          <input
            placeholder="Full name"
            value={f.name || ""}
            onChange={set("name")}
          />
        )}
        <input
          placeholder="Email"
          type="email"
          value={f.email || ""}
          onChange={set("email")}
        />
        <div className="pw">
          <input
            placeholder="Password"
            type={showPw ? "text" : "password"}
            value={f.password || ""}
            onChange={set("password")}
            autoComplete={reg ? "new-password" : "current-password"}
          />
          <button
            type="button"
            onClick={() => setShowPw(!showPw)}
            aria-label={showPw ? "Hide password" : "Show password"}
            title={showPw ? "Hide password" : "Show password"}
          >
            {showPw ? (
              <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
                <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
                <path d="M14.12 14.12a3 3 0 1 1-4.24-4.24" />
                <line x1="1" y1="1" x2="23" y2="23" />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                <circle cx="12" cy="12" r="3" />
              </svg>
            )}
          </button>
        </div>
        <button className="btn big">{reg ? "Sign up" : "Log in"}</button>
        <p className="msg">{err}</p>
        {!reg && (
          <div className="demo">
            <small>Try a demo account</small>
            {DEMO.map(([n, e, p]) => (
              <button
                type="button"
                key={n}
                onClick={() => setF({ email: e, password: p })}
              >
                {n}
              </button>
            ))}
          </div>
        )}
        <p>
          {reg ? "Already a member?" : "New here?"}{" "}
          <Link to={reg ? "/login" : "/register"} state={{ back }}>
            {reg ? "Log in" : "Create account"}
          </Link>
        </p>
      </form>
    </div>
  );
}
