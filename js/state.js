// Quadrature: Application state, coordinate transforms and the re-measure pipeline.
import { fitCam, req } from "./canvas.js";
import { CX, CY, NS } from "./constants.js";
import { toast } from "./controls.js";
import { $ } from "./dom.js";
import { bbox, ringArea, signsOf } from "./geometry.js";
import { renderCard, startManual } from "./manual.js";
import { measure } from "./measure.js";
import { updateMeasure } from "./panel.js";
import { LIB } from "./shapes.js";

// ---------- state ----------
const st = {
  shape: "Leaf",
  rings: [],
  signs: [],
  tx: 0,
  ty: 0,
  ang: 0,
  nIdx: 4,
  thr: 0.5,
  tool: "move",
  reveal: false,
  mode: "auto",
  layers: { in: true, count: true, skip: true, lines: true, photo: true },
  photo: null,
  undo: [],
  prevBand: null,
  wr: [],
  auto: null,
  man: null,
  series: [],
  sVar: "est",
  running: false,
  showMis: true,
};
const sz = () => 10 / NS[st.nIdx];
function toWorld(p) {
  const c = Math.cos(st.ang),
    s = Math.sin(st.ang);
  return [c * p[0] - s * p[1] + CX + st.tx, s * p[0] + c * p[1] + CY + st.ty];
}
function toLocal(w) {
  const x = w[0] - CX - st.tx,
    y = w[1] - CY - st.ty,
    c = Math.cos(st.ang),
    s = Math.sin(st.ang);
  return [c * x + s * y, -s * x + c * y];
}
function trueArea() {
  return st.rings.reduce((a, r, i) => a + st.signs[i] * Math.abs(ringArea(r)), 0);
}
function buildWorld() {
  st.wr = st.rings.map((r, i) => {
    const pts = r.map(toWorld);
    return { pts, sign: st.signs[i], bb: bbox(pts) };
  });
}
function remeasure(restartManual) {
  buildWorld();
  st.auto = measure(st.wr, sz(), st.thr);
  const s2 = sz() * sz(),
    need = Math.max(st.auto.nMax * s2, trueArea());
  if (st.scaleMax == null || need > st.scaleMax) {
    const c = measure(st.wr, 10 / NS[0], st.thr);
    st.scaleMax = niceCeil(Math.max(need, c.nMax * Math.pow(10 / NS[0], 2)) * 1.02);
  }
  if (st.mode === "manual" && restartManual) startManual();
  updateMeasure();
  renderCard();
  req();
}
function niceCeil(v) {
  if (!(v > 0)) return 1;
  const p = Math.pow(10, Math.floor(Math.log10(v)));
  for (const m of [1, 1.2, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10]) if (m * p >= v - 1e-9) return m * p;
  return 10 * p;
}
function setRings(rings, name, photo = null) {
  st.scaleMax = null;
  st.prevBand = null;
  st.undo.push({ rings: st.rings, shape: st.shape, photo: st.photo });
  st.photo = photo;
  $("#lgPhoto").hidden = !photo;
  if (st.undo.length > 40) st.undo.shift();
  st.rings = rings;
  st.signs = signsOf(rings);
  st.shape = name;
  syncSelect();
  if (st.series.length && st.series[st.series.length - 1].shape !== name)
    toast("New shape: the series still holds the old one. Clear it to start fresh.");
  remeasure(true);
  if (!(st.mode === "manual" && st.man && !st.man.done)) fitCam();
}
function syncSelect() {
  const sel = $("#shapeSel");
  sel.value = LIB[st.shape] ? st.shape : "__custom";
}

export {
  st,
  sz,
  toWorld,
  toLocal,
  trueArea,
  buildWorld,
  remeasure,
  niceCeil,
  setRings,
  syncSelect,
};
