import test from 'node:test';
import assert from 'node:assert/strict';
import { addConstrainedLine, findAnchor, snapDrawingPoint } from '../web/pattern.js';
const block = () => ({ Name: 'Dense grid', WidthInches: 4, HeightInches: 4, GridColumns: 100, GridRows: 100, Lines: [
  { Id: 'h', Start: { X: 0, Y: 2 }, End: { X: 4, Y: 2 } },
  { Id: 'v', Start: { X: 2, Y: 0 }, End: { X: 2, Y: 4 } },
] });

test('every grid mark on each block edge stays selectable near corners and seams', () => {
  const b = block();
  for (let i = 1; i < 100; i++) for (const p of [{ X: 0, Y: i * .04 }, { X: 4, Y: i * .04 }, { X: i * .04, Y: 0 }, { X: i * .04, Y: 4 }]) {
    const anchor = findAnchor(b, p, .3, 'line', true);
    assert.ok(Math.hypot(anchor.point.X - p.X, anchor.point.Y - p.Y) < 1e-9, JSON.stringify(p));
  }
});

test('grid points on a seam are not pulled into a neighboring intersection', () => {
  const b = block();
  for (const p of [{ X: 1.96, Y: 2 }, { X: 2.04, Y: 2 }, { X: 2, Y: 1.96 }, { X: 2, Y: 2.04 }]) {
    assert.deepEqual(findAnchor(b, p, .3, 'line', true).point, p);
    assert.deepEqual(snapDrawingPoint(b, p, 'intersection', .3, true), p);
  }
  assert.deepEqual(findAnchor(b, { X: 2, Y: 2 }, .3, 'line', true).point, { X: 2, Y: 2 });
  assert.deepEqual(snapDrawingPoint(b, { X: 2.04, Y: 2 }, 'intersection', .3, false), { X: 2, Y: 2 });
});

test('a precise seam origin stays exact when the constrained line is committed', () => {
  const b = block(), start = { X: 2.04, Y: 2 };
  const next = addConstrainedLine(b, findAnchor(b, start, .3, 'line', true).point, { X: 2.04, Y: 4 }, { tolerance: 1e-5 });
  const seam = next.Lines.at(-1);
  assert.deepEqual(seam.Start, start); assert.deepEqual(seam.End, { X: 2.04, Y: 4 });
});
