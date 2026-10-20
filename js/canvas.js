// Quadrature: Main canvas: camera, rendering of grid/cells/shape, pointer input (move and draw tools).
import { CX, CY, K } from "./constants.js";
import { toast } from "./controls.js";
import { $ } from "./dom.js";
import { ringArea, segX } from "./geometry.js";
import { validAdd } from "./shapes.js";
import { remeasure, setRings, st, sz, toLocal, toWorld } from "./state.js";

// ---------- canvas ----------
const cv = $("#cv"),
  ctx = cv.getContext("2d"),
  wrap = $("#wrap");
let dpr = 1,
  W = 300,
  H = 300,
  raf = 0,
  hatch = null;
const C = {};
function readColors() {
  const cs = getComputedStyle(document.documentElement);
  for (const k of [
    "surface",
    "ink",
    "muted",
    "inside",
    "count",
    "skip",
    "accent",
    "true",
    "gridline",
    "shapefill",
    "hatch",
  ])
    C[k] = cs.getPropertyValue("--" + k).trim();
  const h = document.createElement("canvas");
  h.width = h.height = 8;
  const g = h.getContext("2d");
  g.strokeStyle = C.hatch;
  g.lineWidth = 1.3;
  g.beginPath();
  g.moveTo(0, 8);
  g.lineTo(8, 0);
  g.moveTo(-2, 2);
  g.lineTo(2, -2);
  g.moveTo(6, 10);
  g.lineTo(10, 6);
  g.stroke();
  hatch = ctx.createPattern(h, "repeat");
}
const cam = { x: 5, y: 5, z: 30, tx: 5, ty: 5, tz: 30 };
function setCam(x, y, z, inst) {
  cam.tx = x;
  cam.ty = y;
  cam.tz = z;
  if (inst || matchMedia("(prefers-reduced-motion: reduce)").matches) {
    cam.x = x;
    cam.y = y;
    cam.z = z;
  }
  req();
}
function fitCam(inst) {
  let b = [Infinity, Infinity, -Infinity, -Infinity];
  for (const r of st.wr)
    b = [
      Math.min(b[0], r.bb[0]),
      Math.min(b[1], r.bb[1]),
      Math.max(b[2], r.bb[2]),
      Math.max(b[3], r.bb[3]),
    ];
  if (!isFinite(b[0])) b = [0, 0, 10, 10];
  const pad = Math.max(0.6, sz() * 1.2),
    m = Math.max(6, b[2] - b[0] + 2 * pad, b[3] - b[1] + 2 * pad);
  const w = m,
    h = m;
  setCam((b[0] + b[2]) / 2, (b[1] + b[3]) / 2, Math.min(W / (w * 1.08), H / (h * 1.08)), inst);
}
function focusCell(inst) {
  const M = st.man;
  if (!M || M.done) return;
  const c = st.auto.cells.get(M.list[M.idx]);
  const s = sz();
  const z = Math.min(W, H) / (5.5 * s);
  const off = $("#mcard").parentElement === wrap ? (H * 0.15) / z : 0;
  setCam((c.i + 0.5) * s, (c.j + 0.5) * s + off, z, inst);
}
function req() {
  if (!raf) raf = requestAnimationFrame(draw);
}
function stepCam() {
  const k = 0.2;
  cam.x += (cam.tx - cam.x) * k;
  cam.y += (cam.ty - cam.y) * k;
  cam.z *= Math.pow(cam.tz / cam.z, k);
  if (
    Math.abs(cam.tx - cam.x) * cam.z < 0.3 &&
    Math.abs(cam.ty - cam.y) * cam.z < 0.3 &&
    Math.abs(cam.tz / cam.z - 1) < 0.002
  ) {
    cam.x = cam.tx;
    cam.y = cam.ty;
    cam.z = cam.tz;
  } else req();
}
function resize() {
  const r = wrap.getBoundingClientRect();
  dpr = window.devicePixelRatio || 1;
  W = Math.max(50, cv.clientWidth);
  H = Math.max(50, cv.clientHeight);
  cv.width = Math.round(W * dpr);
  cv.height = Math.round(H * dpr);
  if (st.mode === "manual" && st.man && !st.man.done) focusCell(true);
  else fitCam(true);
  draw();
}
function view() {
  const A = st.auto,
    M = st.mode === "manual" && st.man ? st.man : null,
    states = new Map();
  let nIn = 0,
    nC = 0,
    nS = 0,
    nP = 0;
  for (const c of A.cells.values()) {
    let v = c.st;
    if (M && M.set.has(c.key)) v = M.dec.get(c.key) || "pending";
    states.set(c.key, v);
    if (v === "in") nIn++;
    else if (v === "count") nC++;
    else if (v === "skip") nS++;
    else if (v === "pending") nP++;
  }
  return { states, nMin: nIn, nB: nC + nS, nMax: nIn + nC + nS, nEst: nIn + nC, nP, manual: !!M };
}
let drawing = null,
  drag = null;
function draw() {
  raf = 0;
  stepCam();
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.fillStyle = C.surface;
  ctx.fillRect(0, 0, W, H);
  const z = cam.z,
    ox = W / 2 - cam.x * z,
    oy = H / 2 - cam.y * z,
    X = (x) => x * z + ox,
    Y = (y) => y * z + oy,
    s = sz(),
    V = view();
  const ringPath = () => {
    ctx.beginPath();
    for (const r of st.wr) {
      r.pts.forEach((p, k) => (k ? ctx.lineTo(X(p[0]), Y(p[1])) : ctx.moveTo(X(p[0]), Y(p[1]))));
      ctx.closePath();
    }
  };
  if (st.photo && st.layers.photo) {
    const P = st.photo;
    ctx.save();
    ctx.translate(X(CX + st.tx), Y(CY + st.ty));
    ctx.rotate(st.ang);
    ctx.scale(z * P.k, z * P.k);
    ctx.globalAlpha = 0.6;
    ctx.drawImage(P.cv, -P.ox, -P.oy);
    ctx.restore();
  }
  ringPath();
  ctx.fillStyle = C.shapefill;
  ctx.fill("evenodd");
  for (const c of st.auto.cells.values()) {
    const v = V.states.get(c.key);
    let f = null;
    if (v === "in" && st.layers.in) f = C.inside;
    else if (v === "count" && st.layers.count) f = C.count;
    else if (v === "skip" && st.layers.skip) f = C.skip;
    else if (v === "pending") f = hatch;
    if (!f) continue;
    const x0 = Math.round(X(c.i * s)),
      y0 = Math.round(Y(c.j * s)),
      x1 = Math.round(X((c.i + 1) * s)),
      y1 = Math.round(Y((c.j + 1) * s));
    ctx.globalAlpha = v === "pending" ? 1 : 0.8;
    ctx.fillStyle = f;
    ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
  }
  ctx.globalAlpha = 1;
  if (s * z >= 4) {
    const wx0 = -ox / z,
      wx1 = (W - ox) / z,
      wy0 = -oy / z,
      wy1 = (H - oy) / z;
    ctx.beginPath();
    for (let i = Math.floor(wx0 / s); i <= Math.ceil(wx1 / s); i++) {
      const x = Math.round(X(i * s)) + 0.5;
      ctx.moveTo(x, 0);
      ctx.lineTo(x, H);
    }
    for (let j = Math.floor(wy0 / s); j <= Math.ceil(wy1 / s); j++) {
      const y = Math.round(Y(j * s)) + 0.5;
      ctx.moveTo(0, y);
      ctx.lineTo(W, y);
    }
    ctx.strokeStyle = C.gridline;
    ctx.lineWidth = 1;
    ctx.stroke();
  }
  if (st.layers.lines) {
    stair(V, false, X, Y, s);
    stair(V, true, X, Y, s);
  }
  ringPath();
  ctx.lineWidth = 2.5;
  ctx.lineJoin = "round";
  ctx.strokeStyle = C.ink;
  ctx.stroke();
  const M = st.mode === "manual" ? st.man : null;
  if (M && !M.done) {
    const c = st.auto.cells.get(M.list[M.idx]);
    const x0 = X(c.i * s),
      y0 = Y(c.j * s),
      w = s * z;
    ctx.lineWidth = 8;
    ctx.strokeStyle = C.surface;
    ctx.strokeRect(x0, y0, w, w);
    ctx.lineWidth = 4;
    ctx.strokeStyle = C.true;
    ctx.strokeRect(x0, y0, w, w);
  }
  if (M && M.done && st.showMis) {
    ctx.strokeStyle = C.true;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    for (const key of M.list) {
      if (M.dec.get(key) !== st.auto.cells.get(key).st) {
        const c = st.auto.cells.get(key),
          cx = X((c.i + 0.5) * s),
          cy = Y((c.j + 0.5) * s),
          r = Math.min(s * z * 0.3, 9);
        ctx.moveTo(cx - r, cy - r);
        ctx.lineTo(cx + r, cy + r);
        ctx.moveTo(cx + r, cy - r);
        ctx.lineTo(cx - r, cy + r);
      }
    }
    ctx.stroke();
  }
  if (drawing && drawing.pts.length > 1) {
    ctx.beginPath();
    drawing.pts.forEach((p, k) => {
      const w = toWorld(p);
      k ? ctx.lineTo(X(w[0]), Y(w[1])) : ctx.moveTo(X(w[0]), Y(w[1]));
    });
    ctx.lineWidth = 3;
    ctx.strokeStyle = drawing.bad ? C.true : C.inside;
    ctx.setLineDash(drawing.bad ? [6, 4] : []);
    ctx.stroke();
    ctx.setLineDash([]);
  }
  // scale bar
  let L = [0.1, 0.2, 0.5, 1, 2, 5].find((v) => v * z >= 50) || 5;
  const bx = 12,
    by = H - 14,
    bw = L * z;
  if (!(M && !M.done)) {
    ctx.strokeStyle = C.ink;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(bx, by - 5);
    ctx.lineTo(bx, by);
    ctx.lineTo(bx + bw, by);
    ctx.lineTo(bx + bw, by - 5);
    ctx.stroke();
    ctx.fillStyle = C.ink;
    ctx.font = '700 11px "Space Mono",monospace';
    ctx.fillText(L < 1 ? Math.round(L * 10) + " mm" : L + " cm", bx + bw + 6, by + 1);
  }
}
function stair(V, isMax, X, Y, s) {
  const ok = (v) =>
    isMax ? v === "in" || v === "count" || v === "skip" || v === "pending" : v === "in";
  const has = (i, j) => {
    const v = V.states.get(K(i, j));
    return v !== undefined && ok(v);
  };
  ctx.beginPath();
  for (const c of st.auto.cells.values()) {
    if (!has(c.i, c.j)) continue;
    const x0 = Math.round(X(c.i * s)),
      x1 = Math.round(X((c.i + 1) * s)),
      y0 = Math.round(Y(c.j * s)),
      y1 = Math.round(Y((c.j + 1) * s));
    if (!has(c.i - 1, c.j)) {
      ctx.moveTo(x0, y0);
      ctx.lineTo(x0, y1);
    }
    if (!has(c.i + 1, c.j)) {
      ctx.moveTo(x1, y0);
      ctx.lineTo(x1, y1);
    }
    if (!has(c.i, c.j - 1)) {
      ctx.moveTo(x0, y0);
      ctx.lineTo(x1, y0);
    }
    if (!has(c.i, c.j + 1)) {
      ctx.moveTo(x0, y1);
      ctx.lineTo(x1, y1);
    }
  }
  ctx.setLineDash(isMax ? [7, 4] : []);
  ctx.lineWidth = 2;
  ctx.strokeStyle = C.ink;
  ctx.stroke();
  ctx.setLineDash([]);
}

// ---------- pointer ----------
const scr2w = (e) => {
  const r = cv.getBoundingClientRect();
  return [
    (e.clientX - r.left - W / 2) / cam.z + cam.x,
    (e.clientY - r.top - H / 2) / cam.z + cam.y,
  ];
};
cv.addEventListener("pointerdown", (e) => {
  if (st.mode === "manual" || st.running) return;
  const w = scr2w(e);
  if (st.tool === "move") {
    st.prevBand = null;
    drag = { x: w[0], y: w[1], tx: st.tx, ty: st.ty };
  } else
    drawing = {
      kind: st.tool,
      pts: [toLocal(w)],
      bad: false,
      tf: { tx: st.tx, ty: st.ty, ang: st.ang },
    };
  cv.setPointerCapture(e.pointerId);
  e.preventDefault();
});
cv.addEventListener("pointermove", (e) => {
  if (drag) {
    const w = scr2w(e);
    st.tx = drag.tx + w[0] - drag.x;
    st.ty = drag.ty + w[1] - drag.y;
    remeasure(false);
    return;
  }
  if (!drawing) return;
  const p = toLocal(scr2w(e)),
    P = drawing.pts,
    last = P[P.length - 1];
  if (Math.hypot(p[0] - last[0], p[1] - last[1]) < 0.06) return;
  let bad = false;
  for (let k = 0; k < P.length - 2 && !bad; k++) if (segX(last, p, P[k], P[k + 1])) bad = true;
  if (!bad && drawing.kind !== "draw")
    for (const r of st.rings) {
      for (let k = 0, n = r.length; k < n; k++)
        if (segX(last, p, r[k], r[(k + 1) % n])) {
          bad = true;
          break;
        }
      if (bad) break;
    }
  drawing.bad = bad;
  if (!bad) P.push(p);
  req();
});
const endPtr = () => {
  if (drag) {
    drag = null;
    fitCam();
    return;
  }
  if (drawing) finishDraw();
};
cv.addEventListener("pointerup", endPtr);
cv.addEventListener("pointercancel", () => {
  drag = null;
  drawing = null;
  req();
});
function finishDraw() {
  const d = drawing;
  drawing = null;
  req();
  const p = d.pts,
    n = p.length;
  if (n < 8) return toast("Draw a longer closed outline.");
  for (let k = 1; k < n - 2; k++)
    if (segX(p[n - 1], p[0], p[k], p[k + 1]))
      return toast("Closing the outline would cross the border. End closer to where you started.");
  if (Math.abs(ringArea(p)) < 0.08) return toast("That outline is too small.");
  if (d.kind === "draw") {
    const ring = p.map((q) => {
      const w = toWorldWith(q, d.tf);
      return [w[0] - CX, w[1] - CY];
    });
    st.tx = st.ty = st.ang = 0;
    setRings([ring], "Custom");
    return;
  }
  const err = validAdd(p, st.rings, d.kind);
  if (err) return toast(err);
  setRings([...st.rings, p], st.photo ? "Photo" : "Custom", st.photo);
}
function toWorldWith(p, tf) {
  tf = tf || st;
  const c = Math.cos(tf.ang),
    s = Math.sin(tf.ang);
  return [c * p[0] - s * p[1] + CX + tf.tx, s * p[0] + c * p[1] + CY + tf.ty];
}

export {
  cv,
  ctx,
  wrap,
  C,
  readColors,
  cam,
  setCam,
  fitCam,
  focusCell,
  req,
  stepCam,
  resize,
  view,
  drawing,
  drag,
  draw,
  stair,
  scr2w,
  endPtr,
  finishDraw,
  toWorldWith,
};
