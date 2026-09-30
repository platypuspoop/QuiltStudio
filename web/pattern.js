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
    || block.WidthInches > 60 || block.HeightInches > 60) {
    throw new Error('Block width and height must be between 1 and 60 inches.');
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
      GridSizeInches: 0.25, SourceImageOpacity: 0.35,
      Lines: [[0, 0, 8, 12], [0, 5, 12, 5], [8, 12, 12, 5], [0, 10, 8, 12], [4, 0, 12, 5]].map(([x1, y1, x2, y2]) => ({
        Id: crypto.randomUUID(), Start: { X: x1, Y: y1 }, End: { X: x2, Y: y2 },
      })),
    }],
    Layout: { Preset: 'queen', WidthInches: 90, HeightInches: 108, AlternateMirrors: true, Instances: [] },
  };
}

export function parseProject(text) {
  let project;
  try { project = JSON.parse(text); } catch { throw new Error('This file is not a valid QuiltStudio project.'); }
  if (project?.SchemaVersion !== 1 || !Array.isArray(project.Blocks) || project.Blocks.length === 0 || project.Blocks.length > 100) {
    throw new Error('Open a version 1 QuiltStudio project containing 1–100 blocks.');
  }
  if (!project.Layout || typeof project.Layout !== 'object') {
    project.Layout = { Preset: 'queen', WidthInches: 90, HeightInches: 108, AlternateMirrors: true, Instances: [] };
  } else {
    if (!Number.isFinite(project.Layout.WidthInches)) project.Layout.WidthInches = 90;
    if (!Number.isFinite(project.Layout.HeightInches)) project.Layout.HeightInches = 108;
    if (typeof project.Layout.AlternateMirrors !== 'boolean') project.Layout.AlternateMirrors = true;
    if (typeof project.Layout.Preset !== 'string') project.Layout.Preset = 'custom';
    if (!Array.isArray(project.Layout.Instances)) project.Layout.Instances = [];
  }

  project.Blocks.forEach(block => {
    validateBlock(block);
    if (typeof block.Name !== 'string' || block.Name.length > 200) throw new Error('Block names must be text with at most 200 characters.');
    if (block.SourceImageBase64 && (typeof block.SourceImageBase64 !== 'string' || block.SourceImageBase64.length > 14_000_000)) {
      throw new Error('Embedded images must be smaller than 10 MB.');
    }
  });
  return project;
}
