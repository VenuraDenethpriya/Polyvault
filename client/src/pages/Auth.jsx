import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../auth.jsx";
import { Viewer } from "../Scene.jsx";
import { Words } from "../fx.jsx";

const DEMO = [
  ["Admin", "admin@demo.com", "admin123", "#ff4fd8"],
  ["Developer", "dev@demo.com", "dev123", "#00d4ff"],
  ["User", "user@demo.com", "user123", "#3ddc97"],
  ["Pro user", "paid@demo.com", "paid123", "#ffb84d"],
];
// the 3D model on the left cycles through a few shapes/colours
const SHOW = [
  ["knot", "#7c5cff"],
  ["torus", "#00d4ff"],
  ["sphere", "#ff4fd8"],
  ["box", "#ffb84d"],
];
const Ic = ({ d }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    {d}
  </svg>
);
const MAIL = <Ic d={<><rect x="2" y="4" width="20" height="16" rx="3" /><path d="m3 6 9 7 9-7" /></>} />;
const LOCK = <Ic d={<><rect x="4" y="11" width="16" height="10" rx="2.5" /><path d="M8 11V7a4 4 0 0 1 8 0v4" /></>} />;
const USER = <Ic d={<><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></>} />;

// 0..4 password strength: length, mixed case, digits, symbols
const strength = (p = "") =>
  !p ? 0 : Math.min(4, (p.length >= 8) + /[a-z]/.test(p) * /[A-Z]/.test(p) + /\d/.test(p) + /[^\w]/.test(p) || 1);
const LEVEL = ["", "Weak", "Fair", "Good", "Strong"];

function Field({ icon, label, i, children }) {
  return (
    <label className="af-field" style={{ "--i": i }}>
      <span className="af-ic">{icon}</span>
      {children}
      <span className="af-lbl">{label}</span>
      <i className="af-line" />
    </label>
  );
}

export default function Auth({ mode }) {
  const { login } = useAuth(),
    nav = useNavigate(),
    back = useLocation().state?.back || "/",
    [f, setF] = useState({}),
    [err, setErr] = useState(""),
    [shake, setShake] = useState(false),
    [ready, setReady] = useState(false),
    [busy, setBusy] = useState(""), // "" | "load" | "ok"
    [showPw, setShowPw] = useState(false),
    [s, setS] = useState(0),
    reg = mode === "register",
    set = (k) => (e) => setF({ ...f, [k]: e.target.value }),
    pw = strength(f.password);

  useEffect(() => {
    const t = setInterval(() => setS((v) => (v + 1) % SHOW.length), 4500);
    return () => clearInterval(t);
  }, []);
  useEffect(() => setErr(""), [mode]);
  // let the first paint happen so the caption words animate in
  useEffect(() => {
    const r = requestAnimationFrame(() => requestAnimationFrame(() => setReady(true)));
    return () => cancelAnimationFrame(r);
  }, []);

  const submit = async (e) => {
    e.preventDefault();
    if (busy) return;
    setErr("");
    setBusy("load");
    try {
      await login(reg ? "/auth/register" : "/auth/login", f);
      setBusy("ok");
      setTimeout(() => nav(back), 650);
    } catch (x) {
      setBusy("");
      setErr(x.message);
      setShake(false);
      requestAnimationFrame(() => setShake(true));
    }
  };

  return (
    <div className="authp ax">
      <div className={"left ax-left" + (ready ? " ready" : "")} style={{ "--sc": SHOW[s][1] }}>
        <span className="ax-aur a1" />
        <span className="ax-aur a2" />
        <span className="ax-floor" />
        <span className="ax-ring r1" />
        <span className="ax-ring r2" />
        <Viewer type={SHOW[s][0]} color={SHOW[s][1]} />
        <div className="ax-chip c1">
          <i>◆</i>
          <span>
            <b>Neon Orb Pack</b>
            <small>4K · PBR · GLB</small>
          </span>
        </div>
        <div className="ax-chip c2">
          <i>⬇</i>
          <span>
            <b>2M+</b>
            <small>downloads served</small>
          </span>
        </div>
        <div className="ax-chip c3">
          <i>★</i>
          <span>
            <b>4.9 / 5</b>
            <small>from 48K creators</small>
          </span>
        </div>
        <div className={"cap ax-cap" + (ready ? " in" : "")}>
          <span className="badge x-badge">✦ Polyvault</span>
          <h2>
            <Words>
              Download the <em>future</em>
            </Words>
          </h2>
          <p>Join thousands of creators building with 3D.</p>
          <div className="ax-dots">
            {SHOW.map((_, i) => (
              <button key={i} type="button" className={i === s ? "on" : ""} onClick={() => setS(i)} aria-label={"Show model " + (i + 1)} />
            ))}
          </div>
        </div>
      </div>

      <div className="ax-right">
        <form
          onSubmit={submit}
          className={"ax-card spot" + (shake ? " shake" : "")}
          onAnimationEnd={(e) => e.target === e.currentTarget && setShake(false)}
          noValidate
        >
          <div className={"ax-tabs" + (reg ? " reg" : "")}>
            <i />
            <Link to="/login" state={{ back }} className={reg ? "" : "on"}>
              Log in
            </Link>
            <Link to="/register" state={{ back }} className={reg ? "on" : ""}>
              Sign up
            </Link>
          </div>
          <div className="ax-head" key={mode}>
            <h1>{reg ? "Create your account" : "Welcome back"}</h1>
            <p>{reg ? "Free forever. Upgrade any time for full-resolution downloads." : "Log in to download, save favourites and manage your assets."}</p>
          </div>
          <div className="ax-fields" key={"f" + mode}>
            {reg && (
              <Field icon={USER} label="Full name" i={0}>
                <input placeholder=" " value={f.name || ""} onChange={set("name")} autoComplete="name" />
              </Field>
            )}
            <Field icon={MAIL} label="Email" i={reg ? 1 : 0}>
              <input placeholder=" " type="email" value={f.email || ""} onChange={set("email")} autoComplete="email" />
            </Field>
            <Field icon={LOCK} label="Password" i={reg ? 2 : 1}>
              <input
                placeholder=" "
                type={showPw ? "text" : "password"}
                value={f.password || ""}
                onChange={set("password")}
                autoComplete={reg ? "new-password" : "current-password"}
              />
              <button
                type="button"
                className="ax-eye"
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
            </Field>
            {reg && (
              <div className={"ax-meter l" + pw} style={{ "--i": 3 }}>
                {[1, 2, 3, 4].map((k) => (
                  <i key={k} className={k <= pw ? "on" : ""} />
                ))}
                <span>{f.password ? LEVEL[pw] + " password" : "Use 8+ characters with a mix of letters, numbers & symbols"}</span>
              </div>
            )}
          </div>
          <button className={"btn big ax-submit " + busy} disabled={!!busy}>
            <span className="t">{reg ? "Create account" : "Log in"}</span>
            <span className="sp" />
            <svg className="ok" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
              <path d="m5 12.5 4.5 4.5L19 7.5" pathLength="1" />
            </svg>
          </button>
          <p className={"msg ax-err" + (err ? " on" : "")} role="alert">
            {err}
          </p>
          {!reg && (
            <div className="ax-demo">
              <div className="ax-or">
                <span>or try a demo account</span>
              </div>
              <div className="ax-demos">
                {DEMO.map(([n, e, p, c], i) => (
                  <button
                    type="button"
                    key={n}
                    style={{ "--c": c, "--i": i }}
                    className={f.email === e ? "on" : ""}
                    onClick={() => setF({ email: e, password: p })}
                  >
                    <i>{n[0]}</i>
                    {n}
                  </button>
                ))}
              </div>
            </div>
          )}
          <p className="ax-switch">
            {reg ? "Already a member?" : "New here?"}{" "}
            <Link to={reg ? "/login" : "/register"} state={{ back }}>
              {reg ? "Log in" : "Create an account"} →
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
}
