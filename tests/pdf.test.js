import test from 'node:test';
import assert from 'node:assert/strict';
import { PDFDocument, PDFArray, decodePDFRawStream } from 'pdf-lib';
import { createPatternPdf } from '../web/pdf.js';

function content(pdf, page) {
  const streams = page.node.Contents();
  const refs = streams instanceof PDFArray ? streams.asArray() : [streams];
  return refs.map(ref => Buffer.from(decodePDFRawStream(pdf.context.lookup(ref)).decode()).toString()).join('\n');
}
const block = { Name: 'Scale proof', WidthInches: 4, HeightInches: 4, Lines: [{ Start: { X: 0, Y: 1 }, End: { X: 4, Y: 1 } }] };

test('generated Letter PDF has one physical Letter page, no image rasterization, and vector seam coordinates', async () => {
  const pdf = await PDFDocument.load(await createPatternPdf(block));
  assert.equal(pdf.getPageCount(), 1);
  assert.deepEqual(pdf.getPage(0).getSize(), { width: 612, height: 792 });
  const commands = content(pdf, pdf.getPage(0));
  // A 4-inch seam remains 288 points long after mirroring and page placement.
  assert.match(commands, /342 615\.6 m\s+54 615\.6 l/);
  assert.doesNotMatch(commands, /\/Image/);
  assert.equal(pdf.getTitle(), 'Scale proof - FPP pattern');
  assert.equal(pdf.catalog.getOrCreateViewerPreferences().getPrintScaling(), 'None');
});

test('each exported page includes the exact 72-point calibration square and print-scale instructions', async () => {
  const pdf = await PDFDocument.load(await createPatternPdf({ ...block, WidthInches: 12, HeightInches: 12, Lines: [{ Start: { X: 0, Y: 1 }, End: { X: 12, Y: 1 } }] }));
  assert.equal(pdf.getPageCount(), 4);
  for (const page of pdf.getPages()) {
    const commands = content(pdf, page);
    assert.match(commands, /1 0 0 1 36 36 cm/);
    assert.match(commands, /0 0 m\s+0 72 l\s+72 72 l\s+72 0 l/);
    assert.ok(commands.includes(Buffer.from('PRINT AT 100% / ACTUAL SIZE.').toString('hex').toUpperCase()));
  }
});

test('A4 export keeps ISO paper dimensions and the same 288-point seam', async () => {
  const pdf = await PDFDocument.load(await createPatternPdf(block, 'a4'));
  const page = pdf.getPage(0);
  assert.ok(Math.abs(page.getWidth() - 595.2755905511812) < 1e-9);
  assert.ok(Math.abs(page.getHeight() - 841.8897637795276) < 1e-9);
  const commands = content(pdf, page);
  assert.match(commands, /342 [\d.]+ m\s+54 [\d.]+ l/);
});

test('unsupported font characters in names cannot break export', async () => {
  const pdf = await PDFDocument.load(await createPatternPdf({ ...block, Name: 'Café ✂️ quilt 日本語' }));
  assert.equal(pdf.getPageCount(), 1);
});

test('separate foundations print on separate pages with perimeter-only allowances and a color key', async () => {
  const b = { Name: 'Two sections', WidthInches: 4, HeightInches: 4, Lines: [{ Id: 'h', BoundaryType: 'section', Start: { X: 0, Y: 2 }, End: { X: 4, Y: 2 } }] };
  const { analyzePieces, setPieceSetting } = await import('../web/pattern.js');
  const f = analyzePieces(b).faces[0];
  const colored = setPieceSetting(b, f.key, { Color: '#ffff00' });
  const pdf = await PDFDocument.load(await createPatternPdf(colored));
  assert.equal(pdf.getPageCount(), 3);
  assert.ok(content(pdf, pdf.getPage(0)).includes(Buffer.from('Section A').toString('hex').toUpperCase()));
  assert.ok(content(pdf, pdf.getPage(1)).includes(Buffer.from('Section B').toString('hex').toUpperCase()));
  assert.ok(content(pdf, pdf.getPage(2)).includes(Buffer.from('#FFFF00').toString('hex').toUpperCase()));
  for (const page of pdf.getPages().slice(0, 2)) {
    const c = content(pdf, page);
    assert.equal((c.match(/\[4 3\]/g) || []).length, 4);
    assert.match(c, /0 0 m\s+0 72 l\s+72 72 l\s+72 0 l/);
  }
});
