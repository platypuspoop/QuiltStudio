import test from 'node:test';
import assert from 'node:assert/strict';
import { planPattern, planQuiltLayout, QUILT_PRESETS, clipLine, demoProject, parseProject, validateBlock } from '../web/pattern.js';

const makeBlock = (width = 4, height = 4) => ({ Name: 'Test block', WidthInches: width, HeightInches: height, Lines: [] });

test('a 4-inch finished block has a 4.5-inch cutting outline with quarter-inch allowance', () => {
  const plan = planPattern(makeBlock());
  assert.equal(plan.width, 324);
  assert.equal(plan.height, 324);
  assert.equal(plan.tiles.length, 1);
  assert.deepEqual([plan.paper.width, plan.paper.height], [612, 792]);
});

test('mirroring preserves length and reflects asymmetric endpoints exactly', () => {
  const block = makeBlock();
  block.Lines = [{ Start: { X: 0.5, Y: 1 }, End: { X: 2.5, Y: 1 } }];
  const plan = planPattern(block);
  assert.deepEqual(plan.lines[0], { start: { x: 270, y: 90 }, end: { x: 126, y: 90 } });
  assert.equal(Math.abs(plan.lines[0].end.x - plan.lines[0].start.x), 144);
  assert.equal(block.Lines[0].Start.X, 0.5, 'Export must not change the design');
});

test('12-inch blocks tile across four Letter sheets with quarter-inch overlap', () => {
  const plan = planPattern(makeBlock(12, 12));
  assert.equal(plan.columns, 2);
  assert.equal(plan.rows, 2);
  assert.equal(plan.tiles.length, 4);
  assert.equal(plan.tiles[1].x, plan.tileWidth - 18);
  assert.equal(plan.tiles[2].y, plan.tileHeight - 18);
});

test('tiles cover the full cutting outline for small, rectangular, and maximum blocks on both papers', () => {
  for (const paper of ['letter', 'a4']) {
    for (const [width, height] of [[1, 1], [7, 10], [12, 12], [24, 18], [60, 60]]) {
      const plan = planPattern(makeBlock(width, height), paper);
      const last = plan.tiles.at(-1);
      assert.ok(last.x + plan.tileWidth >= plan.width);
      assert.ok(last.y + plan.tileHeight >= plan.height);
      for (const tile of plan.tiles) {
        assert.ok(tile.x >= 0 && tile.y >= 0);
        assert.ok(tile.x < plan.width && tile.y < plan.height, 'No entirely blank tiles');
      }
    }
  }
});

test('an exactly fitting cutting outline stays on one page', () => {
  const reference = planPattern(makeBlock());
  const plan = planPattern(makeBlock(reference.tileWidth / 72 - 0.5, reference.tileHeight / 72 - 0.5));
  assert.equal(plan.tiles.length, 1);
});

test('A4 uses physical ISO dimensions rather than rounded screen pixels', () => {
  const plan = planPattern(makeBlock(), 'a4');
  assert.ok(Math.abs(plan.paper.width / 72 * 25.4 - 210) < 1e-9);
  assert.ok(Math.abs(plan.paper.height / 72 * 25.4 - 297) < 1e-9);
});

test('clipping handles crossing, outside, parallel, boundary, and reversed lines', () => {
  const rect = { x: 0, y: 0, width: 10, height: 10 };
  assert.deepEqual(clipLine({ x: -2, y: 5 }, { x: 12, y: 5 }, rect), { start: { x: 0, y: 5 }, end: { x: 10, y: 5 } });
  assert.deepEqual(clipLine({ x: 12, y: 5 }, { x: -2, y: 5 }, rect), { start: { x: 10, y: 5 }, end: { x: 0, y: 5 } });
  assert.equal(clipLine({ x: -1, y: 0 }, { x: -1, y: 10 }, rect), null);
  assert.equal(clipLine({ x: 1, y: 12 }, { x: 9, y: 12 }, rect), null);
  assert.deepEqual(clipLine({ x: 0, y: 0 }, { x: 10, y: 0 }, rect), { start: { x: 0, y: 0 }, end: { x: 10, y: 0 } });
  assert.deepEqual(clipLine({ x: -5, y: -5 }, { x: 15, y: 15 }, rect), { start: { x: 0, y: 0 }, end: { x: 10, y: 10 } });
});

test('invalid dimensions and out-of-bounds geometry fail instead of generating misleading output', () => {
  for (const size of [0, -1, Infinity, NaN, 61]) assert.throws(() => planPattern(makeBlock(size, 4)));
  const block = makeBlock();
  block.Lines = [{ Start: { X: 0, Y: 0 }, End: { X: 5, Y: 3 } }];
  assert.throws(() => validateBlock(block), /inside/);
  assert.throws(() => planPattern(makeBlock(), 'unknown'), /paper/);
});

test('project JSON preserves block IDs, embedded images, and Windows layout data', () => {
  const project = demoProject();
  project.Blocks[0].SourceImageBase64 = 'aGVsbG8=';
  project.Layout.Instances = [{ BlockDefinitionId: project.Blocks[0].Id, XInches: 2, YInches: 3, RotationDegrees: 90 }];
  assert.deepEqual(parseProject(JSON.stringify(project)), project);
});

test('invalid, empty, and newer-version project files are rejected', () => {
  assert.throws(() => parseProject('bad json'), /valid/);
  assert.throws(() => parseProject('null'), /version 1/);
  assert.throws(() => parseProject('{"SchemaVersion":1,"Blocks":[]}'), /version 1/);
  const project = demoProject();
  project.SchemaVersion = 2;
  assert.throws(() => parseProject(JSON.stringify(project)), /version 1/);
});


test('standard quilt presets expose common finished quilt sizes', () => {
  assert.deepEqual(QUILT_PRESETS.queen, { label: 'Queen', width: 90, height: 108 });
  assert.deepEqual(QUILT_PRESETS.king, { label: 'King', width: 108, height: 108 });
});

test('quilt layout repeats blocks and alternates mirrors like a checkerboard', () => {
  const block = makeBlock(12, 12);
  const layout = planQuiltLayout(block, { WidthInches: 36, HeightInches: 24, AlternateMirrors: true });
  assert.equal(layout.columns, 3);
  assert.equal(layout.rows, 2);
  assert.equal(layout.instances.length, 6);
  assert.deepEqual(layout.instances.map(item => item.mirrorX), [false, true, false, true, false, true]);
});

test('quilt layout centers leftover space around the repeated block field', () => {
  const block = makeBlock(12, 12);
  const layout = planQuiltLayout(block, { WidthInches: 50, HeightInches: 65, AlternateMirrors: true });
  assert.equal(layout.columns, 4);
  assert.equal(layout.rows, 5);
  assert.equal(layout.usedWidth, 48);
  assert.equal(layout.usedHeight, 60);
  assert.equal(layout.offsetX, 1);
  assert.equal(layout.offsetY, 2.5);
});

test('quilt layout can repeat without mirroring', () => {
  const block = makeBlock(10, 10);
  const layout = planQuiltLayout(block, { WidthInches: 30, HeightInches: 20, AlternateMirrors: false });
  assert.ok(layout.instances.every(item => item.mirrorX === false));
});
