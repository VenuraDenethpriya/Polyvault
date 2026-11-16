import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
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
    [f, setF] = useState({}),
    [err, setErr] = useState(""),
    reg = mode === "register",
    set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const submit = async (e) => {
    e.preventDefault();
    try {
      await login(reg ? "/auth/register" : "/auth/login", f);
      nav("/");
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
        <input
          placeholder="Password"
          type="password"
          value={f.password || ""}
          onChange={set("password")}
        />
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
          <Link to={reg ? "/login" : "/register"}>
            {reg ? "Log in" : "Create account"}
          </Link>
        </p>
      </form>
    </div>
  );
}
