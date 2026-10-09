import { PDFDocument, StandardFonts, PrintScaling, rgb } from 'pdf-lib';
import { planSectionPatterns, clipLine, SEAM_ALLOWANCE } from './pattern.js';

function safeText(text) {
  return String(text).normalize('NFKD').replace(/[^\x20-\x7E]/g, '').slice(0, 60) || 'Untitled block';
}

export async function createPatternPdf(block, paperKey = 'letter') {
  const plans = planSectionPatterns(block, paperKey);
  const pageCount = plans.reduce((sum, plan) => sum + plan.tiles.length, 0);
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
  let pageIndex = 0;

  for (const plan of plans) for (const tile of plan.tiles) {
    const index = pageIndex++;
    const page = pdf.addPage([plan.paper.width, plan.paper.height]);
    const text = (value, x, y, size = 9, strong = false) => page.drawText(value, { x, y, size, font: strong ? bold : font, color: ink });
    text('QUILTSTUDIO / FOUNDATION PAPER PIECING', 36, plan.paper.height - 31, 8, true);
    text(`${safeText(block.Name)} / Section ${plan.letter}`, 36, plan.paper.height - 52, 16, true);
    text(`Section ${plan.letter} | 1/4" perimeter allowance | Mirrored`, 36, plan.paper.height - 68);
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
    plan.cuts.forEach(line => stroke(line.start, line.end, true));
    plan.lines.forEach(line => stroke(line.start, line.end));
    for (const face of plan.faces) {
      const { x, y } = plan.transform(face.centroid);
      if (x < rect.x || x > rect.x + rect.width || y < rect.y || y > rect.y + rect.height) continue;
      const label = safeText(face.label), size = 10;
      const px = plan.margin + x - tile.x, py = plan.patternTop - (y - tile.y);
      page.drawText(label, { x: px - bold.widthOfTextAtSize(label, size) / 2, y: py - size / 3, size, font: bold, color: ink });
      if (face.color) {
        const color = face.color.toLowerCase(), code = String(plan.legend.find(c => c.color === color).code);
        const r = parseInt(color.slice(1, 3), 16) / 255, g = parseInt(color.slice(3, 5), 16) / 255, b = parseInt(color.slice(5, 7), 16) / 255;
        // Clip the color marker to this tile, just like the seam geometry.
        if (x - 9 >= rect.x && x + 9 <= rect.x + rect.width && y + 7 >= rect.y && y + 21 <= rect.y + rect.height) {
          page.drawRectangle({ x: px - 9, y: py - 21, width: 18, height: 14, color: rgb(r, g, b), borderColor: ink, borderWidth: 0.4 });
          page.drawText(code, { x: px - bold.widthOfTextAtSize(code, 8) / 2, y: py - 18, size: 8, font: bold, color: r * .299 + g * .587 + b * .114 > .55 ? rgb(0, 0, 0) : rgb(1, 1, 1) });
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

    text(`Page ${index + 1} of ${pageCount} | Section ${plan.letter} | Row ${tile.row + 1}, column ${tile.column + 1}`, 36, 140, 9, true);
    text('PRINT AT 100% / ACTUAL SIZE. Turn off Fit, Shrink, and Scale to fit.', 36, 126, 9, true);
    page.drawRectangle({ x: 36, y: 36, width: 72, height: 72, borderWidth: 0.6, borderColor: ink });
    text('1 inch', 56, 69, 9, true);
    text('Measure this square before sewing: exactly 1 inch on each side.', 120, 90, 8);
    text('Solid = seam. Dashed = 1/4-inch section cutting allowance.', 120, 76, 8);
    text('Tiled pages overlap 1/4 inch. Align repeated lines; tape together.', 120, 62, 8);
    text(plan.curved ? 'Curved seams require curved piecing; straight-seam FPP is not validated.' : 'Starting pair is 1/2. Review and correct sewing order before sewing.', 120, 48, 8);
  }
  if (plans[0]?.legend.length) {
    const legend = plans[0].legend;
    for (let start = 0; start < legend.length; start += 30) {
      const page = pdf.addPage([plans[0].paper.width, plans[0].paper.height]);
      page.drawText('QUILTSTUDIO / FABRIC COLOR KEY', { x: 36, y: page.getHeight() - 40, font: bold, size: 14 });
      page.drawText('Ranked by number of pieces using each color; ties use hex order.', { x: 36, y: page.getHeight() - 62, font, size: 9 });
      legend.slice(start, start + 30).forEach((entry, i) => {
        const y = page.getHeight() - 92 - i * 20, c = entry.color;
        page.drawRectangle({ x: 36, y: y - 3, width: 18, height: 14, color: rgb(parseInt(c.slice(1, 3), 16) / 255, parseInt(c.slice(3, 5), 16) / 255, parseInt(c.slice(5, 7), 16) / 255), borderColor: ink, borderWidth: .5 });
        page.drawText(`${entry.code}   ${c.toUpperCase()}   ${entry.count} piece${entry.count === 1 ? '' : 's'}`, { x: 65, y, font, size: 10 });
      });
    }
  }
  return pdf.save();
}
