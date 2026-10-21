import { test, expect } from '@playwright/test';
import { PDFDocument } from 'pdf-lib';
import { readFile } from 'node:fs/promises';
test.beforeEach(async ({ page }) => {
  page.on('pageerror', error => console.error(`Browser runtime error: ${error.message}`));
});

test('draw, undo, redo, save, reload, and export an actual-size PDF', async ({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/');
  await expect(page.locator('#line-count')).toHaveText('5 seams');
  await expect(page.locator('#canvas .piece-label')).toHaveCount(0);
  await page.getByRole('button', { name: 'Add a blank block' }).click();
  await page.locator('#width').fill('4');
  await page.locator('#height').fill('4');
  await page.getByRole('button', { name: 'Apply dimensions' }).click();
  await page.locator('#step-1').click();
  await page.locator('#grid-mode').selectOption('inches');
  await page.locator('#grid-spacing').fill('0.25'); await page.locator('#grid-spacing').press('Tab');
  await page.locator('#step-2').click();
  await page.locator('#canvas').scrollIntoViewIfNeeded();
  const positions = await page.locator('#canvas').evaluate(svg => {
    const matrix = svg.getScreenCTM();
    return [new DOMPoint(0, 1), new DOMPoint(2.5, 1)].map(p => { const q = p.matrixTransform(matrix); return { x: q.x, y: q.y }; });
  });
  await page.mouse.click(positions[0].x, positions[0].y);
  await page.mouse.click(positions[1].x, positions[1].y);
  await expect(page.locator('#line-count')).toHaveText('1 seam');
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await expect(page.locator('#line-count')).toHaveText('0 seams');
  await page.getByRole('button', { name: 'Redo', exact: true }).click();
  await expect(page.locator('#line-count')).toHaveText('1 seam');
  const saved = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Save a copy' }).click();
  const projectDownload = await saved;
  const projectPath = await projectDownload.path();
  const project = JSON.parse(await readFile(projectPath, 'utf8'));
  const current = project.Blocks.at(-1);
  expect(current.WidthInches).toBe(4);
  expect(current.Lines[0].Start).toEqual({ X: 0, Y: 1 });
  expect(current.Lines[0].End).toEqual({ X: 4, Y: 1 });
  await page.reload();
  await page.locator('#block-select').selectOption('1');
  await expect(page.locator('#line-count')).toHaveText('1 seam');
  await page.locator('#step-4').click(); await page.locator('#label-sections').click();
  await page.locator('#step-7').click();
  const exported = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download FPP pattern' }).click();
  const pdfDownload = await exported;
  const pdf = await PDFDocument.load(await readFile(await pdfDownload.path()));
  expect(pdf.getPageCount()).toBe(1);
  expect(pdf.getPage(0).getSize()).toEqual({ width: 612, height: 792 });
  await page.locator('#paper').selectOption('a4');
  const a4Event = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download FPP pattern' }).click();
  const a4 = await PDFDocument.load(await readFile(await (await a4Event).path()));
  expect(a4.getPage(0).getWidth()).toBeCloseTo(595.27559, 4);
  expect(errors).toEqual([]);
});

test('open a Windows-format project, reject a bad file, and preserve existing work', async ({ page }) => {
  await page.goto('/');
  const project = { SchemaVersion: 1, Name: 'Imported quilt', Blocks: [{ Id: 'b1', Name: 'Imported block', WidthInches: 6, HeightInches: 6, GridSizeInches: 0.25, Lines: [{ Start: { X: 0, Y: 0 }, End: { X: 6, Y: 6 } }] }], Layout: { WidthInches: 90, HeightInches: 108, Instances: [] } };
  await page.locator('#project-file').setInputFiles({ name: 'imported.quiltstudio', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(project)) });
  await expect(page.locator('#block-name')).toHaveValue('Imported block');
  await expect(page.locator('#line-count')).toHaveText('1 seam');
  await page.locator('#project-file').setInputFiles({ name: 'bad.quiltstudio', mimeType: 'application/json', buffer: Buffer.from('not json') });
  await expect(page.getByRole('status')).toContainText('not a valid');
  await expect(page.locator('#block-name')).toHaveValue('Imported block');
});

test('mobile layout remains usable with no horizontal overflow', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.locator('#step-4').click(); await page.locator('#label-sections').click();
  await page.locator('#step-7').click();
  await page.getByRole('button', { name: 'Download FPP pattern' }).scrollIntoViewIfNeeded();
  await expect(page.getByRole('button', { name: 'Download FPP pattern' })).toBeVisible();
});

const importBlock = async (page, block) => page.locator('#project-file').setInputFiles({ name: 'notes.quiltstudio', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify({ SchemaVersion: 1, Blocks: [{ Id: 'notes', Name: 'Notes test', WidthInches: 4, HeightInches: 4, Lines: [], ...block }] })) });
async function modelPosition(page, x, y) {
  await page.locator('#canvas').scrollIntoViewIfNeeded();
  return page.locator('#canvas').evaluate((svg, [x, y]) => { const p = new DOMPoint(x, y).matrixTransform(svg.getScreenCTM()); return { x: p.x, y: p.y }; }, [x, y]);
}
async function clickModel(page, x, y, options) {
  await page.locator('#canvas').scrollIntoViewIfNeeded();
  const p = await page.locator('#canvas').evaluate((svg, [x, y]) => { const p = new DOMPoint(x, y).matrixTransform(svg.getScreenCTM()); return { x: p.x, y: p.y }; }, [x, y]);
  await page.mouse.click(p.x, p.y, options);
}

test('paint, manually relabel, export separate sections with color codes, and restore settings', async ({ page }) => {
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto('/'); await importBlock(page, { Lines: [{ Id: 'h', Start: { X: 0, Y: 2 }, End: { X: 4, Y: 2 } }] });
  await page.locator('#step-5').click();
  await page.locator('#fabric-color').fill('#ffff00');
  await page.locator('#color-tool').click(); await clickModel(page, 2, 1);
  await expect(page.locator('#canvas path[fill="#ffff00"]')).toHaveCount(1);
  expect(await page.locator('#quilt-preview path[fill="#ffff00"]').count()).toBeGreaterThan(1);
  await expect(page.locator('#color-key')).toContainText('1 · #FFFF00');
  await page.locator('#step-4').click(); await page.locator('#label-sections').click();
  await page.locator('#piece-name').fill('B1'); await page.locator('#rename-piece').click();
  await expect(page.locator('#print-section option')).toHaveCount(2);
  await expect(page.locator('#sheet-count')).toHaveText('2 sheets · 2 sections');
  await page.locator('#step-7').click();
  const downloaded = page.waitForEvent('download'); await page.locator('#export-pdf').click();
  const pdf = await PDFDocument.load(await readFile(await (await downloaded).path()));
  expect(pdf.getPageCount()).toBe(3); // two foundations + fabric color key
  await page.reload(); await expect(page.locator('#piece-select option')).toContainText(['B1', 'A2']);
  await expect(page.locator('#canvas path[fill="#ffff00"]')).toHaveCount(1);
  await page.locator('#step-4').click();
  await page.locator('#piece-name').fill('C1'); await page.locator('#rename-section').click();
  await expect(page.locator('#canvas .piece-label').filter({ hasText: 'C1' })).toHaveCount(1);
  expect(errors).toEqual([]);
});

test('cross lines, right-click delete, undo, and confirmed clear restore whole geometry', async ({ page }) => {
  await page.goto('/'); await importBlock(page, { Lines: [{ Id: 'v', Start: { X: 2, Y: 0 }, End: { X: 2, Y: 4 } }] });
  await page.locator('#step-2').click();
  await page.locator('#cross-lines').check(); await clickModel(page, 0, 2); await clickModel(page, 3, 2);
  await expect(page.locator('#line-count')).toHaveText('2 seams');
  await page.locator('#delete-mode').selectOption('stroke');
  await clickModel(page, 1, 2, { button: 'right' });
  await expect(page.locator('#line-count')).toHaveText('1 seam');
  await page.locator('#undo').click(); await expect(page.locator('#line-count')).toHaveText('2 seams');
  page.once('dialog', d => d.dismiss()); await page.locator('#clear-drawing').click();
  await expect(page.locator('#line-count')).toHaveText('2 seams');
  page.once('dialog', d => d.accept()); await page.locator('#clear-drawing').click();
  await expect(page.locator('#line-count')).toHaveText('0 seams');
  await page.locator('#undo').click(); await expect(page.locator('#line-count')).toHaveText('2 seams');
});

test('drawing symmetry is atomic and each curve tool produces printable closed pieces', async ({ page }) => {
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto('/'); await importBlock(page, {});
  await page.locator('#step-1').click(); await page.locator('#symmetry-horizontal').check();
  await page.locator('#snap').uncheck();
  await page.locator('#step-2').click(); await clickModel(page, 0, 1); await clickModel(page, 3, 1);
  await expect(page.locator('#line-count')).toHaveText('2 seams');
  await page.locator('#undo').click(); await expect(page.locator('#line-count')).toHaveText('0 seams');
  for (const kind of ['curve', 'half', 'quarter']) {
    await importBlock(page, {}); await page.locator('#step-2').click(); await page.locator('#drawing-shape').selectOption(kind);
    await clickModel(page, 0, 0); await clickModel(page, 4, 0); await clickModel(page, 2, 1);
    await expect(page.locator('#piece-select option')).toHaveCount(2);
    await expect(page.locator('#export-pdf')).toBeDisabled();
    await page.locator('#step-4').click(); await page.locator('#label-sections').click();
    await expect(page.locator('#export-pdf')).toBeEnabled();
    await page.locator('#step-2').click();
    await clickModel(page, 2, kind === 'half' ? 2 : kind === 'quarter' ? Math.sqrt(8) - 2 : 1, { button: 'right' });
    await expect(page.locator('#line-count')).toHaveText('0 seams');
    await page.locator('#undo').click(); await expect(page.locator('#piece-select option')).toHaveCount(2);
  }
  expect(errors).toEqual([]);
});

test('fine grid controls, high contrast anchors, and curved preview before placing arcs', async ({ page }) => {
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto('/'); await importBlock(page, {});
  await page.locator('#step-1').click();
  await expect(page.locator('#grid-columns')).toHaveValue('100');
  await page.locator('#grid-columns').fill('200'); await page.locator('#grid-columns').press('Tab');
  await page.locator('#grid-rows').fill('50'); await page.locator('#grid-rows').press('Tab');
  await page.locator('#snap').uncheck();
  await page.locator('#step-2').click();
  const edge = await modelPosition(page, 0, 1); await page.mouse.move(edge.x, edge.y);
  await expect(page.locator('.anchor-cue.edge')).toHaveCSS('stroke', 'rgb(255, 106, 0)');
  for (const kind of ['quarter', 'half']) {
    await page.locator('#drawing-shape').selectOption(kind);
    await clickModel(page, 1, 1);
    const end = await modelPosition(page, 3, 1); await page.mouse.move(end.x, end.y);
    const first = await page.locator('.arc-preview').getAttribute('points');
    expect(first.split(' ').length).toBeGreaterThan(10);
    await expect(page.locator('.concavity-arrow')).toHaveCount(1);
    await page.locator('#flip-curve').click();
    expect(await page.locator('.arc-preview').getAttribute('points')).not.toBe(first);
    await page.keyboard.press('Escape');
  }
  expect(errors).toEqual([]);
});

test('center-drag circles resize visibly, label only on request, and retain colors on layout', async ({ page }) => {
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto('/'); await importBlock(page, {}); await page.locator('#step-2').click();
  await page.locator('#drawing-shape').selectOption('circle');
  const center = await modelPosition(page, 2, 2), small = await modelPosition(page, 2.5, 2), big = await modelPosition(page, 3, 2);
  await page.mouse.move(center.x, center.y); await page.mouse.down();
  await page.mouse.move(small.x, small.y);
  const first = await page.locator('.arc-preview').getAttribute('points');
  await page.mouse.move(big.x, big.y);
  expect(await page.locator('.arc-preview').getAttribute('points')).not.toBe(first);
  await page.mouse.up();
  await expect(page.locator('#piece-select option')).toHaveCount(2);
  await expect(page.locator('#canvas .piece-label')).toHaveCount(0);
  await expect(page.locator('#export-pdf')).toBeDisabled();
  await page.locator('#step-4').click(); await page.locator('#label-sections').click();
  await expect(page.locator('#canvas .piece-label')).toHaveCount(2);
  await page.locator('#step-5').click(); await page.locator('#fabric-color').fill('#ffff00'); await clickModel(page, 2, 2);
  await expect(page.locator('#canvas path[fill="#ffff00"]')).toHaveCount(1);
  await page.locator('#step-5').click();
  await page.locator('#quilt-preview [data-instance="notes:0:0"]').click();
  await page.locator('#flip-block-y').click(); await page.locator('#quarter-turn-block').click();
  const layout = await page.evaluate(() => JSON.parse(localStorage.getItem('quiltstudio-project')).Layout);
  expect(layout.BlockTransforms['notes:0:0']).toMatchObject({ mirrorY: true, rotation: 90 });
  expect(layout.BlockTransforms['notes:0:1']).toBeUndefined();
  await page.locator('#step-7').click(); await expect(page.locator('#export-pdf')).toBeEnabled();
  const download = page.waitForEvent('download'); await page.locator('#export-pdf').click();
  const pdf = await PDFDocument.load(await readFile(await (await download).path())); expect(pdf.getPageCount()).toBe(2);
  expect(errors).toEqual([]);
});

test('free quarter arc starts inside a piece and adds tangent continuations', async ({ page }) => {
  await page.goto('/'); await importBlock(page, {}); await page.locator('#step-1').click(); await page.locator('#snap').uncheck();
  await page.locator('#step-2').click(); await page.locator('#drawing-shape').selectOption('quarter');
  await clickModel(page, 1, 1); await clickModel(page, 3, 1); await clickModel(page, 2, 2);
  await expect(page.locator('#piece-select option')).toHaveCount(2);
  const lines = await page.evaluate(() => JSON.parse(localStorage.getItem('quiltstudio-project')).Blocks[0].Lines);
  const onBorder = p => [p.X, p.Y, 4 - p.X, 4 - p.Y].some(n => Math.abs(n) < 1e-6);
  expect(onBorder(lines[0].Start)).toBe(true); expect(onBorder(lines.at(-1).End)).toBe(true);
  expect(Math.hypot(lines[0].End.X - 1, lines[0].End.Y - 1)).toBeLessThan(.02);
  await page.locator('#step-4').click(); await page.locator('#label-sections').click();
  await expect(page.locator('#export-pdf')).toBeEnabled();
});

test('image controls reorder fields, nudge a reference, show center and save its position', async ({ page }) => {
  await page.goto('/'); await importBlock(page, { SourceImageBase64: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jEuoAAAAASUVORK5CYII=' });
  expect(await page.evaluate(() => !!(document.getElementById('block-name').compareDocumentPosition(document.getElementById('block-select')) & Node.DOCUMENT_POSITION_FOLLOWING))).toBe(true);
  await page.locator('#image-center-guide').check(); await expect(page.locator('.image-center-cross')).toHaveCount(1);
  await page.locator('#image-left').click(); await expect(page.locator('#canvas image')).toHaveAttribute('x', '-0.05');
  await page.locator('#image-nudge').fill('0.125'); await page.locator('#image-up').click(); await page.locator('#image-up').click();
  await expect(page.locator('#canvas image')).toHaveAttribute('y', '-0.25');
  await page.locator('#image-offset-x').fill('1.5'); await page.locator('#image-offset-x').press('Tab');
  await page.reload(); await expect(page.locator('#image-offset-x')).toHaveValue('1.5'); await expect(page.locator('#image-offset-y')).toHaveValue('-0.25');
  await page.locator('#image-reset').click(); await expect(page.locator('#canvas image')).toHaveAttribute('x', '0');
});

test('outside arc places the whole preview with one seam; draw and edit share a screen', async ({ page }) => {
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto('/'); await importBlock(page, {}); await page.locator('#step-1').click(); await page.locator('#snap').uncheck();
  await page.locator('#step-2').click();
  await expect(page.locator('#drawing-shape')).toBeVisible(); await expect(page.locator('#select-tool')).toBeVisible(); await expect(page.locator('#delete-mode')).toBeVisible();
  await page.locator('#drawing-shape').selectOption('half'); await clickModel(page, 0, -.5);
  const end = await modelPosition(page, 0, 4.5); await page.mouse.move(end.x, end.y); await page.locator('#flip-curve').click();
  const shown = (await page.locator('.arc-preview').getAttribute('points')).split(' ').map(p => p.split(',').map(Number));
  await clickModel(page, 0, 4.5);
  await expect(page.locator('#line-count')).toHaveText('1 seam'); await expect(page.locator('#piece-select option')).toHaveCount(2);
  const lines = await page.evaluate(() => JSON.parse(localStorage.getItem('quiltstudio-project')).Blocks[0].Lines);
  expect(lines[0].Start.Y).toBeCloseTo(-.5); expect(lines.at(-1).End.Y).toBeCloseTo(4.5);
  for (const p of shown) expect(lines.some(l => Math.hypot(l.Start.X - p[0], l.Start.Y - p[1]) < 1e-5 || Math.hypot(l.End.X - p[0], l.End.Y - p[1]) < 1e-5)).toBe(true);
  await page.locator('#step-4').click(); await page.locator('#label-sections').click(); await expect(page.locator('#export-pdf')).toBeEnabled();
  expect(errors).toEqual([]);
});

test('arc crosses existing seams and deleting its left segment retains its right half', async ({ page }) => {
  await page.goto('/'); await importBlock(page, { Lines: [{ Id: 'v', Start: { X: 2, Y: 0 }, End: { X: 2, Y: 4 } }] });
  await page.locator('#step-1').click(); await page.locator('#snap').uncheck(); await page.locator('#step-2').click();
  await page.locator('#drawing-shape').selectOption('half'); await clickModel(page, 0, 1);
  const end = await modelPosition(page, 4, 1); await page.mouse.move(end.x, end.y);
  await page.locator('#place-curve').click(); await expect(page.locator('#line-count')).toHaveText('2 seams');
  const before = await page.evaluate(() => JSON.parse(localStorage.getItem('quiltstudio-project')).Blocks[0].Lines);
  expect(before.some(l => l.Curve && l.Start.X > 3)).toBe(true);
  await clickModel(page, 2 - Math.sqrt(2), 1 + Math.sqrt(2), { button: 'right' });
  const after = await page.evaluate(() => JSON.parse(localStorage.getItem('quiltstudio-project')).Blocks[0].Lines);
  expect(after.some(l => l.Curve && l.Start.X < 2 - 1e-5)).toBe(false); expect(after.some(l => l.Curve && l.Start.X > 3)).toBe(true);
  await page.locator('#undo').click(); expect(await page.evaluate(() => JSON.parse(localStorage.getItem('quiltstudio-project')).Blocks[0].Lines.length)).toBe(before.length);
});

test('color and quilt preview are adjacent, borders use inch widths and markers stay small', async ({ page }) => {
  await page.goto('/'); await importBlock(page, {});
  await page.locator('#step-5').click(); await expect(page.locator('#canvas')).toBeVisible(); await expect(page.locator('#quilt-preview')).toBeVisible();
  const canvasBounds = await page.locator('#canvas').boundingBox(), layoutBounds = await page.locator('#quilt-preview').boundingBox();
  expect(canvasBounds.x + canvasBounds.width).toBeLessThan(layoutBounds.x);
  await page.locator('#fabric-color').fill('#ffff00'); await clickModel(page, 2, 2);
  expect(await page.locator('#quilt-preview path[fill="#ffff00"]').count()).toBeGreaterThan(1);
  await page.locator('#quilt-border-width').fill('2'); await page.locator('#quilt-border-width').press('Tab');
  await page.locator('#quilt-border-color').fill('#ff00ff'); await page.locator('#quilt-border-color').dispatchEvent('change');
  await expect(page.locator('.quilt-border')).toHaveAttribute('fill', '#ff00ff'); await expect(page.locator('#quilt-total-size')).toContainText('94″ × 112″');
  await page.reload(); await page.locator('#step-5').click(); await expect(page.locator('#quilt-border-width')).toHaveValue('2');
  await page.locator('#step-2').click(); const p = await modelPosition(page, 0, 1); await page.mouse.move(p.x, p.y);
  expect(await page.locator('.anchor-cue').evaluate(el => el.getBoundingClientRect().width)).toBeLessThan(10);
  await page.locator('#canvas').evaluate(svg => { svg.style.width = '2000px'; });
  const zoomed = await modelPosition(page, 0, 1); await page.mouse.move(zoomed.x, zoomed.y);
  await expect(page.locator('.anchor-cue')).toHaveCount(1);
  const radius = await page.locator('.anchor-cue').evaluate(el => el.getBoundingClientRect().width);
  expect(radius).toBeLessThan(10);
});

test('nudge buttons form a directional pad and the center cross defaults to thin blue', async ({ page }) => {
  await page.goto('/'); await importBlock(page, {});
  const box = async id => page.locator(id).boundingBox();
  for (const viewport of [{ width: 1440, height: 1100 }, { width: 390, height: 844 }]) {
    await page.setViewportSize(viewport);
    const [left, up, right, down] = await Promise.all(['#image-left', '#image-up', '#image-right', '#image-down'].map(box));
    expect(left.x + left.width).toBeLessThan(up.x); expect(up.x + up.width).toBeLessThan(right.x);
    expect(up.y + up.height).toBeLessThan(left.y); expect(left.y + left.height).toBeLessThan(down.y);
    expect(left.y).toBeCloseTo(right.y); expect(up.x).toBeCloseTo(down.x);
  }
  await expect(page.locator('#image-center-guide')).toBeChecked();
  const cross = page.locator('.image-center-cross'); await expect(cross).toBeVisible();
  await expect(cross).toHaveCSS('stroke', 'rgb(0, 91, 255)'); await expect(cross).toHaveCSS('stroke-width', '0.75px');
  const center = await cross.evaluate(el => { const b = el.getBBox(); return { x: b.x + b.width / 2, y: b.y + b.height / 2 }; });
  expect(center.x).toBeCloseTo(2); expect(center.y).toBeCloseTo(2);
  await page.locator('#image-center-guide').uncheck(); await expect(cross).toHaveCount(0);
  await page.reload(); await expect(page.locator('#image-center-guide')).not.toBeChecked();
});

test('dense grid lines start on each selected row or column without jumping', async ({ page }) => {
  await page.goto('/'); await importBlock(page, {}); await page.locator('#step-2').click();
  for (const y of [.04, .08, .12, 1.96, 2, 2.04, 3.88, 3.92, 3.96]) {
    await clickModel(page, 0, y); await clickModel(page, 4, y);
    const last = await page.evaluate(() => JSON.parse(localStorage.getItem('quiltstudio-project')).Blocks[0].Lines.at(-1));
    expect(last.Start.X).toBeCloseTo(0, 8); expect(last.Start.Y).toBeCloseTo(y, 8);
    expect(last.End.X).toBeCloseTo(4, 8); expect(last.End.Y).toBeCloseTo(y, 8);
  }
  await page.locator('#cross-lines').check();
  for (const x of [.04, .08, 1.96, 2.04, 3.92, 3.96]) {
    await clickModel(page, x, 0); await clickModel(page, x, 4);
    const last = await page.evaluate(() => JSON.parse(localStorage.getItem('quiltstudio-project')).Blocks[0].Lines.at(-1));
    expect(last.Start.X).toBeCloseTo(x, 8); expect(last.End.X).toBeCloseTo(x, 8); expect(last.End.Y).toBeCloseTo(4, 8);
  }
});

test('border controls are last in the right panel below all block transformations', async ({ page }) => {
  await page.goto('/'); await page.locator('#step-5').click();
  const transforms = await page.locator('.block-transforms').boundingBox(), borders = await page.locator('.quilt-borders').boundingBox();
  expect(transforms.y + transforms.height).toBeLessThan(borders.y);
  expect(await page.locator('.quilt-controls').evaluate(el => el.lastElementChild.classList.contains('quilt-borders'))).toBe(true);
});

const fourCells = [
  { Id: 'v', BoundaryType: 'section', Start: { X: 2, Y: 0 }, End: { X: 2, Y: 4 } },
  { Id: 'h', BoundaryType: 'section', Start: { X: 0, Y: 2 }, End: { X: 4, Y: 2 } },
];

test('crossing can be enabled after choosing the origin without losing the line', async ({ page }) => {
  await page.goto('/'); await importBlock(page, { Lines: [
    { Id: 'v1', Start: { X: 1, Y: 0 }, End: { X: 1, Y: 4 } },
    { Id: 'v2', Start: { X: 3, Y: 0 }, End: { X: 3, Y: 4 } },
  ] }); await page.locator('#step-2').click();
  await clickModel(page, 0, 2); await page.locator('#cross-lines').check();
  await expect(page.locator('.pending-point')).toHaveCount(1);
  const end = await modelPosition(page, 4, 2); await page.mouse.move(end.x, end.y);
  await expect(page.locator('.pending-line')).toHaveAttribute('x2', '4'); await clickModel(page, 4, 2);
  const crossing = await page.evaluate(() => JSON.parse(localStorage.getItem('quiltstudio-project')).Blocks[0].Lines.filter(l => l.Curve === null));
  expect(crossing).toHaveLength(3); expect(crossing.at(-1).End.X).toBe(4);
  await page.locator('#cross-lines').uncheck(); await clickModel(page, 0, 1); await clickModel(page, 4, 1);
  const last = await page.evaluate(() => JSON.parse(localStorage.getItem('quiltstudio-project')).Blocks[0].Lines.at(-1)); expect(last.End.X).toBe(1);
});

test('grid labeling reads left to right and right-click letter changes swap occupied names', async ({ page }) => {
  await page.goto('/'); await importBlock(page, { Lines: fourCells }); await page.locator('#step-4').click(); await page.locator('#label-sections').click();
  const labels = await page.locator('#canvas .piece-label').evaluateAll(nodes => nodes.map(n => ({ label: n.textContent, x: Number(n.getAttribute('x')), y: Number(n.getAttribute('y')) })));
  expect(labels.find(l => l.x === 1 && l.y === 1).label).toBe('A1'); expect(labels.find(l => l.x === 3 && l.y === 1).label).toBe('B1');
  expect(labels.find(l => l.x === 1 && l.y === 3).label).toBe('C1'); expect(labels.find(l => l.x === 3 && l.y === 3).label).toBe('D1');
  await clickModel(page, 1, 1, { button: 'right' }); await expect(page.getByRole('dialog')).toBeVisible();
  await page.getByRole('button', { name: '1. Rename the block / section letter', exact: true }).click();
  await page.getByRole('button', { name: 'A–D', exact: true }).click(); await page.getByRole('button', { name: 'D', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0); await expect(page.locator('#piece-name')).toHaveValue('D1');
  await page.reload(); await page.locator('#step-4').click(); expect((await page.locator('#piece-select option').allTextContents()).sort()).toEqual(['A1', 'B1', 'C1', 'D1']);
});

test('right-click numbering offers same-letter swaps and adjoining sections only', async ({ page }) => {
  await page.goto('/'); await importBlock(page, { Lines: [{ Id: 'h', Start: { X: 0, Y: 2 }, End: { X: 4, Y: 2 } }] });
  await page.locator('#step-4').click(); await page.locator('#label-sections').click(); await clickModel(page, 1, 1, { button: 'right' });
  await page.getByRole('button', { name: '2. Renumber within section A', exact: true }).click();
  await page.getByRole('button', { name: 'A2 (swap)', exact: true }).click(); await expect(page.locator('#piece-name')).toHaveValue('A2');
  await importBlock(page, { Lines: fourCells }); await page.locator('#label-sections').click(); await clickModel(page, 1, 1, { button: 'right' });
  await page.getByRole('button', { name: '3. Renumber into adjoining blocks', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Join section D', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Join section B', exact: true }).click(); await page.getByRole('button', { name: 'B2', exact: true }).click();
  await expect(page.locator('#piece-name')).toHaveValue('B2'); await expect(page.locator('#export-pdf')).toBeEnabled();
});

test('letter picker searches directly past Z and closes when switching steps', async ({ page }) => {
  const lines = [];
  for (let i = 1; i < 6; i++) lines.push({ Id: `v${i}`, BoundaryType: 'section', Start: { X: i * 4 / 6, Y: 0 }, End: { X: i * 4 / 6, Y: 4 } });
  for (let i = 1; i < 5; i++) lines.push({ Id: `h${i}`, BoundaryType: 'section', Start: { X: 0, Y: i * 4 / 5 }, End: { X: 4, Y: i * 4 / 5 } });
  await page.goto('/'); await importBlock(page, { Lines: lines }); await page.locator('#step-4').click(); await page.locator('#label-sections').click();
  await clickModel(page, .3, .3, { button: 'right' }); await page.getByRole('button', { name: '1. Rename the block / section letter', exact: true }).click();
  await page.getByRole('searchbox', { name: 'Find section letter' }).fill('AA'); await page.getByRole('searchbox', { name: 'Find section letter' }).press('Enter');
  await expect(page.locator('#piece-name')).toHaveValue('AA1');
  await clickModel(page, .3, .3, { button: 'right' }); await page.locator('#step-2').click(); await expect(page.getByRole('dialog')).toHaveCount(0);
});
