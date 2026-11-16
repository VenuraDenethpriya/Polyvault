export const api = async (p, o = {}) => {
  const t = localStorage.t;
  const r = await fetch("/api" + p, {
    ...o,
    headers: {
      "Content-Type": "application/json",
      ...(t && { Authorization: "Bearer " + t }),
    },
    body: o.body && JSON.stringify(o.body),
  });
  const d = await r.json();
  if (!r.ok) throw new Error(d.error || "Error");
  return d;
};
export const download = async (a, q) => {
  const t = localStorage.t;
  const r = await fetch(`/api/assets/${a.id}/download?quality=${q}`, {
    headers: t ? { Authorization: "Bearer " + t } : {},
  });
  if (!r.ok) throw new Error((await r.json()).error);
  const u = URL.createObjectURL(await r.blob());
  Object.assign(document.createElement("a"), {
    href: u,
    download: `${a.title}-${q}.svg`,
  }).click();
};
