import { useEffect, useState } from "react";
import { api } from "../api.js";
import { useAuth } from "../auth.jsx";
import { CATS } from "../meta.js";
import Select from "../Select.jsx";
export default function Dashboard() {
  const { user } = useAuth(),
    [items, setItems] = useState([]),
    [users, setUsers] = useState([]),
    [f, setF] = useState({
      category: "3D Models",
      shape: "sphere",
      color: "#7c5cff",
      price: 10,
    }),
    [err, setErr] = useState("");
  const load = () => {
    api("/assets").then(setItems);
    user.role === "admin" && api("/admin/users").then(setUsers);
  };
  useEffect(() => {
    load();
  }, []);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value }),
    mine = items.filter((a) => user.role === "admin" || a.owner === user.id),
    adm = user.role === "admin";
  const patch = (id, b) =>
    api("/admin/users/" + id, { method: "PATCH", body: b }).then(load);
  return (
    <div className="wrap page">
      <div className="head left">
        <span className="badge">{user.role} dashboard</span>
        <h1>Manage Polyvault</h1>
      </div>
      <div className="kpis">
        {[
          ["Total assets", items.length],
          ["My assets", mine.length],
          [
            "Total downloads",
            items.reduce((s, a) => s + a.downloads, 0).toLocaleString(),
          ],
          ...(adm ? [["Users", users.length]] : []),
        ].map(([l, v]) => (
          <div key={l}>
            <b>{v}</b>
            <span>{l}</span>
          </div>
        ))}
      </div>
      <h2 className="sec">Upload asset</h2>
      <div className="panel row">
        <input placeholder="Title" onChange={set("title")} />
        <Select
          className="boxed"
          showAll={false}
          value={f.category}
          onChange={(v) => setF({ ...f, category: v })}
          options={CATS.map((c) => c[0])}
        />
        <Select
          className="boxed"
          showAll={false}
          value={f.shape}
          onChange={(v) => setF({ ...f, shape: v })}
          options={[
            "sphere",
            "box",
            "torus",
            "knot",
            "cone",
            "cylinder",
            "pyramid",
            "diamond",
            "capsule",
            "helix",
          ]}
        />
        <input type="color" value={f.color} onChange={set("color")} />
        <input type="number" placeholder="Price" onChange={set("price")} />
        <button
          className="btn"
          onClick={() =>
            api("/assets", { method: "POST", body: f })
              .then(() => {
                setErr("");
                load();
              })
              .catch((e) => setErr(e.message))
          }
        >
          Publish
        </button>
      </div>
      <p className="msg">{err}</p>
      <h2 className="sec">Assets</h2>
      <table className="tbl">
        <thead>
          <tr>
            <th>Title</th>
            <th>Category</th>
            <th>Downloads</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {mine.map((a) => (
            <tr key={a.id}>
              <td data-label="Title">{a.title}</td>
              <td data-label="Category">{a.category}</td>
              <td data-label="Downloads">{a.downloads}</td>
              <td className="act">
                <button
                  onClick={() =>
                    api("/assets/" + a.id, { method: "DELETE" }).then(load)
                  }
                >
                  Delete
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {adm && (
        <>
          <h2 className="sec">Users</h2>
          <table className="tbl">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Role</th>
                <th>Plan</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id}>
                  <td data-label="Name">{u.name}</td>
                  <td data-label="Email">{u.email}</td>
                  <td data-label="Role">
                    <Select
                      className="boxed"
                      showAll={false}
                      value={u.role}
                      onChange={(v) => patch(u.id, { role: v })}
                      options={["user", "developer", "admin"]}
                    />
                  </td>
                  <td data-label="Plan">
                    <Select
                      className="boxed"
                      showAll={false}
                      value={u.plan}
                      onChange={(v) => patch(u.id, { plan: v })}
                      options={["free", "paid"]}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </div>
  );
}
