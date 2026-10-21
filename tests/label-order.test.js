import test from 'node:test';
import assert from 'node:assert/strict';
import { addDraftLine, adjacentPieces, alphaLabel, analyzePieces, labelSections, previewDraftLine, setPieceSetting, planSectionPatterns } from '../web/pattern.js';
const line = (id, x, y, xx, yy, type = 'section') => ({ Id: id, Start: { X: x, Y: y }, End: { X: xx, Y: yy }, BoundaryType: type });
const blank = () => ({ Name: 'Order', WidthInches: 4, HeightInches: 4, Lines: [], AllowOutside: true });
const grid = () => ({ ...blank(), Lines: [line('v', 2, 0, 2, 4), line('h', 0, 2, 4, 2)] });
function radial() {
  return { ...blank(), Lines: [line('n', 1, 1, 3, 1), line('e', 3, 1, 3, 3), line('s', 3, 3, 1, 3), line('w', 1, 3, 1, 1), line('nw', 1, 1, 0, 0), line('ne', 3, 1, 4, 0), line('se', 3, 3, 4, 4), line('sw', 1, 3, 0, 4)] };
}
test('irregular sections label the center first, then north/east/south/west clockwise', () => {
  const faces = analyzePieces(labelSections(radial())).faces;
  const at = (x, y) => faces.find(f => Math.hypot(f.centroid.X - x, f.centroid.Y - y) < .1)?.label;
  assert.equal(at(2, 2), 'A1');
  assert.equal(faces.find(f => f.centroid.Y < 1).label, 'B1');
  assert.equal(faces.find(f => f.centroid.X > 3).label, 'C1');
  assert.equal(faces.find(f => f.centroid.Y > 3).label, 'D1');
  assert.equal(faces.find(f => f.centroid.X < 1).label, 'E1');
});
test('complete grids use row-major letters and each cell remains separately printable', () => {
  const b = labelSections(grid()), faces = analyzePieces(b).faces;
  const ordered = [...faces].sort((a, b) => a.centroid.Y - b.centroid.Y || a.centroid.X - b.centroid.X);
  assert.deepEqual(ordered.map(f => f.label), ['A1', 'B1', 'C1', 'D1']);
  assert.equal(planSectionPatterns(b).length, 4);
});
test('manual letter edits and occupied number swaps stay unique', () => {
  let b = labelSections(radial());
  const faces = analyzePieces(b).faces, a = faces.find(f => f.label === 'A1'), bFace = faces.find(f => f.label === 'B1');
  b = setPieceSetting(b, a.key, { Label: 'B1' });
  const after = analyzePieces(b).faces;
  assert.equal(after.find(f => f.key === a.key).label, 'B1'); assert.equal(after.find(f => f.key === bFace.key).label, 'A1');
  assert.equal(new Set(after.map(f => f.label)).size, after.length);
});
test('adjoining-piece choices use shared edges and exclude corner-only cells', () => {
  const a = analyzePieces(labelSections(grid())), corner = a.faces.find(f => f.label === 'A1');
  assert.deepEqual(adjacentPieces(a, corner.key).map(f => f.label).sort(), ['B1', 'C1']);
});
test('alphabet continues through Z, AA, AZ, BA without omissions', () => {
  assert.deepEqual([0, 10, 11, 25, 26, 36, 37, 51, 52, 77, 78].map(alphaLabel), ['A', 'K', 'L', 'Z', 'AA', 'AK', 'AL', 'AZ', 'BA', 'BZ', 'CA']);
});
test('preview and placement cross every seam when requested, including from outside', () => {
  const base = { ...blank(), Lines: [line('v1', 1, 0, 1, 4), line('v2', 3, 0, 3, 4)] };
  for (const start of [{ X: 0, Y: 2 }, { X: -1, Y: 2 }]) for (const crossLines of [false, true]) {
    const toward = { X: 4, Y: 2 }, preview = previewDraftLine(base, start, toward, crossLines);
    const b = addDraftLine(base, start, toward, { crossLines });
    const stroke = b.Lines.filter(l => l.Curve === null);
    assert.deepEqual(stroke[0].Start, preview[0]); assert.deepEqual(stroke.at(-1).End, preview.at(-1));
    assert.equal(stroke.at(-1).End.X, crossLines ? 4 : 1);
    if (crossLines) assert.ok(stroke.some(l => l.Start.X === 1 && l.End.X === 3));
  }
});
