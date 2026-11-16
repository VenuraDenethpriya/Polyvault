import { useEffect, useState } from "react";
import { Link, Route, Routes, useLocation } from "react-router-dom";
import { Provider, useAuth, Guard } from "./auth.jsx";
import { CATS } from "./meta.js";
import Home from "./pages/Home.jsx";
import Browse from "./pages/Browse.jsx";
import Asset from "./pages/Asset.jsx";
import Pricing from "./pages/Pricing.jsx";
import Auth from "./pages/Auth.jsx";
import Account from "./pages/Account.jsx";
import Dashboard from "./pages/Dashboard.jsx";
import Cursor from "./Cursor.jsx";
import ScrollRail from "./ScrollRail.jsx";

function Nav() {
  const { user, logout, favs } = useAuth(),
    [s, setS] = useState(false),
    [open, setOpen] = useState(false),
    { pathname, search } = useLocation();
  useEffect(() => {
    const f = () => setS(window.scrollY > 20);
    f();
    window.addEventListener("scroll", f);
    return () => window.removeEventListener("scroll", f);
  }, []);
  // close the mobile menu whenever the route changes
  useEffect(() => setOpen(false), [pathname, search]);
  useEffect(() => {
    document.body.classList.toggle("menu-open", open);
  }, [open]);
  const staff = user && ["admin", "developer"].includes(user.role);
  return (
    <nav className={(s ? "s" : "") + (open ? " open" : "")}>
      <div className="mnav">
        <Link to="/browse">Browse all</Link>
        {CATS.map((c) => (
          <Link key={c[0]} to={"/browse?category=" + encodeURIComponent(c[0])}>
            {c[0]}
          </Link>
        ))}
        <Link to="/pricing">Pricing</Link>
        <hr />
        {user ? (
          <>
            <Link to="/account">My account · ♥ {favs.length}</Link>
            {staff && <Link to="/dashboard">Dashboard</Link>}
            <span className="tag">
              {user.role}
              {user.plan === "paid" ? " · pro" : ""}
            </span>
            <button className="btn ghost wide" onClick={logout}>
              Logout
            </button>
          </>
        ) : (
          <>
            <Link to="/login" className="btn ghost wide">
              Log in
            </Link>
            <Link to="/register" className="btn wide">
              Sign up free
            </Link>
          </>
        )}
      </div>
      <div className="wrap in">
        <Link className="logo" to="/">
          <i />
          Polyvault
        </Link>
        <div className="links">
          <Link to="/browse">Browse</Link>
          {CATS.slice(0, 4).map((c) => (
            <Link
              key={c[0]}
              to={"/browse?category=" + encodeURIComponent(c[0])}
            >
              {c[0]}
            </Link>
          ))}
          <Link to="/pricing">Pricing</Link>
        </div>
        <div className="sp" />
        {user ? (
          <>
            <Link to="/account" className="fav">
              ♥ {favs.length}
            </Link>
            {staff && (
              <Link to="/dashboard" className="links">
                Dashboard
              </Link>
            )}
            <Link to="/account" className="avatar sm">
              {user.name[0]}
            </Link>
            <span className="tag dsk">
              {user.role}
              {user.plan === "paid" ? " · pro" : ""}
            </span>
            <button className="ghost dsk" onClick={logout}>
              Logout
            </button>
          </>
        ) : (
          <>
            <Link to="/login" className="links">
              Log in
            </Link>
            <Link to="/register" className="btn dsk">
              Sign up free
            </Link>
          </>
        )}
        <button
          className={"burger" + (open ? " on" : "")}
          aria-label="Menu"
          aria-expanded={open}
          onClick={() => setOpen(!open)}
        >
          <span />
          <span />
          <span />
        </button>
      </div>
    </nav>
  );
}
const Footer = () => (
  <footer>
    <div className="wrap cols">
      <div>
        <Link className="logo" to="/">
          <i />
          Polyvault
        </Link>
        <p>The 3D asset marketplace for modern creators.</p>
      </div>
      <div>
        <h4>Explore</h4>
        {CATS.map((c) => (
          <Link key={c[0]} to={"/browse?category=" + encodeURIComponent(c[0])}>
            {c[0]}
          </Link>
        ))}
      </div>
      <div>
        <h4>Company</h4>
        <Link to="/pricing">Pricing</Link>
        <Link to="/register">Become a creator</Link>
        <Link to="/login">Log in</Link>
      </div>
      <div>
        <h4>Built with</h4>
        <span>React · Three.js · GSAP</span>
        <span>Node · Express</span>
        <span>Supabase</span>
      </div>
    </div>
    <div className="wrap copy">© 2026 Polyvault. Demo project.</div>
  </footer>
);
function Top() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
}
export default () => (
  <Provider>
    <Cursor/>
    <ScrollRail/>
    <Top />
    <Nav />
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/browse" element={<Browse />} />
      <Route path="/asset/:id" element={<Asset />} />
      <Route path="/pricing" element={<Pricing />} />
      <Route path="/login" element={<Auth />} />
      <Route path="/register" element={<Auth mode="register" />} />
      <Route
        path="/account"
        element={
          <Guard>
            <Account />
          </Guard>
        }
      />
      <Route
        path="/dashboard"
        element={
          <Guard roles={["admin", "developer"]}>
            <Dashboard />
          </Guard>
        }
      />
    </Routes>
    <Footer />
  </Provider>
);
