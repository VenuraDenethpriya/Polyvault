import fs from "fs";
import { fileURLToPath } from "url";
export const VALID =
  /^(sphere|box|torus|knot|cone|cylinder|pyramid|diamond|capsule|helix|img:[a-z0-9-]+|stage:[a-z0-9-]+)$/;
// returns the real stock SVG scaled to the quality width, or null for 3D assets (strict name check blocks path traversal)
export const stockSvg = (a, w) => {
  if (!/^img:[a-z0-9-]+$/.test(a.shape)) return null;
  try {
    return fs
      .readFileSync(
        fileURLToPath(
          new URL(
            `../client/public/stock/${a.shape.slice(4)}.svg`,
            import.meta.url,
          ),
        ),
        "utf8",
      )
      .replace(
        "<svg ",
        `<svg width="${w}" height="${Math.round((w * 2) / 3)}" `,
      );
  } catch {
    return null;
  }
};

// Stage downloads per quality: low = render JPG, medium = web GLB (meshopt-compressed, what the
// viewer streams), high = full-precision GLB kept outside client/public so only owners/Pro get it.
// Returns { path, type, ext } or null (strict name check blocks path traversal).
export const stageFile = (a, q) => {
  const m = /^stage:([a-z0-9-]+)$/.exec(a.shape);
  if (!m) return null;
  const rel = {
      low: `../client/public/stages/${m[1]}-1.jpg`,
      medium: `../client/public/stages/${m[1]}.glb`,
      high: `./assets/stages/${m[1]}-full.glb`,
    }[q],
    path = rel && fileURLToPath(new URL(rel, import.meta.url));
  if (!path || !fs.existsSync(path)) return null;
  return q === "low"
    ? { path, type: "image/jpeg", ext: "jpg" }
    : { path, type: "model/gltf-binary", ext: "glb" };
};
