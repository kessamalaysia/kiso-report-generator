/**
 * fieldmap.js
 * ------------------------------------------------------------------
 * Coordinate map for overlaying data onto template.pdf (Columbia Asia
 * "Asset Condition Appraisal" + "Technical Report", 2 pages, A4).
 *
 * All coordinates were derived by rendering template.pdf at 150 DPI
 * (1241 x 1754 px) and measuring pixel positions of every blank cell,
 * checkbox, and line, then converting pixel -> PDF points using:
 *
 *    scale  = 72 / 150 = 0.48
 *    x_pt   = x_px * scale
 *    y_pt   = PAGE_HEIGHT - (y_px * scale)
 *
 * PAGE_WIDTH / PAGE_HEIGHT are the true page box reported by the PDF
 * (595.275 x 841.89 pt, A4). Coordinates below are stored in PIXEL
 * space (matching the 150dpi render) and converted at draw-time by
 * pdfgen.js — this keeps the numbers easy to re-calibrate by looking
 * at the reference PNG render if a field ever needs nudging.
 * ------------------------------------------------------------------
 */

const PDF_PX_SCALE = 0.48; // 150dpi px -> pt
const PAGE_WIDTH_PT = 595.275;
const PAGE_HEIGHT_PT = 841.89;

/** Convert a stored pixel coordinate to PDF points (bottom-left origin). */
function pxToPt(px, py) {
  return {
    x: px * PDF_PX_SCALE,
    y: PAGE_HEIGHT_PT - (py * PDF_PX_SCALE),
  };
}

const FIELD_MAP = {
  page1: {
    // px width available for each header value cell, used to truncate
    // (never wrap/overflow) long values instead of bleeding into the
    // next column or row.
    headerColWidthPx: { col1: 365, col2: 385 },
    header: {
      hospitalName:      { x: 235, y: 214 },
      locationCode:      { x: 835, y: 214 },
      assetNumber:       { x: 235, y: 238 },
      department:        { x: 835, y: 238 },
      assetDescription:  { x: 235, y: 262 },
      purchaseDate:      { x: 835, y: 262 },
      modelNo:           { x: 235, y: 286 },
      warrantyExpiry:    { x: 835, y: 286 },
      serialNo:          { x: 235, y: 310 },
      supplier:          { x: 835, y: 310 },
      manufacturer:      { x: 235, y: 334 },
    },
    // narrow "/" tick column shared by every observation row
    obsCheckX: 69,
    // available px width for observation / recommendation text so long
    // values truncate with an ellipsis instead of running past the
    // right-hand table border
    obsTextWidthPx: 1130,
    recTextWidthPx: 1130,
    // vertical center (px) of each of the 29 observation rows
    obsRowY: {
      1: 371, 2: 391, 3: 411, 4: 431, 5: 451, 6: 471, 7: 491, 8: 511,
      9: 531, 10: 551, 11: 571, 12: 591, 13: 611, 14: 631, 15: 651,
      16: 671, 17: 691, 18: 711, 19: 731, 20: 751, 21: 771, 22: 791,
      23: 811, 24: 831, 25: 851, 26: 880, 27: 920, 28: 950, 29: 970,
    },
    // in-line dotted blanks that get auto-filled from calculated / entered values
    obsBlanks: {
      row1_years:   { x: 230, y: 371 },
      row1_value:   { x: 455, y: 371 },
      row9_voltage: { x: 205, y: 531 },
      row12_ref:    { x: 430, y: 591 },
      row13_ref:    { x: 500, y: 611 },
      row15_ref:    { x: 500, y: 651 },
      row18_expiry: { x: 335, y: 711 },
      row21_ref:    { x: 435, y: 771 },
      row23_ref:    { x: 420, y: 811 },
    },
    // strike-through segments for row 2's inline multiple choice text
    // ("Working / Partially functioning / Not working / Inactive in storage / Damage")
    row2Options: {
      y: 391,
      working:              { x1: 228, x2: 288 },
      partiallyFunctioning: { x1: 296, x2: 430 },
      notWorking:           { x1: 438, x2: 524 },
      inactiveInStorage:    { x1: 532, x2: 654 },
      damage:               { x1: 662, x2: 720 },
    },
    recommendation: {
      checkX: 69,
      textX: 80,
      rowY: { 1: 1013, 2: 1035, 3: 1057, 4: 1079, 5: 1101, 6: 1123 },
    },
    exemption: {
      box:  { x: 75, y: 1164 },
      ber1: { x: 317, y: 1164 },
      ber2: { x: 380, y: 1164 },
      criticalLevel: { x: 1150, y: 1164 },
    },
    signatures: {
      // columns: preparedBy, verifiedBy, approvedBy, receivedBy
      columns: [
        { key: 'preparedBy', labelX: 30 },
        { key: 'verifiedBy', labelX: 330 },
        { key: 'approvedBy', labelX: 630 },
        { key: 'receivedBy', labelX: 930 },
      ],
      nameY: 1183,
      dateY: 1237,
      nameOffsetX: 110,
      dateOffsetX: 90,
    },
  },

  page2: {
    facilityName: { x: 850, y: 246 },
    exemptionTop: {
      box:  { x: 45, y: 318 },
      rfdc: { x: 350, y: 318 },
      tr:   { x: 555, y: 318 },
    },
    section1: {
      // value column x-starts for [col1, col2, col3]
      colX: [245, 605, 1015],
      // px width available in each value column before hitting the next
      // label column (used to truncate rather than overflow)
      colWidthPx: [150, 195, 195],
      rows: {
        date:            { row: 'date',            colIndexes: [0] , y: 394 },
        hospital:        { row: 'hospital',         colIndexes: [1] , y: 394 },
        valueAfterRepair:{ row: 'valueAfterRepair', colIndexes: [2] , y: 394 },

        itemDescription: { colIndexes: [0], y: 428 },
        locationDept:    { colIndexes: [1], y: 428 },
        lifespanAfterRepair: { colIndexes: [2], y: 428 },

        assetNo:         { colIndexes: [0], y: 464 },
        supplier2:       { colIndexes: [1], y: 464 },
        totalRepairCost: { colIndexes: [2], y: 464 },

        serialNo2:       { colIndexes: [0], y: 496 },
        dateBuy:         { colIndexes: [1], y: 496 },
        frequencyBreakdown: { colIndexes: [2], y: 496 },

        model2:          { colIndexes: [0], y: 530 },
        cost:            { colIndexes: [1], y: 530 },
        dateWarrantyEnd: { colIndexes: [2], y: 530 },

        brand:           { colIndexes: [0], y: 558 },
        costRepairYr:    { colIndexes: [1], y: 558 },
        workOrderNo:     { colIndexes: [2], y: 558 },

        manufacturer2:   { colIndexes: [0], y: 586 },
        currentValue:    { colIndexes: [1], y: 586 },
      },
    },
    condition: {
      // checkbox x for left / right option in each of 3 rows
      leftBoxX: 390,
      rightBoxX: 790,
      rowY: { 1: 638, 2: 666, 3: 694 },
      options: {
        newFunctioningGood: { row: 1, side: 'left' },
        notReliable:        { row: 1, side: 'right' },
        notFollowSpec:      { row: 2, side: 'left' },
        notSafeToUse:       { row: 2, side: 'right' },
        beyondEconomical:   { row: 3, side: 'left' },
        obsolete:           { row: 3, side: 'right' },
      },
    },
    textAreas: {
      requestDetails: { x: 40, yTop: 744, yBottom: 800, lineHeight: 16 },
      findings:       { x: 40, yTop: 834, yBottom: 954, lineHeight: 16 },
      suggestion:     { x: 40, yTop: 988, yBottom: 1044, lineHeight: 16 },
    },
    section3: {
      columns: [
        { key: 'preparedBy', x: 40 },
        { key: 'checkedBy',  x: 440 },
        { key: 'receivedBy', x: 840 },
      ],
      nameY: 1090,
      dateY: 1150,
    },
  },
};

if (typeof module !== 'undefined') {
  module.exports = { FIELD_MAP, pxToPt, PDF_PX_SCALE, PAGE_WIDTH_PT, PAGE_HEIGHT_PT };
}
