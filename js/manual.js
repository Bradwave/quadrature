// Quadrature: Manual counting mode: one border square at a time.
import { fitCam, focusCell, req } from "./canvas.js";
import { $ } from "./dom.js";
import { updateMeasure } from "./panel.js";
import { st } from "./state.js";

// ---------- manual mode ----------
let curOpts = [];
function startManual() {
  const list = st.auto.border.slice();
  st.man = { list, set: new Set(list), idx: 0, dec: new Map(), done: list.length === 0 };
  if (st.man.done) fitCam();
  else focusCell();
  renderCard();
  updateMeasure();
  req();
}
function decide(v) {
  const M = st.man;
  if (!M || M.done) return;
  M.dec.set(M.list[M.idx], v);
  M.idx++;
  if (M.idx >= M.list.length) {
    M.done = true;
    fitCam();
  } else focusCell();
  renderCard();
  updateMeasure();
  req();
}
function back() {
  const M = st.man;
  if (!M) return;
  if (M.done) {
    M.done = false;
    M.idx = M.list.length - 1;
  } else if (M.idx > 0) M.idx--;
  else return;
  focusCell();
  renderCard();
  updateMeasure();
  req();
}
function renderCard() {
  const M = st.man,
    show = st.mode === "manual" && M && !M.done;
  $("#mcard").hidden = !show;
  if (!show) return;
  const key = M.list[M.idx],
    c = st.auto.cells.get(key),
    cur = M.dec.get(key);
  $("#mProg").style.width = (M.idx / M.list.length) * 100 + "%";
  $("#mCount").textContent = M.idx + 1 + "/" + M.list.length;
  $("#mFlag").hidden = !c.amb;
  let q;
  if (c.amb === "hi") {
    q = "The border only just clips this square. Is it inside, or a border square?";
    curOpts = [
      ["in", "Inside", "in A<sub>min</sub>", "I"],
      ["count", "Border", "counted", "Y"],
      ["skip", "Border", "not counted", "N"],
    ];
  } else if (c.amb === "lo") {
    q = "The shape only just touches this square. Is it a border square, or outside?";
    curOpts = [
      ["count", "Border", "counted", "Y"],
      ["skip", "Border", "not counted", "N"],
      ["out", "Outside", "not in A<sub>max</sub>", "O"],
    ];
  } else {
    q = "Count this border square in your estimate?";
    curOpts = [
      ["count", "Count", "yes", "Y"],
      ["skip", "Skip", "no", "N"],
    ];
  }
  $("#mQ").innerHTML = q;
  $("#mOpts").innerHTML = curOpts
    .map(
      ([v, a, b, k]) =>
        `<button class="btn o-${v}${cur === v ? " picked" : ""}" data-v="${v}"><span>${a} <kbd>${k}</kbd></span><small>${b}</small></button>`,
    )
    .join("");
}
$("#mOpts").addEventListener("click", (e) => {
  const b = e.target.closest("button");
  if (b) decide(b.dataset.v);
});
$("#mBack").addEventListener("click", back);
document.addEventListener("keydown", (e) => {
  if ($("#help").open || !(st.mode === "manual" && st.man && !st.man.done)) return;
  if (e.target.matches("input,select,textarea")) return;
  const k = e.key.toLowerCase(),
    map = { y: "count", enter: "count", n: "skip", i: "in", o: "out" };
  if (k === "backspace" || k === "arrowleft") {
    e.preventDefault();
    back();
    return;
  }
  const v = map[k];
  if (v && curOpts.some((o) => o[0] === v)) {
    e.preventDefault();
    decide(v);
  }
});

export { curOpts, startManual, decide, back, renderCard };
