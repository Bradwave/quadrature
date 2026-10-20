// Quadrature: Repeated measurements: table, statistics, histogram with Gaussian, dot strip, CSV.
import { fitCam, req, view } from "./canvas.js";
import { NS, TAU } from "./constants.js";
import { setMode, toast } from "./controls.js";
import { $, $$ } from "./dom.js";
import { f2, fT, fmtPM, niceTicks, sub } from "./format.js";
import { measure } from "./measure.js";
import { buildWorld, remeasure, st, sz, trueArea } from "./state.js";

// ---------- series ----------
function rowFrom(V, mode) {
  const s = sz(),
    s2 = s * s;
  return {
    mode,
    shape: st.shape,
    n: NS[st.nIdx],
    s,
    min: V.nMin * s2,
    max: V.nMax * s2,
    avg: ((V.nMin + V.nMax) / 2) * s2,
    d: ((V.nMax - V.nMin) / 2) * s2,
    est: V.nEst * s2,
  };
}
function record() {
  const man = st.mode === "manual" && st.man;
  if (man && !st.man.done) return;
  st.series.push(rowFrom(view(), man ? "manual" : "auto"));
  save();
  updateSeries();
  toast("Recorded measurement " + st.series.length + ".");
}
function save() {
  try {
    localStorage.setItem("quadrature.series.v1", JSON.stringify(st.series));
  } catch (e) {}
}
function load() {
  try {
    const v = JSON.parse(localStorage.getItem("quadrature.series.v1") || "[]");
    if (Array.isArray(v)) st.series = v;
  } catch (e) {}
}
function stats(a) {
  const n = a.length,
    m = a.reduce((x, y) => x + y, 0) / n;
  const sd = n > 1 ? Math.sqrt(a.reduce((x, y) => x + (y - m) * (y - m), 0) / (n - 1)) : 0;
  const mn = Math.min(...a),
    mx = Math.max(...a);
  return { n, mean: m, sd, sem: sd / Math.sqrt(n), min: mn, max: mx, half: (mx - mn) / 2 };
}
const VARN = { est: sub("A", "est"), avg: "Ā", min: sub("A", "min"), max: sub("A", "max") };
const VARH = { est: "A<sub>est</sub>", avg: "Ā", min: "A<sub>min</sub>", max: "A<sub>max</sub>" };
function updateSeries() {
  const S = st.series,
    n = S.length;
  $("#sCount").textContent = n ? `(${n})` : "";
  const vals = S.map((r) => r[st.sVar]);
  const T = st.reveal ? trueArea() : null;
  const sameS = n && S.every((r) => r.s === S[0].s),
    unit = sameS ? (st.sVar === "avg" ? (S[0].s * S[0].s) / 2 : S[0].s * S[0].s) : null;
  drawHist(vals, unit, T);
  drawStrip(vals, T);
  if (n < 2) {
    $("#sSummary").innerHTML = "";
  } else {
    const t = stats(vals),
      dm = stats(S.map((r) => r.d)).mean,
      [a1, e1] = fmtPM(t.mean, t.sem),
      [a2, e2] = fmtPM(t.mean, t.half);
    const shapes = new Set(S.map((r) => r.shape)).size,
      grids = new Set(S.map((r) => r.n)).size;
    $("#sSummary").innerHTML = `<div class="res">${a1} ± ${e1} cm² <span>mean ± σ/√N</span></div>
      <div class="res">${a2} ± ${e2} cm² <span>mean ± (max − min)/2</span></div>
      <div class="g2"><span>N</span><span>${n}${shapes > 1 ? `, mixing ${shapes} shapes` : ""}${grids > 1 ? `, ${grids} grids` : ""}</span>
      <span>mean of ${VARH[st.sVar]}</span><span>${t.mean.toFixed(3)} cm²</span>
      <span>σ</span><span>${t.sd.toFixed(3)} cm²</span>
      <span>σ/√N</span><span>${t.sem.toFixed(3)} cm²</span>
      <span>(max − min)/2</span><span>${t.half.toFixed(3)} cm²</span>
      <span>mean single δ</span><span>${dm.toFixed(3)} cm²${t.sd > 0 ? `, ${(dm / t.sd).toFixed(1)} σ` : ""}</span>
      ${T != null ? `<span>A<sub>true</sub></span><span>${T.toFixed(3)} cm²</span>` : ""}</div>`;
  }
  let h =
    "<thead><tr><th>#</th><th></th><th>grid</th><th>A<sub>min</sub></th><th>A<sub>max</sub></th><th>Ā ± δ</th><th>A<sub>est</sub></th></tr></thead><tbody>";
  for (let i = n - 1; i >= 0 && i >= n - 300; i--) {
    const r = S[i];
    h += `<tr><td>${i + 1}</td><td>${r.mode === "manual" ? "M" : "A"}</td><td>${r.n}²</td><td>${f2(r.min)}</td><td>${f2(r.max)}</td><td>${f2(r.avg)} ± ${f2(r.d)}</td><td>${f2(r.est)}</td></tr>`;
  }
  $("#sTbl").innerHTML = h + "</tbody>";
}
function drawHist(vals, unit, T) {
  const svg = $("#hist"),
    N = vals.length;
  if (N < 2) {
    svg.innerHTML = `<rect x="1" y="1" width="398" height="198" fill="none" stroke="var(--gridline)" stroke-dasharray="4 4"/><text class="empty" x="200" y="96">Run the series or record</text><text class="empty" x="200" y="114">at least two measurements</text>`;
    return;
  }
  const t = stats(vals);
  let start, w;
  if (unit) {
    w = unit;
    start = (Math.round(t.min / w) - 0.5) * w;
  } else {
    const k = Math.ceil(Math.log2(N)) + 1;
    w = (t.max - t.min) / k || 1;
    start = t.min;
  }
  const nb = Math.max(1, Math.floor((t.max - start) / w + 1e-6) + 1),
    cnt = new Array(nb).fill(0);
  for (const v of vals) cnt[Math.min(nb - 1, Math.max(0, Math.floor((v - start) / w + 1e-6)))]++;
  let lo = start,
    hi = start + nb * w;
  if (t.sd > 0) {
    lo = Math.min(lo, t.mean - 3.3 * t.sd);
    hi = Math.max(hi, t.mean + 3.3 * t.sd);
  }
  if (T != null) {
    lo = Math.min(lo, T - w);
    hi = Math.max(hi, T + w);
  }
  const peak = t.sd > 0 ? (N * w) / (t.sd * Math.sqrt(TAU)) : 0,
    ym = Math.max(...cnt, peak) * 1.12;
  const L = 26,
    R = 390,
    TT = 8,
    B = 172,
    X = (v) => L + ((v - lo) / (hi - lo)) * (R - L),
    Y = (c) => B - (c / ym) * (B - TT);
  let h = "";
  for (let k = 0; k < nb; k++)
    if (cnt[k]) {
      const x0 = X(start + k * w),
        x1 = X(start + (k + 1) * w);
      h += `<rect class="hb" x="${x0}" y="${Y(cnt[k])}" width="${Math.max(1, x1 - x0)}" height="${B - Y(cnt[k])}"/>`;
    }
  if (t.sd > 0) {
    let p = "";
    for (let k = 0; k <= 160; k++) {
      const x = lo + ((hi - lo) * k) / 160,
        g = peak * Math.exp(-0.5 * Math.pow((x - t.mean) / t.sd, 2));
      p += (k ? "L" : "M") + X(x).toFixed(1) + " " + Y(g).toFixed(1);
    }
    h += `<path class="gauss" d="${p}"/>`;
  }
  h += `<line class="mean" x1="${X(t.mean)}" x2="${X(t.mean)}" y1="${TT}" y2="${B}"/>`;
  if (T != null) h += `<line class="tru" x1="${X(T)}" x2="${X(T)}" y1="${TT}" y2="${B}"/>`;
  h += `<line class="ax" x1="${L}" x2="${R}" y1="${B}" y2="${B}"/><line class="ax" x1="${L}" x2="${L}" y1="${TT}" y2="${B}"/>`;
  const { ticks, step } = niceTicks(lo, hi, 5);
  for (const v of ticks)
    h += `<line class="tk" x1="${X(v)}" x2="${X(v)}" y1="${B}" y2="${B + 5}"/><text class="tl" x="${X(v)}" y="${B + 17}">${fT(v, step)}</text>`;
  const mc = Math.max(...cnt);
  h += `<text class="tl" x="${L - 6}" y="${Y(mc) + 3}" text-anchor="end" style="text-anchor:end">${mc}</text><text class="tl" x="${L - 6}" y="${B}" style="text-anchor:end">0</text>`;
  h += `<text class="tl" x="${R}" y="${TT + 10}" style="text-anchor:end">${VARN[st.sVar]} (cm²), bin ${+w.toFixed(4)}</text>`;
  svg.innerHTML = h;
}
function drawStrip(vals, T) {
  const svg = $("#strip"),
    N = vals.length;
  if (N < 2) {
    svg.innerHTML = "";
    return;
  }
  const t = stats(vals);
  let lo = t.min,
    hi = t.max;
  if (t.sd > 0) {
    lo = Math.min(lo, t.mean - 1.3 * t.sd);
    hi = Math.max(hi, t.mean + 1.3 * t.sd);
  }
  if (T != null) {
    lo = Math.min(lo, T);
    hi = Math.max(hi, T);
  }
  const sp = hi - lo || 1;
  lo -= sp * 0.08;
  hi += sp * 0.08;
  const L = 18,
    R = 382,
    X = (v) => L + ((v - lo) / (hi - lo)) * (R - L),
    yA = 66;
  let h = "";
  if (t.sd > 0)
    h += `<rect class="sigband" x="${X(t.mean - t.sd)}" y="${yA - 40}" width="${X(t.mean + t.sd) - X(t.mean - t.sd)}" height="40"/>`;
  h += `<path class="rng" d="M${X(t.min)} 14V22M${X(t.min)} 18H${X(t.max)}M${X(t.max)} 14V22"/>`;
  for (let i = 0; i < N; i++) {
    const j = (((Math.sin(i * 12.9898 + 78.233) * 43758.5453) % 1) + 1) % 1;
    h += `<circle class="dot" cx="${X(vals[i])}" cy="${yA - 6 - j * 30}" r="${N > 300 ? 2.2 : 3}"/>`;
  }
  h += `<line class="mean" x1="${X(t.mean)}" x2="${X(t.mean)}" y1="${yA - 42}" y2="${yA}"/>`;
  if (T != null)
    h += `<line class="tru" x1="${X(T)}" x2="${X(T)}" y1="${yA - 42}" y2="${yA + 4}"/>`;
  h += `<line class="ax" x1="${L}" x2="${R}" y1="${yA}" y2="${yA}"/>`;
  const { ticks, step } = niceTicks(lo, hi, 6);
  for (const v of ticks)
    h += `<line class="tk" x1="${X(v)}" x2="${X(v)}" y1="${yA}" y2="${yA + 5}"/><text class="tl" x="${X(v)}" y="${yA + 17}">${fT(v, step)}</text>`;
  h += `<text class="tl" x="${X(t.max) + 4}" y="21" style="text-anchor:start">max − min</text>`;
  if (t.sd > 0)
    h += `<text class="tl" x="${X(t.mean + t.sd) + 4}" y="${yA - 32}" style="text-anchor:start">±σ</text>`;
  svg.innerHTML = h;
}
async function runSeries() {
  if (st.running) return;
  const N = Math.max(2, Math.min(2000, parseInt($("#nRuns").value) || 100)),
    rot = $("#rotChk").checked;
  if (st.mode === "manual") setMode("auto");
  st.running = true;
  const btn = $("#runBtn");
  btn.disabled = true;
  const lbl = btn.querySelector("span:last-child");
  const s = sz(),
    saved = { tx: st.tx, ty: st.ty, ang: st.ang };
  for (let k = 0; k < N; k++) {
    st.tx = (Math.random() - 0.5) * s;
    st.ty = (Math.random() - 0.5) * s;
    if (rot) st.ang = Math.random() * TAU;
    buildWorld();
    const m = measure(st.wr, s, st.thr);
    st.series.push(rowFrom(m, "auto"));
    if (k % 15 === 14) {
      lbl.textContent = k + 1 + "/" + N;
      st.auto = m;
      req();
      await new Promise((r) => setTimeout(r, 0));
    }
  }
  lbl.textContent = "Run";
  btn.disabled = false;
  st.running = false;
  save();
  remeasure(false);
  fitCam();
  updateSeries();
  toast(`Added ${N} automatic measurements.`);
}
$("#runBtn").addEventListener("click", runSeries);
$("#varSeg").addEventListener("click", (e) => {
  const b = e.target.closest("button");
  if (!b) return;
  st.sVar = b.dataset.v;
  $$("#varSeg button").forEach((x) => x.classList.toggle("on", x === b));
  updateSeries();
});
let clearArm = 0;
$("#clearBtn").addEventListener("click", () => {
  const b = $("#clearBtn"),
    t = b.lastChild;
  if (!st.series.length) return toast("The series is already empty.");
  if (!clearArm) {
    t.textContent = "Tap again to clear";
    clearArm = setTimeout(() => {
      clearArm = 0;
      t.textContent = "Clear series";
    }, 3000);
    return;
  }
  clearTimeout(clearArm);
  clearArm = 0;
  t.textContent = "Clear series";
  st.series = [];
  save();
  updateSeries();
  $("#csvOut").hidden = true;
  toast("Series cleared.");
});
$("#copyBtn").addEventListener("click", () => {
  const csv = ["n,mode,shape,squares_per_side,side_cm,A_min,A_max,A_avg,delta,A_est"]
    .concat(
      st.series.map((r, i) =>
        [i + 1, r.mode, '"' + r.shape + '"', r.n, r.s, r.min, r.max, r.avg, r.d, r.est]
          .map((v) => (typeof v === "number" ? +v.toFixed(6) : v))
          .join(","),
      ),
    )
    .join("\n");
  const ta = $("#csvOut");
  ta.value = csv;
  const fallback = () => {
    ta.hidden = false;
    ta.focus();
    ta.select();
    toast("Select the text below and copy it.");
  };
  if (navigator.clipboard && navigator.clipboard.writeText)
    navigator.clipboard.writeText(csv).then(() => toast("CSV copied."), fallback);
  else fallback();
});

export {
  rowFrom,
  record,
  save,
  load,
  stats,
  VARN,
  VARH,
  updateSeries,
  drawHist,
  drawStrip,
  runSeries,
  clearArm,
};
