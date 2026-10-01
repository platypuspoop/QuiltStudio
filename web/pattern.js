export const POINTS_PER_INCH = 72;
export const SEAM_ALLOWANCE = 0.25;
export const PAPER_SIZES = {
  letter: { label: 'US Letter', width: 612, height: 792 },
  a4: { label: 'A4', width: 210 / 25.4 * 72, height: 297 / 25.4 * 72 },
};

export const QUILT_PRESETS = {
  lap: { label: 'Lap', width: 50, height: 65 },
  twin: { label: 'Twin', width: 70, height: 90 },
  full: { label: 'Full', width: 84, height: 90 },
  queen: { label: 'Queen', width: 90, height: 108 },
  king: { label: 'King', width: 108, height: 108 },
};

export function planQuiltLayout(block, layout = {}) {
  validateBlock(block);
  const width = Number(layout.WidthInches);
  const height = Number(layout.HeightInches);
  if (!Number.isFinite(width) || !Number.isFinite(height) || width < block.WidthInches || height < block.HeightInches || width > 240 || height > 240) {
    throw new Error('Quilt dimensions must fit at least one block and be no larger than 240 inches.');
  }

  const columns = Math.max(1, Math.floor(width / block.WidthInches));
  const rows = Math.max(1, Math.floor(height / block.HeightInches));
  const usedWidth = columns * block.WidthInches;
  const usedHeight = rows * block.HeightInches;
  const offsetX = (width - usedWidth) / 2;
  const offsetY = (height - usedHeight) / 2;
  const alternateMirrors = layout.AlternateMirrors !== false;
  const instances = [];

  for (let row = 0; row < rows; row++) {
    for (let column = 0; column < columns; column++) {
      instances.push({
        row,
        column,
        x: offsetX + column * block.WidthInches,
        y: offsetY + row * block.HeightInches,
        mirrorX: alternateMirrors && (row + column) % 2 === 1,
      });
    }
  }

  return { width, height, columns, rows, usedWidth, usedHeight, offsetX, offsetY, instances };
}

export function validateBlock(block) {
  if (!block || !Number.isFinite(block.WidthInches) || !Number.isFinite(block.HeightInches)
    || block.WidthInches < 1 || block.HeightInches < 1
    || block.WidthInches > 240 || block.HeightInches > 240) {
    throw new Error('Block width and height must be between 1 and 240 inches.');
  }
  if (!Array.isArray(block.Lines) || block.Lines.length > 5000) {
    throw new Error('A block can contain at most 5,000 seam lines.');
  }
  for (const line of block.Lines) {
    for (const point of [line.Start, line.End]) {
      if (!point || !Number.isFinite(point.X) || !Number.isFinite(point.Y)
        || point.X < 0 || point.Y < 0 || point.X > block.WidthInches || point.Y > block.HeightInches) {
        throw new Error('Every seam endpoint must be inside the finished block.');
      }
    }
  }
  return block;
}


const EPSILON = 1e-7;
const samePoint = (a, b, epsilon = 1e-5) => Math.hypot(a.X - b.X, a.Y - b.Y) <= epsilon;

export function segmentIntersection(a, b, c, d) {
  const r = { X: b.X - a.X, Y: b.Y - a.Y };
  const s = { X: d.X - c.X, Y: d.Y - c.Y };
  const cross = (u, v) => u.X * v.Y - u.Y * v.X;
  const denominator = cross(r, s);
  const q = { X: c.X - a.X, Y: c.Y - a.Y };
  if (Math.abs(denominator) < EPSILON) return null;
  const t = cross(q, s) / denominator;
  const u = cross(q, r) / denominator;
  if (t < -EPSILON || t > 1 + EPSILON || u < -EPSILON || u > 1 + EPSILON) return null;
  return { X: a.X + t * r.X, Y: a.Y + t * r.Y, t, u };
}

function boundarySegments(block) {
  const w = block.WidthInches, h = block.HeightInches;
  return [
    { Start: { X: 0, Y: 0 }, End: { X: w, Y: 0 }, BoundaryType: 'section', Border: true },
    { Start: { X: w, Y: 0 }, End: { X: w, Y: h }, BoundaryType: 'section', Border: true },
    { Start: { X: w, Y: h }, End: { X: 0, Y: h }, BoundaryType: 'section', Border: true },
    { Start: { X: 0, Y: h }, End: { X: 0, Y: 0 }, BoundaryType: 'section', Border: true },
  ];
}

export function collectIntersections(block) {
  validateBlock(block);
  const segments = [...boundarySegments(block), ...block.Lines];
  const points = [];
  const add = point => {
    if (!points.some(existing => samePoint(existing, point))) points.push({ X: point.X, Y: point.Y });
  };
  segments.forEach(segment => { add(segment.Start); add(segment.End); });
  for (let i = 0; i < segments.length; i++) {
    for (let j = i + 1; j < segments.length; j++) {
      const hit = segmentIntersection(segments[i].Start, segments[i].End, segments[j].Start, segments[j].End);
      if (hit) add(hit);
    }
  }
  return points;
}

function projectPointToSegment(point, line) {
  const dx = line.End.X - line.Start.X, dy = line.End.Y - line.Start.Y;
  const length2 = dx * dx + dy * dy || 1;
  const t = Math.max(0, Math.min(1, ((point.X - line.Start.X) * dx + (point.Y - line.Start.Y) * dy) / length2));
  const projected = { X: line.Start.X + t * dx, Y: line.Start.Y + t * dy };
  return { ...projected, distance: Math.hypot(point.X - projected.X, point.Y - projected.Y) };
}

export function snapDrawingPoint(block, point, mode = 'intersection', tolerance = 0.3) {
  validateBlock(block);
  if (mode === 'intersection') {
    let best = null;
    for (const candidate of collectIntersections(block)) {
      const distance = Math.hypot(point.X - candidate.X, point.Y - candidate.Y);
      if (distance <= tolerance && (!best || distance < best.distance)) best = { ...candidate, distance };
    }
    return best ? { X: best.X, Y: best.Y } : point;
  }
  if (mode === 'line') {
    let best = null;
    for (const line of [...boundarySegments(block), ...block.Lines]) {
      const projected = projectPointToSegment(point, line);
      if (projected.distance <= tolerance && (!best || projected.distance < best.distance)) best = projected;
    }
    return best ? { X: best.X, Y: best.Y } : point;
  }
  return point;
}


export function findAnchor(block, point, tolerance = 0.3, mode = 'line') {
  validateBlock(block);
  const w = block.WidthInches, h = block.HeightInches;
  const candidates = [];

  const push = (candidate, kind, priority) => {
    const distance = Math.hypot(point.X - candidate.X, point.Y - candidate.Y);
    if (distance <= tolerance) candidates.push({ point: { X: candidate.X, Y: candidate.Y }, kind, distance, priority });
  };

  for (const vertex of collectIntersections(block)) push(vertex, 'vertex', 0);

  const boundary = [
    { X: Math.max(0, Math.min(w, point.X)), Y: 0 },
    { X: w, Y: Math.max(0, Math.min(h, point.Y)) },
    { X: Math.max(0, Math.min(w, point.X)), Y: h },
    { X: 0, Y: Math.max(0, Math.min(h, point.Y)) },
  ];
  boundary.forEach(candidate => push(candidate, 'edge', 2));

  if (mode === 'line') {
    for (const line of block.Lines) {
      const projected = projectPointToSegment(point, line);
      if (projected.distance <= tolerance) candidates.push({
        point: { X: projected.X, Y: projected.Y },
        kind: 'line',
        distance: projected.distance,
        priority: 1,
      });
    }
  }

  candidates.sort((a, b) => a.distance - b.distance || a.priority - b.priority);
  return candidates[0] || null;
}

function pointOnSegmentInterior(point, line, tolerance = 1e-5) {
  const projected = projectPointToSegment(point, line);
  if (projected.distance > tolerance) return false;
  if (samePoint(point, line.Start, tolerance) || samePoint(point, line.End, tolerance)) return false;
  return true;
}

function splitExistingLinesAtPoint(lines, point) {
  const result = [];
  for (const line of lines) {
    if (!pointOnSegmentInterior(point, line)) {
      result.push(line);
      continue;
    }
    result.push(
      { ...line, Id: crypto.randomUUID(), End: { X: point.X, Y: point.Y } },
      { ...line, Id: crypto.randomUUID(), Start: { X: point.X, Y: point.Y } },
    );
  }
  return result;
}

function collinearOverlap(a, b, c, d) {
  const cross = (u, v) => u.X * v.Y - u.Y * v.X;
  const r = { X: b.X - a.X, Y: b.Y - a.Y };
  if (Math.abs(cross(r, { X: c.X - a.X, Y: c.Y - a.Y })) > 1e-6) return false;
  if (Math.abs(cross(r, { X: d.X - a.X, Y: d.Y - a.Y })) > 1e-6) return false;
  const axis = Math.abs(r.X) >= Math.abs(r.Y) ? 'X' : 'Y';
  const a0 = a[axis], a1 = b[axis], c0 = c[axis], c1 = d[axis];
  const min1 = Math.min(a0, a1), max1 = Math.max(a0, a1);
  const min2 = Math.min(c0, c1), max2 = Math.max(c0, c1);
  return Math.min(max1, max2) - Math.max(min1, min2) > 1e-5;
}

export function addConstrainedLine(block, rawStart, toward, options = {}) {
  validateBlock(block);
  const tolerance = options.tolerance ?? 0.3;
  const anchorMode = options.anchorMode ?? 'line';
  const boundaryType = options.boundaryType === 'section' ? 'section' : 'piece';

  const anchor = findAnchor(block, rawStart, tolerance, anchorMode);
  if (!anchor) throw new Error('Start on a block edge, existing line, or intersection.');

  const end = extendLineToNextHit(block, anchor.point, toward);
  if (!end || samePoint(anchor.point, end)) throw new Error('Aim toward another line or block boundary.');

  for (const line of block.Lines) {
    if (collinearOverlap(anchor.point, end, line.Start, line.End)) {
      throw new Error('A new seam cannot overlap an existing seam.');
    }
  }

  let lines = splitExistingLinesAtPoint(block.Lines, anchor.point);
  lines = splitExistingLinesAtPoint(lines, end);
  lines.push({
    Id: crypto.randomUUID(),
    Start: { X: anchor.point.X, Y: anchor.point.Y },
    End: { X: end.X, Y: end.Y },
    BoundaryType: boundaryType,
  });

  return { ...block, Lines: lines };
}

function raySegmentHit(start, direction, line) {
  const r = direction;
  const s = { X: line.End.X - line.Start.X, Y: line.End.Y - line.Start.Y };
  const cross = (u, v) => u.X * v.Y - u.Y * v.X;
  const denominator = cross(r, s);
  if (Math.abs(denominator) < EPSILON) return null;
  const q = { X: line.Start.X - start.X, Y: line.Start.Y - start.Y };
  const t = cross(q, s) / denominator;
  const u = cross(q, r) / denominator;
  if (t <= 1e-5 || u < -EPSILON || u > 1 + EPSILON) return null;
  return { X: start.X + t * r.X, Y: start.Y + t * r.Y, t };
}

export function extendLineToNextHit(block, start, toward) {
  validateBlock(block);
  const direction = { X: toward.X - start.X, Y: toward.Y - start.Y };
  if (Math.hypot(direction.X, direction.Y) < EPSILON) return null;
  let best = null;
  for (const line of [...boundarySegments(block), ...block.Lines]) {
    const hit = raySegmentHit(start, direction, line);
    if (hit && (!best || hit.t < best.t)) best = hit;
  }
  return best ? { X: best.X, Y: best.Y } : null;
}

function splitGeometry(block) {
  const source = [...boundarySegments(block), ...block.Lines.map(line => ({ ...line, BoundaryType: line.BoundaryType || 'piece' }))];
  const vertices = [];
  const vertexIndex = point => {
    let index = vertices.findIndex(existing => samePoint(existing, point));
    if (index < 0) { index = vertices.length; vertices.push({ X: point.X, Y: point.Y }); }
    return index;
  };
  const edges = [];

  source.forEach((segment, index) => {
    const points = [{ ...segment.Start, t: 0 }, { ...segment.End, t: 1 }];
    for (let j = 0; j < source.length; j++) {
      if (j === index) continue;
      const hit = segmentIntersection(segment.Start, segment.End, source[j].Start, source[j].End);
      if (hit && !points.some(point => Math.abs(point.t - hit.t) < 1e-6)) points.push(hit);
    }
    points.sort((a, b) => a.t - b.t);
    for (let i = 0; i < points.length - 1; i++) {
      if (samePoint(points[i], points[i + 1])) continue;
      const a = vertexIndex(points[i]), b = vertexIndex(points[i + 1]);
      const key = a < b ? `${a}:${b}` : `${b}:${a}`;
      if (!edges.some(edge => edge.key === key)) edges.push({ a, b, key, type: segment.BoundaryType || 'piece', border: !!segment.Border });
    }
  });
  return { vertices, edges };
}

const alphaLabel = index => {
  let n = index + 1, label = '';
  while (n > 0) { n--; label = String.fromCharCode(65 + n % 26) + label; n = Math.floor(n / 26); }
  return label;
};

export function analyzePieces(block) {
  validateBlock(block);
  const { vertices, edges } = splitGeometry(block);
  const outgoing = vertices.map(() => []);
  edges.forEach((edge, edgeIndex) => {
    outgoing[edge.a].push({ from: edge.a, to: edge.b, edgeIndex });
    outgoing[edge.b].push({ from: edge.b, to: edge.a, edgeIndex });
  });
  outgoing.forEach((list, vertex) => list.sort((left, right) => {
    const la = Math.atan2(vertices[left.to].Y - vertices[vertex].Y, vertices[left.to].X - vertices[vertex].X);
    const ra = Math.atan2(vertices[right.to].Y - vertices[vertex].Y, vertices[right.to].X - vertices[vertex].X);
    return la - ra;
  }));

  const visited = new Set(), faces = [];
  const directedKey = (a, b) => `${a}>${b}`;
  for (const edge of edges) {
    for (const [start, next] of [[edge.a, edge.b], [edge.b, edge.a]]) {
      if (visited.has(directedKey(start, next))) continue;
      const polygon = [], faceEdges = [];
      let a = start, b = next, guard = 0;
      while (guard++ < edges.length * 4 + 20) {
        const key = directedKey(a, b);
        if (visited.has(key)) break;
        visited.add(key);
        polygon.push(vertices[a]);
        const list = outgoing[b];
        const reverseIndex = list.findIndex(item => item.to === a);
        if (reverseIndex < 0) break;
        const chosen = list[(reverseIndex - 1 + list.length) % list.length];
        faceEdges.push(chosen.edgeIndex);
        a = b; b = chosen.to;
        if (a === start && b === next) break;
      }
      if (polygon.length >= 3) {
        const area = polygon.reduce((sum, point, i) => {
          const q = polygon[(i + 1) % polygon.length];
          return sum + point.X * q.Y - q.X * point.Y;
        }, 0) / 2;
        if (area > 1e-5) {
          const centroid = {
            X: polygon.reduce((sum, point) => sum + point.X, 0) / polygon.length,
            Y: polygon.reduce((sum, point) => sum + point.Y, 0) / polygon.length,
          };
          faces.push({ polygon, area, centroid, edgeIndexes: faceEdges });
        }
      }
    }
  }

  const parents = faces.map((_, i) => i);
  const find = i => parents[i] === i ? i : (parents[i] = find(parents[i]));
  const unite = (a, b) => { a = find(a); b = find(b); if (a !== b) parents[b] = a; };
  const edgeFaces = new Map();
  faces.forEach((face, faceIndex) => face.edgeIndexes.forEach(edgeIndex => {
    if (!edgeFaces.has(edgeIndex)) edgeFaces.set(edgeIndex, []);
    edgeFaces.get(edgeIndex).push(faceIndex);
  }));
  edgeFaces.forEach((faceIndexes, edgeIndex) => {
    if (faceIndexes.length === 2 && edges[edgeIndex].type === 'piece') unite(faceIndexes[0], faceIndexes[1]);
  });

  const groups = new Map();
  faces.forEach((face, i) => {
    const root = find(i);
    if (!groups.has(root)) groups.set(root, []);
    groups.get(root).push(i);
  });
  const sections = [...groups.values()].map(faceIndexes => {
    const centroid = {
      X: faceIndexes.reduce((sum, i) => sum + faces[i].centroid.X * faces[i].area, 0) / faceIndexes.reduce((sum, i) => sum + faces[i].area, 0),
      Y: faceIndexes.reduce((sum, i) => sum + faces[i].centroid.Y * faces[i].area, 0) / faceIndexes.reduce((sum, i) => sum + faces[i].area, 0),
    };
    return { faceIndexes, centroid };
  }).sort((a, b) => a.centroid.Y - b.centroid.Y || a.centroid.X - b.centroid.X);

  sections.forEach((section, sectionIndex) => {
    const letter = alphaLabel(sectionIndex);
    const ordered = [...section.faceIndexes].sort((a, b) => faces[a].centroid.Y - faces[b].centroid.Y || faces[a].centroid.X - faces[b].centroid.X);
    ordered.forEach((faceIndex, pieceIndex) => {
      faces[faceIndex].section = letter;
      faces[faceIndex].label = ordered.length === 1 ? letter : `${letter}${pieceIndex + 1}`;
    });
  });

  return {
    faces,
    edges: edges.map(edge => ({ ...edge, Start: vertices[edge.a], End: vertices[edge.b] })),
  };
}

// All PDF coordinates use points: 72 points are exactly one physical inch.
// Pattern coordinates use a top-left origin and include the outer allowance.
export function planPattern(block, paperKey = 'letter') {
  validateBlock(block);
  const paper = PAPER_SIZES[paperKey];
  if (!paper) throw new Error('Choose US Letter or A4 paper.');
  const margin = 36;
  const tileWidth = paper.width - margin * 2;
  const tileHeight = paper.height - 86.4 - 158.4;
  const overlap = 18;
  const width = (block.WidthInches + 2 * SEAM_ALLOWANCE) * 72;
  const height = (block.HeightInches + 2 * SEAM_ALLOWANCE) * 72;
  const columns = 1 + Math.ceil(Math.max(0, width - tileWidth) / (tileWidth - overlap));
  const rows = 1 + Math.ceil(Math.max(0, height - tileHeight) / (tileHeight - overlap));
  const tiles = [];
  for (let row = 0; row < rows; row++) {
    for (let column = 0; column < columns; column++) {
      tiles.push({ row, column, x: column * (tileWidth - overlap), y: row * (tileHeight - overlap) });
    }
  }
  const lines = block.Lines.map(line => ({
    start: { x: (SEAM_ALLOWANCE + block.WidthInches - line.Start.X) * 72, y: (SEAM_ALLOWANCE + line.Start.Y) * 72 },
    end: { x: (SEAM_ALLOWANCE + block.WidthInches - line.End.X) * 72, y: (SEAM_ALLOWANCE + line.End.Y) * 72 },
  }));
  return { paper, margin, tileWidth, tileHeight, overlap, width, height, columns, rows, tiles, lines, patternTop: paper.height - 86.4 };
}

// Liang-Barsky clipping keeps vector strokes inside the printable tile.
export function clipLine(start, end, rect) {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  let low = 0, high = 1;
  const p = [-dx, dx, -dy, dy];
  const q = [start.x - rect.x, rect.x + rect.width - start.x, start.y - rect.y, rect.y + rect.height - start.y];
  for (let i = 0; i < 4; i++) {
    if (p[i] === 0) { if (q[i] < 0) return null; }
    else {
      const ratio = q[i] / p[i];
      if (p[i] < 0) low = Math.max(low, ratio);
      else high = Math.min(high, ratio);
      if (low > high) return null;
    }
  }
  return { start: { x: start.x + low * dx, y: start.y + low * dy }, end: { x: start.x + high * dx, y: start.y + high * dy } };
}

export function demoProject() {
  const blockId = crypto.randomUUID();
  return {
    SchemaVersion: 1,
    Name: 'First light',
    Blocks: [{
      Id: blockId, Name: 'First light', WidthInches: 12, HeightInches: 12,
      GridSizeInches: 0.25, SourceImageOpacity: 0.35, DrawingSnapMode: 'intersection',
      Lines: [[0, 0, 8, 12], [0, 5, 12, 5], [8, 12, 12, 5], [0, 10, 8, 12], [4, 0, 12, 5]].map(([x1, y1, x2, y2]) => ({
        Id: crypto.randomUUID(), Start: { X: x1, Y: y1 }, End: { X: x2, Y: y2 }, BoundaryType: 'piece',
      })),
    }],
    Layout: { Preset: 'queen', WidthInches: 90, HeightInches: 108, AlternateMirrors: true, DesignMode: 'repeat', RepeatBlockId: blockId, LargeBlockId: null, Instances: [] },
  };
}

export function parseProject(text) {
  let project;
  try { project = JSON.parse(text); } catch { throw new Error('This file is not a valid QuiltStudio project.'); }
  if (project?.SchemaVersion !== 1 || !Array.isArray(project.Blocks) || project.Blocks.length === 0 || project.Blocks.length > 100) {
    throw new Error('Open a version 1 QuiltStudio project containing 1–100 blocks.');
  }
  if (!project.Layout || typeof project.Layout !== 'object') {
    project.Layout = { Preset: 'queen', WidthInches: 90, HeightInches: 108, AlternateMirrors: true, DesignMode: 'repeat', RepeatBlockId: project.Blocks[0]?.Id || null, LargeBlockId: null, Instances: [] };
  } else {
    if (!Number.isFinite(project.Layout.WidthInches)) project.Layout.WidthInches = 90;
    if (!Number.isFinite(project.Layout.HeightInches)) project.Layout.HeightInches = 108;
    if (typeof project.Layout.AlternateMirrors !== 'boolean') project.Layout.AlternateMirrors = true;
    if (typeof project.Layout.Preset !== 'string') project.Layout.Preset = 'custom';
    if (!['repeat', 'large'].includes(project.Layout.DesignMode)) project.Layout.DesignMode = 'repeat';
    if (!project.Layout.RepeatBlockId) project.Layout.RepeatBlockId = project.Blocks[0]?.Id || null;
    if (!('LargeBlockId' in project.Layout)) project.Layout.LargeBlockId = null;
    if (!Array.isArray(project.Layout.Instances)) project.Layout.Instances = [];
  }

  project.Blocks.forEach(block => {
    validateBlock(block);
    if (typeof block.Name !== 'string' || block.Name.length > 200) throw new Error('Block names must be text with at most 200 characters.');
    if (!['intersection', 'line'].includes(block.DrawingSnapMode)) block.DrawingSnapMode = 'intersection';
    block.Lines.forEach(line => { if (!['piece', 'section'].includes(line.BoundaryType)) line.BoundaryType = 'piece'; });
    if (block.SourceImageBase64 && (typeof block.SourceImageBase64 !== 'string' || block.SourceImageBase64.length > 14_000_000)) {
      throw new Error('Embedded images must be smaller than 10 MB.');
    }
  });
  return project;
}
