import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { api } from "../api.js";
import Card from "../Card.jsx";
import Select from "../Select.jsx";
import { CATS } from "../meta.js";
export default function Browse() {
  const [sp, setSp] = useSearchParams(),
    [all, setAll] = useState([]),
    [sort, setSort] = useState("popular"),
    [max, setMax] = useState(60),
    [kind, setKind] = useState(""),
    q = sp.get("q") || "",
    cat = sp.get("category") || "";
  useEffect(() => {
    api(
      `/assets?q=${encodeURIComponent(q)}&category=${encodeURIComponent(cat)}`,
    ).then(setAll);
  }, [q, cat]);
  const set = (k, v) => {
    const n = new URLSearchParams(sp);
    v ? n.set(k, v) : n.delete(k);
    setSp(n);
  };
  const items = all
    .filter(
      (a) =>
        a.price <= max &&
        (!kind || (kind === "img") === a.shape.startsWith("img:")),
    )
    .sort((a, b) =>
      sort === "popular"
        ? b.downloads - a.downloads
        : sort === "low"
          ? a.price - b.price
          : sort === "high"
            ? b.price - a.price
            : b.id - a.id,
    );
  return (
    <div className="wrap page browse">
      <aside>
        <h4>Categories</h4>
        <button
          className={!cat ? "on" : ""}
          onClick={() => set("category", "")}
        >
          All assets
        </button>
        {CATS.map((c) => (
          <button
            key={c[0]}
            className={cat === c[0] ? "on" : ""}
            onClick={() => set("category", c[0])}
          >
            {c[0]}
          </button>
        ))}
        <h4>Type</h4>
        {[
          ["", "All types"],
          ["3d", "3D models"],
          ["img", "Images"],
        ].map(([k, l]) => (
          <button
            key={k}
            className={kind === k ? "on" : ""}
            onClick={() => setKind(k)}
          >
            {l}
          </button>
        ))}
        <h4>Max price: ${max}</h4>
        <input
          type="range"
          min="5"
          max="60"
          value={max}
          onChange={(e) => setMax(+e.target.value)}
        />
      </aside>
      <section>
        <div className="bar">
          <input
            placeholder="Search assets…"
            defaultValue={q}
            onKeyDown={(e) => e.key === "Enter" && set("q", e.target.value)}
          />
          <Select
            className="boxed"
            value={sort}
            onChange={setSort}
            showAll={false}
            options={[
              ["popular", "Most popular"],
              ["new", "Newest"],
              ["low", "Price: low to high"],
              ["high", "Price: high to low"],
            ]}
          />
        </div>
        <p>
          {items.length} results{cat && ` in ${cat}`}
          {q && ` for "${q}"`}
        </p>
        {items.length ? (
          <div className="grid">
            {items.map((a, i) => (
              <Card key={a.id} a={a} i={i} />
            ))}
          </div>
        ) : (
          <div className="empty">No assets match your filters.</div>
        )}
      </section>
    </div>
  );
}
