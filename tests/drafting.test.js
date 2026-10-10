import { test } from 'node:test';
import assert from 'node:assert/strict';
import { addCircle, addFreeArc, addConstrainedLine, applySymmetry, arcBend, previewFreeArc, analyzePieces, labelSections, planSectionPatterns, pointInFace, facePath, gridSpec, snapToGrid, planQuiltLayout, transformBlockPoint, deleteDraft, setPieceSetting, parseProject } from '../web/pattern.js';
const blank = () => ({ Id: 'draft', Name: 'Draft', WidthInches: 4, HeightInches: 4, Lines: [], LabelsReady: false });

test('full circle creates two closed pieces, not overlapping fills, and prints perimeter only', () => {
  const b = addCircle(blank(), { X: 2, Y: 2 }, 1);
  const a = analyzePieces(b);
  assert.equal(a.faces.length, 2);
  assert.ok(Math.abs(a.faces.reduce((n, f) => n + f.area, 0) - 16) < 1e-6);
  assert.equal(a.faces.filter(f => pointInFace({ X: 2, Y: 2 }, f)).length, 1);
  const outside = a.faces.find(f => f.holes.length);
  assert.ok(pointInFace(outside.centroid, outside));
  assert.equal((facePath(outside).match(/M/g) || []).length, 2);
  assert.throws(() => planSectionPatterns(b), /Label/);
  const labeled = labelSections(b);
  assert.equal(labeled.LabelsReady, true);
  const plans = planSectionPatterns(labeled);
  assert.equal(plans.length, 1);
  assert.equal(plans[0].outlines.length, 1);
  assert.equal(plans[0].cuts.length, 4);
  assert.equal(deleteDraft(b, 0).Lines.length, 0);
});

test('nested circles preserve full area and correctly locate all three pieces', () => {
  const b = addCircle(addCircle(blank(), { X: 2, Y: 2 }, 1.5), { X: 2, Y: 2 }, .6);
  const faces = analyzePieces(b).faces;
  assert.equal(faces.length, 3);
  assert.ok(Math.abs(faces.reduce((n, f) => n + f.area, 0) - 16) < 1e-6);
  for (const p of [{ X: 2, Y: 2 }, { X: 3, Y: 2 }, { X: .1, Y: .1 }]) assert.equal(faces.filter(f => pointInFace(p, f)).length, 1);
  const plans = planSectionPatterns(labelSections(b));
  assert.ok(plans.some(p => p.loops.some(loop => loop.length === 4)));
  assert.ok(plans.every(p => p.outlines.length === p.loops.length));
});

test('free half and quarter arcs retain the curve and extend tails to boundaries', () => {
  for (const kind of ['half', 'quarter']) {
    const start = { X: 1, Y: 1 }, end = { X: 3, Y: 1 }, bend = arcBend(start, end);
    const preview = previewFreeArc(blank(), start, end, bend, kind);
    assert.ok(preview.length > 10);
    assert.ok(preview.some(p => p.Y > 1.2));
    assert.ok(preview[0].X === 0 || preview[0].Y === 0 || preview[0].X === 4 || preview[0].Y === 4);
    const b = addFreeArc(blank(), start, end, bend, { kind });
    assert.equal(analyzePieces(b).faces.length, 2);
    assert.deepEqual(b.Lines.map(l => l.Start), preview.slice(0, -1));
    assert.equal(planSectionPatterns(labelSections(b)).length, 1);
  }
});

test('fine grid defaults to 100 by 100 and supports independent dimensions and inch spacing', () => {
  assert.deepEqual(gridSpec(blank()), { stepX: .04, stepY: .04 });
  assert.deepEqual(snapToGrid(blank(), { X: 1.013, Y: 2.019 }), { X: 1, Y: 2 });
  assert.deepEqual(gridSpec({ ...blank(), GridColumns: 200, GridRows: 50 }), { stepX: .02, stepY: .08 });
  assert.deepEqual(gridSpec({ ...blank(), GridMode: 'inches', GridSizeInches: .125 }), { stepX: .125, stepY: .125 });
  assert.throws(() => gridSpec({ ...blank(), GridColumns: 0 }), /grid/i);
});

test('individual block transforms override alternation without affecting other cells', () => {
  const layout = { WidthInches: 8, HeightInches: 4, BlockTransforms: { 'draft:0:0': { mirrorY: true, rotation: 90 } } };
  const [a, b] = planQuiltLayout(blank(), layout).instances;
  assert.equal(a.mirrorY, true); assert.equal(b.mirrorY, false); assert.equal(b.mirrorX, true);
  assert.deepEqual(transformBlockPoint(blank(), a, { X: 1, Y: 2 }), { X: 2, Y: 1 });
  assert.throws(() => planQuiltLayout({ ...blank(), WidthInches: 3 }, layout), /square/);
});

test('colors in a circle survive labeling and project round trip', () => {
  let b = addCircle(blank(), { X: 2, Y: 2 }, 1);
  const center = analyzePieces(b).faces.find(f => pointInFace({ X: 2, Y: 2 }, f));
  b = setPieceSetting(b, center.key, { Color: '#ffff00' });
  b = labelSections(b);
  const saved = parseProject(JSON.stringify({ SchemaVersion: 1, Blocks: [b] }));
  const face = analyzePieces(saved.Blocks[0]).faces.find(f => pointInFace({ X: 2, Y: 2 }, f));
  assert.equal(face.color, '#ffff00'); assert.ok(face.label);
});

test('circle symmetry and seam crossings retain closed pieces and full block area', () => {
  const base = blank();
  const mirrored = applySymmetry(base, addCircle(base, { X: 1, Y: 1 }, .5), true, true);
  const crossed = addCircle(addConstrainedLine(base, { X: 0, Y: 2 }, { X: 3, Y: 2 }), { X: 2, Y: 2 }, 1, { crossLines: true });
  for (const [b, count] of [[mirrored, 5], [crossed, 4]]) {
    const faces = analyzePieces(b).faces;
    assert.equal(faces.length, count);
    assert.ok(Math.abs(faces.reduce((n, f) => n + f.area, 0) - 16) < 1e-6);
    assert.ok(planSectionPatterns(labelSections(b)).length);
  }
});

test('editing labeled geometry invalidates print readiness until labeling is requested again', () => {
  const b = addConstrainedLine(labelSections(blank()), { X: 0, Y: 2 }, { X: 3, Y: 2 });
  assert.equal(b.LabelsReady, false);
  assert.throws(() => planSectionPatterns(b), /Label/);
  assert.equal(planSectionPatterns(labelSections(b)).length, 1);
});
