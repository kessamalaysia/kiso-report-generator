# Asset Condition Appraisal — Report Generator 

A local, no-backend web app that fills the Columbia Asia **Asset Condition
Appraisal** / **Technical Report** PDF template from a web form, so the
original PDF is never edited by hand.

## Quick start

1. Unzip the project (keep the folder structure intact).
2. Open `index.html` in a modern browser (Chrome, Edge, Firefox). No build
   step, no server required — everything runs client-side.
   - The page loads Bootstrap, pdf-lib, and PDF.js from a CDN, so an internet
     connection is needed the first time you open it (for those libraries
     only — your report data always stays on your machine).
3. Click **New Report**, fill in the tabs, then **Generate Report** to
   preview the filled PDF, and **Download PDF** to save it.

## How it works

- `template.pdf` is the original, untouched two-page form.
- `fieldmap.js` stores the x/y position of every fillable cell, checkbox,
  and blank line on both pages, measured directly from the template.
- `pdfgen.js` uses **pdf-lib** to open `template.pdf` and draw your form data
  on top of it at those exact positions — the template layout itself is
  never redrawn or altered.
- `script.js` runs the dashboard, the multi-tab editor, the observation
  checklist (with automatic "/" placement and strike-through for row 2's
  condition options), recommendation rows, auto-calculations, and the
  PDF.js-based preview.
- Reports are saved to your browser's `localStorage`, so drafts persist
  between visits on the same device/browser. Use **Save Draft** to save
  without generating a PDF, and the JSON export/import buttons to move a
  report between browsers or back it up outside localStorage.

## Project structure

```
/
├── index.html          Dashboard + editor + preview UI
├── style.css            Styling, dark mode
├── script.js             App logic, localStorage CRUD, calculations
├── fieldmap.js           Coordinate map onto template.pdf
├── pdfgen.js              pdf-lib overlay/generation engine
├── template.pdf            Original 2-page form (never modified)
├── assets/
│   ├── logo/                Placeholder brand mark (see note below)
│   └── fonts/                (reserved — Helvetica/HelveticaBold are
│                                 built into pdf-lib, no font files needed)
└── output/                     (empty — downloaded PDFs go to your
                                    browser's normal Downloads folder,
                                    this folder is just reserved for
                                    anyone who wants to script batch
                                    exports locally)
```

## Calibration note

Every coordinate in `fieldmap.js` was measured by rendering `template.pdf`
at 150 DPI and reading pixel positions off the image, then converting to
PDF points. This gets the overlay very close to the original layout, but a
few fields (especially the row‑2 strike-through boundaries, and the free‑text
boxes on the Technical Report page) were estimated from the rendered image
rather than the PDF's internal geometry, so they may be a point or two off.
If you spot a field that needs a nudge, open `fieldmap.js` — every entry is
a plain `{ x, y }` pixel pair (in the same 1241×1754px space as a 150 DPI
render of the template) with a comment explaining the conversion, so you can
adjust a single number and reload.

## Data & privacy

Everything (reports, drafts, and the generated PDF) is created and stored
locally in your browser. Nothing is uploaded anywhere.

## Logo

`assets/logo/columbia-asia-logo.svg` is a generic placeholder wordmark, not
the real Columbia Asia trademark — replace it with your organisation's own
logo file (keep the filename or update the `<img>` `src` in `index.html`).
