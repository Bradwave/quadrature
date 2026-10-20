// Quadrature: Number line and fixed-scale mini line (SVG).
import { $ } from "./dom.js";
import { fT, niceTicks, placeLabels, sub } from "./format.js";
import { st } from "./state.js";

// ---------- number line ----------
function numberLine(d) {
  const svg = $("#nl");
  svg.style.display = d ? "" : "none";
  if (!d) {
    svg.innerHTML = "";
    return;
  }
  const xs = [d.min, d.max, d.est];
  if (d.tru != null) xs.push(d.tru);
  let lo = Math.min(...xs),
    hi = Math.max(...xs);
  const sp = hi - lo || 1;
  lo -= sp * 0.1;
  hi += sp * 0.1;
  const L = 18,
    R = 382,
    X = (v) => L + ((v - lo) / (hi - lo)) * (R - L),
    yA = 86;
  let h = "";
  const { ticks, step } = niceTicks(lo, hi, 6);
  for (const t of ticks)
    h += `<line class="tk" x1="${X(t)}" x2="${X(t)}" y1="${yA}" y2="${yA + 5}"/><text class="tl" x="${X(t)}" y="${yA + 17}">${fT(t, step)}</text>`;
  h += `<line class="ax" x1="${L}" x2="${R}" y1="${yA}" y2="${yA}"/>`;
  const xm = X(d.min),
    xM = X(d.max),
    xa = X(d.avg);
  h += `<rect class="band" x="${xm}" y="${yA - 24}" width="${Math.max(1, xM - xm)}" height="18"/>`;
  if (xM - xa > 18) {
    const y = yA - 15;
    h += `<path class="arr" d="M${xa + 3} ${y}H${xM - 3}M${xM - 7} ${y - 3}L${xM - 3} ${y}L${xM - 7} ${y + 3}M${xa + 3} ${y}H${xm + 3}M${xm + 7} ${y - 3}L${xm + 3} ${y}L${xm + 7} ${y + 3}"/>`;
    if (xM - xa > 34)
      h += `<text class="dl" x="${(xa + xM) / 2}" y="${y - 2.5}">+δ</text><text class="dl" x="${(xa + xm) / 2}" y="${y - 2.5}">−δ</text>`;
  }
  h += `<line class="avgl" x1="${xa}" x2="${xa}" y1="${yA - 30}" y2="${yA}"/>`;
  if (d.tru != null) {
    const xt = X(d.tru);
    h += `<line class="tru" x1="${xt}" x2="${xt}" y1="${yA - 32}" y2="${yA + 4}"/><circle class="trud" cx="${xt}" cy="${yA - 32}" r="3"/>`;
  }
  const xe = X(d.est);
  h += `<path class="estm" d="M${xe} ${yA - 7}L${xe + 7} ${yA}L${xe} ${yA + 7}L${xe - 7} ${yA}Z"/>`;
  const items = [
    { x: xm, t: sub("A", "min"), w: 30 },
    { x: xM, t: sub("A", "max"), w: 30 },
    { x: xa, t: "Ā", w: 10 },
    { x: xe, t: sub("A", "est"), w: 30 },
  ];
  if (d.tru != null) items.push({ x: X(d.tru), t: sub("A", "true"), w: 36, c: "t" });
  h += placeLabels(items, [44, 31, 18, 5], yA - 30);
  svg.innerHTML = h;
}

// ---------- mini line: fixed scale from 0 ----------
function miniLine(d) {
  const svg = $("#mini");
  svg.style.display = d ? "" : "none";
  if (!d) {
    svg.innerHTML = "";
    return;
  }
  const M = st.scaleMax || 1,
    L = 10,
    R = 390,
    X = (v) => L + Math.max(0, Math.min(1, v / M)) * (R - L),
    y = 16;
  let h = "";
  const { ticks, step } = niceTicks(0, M, 5);
  for (const t of ticks)
    h += `<line class="tk" x1="${X(t)}" x2="${X(t)}" y1="${y}" y2="${y + 4}"/><text class="tl" x="${X(t)}" y="${y + 15}">${fT(t, step)}</text>`;
  h += `<line class="ax" x1="${L}" x2="${R}" y1="${y}" y2="${y}"/>`;
  if (st.prevBand)
    h += `<rect class="ghost" x="${X(st.prevBand.min)}" y="${y - 12}" width="${Math.max(1, X(st.prevBand.max) - X(st.prevBand.min))}" height="12"/>`;
  h += `<rect class="band" x="${X(d.min)}" y="${y - 10}" width="${Math.max(1.5, X(d.max) - X(d.min))}" height="10"/>`;
  h += `<line class="avgl" style="stroke-width:2.5" x1="${X(d.avg)}" x2="${X(d.avg)}" y1="${y - 14}" y2="${y}"/>`;
  if (d.tru != null)
    h += `<line class="tru" x1="${X(d.tru)}" x2="${X(d.tru)}" y1="${y - 15}" y2="${y + 3}"/>`;
  const xe = X(d.est);
  h += `<path class="estm" style="stroke-width:1.5" d="M${xe} ${y - 4.5}L${xe + 4.5} ${y}L${xe} ${y + 4.5}L${xe - 4.5} ${y}Z"/>`;
  h += `<text class="tl" x="${R}" y="${y - 17}" style="text-anchor:end">cm²</text>`;
  svg.innerHTML = h;
}

export { numberLine, miniLine };
