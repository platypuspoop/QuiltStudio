import { test } from 'node:test';
import assert from 'node:assert/strict';
import { addFreeArc, addDraftLine, addConstrainedLine, arcBend, previewFreeArc, analyzePieces, labelSections, planSectionPatterns, seamCount, deleteSegment, clippedBlockLines, resizeBlock, planQuiltLayout, snapToGrid, parseProject } from '../web/pattern.js';
const blank = (size = 4) => ({ Id: 'test', Name: 'Test', WidthInches: size, HeightInches: size, Lines: [], AllowOutside: true, LabelsReady: false });
test('parallel half circles can start outside the block and printable geometry is clipped', () => {
  let b = blank(12);
  for (const extra of [0, .5]) {
    const start = { X: 0, Y: -extra }, end = { X: 0, Y: 12 + extra };
    b = addFreeArc(b, start, end, arcBend(start, end, -1), { kind: 'half', crossLines: true });
  }
  assert.equal(seamCount(b), 2);
  assert.ok(b.Lines.some(l => l.Start.Y < 0));
  assert.equal(analyzePieces(b).faces.length, 3);
  assert.ok(Math.abs(analyzePieces(b).faces.reduce((n, f) => n + f.area, 0) - 144) < 1e-5);
  for (const l of clippedBlockLines(b)) for (const p of [l.Start, l.End]) assert.ok(p.X >= -1e-7 && p.Y >= -1e-7 && p.X <= 12 + 1e-7 && p.Y <= 12 + 1e-7);
  assert.ok(planSectionPatterns(labelSections(b)).length);
  const saved = parseProject(JSON.stringify({ SchemaVersion: 1, Blocks: [b] }));
  assert.equal(saved.Blocks[0].Lines.length, b.Lines.length);
  assert.ok(resizeBlock(b, 24, 24).Lines.some(l => l.Start.Y < 0));
  assert.deepEqual(snapToGrid(b, { X: -.48, Y: -.48 }, true), { X: -.48, Y: -.48 });
});
test('whole arc preview is placed across existing seams with one stroke identity', () => {
  const b = addConstrainedLine(blank(), { X: 2, Y: 0 }, { X: 2, Y: 3 });
  const start = { X: 0, Y: 1 }, end = { X: 4, Y: 1 }, bend = arcBend(start, end);
  const preview = previewFreeArc(b, start, end, bend, 'half', true);
  const next = addFreeArc(b, start, end, bend, { kind: 'half', crossLines: true });
  assert.equal(seamCount(next), 2);
  const stroke = next.Lines.filter(l => l.Curve === 'half');
  assert.deepEqual(stroke[0].Start, preview[0]); assert.deepEqual(stroke.at(-1).End, preview.at(-1));
  assert.ok(stroke.some(l => l.Start.X > 2));
  assert.equal(new Set(stroke.map(l => l.DraftId)).size, 1);
});
test('crossing line can lose only its middle segment while both outer segments remain', () => {
  let b = addConstrainedLine(blank(), { X: 1, Y: 0 }, { X: 1, Y: 4 });
  b = addConstrainedLine(b, { X: 3, Y: 0 }, { X: 3, Y: 4 });
  b = addConstrainedLine(b, { X: 0, Y: 2 }, { X: 4, Y: 2 }, { crossLines: true });
  const i = b.Lines.findIndex(l => l.Start.X === 1 && l.End.X === 3 && l.Start.Y === 2);
  const next = deleteSegment(b, i);
  assert.equal(next.Lines.length, b.Lines.length - 1);
  assert.ok(next.Lines.some(l => l.Start.X === 0 && l.End.X === 1 && l.Start.Y === 2));
  assert.ok(next.Lines.some(l => l.Start.X === 3 && l.End.X === 4 && l.Start.Y === 2));
  assert.equal(seamCount(next), 3);
  assert.equal(analyzePieces(next).faces.length, analyzePieces(b).faces.length - 1);
});
test('curve segment deletion removes chords only up to the crossing', () => {
  const base = addConstrainedLine(blank(), { X: 2, Y: 0 }, { X: 2, Y: 4 });
  const start = { X: 0, Y: 1 }, end = { X: 4, Y: 1 };
  const b = addFreeArc(base, start, end, arcBend(start, end), { kind: 'half', crossLines: true });
  const i = b.Lines.findIndex(l => l.Curve && l.Start.X < 1);
  const next = deleteSegment(b, i);
  assert.ok(!next.Lines.some(l => l.Curve && l.Start.X < 2 - 1e-7));
  assert.ok(next.Lines.some(l => l.Curve && l.Start.X > 2));
});
test('outside straight strokes persist, and resizing scales reference offsets', () => {
  const b = addDraftLine({ ...blank(), SourceImageOffsetX: -.1, SourceImageOffsetY: .2 }, { X: -1, Y: 2 }, { X: 5, Y: 2 });
  assert.equal(seamCount(b), 1); assert.equal(analyzePieces(b).faces.length, 2);
  const resized = resizeBlock(b, 8, 8); assert.equal(resized.SourceImageOffsetX, -.2); assert.equal(resized.SourceImageOffsetY, .4);
});
test('12-inch finished outline stays 12 inches, with a 12.5-inch cutting outline', () => {
  const plan = planSectionPatterns(labelSections(blank(12)))[0];
  assert.equal(plan.width, 12.5 * 72); assert.equal(plan.height, 12.5 * 72);
  const xs = plan.lines.flatMap(l => [l.start.x, l.end.x]), ys = plan.lines.flatMap(l => [l.start.y, l.end.y]);
  assert.equal(Math.max(...xs) - Math.min(...xs), 12 * 72); assert.equal(Math.max(...ys) - Math.min(...ys), 12 * 72);
});
test('border width is added on all four sides without changing block replication', () => {
  const plan = planQuiltLayout(blank(12), { WidthInches: 48, HeightInches: 60, BorderInches: 2, BorderColor: '#ffaa00' });
  assert.equal(plan.totalWidth, 52); assert.equal(plan.totalHeight, 64); assert.equal(plan.instances.length, 20); assert.equal(plan.borderColor, '#ffaa00');
  assert.throws(() => planQuiltLayout(blank(), { WidthInches: 8, HeightInches: 8, BorderInches: -1 }), /border/);
});
