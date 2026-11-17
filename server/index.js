import { stockSvg, stageFile, VALID } from "./stock.js";
import { ASSETS, STAGES } from "./seed.js";
import express from "express";
import cors from "cors";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { createClient } from "@supabase/supabase-js";

// Environment variables
const {
  SUPABASE_URL,
  SUPABASE_SERVICE_KEY,
  JWT_SECRET: SECRET = "change-me",
} = process.env;
if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY)
  throw new Error(
    "Copy .env.example to .env and set SUPABASE_URL + SUPABASE_SERVICE_KEY",
  );

// Supabase client
const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY),
app = express();

app.use(
  cors({ origin: process.env.CLIENT_URL || "http://localhost:5173" }),
  express.json(),
);

// Helper functions
const ok = async (p) => {
  const { data, error } = await p;
  if (error) throw new Error(error.message);
  return data;
};

// Returns a public user object without the password hash
const h = (f) => (q, s, n) =>
  f(q, s, n).catch((e) => s.status(500).json({ error: e.message }));

// Seed the database with default users and assets if empty
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

// Seed demo assets when the assets table is empty
if (!(await ok(sb.from("assets").select("id").limit(1))).length) {
  const owner = (
    await ok(sb.from("users").select("id").eq("role", "developer").limit(1))
  )[0]?.id; // seed demo assets when table is empty
  await ok(
    sb.from("assets").insert(
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

// Make sure every stage exists, even in a database that was seeded before Stages existed
for (const [title, category, shape, color, price, downloads] of STAGES)
  if (!(await ok(sb.from("assets").select("id").eq("shape", shape).limit(1))).length) {
    const owner = (
      await ok(sb.from("users").select("id").eq("role", "developer").limit(1))
    )[0]?.id;
    await ok(
      sb
        .from("assets")
        .insert({ title, category, shape, color, price, downloads, owner }),
    );
  }

// Helper functions
const pub = ({ hash, ...u }) => u,
  tierOf = (u) =>
    !u ? "low" : u.plan === "paid" || u.role === "admin" ? "high" : "medium";
const sign = (u) => ({
  token: jwt.sign({ id: u.id }, SECRET, { expiresIn: "7d" }),
  user: pub(u),
});

// Middleware to authenticate users based on JWT token
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

// Middleware to enforce authentication and role-based access control
const need =
  (...r) =>
  (req, res, next) =>
    !req.user
      ? res.status(401).json({ error: "Login required" })
      : r.length && !r.includes(req.user.role)
        ? res.status(403).json({ error: "Forbidden" })
        : next();


// Helper function to fetch a single asset by ID
const one = (id) =>
  ok(sb.from("assets").select("*").eq("id", id).maybeSingle());

// API routes
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

// API route for user login
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

// API route to get the authenticated user's information
app.get("/api/me", need(), (req, res) => res.json(pub(req.user)));

// API route to upgrade the authenticated user's plan to "paid"
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

// API route to fetch assets with optional search and category filters
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

// API route to fetch a single asset by ID
app.get(
  "/api/assets/:id",
  h(async (req, res) => {
    const a = await one(req.params.id);
    a ? res.json(a) : res.status(404).json({ error: "Not found" });
  }),
);

// API route to create a new asset (requires "developer" or "admin" role)
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

// API route to delete an asset by ID (requires "developer" or "admin" role)
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

// API route to fetch all users (requires "admin" role)
app.get(
  "/api/admin/users",
  need("admin"),
  h(async (_, res) =>
    res.json((await ok(sb.from("users").select("*").order("id"))).map(pub)),
  ),
);

// API route to update a user's role or plan (requires "admin" role)
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

// ---------- Purchases (demo checkout: no real charge) ----------

// Does this user own (have bought) this asset?
const owns = async (u, assetId) => {
  if (!u) return false;
  try {
    return !!(await ok(
      sb
        .from("purchases")
        .select("id")
        .eq("user_id", u.id)
        .eq("asset_id", assetId)
        .maybeSingle(),
    ));
  } catch (e) {
    console.warn("purchases lookup failed:", e.message);
    return false;
  }
};

const noTable = (e) =>
  /purchases/.test(e.message) && /schema cache|does not exist/.test(e.message);
const SETUP_MSG =
  "Purchases are not set up yet: run the purchases SQL from server/supabase.sql in Supabase";

// API route to list the authenticated user's purchases
app.get(
  "/api/purchases",
  need(),
  h(async (req, res) =>
    res.json(
      await ok(
        sb
          .from("purchases")
          .select("*")
          .eq("user_id", req.user.id)
          .order("created_at", { ascending: false }),
      ),
    ),
  ),
);

// API route to buy a single asset. The price always comes from the database,
// never from the client. Only the card brand + last 4 digits are sent/stored.
app.post(
  "/api/assets/:id/buy",
  need(),
  h(async (req, res) => {
    const a = await one(req.params.id);
    if (!a) return res.status(404).json({ error: "Not found" });
    const { last4 = "", brand = "card" } = req.body || {};
    if (!/^\d{4}$/.test(last4))
      return res.status(400).json({ error: "Invalid payment details" });
    if (await owns(req.user, a.id))
      return res.status(409).json({ error: "You already own this asset" });
    try {
      res.json(
        await ok(
          sb
            .from("purchases")
            .insert({
              user_id: req.user.id,
              asset_id: a.id,
              price: a.price,
              card_brand: String(brand).slice(0, 20),
              card_last4: last4,
            })
            .select()
            .single(),
        ),
      );
    } catch (e) {
      if (noTable(e)) return res.status(503).json({ error: SETUP_MSG });
      throw e;
    }
  }),
);

// Quality and size mappings for asset downloads
const RANK = { low: 0, medium: 1, high: 2 },
  SIZE = { low: 256, medium: 1024, high: 4096 };

// API route to download an asset in a specified quality
app.get(
  "/api/assets/:id/download",
  h(async (req, res) => {
    const a = await one(req.params.id),
      q = req.query.quality || "low";
    if (!a || !(q in RANK))
      return res.status(400).json({ error: "Bad request" });
    // buying an asset unlocks full quality for that asset
    const tier = (await owns(req.user, a.id)) ? "high" : tierOf(req.user);
    if (RANK[q] > RANK[tier])
      return res.status(403).json({
        error:
          q === "medium"
            ? "Log in to download medium quality"
            : "Buy this asset or upgrade to Pro for high quality",
      });
    await ok(
      sb
        .from("assets")
        .update({ downloads: a.downloads + 1 })
        .eq("id", a.id),
    );
    const f = stageFile(a, q);
    if (f) return res.type(f.type).sendFile(f.path);
    const s = SIZE[q];
    res
      .type("image/svg+xml")
      .send(
        stockSvg(a, s) ||
          `<svg xmlns="http://www.w3.org/2000/svg" width="${s}" height="${s}" viewBox="0 0 100 100"><defs><radialGradient id="g"><stop offset="0" stop-color="#fff"/><stop offset="1" stop-color="${a.color}"/></radialGradient></defs><rect width="100" height="100" fill="#0b0b14"/><circle cx="50" cy="50" r="30" fill="url(#g)"/><text x="50" y="92" fill="#fff" font-size="5" text-anchor="middle">${a.title} · ${q} · ${s}px</text></svg>`,
      );
  }),
);

// Start the server and listen on port 5001
app.listen(5001, () => console.log("API on :5001 (Supabase)"));
