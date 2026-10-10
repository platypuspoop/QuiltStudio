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
      const key = `${block.Id || 'block'}:${row}:${column}`;
      const custom = layout.BlockTransforms?.[key] || {};
      if (['mirrorX', 'mirrorY'].some(axis => custom[axis] != null && typeof custom[axis] !== 'boolean')) throw new Error('Block reflections must be on or off.');
      const rotation = custom.rotation ?? 0;
      if (![0, 90, 180, 270].includes(rotation) || rotation % 180 && Math.abs(block.WidthInches - block.HeightInches) > EPSILON) throw new Error('Quarter-turn rotations require a square block.');
      instances.push({
        key,
        row,
        column,
        x: offsetX + column * block.WidthInches,
        y: offsetY + row * block.HeightInches,
        mirrorX: custom.mirrorX ?? (alternateMirrors && (row + column) % 2 === 1),
        mirrorY: custom.mirrorY ?? false,
        rotation,
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
  gridSpec(block);
  if (block.LabelsReady != null && typeof block.LabelsReady !== 'boolean') throw new Error('Invalid labeling state.');
  for (const line of block.Lines) {
    for (const point of [line.Start, line.End]) {
      if (!point || !Number.isFinite(point.X) || !Number.isFinite(point.Y)
        || point.X < 0 || point.Y < 0 || point.X > block.WidthInches || point.Y > block.HeightInches) {
        throw new Error('Every seam endpoint must be inside the finished block.');
      }
    }
  }
  if (block.PieceSettings != null) {
    if (typeof block.PieceSettings !== 'object' || Array.isArray(block.PieceSettings) || Object.keys(block.PieceSettings).length > 10000) throw new Error('Invalid piece settings.');
    for (const setting of Object.values(block.PieceSettings)) {
      if (!setting || typeof setting !== 'object' || setting.Label && !/^[A-Z]{1,3}[1-9]\d{0,3}$/.test(setting.Label) || setting.Color && !/^#[0-9a-f]{6}$/i.test(setting.Color)) throw new Error('Invalid piece label or color.');
      if (setting.Polygon && (!Array.isArray(setting.Polygon) || setting.Polygon.length > 5000 || setting.Polygon.some(p => !p || !Number.isFinite(p.X) || !Number.isFinite(p.Y)))) throw new Error('Invalid saved piece geometry.');
      if (setting.Holes && (!Array.isArray(setting.Holes) || setting.Holes.length > 5000 || setting.Holes.some(ring => !Array.isArray(ring) || ring.length > 5000 || ring.some(p => !p || !Number.isFinite(p.X) || !Number.isFinite(p.Y))))) throw new Error('Invalid saved piece holes.');
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

  candidates.sort((a, b) => a.priority - b.priority || a.distance - b.distance);
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
      { ...line, DraftId: line.DraftId || line.Id, Id: crypto.randomUUID(), End: { X: point.X, Y: point.Y } },
      { ...line, DraftId: line.DraftId || line.Id, Id: crypto.randomUUID(), Start: { X: point.X, Y: point.Y } },
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

  const end = extendLineToNextHit(block, anchor.point, toward, options.crossLines);
  if (!end || samePoint(anchor.point, end)) throw new Error('Aim toward another line or block boundary.');

  for (const line of [...boundarySegments(block), ...block.Lines]) {
    if (collinearOverlap(anchor.point, end, line.Start, line.End)) {
      throw new Error('A new seam cannot overlap an existing seam.');
    }
  }

  let lines = splitExistingLinesAtPoint(block.Lines.map((line, i) => ({ ...line, DraftId: line.DraftId || line.Id || `legacy-${i}`, Order: line.Order ?? i })), anchor.point);
  lines = splitExistingLinesAtPoint(lines, end);
  const draftId = options.draftId || crypto.randomUUID();
  const order = Math.max(-1, ...block.Lines.map((line, i) => line.Order ?? i)) + 1;
  const cuts = [anchor.point, end];
  if (options.crossLines) {
    for (const line of lines) {
      const hit = segmentIntersection(anchor.point, end, line.Start, line.End);
      if (hit && !cuts.some(p => samePoint(p, hit))) cuts.push({ X: hit.X, Y: hit.Y });
    }
    cuts.sort((a, b) => Math.hypot(a.X - anchor.point.X, a.Y - anchor.point.Y) - Math.hypot(b.X - anchor.point.X, b.Y - anchor.point.Y));
    for (const point of cuts) lines = splitExistingLinesAtPoint(lines, point);
  }
  for (let i = 0; i < cuts.length - 1; i++) lines.push({
    Id: crypto.randomUUID(), DraftId: draftId, Order: order,
    Start: { ...cuts[i] },
    End: { ...cuts[i + 1] },
    BoundaryType: boundaryType,
  });

  return validateBlock({ ...block, LabelsReady: block.LabelsReady == null ? undefined : false, Lines: lines });
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

export function extendLineToNextHit(block, start, toward, crossLines = false) {
  validateBlock(block);
  const direction = { X: toward.X - start.X, Y: toward.Y - start.Y };
  if (Math.hypot(direction.X, direction.Y) < EPSILON) return null;
  let best = null;
  for (const line of [...boundarySegments(block), ...(crossLines ? [] : block.Lines)]) {
    const hit = raySegmentHit(start, direction, line);
    if (hit && (!best || hit.t < best.t)) best = hit;
  }
  return best ? { X: Math.max(0, Math.min(block.WidthInches, best.X)), Y: Math.max(0, Math.min(block.HeightInches, best.Y)) } : null;
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
      if (!edges.some(edge => edge.key === key)) edges.push({ a, b, key, type: segment.BoundaryType || 'piece', border: !!segment.Border, sourceId: segment.DraftId || segment.Id || `legacy-${index}`, order: segment.Order ?? index, curved: !!segment.Curve });
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

  const visited = new Set(), faces = [], negativeRings = [];
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
        faceEdges.push(list[reverseIndex].edgeIndex);
        a = b; b = chosen.to;
        if (a === start && b === next) break;
      }
      if (polygon.length >= 3) {
        const area = polygon.reduce((sum, point, i) => {
          const q = polygon[(i + 1) % polygon.length];
          return sum + point.X * q.Y - q.X * point.Y;
        }, 0) / 2;
        if (area > 1e-5) {
          const centroid = interiorPoint(polygon, area);
          faces.push({ polygon, holes: [], rings: [{ polygon, edgeIndexes: faceEdges }], area, centroid, edgeIndexes: faceEdges });
        } else if (area < -1e-5) {
          negativeRings.push({ polygon, edgeIndexes: faceEdges, area });
        }
      }
    }
  }

  // Disconnected closed curves create an island and a hole in the containing
  // face. Attach the reverse ring to its smallest enclosing positive face.
  for (const ring of negativeRings) {
    const owner = faces.filter(f => !ring.edgeIndexes.some(i => f.edgeIndexes.includes(i)) && pointInPolygon(ring.polygon[0], f.polygon))
      .sort((a, b) => polygonArea(a.polygon) - polygonArea(b.polygon))[0];
    if (!owner) continue;
    owner.holes.push(ring.polygon); owner.rings.push(ring);
    owner.area += ring.area; owner.edgeIndexes = owner.edgeIndexes.concat(ring.edgeIndexes);
    owner.centroid = interiorPoint(owner.polygon, owner.area, owner.holes);
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
  // Peel complete straight attachments backwards. The remaining pair is the
  // section's single starting seam. A second unpeelable bisector splits sections.
  const sectionGroups = [];
  const sharedEdges = (left, right) => [...edgeFaces.entries()]
    .filter(([, ff]) => ff.length === 2 && ff.some(i => left.includes(i)) && ff.some(i => right.includes(i)))
    .map(([i]) => edges[i]);
  const collinear = list => {
    if (!list.length || list.some(edge => edge.curved)) return false;
    const a = vertices[list[0].a], b = vertices[list[0].b];
    const length = Math.hypot(b.X - a.X, b.Y - a.Y);
    return list.every(e => [vertices[e.a], vertices[e.b]].every(p =>
      Math.abs((b.X - a.X) * (p.Y - a.Y) - (b.Y - a.Y) * (p.X - a.X)) <= length * 1e-5));
  };
  const partition = indexes => {
    if (indexes.length <= 2) { sectionGroups.push(indexes); return; }
    const remaining = [...indexes], attachments = [];
    while (remaining.length > 2) {
      const candidates = remaining.filter(i => collinear(sharedEdges([i], remaining.filter(j => j !== i))))
        .sort((a, b) => Math.max(...sharedEdges([b], remaining.filter(j => j !== b)).map(e => e.order)) -
          Math.max(...sharedEdges([a], remaining.filter(j => j !== a)).map(e => e.order)));
      if (!candidates.length) break;
      const i = candidates[0]; attachments.push(i); remaining.splice(remaining.indexOf(i), 1);
    }
    if (remaining.length <= 2) {
      sectionGroups.push([...remaining, ...attachments.reverse()]); return;
    }
    // Find a complete straight separator: no face may straddle its supporting line.
    const separators = [...new Set(remaining.flatMap(i => faces[i].edgeIndexes))]
      .map(i => edges[i]).filter(e => !e.border && !e.curved).sort((a, b) => a.order - b.order);
    for (const edge of separators) {
      const a = vertices[edge.a], b = vertices[edge.b];
      const side = p => (b.X - a.X) * (p.Y - a.Y) - (b.Y - a.Y) * (p.X - a.X);
      const left = [], right = [];
      let crosses = false;
      for (const i of indexes) {
        const values = faces[i].polygon.map(side);
        if (values.some(v => v > 1e-5) && values.some(v => v < -1e-5)) { crosses = true; break; }
        (side(faces[i].centroid) > 0 ? left : right).push(i);
      }
      if (!crosses && left.length && right.length) { partition(left); partition(right); return; }
    }
    // Ambiguous/curved topology remains editable; never invent a sewing order.
    remaining.forEach(i => sectionGroups.push([i]));
    attachments.reverse().forEach(i => sectionGroups.push([i]));
  };
  [...groups.values()].forEach(partition);
  sectionGroups.sort((a, b) => Math.min(...a.map(i => faces[i].centroid.Y)) - Math.min(...b.map(i => faces[i].centroid.Y)) ||
    Math.min(...a.map(i => faces[i].centroid.X)) - Math.min(...b.map(i => faces[i].centroid.X)));
  sectionGroups.forEach((ordered, sectionIndex) => {
    const letter = alphaLabel(sectionIndex);
    ordered.forEach((i, pieceIndex) => {
      const face = faces[i];
      face.key = faceKey(face.polygon, face.holes);
      face.section = letter;
      face.label = `${letter}${pieceIndex + 1}`;
      const setting = block.PieceSettings?.[face.key];
      if (setting?.Label) { face.label = setting.Label; face.section = setting.Label.match(/^[A-Z]+/)[0]; }
      face.color = setting?.Color || null;
      if (!face.color) {
        const inherited = Object.values(block.PieceSettings || {}).filter(item => item.Color && item.Polygon && pointInFace(face.centroid, { polygon: item.Polygon, holes: item.Holes }))
          .sort((a, b) => Math.abs(polygonArea(a.Polygon)) - Math.abs(polygonArea(b.Polygon)))[0];
        face.color = inherited?.Color || null;
      }
    });
  });
  const usedLabels = new Set(Object.values(block.PieceSettings || {}).map(s => s.Label).filter(Boolean));
  for (const face of faces.filter(f => !block.PieceSettings?.[f.key]?.Label)) {
    let n = Number(face.label.match(/\d+$/)[0]);
    while (usedLabels.has(`${face.section}${n}`)) n++;
    face.label = `${face.section}${n}`; usedLabels.add(face.label);
  }
  const sections = [];
  for (const letter of [...new Set(faces.map(f => f.section))].sort()) {
    const faceIndexes = faces.map((f, i) => f.section === letter ? i : -1).filter(i => i >= 0);
    sections.push({ letter, faceIndexes });
  }
  return { faces, sections, edges: edges.map((edge, i) => ({ ...edge, Start: vertices[edge.a], End: vertices[edge.b], faceIndexes: edgeFaces.get(i) || [] })) };

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
      GridMode: 'subdivisions', GridColumns: 100, GridRows: 100, LabelsReady: false, GridSizeInches: 0.25, SourceImageOpacity: 0.35, DrawingSnapMode: 'intersection',
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
    if (!block.GridMode) block.GridMode = block.GridSizeInches ? 'inches' : 'subdivisions';
    if (block.LabelsReady == null) block.LabelsReady = Object.values(block.PieceSettings || {}).some(s => s.Label);
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

export function pointInPolygon(point, polygon) {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const a = polygon[i], b = polygon[j];
    if ((a.Y > point.Y) !== (b.Y > point.Y) && point.X < (b.X - a.X) * (point.Y - a.Y) / (b.Y - a.Y) + a.X) inside = !inside;
  }
  return inside;
}
function simplifyPolygon(polygon) {
  return polygon.filter((p, i) => {
    const a = polygon[(i + polygon.length - 1) % polygon.length], b = polygon[(i + 1) % polygon.length];
    return Math.abs((p.X - a.X) * (b.Y - p.Y) - (p.Y - a.Y) * (b.X - p.X)) > 1e-8;
  });
}
export function polygonKey(polygon) {
  const pts = simplifyPolygon(polygon).map(p => `${p.X.toFixed(6)},${p.Y.toFixed(6)}`);
  const variants = pts.map((_, i) => [...pts.slice(i), ...pts.slice(0, i)].join(';'));
  return variants.sort()[0];
}
export function setPieceSetting(block, key, update) {
  const analysis = analyzePieces(block), face = analysis.faces.find(f => f.key === key);
  if (!face) throw new Error('Select a current piece.');
  if (update.Label && !/^[A-Z]{1,3}[1-9]\d{0,3}$/.test(update.Label)) throw new Error('Use a section letter and number, such as A1 or B4.');
  if (update.Color && !/^#[0-9a-f]{6}$/i.test(update.Color)) throw new Error('Choose a valid color.');
  const next = structuredClone(block);
  next.PieceSettings ||= {};
  if (update.Label) {
    const occupied = analysis.faces.find(f => f.key !== key && f.label === update.Label);
    if (occupied) next.PieceSettings[occupied.key] = { ...next.PieceSettings[occupied.key], Label: face.label, Polygon: occupied.polygon, Holes: occupied.holes, Color: occupied.color };
  }
  next.PieceSettings[key] = { ...next.PieceSettings[key], Polygon: face.polygon, Holes: face.holes, ...update };
  return next;
}
export function colorLegend(analysis) {
  const counts = new Map();
  analysis.faces.forEach(f => { if (f.color) counts.set(f.color.toLowerCase(), (counts.get(f.color.toLowerCase()) || 0) + 1); });
  return [...counts].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([color, count], i) => ({ color, count, code: i + 1 }));
}

// Directed face boundaries cancel inside each section, leaving its perimeter.
export function sectionLoops(analysis, section) {
  const selected = new Set(section.faceIndexes);
  const boundary = [];
  section.faceIndexes.forEach(i => {
    const face = analysis.faces[i];
    (face.rings || [{ polygon: face.polygon, edgeIndexes: face.edgeIndexes }]).forEach(ring => ring.polygon.forEach((a, j) => {
      const edge = analysis.edges[ring.edgeIndexes[j]];
      if (edge.faceIndexes.filter(k => selected.has(k)).length !== 1) return;
      boundary.push({ a, b: ring.polygon[(j + 1) % ring.polygon.length] });
    }));
  });
  const loops = [];
  while (boundary.length) {
    const first = boundary.shift(), polygon = [first.a];
    let end = first.b;
    while (!samePoint(end, first.a)) {
      polygon.push(end);
      const i = boundary.findIndex(e => samePoint(e.a, end));
      if (i < 0) throw new Error(`Section ${section.letter} has an open boundary. Correct its pieces before printing.`);
      end = boundary.splice(i, 1)[0].b;
    }
    loops.push(simplifyPolygon(polygon));
  }
  return loops;
}
export function offsetPolygon(polygon, distance = SEAM_ALLOWANCE) {
  const offsetEdges = polygon.map((p, i) => {
    const q = polygon[(i + 1) % polygon.length], dx = q.X - p.X, dy = q.Y - p.Y, len = Math.hypot(dx, dy);
    return { a: { X: p.X + dy / len * distance, Y: p.Y - dx / len * distance }, b: { X: q.X + dy / len * distance, Y: q.Y - dx / len * distance } };
  });
  const result = [];
  offsetEdges.forEach((e, i) => {
    const prev = offsetEdges[(i + offsetEdges.length - 1) % offsetEdges.length];
    const r = { X: prev.b.X - prev.a.X, Y: prev.b.Y - prev.a.Y }, s = { X: e.b.X - e.a.X, Y: e.b.Y - e.a.Y };
    const den = r.X * s.Y - r.Y * s.X;
    if (Math.abs(den) < 1e-10) { result.push(e.a); return; }
    const q = { X: e.a.X - prev.a.X, Y: e.a.Y - prev.a.Y }, t = (q.X * s.Y - q.Y * s.X) / den;
    const p = { X: prev.a.X + t * r.X, Y: prev.a.Y + t * r.Y };
    if (Math.hypot(p.X - polygon[i].X, p.Y - polygon[i].Y) > distance * 16) result.push(prev.b, e.a);
    else result.push(p);
  });
  for (let i = 0; i < result.length; i++) for (let j = i + 2; j < result.length; j++) {
    if (i === 0 && j === result.length - 1) continue;
    if (segmentIntersection(result[i], result[(i + 1) % result.length], result[j], result[(j + 1) % result.length])) throw new Error('A section is too narrow for a clean 1/4-inch outline. Split it into smaller sections before printing.');
  }
  return result;
}
export function planSectionPatterns(block, paperKey = 'letter') {
  if (block.LabelsReady === false) throw new Error('Finish drawing, then use Label & number sections before printing.');
  const analysis = analyzePieces(block), legend = colorLegend(analysis);
  if (Math.abs(analysis.faces.reduce((sum, f) => sum + f.area, 0) - block.WidthInches * block.HeightInches) > 1e-4) throw new Error('Close the pieces before printing.');
  for (const edge of analysis.edges.filter(e => !e.border)) if (edge.faceIndexes.length !== 2 || edge.faceIndexes[0] === edge.faceIndexes[1]) throw new Error('Remove floating seam fragments before printing.');
  return analysis.sections.map(section => {
    const loops = sectionLoops(analysis, section);
    if (loops.filter(poly => poly.reduce((sum, p, i) => { const q = poly[(i + 1) % poly.length]; return sum + p.X * q.Y - q.X * p.Y; }, 0) > 0).length > 1) throw new Error(`Section ${section.letter} contains disconnected pieces. Give each connected foundation its own letter.`);
    const outlines = loops.map(loop => offsetPolygon(loop));
    const points = outlines.flat();
    const minX = Math.min(...points.map(p => p.X)), minY = Math.min(...points.map(p => p.Y));
    const maxX = Math.max(...points.map(p => p.X)), maxY = Math.max(...points.map(p => p.Y));
    const width = maxX - minX, height = maxY - minY;
    // Reuse physical tile planning; the section bounds already include allowance.
    const plan = planPattern({ ...block, WidthInches: Math.min(240, Math.max(1, width)), HeightInches: Math.min(240, Math.max(1, height)), Lines: [] }, paperKey);
    plan.width = width * 72; plan.height = height * 72;
    plan.columns = 1 + Math.ceil(Math.max(0, plan.width - plan.tileWidth) / (plan.tileWidth - plan.overlap));
    plan.rows = 1 + Math.ceil(Math.max(0, plan.height - plan.tileHeight) / (plan.tileHeight - plan.overlap));
    plan.tiles = [];
    for (let row = 0; row < plan.rows; row++) for (let column = 0; column < plan.columns; column++) plan.tiles.push({ row, column, x: column * (plan.tileWidth - plan.overlap), y: row * (plan.tileHeight - plan.overlap) });
    const transform = p => ({ x: (maxX - p.X) * 72, y: (p.Y - minY) * 72 });
    const selected = new Set(section.faceIndexes);
    const seams = analysis.edges.filter(e => e.faceIndexes.some(i => selected.has(i)));
    return { ...plan, letter: section.letter, loops, outlines, minX, minY, maxX, maxY, transform, legend,
      lines: seams.map(e => ({ start: transform(e.Start), end: transform(e.End) })),
      cuts: outlines.flatMap(poly => poly.map((p, i) => ({ start: transform(p), end: transform(poly[(i + 1) % poly.length]) }))),
      faces: section.faceIndexes.map(i => analysis.faces[i]), curved: seams.some(e => e.curved) };
  });
}

// Curves are stored as connected, identified chord segments with <=0.003-inch
// chord error. This keeps intersections, faces and print geometry in one graph.
export function sampleCurve(start, end, bend, kind = 'curve') {
  const dx = end.X - start.X, dy = end.Y - start.Y, chord = Math.hypot(dx, dy);
  if (chord < 1e-5) throw new Error('Choose distinct curve endpoints.');
  const side = Math.sign(dx * (bend.Y - start.Y) - dy * (bend.X - start.X)) || 1;
  let points;
  if (kind === 'curve') {
    const control = { X: 2 * bend.X - (start.X + end.X) / 2, Y: 2 * bend.Y - (start.Y + end.Y) / 2 };
    const second = Math.hypot(start.X - 2 * control.X + end.X, start.Y - 2 * control.Y + end.Y);
    const n = Math.max(8, Math.ceil(Math.sqrt(second / (4 * 0.003))));
    if (n > 512) throw new Error('Use a smaller curve.');
    points = Array.from({ length: n + 1 }, (_, i) => {
      const t = i / n, u = 1 - t;
      return { X: u * u * start.X + 2 * u * t * control.X + t * t * end.X, Y: u * u * start.Y + 2 * u * t * control.Y + t * t * end.Y };
    });
  } else {
    const angle = kind === 'half' ? Math.PI : Math.PI / 2;
    const radius = chord / (2 * Math.sin(angle / 2));
    const distance = kind === 'half' ? 0 : chord / 2;
    const center = { X: (start.X + end.X) / 2 + dy / chord * distance * side, Y: (start.Y + end.Y) / 2 - dx / chord * distance * side };
    const a = Math.atan2(start.Y - center.Y, start.X - center.X);
    const n = Math.max(8, Math.ceil(angle / (2 * Math.acos(Math.max(-1, 1 - 0.003 / radius)))));
    if (n > 512) throw new Error('Use a smaller arc.');
    points = Array.from({ length: n + 1 }, (_, i) => ({ X: center.X + radius * Math.cos(a - side * angle * i / n), Y: center.Y + radius * Math.sin(a - side * angle * i / n) }));
  }
  points[0] = { ...start }; points[points.length - 1] = { ...end };
  return points;
}
export function addCurve(block, start, end, bend, options = {}) {
  const a = findAnchor(block, start, options.tolerance ?? 0.3, 'line'), b = findAnchor(block, end, options.tolerance ?? 0.3, 'line');
  if (!a || !b) throw new Error('Both curve endpoints must touch a block edge or seam.');
  let points = sampleCurve(a.point, b.point, bend, options.kind);
  if (points.some(p => p.X < -EPSILON || p.Y < -EPSILON || p.X > block.WidthInches + EPSILON || p.Y > block.HeightInches + EPSILON)) throw new Error('The curve must stay inside the block. Aim the bend inside.');
  points = points.map(p => ({ X: Math.max(0, Math.min(block.WidthInches, p.X)), Y: Math.max(0, Math.min(block.HeightInches, p.Y)) }));
  let lines = block.Lines.map((l, i) => ({ ...structuredClone(l), DraftId: l.DraftId || l.Id || `legacy-${i}`, Order: l.Order ?? i })), additions = [];
  const draft = crypto.randomUUID(), order = Math.max(-1, ...lines.map((l, i) => l.Order ?? i)) + 1;
  let stopped = false;
  for (let i = 0; i < points.length - 1 && !stopped; i++) {
    const cuts = [{ ...points[i], t: 0 }, { ...points[i + 1], t: 1 }];
    let firstHit = null;
    for (const line of lines) {
      if (collinearOverlap(points[i], points[i + 1], line.Start, line.End)) throw new Error('The curve overlaps an existing seam.');
      const hit = segmentIntersection(points[i], points[i + 1], line.Start, line.End);
      if (hit && hit.t > 1e-5) {
        if (!firstHit || hit.t < firstHit.t) firstHit = hit;
        if (!cuts.some(p => samePoint(p, hit))) cuts.push(hit);
      }
    }
    cuts.sort((a, b) => a.t - b.t);
    if (!options.crossLines && firstHit) {
      const cutoff = cuts.findIndex(p => samePoint(p, firstHit));
      cuts.splice(cutoff + 1); stopped = true;
    }
    for (const p of cuts) lines = splitExistingLinesAtPoint(lines, p);
    for (let j = 0; j < cuts.length - 1; j++) if (!samePoint(cuts[j], cuts[j + 1])) additions.push({ Id: crypto.randomUUID(), DraftId: draft, Order: order, Curve: options.kind || 'curve', BoundaryType: options.boundaryType || 'piece', Start: { X: cuts[j].X, Y: cuts[j].Y }, End: { X: cuts[j + 1].X, Y: cuts[j + 1].Y } });
  }
  const next = { ...block, LabelsReady: block.LabelsReady == null ? undefined : false, Lines: [...lines, ...additions] };
  validateBlock(next);
  if (analyzePieces(next).faces.length <= analyzePieces(block).faces.length) throw new Error('The curve must divide a closed piece.');
  return next;
}
export function applySymmetry(before, after, horizontal = false, vertical = false) {
  if (!horizontal && !vertical) return after;
  const ids = new Set(before.Lines.map((l, i) => l.DraftId || l.Id || `legacy-${i}`));
  const additions = after.Lines.filter(l => !ids.has(l.DraftId || l.Id));
  let lines = [...after.Lines];
  for (const [mx, my] of [[vertical, false], [false, horizontal], [vertical, horizontal]].filter(([x, y]) => x || y)) {
    const drafts = new Map();
    for (const line of additions) {
      const tx = p => ({ X: mx ? before.WidthInches - p.X : p.X, Y: my ? before.HeightInches - p.Y : p.Y });
      const a = tx(line.Start), b = tx(line.End);
      if (lines.some(l => samePoint(a, l.Start) && samePoint(b, l.End) || samePoint(a, l.End) && samePoint(b, l.Start))) continue;
      const source = line.DraftId || line.Id;
      if (!drafts.has(source)) drafts.set(source, crypto.randomUUID());
      lines.push({ ...line, Id: crypto.randomUUID(), DraftId: drafts.get(source), Start: a, End: b });
    }
  }
  // Normalize every crossing after atomic mirroring, including original seams.
  const graph = splitGeometry({ ...after, Lines: lines });
  const planar = [];
  for (const edge of graph.edges.filter(e => !e.border)) {
    const a = graph.vertices[edge.a], b = graph.vertices[edge.b];
    const source = lines.find(l => projectPointToSegment(a, l).distance < 1e-5 && projectPointToSegment(b, l).distance < 1e-5);
    planar.push({ ...source, Id: crypto.randomUUID(), Start: a, End: b });
  }
  return validateBlock({ ...after, Lines: planar });
}
export function deleteDraft(block, index) {
  const selected = block.Lines[index];
  if (!selected) return block;
  const draft = selected.DraftId || selected.Id;
  let lines = block.Lines.filter((l, i) => draft ? (l.DraftId || l.Id) !== draft : i !== index);
  // Remove dangling dependent fragments rather than leave open, unprintable pieces.
  let changed = true;
  while (changed) {
    changed = false;
    lines = lines.filter((line, i) => {
      const anchored = p => boundarySegments(block).some(e => projectPointToSegment(p, e).distance < 1e-5) || lines.some((e, j) => j !== i && projectPointToSegment(p, e).distance < 1e-5);
      if (anchored(line.Start) && anchored(line.End)) return true;
      changed = true; return false;
    });
  }
  return { ...block, LabelsReady: false, Lines: lines };
}

function interiorPoint(polygon, area, holes = []) {
  let x = 0, y = 0;
  polygon.forEach((p, i) => { const q = polygon[(i + 1) % polygon.length], cross = p.X * q.Y - q.X * p.Y; x += (p.X + q.X) * cross; y += (p.Y + q.Y) * cross; });
  const center = { X: x / (6 * area), Y: y / (6 * area) };
  if (pointInFace(center, { polygon, holes })) return center;
  const rings = [polygon, ...holes];
  const ys = [...new Set(rings.flat().map(p => p.Y))].sort((a, b) => a - b);
  let best = null;
  for (let k = 0; k < ys.length - 1; k++) {
    const y = (ys[k] + ys[k + 1]) / 2, hits = [];
    rings.forEach(ring => ring.forEach((p, i) => { const q = ring[(i + 1) % ring.length]; if ((p.Y > y) !== (q.Y > y)) hits.push(p.X + (y - p.Y) * (q.X - p.X) / (q.Y - p.Y)); }));
    hits.sort((a, b) => a - b);
    for (let j = 0; j < hits.length - 1; j += 2) if (!best || hits[j + 1] - hits[j] > best.width) best = { X: (hits[j] + hits[j + 1]) / 2, Y: y, width: hits[j + 1] - hits[j] };
  }
  return best ? { X: best.X, Y: best.Y } : center;
}

export function renameSection(block, from, to) {
  if (!/^[A-Z]{1,3}$/.test(to)) throw new Error('Use a section letter, such as A or B.');
  const analysis = analyzePieces(block), next = structuredClone(block);
  next.PieceSettings ||= {};
  for (const face of analysis.faces) {
    if (face.section !== from && face.section !== to) continue;
    const section = face.section === from ? to : from;
    next.PieceSettings[face.key] = { ...next.PieceSettings[face.key], Polygon: face.polygon, Holes: face.holes, Color: face.color, Label: `${section}${face.label.match(/\d+$/)[0]}` };
  }
  return next;
}
export function resizeBlock(block, width, height) {
  const sx = width / block.WidthInches, sy = height / block.HeightInches;
  const tx = p => ({ X: Math.min(width, p.X * sx), Y: Math.min(height, p.Y * sy) });
  const next = { ...structuredClone(block), WidthInches: width, HeightInches: height, Lines: block.Lines.map(l => ({ ...l, Start: tx(l.Start), End: tx(l.End) })) };
  if (block.PieceSettings) {
    next.PieceSettings = {};
    for (const setting of Object.values(block.PieceSettings)) if (setting.Polygon) {
      const polygon = setting.Polygon.map(tx);
      const holes = (setting.Holes || []).map(ring => ring.map(tx));
      next.PieceSettings[faceKey(polygon, holes)] = { ...setting, Polygon: polygon, Holes: holes };
    }
  }
  validateBlock(next);
  return next;
}

export function previewCurve(block, start, end, bend, kind, crossLines = false) {
  const points = sampleCurve(start, end, bend, kind);
  if (crossLines) return points;
  const result = [points[0]];
  for (let i = 0; i < points.length - 1; i++) {
    const hits = block.Lines.map(l => segmentIntersection(points[i], points[i + 1], l.Start, l.End)).filter(hit => hit && hit.t > 1e-5).sort((a, b) => a.t - b.t);
    if (hits.length) { result.push({ X: hits[0].X, Y: hits[0].Y }); return result; }
    result.push(points[i + 1]);
  }
  return result;
}

export const polygonArea = polygon => polygon.reduce((sum, p, i) => {
  const q = polygon[(i + 1) % polygon.length]; return sum + p.X * q.Y - q.X * p.Y;
}, 0) / 2;
export const faceKey = (polygon, holes = []) => polygonKey(polygon) + (holes.length ? `|holes:${holes.map(polygonKey).sort().join('|')}` : '');
export const pointInFace = (point, face) => pointInPolygon(point, face.polygon) && !(face.holes || []).some(ring => pointInPolygon(point, ring));
export function facePath(face, transform = p => p) {
  return [face.polygon, ...(face.holes || [])].map(ring => ring.map((p, i) => { const q = transform(p); return `${i ? 'L' : 'M'} ${q.X} ${q.Y}`; }).join(' ') + ' Z').join(' ');
}
export function gridSpec(block) {
  if (block.GridMode != null && !['inches', 'subdivisions'].includes(block.GridMode)) throw new Error('Choose rows/columns or inch grid units.');
  if (block.GridMode === 'inches') {
    const step = block.GridSizeInches ?? .25;
    if (!Number.isFinite(step) || step < .001 || step > 240) throw new Error('Grid spacing must be between 0.001 and 240 inches.');
    return { stepX: step, stepY: step };
  }
  const columns = block.GridColumns ?? 100, rows = block.GridRows ?? 100;
  if (![columns, rows].every(n => Number.isInteger(n) && n >= 2 && n <= 1000)) throw new Error('Choose 2–1,000 grid divisions per axis.');
  return { stepX: block.WidthInches / columns, stepY: block.HeightInches / rows };
}
export function snapToGrid(block, point) {
  const { stepX, stepY } = gridSpec(block);
  return { X: Math.max(0, Math.min(block.WidthInches, Math.round(point.X / stepX) * stepX)), Y: Math.max(0, Math.min(block.HeightInches, Math.round(point.Y / stepY) * stepY)) };
}
export function labelSections(block) {
  const next = structuredClone(block);
  for (const setting of Object.values(next.PieceSettings || {})) delete setting.Label;
  const analysis = analyzePieces(next);
  next.PieceSettings = Object.fromEntries(analysis.faces.map(face => [face.key, { Label: face.label, Color: face.color, Polygon: face.polygon, Holes: face.holes }]));
  next.LabelsReady = true;
  return next;
}
export function transformBlockPoint(block, instance, point) {
  let x = instance.mirrorX ? block.WidthInches - point.X : point.X;
  let y = instance.mirrorY ? block.HeightInches - point.Y : point.Y;
  const rotation = instance.rotation || 0;
  if (rotation === 90) [x, y] = [block.HeightInches - y, x];
  if (rotation === 180) [x, y] = [block.WidthInches - x, block.HeightInches - y];
  if (rotation === 270) [x, y] = [y, block.WidthInches - x];
  return { X: instance.x + x, Y: instance.y + y };
}
export function arcBend(start, end, side = 1) {
  const dx = end.X - start.X, dy = end.Y - start.Y;
  return { X: (start.X + end.X) / 2 - dy / 2 * side, Y: (start.Y + end.Y) / 2 + dx / 2 * side };
}
export function sampleCircle(center, radius) {
  if (!Number.isFinite(radius) || radius < .01 || radius > 120) throw new Error('Choose a circle radius between 0.01 and 120 inches.');
  const n = Math.max(24, Math.ceil(Math.PI / Math.acos(1 - Math.min(.003, radius / 4) / radius)));
  const points = Array.from({ length: n }, (_, i) => ({ X: center.X + radius * Math.cos(2 * Math.PI * i / n), Y: center.Y + radius * Math.sin(2 * Math.PI * i / n) }));
  return [...points, { ...points[0] }];
}
function clampPath(block, points) {
  if (points.some(p => p.X < -EPSILON || p.Y < -EPSILON || p.X > block.WidthInches + EPSILON || p.Y > block.HeightInches + EPSILON)) throw new Error('Keep the curved shape inside the block; flip its direction or reduce its size.');
  return points.map(p => ({ X: Math.max(0, Math.min(block.WidthInches, p.X)), Y: Math.max(0, Math.min(block.HeightInches, p.Y)) }));
}
export function previewFreeArc(block, start, end, bend, kind, crossLines = false) {
  let points = clampPath(block, sampleCurve(start, end, bend, kind));
  // Tangent continuations anchor a free interior arc without altering its bend.
  const extend = (p, neighbor) => {
    if (findAnchor(block, p, 1e-5, 'line')) return null;
    return extendLineToNextHit(block, p, { X: p.X * 2 - neighbor.X, Y: p.Y * 2 - neighbor.Y });
  };
  const first = extend(points[0], points[1]), last = extend(points.at(-1), points.at(-2));
  if (first) points.unshift(first);
  if (last) points.push(last);
  if (crossLines) return points;
  const result = [points[0]];
  for (let i = 0; i < points.length - 1; i++) {
    const hits = block.Lines.map(l => segmentIntersection(points[i], points[i + 1], l.Start, l.End)).filter(h => h && h.t > 1e-5).sort((a, b) => a.t - b.t);
    if (hits.length) { result.push({ X: hits[0].X, Y: hits[0].Y }); return result; }
    result.push(points[i + 1]);
  }
  return result;
}
function addPath(block, points, kind, options = {}) {
  points = clampPath(block, points);
  const draft = crypto.randomUUID(), order = Math.max(-1, ...block.Lines.map((l, i) => l.Order ?? i)) + 1;
  let lines = block.Lines.map((l, i) => ({ ...l, DraftId: l.DraftId || l.Id || `legacy-${i}`, Order: l.Order ?? i }));
  const additions = [];
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i], b = points[i + 1];
    if (samePoint(a, b)) continue;
    for (const l of [...lines, ...boundarySegments(block)]) if (collinearOverlap(a, b, l.Start, l.End)) throw new Error('The new shape overlaps an existing seam or border.');
    const cuts = [{ ...a, t: 0 }, { ...b, t: 1 }];
    for (const l of lines) {
      const hit = segmentIntersection(a, b, l.Start, l.End);
      if (hit && !cuts.some(p => samePoint(p, hit))) cuts.push(hit);
    }
    cuts.sort((a, b) => a.t - b.t);
    for (const p of cuts) lines = splitExistingLinesAtPoint(lines, p);
    for (let j = 0; j < cuts.length - 1; j++) additions.push({ Id: crypto.randomUUID(), DraftId: draft, Order: order, Curve: kind, Start: { X: cuts[j].X, Y: cuts[j].Y }, End: { X: cuts[j + 1].X, Y: cuts[j + 1].Y }, BoundaryType: 'piece' });
  }
  const next = validateBlock({ ...block, LabelsReady: false, Lines: [...lines, ...additions] });
  const before = analyzePieces(block), after = analyzePieces(next);
  if (after.faces.length <= before.faces.length || Math.abs(after.faces.reduce((sum, f) => sum + f.area, 0) - block.WidthInches * block.HeightInches) > 1e-4) throw new Error('The new shape must divide a closed piece.');
  return next;
}
export function addFreeArc(block, start, end, bend, options = {}) {
  return addPath(block, previewFreeArc(block, start, end, bend, options.kind || 'half', options.crossLines), options.kind || 'half');
}
export function addCircle(block, center, radius, options = {}) {
  const points = clampPath(block, sampleCircle(center, radius));
  if (!options.crossLines && points.some((p, i) => i < points.length - 1 && block.Lines.some(l => segmentIntersection(p, points[i + 1], l.Start, l.End)))) throw new Error('This circle crosses a seam. Enable Continue through lines or use a smaller circle.');
  return addPath(block, points, 'circle');
}
