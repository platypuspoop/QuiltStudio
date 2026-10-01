import { test, expect } from '@playwright/test';
import { PDFDocument } from 'pdf-lib';
import { readFile } from 'node:fs/promises';

test('draw, undo, redo, save, reload, and export an actual-size PDF', async ({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/');
  await expect(page.locator('#line-count')).toHaveText('5 seams');
  await expect(page.locator('#sheet-count')).toHaveText('4 sheets · 2 × 2');
  await page.getByRole('button', { name: 'Add a blank block' }).click();
  await page.locator('#width').fill('4');
  await page.locator('#height').fill('4');
  await page.getByRole('button', { name: 'Apply dimensions' }).click();
  await expect(page.locator('#sheet-count')).toHaveText('1 sheet · 1 × 1');
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
