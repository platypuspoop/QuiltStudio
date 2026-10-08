# QuiltStudio

A browser prototype for designing foundation paper piecing (FPP) seam templates and exporting PDFs at actual size. The original C# Windows prototype 0.02 is preserved in `src/`.

## Try the print milestone first

You can test the output before installing anything:

1. Download [the print scale check PDF](examples/print-scale-check-letter.pdf). On GitHub, open the file and choose **Download raw file**.
2. Open it in a PDF reader. Choose US Letter paper and **Actual size / 100%**. Disable **Fit**, **Shrink**, and any printer-driver scaling.
3. Print one sheet. Measure both sides of the calibration square: each must be exactly **1 inch (25.4 mm)**. The horizontal seam must measure **2 inches**.
4. If those measurements are wrong, resolve the PDF-reader or printer scaling before sewing. The PDF contains exact physical dimensions; printer behavior still needs this paper test.
5. Try the 12-inch sample on [US Letter](examples/first-light-letter.pdf) or [A4](examples/first-light-a4.pdf). Each is four sheets. Align repeated geometry using the ¼-inch overlap. The assembled finished outline must measure 12 × 12 inches; the outside cutting outline is 12½ × 12½ inches.

Full instructions: [Print calibration and tile assembly](docs/PRINTING.md).

## Run the browser app on your computer

Install [Node.js 24 LTS](https://nodejs.org/) and [Git](https://git-scm.com/downloads). Then open a terminal and run:

```sh
git clone https://github.com/platypuspoop/QuiltStudio.git
cd QuiltStudio
npm ci
npm run dev
```

Open the address printed by the development server. Changes to `web/` update the app automatically. Stop it with **Ctrl+C**.

Start on a block edge or existing seam and drag toward another boundary (two-click drafting also works). Lines stop at the first seam unless **Continue through lines** is enabled. Right-click a seam to delete its whole stroke, or select it and use Delete. Undo/Redo also restores deletions and confirmed Clear operations. Import a reference image to trace, change the finished dimensions, select Letter or A4, and download the PDF. The reference image is excluded from the PDF.

Projects are saved in this browser's local storage. Use **Save a copy** to download a `.quiltstudio` file as a backup or to move it between computers; **Open project** loads it again. Existing version 1 Windows projects are supported when their geometry is within the browser prototype's limits (1–240 inches per dimension, up to 100 blocks and 5,000 seams per block). PNG, JPEG, BMP, and WebP references are supported; convert TIFF references before using them in a browser. Storage and imported images stay on your device; there is no login or cloud sync.

## Make the browser version available online

This repository includes a GitHub Pages deployment workflow. A repository owner can enable it:

1. Open the repository's **Settings → Pages**.
2. Under **Build and deployment → Source**, select **GitHub Actions**.
3. Open **Actions → Deploy browser prototype → Run workflow**, using `main`.
4. Wait for deployment to finish. GitHub displays the published website address in Pages settings and in the deployment run.

After that, web changes pushed to `main` trigger a new deployment. The workflow builds and tests the PDF exporter before publishing. GitHub Pages availability depends on your repository visibility and GitHub plan. Relative asset paths support project Pages sites.

## Develop in small steps

Describe one change, implement it, try it in the browser, run the checks, and commit the result. GitHub keeps the history so you can revisit earlier versions.

```sh
npm test          # PDF scale, mirroring, tiling, and project-file tests
npm run build    # Production build, written to dist/
```

For browser interaction tests on your own machine:

```sh
npx playwright install chromium
npm run test:browser
```

On Linux, Playwright may also need system libraries (`npx playwright install --with-deps chromium`). An existing compatible Chromium can be used with `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH`.

GitHub Actions runs the unit/PDF tests, production build, and browser tests for pushes and pull requests.

## What the prototype verifies

- Vector PDFs use **72 points per inch**, independent of screen size or browser zoom.
- Each lettered foundation prints separately, mirrored horizontally, with a joined ¼-inch outline around its perimeter only.
- Letter and A4 paper sizes retain their physical dimensions.
- Oversize patterns tile with ¼-inch overlap, page coordinates, and alignment guides.
- Every sheet includes an exact 1-inch calibration square and print-scale instructions.

## Drafting, pieces, and fabric colors

- **Automatic sections:** a starting pair gets numbers 1/2; straight attachments get the next numbers. A second independent bisector starts a new section. This is a drafting heuristic, not a guarantee of sewability.
- **Manual corrections:** select a piece in **Pieces & Colors**, enter a label such as B1 or A4, and apply it. Occupied labels exchange places. **Apply letter to whole section** renames all its pieces (exchanging letters if the target exists). **Recalculate automatic labels** removes overrides while retaining colors.
- **Colors:** choose a fabric color, enable **Paint pieces**, and click a piece. Colors appear in the design and repeated/mirrored quilt preview. Export adds a numbered, colored box below each label and a fabric key. Codes rank colors by the number of pieces using them; ties sort by hex code. These are chosen colors, not fabric-brand matches.
- **Curves:** choose Curve, Half circle, or Quarter circle; click two anchored endpoints, then a bend point/side. Curves use connected chords with at most 0.003-inch chord error. They create closed pieces and support intersections, colors, symmetry, undo, and export. Curved seams require curved piecing; they are not validated as straight-seam FPP.
- **Drawing symmetry:** horizontal/vertical axis toggles mirror new strokes in one undo operation. Quilt-layout mirroring in step 3 remains a separate control.
- **Printing:** use the Foundation section selector to inspect each mirrored template. Only section perimeter edges receive seam allowance, including all external sides of a rectangle. Internal A1/A2/etc. seams stay solid with no added allowance. Disconnected sections, floating fragments, and self-intersecting offset outlines must be corrected before export.

Labels and colors are included in project files and browser saves. Resizing preserves them; subdivided pieces inherit their parent's color. Deleting a seam also removes dependent dangling fragments; Undo restores the whole snapshot. Old bundled example PDFs still demonstrate the earlier whole-block scale milestone. New exports use separate foundations. Physical printing and sewing-order review remain necessary.

## Where things live

| Location | Purpose |
| --- | --- |
| `web/main.js`, `web/style.css` | Browser interface and editor |
| `web/pattern.js` | Physical dimensions, tiling, mirroring, project validation |
| `web/pdf.js` | Printable vector PDF output |
| `tests/` | PDF/core tests and browser tests |
| `examples/` | PDFs you can print to verify scale |
| `src/`, `QuiltStudio.sln` | Original Windows app and C# core |
| `docs/WINDOWS_PROTOTYPE.md` | Original 0.02 documentation |
| `docs/ROADMAP.md` | Earlier desktop roadmap |

Start with [the browser milestones](docs/WEB_ROADMAP.md). Windows build requirements are documented separately; .NET is not needed for the browser app.
