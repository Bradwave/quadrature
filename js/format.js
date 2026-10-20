// Quadrature: Number formatting and axis helpers.
import { shift } from "./controls.js";
import { $ } from "./dom.js";

// ---------- formatting ----------
function fmtPM(v, e) {
  if (!(e > 0)) return [v.toFixed(2), "0"];
  const ex = Math.floor(Math.log10(e)),
    lead = e / Math.pow(10, ex),
    dec = (lead < 2 ? 1 : 0) - ex,
    f = Math.pow(10, dec);
  const d = Math.max(0, dec);
  return [(Math.round(v * f) / f).toFixed(d), (Math.round(e * f) / f).toFixed(d)];
}
const f2 = (v) => (+v).toFixed(2);
const fN = (n) => (Number.isInteger(n) ? String(n) : n.toFixed(1));
const sub = (a, b) => `${a}<tspan baseline-shift="sub" font-size="8">${b}</tspan>`;
function niceTicks(lo, hi, n) {
  const span = hi - lo;
  if (!(span > 0)) return { ticks: [lo], step: 1 };
  const raw = span / n,
    p = Math.pow(10, Math.floor(Math.log10(raw))),
    m = raw / p,
    step = (m < 1.5 ? 1 : m < 3.5 ? 2 : m < 7.5 ? 5 : 10) * p,
    t = [];
  for (let v = Math.ceil(lo / step) * step; v <= hi + 1e-9; v += step) t.push(+v.toFixed(10));
  return { ticks: t, step };
}
const fT = (v, step) => v.toFixed(Math.max(0, -Math.floor(Math.log10(step) + 1e-9)));
function placeLabels(items, rows, top) {
  items.sort((a, b) => a.x - b.x);
  const ends = rows.map(() => -Infinity);
  let h = "";
  for (const it of items) {
    let r = ends.findIndex((e) => e < it.x - it.w / 2 - 4);
    if (r < 0) r = rows.length - 1;
    ends[r] = it.x + it.w / 2;
    const y = rows[r];
    h += `<line class="lead" x1="${it.x}" x2="${it.x}" y1="${y + 3}" y2="${top}"/><text class="lab${it.c ? " " + it.c : ""}" x="${it.x}" y="${y}">${it.t}</text>`;
  }
  return h;
}

export { fmtPM, f2, fN, sub, niceTicks, fT, placeLabels };
