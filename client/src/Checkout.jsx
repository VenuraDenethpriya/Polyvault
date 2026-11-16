import { useEffect, useState } from "react";
import { useAuth } from "./auth.jsx";
import { Thumb } from "./Card.jsx";

// Demo checkout: validates the card form in the browser, then records the
// purchase on the server. Nothing is charged and the full card number never
// leaves the browser (only brand + last 4 digits are sent).

const digits = (s) => s.replace(/\D/g, "");
const brandOf = (n) =>
  /^4/.test(n)
    ? "Visa"
    : /^(5[1-5]|2[2-7])/.test(n)
      ? "Mastercard"
      : /^3[47]/.test(n)
        ? "Amex"
        : "Card";
const luhn = (n) => {
  let sum = 0;
  for (let i = 0; i < n.length; i++) {
    let d = +n[n.length - 1 - i];
    if (i % 2) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
  }
  return n.length >= 13 && sum % 10 === 0;
};
const fmtCard = (v) =>
  digits(v)
    .slice(0, 19)
    .replace(/(\d{4})(?=\d)/g, "$1 ");
const fmtExp = (v) => {
  const d = digits(v).slice(0, 4);
  return d.length > 2 ? d.slice(0, 2) + " / " + d.slice(2) : d;
};

export default function Checkout({ a, onClose, onDone }) {
  const { user, buy } = useAuth(),
    [f, setF] = useState({ name: user?.name || "", num: "", exp: "", cvc: "" }),
    [err, setErr] = useState(""),
    [busy, setBusy] = useState(false),
    [done, setDone] = useState(null);

  useEffect(() => {
    const k = (e) => e.key === "Escape" && !busy && onClose();
    document.addEventListener("keydown", k);
    document.body.classList.add("menu-open"); // reuse scroll lock
    return () => {
      document.removeEventListener("keydown", k);
      document.body.classList.remove("menu-open");
    };
  }, [busy, onClose]);

  const num = digits(f.num),
    brand = brandOf(num),
    price = Number(a.price || 0).toFixed(2);

  const validate = () => {
    if (!f.name.trim()) return "Enter the name on the card";
    if (!luhn(num)) return "Card number is not valid";
    const [mm, yy] = [+digits(f.exp).slice(0, 2), +digits(f.exp).slice(2)];
    if (!mm || mm > 12 || digits(f.exp).length !== 4)
      return "Expiry must be MM / YY";
    const now = new Date(),
      cy = now.getFullYear() % 100,
      cm = now.getMonth() + 1;
    if (yy < cy || (yy === cy && mm < cm)) return "This card has expired";
    if (!/^\d{3,4}$/.test(f.cvc)) return "CVC must be 3 or 4 digits";
    return "";
  };

  const pay = async (e) => {
    e.preventDefault();
    const v = validate();
    if (v) return setErr(v);
    setErr("");
    setBusy(true);
    try {
      await new Promise((r) => setTimeout(r, 900)); // feel of a real payment
      const p = await buy(a.id, { brand, last4: num.slice(-4) });
      setDone(p);
      onDone?.(p);
    } catch (x) {
      setErr(x.message);
    } finally {
      setBusy(false);
    }
  };

  const set = (k, fmt = (v) => v) => (e) =>
    setF({ ...f, [k]: fmt(e.target.value) });

  return (
    <div className="modal" onMouseDown={(e) => e.target === e.currentTarget && !busy && onClose()}>
      <div className="sheet" role="dialog" aria-modal="true" aria-label="Checkout">
        <button className="x" onClick={onClose} disabled={busy} aria-label="Close">
          ✕
        </button>
        {done ? (
          <div className="paid">
            <div className="tick">✓</div>
            <h2>Payment successful</h2>
            <p>
              You now own <b>{a.title}</b>. High quality (4096px) downloads and
              the commercial licence are unlocked for this asset.
            </p>
            <p className="hint">
              Paid ${price} with {done.card_brand} •••• {done.card_last4}
            </p>
            <button className="btn big wide" onClick={() => onClose("high")}>
              ⬇ Download high quality
            </button>
            <button className="btn ghost wide" onClick={() => onClose()}>
              Done
            </button>
          </div>
        ) : (
          <form onSubmit={pay}>
            <h2>Checkout</h2>
            <div className="sum">
              <div className="mini">
                <Thumb a={a} />
              </div>
              <div>
                <span className="cat">{a.category}</span>
                <b>{a.title}</b>
                <small>High quality · 4096px · commercial licence</small>
              </div>
              <strong>${price}</strong>
            </div>

            <label>
              Name on card
              <input value={f.name} onChange={set("name")} autoComplete="cc-name" />
            </label>
            <label>
              Card number
              <div className="cardnum">
                <input
                  inputMode="numeric"
                  placeholder="1234 1234 1234 1234"
                  value={f.num}
                  onChange={set("num", fmtCard)}
                  autoComplete="cc-number"
                />
                {num && <span>{brand}</span>}
              </div>
            </label>
            <div className="two">
              <label>
                Expiry
                <input
                  inputMode="numeric"
                  placeholder="MM / YY"
                  value={f.exp}
                  onChange={set("exp", fmtExp)}
                  autoComplete="cc-exp"
                />
              </label>
              <label>
                CVC
                <input
                  inputMode="numeric"
                  placeholder="123"
                  value={f.cvc}
                  onChange={set("cvc", (v) => digits(v).slice(0, 4))}
                  autoComplete="cc-csc"
                />
              </label>
            </div>

            <p className="msg">{err}</p>
            <button className={"btn big wide" + (busy ? " off" : "")} disabled={busy}>
              {busy ? "Processing…" : `Pay $${price}`}
            </button>
            <p className="hint demo-note">
              🔒 Demo checkout. No real charge. Use test card{" "}
              <button
                type="button"
                onClick={() =>
                  setF({ ...f, num: "4242 4242 4242 4242", exp: "12 / 34", cvc: "123" })
                }
              >
                4242 4242 4242 4242
              </button>
              , any future date and any CVC.
            </p>
          </form>
        )}
      </div>
    </div>
  );
}
