// Quadrature: Shape detection from a photo: thresholding, clean-up, marching squares, scale from a known length.
import { TAU } from "./constants.js";
import { toast } from "./controls.js";
import { $, $$ } from "./dom.js";
import { bbox, ringArea, ringSimple, ringsCross, signsOf } from "./geometry.js";
import { setRings, st } from "./state.js";

// ---------- shape from a photo ----------
const PH = {
  full: null,
  fw: 0,
  fh: 0,
  ww: 0,
  wh: 0,
  gray: null,
  mask: null,
  loops: [],
  thr: 128,
  dark: true,
  edge: true,
  keep: "all",
  A: null,
  B: null,
  marking: false,
  view: null,
  drag: null,
  ov: null,
};
const phCv = $("#phCv"),
  phCtx = phCv.getContext("2d"),
  phDlg = $("#photoDlg");
function phMsg(t) {
  $("#phMsg").textContent = t || "";
}
$("#photoBtn").addEventListener("click", () => {
  if (st.running) return;
  phDlg.showModal();
  requestAnimationFrame(phResize);
});
$("#phClose").addEventListener("click", () => phDlg.close());
$("#phFile").addEventListener("change", (e) => {
  const f = e.target.files && e.target.files[0];
  if (!f) return;
  phMsg("Reading the photo…");
  const rd = new FileReader();
  rd.onload = () => {
    const img = new Image();
    img.onload = () => phLoad(img);
    img.onerror = () => phMsg("That file could not be opened as an image. Try a JPEG or PNG.");
    img.src = rd.result;
  };
  rd.readAsDataURL(f);
  e.target.value = "";
});
function phLoad(img) {
  let r = Math.min(1, 1400 / Math.max(img.naturalWidth, img.naturalHeight));
  const full = document.createElement("canvas");
  full.width = Math.max(1, Math.round(img.naturalWidth * r));
  full.height = Math.max(1, Math.round(img.naturalHeight * r));
  full.getContext("2d").drawImage(img, 0, 0, full.width, full.height);
  r = Math.min(1, 400 / Math.max(full.width, full.height));
  const w = Math.max(2, Math.round(full.width * r)),
    h = Math.max(2, Math.round(full.height * r)),
    wk = document.createElement("canvas");
  wk.width = w;
  wk.height = h;
  const g = wk.getContext("2d");
  g.drawImage(full, 0, 0, w, h);
  const d = g.getImageData(0, 0, w, h).data;
  const raw = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++)
    raw[i] = 0.299 * d[4 * i] + 0.587 * d[4 * i + 1] + 0.114 * d[4 * i + 2];
  const gray = new Float32Array(w * h);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      let s = 0,
        c = 0;
      for (let dy = -1; dy <= 1; dy++)
        for (let dx = -1; dx <= 1; dx++) {
          const X = x + dx,
            Y = y + dy;
          if (X >= 0 && Y >= 0 && X < w && Y < h) {
            s += raw[Y * w + X];
            c++;
          }
        }
      gray[y * w + x] = s / c;
    }
  Object.assign(PH, {
    full,
    fw: full.width,
    fh: full.height,
    ww: w,
    wh: h,
    gray,
    A: null,
    B: null,
    marking: false,
  });
  // Otsu threshold
  const hist = new Array(256).fill(0);
  for (const v of gray) hist[Math.min(255, Math.max(0, Math.round(v)))]++;
  const N = w * h;
  let sum = 0;
  for (let i = 0; i < 256; i++) sum += i * hist[i];
  let sB = 0,
    wB = 0,
    best = 0,
    thr = 128;
  for (let i = 0; i < 256; i++) {
    wB += hist[i];
    if (!wB) continue;
    const wF = N - wB;
    if (!wF) break;
    sB += i * hist[i];
    const mB = sB / wB,
      mF = (sum - sB) / wF,
      v = wB * wF * (mB - mF) * (mB - mF);
    if (v > best) {
      best = v;
      thr = i;
    }
  }
  PH.thr = thr;
  // the background is usually what touches the photo's edges
  let bs = 0,
    bc = 0;
  for (let x = 0; x < w; x++) {
    bs += gray[x] + gray[(h - 1) * w + x];
    bc += 2;
  }
  for (let y = 0; y < h; y++) {
    bs += gray[y * w] + gray[y * w + w - 1];
    bc += 2;
  }
  PH.dark = bs / bc > thr;
  $("#phThr").value = thr;
  $("#phThrLbl").textContent = thr;
  $$("#phTone button").forEach((b) =>
    b.classList.toggle("on", (b.dataset.v === "dark") === PH.dark),
  );
  $("#phSteps").disabled = false;
  $("#phEmpty").hidden = true;
  phProcess();
  phScaleUI();
  phResize();
  phMsg("");
}
function phLabel(m, w, h, val) {
  const n = w * h,
    lab = new Int32Array(n).fill(-1),
    comps = [],
    stack = new Int32Array(n);
  for (let s = 0; s < n; s++) {
    if (m[s] !== val || lab[s] >= 0) continue;
    const id = comps.length;
    let top = 0,
      area = 0,
      edge = false;
    stack[top++] = s;
    lab[s] = id;
    while (top) {
      const i = stack[--top];
      area++;
      const x = i % w,
        y = (i - x) / w;
      if (x === 0 || y === 0 || x === w - 1 || y === h - 1) edge = true;
      if (x > 0 && m[i - 1] === val && lab[i - 1] < 0) {
        lab[i - 1] = id;
        stack[top++] = i - 1;
      }
      if (x < w - 1 && m[i + 1] === val && lab[i + 1] < 0) {
        lab[i + 1] = id;
        stack[top++] = i + 1;
      }
      if (y > 0 && m[i - w] === val && lab[i - w] < 0) {
        lab[i - w] = id;
        stack[top++] = i - w;
      }
      if (y < h - 1 && m[i + w] === val && lab[i + w] < 0) {
        lab[i + w] = id;
        stack[top++] = i + w;
      }
    }
    comps.push({ area, edge });
  }
  return { lab, comps };
}
function rdp(pts, eps) {
  if (pts.length < 4) return pts.slice();
  const keep = new Uint8Array(pts.length);
  keep[0] = keep[pts.length - 1] = 1;
  const st2 = [[0, pts.length - 1]];
  while (st2.length) {
    const [a, b] = st2.pop();
    const A = pts[a],
      B = pts[b],
      dx = B[0] - A[0],
      dy = B[1] - A[1],
      L = Math.hypot(dx, dy) || 1e-9;
    let md = 0,
      mi = -1;
    for (let i = a + 1; i < b; i++) {
      const d = Math.abs(dy * (pts[i][0] - A[0]) - dx * (pts[i][1] - A[1])) / L;
      if (d > md) {
        md = d;
        mi = i;
      }
    }
    if (md > eps && mi > 0) {
      keep[mi] = 1;
      st2.push([a, mi], [mi, b]);
    }
  }
  return pts.filter((_, i) => keep[i]);
}
function rdpClosed(loop, eps) {
  let far = 0,
    fd = -1;
  for (let i = 1; i < loop.length; i++) {
    const d = Math.hypot(loop[i][0] - loop[0][0], loop[i][1] - loop[0][1]);
    if (d > fd) {
      fd = d;
      far = i;
    }
  }
  const a = rdp(loop.slice(0, far + 1), eps),
    b = rdp(loop.slice(far).concat([loop[0]]), eps);
  return a.concat(b.slice(1, -1));
}
function phProcess() {
  const w = PH.ww,
    h = PH.wh,
    n = w * h,
    g = PH.gray,
    m = new Uint8Array(n),
    minA = Math.max(20, n * 0.002);
  for (let i = 0; i < n; i++) m[i] = PH.dark ? (g[i] < PH.thr ? 1 : 0) : g[i] > PH.thr ? 1 : 0;
  let { lab, comps } = phLabel(m, w, h, 1);
  const ok = comps.map((c) => c.area >= minA && !(PH.edge && c.edge));
  if (PH.keep === "largest") {
    let bi = -1;
    comps.forEach((c, i) => {
      if (ok[i] && (bi < 0 || c.area > comps[bi].area)) bi = i;
    });
    ok.fill(false);
    if (bi >= 0) ok[bi] = true;
  }
  for (let i = 0; i < n; i++) m[i] = m[i] && ok[lab[i]] ? 1 : 0;
  ({ lab, comps } = phLabel(m, w, h, 0));
  for (let i = 0; i < n; i++)
    if (!m[i]) {
      const c = comps[lab[i]];
      if (!c.edge && c.area < minA) m[i] = 1;
    }
  PH.mask = m;
  // smoothed field, padded by one empty pixel so every outline closes
  const W2 = w + 2,
    H2 = h + 2,
    F = new Float32Array(W2 * H2);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      let s = 0;
      for (let dy = -1; dy <= 1; dy++)
        for (let dx = -1; dx <= 1; dx++) {
          const X = x + dx,
            Y = y + dy;
          if (X >= 0 && Y >= 0 && X < w && Y < h) s += m[Y * w + X];
        }
      F[(y + 1) * W2 + x + 1] = s / 9;
    }
  // marching squares at level 0.5
  const adj = new Map(),
    pos = new Map();
  const hK = (x, y) => (y * W2 + x) * 2,
    vK = (x, y) => (y * W2 + x) * 2 + 1;
  const P = (k, x0, y0, x1, y1) => {
    if (!pos.has(k)) {
      const f0 = F[y0 * W2 + x0],
        f1 = F[y1 * W2 + x1],
        t = (0.5 - f0) / (f1 - f0);
      pos.set(k, [x0 + t * (x1 - x0), y0 + t * (y1 - y0)]);
    }
    return k;
  };
  const seg = (a, b) => {
    (adj.get(a) || adj.set(a, []).get(a)).push(b);
    (adj.get(b) || adj.set(b, []).get(b)).push(a);
  };
  for (let y = 0; y < H2 - 1; y++)
    for (let x = 0; x < W2 - 1; x++) {
      const c =
        (F[y * W2 + x] >= 0.5 ? 8 : 0) |
        (F[y * W2 + x + 1] >= 0.5 ? 4 : 0) |
        (F[(y + 1) * W2 + x + 1] >= 0.5 ? 2 : 0) |
        (F[(y + 1) * W2 + x] >= 0.5 ? 1 : 0);
      if (c === 0 || c === 15) continue;
      const T = () => P(hK(x, y), x, y, x + 1, y),
        B = () => P(hK(x, y + 1), x, y + 1, x + 1, y + 1),
        L = () => P(vK(x, y), x, y, x, y + 1),
        R = () => P(vK(x + 1, y), x + 1, y, x + 1, y + 1);
      switch (c) {
        case 1:
        case 14:
          seg(L(), B());
          break;
        case 2:
        case 13:
          seg(B(), R());
          break;
        case 3:
        case 12:
          seg(L(), R());
          break;
        case 4:
        case 11:
          seg(T(), R());
          break;
        case 5:
          seg(T(), R());
          seg(L(), B());
          break;
        case 6:
        case 9:
          seg(T(), B());
          break;
        case 7:
        case 8:
          seg(L(), T());
          break;
        case 10:
          seg(L(), T());
          seg(B(), R());
          break;
      }
    }
  const seen = new Set(),
    loops = [],
    fx = PH.fw / w,
    fy = PH.fh / h;
  for (const start of adj.keys()) {
    if (seen.has(start)) continue;
    const loop = [];
    let prev = -1,
      cur = start,
      guard = 0;
    do {
      seen.add(cur);
      const p = pos.get(cur);
      loop.push([(p[0] - 0.5) * fx, (p[1] - 0.5) * fy]);
      const nb = adj.get(cur);
      const nx = nb[0] !== prev ? nb[0] : nb[1];
      prev = cur;
      cur = nx;
    } while (cur !== start && cur !== undefined && ++guard < 1e6);
    if (loop.length >= 4 && Math.abs(ringArea(loop)) >= minA * 0.5 * fx * fy) loops.push(loop);
  }
  // simplify, keeping every outline simple and separate
  const eps = 0.6 * fx;
  let out = loops.map((l) => {
    for (const e of [eps, eps / 2]) {
      const s = rdpClosed(l, e);
      if (s.length >= 4 && ringSimple(s)) return s;
    }
    return l;
  });
  for (let i = 0; i < out.length; i++)
    for (let j = i + 1; j < out.length; j++)
      if (ringsCross(out[i], out[j])) {
        out[i] = loops[i];
        out[j] = loops[j];
      }
  PH.loops = out;
  const ov = document.createElement("canvas");
  ov.width = w;
  ov.height = h;
  const og = ov.getContext("2d"),
    id = og.createImageData(w, h);
  for (let i = 0; i < n; i++)
    if (m[i]) {
      id.data[4 * i] = 242;
      id.data[4 * i + 1] = 122;
      id.data[4 * i + 2] = 26;
      id.data[4 * i + 3] = 120;
    }
  og.putImageData(id, 0, 0);
  PH.ov = ov;
  const parts = out.filter((l, i) => signsOf(out)[i] > 0).length;
  $("#phFound").textContent = out.length
    ? `Found ${parts} part${parts === 1 ? "" : "s"} and ${out.length - parts} hole${out.length - parts === 1 ? "" : "s"}.`
    : "Nothing found. Move the threshold or switch darker/lighter.";
  $("#phUse").disabled = !out.length;
  phDraw();
}
function phResize() {
  if (!phDlg.open) return;
  const d = window.devicePixelRatio || 1;
  phCv.width = Math.max(10, Math.round(phCv.clientWidth * d));
  phCv.height = Math.max(10, Math.round(phCv.clientHeight * d));
  phDraw();
}
window.addEventListener("resize", phResize);
function phDraw() {
  const d = window.devicePixelRatio || 1,
    cw = phCv.width / d,
    ch = phCv.height / d;
  phCtx.setTransform(d, 0, 0, d, 0, 0);
  phCtx.clearRect(0, 0, cw, ch);
  if (!PH.full) return;
  const sc = Math.min(cw / PH.fw, ch / PH.fh),
    ox = (cw - PH.fw * sc) / 2,
    oy = (ch - PH.fh * sc) / 2;
  PH.view = { sc, ox, oy };
  phCtx.drawImage(PH.full, ox, oy, PH.fw * sc, PH.fh * sc);
  if (PH.ov && $("#phShowMask").checked) {
    phCtx.imageSmoothingEnabled = true;
    phCtx.drawImage(PH.ov, ox, oy, PH.fw * sc, PH.fh * sc);
  }
  phCtx.beginPath();
  for (const l of PH.loops) {
    l.forEach((p, k) =>
      k
        ? phCtx.lineTo(ox + p[0] * sc, oy + p[1] * sc)
        : phCtx.moveTo(ox + p[0] * sc, oy + p[1] * sc),
    );
    phCtx.closePath();
  }
  phCtx.lineJoin = "round";
  phCtx.strokeStyle = "#fff";
  phCtx.lineWidth = 4;
  phCtx.stroke();
  phCtx.strokeStyle = "#B8262F";
  phCtx.lineWidth = 2;
  phCtx.stroke();
  const pt = (p) => [ox + p[0] * sc, oy + p[1] * sc];
  if (PH.A) {
    const a = pt(PH.A),
      b = PH.B ? pt(PH.B) : null;
    if (b) {
      phCtx.beginPath();
      phCtx.moveTo(a[0], a[1]);
      phCtx.lineTo(b[0], b[1]);
      phCtx.strokeStyle = "#fff";
      phCtx.lineWidth = 5;
      phCtx.stroke();
      phCtx.strokeStyle = "#5B2A6E";
      phCtx.lineWidth = 2.5;
      phCtx.stroke();
    }
    for (const q of b ? [a, b] : [a]) {
      phCtx.beginPath();
      phCtx.arc(q[0], q[1], 8, 0, TAU);
      phCtx.fillStyle = "rgba(255,255,255,.55)";
      phCtx.fill();
      phCtx.lineWidth = 2.5;
      phCtx.strokeStyle = "#5B2A6E";
      phCtx.stroke();
      phCtx.beginPath();
      phCtx.moveTo(q[0] - 12, q[1]);
      phCtx.lineTo(q[0] + 12, q[1]);
      phCtx.moveTo(q[0], q[1] - 12);
      phCtx.lineTo(q[0], q[1] + 12);
      phCtx.lineWidth = 1.2;
      phCtx.stroke();
    }
    const dist = parseFloat($("#phDist").value);
    if (b && dist > 0) {
      phCtx.font = '700 12px "Space Mono",monospace';
      const tx = (a[0] + b[0]) / 2,
        ty = (a[1] + b[1]) / 2 - 12,
        t = dist + " cm",
        tw = phCtx.measureText(t).width;
      phCtx.fillStyle = "#5B2A6E";
      phCtx.fillRect(tx - tw / 2 - 5, ty - 12, tw + 10, 17);
      phCtx.fillStyle = "#fff";
      phCtx.fillText(t, tx - tw / 2, ty);
    }
  }
}
function phPt(e) {
  const r = phCv.getBoundingClientRect(),
    v = PH.view;
  return [(e.clientX - r.left - v.ox) / v.sc, (e.clientY - r.top - v.oy) / v.sc];
}
function phNear(e, p) {
  if (!p) return false;
  const r = phCv.getBoundingClientRect(),
    v = PH.view;
  return (
    Math.hypot(
      e.clientX - r.left - (v.ox + p[0] * v.sc),
      e.clientY - r.top - (v.oy + p[1] * v.sc),
    ) < 24
  );
}
phCv.addEventListener("pointerdown", (e) => {
  if (!PH.full || !PH.view) return;
  const p = phPt(e);
  if (phNear(e, PH.B)) PH.drag = "B";
  else if (phNear(e, PH.A)) PH.drag = "A";
  else if (PH.marking) {
    if (!PH.A) {
      PH.A = p;
      PH.drag = "A";
    } else if (!PH.B) {
      PH.B = p;
      PH.drag = "B";
    } else {
      PH.A = p;
      PH.B = null;
      PH.drag = "A";
    }
  } else return;
  phCv.setPointerCapture(e.pointerId);
  e.preventDefault();
  phDraw();
  phScaleUI();
});
phCv.addEventListener("pointermove", (e) => {
  if (!PH.drag) return;
  const p = phPt(e);
  p[0] = Math.max(0, Math.min(PH.fw, p[0]));
  p[1] = Math.max(0, Math.min(PH.fh, p[1]));
  PH[PH.drag] = p;
  phDraw();
  phScaleUI();
});
phCv.addEventListener("pointerup", () => {
  if (!PH.drag) return;
  PH.drag = null;
  if (PH.A && PH.B && PH.marking) {
    PH.marking = false;
    phScaleUI();
    const d = $("#phDist");
    if (!d.value) d.focus();
  }
});
function phScaleUI() {
  const b = $("#phMark");
  b.classList.toggle("on", PH.marking);
  b.lastChild.textContent = PH.marking
    ? PH.A && !PH.B
      ? "Now tap the other end"
      : "Tap one end of the length"
    : PH.A && PH.B
      ? "Mark again"
      : "Mark a known length";
  const dist = parseFloat($("#phDist").value),
    px = PH.A && PH.B ? Math.hypot(PH.B[0] - PH.A[0], PH.B[1] - PH.A[1]) : 0;
  $("#phScale").textContent =
    px && dist > 0
      ? `1 cm = ${(px / dist).toFixed(1)} px on the photo.`
      : px
        ? `Line length ${px.toFixed(0)} px. Type its real length.`
        : "No scale yet: the shape would be resized to 8 cm and its area would not be real.";
}
$("#phMark").addEventListener("click", () => {
  PH.marking = !PH.marking;
  if (PH.marking && PH.A && PH.B) {
    PH.A = PH.B = null;
  }
  phScaleUI();
  phDraw();
});
$("#phDist").addEventListener("input", () => {
  phScaleUI();
  phDraw();
});
$("#phThr").addEventListener("input", (e) => {
  PH.thr = +e.target.value;
  $("#phThrLbl").textContent = e.target.value;
  phProcess();
});
$("#phTone").addEventListener("click", (e) => {
  const b = e.target.closest("button");
  if (!b) return;
  PH.dark = b.dataset.v === "dark";
  $$("#phTone button").forEach((x) => x.classList.toggle("on", x === b));
  phProcess();
});
$("#phKeep").addEventListener("click", (e) => {
  const b = e.target.closest("button");
  if (!b) return;
  PH.keep = b.dataset.v;
  $$("#phKeep button").forEach((x) => x.classList.toggle("on", x === b));
  phProcess();
});
$("#phEdge").addEventListener("change", (e) => {
  PH.edge = e.target.checked;
  phProcess();
});
$("#phShowMask").addEventListener("change", phDraw);
$("#phUse").addEventListener("click", () => {
  if (!PH.loops.length) return;
  let b = [Infinity, Infinity, -Infinity, -Infinity];
  for (const l of PH.loops) {
    const q = bbox(l);
    b = [Math.min(b[0], q[0]), Math.min(b[1], q[1]), Math.max(b[2], q[2]), Math.max(b[3], q[3])];
  }
  const cx = (b[0] + b[2]) / 2,
    cy = (b[1] + b[3]) / 2,
    dist = parseFloat($("#phDist").value),
    px = PH.A && PH.B ? Math.hypot(PH.B[0] - PH.A[0], PH.B[1] - PH.A[1]) : 0;
  const scaled = px > 0 && dist > 0,
    k = scaled ? dist / px : 8 / Math.max(b[2] - b[0], b[3] - b[1]),
    ext = Math.max(b[2] - b[0], b[3] - b[1]) * k;
  if (ext > 40)
    return phMsg(
      `With this scale the shape is ${ext.toFixed(0)} cm across. Check the marked length and the distance you typed (the app handles shapes up to 40 cm).`,
    );
  if (ext < 0.3)
    return phMsg(
      `With this scale the shape is only ${ext.toFixed(2)} cm across. Check the marked length and the distance.`,
    );
  const rings = PH.loops.map((l) => l.map(([x, y]) => [(x - cx) * k, (y - cy) * k]));
  st.tx = st.ty = st.ang = 0;
  setRings(rings, "Photo", { cv: PH.full, ox: cx, oy: cy, k });
  phDlg.close();
  toast(
    scaled
      ? `Shape imported: ${ext.toFixed(1)} cm across.`
      : "Shape imported without a scale: resized to 8 cm, so its area is not real.",
  );
});

export {
  PH,
  phCv,
  phCtx,
  phDlg,
  phMsg,
  phLoad,
  phLabel,
  rdp,
  rdpClosed,
  phProcess,
  phResize,
  phDraw,
  phPt,
  phNear,
  phScaleUI,
};
