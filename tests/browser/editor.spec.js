import { test, expect } from '@playwright/test';
import { PDFDocument } from 'pdf-lib';
import { readFile } from 'node:fs/promises';

test('draw, undo, redo, save, reload, and export an actual-size PDF', async ({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/');
  await expect(page.locator('#line-count')).toHaveText('5 seams');
  await expect(page.locator('#sheet-count')).toHaveText('8 sheets · 2 sections');
  await page.getByRole('button', { name: 'Add a blank block' }).click();
  await page.locator('#width').fill('4');
  await page.locator('#height').fill('4');
  await page.getByRole('button', { name: 'Apply dimensions' }).click();
  await expect(page.locator('#sheet-count')).toHaveText('1 sheet · 1 × 1');
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
  await page.getByRole('button', { name: 'Download FPP pattern' }).scrollIntoViewIfNeeded();
  await expect(page.getByRole('button', { name: 'Download FPP pattern' })).toBeVisible();
});

const importBlock = async (page, block) => page.locator('#project-file').setInputFiles({ name: 'notes.quiltstudio', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify({ SchemaVersion: 1, Blocks: [{ Id: 'notes', Name: 'Notes test', WidthInches: 4, HeightInches: 4, Lines: [], ...block }] })) });
async function clickModel(page, x, y, options) {
  await page.locator('#canvas').scrollIntoViewIfNeeded();
  const p = await page.locator('#canvas').evaluate((svg, [x, y]) => { const p = new DOMPoint(x, y).matrixTransform(svg.getScreenCTM()); return { x: p.x, y: p.y }; }, [x, y]);
  await page.mouse.click(p.x, p.y, options);
}

test('paint, manually relabel, export separate sections with color codes, and restore settings', async ({ page }) => {
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto('/'); await importBlock(page, { Lines: [{ Id: 'h', Start: { X: 0, Y: 2 }, End: { X: 4, Y: 2 } }] });
  await page.locator('#fabric-color').fill('#ffff00');
  await page.locator('#color-tool').click(); await clickModel(page, 2, 1);
  await expect(page.locator('#canvas polygon[fill="#ffff00"]')).toHaveCount(1);
  expect(await page.locator('#quilt-preview polygon[fill="#ffff00"]').count()).toBeGreaterThan(1);
  await expect(page.locator('#color-key')).toContainText('1 · #FFFF00');
  await page.locator('#piece-name').fill('B1'); await page.locator('#rename-piece').click();
  await expect(page.locator('#print-section option')).toHaveCount(2);
  await expect(page.locator('#sheet-count')).toHaveText('2 sheets · 2 sections');
  const downloaded = page.waitForEvent('download'); await page.locator('#export-pdf').click();
  const pdf = await PDFDocument.load(await readFile(await (await downloaded).path()));
  expect(pdf.getPageCount()).toBe(3); // two foundations + fabric color key
  await page.reload(); await expect(page.locator('#piece-select option')).toContainText(['B1', 'A2']);
  await expect(page.locator('#canvas polygon[fill="#ffff00"]')).toHaveCount(1);
  await page.locator('#piece-name').fill('C1'); await page.locator('#rename-section').click();
  await expect(page.locator('#canvas .piece-label').filter({ hasText: 'C1' })).toHaveCount(1);
  expect(errors).toEqual([]);
});

test('cross lines, right-click delete, undo, and confirmed clear restore whole geometry', async ({ page }) => {
  await page.goto('/'); await importBlock(page, { Lines: [{ Id: 'v', Start: { X: 2, Y: 0 }, End: { X: 2, Y: 4 } }] });
  await page.locator('#cross-lines').check(); await clickModel(page, 0, 2); await clickModel(page, 3, 2);
  await expect(page.locator('#line-count')).toHaveText('4 seams');
  await clickModel(page, 1, 2, { button: 'right' });
  await expect(page.locator('#line-count')).toHaveText('2 seams');
  await page.locator('#undo').click(); await expect(page.locator('#line-count')).toHaveText('4 seams');
  page.once('dialog', d => d.dismiss()); await page.locator('#clear-drawing').click();
  await expect(page.locator('#line-count')).toHaveText('4 seams');
  page.once('dialog', d => d.accept()); await page.locator('#clear-drawing').click();
  await expect(page.locator('#line-count')).toHaveText('0 seams');
  await page.locator('#undo').click(); await expect(page.locator('#line-count')).toHaveText('4 seams');
});

test('drawing symmetry is atomic and each curve tool produces printable closed pieces', async ({ page }) => {
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto('/'); await importBlock(page, {});
  await page.locator('#symmetry-horizontal').check(); await clickModel(page, 0, 1); await clickModel(page, 3, 1);
  await expect(page.locator('#line-count')).toHaveText('2 seams');
  await page.locator('#undo').click(); await expect(page.locator('#line-count')).toHaveText('0 seams');
  for (const kind of ['curve', 'half', 'quarter']) {
    await importBlock(page, {}); await page.locator('#drawing-shape').selectOption(kind);
    await clickModel(page, 0, 0); await clickModel(page, 4, 0); await clickModel(page, 2, 1);
    await expect(page.locator('#piece-select option')).toHaveCount(2);
    await expect(page.locator('#export-pdf')).toBeEnabled();
    await clickModel(page, 2, kind === 'half' ? 2 : kind === 'quarter' ? Math.sqrt(8) - 2 : 1, { button: 'right' });
    await expect(page.locator('#line-count')).toHaveText('0 seams');
    await page.locator('#undo').click(); await expect(page.locator('#piece-select option')).toHaveCount(2);
  }
  expect(errors).toEqual([]);
});
