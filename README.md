# Quadrature

Measure the area of an irregular shape by counting the squares of a grid laid over it, and see how the uncertainty depends on the grid, on the counting rule and on where the shape happens to fall.

Built with vanilla JavaScript (ES modules), no build step and no dependencies. Fonts: Space Mono and Material Symbols from Google Fonts.

Vibecoded with Claude, with <3. 

## What it does

- **Automatic count.** Every grid square is classified with its exact coverage:
  - $A_{min}$: squares fully inside the shape
  - $A_{border}$: squares crossed by the border
  - $A_{max} = A_{min} + A_{border}$
  - $\bar A = (A_{min} + A_{max})/2$, $\delta = (A_{max} - A_{min})/2$, result $\bar A \pm \delta$
  - $A_{est}$: inside squares plus border squares covered at least as much as a chosen threshold (50% by default)
- **Number lines.** A detailed one, plus a mini line with a fixed scale starting at 0, so the interval visibly shrinks as the grid gets finer. A dashed outline shows the interval of the previous grid.
- **Shapes.** A library of shapes, random shapes (with holes and separate parts), freehand drawing with Part and Hole tools. Borders can never cross themselves or each other.
- **Manual mode.** The view zooms to each border square in turn and the student decides whether to count it. Borderline squares (coverage below 5% or above 95%) also ask whether they belong to $A_{min}$ or $A_{max}$. At the end, crosses mark disagreements with the automatic count.
- **Series.** Repeat the measurement with the shape shifted and rotated under the grid. Table, mean, standard deviation, $\sigma/\sqrt N$, semi-dispersion, histogram with a Gaussian of the same mean and $\sigma$, dot strip, CSV export to the clipboard.
- **Shape from a photo.** Brightness threshold (automatic, adjustable), clean-up of specks and small holes, outline extraction (marching squares), scale set by marking a known length on the photo.
- **Exact area.** Hidden by default; reveal it to compare with the measurements and expose systematic errors.
- Responsive layout for desktop, phones in portrait and short landscape screens; light and dark themes.

## Run it locally

ES modules do not load from `file://`, so opening `index.html` by double-clicking it shows a blank page. Serve the folder instead, for example:

```bash
cd quadrature
python3 -m http.server 8000
```

then open <http://localhost:8000>. Any static server works (for example the Live Server extension of VS Code).

## Publish with GitHub Pages

1. Push the repository to GitHub.
2. In the repository, open **Settings → Pages**.
3. Under **Build and deployment**, choose **Deploy from a branch**, branch `main`, folder `/ (root)`.
4. After a minute the app is live at `https://<user>.github.io/<repository>/`.

## Project structure

```
index.html          markup: toolbar, canvas, panels, dialogs
css/style.css       all styles, theme tokens, responsive layouts
js/
  main.js           entry point: initialisation, responsive arrangement
  dom.js            $ and $$ helpers
  constants.js      world centre, grid sizes, ambiguity threshold, cell keys
  geometry.js       pure polygon geometry: area, point in polygon, intersections,
                    clipping, grid traversal, nesting signs
  shapes.js         shape library, random shapes, validation of parts and holes
  measure.js        the counting algorithm (exact coverage of every square)
  state.js          application state, coordinate transforms, re-measure pipeline
  canvas.js         camera, rendering, pointer input (move and draw tools)
  manual.js         manual counting mode
  format.js         rounding of results, axis ticks, label placement
  numberline.js     detailed number line and fixed-scale mini line
  panel.js          measure panel: result, table, actions
  series.js         repeated measurements, statistics and plots
  controls.js       toolbar, sliders, tabs, mode switching, messages
  photo.js          shape detection from a photo
```

`geometry.js`, `shapes.js` and `measure.js` do not touch the DOM and can be reused or tested on their own.

### How the counting works

Each ring of the shape is walked edge by edge across the grid (Amanatides–Woo traversal) to find the squares the border crosses. For each of those, every ring is clipped to the square (Sutherland–Hodgman) and the signed areas are summed, holes counting negatively, which gives the exact covered fraction. Squares the border does not touch are classified by a scanline even-odd test on their centres.

## Data

The series is saved in the browser's `localStorage` (key `quadrature.series.v1`) and never leaves the device.

## License

No license has been chosen yet. Add a `LICENSE` file before sharing the repository publicly if you want others to be allowed to reuse the code (MIT is a common choice for small educational tools).
