// Keep the existing controls and their event handlers, but expose one task at a time.
export function installWorkflow(onStep) {
  const names = ['Image & size', 'Guides', 'Draw & edit', 'Edit', 'Label', 'Color & layout', 'Layout', 'Print'];
  const steps = [0, 1, 2, 4, 5, 7];
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
  move(0, ['block-name', 'block-select', 'dimensions-form', 'import-image', 'image-controls']);
  const positioning = document.createElement('div'); positioning.id = 'image-positioning';
  positioning.innerHTML = `<label class="check-field"><input type="checkbox" id="image-center-guide"/>Show blue center cross</label><div class="field-row"><label class="field">Image X offset · in<input id="image-offset-x" type="number" step="0.01" min="-240" max="240"/></label><label class="field">Image Y offset · in<input id="image-offset-y" type="number" step="0.01" min="-240" max="240"/></label></div><label class="field">Nudge distance · in<input id="image-nudge" type="number" value="0.05" min="0.001" max="12" step="0.01"/></label><div class="nudge-buttons"><button id="image-left" class="button outlined">← Left</button><button id="image-up" class="button outlined">↑ Up</button><button id="image-down" class="button outlined">↓ Down</button><button id="image-right" class="button outlined">→ Right</button><button id="image-reset" class="button outlined">Reset position</button></div><p class="field-help">Offsets position your reference inside the block; the cross marks the block center. Move an off-center subject by eye. The image is never printed.</p>`;
  panes[0].append(positioning);
  const guides = document.createElement('div');
  guides.innerHTML = `<label class="field">Grid units<select id="grid-mode"><option value="subdivisions">Rows & columns</option><option value="inches">Inch spacing</option></select></label><div class="field-row"><label class="field">Columns<input id="grid-columns" type="number" min="2" max="1000" value="100"/></label><label class="field">Rows<input id="grid-rows" type="number" min="2" max="1000" value="100"/></label></div><label class="field">Spacing in inches<input id="grid-spacing" type="number" min="0.001" max="240" step="0.001" value="0.25"/></label><label class="check-field"><input id="show-grid" type="checkbox" checked/>Show grid</label>`;
  panes[1].append(guides); move(1, ['snap', 'symmetry-vertical', 'symmetry-horizontal']);
  const padding = document.createElement('label'); padding.className = 'field'; padding.innerHTML = 'Drawing space outside block · in<input id="draft-padding" type="number" min="0.5" max="24" step="0.5" value="2"/>'; panes[1].append(padding);
  move(2, ['drawing-shape', 'drawing-snap-mode', 'cross-lines']);
  $('drawing-shape').add(new Option('Full circle · drag from center', 'circle'));
  const flip = document.createElement('button'); flip.id = 'flip-curve'; flip.className = 'button outlined full'; flip.textContent = 'Flip arc direction'; panes[2].append(flip);
  const place = document.createElement('button'); place.id = 'place-curve'; place.className = 'button primary full'; place.textContent = 'Place shown curve'; panes[2].append(place);
  const tip = document.createElement('p'); tip.className = 'field-help'; tip.innerHTML = 'Half/quarter arcs: click start anywhere, aim the blue curve, flip its side if needed, then click the end to place it. Place shown curve also confirms the preview. Custom curves use a third bend-point click. The entire curve crosses existing seams. Circles: hold at center and drag. Straight lines cross seams when Continue through lines is on.<br><strong style="color:#005bff">Blue = seam / vertex</strong> · <strong style="color:#b94700">Orange = block edge</strong> · Esc cancels.'; panes[2].append(tip);
  const edit = document.createElement('p'); edit.className = 'field-help'; edit.textContent = 'Select a seam, then delete it with the trash button or Delete key. Right-click any seam to delete the whole line or curve. Undo restores it.'; panes[3].append(edit);
  const editHeading = document.createElement('h3'); editHeading.textContent = 'Edit lines & curves'; panes[2].append(editHeading);
  move(2, ['select-tool', 'delete-line', 'clear-drawing', 'undo', 'redo']);
  const deleteMode = document.createElement('label'); deleteMode.className = 'field'; deleteMode.innerHTML = '<span>Delete behavior</span><select id="delete-mode"><option value="segment">Segment between intersections</option><option value="stroke">Whole line / curve</option></select>'; panes[2].append(deleteMode);
  edit.textContent = 'Select or right-click a segment to remove only the portion between intersections. Switch Delete behavior to remove a whole stroke. Undo restores every deletion.'; panes[2].append(edit);
  panes[2].prepend($('draw-tool'));
  const label = document.createElement('button'); label.id = 'label-sections'; label.className = 'button primary full'; label.textContent = 'Label & number sections'; panes[4].append(label);
  move(4, ['piece-select', 'piece-name', 'rename-piece', 'rename-section', 'reset-labels']);
  const labelHelp = document.createElement('p'); labelHelp.className = 'field-help'; labelHelp.textContent = 'Finish drawing first, then generate section letters and sewing order. You can exchange piece numbers or move pieces to another letter. Seam allowance is calculated only around each final lettered shape.'; panes[4].append(labelHelp);
  move(5, ['fabric-color', 'color-tool']);
  settings.replaceChildren(...panes);
  const nav = document.createElement('nav'); nav.className = 'workflow-nav'; nav.setAttribute('aria-label', 'Design steps');
  nav.innerHTML = steps.map((i, number) => `<button type="button" data-step="${i}" id="step-${i}">${number + 1}. ${names[i]}</button>`).join('');
  document.querySelector('.workspace-top').before(nav);
  const footer = document.createElement('div'); footer.className = 'workflow-footer'; footer.innerHTML = '<button id="previous-step" class="button outlined">Previous step</button><button id="next-step" class="button primary">Next step</button>';
  document.querySelector('.howto').replaceWith(footer);
  const print = document.querySelector('.print-panel'); document.querySelector('.workspace').after(print);
  print.querySelector('.step-dot').textContent = '06';
  document.querySelector('.quilt-builder-copy .step-dot').textContent = '05';
  document.querySelector('.workspace').append(document.querySelector('.quilt-builder'));
  const borders = document.createElement('div'); borders.innerHTML = '<label class="field">Quilt border width · in<input id="quilt-border-width" type="number" min="0" max="24" step="0.25" value="0"/></label><label class="field">Border color<input id="quilt-border-color" type="color" value="#275b4b"/></label><p id="quilt-total-size" class="field-help"></p>'; document.querySelector('.quilt-controls').append(borders);
  const transforms = document.createElement('div'); transforms.className = 'block-transforms';
  transforms.innerHTML = '<p id="selected-block-info">Click a block in the preview to change just that block.</p><button id="flip-block-x" class="button outlined">Mirror left / right</button><button id="flip-block-y" class="button outlined">Flip top / bottom</button><button id="rotate-block" class="button outlined">Rotate 180°</button><button id="quarter-turn-block" class="button outlined">Rotate 90° (square blocks)</button><button id="reset-block-transform" class="button outlined">Reset selected block</button>';
  document.querySelector('.quilt-controls').append(transforms);
  let active = 0;
  const setStep = i => {
    active = i === 3 ? 2 : i === 6 ? 5 : steps.includes(i) ? i : 0;
    panes.forEach((pane, index) => { pane.hidden = index !== active; });
    document.querySelector('.workspace').hidden = active === 7;
    document.querySelector('.workspace').classList.toggle('color-layout', active === 5);
    document.querySelector('.quilt-builder').hidden = active !== 5;
    print.hidden = active !== 7;
    $('new-block').hidden = active !== 0;
    document.querySelector('.workspace-title h2').textContent = names[active];
    document.querySelector('.workspace-title .step-dot').textContent = String(steps.indexOf(active) + 1).padStart(2, '0');
    nav.querySelectorAll('button').forEach(button => { button.setAttribute('aria-current', Number(button.dataset.step) === active ? 'step' : 'false'); });
    $('previous-step').disabled = active === 0; $('next-step').disabled = active === 7;
    document.querySelector('.editor-toolbar').hidden = true;
    onStep(active);
  };
  nav.onclick = e => { if (e.target.dataset.step !== undefined) setStep(Number(e.target.dataset.step)); };
  $('previous-step').onclick = () => setStep(steps[steps.indexOf(active) - 1]); $('next-step').onclick = () => setStep(steps[steps.indexOf(active) + 1]);
  return setStep;
}
