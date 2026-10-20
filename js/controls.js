// Quadrature: Toolbar, sliders, tabs, mode switching, toasts.
import { cv, fitCam, readColors, req, view, wrap } from "./canvas.js";
import { NS, TAU } from "./constants.js";
import { $, $$ } from "./dom.js";
import { signsOf } from "./geometry.js";
import { renderCard, startManual } from "./manual.js";
import { updateMeasure } from "./panel.js";
import { updateSeries } from "./series.js";
import { LIB, randomShape } from "./shapes.js";
import { remeasure, setRings, st, syncSelect, sz } from "./state.js";

// ---------- controls ----------
function shift() {
  st.prevBand = null;
  const s = sz();
  st.tx = (Math.random() - 0.5) * s;
  st.ty = (Math.random() - 0.5) * s;
  st.ang = Math.random() * TAU;
  remeasure(true);
  if (st.mode !== "manual" || st.man.done) fitCam();
}
function setMode(m) {
  st.mode = m;
  st.prevBand = null;
  $$("#modeSeg button").forEach((b) => b.classList.toggle("on", b.dataset.mode === m));
  $$("#toolGroup button,#undoBtn").forEach((b) => (b.disabled = m === "manual"));
  cv.classList.toggle("locked", m === "manual");
  if (m === "manual") {
    startManual();
    const r = wrap.getBoundingClientRect();
    if (r.top < 0 || r.bottom > innerHeight)
      wrap.scrollIntoView({ block: "start", behavior: "smooth" });
  } else {
    st.man = null;
    fitCam();
    updateMeasure();
    renderCard();
    req();
  }
  setHint();
}
function setHint() {
  const t = {
    move: "Drag to move the shape",
    draw: "Draw a closed outline",
    part: "Draw a separate part",
    hole: "Draw a hole inside the shape",
  };
  $("#hint").textContent = st.mode === "manual" ? "Manual count" : t[st.tool];
  cv.classList.toggle("pen", st.tool !== "move");
}
let toastT = 0;
function toast(m) {
  const t = $("#toast");
  t.textContent = m;
  t.classList.add("show");
  clearTimeout(toastT);
  toastT = setTimeout(() => t.classList.remove("show"), 2800);
}
$("#modeSeg").addEventListener("click", (e) => {
  const b = e.target.closest("button");
  if (b && b.dataset.mode !== st.mode && !st.running) setMode(b.dataset.mode);
});
$("#toolGroup").addEventListener("click", (e) => {
  const b = e.target.closest(".tool");
  if (!b) return;
  st.tool = b.dataset.tool;
  $$(".tool").forEach((x) => x.classList.toggle("on", x === b));
  setHint();
});
$("#undoBtn").addEventListener("click", () => {
  const u = st.undo.pop();
  if (!u) return toast("Nothing to undo.");
  st.photo = u.photo || null;
  $("#lgPhoto").hidden = !st.photo;
  st.rings = u.rings;
  st.signs = signsOf(u.rings);
  st.scaleMax = null;
  st.prevBand = null;
  st.shape = u.shape;
  syncSelect();
  remeasure(true);
  fitCam();
});
$("#randBtn").addEventListener("click", () => {
  st.tx = st.ty = st.ang = 0;
  setRings(randomShape(), "Random");
});
$("#shapeSel").addEventListener("change", (e) => {
  const v = e.target.value;
  if (LIB[v]) {
    st.tx = st.ty = st.ang = 0;
    setRings(LIB[v](), v);
  }
});
$("#shiftBtn").addEventListener("click", () => {
  if (!st.running) shift();
});
$("#trueBtn").addEventListener("click", () => {
  st.reveal = !st.reveal;
  $("#trueBtn").classList.toggle("on", st.reveal);
  $("#trueIcon").textContent = st.reveal ? "visibility" : "visibility_off";
  updateMeasure();
  updateSeries();
  toast(
    st.reveal
      ? "Exact area shown in purple: table, number line and series plots."
      : "Exact area hidden.",
  );
});
$("#nRange").addEventListener("input", (e) => {
  if (!(st.mode === "manual" && st.man && !st.man.done)) {
    const V = view(),
      s2 = sz() * sz();
    st.prevBand = { min: V.nMin * s2, max: V.nMax * s2 };
  }
  st.nIdx = +e.target.value;
  updN();
  remeasure(true);
});
$("#thrRange").addEventListener("input", (e) => {
  st.thr = +e.target.value / 100;
  $("#thrLbl").textContent = e.target.value + "%";
  remeasure(false);
});
function updN() {
  const n = NS[st.nIdx];
  $("#nLbl").textContent = `${n} × ${n}, side ${+(10 / n).toFixed(3)} cm`;
}
$("#legend").addEventListener("click", (e) => {
  const b = e.target.closest(".lg");
  if (!b) return;
  const l = b.dataset.l;
  st.layers[l] = !st.layers[l];
  b.classList.toggle("on", st.layers[l]);
  req();
});
$$(".tab").forEach((t) =>
  t.addEventListener("click", () => {
    $$(".tab").forEach((x) => x.classList.toggle("on", x === t));
    $("#pane-measure").hidden = t.dataset.tab !== "measure";
    $("#pane-series").hidden = t.dataset.tab !== "series";
    if (t.dataset.tab === "series") updateSeries();
  }),
);
$("#helpBtn").addEventListener("click", () => $("#help").showModal());
$("#helpBtn2").addEventListener("click", () => $("#help").showModal());
$("#helpClose").addEventListener("click", () => $("#help").close());
matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => {
  readColors();
  req();
});
new MutationObserver(() => {
  readColors();
  req();
}).observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });

export { shift, setMode, setHint, toastT, toast, updN };
