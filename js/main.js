// Quadrature: Entry point: initialisation and responsive arrangement.
import { focusCell, readColors, req, resize, wrap } from "./canvas.js";
import { setHint, updN } from "./controls.js";
import { $ } from "./dom.js";
import { signsOf } from "./geometry.js";
import { updateMeasure } from "./panel.js";
import { load, updateSeries } from "./series.js";
import { LIB } from "./shapes.js";
import { remeasure, st, syncSelect } from "./state.js";
import "./constants.js";
import "./measure.js";
import "./manual.js";
import "./format.js";
import "./numberline.js";
import "./photo.js";

// ---------- init ----------
const sel = $("#shapeSel");
sel.innerHTML =
  Object.keys(LIB)
    .map((k) => `<option value="${k}">${k}</option>`)
    .join("") + '<option value="__custom" disabled>Random, drawn or photo</option>';
$("#nRange").value = st.nIdx;
updN();
$("#thrRange").value = 50;
$("#thrLbl").textContent = "50%";
load();
readColors();
st.rings = LIB.Leaf();
st.signs = signsOf(st.rings);
syncSelect();
remeasure(false);
setHint();
updateMeasure();
updateSeries();
const mqC = matchMedia(
  "(max-width:920px) and (orientation:portrait), (max-height:600px) and (orientation:landscape)",
);
function arrange() {
  const gb = $(".gridbar"),
    mc = $("#mcard"),
    panel = $(".panel"),
    gc = $("#gridCtl");
  if (mqC.matches) {
    $("#headSlot").appendChild(gc);
    $("#pane-measure").insertBefore(gb, $("#nl"));
    panel.insertBefore(mc, panel.firstChild);
  } else {
    gb.insertBefore(gc, gb.firstChild);
    $(".stage").appendChild(gb);
    wrap.appendChild(mc);
  }
  if (st.mode === "manual" && st.man && !st.man.done) focusCell(true);
}
mqC.addEventListener("change", arrange);
arrange();
new ResizeObserver(resize).observe(wrap);
resize();
if (document.fonts) document.fonts.ready.then(() => req());
