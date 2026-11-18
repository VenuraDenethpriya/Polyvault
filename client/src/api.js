const API_URL = (import.meta.env.VITE_API_URL || "/api").replace(/\/$/, "");

export const api = async (p, o = {}) => {
  const t = localStorage.t;
  const r = await fetch(API_URL + p, {
    ...o,
    headers: {
      "Content-Type": "application/json",
      ...(t && { Authorization: "Bearer " + t }),
    },
    body: o.body && JSON.stringify(o.body),
  });
  // a server that doesn't know the route answers with an HTML page, not JSON
  const txt = await r.text();
  let d;
  try {
    d = txt ? JSON.parse(txt) : {};
  } catch {
    throw new Error(
      r.status === 404
        ? `The API server doesn't have ${p.split("?")[0]} yet (404). Restart or redeploy the server with the latest code.`
        : `The API server sent an unexpected response (${r.status}).`,
    );
  }
  if (!r.ok) throw new Error(d.error || "Error");
  return d;
};

// file extension from the response type (stages download JPG / GLB, everything else SVG)
const EXT = { "image/jpeg": "jpg", "model/gltf-binary": "glb" };

export const download = async (a, q) => {
  const t = localStorage.t;
  const r = await fetch(`${API_URL}/assets/${a.id}/download?quality=${q}`, {
    headers: t ? { Authorization: "Bearer " + t } : {},
  });
  if (!r.ok) throw new Error((await r.json()).error);
  const b = await r.blob(),
    u = URL.createObjectURL(b);
  Object.assign(document.createElement("a"), {
    href: u,
    download: `${a.title}-${q}.${EXT[b.type.split(";")[0]] || "svg"}`,
  }).click();
  setTimeout(() => URL.revokeObjectURL(u), 1000);
};
