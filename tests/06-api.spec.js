import { test, expect } from '@playwright/test';
import { waitForReady, gotoFixture } from './helpers/zen.js';

test.describe('API methods', () => {

  test.beforeEach(async ({ page }) => {
    await gotoFixture(page);
  });

  // ── apply() ───────────────────────────────────────────────────────────────

  test('apply() returns the theme object', async ({ page }) => {
    const theme = await page.evaluate(() => window.zen.apply('terminal'));
    expect(theme.id).toBe('terminal');
    expect(theme.name).toBe('Terminal');
  });

  test('apply() rejects unknown theme id with descriptive error', async ({ page }) => {
    const errMsg = await page.evaluate(async () => {
      try { await window.zen.apply('no-such-theme'); }
      catch (e) { return e.message; }
    });
    expect(errMsg).toContain('Unknown theme');
    expect(errMsg).toContain('no-such-theme');
  });

  test('apply() updates zen.active', async ({ page }) => {
    await page.evaluate(() => window.zen.apply('brutalist'));
    const active = await page.evaluate(() => window.zen.active?.id);
    expect(active).toBe('brutalist');
  });

  test('apply() the same theme twice does not error', async ({ page }) => {
    const errMsg = await page.evaluate(async () => {
      try {
        await window.zen.apply('terminal');
        await window.zen.apply('terminal');
        return null;
      } catch (e) { return e.message; }
    });
    expect(errMsg).toBeNull();
  });

  test('apply() the same theme twice does not duplicate style elements', async ({ page }) => {
    await page.evaluate(() => window.zen.apply('terminal'));
    await page.evaluate(() => window.zen.apply('terminal'));
    const count = await page.evaluate(() =>
      document.querySelectorAll('#zen-layer').length
    );
    expect(count).toBe(1);
  });

  // ── random() ──────────────────────────────────────────────────────────────

  test('random() returns a theme different from the active one', async ({ page }) => {
    const picked = await page.evaluate(() => window.zen.random().then(t => t.id));
    const active = await page.evaluate(() => window.zen.active?.id);
    // picked and active should be the same after random (random sets active)
    // Verify the theme before random (default) is NOT the result
    expect(active).not.toBe('default');
    expect(picked).toBe(active);
  });

  test('random() produces varied results over multiple calls', async ({ page }) => {
    const ids = await page.evaluate(async () => {
      const results = new Set();
      for (let i = 0; i < 15; i++) {
        const t = await window.zen.random();
        results.add(t.id);
      }
      return [...results];
    });
    expect(ids.length).toBeGreaterThanOrEqual(3);
  });

  // ── next() ────────────────────────────────────────────────────────────────

  test('next() advances to the next theme in manifest order', async ({ page }) => {
    // Manifest order: default(0), default-dark(1), terminal(2), ...
    const next = await page.evaluate(() => window.zen.next().then(t => t.id));
    expect(next).toBe('default-dark');
  });

  test('next() wraps around from last theme to first', async ({ page }) => {
    // Advance to last theme (random-seed, index 7) then call next()
    const themes = await page.evaluate(() => window.zen.themes.map(t => t.id));
    const last = themes[themes.length - 1];
    await page.evaluate((id) => window.zen.apply(id), last);
    const wrapped = await page.evaluate(() => window.zen.next().then(t => t.id));
    expect(wrapped).toBe(themes[0]);
  });

  // ── reset() ───────────────────────────────────────────────────────────────

  test('reset() applies the manifest default theme', async ({ page }) => {
    await page.evaluate(() => window.zen.apply('terminal'));
    await page.evaluate(() => window.zen.reset());
    const active = await page.evaluate(() => window.zen.active?.id);
    expect(active).toBe('default');
  });

  test('reset() clears localStorage', async ({ page }) => {
    await page.evaluate(() => window.zen.apply('terminal'));
    await page.evaluate(() => window.zen.reset());
    const stored = await page.evaluate(() => localStorage.getItem('zen:theme'));
    expect(stored).toBeNull();
  });

  // ── Getters ───────────────────────────────────────────────────────────────

  test('zen.themes returns all 8 themes', async ({ page }) => {
    const len = await page.evaluate(() => window.zen.themes.length);
    expect(len).toBe(8);
  });

  test('zen.manifest exposes version, default, and themes', async ({ page }) => {
    const keys = await page.evaluate(() => Object.keys(window.zen.manifest));
    expect(keys).toContain('version');
    expect(keys).toContain('default');
    expect(keys).toContain('themes');
  });

  test('zen.active reflects the current theme', async ({ page }) => {
    expect(await page.evaluate(() => window.zen.active?.id)).toBe('default');
    await page.evaluate(() => window.zen.apply('neon-noir'));
    expect(await page.evaluate(() => window.zen.active?.id)).toBe('neon-noir');
  });

});
