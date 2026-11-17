export const CATS = [
  ["3D Models", "Game-ready meshes and scenes", "sphere", "#7c5cff"],
  ["Textures", "PBR materials and surfaces", "torus", "#00d4ff"],
  ["Icons", "Crisp 3D icon sets", "box", "#ff5c8a"],
  ["Graphics", "Logos, patterns and brand art", "knot", "#ffb84d"],
  ["Mockups", "Product and device scenes", "cone", "#3ddc97"],
  ["Animations", "Motion-ready 3D loops", "capsule", "#ff3df5"],
  ["Backgrounds", "Gradients, landscapes and scenes", "diamond", "#ff7e5f"],
  ["Illustrations", "Planets, cityscapes and flat art", "helix", "#00f5d4"],
  ["Stages", "Event stages you can light, recolour and explore in 360°", "stage", "#19e3ff"],
];
export const SIZES = { low: 256, medium: 1024, high: 4096 };
export const isImg = (a) => String(a.shape).startsWith("img:");
export const imgSrc = (a) => `/stock/${a.shape.slice(4)}.svg`;
export const isStage = (a) => String(a.shape).startsWith("stage:");
// renders shipped with each stage: 1 = front, 2 = aerial, 3 = side
export const stageImg = (a, n = 1) => `/stages/${a.shape.slice(6)}-${n}.jpg`;
// what each download quality contains for a stage
export const STAGE_Q = {
  low: ["Render", "JPG preview"],
  medium: ["Web GLB", "1.5 MB · compressed"],
  high: ["Full GLB", "15 MB · full precision"],
};
const N = [
  "Aria Chen",
  "Leo Park",
  "Maya Singh",
  "Omar Haddad",
  "Sofia Rossi",
  "Kenji Sato",
];
export const meta = (a) => {
  const n = Number(a.id) || 0,
    img = isImg(a);
  if (isStage(a))
    return {
      author: N[n % 6],
      rating: "4.9",
      reviews: 64 + (n % 40),
      tags: ["stage", "event", "conference", "led-wall", "truss", "glb"],
      polys: "297K",
      desc: `${a.title} is a complete, real-world-scale event set: a 14 m stage with neon-edged stairs, an 8 m LED wall flanked by pillar and chevron screens, and a 10 × 9 m lighting truss loaded with moving heads. Explore it in 360°, restyle the screens, neon and lighting live, then download the render or the full GLB.`,
    };
  return {
    author: N[n % 6],
    rating: (4.3 + (n % 7) / 10).toFixed(1),
    reviews: 24 + ((n * 37) % 170),
    tags: [
      a.category.toLowerCase(),
      img ? "svg" : a.shape,
      img ? "stock" : "glb",
      img ? "vector" : "pbr",
    ],
    polys:
      {
        sphere: "2.3K",
        box: "12",
        torus: "3K",
        knot: "7.7K",
        cone: "0.9K",
        cylinder: "0.2K",
        pyramid: "6",
        diamond: "32",
        capsule: "1.5K",
        helix: "4K",
      }[a.shape] || "-",
    desc: img
      ? `${a.title} is a high-resolution vector image that scales to any size without losing quality. Perfect for websites, presentations, social posts and print.`
      : `${a.title} is a production-ready ${a.category.toLowerCase()} asset with clean topology and PBR-friendly materials. Recolour it live in the 3D viewer, then download the quality your plan unlocks.`,
  };
};
