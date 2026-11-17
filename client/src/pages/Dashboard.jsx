import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api.js";
import { useAuth } from "../auth.jsx";
import { CATS } from "../meta.js";
import { Thumb } from "../Card.jsx";
import Select from "../Select.jsx";

const SHAPES = ["sphere", "box", "torus", "knot", "cone", "cylinder", "pyramid", "diamond", "capsule", "helix"];
const SWATCH = ["#7c5cff", "#00d4ff", "#ff4fd8", "#ffb84d", "#3ddc97", "#ff7e5f"];
const CAT_C = Object.fromEntries(CATS.map((c) => [c[0], c[3]]));
const PER = 10;
const ROLE_C = { admin: "#ff4fd8", developer: "#00d4ff", user: "#3ddc97" };

const Ic = ({ d }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    {d}
  </svg>
);
const ICO = {
  box: <Ic d={<><path d="M12 2 3 7v10l9 5 9-5V7z" /><path d="m3 7 9 5 9-5M12 12v10" /></>} />,
  mine: <Ic d={<><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></>} />,
  down: <Ic d={<><path d="M12 3v13M6 11l6 6 6-6M4 21h16" /></>} />,
  users: <Ic d={<><circle cx="9" cy="8" r="4" /><path d="M2 21a7 7 0 0 1 14 0M16 3.5a4 4 0 0 1 0 9M22 21a7 7 0 0 0-4-6.3" /></>} />,
  up: <Ic d={<><path d="M12 21V8M6 13l6-6 6 6M4 3h16" /></>} />,
  search: <Ic d={<><circle cx="11" cy="11" r="7" /><path d="m20 20-4-4" /></>} />,
  trash: <Ic d={<><path d="M3 6h18M8 6V4h8v2M6 6l1 15h10l1-15" /></>} />,
  eye: <Ic d={<><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8S1 12 1 12z" /><circle cx="12" cy="12" r="3" /></>} />,
};

// animated number
function Num({ v }) {
  const r = useRef(),
    last = useRef(0);
  useEffect(() => {
    const from = last.current,
      t0 = performance.now(),
      d = 1100;
    let raf;
    const step = (t) => {
      const k = Math.min(1, (t - t0) / d),
        e = 1 - Math.pow(1 - k, 3);
      if (r.current) r.current.textContent = Math.round(from + (v - from) * e).toLocaleString();
      if (k < 1) raf = requestAnimationFrame(step);
      else last.current = v;
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [v]);
  return <b ref={r}>0</b>;
}

const hello = () => {
  const h = new Date().getHours();
  return h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
};

export default function Dashboard() {
  const { user } = useAuth(),
    [items, setItems] = useState([]),
    [users, setUsers] = useState([]),
    [f, setF] = useState({ title: "", category: "3D Models", shape: "sphere", color: "#7c5cff", price: 10 }),
    [busy, setBusy] = useState(false),
    [toast, setToast] = useState(null),
    [q, setQ] = useState(""),
    [pg, setPg] = useState(0),
    [uq, setUq] = useState(""),
    [arm, setArm] = useState(null), // asset id waiting for delete confirmation
    [gone, setGone] = useState([]), // rows animating out
    form = useRef(),
    adm = user.role === "admin";

  const load = () => {
    api("/assets").then(setItems);
    adm && api("/admin/users").then(setUsers);
  };
  useEffect(load, []);
  const note = (msg, bad) => {
    setToast({ msg, bad, k: Date.now() });
  };
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3200);
    return () => clearTimeout(t);
  }, [toast]);
  useEffect(() => {
    if (arm == null) return;
    const t = setTimeout(() => setArm(null), 3000);
    return () => clearTimeout(t);
  }, [arm]);

  const set = (k) => (e) => setF({ ...f, [k]: e.target.value }),
    mine = items.filter((a) => adm || a.owner === user.id),
    total = items.reduce((s, a) => s + (a.downloads || 0), 0),
    myDl = mine.reduce((s, a) => s + (a.downloads || 0), 0),
    maxDl = Math.max(1, ...mine.map((a) => a.downloads || 0)),
    cats = CATS.map(([n, , , c]) => [n, c, mine.filter((a) => a.category === n).length]).filter((x) => x[2] > 0),
    maxCat = Math.max(1, ...cats.map((c) => c[2])),
    top = [...mine].sort((a, b) => b.downloads - a.downloads).slice(0, 5),
    shown = mine.filter((a) => (a.title + " " + a.category).toLowerCase().includes(q.toLowerCase())),
    pages = Math.max(1, Math.ceil(shown.length / PER)),
    page = Math.min(pg, pages - 1),
    rows = shown.slice(page * PER, page * PER + PER),
    shownU = users.filter((u) => (u.name + " " + u.email).toLowerCase().includes(uq.toLowerCase())),
    roleN = (r) => users.filter((u) => u.role === r).length;

  const publish = async (e) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    try {
      await api("/assets", { method: "POST", body: f });
      note(`“${f.title}” published`);
      setF({ ...f, title: "" });
      load();
    } catch (x) {
      note(x.message, true);
    } finally {
      setBusy(false);
    }
  };
  const del = async (a) => {
    if (arm !== a.id) return setArm(a.id);
    setArm(null);
    setGone((g) => [...g, a.id]);
    try {
      await api("/assets/" + a.id, { method: "DELETE" });
      note(`“${a.title}” deleted`);
      setTimeout(load, 350);
    } catch (x) {
      setGone((g) => g.filter((id) => id !== a.id));
      note(x.message, true);
    }
  };
  const patch = (u, b) =>
    api("/admin/users/" + u.id, { method: "PATCH", body: b })
      .then(() => {
        note(`${u.name} updated`);
        load();
      })
      .catch((x) => note(x.message, true));

  const kpis = [
    ["Total assets", items.length, ICO.box, "#7c5cff"],
    [adm ? "Assets managed" : "My assets", mine.length, ICO.mine, "#00d4ff"],
    [adm ? "Total downloads" : "My downloads", adm ? total : myDl, ICO.down, "#ff4fd8"],
    ...(adm ? [["Users", users.length, ICO.users, "#3ddc97"]] : [["Marketplace downloads", total, ICO.eye, "#3ddc97"]]),
  ];

  return (
    <div className="wrap page db">
      {/* welcome */}
      <header className="db-hero">
        <span className="db-aur a1" />
        <span className="db-aur a2" />
        <div>
          <span className="db-role" style={{ "--c": ROLE_C[user.role] }}>
            <i /> {user.role} dashboard
          </span>
          <h1>
            {hello()}, <em>{(user.name || "there").split(" ")[0]}</em>
          </h1>
          <p>
            {new Date().toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" })} · Here’s what’s
            happening on Polyvault.
          </p>
        </div>
        <div className="db-quick">
          <button className="btn" onClick={() => form.current?.scrollIntoView({ behavior: "smooth", block: "center" })}>
            <span className="ic">{ICO.up}</span> Upload asset
          </button>
          <Link className="btn ghost" to="/browse">
            View marketplace →
          </Link>
        </div>
      </header>

      {/* KPIs */}
      <div className="db-kpis">
        {kpis.map(([l, v, ic, c], i) => (
          <div key={l} className="db-kpi spot" style={{ "--c": c, "--i": i }}>
            <span className="db-ki">{ic}</span>
            <Num v={v} />
            <span className="db-kl">{l}</span>
            <span className="db-kbar">
              <i />
            </span>
          </div>
        ))}
      </div>

      <div className="db-split">
        {/* upload */}
        <form className="db-card db-up spot" ref={form} onSubmit={publish} style={{ "--c": f.color, "--i": 4 }}>
          <div className="db-ch">
            <h2>Upload asset</h2>
            <span>Live preview</span>
          </div>
          <div className="db-upgrid">
            <div className="db-prev">
              <span className="db-pring" />
              <span className="db-pring b" />
              <div className="thumb">
                <i className="fl">
                  <b className={"shape " + f.shape} />
                </i>
              </div>
              <div className="db-pmeta">
                <b>{f.title || "Untitled asset"}</b>
                <span>
                  {f.category} · ${+f.price || 0}
                </span>
              </div>
            </div>
            <div className="db-fields">
              <label className="db-f">
                <span>Title</span>
                <input placeholder="e.g. Neon Orb" value={f.title} onChange={set("title")} />
              </label>
              <div className="db-f2">
                <div className="db-f">
                  <span>Category</span>
                  <Select className="boxed" showAll={false} value={f.category} onChange={(v) => setF({ ...f, category: v })} options={CATS.map((c) => c[0])} />
                </div>
                <label className="db-f">
                  <span>Price ($)</span>
                  <input type="number" min="0" value={f.price} onChange={set("price")} />
                </label>
              </div>
              <div className="db-f">
                <span>Shape</span>
                <div className="db-shapes">
                  {SHAPES.map((s) => (
                    <button type="button" key={s} className={f.shape === s ? "on" : ""} onClick={() => setF({ ...f, shape: s })} title={s}>
                      {s}
                    </button>
                  ))}
                </div>
              </div>
              <div className="db-f">
                <span>Colour</span>
                <div className="db-sw">
                  {SWATCH.map((c) => (
                    <button type="button" key={c} style={{ "--s": c }} className={f.color === c ? "on" : ""} onClick={() => setF({ ...f, color: c })} aria-label={c} />
                  ))}
                  <label className="db-pick" title="Custom colour">
                    <input type="color" value={f.color} onChange={set("color")} />
                    <i>+</i>
                  </label>
                </div>
              </div>
              <button className={"btn db-pub" + (busy ? " load" : "")} disabled={busy || !f.title.trim()}>
                <span className="t">Publish asset</span>
                <span className="sp" />
              </button>
            </div>
          </div>
        </form>

        {/* insights */}
        <div className="db-side">
          <div className="db-card db-cat spot" style={{ "--i": 5 }}>
            <div className="db-ch">
              <h2>By category</h2>
              <span>{mine.length} assets</span>
            </div>
            <ul className="db-bars">
              {cats.map(([n, c, k], i) => (
                <li key={n} style={{ "--c": c, "--w": k / maxCat, "--i": i }}>
                  <span>{n}</span>
                  <b>{k}</b>
                  <i />
                </li>
              ))}
              {!cats.length && <li className="db-empty">No assets yet</li>}
            </ul>
          </div>
          <div className="db-card db-topc spot" style={{ "--i": 6 }}>
            <div className="db-ch">
              <h2>Top downloads</h2>
              <span>All time</span>
            </div>
            <ol className="db-top">
              {top.map((a, i) => (
                <li key={a.id} style={{ "--i": i }}>
                  <em>{i + 1}</em>
                  <Link to={"/asset/" + a.id}>{a.title}</Link>
                  <span>{(a.downloads || 0).toLocaleString()}</span>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </div>

      {/* assets table */}
      <section className="db-card db-tcard" style={{ "--i": 7 }}>
        <div className="db-ch">
          <h2>
            Assets <small>{shown.length}</small>
          </h2>
          <label className="db-search">
            {ICO.search}
            <input placeholder="Search assets…" value={q} onChange={(e) => {
                setQ(e.target.value);
                setPg(0);
              }} />
          </label>
        </div>
        <table className="tbl db-tbl" key={"p" + page + q}>
          <thead>
            <tr>
              <th>Asset</th>
              <th>Category</th>
              <th>Price</th>
              <th>Downloads</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {rows.map((a, i) => (
              <tr key={a.id} className={gone.includes(a.id) ? "out" : ""} style={{ "--i": Math.min(i, 12) }}>
                <td data-label="Asset">
                  <Link to={"/asset/" + a.id} className="db-asset">
                    <span className="db-mini">
                      <Thumb a={a} />
                    </span>
                    <b>{a.title}</b>
                  </Link>
                </td>
                <td data-label="Category">
                  <span className="db-chip" style={{ "--c": CAT_C[a.category] || "#7c5cff" }}>
                    {a.category}
                  </span>
                </td>
                <td data-label="Price">${a.price}</td>
                <td data-label="Downloads">
                  <span className="db-dl" style={{ "--w": (a.downloads || 0) / maxDl }}>
                    <i />
                    {(a.downloads || 0).toLocaleString()}
                  </span>
                </td>
                <td className="act">
                  <button className={"db-del" + (arm === a.id ? " arm" : "")} onClick={() => del(a)}>
                    {ICO.trash}
                    <span>{arm === a.id ? "Confirm?" : "Delete"}</span>
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!shown.length && <p className="db-empty">No assets match “{q}”.</p>}
        {pages > 1 && (
          <div className="db-pager">
            <span>
              {page * PER + 1}–{Math.min(shown.length, page * PER + PER)} of {shown.length}
            </span>
            <div>
              <button onClick={() => setPg(page - 1)} disabled={!page} aria-label="Previous page">
                ←
              </button>
              {Array.from({ length: pages }, (_, k) => (
                <button key={k} className={k === page ? "on" : ""} onClick={() => setPg(k)}>
                  {k + 1}
                </button>
              ))}
              <button onClick={() => setPg(page + 1)} disabled={page >= pages - 1} aria-label="Next page">
                →
              </button>
            </div>
          </div>
        )}
      </section>

      {adm && (
        <section className="db-card db-tcard" style={{ "--i": 8 }}>
          <div className="db-ch">
            <h2>
              Users <small>{shownU.length}</small>
            </h2>
            <div className="db-rolesum">
              {["admin", "developer", "user"].map((r) => (
                <span key={r} style={{ "--c": ROLE_C[r] }}>
                  <i /> {roleN(r)} {r}
                  {roleN(r) === 1 ? "" : "s"}
                </span>
              ))}
            </div>
            <label className="db-search">
              {ICO.search}
              <input placeholder="Search users…" value={uq} onChange={(e) => setUq(e.target.value)} />
            </label>
          </div>
          <table className="tbl db-tbl">
            <thead>
              <tr>
                <th>User</th>
                <th>Role</th>
                <th>Plan</th>
              </tr>
            </thead>
            <tbody>
              {shownU.map((u, i) => (
                <tr key={u.id} style={{ "--i": Math.min(i, 12) }}>
                  <td data-label="User">
                    <span className="db-user">
                      <i style={{ "--c": ROLE_C[u.role] }}>
                        {(u.name || "?")
                          .split(" ")
                          .map((s) => s[0])
                          .join("")
                          .slice(0, 2)}
                      </i>
                      <span>
                        <b>{u.name}</b>
                        <small>{u.email}</small>
                      </span>
                    </span>
                  </td>
                  <td data-label="Role">
                    <span className="db-sel" style={{ "--c": ROLE_C[u.role] }}>
                      <Select className="boxed" showAll={false} value={u.role} onChange={(v) => patch(u, { role: v })} options={["user", "developer", "admin"]} />
                    </span>
                  </td>
                  <td data-label="Plan">
                    <span className={"db-sel" + (u.plan === "paid" ? " pro" : "")} style={{ "--c": u.plan === "paid" ? "#ffb84d" : "#9a9ab5" }}>
                      <Select className="boxed" showAll={false} value={u.plan} onChange={(v) => patch(u, { plan: v })} options={["free", "paid"]} />
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {toast && (
        <div className={"db-toast" + (toast.bad ? " bad" : "")} key={toast.k} role="status">
          <i>{toast.bad ? "!" : "✓"}</i>
          {toast.msg}
        </div>
      )}
    </div>
  );
}
