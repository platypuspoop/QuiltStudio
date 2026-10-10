// Keep the existing controls and their event handlers, but expose one task at a time.
export function installWorkflow(onStep) {
  const names = ['Image & size', 'Guides', 'Draw', 'Edit', 'Label', 'Color', 'Layout', 'Print'];
  const $ = id => document.getElementById(id);
  const settings = document.querySelector('.settings');
  const panes = names.slice(0, 6).map((name, i) => {
    const pane = document.createElement('div'); pane.className = 'workflow-pane'; pane.dataset.step = i;
    const heading = document.createElement('h3'); heading.textContent = name; pane.append(heading); return pane;
  });
  // Keep moved controls connected so subsequent ID lookups remain valid.
  settings.append(...panes);
  const move = (step, ids) => ids.forEach(id => {
    const node = $(id); panes[step].append(node.closest('label.field, label.check-field') || node);
  });
  move(0, ['block-select', 'block-name', 'dimensions-form', 'import-image', 'image-controls']);
  const guides = document.createElement('div');
  guides.innerHTML = `<label class="field">Grid units<select id="grid-mode"><option value="subdivisions">Rows & columns</option><option value="inches">Inch spacing</option></select></label><div class="field-row"><label class="field">Columns<input id="grid-columns" type="number" min="2" max="1000" value="100"/></label><label class="field">Rows<input id="grid-rows" type="number" min="2" max="1000" value="100"/></label></div><label class="field">Spacing in inches<input id="grid-spacing" type="number" min="0.001" max="240" step="0.001" value="0.25"/></label><label class="check-field"><input id="show-grid" type="checkbox" checked/>Show grid</label>`;
  panes[1].append(guides); move(1, ['snap', 'symmetry-vertical', 'symmetry-horizontal']);
  move(2, ['drawing-shape', 'drawing-snap-mode', 'cross-lines']);
  $('drawing-shape').add(new Option('Full circle · drag from center', 'circle'));
  const flip = document.createElement('button'); flip.id = 'flip-curve'; flip.className = 'button outlined full'; flip.textContent = 'Flip arc direction'; panes[2].append(flip);
  const tip = document.createElement('p'); tip.className = 'field-help'; tip.innerHTML = 'Straight lines: start on an edge or seam and drag. Arcs: start anywhere, choose the end, then click to confirm the visible bend. Tangent tails reach the next boundary. Circles: hold at the center and drag to size.<br><strong style="color:#005bff">Blue = seam / vertex</strong> · <strong style="color:#b94700">Orange = block edge</strong> · Esc cancels.'; panes[2].append(tip);
  const edit = document.createElement('p'); edit.className = 'field-help'; edit.textContent = 'Select a seam, then delete it with the trash button or Delete key. Right-click any seam to delete the whole line or curve. Undo restores it.'; panes[3].append(edit);
  const label = document.createElement('button'); label.id = 'label-sections'; label.className = 'button primary full'; label.textContent = 'Label & number sections'; panes[4].append(label);
  move(4, ['piece-select', 'piece-name', 'rename-piece', 'rename-section', 'reset-labels']);
  const labelHelp = document.createElement('p'); labelHelp.className = 'field-help'; labelHelp.textContent = 'Finish drawing first, then generate section letters and sewing order. You can exchange piece numbers or move pieces to another letter. Seam allowance is calculated only around each final lettered shape.'; panes[4].append(labelHelp);
  move(5, ['fabric-color', 'color-tool']);
  settings.replaceChildren(...panes);
  const nav = document.createElement('nav'); nav.className = 'workflow-nav'; nav.setAttribute('aria-label', 'Design steps');
  nav.innerHTML = names.map((name, i) => `<button type="button" data-step="${i}" id="step-${i}">${i + 1}. ${name}</button>`).join('');
  document.querySelector('.workspace-top').before(nav);
  const footer = document.createElement('div'); footer.className = 'workflow-footer'; footer.innerHTML = '<button id="previous-step" class="button outlined">Previous step</button><button id="next-step" class="button primary">Next step</button>';
  document.querySelector('.howto').replaceWith(footer);
  const print = document.querySelector('.print-panel'); document.querySelector('.workspace').after(print);
  print.querySelector('.step-dot').textContent = '08';
  document.querySelector('.quilt-builder-copy .step-dot').textContent = '07';
  const transforms = document.createElement('div'); transforms.className = 'block-transforms';
  transforms.innerHTML = '<p id="selected-block-info">Click a block in the preview to change just that block.</p><button id="flip-block-x" class="button outlined">Mirror left / right</button><button id="flip-block-y" class="button outlined">Flip top / bottom</button><button id="rotate-block" class="button outlined">Rotate 180°</button><button id="quarter-turn-block" class="button outlined">Rotate 90° (square blocks)</button><button id="reset-block-transform" class="button outlined">Reset selected block</button>';
  document.querySelector('.quilt-controls').append(transforms);
  let active = 0;
  const setStep = i => {
    active = Math.max(0, Math.min(7, i));
    panes.forEach((pane, index) => { pane.hidden = index !== active; });
    document.querySelector('.workspace').hidden = active > 5;
    document.querySelector('.quilt-builder').hidden = active !== 6;
    print.hidden = active !== 7;
    $('new-block').hidden = active !== 0;
    document.querySelector('.workspace-title h2').textContent = names[active];
    document.querySelector('.workspace-title .step-dot').textContent = String(active + 1).padStart(2, '0');
    nav.querySelectorAll('button').forEach((button, index) => { button.setAttribute('aria-current', index === active ? 'step' : 'false'); });
    $('previous-step').disabled = active === 0; $('next-step').disabled = active === 7;
    document.querySelector('.editor-toolbar').hidden = ![2, 3].includes(active);
    onStep(active);
  };
  nav.onclick = e => { if (e.target.dataset.step !== undefined) setStep(Number(e.target.dataset.step)); };
  $('previous-step').onclick = () => setStep(active - 1); $('next-step').onclick = () => setStep(active + 1);
  return setStep;
}
