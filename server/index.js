import { stockSvg, VALID } from "./stock.js";
import { ASSETS } from "./seed.js";
import express from "express";
import cors from "cors";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { createClient } from "@supabase/supabase-js";

const {
  SUPABASE_URL,
  SUPABASE_SERVICE_KEY,
  JWT_SECRET: SECRET = "change-me",
} = process.env;
if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY)
  throw new Error(
    "Copy .env.example to .env and set SUPABASE_URL + SUPABASE_SERVICE_KEY",
  );
const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY),
  app = express();
app.use(cors({ origin: process.env.CLIENT_URL || "http://localhost:5173" }), express.json());

const ok = async (p) => {
  const { data, error } = await p;
  if (error) throw new Error(error.message);
  return data;
};
const h = (f) => (q, s, n) =>
  f(q, s, n).catch((e) => s.status(500).json({ error: e.message }));
if (!(await ok(sb.from("users").select("id").limit(1))).length)
  await ok(
    sb.from("users").insert(
      [
        ["Admin", "admin@demo.com", "admin123", "admin", "free"],
        ["Dev", "dev@demo.com", "dev123", "developer", "free"],
        ["User", "user@demo.com", "user123", "user", "free"],
        ["Paid User", "paid@demo.com", "paid123", "user", "paid"],
      ].map(([name, email, p, role, plan]) => ({
        name,
        email,
        role,
        plan,
        hash: bcrypt.hashSync(p, 8),
      })),
    ),
  );
if (!(await ok(sb.from("assets").select("id").limit(1))).length) {
  const owner = (
    await ok(sb.from("users").select("id").eq("role", "developer").limit(1))
  )[0]?.id; // seed demo assets when table is empty
  await ok(
    sb
      .from("assets")
      .insert(
        ASSETS.map(([title, category, shape, color, price, downloads]) => ({
          title,
          category,
          shape,
          color,
          price,
          downloads,
          owner,
        })),
      ),
  );
}
const pub = ({ hash, ...u }) => u,
  tierOf = (u) =>
    !u ? "low" : u.plan === "paid" || u.role === "admin" ? "high" : "medium";
const sign = (u) => ({
  token: jwt.sign({ id: u.id }, SECRET, { expiresIn: "7d" }),
  user: pub(u),
});
app.use(
  h(async (req, _, next) => {
    try {
      const t = req.headers.authorization?.split(" ")[1];
      if (t)
        req.user = await ok(
          sb
            .from("users")
            .select("*")
            .eq("id", jwt.verify(t, SECRET).id)
            .maybeSingle(),
        );
    } catch {}
    next();
  }),
);
const need =
  (...r) =>
  (req, res, next) =>
    !req.user
      ? res.status(401).json({ error: "Login required" })
      : r.length && !r.includes(req.user.role)
        ? res.status(403).json({ error: "Forbidden" })
        : next();
const one = (id) =>
  ok(sb.from("assets").select("*").eq("id", id).maybeSingle());
app.post(
  "/api/auth/register",
  h(async (req, res) => {
    const { name, email, password } = req.body;
    if (!name || !email || !password || password.length < 6)
      return res
        .status(400)
        .json({ error: "Name, email and 6+ char password required" });
    if (
      await ok(sb.from("users").select("id").eq("email", email).maybeSingle())
    )
      return res.status(409).json({ error: "Email already used" });
    res.json(
      sign(
        await ok(
          sb
            .from("users")
            .insert({ name, email, hash: bcrypt.hashSync(password, 8) })
            .select()
            .single(),
        ),
      ),
    );
  }),
);
app.post(
  "/api/auth/login",
  h(async (req, res) => {
    const u = await ok(
      sb
        .from("users")
        .select("*")
        .eq("email", req.body.email || "")
        .maybeSingle(),
    );
    if (!u || !bcrypt.compareSync(req.body.password || "", u.hash))
      return res.status(401).json({ error: "Invalid credentials" });
    res.json(sign(u));
  }),
);
app.get("/api/me", need(), (req, res) => res.json(pub(req.user)));
app.post(
  "/api/upgrade",
  need(),
  h(async (req, res) =>
    res.json(
      pub(
        await ok(
          sb
            .from("users")
            .update({ plan: "paid" })
            .eq("id", req.user.id)
            .select()
            .single(),
        ),
      ),
    ),
  ),
); // mock payment
app.get(
  "/api/assets",
  h(async (req, res) => {
    const { q = "", category = "" } = req.query;
    let s = sb.from("assets").select("*").order("id");
    if (q) s = s.ilike("title", `%${q}%`);
    if (category) s = s.eq("category", category);
    res.json(await ok(s));
  }),
);
app.get(
  "/api/assets/:id",
  h(async (req, res) => {
    const a = await one(req.params.id);
    a ? res.json(a) : res.status(404).json({ error: "Not found" });
  }),
);
app.post(
  "/api/assets",
  need("developer", "admin"),
  h(async (req, res) => {
    const { title, category, shape, color, price } = req.body;
    if (!title) return res.status(400).json({ error: "Title required" });
    if (!VALID.test(shape || "sphere"))
      return res.status(400).json({ error: "Invalid shape" });
    res.json(
      await ok(
        sb
          .from("assets")
          .insert({
            title,
            category,
            shape,
            color,
            price: +price || 0,
            owner: req.user.id,
          })
          .select()
          .single(),
      ),
    );
  }),
);
app.delete(
  "/api/assets/:id",
  need("developer", "admin"),
  h(async (req, res) => {
    const a = await one(req.params.id);
    if (!a) return res.status(404).json({ error: "Not found" });
    if (req.user.role !== "admin" && a.owner !== req.user.id)
      return res.status(403).json({ error: "Not your asset" });
    await ok(sb.from("assets").delete().eq("id", a.id));
    res.json({ ok: true });
  }),
);
app.get(
  "/api/admin/users",
  need("admin"),
  h(async (_, res) =>
    res.json((await ok(sb.from("users").select("*").order("id"))).map(pub)),
  ),
);
app.patch(
  "/api/admin/users/:id",
  need("admin"),
  h(async (req, res) => {
    const p = {};
    if (["admin", "developer", "user"].includes(req.body.role))
      p.role = req.body.role;
    if (["free", "paid"].includes(req.body.plan)) p.plan = req.body.plan;
    res.json(
      pub(
        await ok(
          sb.from("users").update(p).eq("id", req.params.id).select().single(),
        ),
      ),
    );
  }),
);
const RANK = { low: 0, medium: 1, high: 2 },
  SIZE = { low: 256, medium: 1024, high: 4096 };
app.get(
  "/api/assets/:id/download",
  h(async (req, res) => {
    const a = await one(req.params.id),
      q = req.query.quality || "low";
    if (!a || !(q in RANK))
      return res.status(400).json({ error: "Bad request" });
    if (RANK[q] > RANK[tierOf(req.user)])
      return res
        .status(403)
        .json({
          error:
            q === "medium"
              ? "Log in to download medium quality"
              : "Upgrade to a paid plan for high quality",
        });
    await ok(
      sb
        .from("assets")
        .update({ downloads: a.downloads + 1 })
        .eq("id", a.id),
    );
    const s = SIZE[q];
    res
      .type("image/svg+xml")
      .send(
        stockSvg(a, s) ||
          `<svg xmlns="http://www.w3.org/2000/svg" width="${s}" height="${s}" viewBox="0 0 100 100"><defs><radialGradient id="g"><stop offset="0" stop-color="#fff"/><stop offset="1" stop-color="${a.color}"/></radialGradient></defs><rect width="100" height="100" fill="#0b0b14"/><circle cx="50" cy="50" r="30" fill="url(#g)"/><text x="50" y="92" fill="#fff" font-size="5" text-anchor="middle">${a.title} · ${q} · ${s}px</text></svg>`,
      );
  }),
);
app.listen(5001, () => console.log("API on :5001 (Supabase)"));
