// Quadrature: Measure panel: result, table and actions.
import { req, view } from "./canvas.js";
import { shift } from "./controls.js";
import { $ } from "./dom.js";
import { f2, fN, fmtPM, sub } from "./format.js";
import { startManual } from "./manual.js";
import { measure } from "./measure.js";
import { miniLine, numberLine } from "./numberline.js";
import { record } from "./series.js";
import { st, sz, trueArea } from "./state.js";

// ---------- measure panel ----------
function mismatches() {
  const M = st.man;
  let n = 0;
  for (const k of M.list) if (M.dec.get(k) !== st.auto.cells.get(k).st) n++;
  return n;
}
function updateMeasure() {
  if (!st.auto) return;
  const s = sz(),
    s2 = s * s,
    V = view(),
    A = st.auto,
    man = st.mode === "manual" && st.man,
    done = !man || st.man.done,
    T = trueArea();
  $("#rLabel").textContent = man ? "Your count" : "Automatic count";
  $("#rRel").textContent = "";
  if (!done) {
    $("#big").innerHTML =
      `${st.man.idx}<span class="u">of ${st.man.list.length} border squares</span>`;
    $("#rsub").textContent = "Decide each highlighted square on the grid.";
    numberLine(null);
    miniLine(null);
    $("#mBody").innerHTML =
      `<p class="intro">Inside squares (${A.nMin}) are already counted. You judge the ${st.man.list.length} border squares one by one; the result appears when you finish.</p>`;
    $("#mActions").innerHTML =
      `<button class="btn" data-a="redo"><span class="ms">restart_alt</span>Start over</button>`;
    return;
  }
  const avg = ((V.nMin + V.nMax) / 2) * s2,
    dl = ((V.nMax - V.nMin) / 2) * s2,
    [a, e] = fmtPM(avg, dl);
  $("#big").innerHTML = `${a}<span class="pm">±</span>${e}<span class="u">cm²</span>`;
  $("#rRel").textContent = avg ? "δ/Ā = " + ((dl / avg) * 100).toFixed(1) + "%" : "";
  $("#rsub").innerHTML = `Ā ± δ. Estimate A<sub>est</sub> = ${f2(V.nEst * s2)} cm²`;
  numberLine({
    min: V.nMin * s2,
    max: V.nMax * s2,
    avg,
    est: V.nEst * s2,
    tru: st.reveal ? T : null,
  });
  miniLine({
    min: V.nMin * s2,
    max: V.nMax * s2,
    avg,
    est: V.nEst * s2,
    tru: st.reveal ? T : null,
  });
  const rows = [
    ["A<sub>min</sub>", "squares fully inside", V.nMin, A.nMin],
    ["A<sub>border</sub>", "squares cut by the border", V.nB, A.nB],
    ["A<sub>max</sub>", "A<sub>min</sub> + A<sub>border</sub>", V.nMax, A.nMax],
    [
      "Ā",
      "(A<sub>min</sub> + A<sub>max</sub>)/2",
      (V.nMin + V.nMax) / 2,
      (A.nMin + A.nMax) / 2,
      "hl",
    ],
    [
      "δ",
      "(A<sub>max</sub> − A<sub>min</sub>)/2",
      (V.nMax - V.nMin) / 2,
      (A.nMax - A.nMin) / 2,
      "hl",
    ],
    [
      "A<sub>est</sub>",
      man
        ? "inside + border squares you counted"
        : `inside + border squares ≥ ${Math.round(st.thr * 100)}%`,
      V.nEst,
      A.nEst,
      "hl",
    ],
  ];
  let h = `<table class="stats"><thead><tr><th></th><th>squares</th><th>cm²</th>${man ? "<th>auto cm²</th>" : ""}</tr></thead><tbody>`;
  for (const [l, dsc, n, an, c] of rows)
    h += `<tr${c ? ` class="${c}"` : ""}><td>${l}<small>${dsc}</small></td><td>${fN(n)}</td><td>${f2(n * s2)}</td>${man ? `<td>${f2(an * s2)}</td>` : ""}</tr>`;
  if (st.reveal)
    h += `<tr class="tr"><td>A<sub>true</sub><small>exact area of the shape</small></td><td>${(T / s2).toFixed(1)}</td><td>${f2(T)}</td>${man ? `<td></td>` : ""}</tr>`;
  h += `</tbody></table><p class="note">One square = ${f2(s)} × ${f2(s)} cm = ${s2.toFixed(4).replace(/0+$/, "").replace(/\.$/, "")} cm².</p>`;
  $("#mBody").innerHTML = h;
  if (man) {
    const mm = mismatches();
    $("#mActions").innerHTML =
      `<span class="mis">You disagree with the automatic count on ${mm} of ${st.man.list.length} border squares.</span>
      <button class="btn primary" data-a="recshift"><span class="ms">shuffle</span>Record and shift</button>
      <button class="btn" data-a="rec"><span class="ms">add</span>Record</button>
      <button class="btn" data-a="redo"><span class="ms">restart_alt</span>Count again</button>
      ${mm ? `<label class="chk"><input type="checkbox" data-a="mis" ${st.showMis ? "checked" : ""}> show disagreements</label>` : ""}`;
  } else
    $("#mActions").innerHTML =
      `<button class="btn primary" data-a="rec"><span class="ms">add</span>Record in series</button>`;
}
$("#mActions").addEventListener("click", (e) => {
  const b = e.target.closest("[data-a]");
  if (!b) return;
  const a = b.dataset.a;
  if (a === "rec") record();
  else if (a === "recshift") {
    record();
    shift();
  } else if (a === "redo") startManual();
  else if (a === "mis") {
    st.showMis = b.checked;
    req();
  }
});

export { mismatches, updateMeasure };
