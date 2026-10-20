// Quadrature: Shape library, random shape generator and validation of added parts/holes.
import { TAU } from "./constants.js";
import {
  bbox,
  maxR,
  minDist,
  pip,
  polar,
  ringSimple,
  ringsCross,
  rot,
  scl,
  warp,
  wrapA,
} from "./geometry.js";

const LIB = {
  Leaf: () => [
    rot(
      Array.from({ length: 220 }, (_, k) => {
        const t = (k / 220) * TAU;
        return [
          4.1 * Math.cos(t),
          2.3 * Math.sin(t) * Math.pow(Math.abs(Math.sin(t)), 0.25) * (1 - 0.22 * Math.cos(t)),
        ];
      }),
      -0.55,
    ),
  ],
  Blob: () => [
    polar(
      (t) =>
        3.1 + 0.55 * Math.sin(3 * t + 0.4) + 0.3 * Math.cos(5 * t + 1.2) + 0.2 * Math.sin(2 * t),
      220,
    ),
  ],
  Amoeba: () => [
    scl(
      warp(
        polar(
          (t) =>
            2.9 +
            0.6 * Math.sin(2 * t + 0.3) +
            0.45 * Math.cos(3 * t + 2) +
            0.3 * Math.sin(5 * t + 1) +
            0.15 * Math.cos(7 * t),
          260,
        ),
        0.5,
        0.9,
        0.4,
        1.7,
      ),
      0.86,
    ),
  ],
  Kidney: () => [
    polar(
      (t) =>
        3 + 0.35 * Math.cos(2 * t) - 1.3 * Math.exp(-Math.pow(wrapA(t - Math.PI / 2), 2) / 0.22),
      240,
    ),
  ],
  Star: () => {
    const p = [],
      m = 7;
    for (let k = 0; k < 2 * m; k++) {
      const t = (k / (2 * m)) * TAU - Math.PI / 2,
        r = k % 2 ? 1.7 : 3.9;
      p.push([r * Math.cos(t), r * Math.sin(t)]);
    }
    return [p];
  },
  Cloud: () => [
    scl(
      polar((t) => 2.7 + 0.8 * Math.abs(Math.sin(3.5 * t)), 300),
      1.05,
      0.85,
    ),
  ],
  Gear: () => [polar((t) => 3.25 + 0.5 * Math.tanh(4 * Math.sin(10 * t)), 400)],
  Snail: () => {
    const a = 0.35,
      b = 0.3,
      w = 0.9,
      t0 = 0.7,
      t1 = 3 * Math.PI,
      N = 280,
      o = [],
      n = [];
    for (let k = 0; k <= N; k++) {
      const t = t0 + ((t1 - t0) * k) / N,
        ri = a + b * t,
        ro = ri + w;
      n.push([ri * Math.cos(t), ri * Math.sin(t)]);
      o.push([ro * Math.cos(t), ro * Math.sin(t)]);
    }
    const p = o.concat(n.reverse());
    const B = bbox(p),
      mx = (B[0] + B[2]) / 2,
      my = (B[1] + B[3]) / 2;
    return [p.map(([x, y]) => [x - mx, y - my])];
  },
  Donut: () => [
    polar((t) => 3.6 + 0.25 * Math.sin(4 * t), 240),
    polar((t) => 1.5 + 0.2 * Math.cos(3 * t), 140, 0.4, -0.2),
  ],
  "Lake and island": () => [
    polar((t) => 3.8 + 0.35 * Math.sin(3 * t + 1) + 0.2 * Math.cos(5 * t), 260),
    polar((t) => 2.1 + 0.3 * Math.sin(2 * t + 0.5) + 0.15 * Math.cos(4 * t), 180, 0.3, 0.2),
    polar((t) => 0.8 + 0.2 * Math.sin(3 * t), 90, 0.45, 0.35),
  ],
  Archipelago: () => [
    polar((t) => 1.6 + 0.25 * Math.sin(3 * t + 1), 140, -1.9, -1.7),
    polar((t) => 1.15 + 0.2 * Math.cos(4 * t), 110, 1.9, -1.5),
    polar((t) => 1.5 + 0.22 * Math.sin(2 * t + 2) + 0.1 * Math.cos(5 * t), 140, 0.5, 2),
    polar((t) => 0.6 + 0.1 * Math.sin(3 * t), 70, -2.6, 2.3),
  ],
  "Square frame": () => [
    [
      [-3.5, -3.5],
      [3.5, -3.5],
      [3.5, 3.5],
      [-3.5, 3.5],
    ],
    [
      [-1.7, -1.7],
      [1.7, -1.7],
      [1.7, 1.7],
      [-1.7, 1.7],
    ],
  ],
};
function randBlob(cx, cy, R, rough, N) {
  const h = [];
  for (let k = 2; k <= 7; k++)
    h.push([k, (rough * (Math.random() * 2 - 1)) / Math.pow(k, 0.8), Math.random() * TAU]);
  const f = (t) => {
    let s = 0;
    for (const [k, a, ph] of h) s += a * Math.cos(k * t + ph);
    return s;
  };
  let mn = Infinity;
  for (let k = 0; k < N; k++) mn = Math.min(mn, 1 + f((k / N) * TAU));
  const sc = mn < 0.4 ? 0.6 / (1 - mn) : 1;
  return polar((t) => R * (1 + f(t) * sc), N, cx, cy);
}
function validAdd(ring, rings, kind, clear = 0) {
  for (const r of rings) {
    if (ringsCross(ring, r)) return "That border would cross an existing one.";
    if (clear && minDist(ring, r) < clear) return "Too close.";
    if (pip(r[0], ring)) return "That would enclose another part of the shape.";
  }
  let d = 0;
  for (const r of rings) if (pip(ring[0], r)) d++;
  if (kind === "hole" && d % 2 === 0) return "Draw a hole inside the filled shape.";
  if (kind === "part" && d % 2 === 1) return "Draw a new part outside the shape, or inside a hole.";
  return null;
}
function tryAdd(rings, kind) {
  for (let t = 0; t < 60; t++) {
    const a = Math.random() * TAU,
      d = Math.random() * (kind === "hole" ? 2.6 : 4.3);
    const R = kind === "hole" ? 0.45 + Math.random() * 1 : 0.35 + Math.random() * 0.8;
    const r = randBlob(d * Math.cos(a), d * Math.sin(a), R, 0.35, 100);
    if (maxR(r) > 4.7) continue;
    if (!validAdd(r, rings, kind, 0.18)) {
      rings.push(r);
      return true;
    }
  }
  return false;
}
function randomShape() {
  for (let t = 0; t < 80; t++) {
    const f = 0.35 + Math.random() * 0.7,
      amp = (0.15 + Math.random() * 0.55) / f;
    let main = warp(
      randBlob(0, 0, 2.3 + Math.random() * 1.1, 0.25 + Math.random() * 0.5, 220),
      amp,
      f,
      Math.random() * TAU,
      Math.random() * TAU,
    );
    const B = bbox(main),
      mx = (B[0] + B[2]) / 2,
      my = (B[1] + B[3]) / 2;
    main = main.map(([x, y]) => [x - mx, y - my]);
    if (maxR(main) > 4.4 || !ringSimple(main)) continue;
    const rings = [main];
    if (Math.random() < 0.5) {
      const nh = Math.random() < 0.35 ? 2 : 1;
      for (let h = 0; h < nh; h++) tryAdd(rings, "hole");
    }
    if (Math.random() < 0.5) {
      const ni = 1 + Math.floor(Math.random() * 3);
      for (let h = 0; h < ni; h++) tryAdd(rings, "part");
    }
    return rings;
  }
  return LIB.Blob();
}

export { LIB, randBlob, validAdd, tryAdd, randomShape };
