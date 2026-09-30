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

Draw each seam by clicking two endpoints. Select a seam to delete it, or use Undo/Redo. Import a reference image to trace, change the finished dimensions, select Letter or A4, and download the PDF. The reference image is excluded from the PDF.

Projects are saved in this browser's local storage. Use **Save a copy** to download a `.quiltstudio` file as a backup or to move it between computers; **Open project** loads it again. Existing version 1 Windows projects are supported when their geometry is within the browser prototype's limits (1–60 inches per dimension, up to 100 blocks and 5,000 seams per block). PNG, JPEG, BMP, and WebP references are supported; convert TIFF references before using them in a browser. Storage and imported images stay on your device; there is no login or cloud sync.

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

On Linux, Playwright may also need system libraries (`npx playwright install --with-deps chromium`). In this cloud environment, Chromium is already installed; use:

```sh
PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium npm run test:browser
```

GitHub Actions runs the unit/PDF tests, production build, and browser tests for pushes and pull requests.

## What the prototype verifies

- Vector PDFs use **72 points per inch**, independent of screen size or browser zoom.
- The foundation is mirrored horizontally, with a ¼-inch allowance around the finished block.
- Letter and A4 paper sizes retain their physical dimensions.
- Oversize patterns tile with ¼-inch overlap, page coordinates, and alignment guides.
- Every sheet includes an exact 1-inch calibration square and print-scale instructions.

This milestone exports **seam templates**. It does not yet detect closed pieces, label A1/A2/etc., split a design into sewable sections, or validate sewing order. A drawing is not automatically a sewable FPP pattern. Fabric matching and the quilt composer remain in the original Windows prototype and have not yet been ported.

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
