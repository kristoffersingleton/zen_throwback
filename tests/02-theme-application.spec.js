import { test, expect } from '@playwright/test';
import { waitForReady, getCSSVar, normalizeColor } from './helpers/zen.js';

test.describe('Theme application', () => {

  test.beforeEach(async ({ page }) => {
    await page.goto('/tests/fixtures/engine');
    await waitForReady(page);
    await page.evaluate(() => localStorage.clear());
  });

  // ── Token tier ────────────────────────────────────────────────────────────

  test('default theme: --zen-color-bg is white', async ({ page }) => {
    const raw = await getCSSVar(page, '--zen-color-bg');
    expect(normalizeColor(raw)).toBe('#ffffff');
  });

  test('default theme: --zen-color-accent is #0070f3', async ({ page }) => {
    const raw = await getCSSVar(page, '--zen-color-accent');
    expect(normalizeColor(raw)).toBe('#0070f3');
  });

  test('default theme: --zen-radius is 6px', async ({ page }) => {
    const val = await getCSSVar(page, '--zen-radius');
    expect(val).toBe('6px');
  });

  test('#zen-tokens textContent contains the active token values', async ({ page }) => {
    const content = await page.evaluate(() => document.querySelector('#zen-tokens')?.textContent ?? '');
    expect(content).toContain('--zen-color-bg');
    expect(content).toContain('--zen-color-accent');
  });

  // ── Token theme switching ─────────────────────────────────────────────────

  test('neon-noir: --zen-color-bg changes to dark value', async ({ page }) => {
    await page.evaluate(() => window.zen.apply('neon-noir'));
    const raw = await getCSSVar(page, '--zen-color-bg');
    expect(normalizeColor(raw)).toBe('#0a0010');
  });

  test('brutalist: --zen-radius is 0px', async ({ page }) => {
    await page.evaluate(() => window.zen.apply('brutalist'));
    const val = await getCSSVar(page, '--zen-radius');
    expect(val).toBe('0px');
  });

  test('newspaper: --zen-font-body contains Georgia', async ({ page }) => {
    await page.evaluate(() => window.zen.apply('newspaper'));
    const val = await getCSSVar(page, '--zen-font-body');
    expect(val.toLowerCase()).toContain('georgia');
  });

  // ── Layer tier ────────────────────────────────────────────────────────────

  test('layer theme: #zen-layer is injected after apply()', async ({ page }) => {
    await page.evaluate(() => window.zen.apply('terminal'));
    const exists = await page.evaluate(() => !!document.querySelector('#zen-layer'));
    expect(exists).toBe(true);
  });

  test('layer theme: #zen-layer is wrapped in @layer zen.theme', async ({ page }) => {
    await page.evaluate(() => window.zen.apply('terminal'));
    const content = await page.evaluate(() => document.querySelector('#zen-layer')?.textContent ?? '');
    expect(content.trim()).toMatch(/^@layer zen\.theme \{/);
  });

  test('layer theme: terminal --zen-color-text is green', async ({ page }) => {
    await page.evaluate(() => window.zen.apply('terminal'));
    await expect(page.locator('html')).toHaveAttribute('data-zen-theme', 'terminal');
    const raw = await getCSSVar(page, '--zen-color-text');
    expect(normalizeColor(raw)).toBe('#39ff14');
  });

  test('switching from layer to token-only clears #zen-layer content', async ({ page }) => {
    await page.evaluate(() => window.zen.apply('terminal'));
    await page.evaluate(() => window.zen.apply('default'));
    const content = await page.evaluate(() => document.querySelector('#zen-layer')?.textContent ?? '');
    expect(content.trim()).toBe('@layer zen.theme {}');
  });

  test('both #zen-tokens and #zen-layer exist after a layer theme', async ({ page }) => {
    await page.evaluate(() => window.zen.apply('terminal'));
    const both = await page.evaluate(() => ({
      tokens: !!document.querySelector('#zen-tokens'),
      layer:  !!document.querySelector('#zen-layer'),
    }));
    expect(both.tokens).toBe(true);
    expect(both.layer).toBe(true);
  });

  // ── Generative tier ───────────────────────────────────────────────────────

  test('same seed produces identical CSS', async ({ page }) => {
    const [a, b] = await page.evaluate(async () => {
      const mod = await import('/themes/generative/generator.js');
      return [mod.generate('testseed123'), mod.generate('testseed123')];
    });
    expect(a).toBe(b);
  });

  test('different seeds produce different CSS', async ({ page }) => {
    const [a, b] = await page.evaluate(async () => {
      const mod = await import('/themes/generative/generator.js');
      return [mod.generate('alpha'), mod.generate('omega')];
    });
    expect(a).not.toBe(b);
  });

  test('generative theme CSS is injected into #zen-layer', async ({ page }) => {
    await page.evaluate(() => window.zen.apply('random-seed'));
    const content = await page.evaluate(() => document.querySelector('#zen-layer')?.textContent ?? '');
    expect(content).toContain('@layer zen.theme');
    expect(content).toContain('Generative theme');
  });

  test('custom seed is used when theme.seed is set', async ({ page }) => {
    await page.evaluate(async () => {
      const t = window.zen.themes.find(t => t.id === 'random-seed');
      t.seed = 'myspecificseed';
      await window.zen.apply('random-seed');
    });
    const seed = await page.locator('html').getAttribute('data-zen-seed');
    expect(seed).toBe('myspecificseed');
  });

  test('generative CSS contains the seed in a comment', async ({ page }) => {
    await page.evaluate(async () => {
      window.zen.themes.find(t => t.id === 'random-seed').seed = 'commenttest';
      await window.zen.apply('random-seed');
    });
    const content = await page.evaluate(() => document.querySelector('#zen-layer')?.textContent ?? '');
    expect(content).toContain('seed: commenttest');
  });

});
