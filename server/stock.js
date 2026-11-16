import fs from "fs";
import { fileURLToPath } from "url";
export const VALID =
  /^(sphere|box|torus|knot|cone|cylinder|pyramid|diamond|capsule|helix|img:[a-z0-9-]+)$/;
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
