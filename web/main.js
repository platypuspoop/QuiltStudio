import './style.css';
import { installWorkflow } from './workflow.js';
import { addDraftLine, seamCount, deleteSegment, clippedBlockLines } from './pattern.js';
import { addCircle, addFreeArc, arcBend, previewFreeArc, sampleCircle, sampleCurve, gridSpec, snapToGrid, labelSections, facePath, pointInFace, transformBlockPoint } from './pattern.js';
import { addConstrainedLine, addCurve, applySymmetry, deleteDraft, pointInPolygon, previewCurve, setPieceSetting, renameSection, resizeBlock, colorLegend, planSectionPatterns, analyzePieces, demoProject, extendLineToNextHit, findAnchor, parseProject, planQuiltLayout, QUILT_PRESETS, snapDrawingPoint } from './pattern.js';

const icons = {
  draw: '<path d="m5 19 3.5-1 10-10-2.5-2.5-10 10L5 19Z"/><path d="m14.5 7.5 2.5 2.5"/>',
  select: '<path d="m6 3 12 10-6 1-3 6-3-17Z"/>',
  undo: '<path d="M9 6 4 11l5 5M4 11h10a6 6 0 0 1 6 6"/>',
  redo: '<path d="m15 6 5 5-5 5m5-5H10a6 6 0 0 0-6 6"/>',
  download: '<path d="M12 3v12m-4-4 4 4 4-4M4 16v5h16v-5"/>',
  folder: '<path d="M3 6h6l2 2h10v12H3V6Z"/>',
  save: '<path d="M4 3h13l3 3v15H4V3Z"/><path d="M8 3v6h8V3M8 21v-8h8v8"/>',
  trash: '<path d="M3 6h18M9 6V3h6v3M6 6l1 15h10l1-15M10 10v7m4-7v7"/>',
  image: '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="m3 17 6-6 5 5 3-3 4 4"/><circle cx="16" cy="8" r="1"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  arrow: '<path d="M5 12h14m-5-5 5 5-5 5"/>',
  check: '<path d="m5 12 4 4 10-10"/>',
};
const icon = name => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[name]}</svg>`;
const $ = id => document.getElementById(id);
const escape = value => String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);

let project = demoProject();
let restoreMessage = '';
try {
  const saved = localStorage.getItem('quiltstudio-project');
  if (saved) project = parseProject(saved);
} catch { restoreMessage = 'Your previous browser draft could not be restored. The sample is open.'; }
let blockIndex = 0;
let tool = 'draw';
let pending = null;
let cursor = null;
let selected = -1;
let undo = [], redo = [];
let currentLineRole = 'piece';
let hoverAnchor = null;
let dragOrigin = null;
let dragging = false;
let curveEnd = null;
let selectedPiece = null;
let previewSection = null;
let noticeTimer;
let activeStep = 0;
let arcSide = 1;
let selectedInstance = null;
const block = () => project.Blocks[blockIndex];

$('app').innerHTML = `
  <header class="topbar">
    <a class="brand" href="./" aria-label="QuiltStudio home"><span class="brand-mark"><i></i><i></i><i></i><i></i></span>Quilt<span>Studio</span><small>PROTOTYPE</small></a>
    <div class="header-actions"><span id="save-status" class="save-status">Saved in this browser</span><button id="open-project" class="button quiet">${icon('folder')} Open project</button><button id="save-project" class="button outlined">${icon('save')} Save a copy</button></div>
  </header>
  <main>
    <section class="intro"><div><p class="eyebrow">FROM AN IDEA TO YOUR NEXT QUILT</p><h1>A little precision.<br><em>A lot of possibility.</em></h1><p class="intro-copy">Draw your block. Print your foundation. Make something yours.</p></div><div class="intro-note"><span class="tiny-patch"></span><p>Made for foundation<br>paper piecing.<span>Inches in. Actual size out.</span></p></div></section>
    <div class="workspace-top"><div class="workspace-title"><span class="step-dot">01</span><h2>Design your block</h2><span class="pill">FPP studio</span></div><button id="new-block" class="text-button">${icon('plus')} Add a blank block</button></div>
    <section class="workspace" aria-label="Foundation paper piecing workspace">
      <aside class="settings panel">
        <div class="panel-label">BLOCK DETAILS</div>
        <label class="field">Your blocks<select id="block-select"></select></label>
        <label class="field">Block name<input id="block-name" maxlength="200" /></label>
        <form id="dimensions-form"><div class="field-row"><label class="field">Width <span>in</span><input id="width" type="number" min="1" max="240" step="0.25" required /></label><span class="multiply">×</span><label class="field">Height <span>in</span><input id="height" type="number" min="1" max="240" step="0.25" required /></label></div><button class="button outlined full" type="submit">Apply dimensions</button></form>
        <p class="field-help">Finished size, before seam allowance. Resizing scales your seam lines.</p>
        <hr/><div class="panel-label">DRAWING GUIDES</div>
        <label class="field">Grid spacing<select id="grid"><option value="1">1 inch</option><option value="0.5">½ inch</option><option value="0.25">¼ inch</option><option value="0.125">⅛ inch</option><option value="0.0625">¹⁄₁₆ inch</option></select></label>
        <label class="check-field"><input type="checkbox" id="snap" checked /><span>Snap to grid</span><span class="switch" aria-hidden="true"></span></label>
        <label class="field">Line endpoint behavior<select id="drawing-snap-mode"><option value="intersection">Snap to intersections</option><option value="line">Stop anywhere on a line</option></select></label>
        <label class="field">Line type<select id="line-role"><option value="piece">Piece seam · no section allowance</option><option value="section">Section boundary · add ¼″ allowance</option></select></label>
        <p class="field-help">Use <strong>Piece seam</strong> between pieces such as B1/B2/B3. Use <strong>Section boundary</strong> around the outside of a lettered section.</p>
        <label class="field">Drawing shape<select id="drawing-shape"><option value="line">Straight line</option><option value="curve">Curve through a bend point</option><option value="half">Half circle</option><option value="quarter">Quarter circle</option></select></label>
        <label class="check-field"><input type="checkbox" id="cross-lines"/><span>Continue through lines</span></label>
        <label class="check-field"><input type="checkbox" id="symmetry-vertical"/><span>Mirror across vertical axis</span></label>
        <label class="check-field"><input type="checkbox" id="symmetry-horizontal"/><span>Mirror across horizontal axis</span></label>
        <p class="field-help">Curves: click start, click an anchored end, then click the bend side. Curved seams require curved piecing.</p>
        <hr/><div class="panel-label">PIECES & COLORS</div>
        <label class="field">Fabric color<input id="fabric-color" type="color" value="#f6cf45" /></label>
        <button id="color-tool" class="button outlined full" aria-pressed="false">Paint pieces</button>
        <label class="field">Select a piece<select id="piece-select"></select></label>
        <label class="field">Piece label<input id="piece-name" maxlength="7" placeholder="A1" /></label>
        <button id="rename-piece" class="button outlined full">Apply piece label</button>
        <button id="rename-section" class="button outlined full">Apply letter to whole section</button><button id="reset-labels" class="text-button">Recalculate automatic labels</button>
        <p class="field-help">Change A1 to B1 to move it into section B. Renumber to A4 to exchange sewing order. Occupied labels swap. Colors rank by piece count.</p>
        <hr/><div class="panel-label">TRACE AN IDEA</div>
        <button id="import-image" class="button outlined full">${icon('image')} Add reference image</button>
        <div id="image-controls" hidden><label class="field range-field">Image opacity<input id="opacity" type="range" min="0" max="1" step="0.05" value="0.35" /></label><button id="remove-image" class="text-button">Remove image</button></div>
        <p class="field-help">Your image stays in your browser. It won’t appear on the printed pattern.</p>
        <div class="tip-card"><span>START ON GEOMETRY</span><p>Begin on a block edge, seam, or intersection. Drag toward the next boundary; QuiltStudio stops at the first line it hits.</p><small>Green = line/vertex · brown = block edge · Esc cancels</small></div>
      </aside>
      <div class="editor panel">
        <div class="editor-toolbar"><div class="tool-group" role="group" aria-label="Drawing tools"><button id="draw-tool" class="tool active" aria-pressed="true">${icon('draw')} Line</button><button id="select-tool" class="tool" aria-pressed="false">${icon('select')} Select</button></div><div class="tool-group"><button id="undo" class="icon-button" aria-label="Undo" title="Undo">${icon('undo')}</button><button id="redo" class="icon-button" aria-label="Redo" title="Redo">${icon('redo')}</button><span class="tool-divider"></span><button id="delete-line" class="icon-button" aria-label="Delete selected seam" title="Delete selected seam">${icon('trash')}</button><span class="tool-divider"></span><button id="clear-drawing" class="tool danger-tool" aria-label="Clear all lines" title="Clear all lines">${icon('trash')} Clear</button></div></div>
        <div class="canvas-wrap"><div class="canvas-caption"><span>DESIGN VIEW</span><span id="canvas-size"></span></div><svg id="canvas" role="application" aria-label="Constrained quilt drafting canvas. Start on an edge, seam, or intersection and drag toward the next boundary." tabindex="0"></svg><div class="canvas-legend"><span><i class="legend-line"></i> Seam line</span><span><i class="legend-dot"></i> Endpoint</span><span>Finished block</span></div></div>
        <div class="editor-footer"><span id="editor-instruction">Start on valid geometry and drag toward the next boundary</span><span id="line-count"></span></div>
      </div>
      <aside class="print-panel panel"><div class="print-heading"><span class="step-dot">02</span><h2>Make it printable</h2></div><p class="print-copy">A foundation that’s ready for paper.</p><div class="preview-wrap"><span class="preview-tag">MIRRORED PRINT VIEW</span><svg id="print-preview" aria-label="Mirrored foundation preview"></svg><div class="preview-caption">+ ¼″ outer seam allowance</div></div>
        <label class="field">Foundation section<select id="print-section"></select></label><div id="color-key" class="color-key"></div><label class="field">Paper size<select id="paper"><option value="letter">US Letter · 8.5 × 11 in</option><option value="a4">A4 · 210 × 297 mm</option></select></label>
        <div class="print-specs"><div><span>Finished block</span><strong id="print-size"></strong></div><div><span>Pattern sheets</span><strong id="sheet-count"></strong></div><div><span>Print scale</span><strong>100% · actual size</strong></div></div>
        <button id="export-pdf" class="button primary full">${icon('download')} Download FPP pattern</button><p class="export-note">Vector PDF · no account needed</p>
        <div class="calibration-note"><span class="calibration-square">1″</span><p><strong>Measure before you sew.</strong>Your PDF includes a 1-inch test square. Print at actual size, then check it with a ruler.</p></div>
        <p id="print-error" class="scope-note" role="status" hidden></p><p class="scope-note">Each section starts with pieces 1 and 2, then adds attachments. Correct labels before printing. Each section prints separately.</p>
      </aside>
    </section>
    <section class="quilt-builder panel" aria-label="Quilt layout builder">
      <div class="quilt-builder-copy">
        <span class="step-dot">03</span>
        <div>
          <p class="panel-label">BUILD THE QUILT</p>
          <h2>Repeat this block across a quilt</h2>
          <p class="field-help">QuiltStudio repeats the active block edge-to-edge. Alternate mirroring creates a checkerboard-style reflected layout.</p>
        </div>
      </div>
      <div class="quilt-controls">
        <label class="field">Design approach<select id="design-mode"><option value="repeat">Build one block and repeat it</option><option value="large">Draw one large quilt-size block</option></select></label>
        <label class="field">Standard quilt size
          <select id="quilt-preset">
            <option value="lap">Lap · 50 × 65 in</option>
            <option value="twin">Twin · 70 × 90 in</option>
            <option value="full">Full · 84 × 90 in</option>
            <option value="queen">Queen · 90 × 108 in</option>
            <option value="king">King · 108 × 108 in</option>
            <option value="custom">Custom size</option>
          </select>
        </label>
        <div class="field-row">
          <label class="field">Quilt width <span>in</span><input id="quilt-width" type="number" min="1" max="240" step="0.25" /></label>
          <span class="multiply">×</span>
          <label class="field">Quilt height <span>in</span><input id="quilt-height" type="number" min="1" max="240" step="0.25" /></label>
        </div>
        <label class="check-field"><input type="checkbox" id="alternate-mirrors" checked /><span>Alternate mirrored blocks</span><span class="switch" aria-hidden="true"></span></label>
        <div class="quilt-stats">
          <div><span>Layout</span><strong id="quilt-grid-size"></strong></div>
          <div><span>Total blocks</span><strong id="quilt-block-count"></strong></div>
          <div><span>Covered area</span><strong id="quilt-covered-size"></strong></div>
        </div>
      </div>
      <div class="quilt-preview-wrap">
        <div class="canvas-caption"><span>QUILT PREVIEW</span><span id="quilt-size-label"></span></div>
        <svg id="quilt-preview" aria-label="Repeated quilt block preview"></svg>
        <p class="field-help quilt-preview-note">Any extra space is centered around the repeated block field. Custom sizing is supported.</p>
      </div>
    </section>
    <section class="howto"><div><span class="step-number">01 / DESIGN</span><h3>Find your lines.</h3><p>Trace an image or draw from scratch. The sample block is here to help you get started.</p></div><div><span class="step-number">02 / PRINT</span><h3>Keep it true to size.</h3><p>Open the PDF and choose Actual size or 100%. Turn off Fit and Shrink in your print dialog.</p></div><div><span class="step-number">03 / CHECK</span><h3>Then make it yours.</h3><p>Measure the test square. Join tiled pages using the ¼-inch overlap and matching seam lines.</p></div></section>
    <footer class="page-footer"><span>QuiltStudio <span>·</span> A work in progress, stitch by stitch.</span><button id="load-sample" class="text-button">Open sample block ${icon('arrow')}</button></footer>
  </main>
  <div id="notice" class="notice" role="status" aria-live="polite" hidden></div>
  <input id="project-file" type="file" accept=".quiltstudio,.json" hidden />
  <input id="image-file" type="file" accept="image/png,image/jpeg,image/webp,image/bmp" hidden />
`;
const setStep = installWorkflow(step => { activeStep = step; chooseTool(step === 2 ? 'draw' : step === 3 ? 'select' : step === 5 ? 'color' : 'idle'); });

function notify(message) {
  $('notice').textContent = message;
  $('notice').hidden = false;
  clearTimeout(noticeTimer);
  noticeTimer = setTimeout(() => { $('notice').hidden = true; }, 6000);
}
function persist() {
  try {
    localStorage.setItem('quiltstudio-project', JSON.stringify(project));
    $('save-status').textContent = 'Saved in this browser';
  } catch {
    $('save-status').textContent = 'Save a copy to keep this project';
    notify('Browser storage is full or unavailable. Use Save a copy to keep your work.');
  }
}
function checkpoint() { undo.push(structuredClone(block())); if (undo.length > 100) undo.shift(); redo = []; }
function changed() { persist(); render(); }
function chooseTool(next) {
  tool = next; curveEnd = null; pending = null; cursor = null; hoverAnchor = null; dragOrigin = null; dragging = false; selected = -1;
  for (const name of ['draw', 'select']) {
    $(`${name}-tool`).classList.toggle('active', tool === name);
    $(`${name}-tool`).setAttribute('aria-pressed', String(tool === name));
  }
  $('color-tool').setAttribute('aria-pressed', String(tool === 'color'));
  render();
}


function faceMarkup(analysis, mirror = false, fill = true) {
  const b = block();
  const size = Math.max(0.2, Math.min(2.4, Math.min(b.WidthInches, b.HeightInches) / 24));
  const tx = x => mirror ? b.WidthInches - x : x;
  const legend = colorLegend(analysis);
  return analysis.faces.map(face => {
    const code = face.color ? legend.find(c => c.color === face.color.toLowerCase())?.code : null;
    return `${fill ? `<path d="${facePath(face, p => ({ X: tx(p.X), Y: p.Y }))}" fill-rule="evenodd" fill="${face.color || '#fffefb'}" class="piece-fill" data-piece="${escape(face.key)}"/>` : ''}${b.LabelsReady === false ? '' : `<text x="${tx(face.centroid.X)}" y="${face.centroid.Y}" style="font-size:${size}px" class="piece-label">${escape(face.label)}</text>${code ? `<rect x="${tx(face.centroid.X) - size * .5}" y="${face.centroid.Y + size * .3}" width="${size}" height="${size * .75}" fill="${face.color}" stroke="#222" stroke-width=".015"/><text x="${tx(face.centroid.X)}" y="${face.centroid.Y + size * .91}" style="font-size:${size * .6}px;fill:${contrast(face.color)}" class="piece-label">${code}</text>` : ''}`}`;
  }).join('');
}
function contrast(color) {
  const c = color.replace('#', '');
  return parseInt(c.slice(0, 2), 16) * .299 + parseInt(c.slice(2, 4), 16) * .587 + parseInt(c.slice(4, 6), 16) * .114 > 140 ? '#000' : '#fff';
}
function pieceLabelMarkup(mirror = false) {
  return faceMarkup(analyzePieces(block()), mirror, false);
}
function curvePreviewPoints() {
  if (!pending || !cursor) return [];
  const kind = $('drawing-shape').value;
  if (kind === 'circle') return sampleCircle(pending, circleRadius());
  const end = curveEnd || cursor;
  const bend = kind === 'curve' && curveEnd ? cursor : arcBend(pending, end, arcSide);
  // Show the complete intended bend even when an earlier seam would stop placement.
  try { return previewFreeArc(draftBlock(), pending, end, bend, kind, true); }
  catch { try { return previewCurve(block(), pending, end, bend, kind, true); } catch { return []; } }
}
function circleRadius() { return Math.max(.01, Math.min(120, Math.hypot(cursor.X - pending.X, cursor.Y - pending.Y))); }
function draftBlock() { return { ...block(), AllowOutside: true }; }
function screenSize(pixels) { const m = $('canvas').getScreenCTM(); return pixels / Math.max(.001, Math.hypot(m.a, m.b)); }
function commitCurve() {
  if (!pending || !curveEnd) return;
  try {
    const kind = $('drawing-shape').value, bend = kind === 'curve' ? cursor : arcBend(pending, curveEnd, arcSide);
    const next = addFreeArc(draftBlock(), pending, curveEnd, bend, { kind, crossLines: true });
    const mirrored = applySymmetry(block(), next, $('symmetry-horizontal').checked, $('symmetry-vertical').checked);
    checkpoint(); project.Blocks[blockIndex] = mirrored; cancelDrawing(); changed();
  } catch (error) { notify(error.message); }
}
function lineMarkup(mirror = false) {
  const b = block();
  return b.Lines.map((line, index) => {
    const x1 = mirror ? b.WidthInches - line.Start.X : line.Start.X;
    const x2 = mirror ? b.WidthInches - line.End.X : line.End.X;
    return `<line x1="${x1}" y1="${line.Start.Y}" x2="${x2}" y2="${line.End.Y}" class="seam ${!mirror && selected === index ? 'selected' : ''}"/>${mirror ? '' : `<circle cx="${x1}" cy="${line.Start.Y}" r="${screenSize(1.5)}" class="endpoint"/>`}`;
  }).join('');
}
function renderCanvas() {
  const b = block();
  const padding = b.DraftPadding ?? 2;
  $('canvas').setAttribute('viewBox', `${-padding} ${-padding} ${b.WidthInches + padding * 2} ${b.HeightInches + padding * 2}`);
  const spec = gridSpec(b);
  const sx = spec.stepX * Math.max(1, Math.ceil(b.WidthInches / spec.stepX / 160));
  const sy = spec.stepY * Math.max(1, Math.ceil(b.HeightInches / spec.stepY / 160));
  let guides = '';
  if (b.ShowGrid !== false) {
    for (let x = Math.ceil(-padding / sx) * sx; x <= b.WidthInches + padding; x += sx) guides += `<line x1="${x}" y1="${-padding}" x2="${x}" y2="${b.HeightInches + padding}" class="grid-line"/>`;
    for (let y = Math.ceil(-padding / sy) * sy; y <= b.HeightInches + padding; y += sy) guides += `<line x1="${-padding}" y1="${y}" x2="${b.WidthInches + padding}" y2="${y}" class="grid-line"/>`;
  }
  const outsidePoint = p => p && (p.X < 0 || p.Y < 0 || p.X > b.WidthInches || p.Y > b.HeightInches);
  const previewEnd = pending && cursor && !outsidePoint(pending) && !outsidePoint(cursor) ? extendLineToNextHit(b, pending, cursor, $('cross-lines').checked) || cursor : cursor;
  const anchorMarkup = hoverAnchor && tool === 'draw' ? `<circle cx="${hoverAnchor.point.X}" cy="${hoverAnchor.point.Y}" r="${screenSize(4)}" class="anchor-cue ${hoverAnchor.kind}"/><path d="M${hoverAnchor.point.X - screenSize(6)} ${hoverAnchor.point.Y}h${screenSize(12)} M${hoverAnchor.point.X} ${hoverAnchor.point.Y - screenSize(6)}v${screenSize(12)}" class="anchor-crosshair"/>` : '';
  const arcPoints = pending && $('drawing-shape').value !== 'line' ? curvePreviewPoints() : [];
  const end = curveEnd || cursor;
  const mid = pending && end ? { X: (pending.X + end.X) / 2, Y: (pending.Y + end.Y) / 2 } : null;
  const bend = mid ? arcBend(pending, end, arcSide) : null;
  let arrow = '';
  if (arcPoints.length && ['half', 'quarter'].includes($('drawing-shape').value)) {
    try {
      const arc = sampleCurve(pending, end, bend, $('drawing-shape').value), at = arc[Math.floor(arc.length / 2)];
      const d = Math.hypot(bend.X - mid.X, bend.Y - mid.Y) || 1, length = Math.min(.35, d * .45);
      arrow = `<line x1="${at.X}" y1="${at.Y}" x2="${at.X + (mid.X - bend.X) / d * length}" y2="${at.Y + (mid.Y - bend.Y) / d * length}" class="concavity-arrow" marker-end="url(#concavity)"/>`;
    } catch {}
  }
  $('canvas').innerHTML = `<defs><marker id="concavity" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M0 0 L10 5 L0 10 Z" fill="#005bff"/></marker></defs><rect x="0" y="0" width="${b.WidthInches}" height="${b.HeightInches}" fill="#fffefb"/>${b.SourceImageBase64 ? `<image href="data:image/${b.SourceImageBase64.startsWith('/9j/') ? 'jpeg' : b.SourceImageBase64.startsWith('UklGR') ? 'webp' : b.SourceImageBase64.startsWith('Qk') ? 'bmp' : 'png'};base64,${escape(b.SourceImageBase64)}" x="${b.SourceImageOffsetX || 0}" y="${b.SourceImageOffsetY || 0}" width="${b.WidthInches}" height="${b.HeightInches}" opacity="${Number.isFinite(b.SourceImageOpacity) ? Math.max(0, Math.min(1, b.SourceImageOpacity)) : 0.35}"/>` : ''}${analyzePieces(b).faces.map(f => `<path d="${facePath(f)}" fill-rule="evenodd" fill="${f.color || (b.SourceImageBase64 ? 'transparent' : '#fffefb')}" class="piece-fill"/>`).join('')}${guides}<rect x="0" y="0" width="${b.WidthInches}" height="${b.HeightInches}" class="block-border"/>${lineMarkup()}${pieceLabelMarkup()}${anchorMarkup}${$('symmetry-vertical').checked ? `<line x1="${b.WidthInches / 2}" y1="0" x2="${b.WidthInches / 2}" y2="${b.HeightInches}" class="symmetry-guide"/>` : ''}${$('symmetry-horizontal').checked ? `<line x1="0" y1="${b.HeightInches / 2}" x2="${b.WidthInches}" y2="${b.HeightInches / 2}" class="symmetry-guide"/>` : ''}${pending ? `<circle cx="${pending.X}" cy="${pending.Y}" r="${screenSize(3)}" class="pending-point"/>${$('drawing-shape').value !== 'line' ? `<polyline points="${arcPoints.map(p => `${p.X},${p.Y}`).join(' ')}" class="pending-line arc-preview" fill="none"/>${arrow}` : previewEnd ? `<line x1="${pending.X}" y1="${pending.Y}" x2="${previewEnd.X}" y2="${previewEnd.Y}" class="pending-line"/>` : ''}` : ''}`;
  $('canvas').classList.toggle('selecting', tool === 'select');
  if (b.SourceImageCenterGuide) $('canvas').insertAdjacentHTML('beforeend', `<path d="M0 ${b.HeightInches / 2}H${b.WidthInches} M${b.WidthInches / 2} 0V${b.HeightInches}" class="image-center-cross"/>`);
  $('place-curve').disabled = !pending || !cursor || $('drawing-shape').value === 'line' || $('drawing-shape').value === 'circle';
  $('canvas').setAttribute('aria-label', 'Quilt drafting canvas. Arcs can start anywhere. Full circles: hold at center and drag. Straight seams: start on an edge or seam.');
}
function renderQuiltPreview() {
  const b = block();
  const layout = project.Layout;
  let planned;
  try { planned = planQuiltLayout(b, layout); }
  catch (error) {
    $('quilt-preview').innerHTML = '';
    $('quilt-grid-size').textContent = '—';
    $('quilt-block-count').textContent = '—';
    $('quilt-covered-size').textContent = '—';
    return;
  }

  $('quilt-width').value = layout.WidthInches;
  $('quilt-height').value = layout.HeightInches;
  $('alternate-mirrors').checked = layout.AlternateMirrors !== false;
  $('quilt-preset').value = QUILT_PRESETS[layout.Preset] ? layout.Preset : 'custom';
  $('quilt-grid-size').textContent = `${planned.columns} × ${planned.rows}`;
  $('quilt-block-count').textContent = String(planned.instances.length);
  $('quilt-covered-size').textContent = `${planned.usedWidth}″ × ${planned.usedHeight}″`;
  $('quilt-size-label').textContent = `${planned.width}″ × ${planned.height}″`;

  const svg = $('quilt-preview');
  svg.setAttribute('viewBox', `${-planned.border} ${-planned.border} ${planned.totalWidth} ${planned.totalHeight}`);
  const analysis = analyzePieces(b);
  const blocks = planned.instances.map(instance => {
    const seams = clippedBlockLines(b).map(line => {
      const s = transformBlockPoint(b, instance, line.Start), e = transformBlockPoint(b, instance, line.End);
      return `<line x1="${s.X}" y1="${s.Y}" x2="${e.X}" y2="${e.Y}" class="quilt-seam"/>`;
    }).join('');
    return `<g data-instance="${escape(instance.key)}" class="quilt-block ${instance.mirrorX ? 'mirrored' : ''}">${analysis.faces.map(f => `<path d="${facePath(f, p => transformBlockPoint(b, instance, p))}" fill-rule="evenodd" fill="${f.color || '#fffefb'}"/>`).join('')}${seams}<rect x="${instance.x}" y="${instance.y}" width="${b.WidthInches}" height="${b.HeightInches}" class="quilt-block-border ${selectedInstance === instance.key ? 'selected-block' : ''}"/></g>`;
  }).join('');
  svg.innerHTML = `<rect x="${-planned.border}" y="${-planned.border}" width="${planned.totalWidth}" height="${planned.totalHeight}" fill="${planned.borderColor}" class="quilt-border"/><rect width="${planned.width}" height="${planned.height}" class="quilt-background"/>${blocks}`;
  $('quilt-border-width').value = planned.border; $('quilt-border-color').value = planned.borderColor;
  $('quilt-total-size').textContent = `Quilt field ${planned.width}″ × ${planned.height}″ · with border ${planned.totalWidth}″ × ${planned.totalHeight}″`;
}

function render() {
  const b = block();
  $('block-select').innerHTML = project.Blocks.map((b, i) => `<option value="${i}">${escape(b.Name)}</option>`).join('');
  $('block-select').value = blockIndex;
  $('block-name').value = b.Name;
  $('width').value = b.WidthInches;
  $('height').value = b.HeightInches;
  $('grid-mode').value = b.GridMode || 'subdivisions';
  $('grid-columns').value = b.GridColumns || 100; $('grid-rows').value = b.GridRows || 100;
  $('grid-spacing').value = b.GridSizeInches || .25;
  $('grid-spacing').closest('label').hidden = b.GridMode !== 'inches';
  $('grid-columns').closest('.field-row').hidden = b.GridMode === 'inches';
  $('snap').checked = b.SnapToGrid !== false; $('show-grid').checked = b.ShowGrid !== false;
  $('opacity').value = Number.isFinite(b.SourceImageOpacity) ? b.SourceImageOpacity : 0.35;
  $('image-offset-x').value = b.SourceImageOffsetX || 0; $('image-offset-y').value = b.SourceImageOffsetY || 0;
  $('image-center-guide').checked = !!b.SourceImageCenterGuide;
  $('draft-padding').value = b.DraftPadding ?? 2;
  $('cross-lines').checked = !!b.CrossLines;
  $('symmetry-horizontal').checked = !!b.SymmetryHorizontal;
  $('symmetry-vertical').checked = !!b.SymmetryVertical;
  $('drawing-shape').value = b.DrawingShape || 'line';
  $('drawing-snap-mode').value = b.DrawingSnapMode || 'intersection';
  $('design-mode').value = project.Layout.DesignMode || 'repeat';
  $('image-controls').hidden = !b.SourceImageBase64;
  $('canvas-size').textContent = `${b.WidthInches}″ × ${b.HeightInches}″`;
  $('print-size').textContent = `${b.WidthInches}″ × ${b.HeightInches}″`;
  renderPiecesAndPrint();
  const count = seamCount(b); $('line-count').textContent = `${count} ${count === 1 ? 'seam' : 'seams'}${curveEnd ? ' · 1 curve preview (not placed)' : ''}`;
  $('editor-instruction').textContent = tool === 'color' ? 'Click a piece to apply fabric color' : tool === 'idle' ? 'Choose a step above to continue' : curveEnd ? 'Preview the bend · Flip arc direction · click to confirm' : tool === 'select' ? 'Select a seam · right-click to delete a line or curve' : $('drawing-shape').value === 'circle' ? 'Hold at the circle center and drag to resize' : pending ? 'Aim toward the next boundary' : 'Choose a start point';
  $('undo').disabled = undo.length === 0;
  $('redo').disabled = redo.length === 0;
  $('delete-line').disabled = selected < 0;
  renderCanvas();
  renderQuiltPreview();
}

function renderPiecesAndPrint() {
  const analysis = analyzePieces(block());
  const ready = block().LabelsReady !== false;
  for (const id of ['rename-piece', 'rename-section', 'piece-select', 'piece-name']) $(id).disabled = !ready;
  if (!analysis.faces.some(f => f.key === selectedPiece)) selectedPiece = analysis.faces[0]?.key || null;
  $('piece-select').innerHTML = analysis.faces.map((f, i) => `<option value="${escape(f.key)}">${ready ? escape(f.label) : `Unlabeled piece ${i + 1}`}</option>`).join('');
  $('piece-select').value = selectedPiece || '';
  $('piece-name').value = ready ? analysis.faces.find(f => f.key === selectedPiece)?.label || '' : '';
  $('print-section').innerHTML = analysis.sections.map(s => `<option value="${s.letter}">Section ${s.letter}</option>`).join('');
  if (!analysis.sections.some(s => s.letter === previewSection)) previewSection = analysis.sections[0]?.letter;
  $('print-section').value = previewSection;
  $('color-key').innerHTML = colorLegend(analysis).map(c => `<span style="background:${c.color};color:${contrast(c.color)}">${c.code} · ${c.color.toUpperCase()}</span>`).join('');
  try {
    const plans = planSectionPatterns(block(), $('paper').value);
    const total = plans.reduce((n, p) => n + p.tiles.length, 0), p = plans.find(p => p.letter === previewSection);
    $('sheet-count').textContent = plans.length === 1 ? `${total} ${total === 1 ? 'sheet' : 'sheets'} · ${p.columns} × ${p.rows}` : `${total} sheets · ${plans.length} sections`;
    const svg = $('print-preview');
    svg.setAttribute('aria-label', `Mirrored foundation preview, section ${p.letter}`);
    svg.setAttribute('viewBox', `-20 -20 ${p.width + 40} ${p.height + 40}`);
    const line = (l, cls) => `<line x1="${l.start.x}" y1="${l.start.y}" x2="${l.end.x}" y2="${l.end.y}" class="${cls}"/>`;
    svg.innerHTML = p.cuts.map(l => line(l, 'section-cut')).join('') + p.lines.map(l => line(l, 'section-seam')).join('') + p.faces.map(f => {
      const at = p.transform(f.centroid), c = f.color ? p.legend.find(c => c.color === f.color.toLowerCase()) : null;
      return `<text x="${at.x}" y="${at.y}" class="section-label">${escape(f.label)}</text>${c ? `<rect x="${at.x - 9}" y="${at.y + 5}" width="18" height="14" fill="${c.color}" stroke="#222"/><text x="${at.x}" y="${at.y + 16}" class="section-label" style="font-size:8px;fill:${contrast(c.color)}">${c.code}</text>` : ''}`;
    }).join('');
    $('print-error').hidden = true;
    $('export-pdf').disabled = false;
  } catch (error) {
    $('print-error').hidden = false; $('print-error').textContent = error.message;
    $('sheet-count').textContent = 'Correct section geometry';
    $('print-preview').innerHTML = '';
    $('export-pdf').disabled = true;
    $('print-preview').setAttribute('aria-label', error.message);
  }
}
function gridPoint(raw) {
  if (!raw || !$('snap').checked) return raw;
  return snapToGrid(block(), raw, true);
}
function nearestLine(point) {
  let nearest = -1, distance = canvasTolerance();
  block().Lines.forEach((line, i) => { const d = distanceToLine(point, line); if (d < distance) { distance = d; nearest = i; } });
  return nearest;
}
function cancelDrawing() { pending = null; cursor = null; curveEnd = null; hoverAnchor = null; dragOrigin = null; dragging = false; }
function rawCanvasPoint(event) {
  const svg = $('canvas');
  const point = new DOMPoint(event.clientX, event.clientY).matrixTransform(svg.getScreenCTM().inverse());
  const p = block().DraftPadding ?? 2;
  if (point.x < -p || point.y < -p || point.x > block().WidthInches + p || point.y > block().HeightInches + p) return null;
  return { X: point.x, Y: point.y };
}
function canvasTolerance() {
  const m = $('canvas').getScreenCTM();
  return 12 / Math.max(1e-9, Math.hypot(m.a, m.b));
}

function canvasPoint(event) {
  const raw = gridPoint(rawCanvasPoint(event)); if (!raw) return null;
  return snapDrawingPoint(block(), raw, block().DrawingSnapMode || 'intersection', canvasTolerance());
}
function distanceToLine(point, line) {
  const dx = line.End.X - line.Start.X, dy = line.End.Y - line.Start.Y;
  const t = Math.max(0, Math.min(1, ((point.X - line.Start.X) * dx + (point.Y - line.Start.Y) * dy) / (dx * dx + dy * dy || 1)));
  return Math.hypot(point.X - line.Start.X - t * dx, point.Y - line.Start.Y - t * dy);
}

function completeConstrainedLine(toward) {
  if (!pending || !toward) return false;
  try {
    const next = addDraftLine(draftBlock(), pending, toward, {
      tolerance: canvasTolerance(),
      anchorMode: 'line',
      crossLines: $('cross-lines').checked,
      boundaryType: currentLineRole,
    });
    const mirrored = applySymmetry(block(), next, $('symmetry-horizontal').checked, $('symmetry-vertical').checked);
    checkpoint(); project.Blocks[blockIndex] = { ...mirrored, LabelsReady: false };
    pending = null; cursor = null; hoverAnchor = null; dragOrigin = null; dragging = false;
    changed();
    return true;
  } catch (error) {
    notify(error.message);
    return false;
  }
}

$('canvas').addEventListener('pointerdown', event => {
  if (event.button !== 0) return;
  if (tool === 'idle') return;
  $('canvas').focus();

  if (tool === 'color') {
    const raw = rawCanvasPoint(event); if (!raw) return;
    const face = analyzePieces(block()).faces.find(f => pointInFace(raw, f));
    if (face) { checkpoint(); project.Blocks[blockIndex] = setPieceSetting(block(), face.key, { Color: $('fabric-color').value }); selectedPiece = face.key; changed(); }
    return;
  }
  if ($('drawing-shape').value !== 'line' && tool === 'draw') {
    const raw = rawCanvasPoint(event); if (!raw) return;
    if ($('drawing-shape').value === 'circle') {
      pending = gridPoint(raw); cursor = pending; dragging = true;
      dragOrigin = { x: event.clientX, y: event.clientY };
      $('canvas').setPointerCapture(event.pointerId); renderCanvas(); return;
    }
    if (curveEnd) {
      if ($('drawing-shape').value === 'curve') cursor = gridPoint(raw);
      commitCurve();
    } else {
      const point = gridPoint(raw);
      const anchor = findAnchor(block(), point, screenSize(3), 'line');
      if (pending) curveEnd = anchor?.point || point; else pending = anchor?.point || point;
      cursor = raw;
      if (curveEnd && ['half', 'quarter'].includes($('drawing-shape').value)) commitCurve(); else render();
    }
    return;
  }
  if (tool === 'select') {
    const raw = rawCanvasPoint(event);
    if (!raw) return;
    let nearest = -1, distance = block().WidthInches / $('canvas').getBoundingClientRect().width * 12;
    block().Lines.forEach((line, i) => { const d = distanceToLine(raw, line); if (d < distance) { distance = d; nearest = i; } });
    selected = nearest; render(); return;
  }

  const raw = rawCanvasPoint(event);
  if (!raw) return;

  if (pending) {
    const toward = canvasPoint(event) || raw;
    completeConstrainedLine(toward);
    return;
  }

  const anchor = findAnchor(block(), gridPoint(raw), canvasTolerance(), 'line');
  const outside = raw.X < 0 || raw.Y < 0 || raw.X > block().WidthInches || raw.Y > block().HeightInches;
  if (!anchor && !outside) {
    hoverAnchor = null;
    notify('Start the seam on a block edge, existing line, or intersection.');
    renderCanvas();
    return;
  }

  pending = anchor?.point || gridPoint(raw);
  hoverAnchor = anchor;
  cursor = pending;
  dragOrigin = { x: event.clientX, y: event.clientY };
  dragging = true;
  try { $('canvas').setPointerCapture(event.pointerId); } catch {}
  renderCanvas();
});

$('canvas').addEventListener('pointermove', event => {
  const raw = rawCanvasPoint(event);
  if (!raw) { hoverAnchor = null; if (!pending) renderCanvas(); return; }

  hoverAnchor = findAnchor(block(), gridPoint(raw), canvasTolerance(), 'line');
  if (pending) cursor = $('drawing-shape').value !== 'line' ? gridPoint(raw) : canvasPoint(event) || raw;
  renderCanvas();
});

$('canvas').addEventListener('pointerup', event => {
  if (!dragging || !pending) return;
  if ($('drawing-shape').value === 'circle') {
    cursor = gridPoint(rawCanvasPoint(event)) || cursor;
    try {
      const next = addCircle(draftBlock(), pending, circleRadius(), { crossLines: true });
      const mirrored = applySymmetry(block(), next, $('symmetry-horizontal').checked, $('symmetry-vertical').checked);
      checkpoint(); project.Blocks[blockIndex] = mirrored; cancelDrawing(); changed();
    } catch (error) { cancelDrawing(); render(); notify(error.message); }
    try { $('canvas').releasePointerCapture(event.pointerId); } catch {} return;
  }
  const moved = dragOrigin ? Math.hypot(event.clientX - dragOrigin.x, event.clientY - dragOrigin.y) : 0;
  if (moved >= 4) {
    const toward = canvasPoint(event) || rawCanvasPoint(event);
    dragging = false;
    completeConstrainedLine(toward);
  } else {
    dragging = false; dragOrigin = null;
    renderCanvas();
  }
  try { $('canvas').releasePointerCapture(event.pointerId); } catch {}
});

$('canvas').addEventListener('pointerleave', () => {
  if (!dragging) hoverAnchor = null;
  if (!pending) cursor = null;
  renderCanvas();
});

$('canvas').addEventListener('pointercancel', () => { cancelDrawing(); render(); });
$('canvas').addEventListener('contextmenu', event => {
  event.preventDefault(); const raw = rawCanvasPoint(event); if (!raw) return;
  const i = nearestLine(raw); if (i < 0) return;
  checkpoint(); project.Blocks[blockIndex] = removeSelectedGeometry(i); cancelDrawing(); selected = -1; changed();
  notify('Deleted. Undo restores the previous geometry.');
});
function removeSelectedGeometry(i) { return $('delete-mode').value === 'stroke' ? deleteDraft(block(), i) : deleteSegment(block(), i); }
$('color-tool').onclick = () => chooseTool('color');
$('piece-select').onchange = () => { selectedPiece = $('piece-select').value; renderPiecesAndPrint(); };
$('rename-piece').onclick = () => {
  try { const next = setPieceSetting(block(), selectedPiece, { Label: $('piece-name').value.trim().toUpperCase() }); checkpoint(); project.Blocks[blockIndex] = next; changed(); } catch (error) { notify(error.message); }
};
$('rename-section').onclick = () => {
  try {
    const face = analyzePieces(block()).faces.find(f => f.key === selectedPiece);
    if (!face) return;
    const to = $('piece-name').value.trim().toUpperCase().replace(/\d+$/, '');
    const next = renameSection(block(), face.section, to);
    checkpoint(); project.Blocks[blockIndex] = next; changed();
  } catch (error) { notify(error.message); }
};
const generateLabels = () => { try { const next = labelSections(block()); checkpoint(); project.Blocks[blockIndex] = next; changed(); notify('Sections and sewing order labeled. You can now correct names manually.'); } catch (error) { notify(error.message); } };
$('label-sections').onclick = generateLabels;
$('reset-labels').onclick = generateLabels;
$('flip-curve').onclick = () => { arcSide *= -1; renderCanvas(); };
$('place-curve').onclick = () => { if (!curveEnd) curveEnd = cursor; commitCurve(); };
$('print-section').onchange = () => { previewSection = $('print-section').value; renderPiecesAndPrint(); };
for (const [id, key] of [['drawing-shape', 'DrawingShape'], ['cross-lines', 'CrossLines'], ['symmetry-horizontal', 'SymmetryHorizontal'], ['symmetry-vertical', 'SymmetryVertical'], ['snap', 'SnapToGrid'], ['show-grid', 'ShowGrid']]) $(id).onchange = () => { checkpoint(); block()[key] = id === 'drawing-shape' ? $(id).value : $(id).checked; cancelDrawing(); changed(); };
$('draw-tool').onclick = () => chooseTool('draw');
$('select-tool').onclick = () => chooseTool('select');
$('undo').onclick = () => { if (!undo.length) return; redo.push(structuredClone(block())); project.Blocks[blockIndex] = undo.pop(); cancelDrawing(); selected = -1; changed(); };
$('redo').onclick = () => { if (!redo.length) return; undo.push(structuredClone(block())); project.Blocks[blockIndex] = redo.pop(); cancelDrawing(); selected = -1; changed(); };
$('delete-line').onclick = () => { if (selected < 0) return; checkpoint(); project.Blocks[blockIndex] = removeSelectedGeometry(selected); selected = -1; changed(); };
$('block-name').onchange = () => { checkpoint(); block().Name = $('block-name').value.trim() || 'Untitled block'; changed(); };
$('dimensions-form').onsubmit = event => {
  event.preventDefault();
  const width = Number($('width').value), height = Number($('height').value);
  if (![width, height].every(value => Number.isFinite(value) && value >= 1 && value <= 240)) { notify('Choose dimensions between 1 and 240 inches.'); return; }
  try {
    const next = resizeBlock(block(), width, height);
    checkpoint(); project.Blocks[blockIndex] = next; cancelDrawing(); changed(); notify('Block, seam lines, labels, and colors resized.');
  } catch (error) { notify(error.message); render(); }
};
for (const [id, key] of [['grid-mode', 'GridMode'], ['grid-columns', 'GridColumns'], ['grid-rows', 'GridRows'], ['grid-spacing', 'GridSizeInches']]) $(id).onchange = () => {
  const value = id === 'grid-mode' ? $(id).value : Number($(id).value);
  try { gridSpec({ ...block(), [key]: value }); checkpoint(); block()[key] = value; cancelDrawing(); changed(); }
  catch (error) { notify(error.message); render(); }
};
$('drawing-snap-mode').onchange = () => { checkpoint(); block().DrawingSnapMode = $('drawing-snap-mode').value; pending = null; changed(); };
$('draft-padding').onchange = () => { const n = Number($('draft-padding').value); if (!Number.isFinite(n) || n < .5 || n > 24) { notify('Choose 0.5–24 inches of drawing margin.'); render(); return; } checkpoint(); block().DraftPadding = n; changed(); };
function moveImage(x, y) {
  if (![x, y].every(n => Number.isFinite(n) && Math.abs(n) <= 240)) { notify('Image offsets must be between -240 and 240 inches.'); render(); return; }
  checkpoint(); block().SourceImageOffsetX = x; block().SourceImageOffsetY = y; changed();
}
for (const id of ['image-offset-x', 'image-offset-y']) $(id).onchange = () => moveImage(Number($('image-offset-x').value), Number($('image-offset-y').value));
for (const [id, dx, dy] of [['image-left', -1, 0], ['image-right', 1, 0], ['image-up', 0, -1], ['image-down', 0, 1]]) $(id).onclick = () => {
  const n = Number($('image-nudge').value); if (!Number.isFinite(n) || n < .001 || n > 12) { notify('Choose a nudge from 0.001 to 12 inches.'); return; }
  moveImage((block().SourceImageOffsetX || 0) + dx * n, (block().SourceImageOffsetY || 0) + dy * n);
};
$('image-reset').onclick = () => moveImage(0, 0);
$('image-center-guide').onchange = () => { checkpoint(); block().SourceImageCenterGuide = $('image-center-guide').checked; changed(); };
$('clear-drawing').onclick = () => {
  if (!block().Lines.length) { notify('There are no lines to clear.'); return; }
  if (!window.confirm('Clear every line from this block? You can use Undo immediately afterward to restore them.')) return;
  checkpoint(); block().Lines = []; block().PieceSettings = {}; block().LabelsReady = false; selected = -1; cancelDrawing(); changed(); notify('Drawing cleared. Use Undo to restore the previous lines.');
};
$('paper').onchange = render;
$('block-select').onchange = () => { blockIndex = Number($('block-select').value); if (project.Layout.DesignMode === 'repeat') project.Layout.RepeatBlockId = block().Id; undo = []; redo = []; cancelDrawing(); selected = -1; persist(); render(); };
function resizeLargeBlock(width, height) {
  if (project.Layout.DesignMode !== 'large') return;
  const large = project.Blocks.find(candidate => candidate.Id === project.Layout.LargeBlockId);
  if (!large) return;
  project.Blocks[project.Blocks.indexOf(large)] = resizeBlock(large, width, height);
}
$('quilt-preset').onchange = () => {
  const key = $('quilt-preset').value;
  if (QUILT_PRESETS[key]) {
    project.Layout.Preset = key;
    project.Layout.WidthInches = QUILT_PRESETS[key].width;
    project.Layout.HeightInches = QUILT_PRESETS[key].height;
    resizeLargeBlock(project.Layout.WidthInches, project.Layout.HeightInches);
    changed();
  } else {
    project.Layout.Preset = 'custom';
    persist();
    renderQuiltPreview();
  }
};
const updateQuiltSize = () => {
  const width = Number($('quilt-width').value), height = Number($('quilt-height').value);
  if (![width, height].every(value => Number.isFinite(value) && value >= 1 && value <= 240)) {
    notify('Choose quilt dimensions between 1 and 240 inches.');
    return;
  }
  if (project.Layout.DesignMode === 'repeat' && (width < block().WidthInches || height < block().HeightInches)) {
    notify('The quilt must be at least as large as one block.');
    return;
  }
  project.Layout.Preset = 'custom';
  project.Layout.WidthInches = width;
  project.Layout.HeightInches = height;
  resizeLargeBlock(width, height);
  changed();
};
$('quilt-width').onchange = updateQuiltSize;
$('quilt-height').onchange = updateQuiltSize;
$('alternate-mirrors').onchange = () => {
  project.Layout.AlternateMirrors = $('alternate-mirrors').checked;
  changed();
};
for (const id of ['quilt-border-width', 'quilt-border-color']) $(id).onchange = () => {
  const next = { ...project.Layout, BorderInches: Number($('quilt-border-width').value), BorderColor: $('quilt-border-color').value };
  try { planQuiltLayout(block(), next); project.Layout = next; changed(); } catch (error) { notify(error.message); renderQuiltPreview(); }
};
$('quilt-preview').onclick = event => {
  const instance = event.target.closest('[data-instance]'); if (!instance) return;
  selectedInstance = instance.dataset.instance;
  $('selected-block-info').textContent = `Selected block ${selectedInstance.split(':').slice(-2).map(n => Number(n) + 1).join(', ')}`;
  renderQuiltPreview();
};
function updateInstance(change) {
  if (!selectedInstance) { notify('Select a block in the quilt preview first.'); return; }
  try {
    const instance = planQuiltLayout(block(), project.Layout).instances.find(i => i.key === selectedInstance);
    if (!instance) throw new Error('Select a block in the current layout.');
    const current = { mirrorX: instance.mirrorX, mirrorY: instance.mirrorY, rotation: instance.rotation };
    const next = { ...project.Layout, BlockTransforms: { ...project.Layout.BlockTransforms, [selectedInstance]: change(current) } };
    planQuiltLayout(block(), next); project.Layout = next; changed();
  } catch (error) { notify(error.message); }
}
$('flip-block-x').onclick = () => updateInstance(t => ({ ...t, mirrorX: !t.mirrorX }));
$('flip-block-y').onclick = () => updateInstance(t => ({ ...t, mirrorY: !t.mirrorY }));
$('rotate-block').onclick = () => updateInstance(t => ({ ...t, rotation: (t.rotation + 180) % 360 }));
$('quarter-turn-block').onclick = () => updateInstance(t => ({ ...t, rotation: (t.rotation + 90) % 360 }));
$('reset-block-transform').onclick = () => { if (selectedInstance) { delete project.Layout.BlockTransforms?.[selectedInstance]; changed(); } };
$('design-mode').onchange = () => {
  const mode = $('design-mode').value;
  if (mode === 'large') {
    if (!project.Layout.LargeBlockId || !project.Blocks.some(candidate => candidate.Id === project.Layout.LargeBlockId)) {
      const large = { Id: crypto.randomUUID(), Name: 'Whole quilt', WidthInches: project.Layout.WidthInches, HeightInches: project.Layout.HeightInches, GridMode: 'subdivisions', GridColumns: 100, GridRows: 100, LabelsReady: false, Lines: [], SourceImageOpacity: 0.35, DrawingSnapMode: 'intersection' };
      project.Blocks.push(large); project.Layout.LargeBlockId = large.Id;
    }
    if (block().Id !== project.Layout.LargeBlockId) project.Layout.RepeatBlockId = block().Id;
    project.Layout.DesignMode = 'large';
    blockIndex = project.Blocks.findIndex(candidate => candidate.Id === project.Layout.LargeBlockId);
  } else {
    project.Layout.DesignMode = 'repeat';
    const target = project.Blocks.findIndex(candidate => candidate.Id === project.Layout.RepeatBlockId);
    blockIndex = target >= 0 ? target : 0;
  }
  undo = []; redo = []; cancelDrawing(); selected = -1; changed();
};

$('new-block').onclick = () => {
  if (project.Blocks.length >= 100) { notify('A project can contain at most 100 blocks.'); return; }
  project.Blocks.push({ Id: crypto.randomUUID(), Name: `Block ${project.Blocks.length + 1}`, WidthInches: 12, HeightInches: 12, GridMode: 'subdivisions', GridColumns: 100, GridRows: 100, LabelsReady: false, Lines: [], SourceImageOpacity: 0.35, DrawingSnapMode: 'intersection' });
  blockIndex = project.Blocks.length - 1; project.Layout.DesignMode = 'repeat'; project.Layout.RepeatBlockId = block().Id; undo = []; redo = []; cancelDrawing(); selected = -1; changed();
};
function download(bytes, type, filename) {
  const url = URL.createObjectURL(new Blob([bytes], { type }));
  const link = document.createElement('a'); link.href = url; link.download = filename; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}
const filename = name => String(name).replace(/[^a-z0-9_-]/gi, '-').replace(/-+/g, '-').slice(0, 80) || 'quiltstudio';
$('save-project').onclick = () => { download(JSON.stringify(project, null, 2), 'application/json', `${filename(block().Name)}.quiltstudio`); notify('Project copy saved. You can reopen it here or in the Windows prototype.'); };
$('open-project').onclick = () => $('project-file').click();
$('project-file').onchange = async () => {
  const file = $('project-file').files[0]; if (!file) return;
  try {
    if (file.size > 20_000_000) throw new Error('Project files must be smaller than 20 MB.');
    const incoming = parseProject(await file.text());
    project = incoming; blockIndex = 0; undo = []; redo = []; cancelDrawing(); selected = -1; changed(); notify('Project opened.');
  } catch (error) { notify(error.message); }
  $('project-file').value = '';
};
$('import-image').onclick = () => $('image-file').click();
$('image-file').onchange = async () => {
  const file = $('image-file').files[0]; if (!file) return;
  try {
    if (file.size > 10_000_000) throw new Error('Reference images must be smaller than 10 MB.');
    if (!['image/png', 'image/jpeg', 'image/webp', 'image/bmp'].includes(file.type)) throw new Error('Choose a PNG, JPEG, WebP, or BMP image.');
    const dataUrl = await new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.onerror = () => reject(new Error('Could not read this image.')); reader.readAsDataURL(file); });
    await new Promise((resolve, reject) => { const image = new Image(); image.onload = resolve; image.onerror = () => reject(new Error('This image could not be opened.')); image.src = dataUrl; });
    checkpoint(); block().SourceImageBase64 = dataUrl.split(',')[1]; block().SourceImageFileName = file.name; changed();
  } catch (error) { notify(error.message); }
  $('image-file').value = '';
};
$('opacity').onchange = () => { checkpoint(); block().SourceImageOpacity = Number($('opacity').value); changed(); };
$('remove-image').onclick = () => { checkpoint(); delete block().SourceImageBase64; delete block().SourceImageFileName; changed(); };
$('export-pdf').onclick = async () => {
  const button = $('export-pdf'); button.disabled = true;
  try {
    const { createPatternPdf } = await import('./pdf.js');
    const bytes = await createPatternPdf(block(), $('paper').value);
    download(bytes, 'application/pdf', `${filename(block().Name)}-FPP-${$('paper').value}.pdf`);
    notify('PDF downloaded. Print at Actual size / 100% and measure the 1-inch square.');
  } catch (error) { notify(`Could not export: ${error.message}`); }
  finally { button.disabled = false; }
};
$('load-sample').onclick = () => {
  if (project.Blocks.length >= 100) { notify('A project can contain at most 100 blocks.'); return; }
  project.Blocks.push(demoProject().Blocks[0]); blockIndex = project.Blocks.length - 1; undo = []; redo = []; cancelDrawing(); selected = -1; changed(); notify('Sample added as a new block.');
};
document.addEventListener('keydown', event => {
  if (event.target.closest('input, select, textarea')) return;
  if (event.key === 'Escape') { pending = null; cursor = null; hoverAnchor = null; dragOrigin = null; dragging = false; curveEnd = null; selected = -1; render(); }
  if (event.key === 'Enter' && curveEnd) { event.preventDefault(); commitCurve(); }
  if (event.key === 'Delete' || event.key === 'Backspace') { if (selected >= 0) { event.preventDefault(); $('delete-line').click(); } }
  if (event.ctrlKey || event.metaKey) {
    if (event.key.toLowerCase() === 'z') { event.preventDefault(); $(event.shiftKey ? 'redo' : 'undo').click(); }
    if (event.key.toLowerCase() === 'y') { event.preventDefault(); $('redo').click(); }
    if (event.key.toLowerCase() === 's') { event.preventDefault(); $('save-project').click(); }
  }
});
setStep(0);
if (restoreMessage) notify(restoreMessage);
