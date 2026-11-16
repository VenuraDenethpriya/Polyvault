// [title, category, shape, color, price, downloads] – 40 generated 3D variations + 40 stock images (see seed-stock.js)
import { STOCK } from "./seed-stock.js";
const SH = [
    "sphere",
    "box",
    "torus",
    "knot",
    "cone",
    "cylinder",
    "pyramid",
    "diamond",
    "capsule",
    "helix",
  ],
  BASE = [
    "Orb",
    "Cube",
    "Ring",
    "Knot",
    "Cone",
    "Cylinder",
    "Pyramid",
    "Gem",
    "Capsule",
    "Spiral",
  ];
const ADJ = [
  ["Neon", "#7c5cff"],
  ["Chrome", "#9fb3c8"],
  ["Candy", "#ff4fd8"],
  ["Frost", "#00d4ff"],
  ["Solar", "#ffb84d"],
  ["Mint", "#3ddc97"],
  ["Ruby", "#ff5c5c"],
  ["Pearl", "#e8e8ff"],
];
const CAT = [
  "3D Models",
  "Textures",
  "Icons",
  "Graphics",
  "Mockups",
  "Animations",
];
const M = SH.flatMap((s, si) =>
  [0, 1, 2, 3].map((k) => {
    const [a, c] = ADJ[(si + k * 2) % 8];
    return [
      `${a} ${BASE[si]}`,
      CAT[(si + k) % 6],
      s,
      c,
      6 + ((si * 7 + k * 5) % 20),
      300 + ((si * 131 + k * 277) % 1700),
    ];
  }),
);
export const ASSETS = [];
for (let i = 0; i < Math.max(M.length, STOCK.length); i++) {
  if (M[i]) ASSETS.push(M[i]);
  if (STOCK[i]) ASSETS.push(STOCK[i]);
}
