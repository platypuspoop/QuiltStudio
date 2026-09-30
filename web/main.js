import './style.css';
import { demoProject, parseProject, planPattern, SEAM_ALLOWANCE } from './pattern.js';
import { createPatternPdf } from './pdf.js';

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
let noticeTimer;
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
        <form id="dimensions-form"><div class="field-row"><label class="field">Width <span>in</span><input id="width" type="number" min="1" max="60" step="0.25" required /></label><span class="multiply">×</span><label class="field">Height <span>in</span><input id="height" type="number" min="1" max="60" step="0.25" required /></label></div><button class="button outlined full" type="submit">Apply dimensions</button></form>
        <p class="field-help">Finished size, before seam allowance. Resizing scales your seam lines.</p>
        <hr/><div class="panel-label">DRAWING GUIDES</div>
        <label class="field">Grid spacing<select id="grid"><option value="1">1 inch</option><option value="0.5">½ inch</option><option value="0.25">¼ inch</option><option value="0.125">⅛ inch</option><option value="0.0625">¹⁄₁₆ inch</option></select></label>
        <label class="check-field"><input type="checkbox" id="snap" checked /><span>Snap to grid</span><span class="switch" aria-hidden="true"></span></label>
        <hr/><div class="panel-label">TRACE AN IDEA</div>
        <button id="import-image" class="button outlined full">${icon('image')} Add reference image</button>
        <div id="image-controls" hidden><label class="field range-field">Image opacity<input id="opacity" type="range" min="0" max="1" step="0.05" value="0.35" /></label><button id="remove-image" class="text-button">Remove image</button></div>
        <p class="field-help">Your image stays in your browser. It won’t appear on the printed pattern.</p>
        <div class="tip-card"><span>START WITH A LINE</span><p>Click a start point, then an end point. Every line becomes a seam on your foundation.</p><small>Esc cancels · Ctrl/⌘ Z undoes</small></div>
      </aside>
      <div class="editor panel">
        <div class="editor-toolbar"><div class="tool-group" role="group" aria-label="Drawing tools"><button id="draw-tool" class="tool active" aria-pressed="true">${icon('draw')} Line</button><button id="select-tool" class="tool" aria-pressed="false">${icon('select')} Select</button></div><div class="tool-group"><button id="undo" class="icon-button" aria-label="Undo" title="Undo">${icon('undo')}</button><button id="redo" class="icon-button" aria-label="Redo" title="Redo">${icon('redo')}</button><span class="tool-divider"></span><button id="delete-line" class="icon-button" aria-label="Delete selected seam" title="Delete selected seam">${icon('trash')}</button></div></div>
        <div class="canvas-wrap"><div class="canvas-caption"><span>DESIGN VIEW</span><span id="canvas-size"></span></div><svg id="canvas" role="application" aria-label="Block seam drawing canvas. Click two points to draw a seam." tabindex="0"></svg><div class="canvas-legend"><span><i class="legend-line"></i> Seam line</span><span><i class="legend-dot"></i> Endpoint</span><span>Finished block</span></div></div>
        <div class="editor-footer"><span id="editor-instruction">Click two points to draw a seam</span><span id="line-count"></span></div>
      </div>
      <aside class="print-panel panel"><div class="print-heading"><span class="step-dot">02</span><h2>Make it printable</h2></div><p class="print-copy">A foundation that’s ready for paper.</p><div class="preview-wrap"><span class="preview-tag">MIRRORED PRINT VIEW</span><svg id="print-preview" aria-label="Mirrored foundation preview"></svg><div class="preview-caption">+ ¼″ outer seam allowance</div></div>
        <label class="field">Paper size<select id="paper"><option value="letter">US Letter · 8.5 × 11 in</option><option value="a4">A4 · 210 × 297 mm</option></select></label>
        <div class="print-specs"><div><span>Finished block</span><strong id="print-size"></strong></div><div><span>Pattern sheets</span><strong id="sheet-count"></strong></div><div><span>Print scale</span><strong>100% · actual size</strong></div></div>
        <button id="export-pdf" class="button primary full">${icon('download')} Download FPP pattern</button><p class="export-note">Vector PDF · no account needed</p>
        <div class="calibration-note"><span class="calibration-square">1″</span><p><strong>Measure before you sew.</strong>Your PDF includes a 1-inch test square. Print at actual size, then check it with a ruler.</p></div>
        <p class="scope-note">This is a seam template. Piece numbering and sewing order are not checked yet.</p>
      </aside>
    </section>
    <section class="howto"><div><span class="step-number">01 / DESIGN</span><h3>Find your lines.</h3><p>Trace an image or draw from scratch. The sample block is here to help you get started.</p></div><div><span class="step-number">02 / PRINT</span><h3>Keep it true to size.</h3><p>Open the PDF and choose Actual size or 100%. Turn off Fit and Shrink in your print dialog.</p></div><div><span class="step-number">03 / CHECK</span><h3>Then make it yours.</h3><p>Measure the test square. Join tiled pages using the ¼-inch overlap and matching seam lines.</p></div></section>
    <footer class="page-footer"><span>QuiltStudio <span>·</span> A work in progress, stitch by stitch.</span><button id="load-sample" class="text-button">Open sample block ${icon('arrow')}</button></footer>
  </main>
  <div id="notice" class="notice" role="status" aria-live="polite" hidden></div>
  <input id="project-file" type="file" accept=".quiltstudio,.json" hidden />
  <input id="image-file" type="file" accept="image/png,image/jpeg,image/webp,image/bmp" hidden />
`;

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
  tool = next; pending = null; cursor = null; selected = -1;
  for (const name of ['draw', 'select']) {
    $(`${name}-tool`).classList.toggle('active', tool === name);
    $(`${name}-tool`).setAttribute('aria-pressed', String(tool === name));
  }
  render();
}
function lineMarkup(mirror = false) {
  const b = block();
  return b.Lines.map((line, index) => {
    const x1 = mirror ? b.WidthInches - line.Start.X : line.Start.X;
    const x2 = mirror ? b.WidthInches - line.End.X : line.End.X;
    return `<line x1="${x1}" y1="${line.Start.Y}" x2="${x2}" y2="${line.End.Y}" class="seam ${!mirror && selected === index ? 'selected' : ''}"/>${mirror ? '' : `<circle cx="${x1}" cy="${line.Start.Y}" r="0.065" class="endpoint"/><circle cx="${x2}" cy="${line.End.Y}" r="0.065" class="endpoint"/>`}`;
  }).join('');
}
function renderCanvas() {
  const b = block();
  $('canvas').setAttribute('viewBox', `-0.55 -0.55 ${b.WidthInches + 1.1} ${b.HeightInches + 1.1}`);
  const spacing = Number($('grid').value);
  const displaySpacing = spacing * Math.max(1, Math.ceil(Math.max(b.WidthInches, b.HeightInches) / spacing / 160));
  let guides = '';
  for (let x = 0; x <= b.WidthInches; x += displaySpacing) guides += `<line x1="${x}" y1="0" x2="${x}" y2="${b.HeightInches}" class="grid-line"/>`;
  for (let y = 0; y <= b.HeightInches; y += displaySpacing) guides += `<line x1="0" y1="${y}" x2="${b.WidthInches}" y2="${y}" class="grid-line"/>`;
  $('canvas').innerHTML = `<rect x="0" y="0" width="${b.WidthInches}" height="${b.HeightInches}" fill="#fffefb"/>${b.SourceImageBase64 ? `<image href="data:image/${b.SourceImageBase64.startsWith('/9j/') ? 'jpeg' : b.SourceImageBase64.startsWith('UklGR') ? 'webp' : b.SourceImageBase64.startsWith('Qk') ? 'bmp' : 'png'};base64,${escape(b.SourceImageBase64)}" x="0" y="0" width="${b.WidthInches}" height="${b.HeightInches}" opacity="${Number.isFinite(b.SourceImageOpacity) ? Math.max(0, Math.min(1, b.SourceImageOpacity)) : 0.35}"/>` : ''}${guides}<rect x="0" y="0" width="${b.WidthInches}" height="${b.HeightInches}" class="block-border"/>${lineMarkup()}${pending ? `<circle cx="${pending.X}" cy="${pending.Y}" r="0.12" class="pending-point"/>${cursor ? `<line x1="${pending.X}" y1="${pending.Y}" x2="${cursor.X}" y2="${cursor.Y}" class="pending-line"/>` : ''}` : ''}`;
  $('canvas').classList.toggle('selecting', tool === 'select');
}
function render() {
  const b = block();
  $('block-select').innerHTML = project.Blocks.map((b, i) => `<option value="${i}">${escape(b.Name)}</option>`).join('');
  $('block-select').value = blockIndex;
  $('block-name').value = b.Name;
  $('width').value = b.WidthInches;
  $('height').value = b.HeightInches;
  $('grid').value = ['1', '0.5', '0.25', '0.125', '0.0625'].includes(String(b.GridSizeInches)) ? String(b.GridSizeInches) : '0.25';
  $('opacity').value = Number.isFinite(b.SourceImageOpacity) ? b.SourceImageOpacity : 0.35;
  $('image-controls').hidden = !b.SourceImageBase64;
  $('canvas-size').textContent = `${b.WidthInches}″ × ${b.HeightInches}″`;
  $('print-size').textContent = `${b.WidthInches}″ × ${b.HeightInches}″`;
  const plan = planPattern(b, $('paper').value);
  $('sheet-count').textContent = `${plan.tiles.length} ${plan.tiles.length === 1 ? 'sheet' : 'sheets'} · ${plan.columns} × ${plan.rows}`;
  $('line-count').textContent = `${b.Lines.length} ${b.Lines.length === 1 ? 'seam' : 'seams'}`;
  $('editor-instruction').textContent = tool === 'select' ? 'Click a seam to select · Delete to remove' : pending ? 'Choose an end point · Esc to cancel' : 'Click two points to draw a seam';
  $('undo').disabled = undo.length === 0;
  $('redo').disabled = redo.length === 0;
  $('delete-line').disabled = selected < 0;
  const s = SEAM_ALLOWANCE;
  $('print-preview').setAttribute('viewBox', `${-s - 0.3} ${-s - 0.3} ${b.WidthInches + 2 * s + 0.6} ${b.HeightInches + 2 * s + 0.6}`);
  $('print-preview').innerHTML = `<rect x="${-s}" y="${-s}" width="${b.WidthInches + 2 * s}" height="${b.HeightInches + 2 * s}" class="cut-border"/><rect width="${b.WidthInches}" height="${b.HeightInches}" class="print-border"/>${lineMarkup(true)}`;
  renderCanvas();
}
function canvasPoint(event) {
  const svg = $('canvas');
  const point = new DOMPoint(event.clientX, event.clientY).matrixTransform(svg.getScreenCTM().inverse());
  if (point.x < -0.08 || point.y < -0.08 || point.x > block().WidthInches + 0.08 || point.y > block().HeightInches + 0.08) return null;
  const grid = Number($('grid').value);
  return {
    X: Math.max(0, Math.min(block().WidthInches, $('snap').checked ? Math.round(point.x / grid) * grid : point.x)),
    Y: Math.max(0, Math.min(block().HeightInches, $('snap').checked ? Math.round(point.y / grid) * grid : point.y)),
  };
}
function distanceToLine(point, line) {
  const dx = line.End.X - line.Start.X, dy = line.End.Y - line.Start.Y;
  const t = Math.max(0, Math.min(1, ((point.X - line.Start.X) * dx + (point.Y - line.Start.Y) * dy) / (dx * dx + dy * dy || 1)));
  return Math.hypot(point.X - line.Start.X - t * dx, point.Y - line.Start.Y - t * dy);
}
$('canvas').addEventListener('pointerdown', event => {
  if (event.button !== 0) return;
  const point = canvasPoint(event);
  if (!point) return;
  $('canvas').focus();
  if (tool === 'select') {
    let nearest = -1, distance = block().WidthInches / $('canvas').getBoundingClientRect().width * 12;
    // Selecting uses the actual pointer instead of snapping to a neighboring grid point.
    const raw = new DOMPoint(event.clientX, event.clientY).matrixTransform($('canvas').getScreenCTM().inverse());
    block().Lines.forEach((line, i) => { const d = distanceToLine({ X: raw.x, Y: raw.y }, line); if (d < distance) { distance = d; nearest = i; } });
    selected = nearest; render(); return;
  }
  if (!pending) { pending = point; cursor = point; render(); return; }
  if (Math.hypot(pending.X - point.X, pending.Y - point.Y) < 0.001) { notify('Choose a different point to give this seam a length.'); return; }
  if (block().Lines.length >= 5000) { notify('This block has reached the 5,000 seam limit.'); return; }
  checkpoint(); block().Lines.push({ Id: crypto.randomUUID(), Start: pending, End: point }); pending = null; cursor = null; changed();
});
$('canvas').addEventListener('pointermove', event => { if (pending) { cursor = canvasPoint(event); renderCanvas(); } });
$('canvas').addEventListener('pointerleave', () => { cursor = null; renderCanvas(); });
$('draw-tool').onclick = () => chooseTool('draw');
$('select-tool').onclick = () => chooseTool('select');
$('undo').onclick = () => { if (!undo.length) return; redo.push(structuredClone(block())); project.Blocks[blockIndex] = undo.pop(); pending = null; selected = -1; changed(); };
$('redo').onclick = () => { if (!redo.length) return; undo.push(structuredClone(block())); project.Blocks[blockIndex] = redo.pop(); pending = null; selected = -1; changed(); };
$('delete-line').onclick = () => { if (selected < 0) return; checkpoint(); block().Lines.splice(selected, 1); selected = -1; changed(); };
$('block-name').onchange = () => { checkpoint(); block().Name = $('block-name').value.trim() || 'Untitled block'; changed(); };
$('dimensions-form').onsubmit = event => {
  event.preventDefault();
  const width = Number($('width').value), height = Number($('height').value);
  if (![width, height].every(value => Number.isFinite(value) && value >= 1 && value <= 60)) { notify('Choose dimensions between 1 and 60 inches.'); return; }
  checkpoint(); const b = block();
  b.Lines.forEach(line => [line.Start, line.End].forEach(point => { point.X = Math.min(width, point.X / b.WidthInches * width); point.Y = Math.min(height, point.Y / b.HeightInches * height); }));
  b.WidthInches = width; b.HeightInches = height; pending = null; changed(); notify('Block and seam lines resized.');
};
$('grid').onchange = () => { checkpoint(); block().GridSizeInches = Number($('grid').value); pending = null; changed(); };
$('paper').onchange = render;
$('block-select').onchange = () => { blockIndex = Number($('block-select').value); undo = []; redo = []; pending = null; selected = -1; render(); };
$('new-block').onclick = () => {
  if (project.Blocks.length >= 100) { notify('A project can contain at most 100 blocks.'); return; }
  project.Blocks.push({ Id: crypto.randomUUID(), Name: `Block ${project.Blocks.length + 1}`, WidthInches: 12, HeightInches: 12, GridSizeInches: 0.25, Lines: [], SourceImageOpacity: 0.35 });
  blockIndex = project.Blocks.length - 1; undo = []; redo = []; pending = null; selected = -1; changed();
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
    project = incoming; blockIndex = 0; undo = []; redo = []; pending = null; selected = -1; changed(); notify('Project opened.');
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
    const bytes = await createPatternPdf(block(), $('paper').value);
    download(bytes, 'application/pdf', `${filename(block().Name)}-FPP-${$('paper').value}.pdf`);
    notify('PDF downloaded. Print at Actual size / 100% and measure the 1-inch square.');
  } catch (error) { notify(`Could not export: ${error.message}`); }
  finally { button.disabled = false; }
};
$('load-sample').onclick = () => {
  if (project.Blocks.length >= 100) { notify('A project can contain at most 100 blocks.'); return; }
  project.Blocks.push(demoProject().Blocks[0]); blockIndex = project.Blocks.length - 1; undo = []; redo = []; pending = null; selected = -1; changed(); notify('Sample added as a new block.');
};
document.addEventListener('keydown', event => {
  if (event.target.closest('input, select, textarea')) return;
  if (event.key === 'Escape') { pending = null; cursor = null; selected = -1; render(); }
  if (event.key === 'Delete' || event.key === 'Backspace') { if (selected >= 0) { event.preventDefault(); $('delete-line').click(); } }
  if (event.ctrlKey || event.metaKey) {
    if (event.key.toLowerCase() === 'z') { event.preventDefault(); $(event.shiftKey ? 'redo' : 'undo').click(); }
    if (event.key.toLowerCase() === 'y') { event.preventDefault(); $('redo').click(); }
    if (event.key.toLowerCase() === 's') { event.preventDefault(); $('save-project').click(); }
  }
});
render();
if (restoreMessage) notify(restoreMessage);
