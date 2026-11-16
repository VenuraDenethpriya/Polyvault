export const CATS = [
  ["3D Models", "Game-ready meshes and scenes", "sphere", "#7c5cff"],
  ["Textures", "PBR materials and surfaces", "torus", "#00d4ff"],
  ["Icons", "Crisp 3D icon sets", "box", "#ff5c8a"],
  ["Graphics", "Logos, shapes and brand art", "knot", "#ffb84d"],
  ["Mockups", "Product and device scenes", "cone", "#3ddc97"],
  ["Animations", "Motion-ready 3D loops", "sphere", "#ff3df5"],
];
export const SIZES = { low: 256, medium: 1024, high: 4096 };
const N = [
  "Aria Chen",
  "Leo Park",
  "Maya Singh",
  "Omar Haddad",
  "Sofia Rossi",
  "Kenji Sato",
];
export const meta = (a) => {
  const n = Number(a.id) || 0;
  return {
    author: N[n % 6],
    rating: (4.3 + (n % 7) / 10).toFixed(1),
    reviews: 24 + ((n * 37) % 170),
    tags: [a.category.toLowerCase(), a.shape, "glb", "pbr"],
    polys:
      { sphere: "2.3K", box: "12", torus: "3K", knot: "7.7K", cone: "0.9K" }[
        a.shape
      ] || "-",
    desc: `${a.title} is a production-ready ${a.category.toLowerCase()} asset with clean topology and PBR-friendly materials. Recolour it live in the 3D viewer, then download the quality your plan unlocks.`,
  };
};
