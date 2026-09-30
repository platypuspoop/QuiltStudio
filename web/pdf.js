import { PDFDocument, StandardFonts, PrintScaling, rgb } from 'pdf-lib';
import { analyzePieces, planPattern, clipLine, SEAM_ALLOWANCE } from './pattern.js';

function safeText(text) {
  return String(text).normalize('NFKD').replace(/[^\x20-\x7E]/g, '').slice(0, 60) || 'Untitled block';
}

export async function createPatternPdf(block, paperKey = 'letter') {
  const plan = planPattern(block, paperKey);
  const pdf = await PDFDocument.create();
  pdf.setTitle(`${safeText(block.Name)} - FPP pattern`);
  pdf.setAuthor('QuiltStudio');
  pdf.setSubject('Actual-size mirrored seam template. Sewing order is not validated.');
  // Readers that honor this preference start with scaling disabled.
  // The physical calibration check is still necessary for printer drivers.
  pdf.catalog.getOrCreateViewerPreferences().setPrintScaling(PrintScaling.None);
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const ink = rgb(0.12, 0.12, 0.12);
  const gray = rgb(0.4, 0.4, 0.4);
  const allowance = SEAM_ALLOWANCE * 72;
  let pieceAnalysis = null;
  try { pieceAnalysis = analyzePieces(block); } catch { pieceAnalysis = null; }

  for (const [index, tile] of plan.tiles.entries()) {
    const page = pdf.addPage([plan.paper.width, plan.paper.height]);
    const text = (value, x, y, size = 9, strong = false) => page.drawText(value, { x, y, size, font: strong ? bold : font, color: ink });
    text('QUILTSTUDIO / FOUNDATION PAPER PIECING', 36, plan.paper.height - 31, 8, true);
    text(safeText(block.Name), 36, plan.paper.height - 52, 16, true);
    text(`${block.WidthInches}" x ${block.HeightInches}" finished | 1/4" outer allowance | Mirrored`, 36, plan.paper.height - 68);
    const rect = { x: tile.x, y: tile.y, width: plan.tileWidth, height: plan.tileHeight };
    const stroke = (start, end, dashed = false, thickness = 0.6) => {
      const line = clipLine(start, end, rect);
      if (!line) return;
      page.drawLine({
        start: { x: plan.margin + line.start.x - tile.x, y: plan.patternTop - (line.start.y - tile.y) },
        end: { x: plan.margin + line.end.x - tile.x, y: plan.patternTop - (line.end.y - tile.y) },
        thickness, color: ink, ...(dashed ? { dashArray: [4, 3], dashPhase: (Math.abs(line.start.x - start.x) + Math.abs(line.start.y - start.y)) % 7 } : {}),
      });
    };
    const border = (x, y, width, height, dashed) => {
      const corners = [{ x, y }, { x: x + width, y }, { x: x + width, y: y + height }, { x, y: y + height }];
      corners.forEach((point, i) => stroke(point, corners[(i + 1) % 4], dashed, dashed ? 0.6 : 1));
    };
    border(0, 0, plan.width, plan.height, true);
    border(allowance, allowance, block.WidthInches * 72, block.HeightInches * 72, false);
    plan.lines.forEach(line => stroke(line.start, line.end));

    if (pieceAnalysis) {
      for (const edge of pieceAnalysis.edges.filter(candidate => candidate.type === 'section' && !candidate.border)) {
        const dx = edge.End.X - edge.Start.X, dy = edge.End.Y - edge.Start.Y;
        const length = Math.hypot(dx, dy) || 1;
        const nx = -dy / length, ny = dx / length;
        for (const side of [-1, 1]) {
          const a = {
            x: (SEAM_ALLOWANCE + block.WidthInches - (edge.Start.X + nx * SEAM_ALLOWANCE * side)) * 72,
            y: (SEAM_ALLOWANCE + edge.Start.Y + ny * SEAM_ALLOWANCE * side) * 72,
          };
          const b = {
            x: (SEAM_ALLOWANCE + block.WidthInches - (edge.End.X + nx * SEAM_ALLOWANCE * side)) * 72,
            y: (SEAM_ALLOWANCE + edge.End.Y + ny * SEAM_ALLOWANCE * side) * 72,
          };
          stroke(a, b, true, 0.45);
        }
      }

      for (const face of pieceAnalysis.faces) {
        const x = (SEAM_ALLOWANCE + block.WidthInches - face.centroid.X) * 72;
        const y = (SEAM_ALLOWANCE + face.centroid.Y) * 72;
        if (x >= rect.x && x <= rect.x + rect.width && y >= rect.y && y <= rect.y + rect.height) {
          const label = safeText(face.label);
          const size = 10;
          const width = bold.widthOfTextAtSize(label, size);
          page.drawText(label, {
            x: plan.margin + x - tile.x - width / 2,
            y: plan.patternTop - (y - tile.y) - size / 3,
            size,
            font: bold,
            color: ink,
          });
        }
      }
    }

    // Corner crosses lie in the 1/2-inch printer-safe margin.
    for (const x of [plan.margin, plan.margin + plan.tileWidth]) {
      for (const y of [plan.patternTop, plan.patternTop - plan.tileHeight]) {
        page.drawLine({ start: { x: x - 5, y }, end: { x: x + 5, y }, thickness: 0.4, color: gray });
        page.drawLine({ start: { x, y: y - 5 }, end: { x, y: y + 5 }, thickness: 0.4, color: gray });
      }
    }
    // Dashed overlap boundaries identify exactly where adjacent pages align.
    const guide = (start, end) => page.drawLine({ start, end, thickness: 0.35, color: gray, dashArray: [2, 3] });
    if (tile.column < plan.columns - 1) {
      const x = plan.margin + plan.tileWidth - plan.overlap;
      guide({ x, y: plan.patternTop }, { x, y: plan.patternTop - plan.tileHeight });
    }
    if (tile.row < plan.rows - 1) {
      const y = plan.patternTop - plan.tileHeight + plan.overlap;
      guide({ x: plan.margin, y }, { x: plan.margin + plan.tileWidth, y });
    }

    text(`Page ${index + 1} of ${plan.tiles.length} | Row ${tile.row + 1}, column ${tile.column + 1}`, 36, 140, 9, true);
    text('PRINT AT 100% / ACTUAL SIZE. Turn off Fit, Shrink, and Scale to fit.', 36, 126, 9, true);
    page.drawRectangle({ x: 36, y: 36, width: 72, height: 72, borderWidth: 0.6, borderColor: ink });
    text('1 inch', 56, 69, 9, true);
    text('Measure this square before sewing: exactly 1 inch on each side.', 120, 90, 8);
    text('Solid = seam. Dashed = 1/4-inch section cutting allowance.', 120, 76, 8);
    text('Tiled pages overlap 1/4 inch. Align repeated lines; tape together.', 120, 62, 8);
    text('Labels group internal pieces by section. Sewing order is not checked.', 120, 48, 8);
  }
  return pdf.save();
}
