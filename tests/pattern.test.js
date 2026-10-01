import test from 'node:test';
import assert from 'node:assert/strict';
import { addConstrainedLine, analyzePieces, collectIntersections, extendLineToNextHit, findAnchor, planPattern, planQuiltLayout, QUILT_PRESETS, clipLine, demoProject, parseProject, segmentIntersection, snapDrawingPoint, validateBlock } from '../web/pattern.js';

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
  for (const size of [0, -1, Infinity, NaN, 241]) assert.throws(() => planPattern(makeBlock(size, 4)));
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


test('segment intersection returns exact crossing coordinates', () => {
  const hit = segmentIntersection(
    { X: 0, Y: 5 }, { X: 10, Y: 5 },
    { X: 6, Y: 0 }, { X: 6, Y: 10 },
  );
  assert.equal(hit.X, 6);
  assert.equal(hit.Y, 5);
});

test('drawn lines extend until the next seam or block boundary', () => {
  const block = makeBlock(10, 10);
  block.Lines = [{ Start: { X: 6, Y: 0 }, End: { X: 6, Y: 10 }, BoundaryType: 'piece' }];
  assert.deepEqual(
    extendLineToNextHit(block, { X: 0, Y: 5 }, { X: 4, Y: 5 }),
    { X: 6, Y: 5 },
  );
  assert.deepEqual(
    extendLineToNextHit(makeBlock(10, 10), { X: 2, Y: 2 }, { X: 8, Y: 2 }),
    { X: 10, Y: 2 },
  );
});

test('intersection snapping and anywhere-on-line snapping are distinct', () => {
  const block = makeBlock(10, 10);
  block.Lines = [
    { Start: { X: 5, Y: 0 }, End: { X: 5, Y: 10 }, BoundaryType: 'piece' },
    { Start: { X: 0, Y: 4 }, End: { X: 10, Y: 4 }, BoundaryType: 'piece' },
  ];
  assert.ok(collectIntersections(block).some(point => point.X === 5 && point.Y === 4));
  assert.deepEqual(snapDrawingPoint(block, { X: 5.08, Y: 4.05 }, 'intersection', 0.2), { X: 5, Y: 4 });
  assert.deepEqual(snapDrawingPoint(block, { X: 5.08, Y: 7 }, 'line', 0.2), { X: 5, Y: 7 });
});

test('piece seams share a section label while section boundaries split allowances', () => {
  const internal = makeBlock(10, 10);
  internal.Lines = [{ Start: { X: 0, Y: 5 }, End: { X: 10, Y: 5 }, BoundaryType: 'piece' }];
  const joined = analyzePieces(internal);
  assert.equal(joined.faces.length, 2);
  assert.deepEqual(joined.faces.map(face => face.label).sort(), ['A1', 'A2']);

  const separated = makeBlock(10, 10);
  separated.Lines = [{ Start: { X: 0, Y: 5 }, End: { X: 10, Y: 5 }, BoundaryType: 'section' }];
  const split = analyzePieces(separated);
  assert.equal(split.faces.length, 2);
  assert.deepEqual(split.faces.map(face => face.label).sort(), ['A', 'B']);
  assert.ok(split.edges.some(edge => edge.type === 'section' && !edge.border));
});

test('quilt-size blocks up to 240 inches are valid', () => {
  assert.doesNotThrow(() => validateBlock(makeBlock(108, 108)));
  assert.throws(() => validateBlock(makeBlock(241, 108)), /240/);
});


test('floating starts are rejected while block edges and existing lines are valid anchors', () => {
  const block = makeBlock(10, 10);
  assert.equal(findAnchor(block, { X: 5, Y: 5 }, 0.2, 'line'), null);
  assert.equal(findAnchor(block, { X: 0.05, Y: 4 }, 0.2, 'line').kind, 'edge');

  block.Lines = [{ Id: 'v', Start: { X: 5, Y: 0 }, End: { X: 5, Y: 10 }, BoundaryType: 'piece' }];
  const lineAnchor = findAnchor(block, { X: 5.05, Y: 7 }, 0.2, 'line');
  assert.equal(lineAnchor.kind, 'line');
  assert.ok(Math.abs(lineAnchor.point.X - 5) < 1e-9);
  assert.ok(Math.abs(lineAnchor.point.Y - 7) < 1e-9);
});

test('edge-to-edge constrained line reaches the opposite block boundary', () => {
  const block = makeBlock(10, 10);
  const next = addConstrainedLine(block, { X: 0, Y: 5 }, { X: 4, Y: 5 }, { tolerance: 0.2 });
  assert.equal(next.Lines.length, 1);
  assert.deepEqual(next.Lines[0].Start, { X: 0, Y: 5 });
  assert.deepEqual(next.Lines[0].End, { X: 10, Y: 5 });
});

test('edge-to-line stops at the first existing seam and does not cross it', () => {
  const block = makeBlock(10, 10);
  block.Lines = [{ Id: 'v', Start: { X: 6, Y: 0 }, End: { X: 6, Y: 10 }, BoundaryType: 'piece' }];
  const next = addConstrainedLine(block, { X: 0, Y: 5 }, { X: 4, Y: 5 }, { tolerance: 0.2 });
  const created = next.Lines.find(line => line.Start.X === 0 && line.Start.Y === 5);
  assert.deepEqual(created.End, { X: 6, Y: 5 });
  assert.equal(next.Lines.some(line => line.Start.X === 6 && line.End.X === 10 && line.Start.Y === 5), false);
});

test('line-to-edge starts on an existing seam and splits that seam at the new vertex', () => {
  const block = makeBlock(10, 10);
  block.Lines = [{ Id: 'v', Start: { X: 5, Y: 0 }, End: { X: 5, Y: 10 }, BoundaryType: 'piece' }];
  const next = addConstrainedLine(block, { X: 5.03, Y: 4 }, { X: 9, Y: 4 }, { tolerance: 0.2 });
  assert.equal(next.Lines.length, 3);
  assert.ok(next.Lines.some(line => line.Start.X === 5 && line.Start.Y === 0 && line.End.X === 5 && line.End.Y === 4));
  assert.ok(next.Lines.some(line => line.Start.X === 5 && line.Start.Y === 4 && line.End.X === 5 && line.End.Y === 10));
  assert.ok(next.Lines.some(line => line.Start.X === 5 && line.Start.Y === 4 && line.End.X === 10 && line.End.Y === 4));
});

test('line-to-line splits both touched seams and creates one terminating segment', () => {
  const block = makeBlock(12, 10);
  block.Lines = [
    { Id: 'left', Start: { X: 3, Y: 0 }, End: { X: 3, Y: 10 }, BoundaryType: 'piece' },
    { Id: 'right', Start: { X: 9, Y: 0 }, End: { X: 9, Y: 10 }, BoundaryType: 'piece' },
  ];
  const next = addConstrainedLine(block, { X: 3.02, Y: 6 }, { X: 7, Y: 6 }, { tolerance: 0.2 });
  assert.equal(next.Lines.length, 5);
  assert.ok(next.Lines.some(line => line.Start.X === 3 && line.Start.Y === 6 && line.End.X === 9 && line.End.Y === 6));
  assert.ok(next.Lines.filter(line => line.Start.X === 3 && line.End.X === 3).length === 2);
  assert.ok(next.Lines.filter(line => line.Start.X === 9 && line.End.X === 9).length === 2);
});

test('existing intersection is a valid origin for a diagonal constrained seam', () => {
  const block = makeBlock(10, 10);
  block.Lines = [
    { Id: 'h', Start: { X: 0, Y: 5 }, End: { X: 10, Y: 5 }, BoundaryType: 'piece' },
    { Id: 'v', Start: { X: 5, Y: 0 }, End: { X: 5, Y: 10 }, BoundaryType: 'piece' },
  ];
  const anchor = findAnchor(block, { X: 5.04, Y: 5.03 }, 0.2, 'line');
  assert.equal(anchor.kind, 'vertex');
  const next = addConstrainedLine(block, anchor.point, { X: 8, Y: 8 }, { tolerance: 0.2 });
  assert.ok(next.Lines.some(line => line.Start.X === 5 && line.Start.Y === 5 && line.End.X === 10 && line.End.Y === 10));
});

test('multiple sequential subdivisions remain planar and increase the face count', () => {
  let block = makeBlock(10, 10);
  block = addConstrainedLine(block, { X: 0, Y: 5 }, { X: 4, Y: 5 }, { tolerance: 0.2 });
  assert.equal(analyzePieces(block).faces.length, 2);
  block = addConstrainedLine(block, { X: 5, Y: 0 }, { X: 5, Y: 4 }, { tolerance: 0.2 });
  assert.equal(analyzePieces(block).faces.length, 3);
});

test('constrained line creation returns a new block so one undo checkpoint can restore prior geometry', () => {
  const block = makeBlock(10, 10);
  const before = structuredClone(block);
  const next = addConstrainedLine(block, { X: 0, Y: 5 }, { X: 5, Y: 5 }, { tolerance: 0.2 });
  assert.deepEqual(block, before);
  assert.notDeepEqual(next, before);
});
