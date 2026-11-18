import { stockSvg, stageFile, VALID } from "./stock.js";
import { ASSETS, STAGES } from "./seed.js";
import express from "express";
import cors from "cors";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import fs from "fs";
const SECRET = process.env.JWT_SECRET || "change-me",
  F = "./db.json",
  app = express();
app.use(cors(), express.json());
const A = (id, title, category, shape, color, price) => ({
  id,
  title,
  category,
  shape,
  color,
  price,
  owner: 2,
  downloads: 0,
});
let db = fs.existsSync(F)
  ? JSON.parse(fs.readFileSync(F, "utf8"))
  : {
      users: [
        ["Admin", "admin@demo.com", "admin123", "admin", "free"],
        ["Dev", "dev@demo.com", "dev123", "developer", "free"],
        ["User", "user@demo.com", "user123", "user", "free"],
        ["Paid User", "paid@demo.com", "paid123", "user", "paid"],
      ].map(([name, email, p, role, plan], i) => ({
        id: i + 1,
        name,
        email,
        role,
        plan,
        hash: bcrypt.hashSync(p, 8),
      })),
      assets: ASSETS.map((x, i) => ({
        ...A(i + 1, ...x.slice(0, 5)),
        downloads: x[5],
      })),
    };
db.purchases ||= [];
// add any stage missing from an existing db.json
for (const [title, category, shape, color, price, downloads] of STAGES)
  if (!db.assets.some((a) => a.shape === shape))
    db.assets.push({
      ...A(Math.max(0, ...db.assets.map((a) => a.id)) + 1, title, category, shape, color, price),
      downloads,
    });
const save = () => fs.writeFileSync(F, JSON.stringify(db, null, 1));
save();
const owns = (u, assetId) =>
  !!u && db.purchases.some((p) => p.user_id === u.id && p.asset_id == assetId);
const pub = ({ hash, ...u }) => u,
  tierOf = (u) =>
    !u ? "low" : u.plan === "paid" || u.role === "admin" ? "high" : "medium";
const sign = (u) => ({
  token: jwt.sign({ id: u.id }, SECRET, { expiresIn: "7d" }),
  user: pub(u),
});
app.use((req, _, next) => {
  try {
    const t = req.headers.authorization?.split(" ")[1];
    if (t) req.user = db.users.find((u) => u.id === jwt.verify(t, SECRET).id);
  } catch {}
  next();
});
const need =
  (...r) =>
  (req, res, next) =>
    !req.user
      ? res.status(401).json({ error: "Login required" })
      : r.length && !r.includes(req.user.role)
        ? res.status(403).json({ error: "Forbidden" })
        : next();
app.post("/api/auth/register", (req, res) => {
  const { name, email, password } = req.body;
  if (!name || !email || !password || password.length < 6)
    return res
      .status(400)
      .json({ error: "Name, email and 6+ char password required" });
  if (db.users.some((u) => u.email === email))
    return res.status(409).json({ error: "Email already used" });
  const u = {
    id: Date.now(),
    name,
    email,
    role: "user",
    plan: "free",
    hash: bcrypt.hashSync(password, 8),
  };
  db.users.push(u);
  save();
  res.json(sign(u));
});
app.post("/api/auth/login", (req, res) => {
  const u = db.users.find((x) => x.email === req.body.email);
  if (!u || !bcrypt.compareSync(req.body.password || "", u.hash))
    return res.status(401).json({ error: "Invalid credentials" });
  res.json(sign(u));
});
app.get("/api/me", need(), (req, res) => res.json(pub(req.user)));
app.post("/api/upgrade", need(), (req, res) => {
  req.user.plan = "paid";
  save();
  res.json(pub(req.user));
}); // mock payment
app.get("/api/assets", (req, res) => {
  const { q = "", category = "" } = req.query;
  res.json(
    db.assets.filter(
      (a) =>
        a.title.toLowerCase().includes(q.toLowerCase()) &&
        (!category || a.category === category),
    ),
  );
});
app.get("/api/assets/:id", (req, res) => {
  const a = db.assets.find((x) => x.id == req.params.id);
  a ? res.json(a) : res.status(404).json({ error: "Not found" });
});
app.post("/api/assets", need("developer", "admin"), (req, res) => {
  const { title, category, shape, color, price } = req.body;
  if (!title) return res.status(400).json({ error: "Title required" });
  if (!VALID.test(shape || "sphere"))
    return res.status(400).json({ error: "Invalid shape" });
  const a = {
    id: Date.now(),
    title,
    category,
    shape,
    color,
    price: +price || 0,
    owner: req.user.id,
    downloads: 0,
  };
  db.assets.push(a);
  save();
  res.json(a);
});
app.delete("/api/assets/:id", need("developer", "admin"), (req, res) => {
  const a = db.assets.find((x) => x.id == req.params.id);
  if (!a) return res.status(404).json({ error: "Not found" });
  if (req.user.role !== "admin" && a.owner !== req.user.id)
    return res.status(403).json({ error: "Not your asset" });
  db.assets = db.assets.filter((x) => x !== a);
  save();
  res.json({ ok: true });
});
app.get("/api/admin/users", need("admin"), (_, res) =>
  res.json(db.users.map(pub)),
);
app.patch("/api/admin/users/:id", need("admin"), (req, res) => {
  const u = db.users.find((x) => x.id == req.params.id);
  if (!u) return res.status(404).json({ error: "Not found" });
  if (["admin", "developer", "user"].includes(req.body.role))
    u.role = req.body.role;
  if (["free", "paid"].includes(req.body.plan)) u.plan = req.body.plan;
  save();
  res.json(pub(u));
});
// ---------- Purchases (demo checkout: no real charge) ----------
app.get("/api/purchases", need(), (req, res) =>
  res.json(db.purchases.filter((p) => p.user_id === req.user.id).reverse()),
);
app.post("/api/assets/:id/buy", need(), (req, res) => {
  const a = db.assets.find((x) => x.id == req.params.id);
  if (!a) return res.status(404).json({ error: "Not found" });
  const { last4 = "", brand = "card" } = req.body || {};
  if (!/^\d{4}$/.test(last4))
    return res.status(400).json({ error: "Invalid payment details" });
  if (owns(req.user, a.id))
    return res.status(409).json({ error: "You already own this asset" });
  const p = {
    id: Date.now(),
    user_id: req.user.id,
    asset_id: a.id,
    price: a.price,
    card_brand: String(brand).slice(0, 20),
    card_last4: last4,
    created_at: new Date().toISOString(),
  };
  db.purchases.push(p);
  save();
  res.json(p);
});
const RANK = { low: 0, medium: 1, high: 2 },
  SIZE = { low: 256, medium: 1024, high: 4096 };
app.get("/api/assets/:id/download", (req, res) => {
  const a = db.assets.find((x) => x.id == req.params.id),
    q = req.query.quality || "low";
  if (!a || !(q in RANK)) return res.status(400).json({ error: "Bad request" });
  const tier = owns(req.user, a.id) ? "high" : tierOf(req.user);
  if (RANK[q] > RANK[tier])
    return res.status(403).json({
      error:
        q === "medium"
          ? "Log in to download medium quality"
          : "Buy this asset or upgrade to Pro for high quality",
    });
  a.downloads++;
  save();
  const f = stageFile(a, q);
  if (f) return res.type(f.type).sendFile(f.path);
  const s = SIZE[q];
  res
    .type("image/svg+xml")
    .send(
      stockSvg(a, s) ||
        `<svg xmlns="http://www.w3.org/2000/svg" width="${s}" height="${s}" viewBox="0 0 100 100"><defs><radialGradient id="g"><stop offset="0" stop-color="#fff"/><stop offset="1" stop-color="${a.color}"/></radialGradient></defs><rect width="100" height="100" fill="#0b0b14"/><circle cx="50" cy="50" r="30" fill="url(#g)"/><text x="50" y="92" fill="#fff" font-size="5" text-anchor="middle">${a.title} · ${q} · ${s}px</text></svg>`,
    );
});
// custom-sized stage export (Pro): the GLB is built in the browser, this checks the plan + counts it
app.post("/api/assets/:id/custom", need(), (req, res) => {
  const a = db.assets.find((x) => x.id == req.params.id);
  if (!a || !/^stage:/.test(a.shape))
    return res.status(404).json({ error: "Not a stage asset" });
  if (tierOf(req.user) !== "high")
    return res.status(403).json({ error: "Custom stage sizes are a Pro feature" });
  a.downloads++;
  save();
  res.json({ ok: true });
});
app.listen(5001, () => console.log("API on :5001"));
