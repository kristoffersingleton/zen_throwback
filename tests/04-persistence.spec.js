import { test, expect } from '@playwright/test';
import { waitForReady, gotoFixture } from './helpers/zen.js';

test.describe('Persistence', () => {

  test.beforeEach(async ({ page }) => {
    await gotoFixture(page);
  });

  // ── localStorage writes ───────────────────────────────────────────────────

  test('apply() writes theme id to localStorage', async ({ page }) => {
    await page.evaluate(() => window.zen.apply('terminal'));
    const stored = await page.evaluate(() => localStorage.getItem('zen:theme'));
    expect(stored).toBe('terminal');
  });

  test('apply() updates the ?zen= URL param', async ({ page }) => {
    await page.evaluate(() => window.zen.apply('brutalist'));
    const param = await page.evaluate(() => new URL(location.href).searchParams.get('zen'));
    expect(param).toBe('brutalist');
  });

  test('system-driven dark variant switch does NOT write to localStorage', async ({ page }) => {
    // Simulate OS going dark after init — should not overwrite storage
    await page.emulateMedia({ colorScheme: 'dark' });
    // Give the matchMedia change event time to fire
    await page.waitForTimeout(300);
    const stored = await page.evaluate(() => localStorage.getItem('zen:theme'));
    expect(stored).toBeNull();
  });

  test('system-driven dark variant switch does NOT update URL param', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'dark' });
    await page.waitForTimeout(300);
    const param = await page.evaluate(() => new URL(location.href).searchParams.get('zen'));
    expect(param).toBeNull();
  });

  // ── localStorage reads (persistence across load) ──────────────────────────

  test('stored preference is restored on page reload', async ({ page }) => {
    await page.evaluate(() => window.zen.apply('neon-noir'));
    await page.reload();
    await waitForReady(page);
    await expect(page.locator('html')).toHaveAttribute('data-zen-theme', 'neon-noir');
  });

  test('stored preference is shared across pages in the same context', async ({ page, context }) => {
    await page.evaluate(() => window.zen.apply('zen-garden'));
    const page2 = await context.newPage();
    await page2.goto('/tests/fixtures/engine');
    await waitForReady(page2);
    await expect(page2.locator('html')).toHaveAttribute('data-zen-theme', 'zen-garden');
    await page2.close();
  });

  // ── reset() ───────────────────────────────────────────────────────────────

  test('reset() removes localStorage entry', async ({ page }) => {
    await page.evaluate(() => window.zen.apply('terminal'));
    await page.evaluate(() => window.zen.reset());
    const stored = await page.evaluate(() => localStorage.getItem('zen:theme'));
    expect(stored).toBeNull();
  });

  test('reset() applies manifest default theme', async ({ page }) => {
    await page.evaluate(() => window.zen.apply('terminal'));
    await page.evaluate(() => window.zen.reset());
    await expect(page.locator('html')).toHaveAttribute('data-zen-theme', 'default');
  });

});
