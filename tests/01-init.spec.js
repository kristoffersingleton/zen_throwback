import { test, expect } from '@playwright/test';
import { waitForReady, getDataAttr } from './helpers/zen.js';

test.describe('Engine initialisation', () => {

  test.beforeEach(async ({ page }) => {
    await page.goto('/tests/fixtures/engine');
    await waitForReady(page);
  });

  // ── Manifest loading ──────────────────────────────────────────────────────

  test('loads all themes from the manifest', async ({ page }) => {
    const count = await page.evaluate(() => window.zen.themes.length);
    expect(count).toBe(8);
  });

  test('manifest has correct version and default', async ({ page }) => {
    const { version, def } = await page.evaluate(() => ({
      version: window.zen.manifest.version,
      def:     window.zen.manifest.default,
    }));
    expect(version).toBe('1');
    expect(def).toBe('default');
  });

  test('auto-discovers manifest via <link rel="zen-manifest">', async ({ page }) => {
    // The fixture uses auto-discovery (no explicit manifest option).
    // If the manifest loaded, themes will be populated.
    const themes = await page.evaluate(() => window.zen.themes.map(t => t.id));
    expect(themes).toContain('default');
    expect(themes).toContain('terminal');
  });

  test('throws on missing manifest', async ({ page }) => {
    const errors = [];
    page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()); });

    await page.evaluate(async () => {
      const { default: Zen } = await import('/src/zen.js');
      const z = new Zen({ manifest: '/nonexistent.json', transitions: false });
      try { await z.init(); } catch (e) { console.error(e.message); }
    });

    await page.waitForFunction(() => true); // flush microtasks
    expect(errors.some(e => e.includes('Failed to fetch manifest'))).toBe(true);
  });

  // ── Data attributes ───────────────────────────────────────────────────────

  test('sets data-zen-theme on <html> after init', async ({ page }) => {
    const theme = await getDataAttr(page, 'data-zen-theme');
    expect(theme).toBe('default');
  });

  test('sets data-zen-tier to "token" for default theme', async ({ page }) => {
    const tier = await getDataAttr(page, 'data-zen-tier');
    expect(tier).toBe('token');
  });

  test('data-zen-tier is "layer" for a layer theme', async ({ page }) => {
    await page.evaluate(() => window.zen.apply('terminal'));
    await expect(page.locator('html')).toHaveAttribute('data-zen-tier', 'layer');
  });

  test('data-zen-tier is "generative" for the generative theme', async ({ page }) => {
    await page.evaluate(() => window.zen.apply('random-seed'));
    await expect(page.locator('html')).toHaveAttribute('data-zen-tier', 'generative');
  });

  test('data-zen-seed is set after applying generative theme', async ({ page }) => {
    await page.evaluate(() => window.zen.apply('random-seed'));
    const seed = await page.locator('html').getAttribute('data-zen-seed');
    expect(seed).toBeTruthy();
    expect(seed.length).toBeGreaterThan(0);
  });

  // ── Style injection ───────────────────────────────────────────────────────

  test('injects #zen-layer-order style element', async ({ page }) => {
    const content = await page.evaluate(() => document.querySelector('#zen-layer-order')?.textContent);
    expect(content).toBeTruthy();
    expect(content).toContain('@layer');
    expect(content).toContain('zen.theme');
  });

  test('#zen-layer-order is the first style element in <head>', async ({ page }) => {
    const firstStyleId = await page.evaluate(() => document.head.querySelector('style')?.id);
    expect(firstStyleId).toBe('zen-layer-order');
  });

  test('injects #zen-tokens style element', async ({ page }) => {
    const exists = await page.evaluate(() => !!document.querySelector('#zen-tokens'));
    expect(exists).toBe(true);
  });

});
