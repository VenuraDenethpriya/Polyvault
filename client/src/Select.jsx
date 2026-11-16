import { useEffect, useRef, useState } from "react";

export default function Select({ value, onChange, options, placeholder = "All" }) {
  const [open, setOpen] = useState(false);
  const r = useRef();
  useEffect(() => {
    const f = (e) => !r.current.contains(e.target) && setOpen(false);
    document.addEventListener("mousedown", f);
    return () => document.removeEventListener("mousedown", f);
  }, []);
  return (
    <div className="dd" ref={r}>
      <button type="button" onClick={() => setOpen(!open)}>
        {value || placeholder}
        <i>▾</i>
      </button>
      {open && (
        <ul>
          {["", ...options].map((o) => (
            <li
              key={o}
              className={o === value ? "on" : ""}
              onClick={() => {
                onChange(o);
                setOpen(false);
              }}
            >
              {o || placeholder}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}