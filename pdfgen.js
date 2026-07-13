/**
 * pdfgen.js
 * ------------------------------------------------------------------
 * Loads the original template.pdf and draws the report data on top
 * of it at the coordinates defined in fieldmap.js. Never redraws or
 * replaces the template — only overlays values, ticks, and strike
 * -through marks exactly where the printed form expects them.
 * ------------------------------------------------------------------
 */

const OBS_FONT_SIZE = 8.2;
const BASE_FONT_SIZE = 9;
const SMALL_FONT_SIZE = 7.6;

/**
 * Build a completed PDF (Uint8Array) from a report data object.
 * @param {Object} data - report form data (see script.js STATE schema)
 * @returns {Promise<Uint8Array>}
 */
async function generateReportPdf(data) {
  const { PDFDocument, rgb, StandardFonts } = PDFLib;

  const templateBytes = await fetch('template.pdf').then((r) => {
    if (!r.ok) throw new Error('Could not load template.pdf');
    return r.arrayBuffer();
  });

  const pdfDoc = await PDFDocument.load(templateBytes);
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const [page1, page2] = pdfDoc.getPages();
  const black = rgb(0.05, 0.05, 0.08);

  drawPage1(page1, font, fontBold, black, data);
  drawPage2(page2, font, fontBold, black, data);

  return pdfDoc.save();
}

/* ------------------------------------------------------------------ */
/* Shared drawing helpers                                              */
/* ------------------------------------------------------------------ */

function toPt(px, py) {
  return pxToPt(px, py);
}

/**
 * PDF text is drawn with `y` as the BASELINE, and glyphs extend upward
 * from it. Every coordinate in fieldmap.js was measured as the visual
 * *center* of a row/cell, so if we used that value as the baseline
 * directly, the top of the text would poke above the row's center by
 * roughly its ascent — which, on the template's tight row heights, was
 * tall enough to cross into the row above (the overlap/overflow bug).
 * This nudges the baseline down by ~0.32 * font size (a standard
 * approximation of (ascent - descent) / 2 for Helvetica) so the glyph's
 * visual bounding box is actually centered in the row.
 */
function verticalCenterOffsetPx(sizePt) {
  return (sizePt * 0.32) / PDF_PX_SCALE;
}

/**
 * Shortens `text` (with a trailing "…") until it fits within
 * `maxWidthPt`, instead of letting it run past a cell's right edge or
 * wrap onto a second line that bleeds into the row below. If no
 * maxWidthPt is supplied, the text is returned unmodified.
 */
function fitTextWidth(font, text, size, maxWidthPt) {
  const str = String(text);
  if (!maxWidthPt) return str;
  if (font.widthOfTextAtSize(str, size) <= maxWidthPt) return str;
  let truncated = str;
  while (truncated.length > 1 && font.widthOfTextAtSize(truncated + '…', size) > maxWidthPt) {
    truncated = truncated.slice(0, -1);
  }
  return truncated.length > 1 ? truncated + '…' : truncated;
}

function drawText(page, font, text, px, py, opts = {}) {
  if (text === undefined || text === null || text === '') return;
  const size = opts.size || BASE_FONT_SIZE;
  const adjustedPy = py + verticalCenterOffsetPx(size);
  const { x, y } = toPt(px, adjustedPy);
  const fitted = fitTextWidth(font, String(text), size, opts.maxWidthPt);
  page.drawText(fitted, {
    x,
    y,
    size,
    font,
    color: opts.color || rgbBlack(),
    // NOTE: pdf-lib's own `maxWidth` triggers automatic multi-line
    // word-wrap, which is what caused values to bleed into the row
    // below on tight cells. We truncate to a single line ourselves
    // above instead, so `maxWidth` is intentionally never passed here.
  });
}

function rgbBlack() {
  return PDFLib.rgb(0.05, 0.05, 0.08);
}

/** Draw a tick / "/" mark used throughout the form's narrow check columns. */
function drawTick(page, font, px, py, size = BASE_FONT_SIZE) {
  const adjustedPy = py + verticalCenterOffsetPx(size);
  const { x, y } = toPt(px, adjustedPy);
  page.drawText('/', { x, y, size, font, color: rgbBlack() });
}

/** Draw a horizontal strike-through line across a px-space x-range at a given row. */
function drawStrike(page, x1px, x2px, ypx) {
  const p1 = toPt(x1px, ypx + 3);
  const p2 = toPt(x2px, ypx + 3);
  page.drawLine({
    start: { x: p1.x, y: p1.y },
    end: { x: p2.x, y: p2.y },
    thickness: 1,
    color: rgbBlack(),
  });
}

/** Word-wrap text into lines that fit maxWidthPt using the given font/size. */
function wrapText(text, font, size, maxWidthPt) {
  if (!text) return [];
  const words = String(text).split(/\s+/);
  const lines = [];
  let current = '';
  for (const word of words) {
    const trial = current ? `${current} ${word}` : word;
    if (font.widthOfTextAtSize(trial, size) > maxWidthPt && current) {
      lines.push(current);
      current = word;
    } else {
      current = trial;
    }
  }
  if (current) lines.push(current);
  return lines;
}

function drawMultiline(page, font, text, xpx, yTopPx, yBottomPx, opts = {}) {
  const size = opts.size || SMALL_FONT_SIZE;
  const lineHeight = opts.lineHeight || 12; // px step between lines
  const maxWidthPt = opts.maxWidthPt || 500;
  const lines = wrapText(text, font, size, maxWidthPt);
  let y = yTopPx;
  for (const line of lines) {
    if (y + verticalCenterOffsetPx(size) > yBottomPx) break; // don't overflow the printed box
    drawText(page, font, line, xpx, y, { size }); // drawText applies baseline centering
    y += lineHeight;
  }
}

/* ------------------------------------------------------------------ */
/* PAGE 1 — Asset Condition Appraisal                                  */
/* ------------------------------------------------------------------ */

function drawPage1(page, font, fontBold, black, data) {
  const map = FIELD_MAP.page1;

  // ---- header ----
  const h = map.header;
  const col1W = map.headerColWidthPx.col1 * PDF_PX_SCALE;
  const col2W = map.headerColWidthPx.col2 * PDF_PX_SCALE;
  drawText(page, font, data.hospitalName, h.hospitalName.x, h.hospitalName.y, { maxWidthPt: col1W });
  drawText(page, font, data.locationCode, h.locationCode.x, h.locationCode.y, { maxWidthPt: col2W });
  drawText(page, font, data.assetNumber, h.assetNumber.x, h.assetNumber.y, { maxWidthPt: col1W });
  drawText(page, font, data.department, h.department.x, h.department.y, { maxWidthPt: col2W });
  drawText(page, font, data.assetDescription, h.assetDescription.x, h.assetDescription.y, { maxWidthPt: col1W });
  drawText(page, font, fmtDate(data.purchaseDate), h.purchaseDate.x, h.purchaseDate.y, { maxWidthPt: col2W });
  drawText(page, font, data.modelNo, h.modelNo.x, h.modelNo.y, { maxWidthPt: col1W });
  drawText(page, font, fmtDate(data.warrantyExpiry), h.warrantyExpiry.x, h.warrantyExpiry.y, { maxWidthPt: col2W });
  drawText(page, font, data.serialNo, h.serialNo.x, h.serialNo.y, { maxWidthPt: col1W });
  drawText(page, font, data.supplier, h.supplier.x, h.supplier.y, { maxWidthPt: col2W });
  drawText(page, font, data.manufacturer, h.manufacturer.x, h.manufacturer.y, { maxWidthPt: col1W });

  // ---- observation ticks ----
  const checkedRows = data.observations || {};
  Object.keys(checkedRows).forEach((rowNum) => {
    if (!checkedRows[rowNum]) return;
    const y = map.obsRowY[rowNum];
    if (y) drawTick(page, font, map.obsCheckX, y, OBS_FONT_SIZE);
  });

  // small blanks sit on a short dotted line within a shared table row —
  // cap them tightly so they can never run into the row's own margin
  const blankWidthPt = 90 * PDF_PX_SCALE;
  const refWidthPt = 130 * PDF_PX_SCALE;

  // ---- row 1: age / purchase value blanks ----
  if (data.calc && data.calc.ageYears !== null && data.calc.ageYears !== undefined) {
    drawText(page, font, data.calc.ageYears, map.obsBlanks.row1_years.x, map.obsBlanks.row1_years.y, { size: OBS_FONT_SIZE, maxWidthPt: blankWidthPt });
  }
  if (data.purchaseValue) {
    drawText(page, font, Number(data.purchaseValue).toLocaleString(), map.obsBlanks.row1_value.x, map.obsBlanks.row1_value.y, { size: OBS_FONT_SIZE, maxWidthPt: blankWidthPt });
  }
  // ---- row 9: rated voltage ----
  if (data.ratedVoltage) {
    drawText(page, font, data.ratedVoltage, map.obsBlanks.row9_voltage.x, map.obsBlanks.row9_voltage.y, { size: OBS_FONT_SIZE, maxWidthPt: blankWidthPt });
  }
  // ---- row 18: warranty expiry blank ----
  if (checkedRows['18'] && data.warrantyExpiry) {
    drawText(page, font, fmtDate(data.warrantyExpiry), map.obsBlanks.row18_expiry.x, map.obsBlanks.row18_expiry.y, { size: OBS_FONT_SIZE, maxWidthPt: blankWidthPt });
  }
  // ---- reference-document blanks (12,13,15,21,23) ----
  ['row12_ref', 'row13_ref', 'row15_ref', 'row21_ref', 'row23_ref'].forEach((key) => {
    const refKey = key.replace('row', '').replace('_ref', '');
    const val = data.refDocs && data.refDocs[refKey];
    if (val) drawText(page, font, val, map.obsBlanks[key].x, map.obsBlanks[key].y, { size: OBS_FONT_SIZE, maxWidthPt: refWidthPt });
  });

  // ---- row 2: working condition strike-through + tick ----
  if (data.row2Condition) {
    const opt = map.row2Options;
    const chosen = data.row2Condition; // one of the keys in opt
    Object.keys(opt).forEach((key) => {
      if (key === 'y') return;
      if (key !== chosen) {
        drawStrike(page, opt[key].x1, opt[key].x2, opt.y);
      }
    });
    drawTick(page, font, map.obsCheckX, opt.y, OBS_FONT_SIZE);
  }

  // ---- recommendation rows ----
  const recs = data.recommendations || [];
  const recWidthPt = map.recTextWidthPx * PDF_PX_SCALE;
  recs.slice(0, 6).forEach((text, idx) => {
    const rowY = map.recommendation.rowY[idx + 1];
    if (!rowY || !text) return;
    drawText(page, font, text, map.recommendation.textX, rowY, { size: OBS_FONT_SIZE, maxWidthPt: recWidthPt });
  });

  // ---- exemption / BER / critical level ----
  const ex = map.exemption;
  const smallBoxWidthPt = 40 * PDF_PX_SCALE;
  const criticalWidthPt = 120 * PDF_PX_SCALE;
  if (data.exemptionChecked) drawTick(page, font, ex.box.x, ex.box.y);
  if (data.ber1) drawText(page, font, data.ber1, ex.ber1.x, ex.ber1.y, { size: OBS_FONT_SIZE, maxWidthPt: smallBoxWidthPt });
  if (data.ber2) drawText(page, font, data.ber2, ex.ber2.x, ex.ber2.y, { size: OBS_FONT_SIZE, maxWidthPt: smallBoxWidthPt });
  if (data.criticalLevel) drawText(page, font, data.criticalLevel, ex.criticalLevel.x, ex.criticalLevel.y, { size: OBS_FONT_SIZE, maxWidthPt: criticalWidthPt });

  // ---- signatures ----
  const sig = map.signatures;
  const sigColWidthPt = 280 * PDF_PX_SCALE; // each signature column is ~300px wide on the template
  const sigData = {
    preparedBy: [data.preparedByName, data.preparedByDate],
    verifiedBy: [data.verifiedByName, data.verifiedByDate],
    approvedBy: [data.approvedByName, data.approvedByDate],
    receivedBy: [data.receivedByName, data.receivedByDate],
  };
  sig.columns.forEach((col) => {
    const [name, date] = sigData[col.key] || [];
    if (name) drawText(page, font, name, col.labelX + sig.nameOffsetX, sig.nameY, { size: SMALL_FONT_SIZE, maxWidthPt: sigColWidthPt });
    if (date) drawText(page, font, fmtDate(date), col.labelX + sig.dateOffsetX, sig.dateY, { size: SMALL_FONT_SIZE, maxWidthPt: sigColWidthPt });
  });
}

/* ------------------------------------------------------------------ */
/* PAGE 2 — Technical Report                                           */
/* ------------------------------------------------------------------ */

function drawPage2(page, font, fontBold, black, data) {
  const map = FIELD_MAP.page2;

  if (data.cahFacility) drawText(page, font, data.cahFacility, map.facilityName.x, map.facilityName.y, { maxWidthPt: 300 * PDF_PX_SCALE });

  const et = map.exemptionTop;
  if (data.exemptionChecked) drawTick(page, font, et.box.x, et.box.y);
  if (data.rfdcMark) drawTick(page, font, et.rfdc.x, et.rfdc.y);
  if (data.trMark) drawTick(page, font, et.tr.x, et.tr.y);

  // ---- Section 1 grid ----
  const s1 = map.section1.colX;
  const rows = map.section1.rows;
  const values = {
    date: fmtDate(data.tr_date), hospital: data.tr_hospital, valueAfterRepair: fmtMoney(data.tr_valueAfterRepair),
    itemDescription: data.tr_itemDescription, locationDept: data.tr_locationDept, lifespanAfterRepair: data.tr_lifespanAfterRepair,
    assetNo: data.tr_assetNo, supplier2: data.tr_supplier, totalRepairCost: fmtMoney(data.tr_totalRepairCost),
    serialNo2: data.tr_serialNo, dateBuy: fmtDate(data.tr_dateBuy), frequencyBreakdown: data.tr_frequencyBreakdown,
    model2: data.tr_model, cost: fmtMoney(data.tr_cost), dateWarrantyEnd: fmtDate(data.tr_dateWarrantyEnd),
    brand: data.tr_brand, costRepairYr: fmtMoney(data.tr_costRepairYr), workOrderNo: data.tr_workOrderNo,
    manufacturer2: data.tr_manufacturer, currentValue: fmtMoney(data.tr_currentValue),
  };
  const colWidthsPt = map.section1.colWidthPx.map((w) => w * PDF_PX_SCALE);
  Object.keys(rows).forEach((key) => {
    const cfg = rows[key];
    const val = values[key];
    if (val === undefined || val === '' || val === null) return;
    cfg.colIndexes.forEach((ci) => {
      drawText(page, font, val, s1[ci], cfg.y, { size: SMALL_FONT_SIZE, maxWidthPt: colWidthsPt[ci] });
    });
  });

  // ---- Section 2: equipment condition ----
  if (data.equipmentCondition) {
    const opt = map.condition.options[data.equipmentCondition];
    if (opt) {
      const x = opt.side === 'left' ? map.condition.leftBoxX : map.condition.rightBoxX;
      const y = map.condition.rowY[opt.row];
      drawTick(page, font, x, y);
    }
  }

  // ---- text areas ----
  const ta = map.textAreas;
  drawMultiline(page, font, data.requestDetails, ta.requestDetails.x, ta.requestDetails.yTop, ta.requestDetails.yBottom, { lineHeight: ta.requestDetails.lineHeight, maxWidthPt: 540 });
  drawMultiline(page, font, data.findings, ta.findings.x, ta.findings.yTop, ta.findings.yBottom, { lineHeight: ta.findings.lineHeight, maxWidthPt: 540 });
  drawMultiline(page, font, data.suggestion, ta.suggestion.x, ta.suggestion.yTop, ta.suggestion.yBottom, { lineHeight: ta.suggestion.lineHeight, maxWidthPt: 540 });

  // ---- Section 3 sign-off ----
  const s3 = map.section3;
  const s3data = {
    preparedBy: [data.tr_preparedByName, data.tr_preparedByDate],
    checkedBy: [data.tr_checkedByName, data.tr_checkedByDate],
    receivedBy: [data.tr_receivedByName, data.tr_receivedByDate],
  };
  const s3ColWidthPt = 370 * PDF_PX_SCALE; // ~400px-wide columns on the template
  s3.columns.forEach((col) => {
    const [name, date] = s3data[col.key] || [];
    if (name) drawText(page, font, name, col.x, s3.nameY, { size: SMALL_FONT_SIZE, maxWidthPt: s3ColWidthPt });
    if (date) drawText(page, font, fmtDate(date), col.x, s3.dateY, { size: SMALL_FONT_SIZE, maxWidthPt: s3ColWidthPt });
  });
}

/* ------------------------------------------------------------------ */
/* Formatting helpers                                                  */
/* ------------------------------------------------------------------ */

function fmtDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  return `${dd}/${mm}/${d.getFullYear()}`;
}

function fmtMoney(v) {
  if (v === undefined || v === null || v === '') return '';
  const n = Number(v);
  if (isNaN(n)) return v;
  return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

if (typeof module !== 'undefined') {
  module.exports = { generateReportPdf };
}
