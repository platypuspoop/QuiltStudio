import { adjacentPieces, alphaLabel, analyzePieces, setPieceSetting } from './pattern.js';
let popup;
export function closeLabelMenu() { popup?.remove(); popup = null; }
document.addEventListener('pointerdown', e => { if (popup && !popup.contains(e.target)) closeLabelMenu(); });
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeLabelMenu(); });

export function openLabelMenu(block, key, x, y, commit) {
  closeLabelMenu();
  const analysis = analyzePieces(block), face = analysis.faces.find(f => f.key === key);
  if (!face) return;
  popup = document.createElement('div'); popup.className = 'label-context-menu'; popup.setAttribute('role', 'dialog'); popup.setAttribute('aria-label', `Relabel piece ${face.label}`);
  document.body.append(popup);
  const letterOf = f => f.section;
  const letters = [...new Set([...Array.from({ length: analysis.faces.length }, (_, i) => alphaLabel(i)), ...analysis.faces.map(letterOf)])];
  const button = (text, action, parent = popup) => { const b = document.createElement('button'); b.type = 'button'; b.textContent = text; b.onclick = action; parent.append(b); return b; };
  const position = () => { if (!popup) return; const rect = popup.getBoundingClientRect(); popup.style.left = `${Math.max(12, Math.min(x, innerWidth - rect.width - 12))}px`; popup.style.top = `${Math.max(12, Math.min(y, innerHeight - rect.height - 12))}px`; };
  const page = title => {
    popup.replaceChildren(); const heading = document.createElement('strong'); heading.textContent = `${face.label} · ${title}`; popup.append(heading);
    button('Back', root); position();
  };
  const apply = label => {
    try { commit(setPieceSetting(block, key, { Label: label })); closeLabelMenu(); }
    catch (error) { const status = document.createElement('p'); status.setAttribute('role', 'status'); status.textContent = error.message; popup?.append(status); }
  };
  const numbers = section => {
    page(section === face.section ? 'Renumber in this section' : `Join adjoining section ${section}`);
    const members = analysis.faces.filter(f => f.section === section);
    const max = Math.max(members.length + 1, ...members.map(f => Number(f.label.match(/\d+$/)[0])));
    const choices = document.createElement('div'); choices.className = 'label-choices'; popup.append(choices);
    for (let n = 1; n <= Math.min(9999, max); n++) {
      const label = `${section}${n}`; if (label === face.label) continue;
      const occupied = members.some(f => f.label === label);
      button(`${label}${occupied ? ' (swap)' : ''}`, () => apply(label), choices);
    }
    const help = document.createElement('p'); help.textContent = 'Choosing an occupied name swaps the two pieces. A free number moves this piece into the chosen section.'; popup.append(help); position();
  };
  const rename = () => {
    page('Rename block / section letter');
    const input = document.createElement('input'); input.type = 'search'; input.placeholder = 'Type a letter or prefix, e.g. AA'; input.setAttribute('aria-label', 'Find section letter'); popup.append(input);
    const choices = document.createElement('div'); choices.className = 'label-choices'; popup.append(choices);
    const list = items => { choices.replaceChildren(); items.forEach(letter => button(letter, () => apply(`${letter}${face.label.match(/\d+$/)[0]}`), choices)); position(); };
    const ranges = () => {
      choices.replaceChildren();
      for (let i = 0; i < letters.length; i += 26) {
        const group = letters.slice(i, i + 26);
        for (const part of [group.slice(0, 11), group.slice(11)]) if (part.length) button(part.length === 1 ? part[0] : `${part[0]}–${part.at(-1)}`, () => list(part), choices);
      }
      position();
    };
    input.oninput = () => { const prefix = input.value.trim().toUpperCase(); if (prefix) list(letters.filter(l => l.startsWith(prefix))); else ranges(); };
    input.onkeydown = e => { if (e.key === 'Enter') { const exact = input.value.trim().toUpperCase(); if (letters.includes(exact)) apply(`${exact}${face.label.match(/\d+$/)[0]}`); } };
    ranges(); input.focus();
  };
  function root() {
    popup.replaceChildren(); const title = document.createElement('strong'); title.textContent = `Relabel ${face.label}`; popup.append(title);
    button('1. Rename the block / section letter', rename);
    button(`2. Renumber within section ${face.section}`, () => numbers(face.section));
    button('3. Renumber into adjoining blocks', () => {
      page('Adjoining sections');
      const adjacent = [...new Set(adjacentPieces(analysis, key).map(letterOf))].filter(l => l !== face.section);
      if (!adjacent.length) { const p = document.createElement('p'); p.textContent = 'No adjoining pieces belong to a different section.'; popup.append(p); }
      adjacent.forEach(letter => button(`Join section ${letter}`, () => numbers(letter))); position();
    });
    const note = document.createElement('p'); note.textContent = 'Changes apply to this piece. Use the sidebar to rename a whole section.'; popup.append(note);
    button('Close', closeLabelMenu); position(); popup.querySelector('button').focus();
  }
  root();
}
