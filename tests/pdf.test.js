import test from 'node:test';
import assert from 'node:assert/strict';
import { PDFDocument, PDFArray, decodePDFRawStream } from 'pdf-lib';
import { createPatternPdf } from '../web/pdf.js';

function content(pdf, page) {
  const streams = page.node.Contents();
  const refs = streams instanceof PDFArray ? streams.asArray() : [streams];
  return refs.map(ref => Buffer.from(decodePDFRawStream(pdf.context.lookup(ref)).decode()).toString()).join('\n');
}
const block = { Name: 'Scale proof', WidthInches: 4, HeightInches: 4, Lines: [{ Start: { X: 0.5, Y: 1 }, End: { X: 2.5, Y: 1 } }] };

test('generated Letter PDF has one physical Letter page, no image rasterization, and vector seam coordinates', async () => {
  const pdf = await PDFDocument.load(await createPatternPdf(block));
  assert.equal(pdf.getPageCount(), 1);
  assert.deepEqual(pdf.getPage(0).getSize(), { width: 612, height: 792 });
  const commands = content(pdf, pdf.getPage(0));
  // A 2-inch seam remains 144 points long after mirroring and page placement.
  assert.match(commands, /306 615\.6 m\s+162 615\.6 l/);
  assert.doesNotMatch(commands, /\/Image/);
  assert.equal(pdf.getTitle(), 'Scale proof - FPP pattern');
  assert.equal(pdf.catalog.getOrCreateViewerPreferences().getPrintScaling(), 'None');
});

test('each exported page includes the exact 72-point calibration square and print-scale instructions', async () => {
  const pdf = await PDFDocument.load(await createPatternPdf({ ...block, WidthInches: 12, HeightInches: 12 }));
  assert.equal(pdf.getPageCount(), 4);
  for (const page of pdf.getPages()) {
    const commands = content(pdf, page);
    assert.match(commands, /1 0 0 1 36 36 cm/);
    assert.match(commands, /0 0 m\s+0 72 l\s+72 72 l\s+72 0 l/);
    assert.ok(commands.includes(Buffer.from('PRINT AT 100% / ACTUAL SIZE.').toString('hex').toUpperCase()));
  }
});

test('A4 export keeps ISO paper dimensions and the same 144-point seam', async () => {
  const pdf = await PDFDocument.load(await createPatternPdf(block, 'a4'));
  const page = pdf.getPage(0);
  assert.ok(Math.abs(page.getWidth() - 595.2755905511812) < 1e-9);
  assert.ok(Math.abs(page.getHeight() - 841.8897637795276) < 1e-9);
  const commands = content(pdf, page);
  assert.match(commands, /306 [\d.]+ m\s+162 [\d.]+ l/);
});

test('unsupported font characters in names cannot break export', async () => {
  const pdf = await PDFDocument.load(await createPatternPdf({ ...block, Name: 'Café ✂️ quilt 日本語' }));
  assert.equal(pdf.getPageCount(), 1);
});
