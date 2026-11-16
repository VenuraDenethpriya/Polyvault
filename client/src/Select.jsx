import { useEffect, useRef, useState } from "react";

// options: strings, or [value, label] pairs. Set showAll={false} to hide the empty "All" option.
export default function Select({
  value,
  onChange,
  options,
  placeholder = "All",
  showAll = true,
  className = "",
}) {
  const opts = [...(showAll ? [["", placeholder]] : []), ...options.map((o) =>
    Array.isArray(o) ? o : [o, o],
  )];
  const current = opts.find(([v]) => v === value);
  const [open, setOpen] = useState(false);
  const r = useRef();
  useEffect(() => {
    const f = (e) => !r.current.contains(e.target) && setOpen(false);
    document.addEventListener("mousedown", f);
    return () => document.removeEventListener("mousedown", f);
  }, []);
  return (
    <div className={"dd " + className} ref={r}>
      <button type="button" onClick={() => setOpen(!open)}>
        {current ? current[1] : placeholder}
        <i>▾</i>
      </button>
      {open && (
        <ul>
          {opts.map(([v, label]) => (
            <li
              key={v}
              className={v === value ? "on" : ""}
              onClick={() => {
                onChange(v);
                setOpen(false);
              }}
            >
              {label}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}