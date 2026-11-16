import { Link, useNavigate } from "react-router-dom";
import { api } from "../api.js";
import { useAuth } from "../auth.jsx";
export function Plans() {
  const { user, setUser } = useAuth(),
    nav = useNavigate();
  const pro = async () => {
    if (!user) return nav("/register");
    setUser(await api("/upgrade", { method: "POST" }));
  };
  return (
    <div className="plans">
      <div className="plan">
        <h3>Guest</h3>
        <div className="price">Free</div>
        <p>No account needed</p>
        <ul>
          <li>256px low-quality downloads</li>
          <li>Browse every asset</li>
          <li>Live 3D preview</li>
        </ul>
        <Link className="btn ghost" to="/browse">
          Start browsing
        </Link>
      </div>
      <div className="plan">
        <h3>Member</h3>
        <div className="price">Free</div>
        <p>Create a free account</p>
        <ul>
          <li>1024px medium-quality downloads</li>
          <li>Save favourites</li>
          <li>Everything in Guest</li>
        </ul>
        {user ? (
          <span className="btn ghost off">Included</span>
        ) : (
          <Link className="btn ghost" to="/register">
            Sign up free
          </Link>
        )}
      </div>
      <div className="plan hot">
        <span className="badge">Most popular</span>
        <h3>Pro</h3>
        <div className="price">
          $9.99<small>/mo</small>
        </div>
        <p>Unlimited full-resolution</p>
        <ul>
          <li>4096px high-quality downloads</li>
          <li>Commercial licence</li>
          <li>Priority new releases</li>
        </ul>
        {user?.plan === "paid" ? (
          <span className="btn off">You are Pro ★</span>
        ) : (
          <button className="btn" onClick={pro}>
            Go Pro (demo payment)
          </button>
        )}
      </div>
    </div>
  );
}
const FAQ = [
  [
    "What do I get at each quality level?",
    "Guests download 256px previews, signed-in members get 1024px, and Pro members get full 4096px files. The server enforces this on every download.",
  ],
  [
    "Is the payment real?",
    "No. This is a demo, so Go Pro simply switches your account to the paid plan.",
  ],
  [
    "Can I sell my own assets?",
    "Yes. Developer accounts can upload and manage assets from the dashboard.",
  ],
  [
    "Who manages users?",
    "Admins can change any user role or plan from the dashboard.",
  ],
];
export default function Pricing() {
  return (
    <div className="wrap page">
      <div className="head">
        <span className="badge">Pricing</span>
        <h1>
          Simple plans, <em>unlimited</em> creativity
        </h1>
        <p>Start free, upgrade when you need full-resolution files.</p>
      </div>
      <Plans />
      <h2 className="sec">Frequently asked</h2>
      <div className="faq">
        {FAQ.map(([q, a]) => (
          <details key={q}>
            <summary>{q}</summary>
            <p>{a}</p>
          </details>
        ))}
      </div>
    </div>
  );
}
