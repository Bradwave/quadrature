// Quadrature: Counting squares: classifies every grid cell (inside / border / outside) with exact coverage.
import { AMB, K } from "./constants.js";
import { clipArea, traverse } from "./geometry.js";

function measure(wr, s, thr) {
  const cells = new Map(),
    order = [],
    s2 = s * s;
  for (const r of wr) {
    const p = r.pts,
      n = p.length;
    for (let k = 0; k < n; k++)
      traverse(p[k], p[(k + 1) % n], s, (i, j) => {
        const key = K(i, j);
        if (!cells.has(key)) {
          cells.set(key, { i, j, key });
          order.push(key);
        }
      });
  }
  for (const key of order) {
    const c = cells.get(key),
      x0 = c.i * s,
      y0 = c.j * s,
      x1 = x0 + s,
      y1 = y0 + s;
    let a = 0;
    for (const r of wr) {
      const b = r.bb;
      if (b[2] <= x0 || b[0] >= x1 || b[3] <= y0 || b[1] >= y1) continue;
      a += r.sign * clipArea(r.pts, x0, y0, x1, y1);
    }
    const cov = Math.max(0, Math.min(1, a / s2));
    c.cov = cov;
    if (cov >= 1 - 1e-7) c.st = "in";
    else if (cov <= 1e-7) c.st = "out";
    else {
      c.st = cov >= thr - 1e-9 ? "count" : "skip";
      c.amb = cov < AMB ? "lo" : cov > 1 - AMB ? "hi" : null;
    }
  }
  let bb = [Infinity, Infinity, -Infinity, -Infinity];
  for (const r of wr) {
    bb = [
      Math.min(bb[0], r.bb[0]),
      Math.min(bb[1], r.bb[1]),
      Math.max(bb[2], r.bb[2]),
      Math.max(bb[3], r.bb[3]),
    ];
  }
  const j0 = Math.floor(bb[1] / s),
    j1 = Math.floor(bb[3] / s);
  for (let j = j0; j <= j1; j++) {
    const yc = (j + 0.5) * s,
      xs = [];
    for (const r of wr) {
      const p = r.pts,
        n = p.length;
      for (let k = 0, m = n - 1; k < n; m = k++) {
        const ya = p[m][1],
          yb = p[k][1];
        if (ya <= yc !== yb <= yc) xs.push(p[m][0] + ((yc - ya) * (p[k][0] - p[m][0])) / (yb - ya));
      }
    }
    xs.sort((a, b) => a - b);
    for (let k = 0; k + 1 < xs.length; k += 2) {
      const i0 = Math.ceil(xs[k] / s - 0.5),
        i1 = Math.floor(xs[k + 1] / s - 0.5);
      for (let i = i0; i <= i1; i++) {
        const key = K(i, j);
        if (!cells.has(key)) cells.set(key, { i, j, key, cov: 1, st: "in" });
      }
    }
  }
  for (const [k, c] of cells) if (c.st === "out") cells.delete(k);
  const border = order.filter((k) => cells.has(k) && cells.get(k).st !== "in");
  let nMin = 0,
    nC = 0;
  for (const c of cells.values()) {
    if (c.st === "in") nMin++;
    else if (c.st === "count") nC++;
  }
  return { s, cells, border, nMin, nB: border.length, nMax: nMin + border.length, nEst: nMin + nC };
}

export { measure };
