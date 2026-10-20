// Quadrature: Pure polygon geometry: areas, point-in-polygon, intersections, clipping, grid traversal.
import { TAU } from "./constants.js";

function ringArea(p) {
  let a = 0;
  for (let i = 0, n = p.length, j = n - 1; i < n; j = i++)
    a += p[j][0] * p[i][1] - p[i][0] * p[j][1];
  return a / 2;
}
function bbox(p) {
  let a = Infinity,
    b = Infinity,
    c = -Infinity,
    d = -Infinity;
  for (const [x, y] of p) {
    if (x < a) a = x;
    if (y < b) b = y;
    if (x > c) c = x;
    if (y > d) d = y;
  }
  return [a, b, c, d];
}
function maxR(p) {
  let m = 0;
  for (const [x, y] of p) m = Math.max(m, Math.hypot(x, y));
  return m;
}
function pip(pt, p) {
  const x = pt[0],
    y = pt[1];
  let c = false;
  for (let i = 0, n = p.length, j = n - 1; i < n; j = i++) {
    const yi = p[i][1],
      yj = p[j][1];
    if (yi > y !== yj > y && x < ((p[j][0] - p[i][0]) * (y - yi)) / (yj - yi) + p[i][0]) c = !c;
  }
  return c;
}
function orient(a, b, c) {
  return (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
}
function onSeg(a, b, c) {
  return (
    Math.min(a[0], b[0]) - 1e-12 <= c[0] &&
    c[0] <= Math.max(a[0], b[0]) + 1e-12 &&
    Math.min(a[1], b[1]) - 1e-12 <= c[1] &&
    c[1] <= Math.max(a[1], b[1]) + 1e-12
  );
}
function segX(a, b, c, d) {
  if (
    Math.max(a[0], b[0]) < Math.min(c[0], d[0]) ||
    Math.max(c[0], d[0]) < Math.min(a[0], b[0]) ||
    Math.max(a[1], b[1]) < Math.min(c[1], d[1]) ||
    Math.max(c[1], d[1]) < Math.min(a[1], b[1])
  )
    return false;
  const o1 = orient(a, b, c),
    o2 = orient(a, b, d),
    o3 = orient(c, d, a),
    o4 = orient(c, d, b),
    e = 1e-12;
  if (((o1 > e && o2 < -e) || (o1 < -e && o2 > e)) && ((o3 > e && o4 < -e) || (o3 < -e && o4 > e)))
    return true;
  if (Math.abs(o1) <= e && onSeg(a, b, c)) return true;
  if (Math.abs(o2) <= e && onSeg(a, b, d)) return true;
  if (Math.abs(o3) <= e && onSeg(c, d, a)) return true;
  if (Math.abs(o4) <= e && onSeg(c, d, b)) return true;
  return false;
}
function ringSimple(p) {
  const n = p.length;
  for (let i = 0; i < n; i++) {
    const a = p[i],
      b = p[(i + 1) % n];
    for (let j = i + 2; j < n; j++) {
      if (i === 0 && j === n - 1) continue;
      if (segX(a, b, p[j], p[(j + 1) % n])) return false;
    }
  }
  return true;
}
function ringsCross(p, q) {
  const A = bbox(p),
    B = bbox(q);
  if (A[2] < B[0] || B[2] < A[0] || A[3] < B[1] || B[3] < A[1]) return false;
  for (let i = 0, n = p.length; i < n; i++) {
    const a = p[i],
      b = p[(i + 1) % n];
    for (let j = 0, m = q.length; j < m; j++) if (segX(a, b, q[j], q[(j + 1) % m])) return true;
  }
  return false;
}
function minDist(p, q) {
  let m = Infinity;
  for (const a of p)
    for (const b of q) {
      const d = Math.hypot(a[0] - b[0], a[1] - b[1]);
      if (d < m) m = d;
    }
  return m;
}
function inter(a, b, ax, v) {
  const t = (v - a[ax]) / (b[ax] - a[ax]);
  return ax === 0 ? [v, a[1] + t * (b[1] - a[1])] : [a[0] + t * (b[0] - a[0]), v];
}
function clipEdge(pts, ax, v, dir) {
  const out = [],
    n = pts.length;
  if (!n) return out;
  let prev = pts[n - 1],
    pin = (prev[ax] - v) * dir >= 0;
  for (const cur of pts) {
    const cin = (cur[ax] - v) * dir >= 0;
    if (cin) {
      if (!pin) out.push(inter(prev, cur, ax, v));
      out.push(cur);
    } else if (pin) out.push(inter(prev, cur, ax, v));
    prev = cur;
    pin = cin;
  }
  return out;
}
function clipArea(p, x0, y0, x1, y1) {
  let q = clipEdge(p, 0, x0, 1);
  if (!q.length) return 0;
  q = clipEdge(q, 0, x1, -1);
  if (!q.length) return 0;
  q = clipEdge(q, 1, y0, 1);
  if (!q.length) return 0;
  q = clipEdge(q, 1, y1, -1);
  if (q.length < 3) return 0;
  return Math.abs(ringArea(q));
}
function traverse(a, b, s, cb) {
  const x0 = a[0] / s,
    y0 = a[1] / s,
    x1 = b[0] / s,
    y1 = b[1] / s;
  let i = Math.floor(x0),
    j = Math.floor(y0);
  const dx = x1 - x0,
    dy = y1 - y0,
    sx = dx > 0 ? 1 : -1,
    sy = dy > 0 ? 1 : -1;
  let tx = dx !== 0 ? ((dx > 0 ? i + 1 : i) - x0) / dx : Infinity,
    ty = dy !== 0 ? ((dy > 0 ? j + 1 : j) - y0) / dy : Infinity;
  const ddx = dx !== 0 ? Math.abs(1 / dx) : Infinity,
    ddy = dy !== 0 ? Math.abs(1 / dy) : Infinity;
  cb(i, j);
  let g = 0;
  while (g++ < 100000) {
    if (tx < ty) {
      if (tx > 1) break;
      i += sx;
      tx += ddx;
    } else {
      if (ty > 1) break;
      j += sy;
      ty += ddy;
    }
    cb(i, j);
  }
}
function polar(fn, N = 180, cx = 0, cy = 0) {
  const p = [];
  for (let k = 0; k < N; k++) {
    const t = (k / N) * TAU,
      r = fn(t);
    p.push([cx + r * Math.cos(t), cy + r * Math.sin(t)]);
  }
  return p;
}
function rot(p, a) {
  const c = Math.cos(a),
    s = Math.sin(a);
  return p.map(([x, y]) => [c * x - s * y, s * x + c * y]);
}
function warp(p, a, f, p1, p2) {
  return p.map(([x, y]) => [x + a * Math.sin(f * y + p1), y + a * Math.sin(f * x + p2)]);
}
function scl(p, k, ky = k) {
  return p.map(([x, y]) => [x * k, y * ky]);
}
const wrapA = (a) => Math.atan2(Math.sin(a), Math.cos(a));
function signsOf(rings) {
  return rings.map((r, i) => {
    let d = 0;
    rings.forEach((q, k) => {
      if (k !== i && pip(r[0], q)) d++;
    });
    return d % 2 ? -1 : 1;
  });
}

export {
  ringArea,
  bbox,
  maxR,
  pip,
  orient,
  onSeg,
  segX,
  ringSimple,
  ringsCross,
  minDist,
  inter,
  clipEdge,
  clipArea,
  traverse,
  polar,
  rot,
  warp,
  scl,
  wrapA,
  signsOf,
};
