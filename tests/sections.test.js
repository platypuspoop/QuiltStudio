import test from 'node:test';
import assert from 'node:assert/strict';
import { addConstrainedLine, addCurve, analyzePieces, applySymmetry, colorLegend, deleteDraft, offsetPolygon, parseProject, planSectionPatterns, pointInPolygon, sampleCurve, setPieceSetting } from '../web/pattern.js';
const blank = (w = 10, h = 10) => ({ Name: 'Sections', WidthInches: w, HeightInches: h, Lines: [] });
const line = (id, x, y, xx, yy, type = 'piece') => ({ Id: id, Start: { X: x, Y: y }, End: { X: xx, Y: yy }, BoundaryType: type });
function referenceBlock() {
  // Wife's sketch: two rectangle foundations, each with one starting pair.
  const b = blank();
  b.Lines = [line('divide', 4.5, 0, 4.5, 10), line('left-diagonal', 0, 0, 4.5, 5), line('seed-b', 2.25, 2.5, 4.5, 0), line('bottom-left', 0, 5, 4.5, 5), line('strip-a', 7.5, 0, 7.5, 6.5), line('seed-a', 4.5, 3, 7.5, 3), line('bottom-a', 4.5, 6.5, 10, 6.5)];
  return b;
}
test('reference sketch yields two rectangular foundations, starting pairs, then attachments', () => {
  const b = referenceBlock(), a = analyzePieces(b), plans = planSectionPatterns(b);
  assert.equal(a.faces.length, 8);
  assert.equal(plans.length, 2);
  for (const p of plans) {
    assert.equal(p.loops.length, 1);
    assert.equal(p.loops[0].length, 4);
    assert.equal(p.outlines[0].length, 4);
    assert.equal(p.faces.length, 4);
    assert.deepEqual(p.faces.map(f => f.label).sort(), [1, 2, 3, 4].map(n => `${p.letter}${n}`));
    const pair = p.faces.filter(f => /[12]$/.test(f.label));
    const common = a.edges.filter(e => e.faceIndexes.length === 2 && e.faceIndexes.every(i => pair.some(f => f.key === a.faces[i].key)));
    assert.ok(common.length, 'pieces 1 and 2 must share the starting seam');
    assert.ok(common.every(e => !e.border));
    assert.equal(p.cuts.length, 4, 'allowance belongs only to the rectangle perimeter');
  }
  assert.equal(plans[0].width / 72, 5);
  assert.equal(plans[1].width / 72, 6);
});
test('a second full bisector creates another section instead of one four-piece cross', () => {
  const b = blank(4, 4);
  b.Lines = [line('h', 0, 2, 4, 2), line('v', 2, 0, 2, 4)];
  const a = analyzePieces(b);
  assert.equal(a.sections.length, 2);
  assert.ok(a.sections.every(s => s.faceIndexes.length === 2));
});
test('manual piece numbering swaps occupied labels and survives save, reload and geometry splits', () => {
  let b = referenceBlock();
  const face = analyzePieces(b).faces.find(f => f.label === 'B1');
  b = setPieceSetting(b, face.key, { Label: 'B4', Color: '#ffff00' });
  assert.equal(analyzePieces(b).faces.find(f => f.key === face.key).label, 'B4');
  assert.equal(analyzePieces(b).faces.filter(f => f.label === 'B1').length, 1);
  const imported = parseProject(JSON.stringify({ SchemaVersion: 1, Blocks: [b] })).Blocks[0];
  assert.equal(analyzePieces(imported).faces.find(f => f.key === face.key).color, '#ffff00');
  b = addConstrainedLine(imported, { X: 4.5, Y: 1 }, { X: 6, Y: 1 }, { tolerance: .001 });
  assert.equal(analyzePieces(b).faces.filter(f => f.color === '#ffff00').length, 2);
});
test('moving a piece to a new section produces a separate print template', () => {
  let b = blank(4, 4); b.Lines = [line('h', 0, 2, 4, 2)];
  const face = analyzePieces(b).faces[0];
  b = setPieceSetting(b, face.key, { Label: 'B1' });
  assert.equal(planSectionPatterns(b).length, 2);
});
test('disconnected manually grouped pieces cannot masquerade as one foundation', () => {
  let b = blank(4, 4); b.Lines = [line('h', 0, 2, 4, 2), line('v', 2, 0, 2, 4)];
  let a = analyzePieces(b);
  const first = a.faces.find(f => f.centroid.X < 2 && f.centroid.Y < 2);
  b = setPieceSetting(b, first.key, { Label: 'Z1' });
  a = analyzePieces(b);
  const opposite = a.faces.find(f => f.centroid.X > 2 && f.centroid.Y > 2);
  b = setPieceSetting(b, opposite.key, { Label: 'Z2' });
  assert.throws(() => planSectionPatterns(b), /disconnected/);
});
test('quarter-inch polygon offset is joined at corners and encloses diagonal edges', () => {
  const offset = offsetPolygon([{ X: 0, Y: 0 }, { X: 4, Y: 0 }, { X: 4, Y: 4 }, { X: 0, Y: 4 }]);
  assert.deepEqual(offset, [{ X: -.25, Y: -.25 }, { X: 4.25, Y: -.25 }, { X: 4.25, Y: 4.25 }, { X: -.25, Y: 4.25 }]);
});
test('crossing mode physically splits both existing and new seams at every intersection', () => {
  const b = blank(); b.Lines = [line('v', 5, 0, 5, 10)];
  const next = addConstrainedLine(b, { X: 0, Y: 5 }, { X: 8, Y: 5 }, { crossLines: true, tolerance: .01 });
  assert.equal(next.Lines.length, 4);
  assert.equal(analyzePieces(next).faces.length, 4);
  assert.ok(next.Lines.every(l => l.Start.X === 5 && l.Start.Y === 5 || l.End.X === 5 && l.End.Y === 5));
  assert.equal(b.Lines.length, 1);
});
test('mirroring on both axes is one immutable operation and removes duplicates on axes', () => {
  const b = blank();
  const after = addConstrainedLine(b, { X: 0, Y: 2 }, { X: 4, Y: 2 }, { tolerance: .01 });
  const next = applySymmetry(b, after, true, true);
  assert.equal(next.Lines.length, 2);
  assert.equal(analyzePieces(next).faces.length, 3);
  assert.equal(b.Lines.length, 0);
  const center = addConstrainedLine(b, { X: 0, Y: 5 }, { X: 4, Y: 5 });
  assert.equal(applySymmetry(b, center, true, true).Lines.length, 1);
});
test('symmetry mirrors only the new stroke, not existing seams split by it', () => {
  let b = blank(); b = addConstrainedLine(b, { X: 0, Y: 3 }, { X: 5, Y: 3 });
  const n = addConstrainedLine(b, { X: 2, Y: 0 }, { X: 2, Y: 2 });
  const m = applySymmetry(b, n, true, false);
  assert.ok(!m.Lines.some(l => l.Start.Y === 7 && l.End.Y === 7));
});
test('half and quarter circles choose the requested bend side and reach exact anchors', () => {
  for (const kind of ['half', 'quarter']) {
    const pts = sampleCurve({ X: 0, Y: 0 }, { X: 4, Y: 0 }, { X: 2, Y: 2 }, kind);
    assert.deepEqual(pts[0], { X: 0, Y: 0 }); assert.deepEqual(pts.at(-1), { X: 4, Y: 0 });
    assert.ok(pts.every(p => p.Y >= -1e-8));
    const max = Math.max(...pts.map(p => p.Y));
    assert.ok(Math.abs(max - (kind === 'half' ? 2 : Math.sqrt(8) - 2)) < .004);
  }
});
test('curves divide faces, preserve endpoints and delete as a whole stroke', () => {
  for (const kind of ['curve', 'half', 'quarter']) {
    const b = blank(4, 4);
    const n = addCurve(b, { X: 0, Y: 0 }, { X: 4, Y: 0 }, { X: 2, Y: 2 }, { kind, tolerance: .001 });
    assert.equal(analyzePieces(n).faces.length, 2);
    assert.ok(n.Lines.length > 1);
    assert.equal(deleteDraft(n, 0).Lines.length, 0);
    assert.ok(planSectionPatterns(n)[0].curved);
    assert.equal(b.Lines.length, 0);
  }
});
test('curves terminate at the first crossed seam unless crossing is enabled', () => {
  const b = blank(4, 4); b.Lines = [line('v', 2, 0, 2, 4)];
  const stop = addCurve(b, { X: 0, Y: 0 }, { X: 4, Y: 0 }, { X: 2, Y: 2 }, { kind: 'half', tolerance: .001 });
  assert.ok(stop.Lines.filter(l => l.Curve).every(l => l.Start.X <= 2 + 1e-7 && l.End.X <= 2 + 1e-7));
  const through = addCurve(b, { X: 0, Y: 0 }, { X: 4, Y: 0 }, { X: 2, Y: 2 }, { kind: 'half', tolerance: .001, crossLines: true });
  assert.equal(analyzePieces(through).faces.length, 4);
});
test('right-click stroke deletion drops dependent fragments and can restore the snapshot', () => {
  const b = addConstrainedLine(blank(), { X: 0, Y: 5 }, { X: 5, Y: 5 });
  const n = addConstrainedLine(b, { X: 3, Y: 0 }, { X: 3, Y: 3 });
  const saved = structuredClone(n);
  const deleted = deleteDraft(n, n.Lines.findIndex(l => l.Start.Y === 5 && l.End.Y === 5));
  assert.equal(deleted.Lines.length, 0);
  assert.deepEqual(n, saved);
});
test('color codes rank usage by piece count and use stable ordering for ties', () => {
  let b = referenceBlock(); const a = analyzePieces(b);
  for (let i = 0; i < 5; i++) b = setPieceSetting(b, a.faces[i].key, { Color: i < 3 ? '#ffff00' : '#0000ff' });
  assert.deepEqual(colorLegend(analyzePieces(b)), [{ color: '#ffff00', count: 3, code: 1 }, { color: '#0000ff', count: 2, code: 2 }]);
});
test('invalid labels, floating export geometry and border-overlapping seams are rejected', () => {
  const b = blank(); const a = analyzePieces(b);
  assert.throws(() => setPieceSetting(b, a.faces[0].key, { Label: '<script>' }), /section letter/);
  assert.throws(() => addConstrainedLine(b, { X: 0, Y: 0 }, { X: 0, Y: 5 }), /overlap/);
  assert.throws(() => planSectionPatterns({ ...b, Lines: [line('orphan', 2, 2, 5, 2)] }), /floating/);
});

test('resizing preserves manual labels/colors and whole-section renaming exchanges letters', async () => {
  const { resizeBlock, renameSection } = await import('../web/pattern.js');
  let b = referenceBlock();
  const f = analyzePieces(b).faces.find(f => f.label === 'A1');
  b = setPieceSetting(b, f.key, { Color: '#ffff00' });
  b = renameSection(b, 'A', 'B');
  assert.equal(analyzePieces(b).faces.find(p => p.key === f.key).label, 'B1');
  b = resizeBlock(b, 20, 20);
  assert.equal(analyzePieces(b).faces.find(p => p.label === 'B1').color, '#ffff00');
  assert.equal(planSectionPatterns(b).length, 2);
});
