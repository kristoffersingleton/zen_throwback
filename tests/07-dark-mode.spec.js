import { test, expect } from '@playwright/test';
import { waitForReady, getCSSVar, normalizeColor } from './helpers/zen.js';

// ── CSS-only dark mode (no engine) ────────────────────────────────────────────
// These tests use css-only.html which has NO JavaScript and NO data-zen-theme,
// so the :root:not([data-zen-theme]) selector in tokens.css fires freely.

test.describe('CSS-only dark mode (no engine)', () => {

  test('light mode: --zen-color-bg is white', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'light' });
    await page.goto('/tests/fixtures/css-only');
    const raw = await getCSSVar(page, '--zen-color-bg');
    expect(normalizeColor(raw)).toBe('#ffffff');
  });

  test('dark mode: --zen-color-bg becomes #111111', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'dark' });
    await page.goto('/tests/fixtures/css-only');
    const raw = await getCSSVar(page, '--zen-color-bg');
    expect(normalizeColor(raw)).toBe('#111111');
  });

  test('dark mode: --zen-color-text becomes #e8e8e8', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'dark' });
    await page.goto('/tests/fixtures/css-only');
    const raw = await getCSSVar(page, '--zen-color-text');
    expect(normalizeColor(raw)).toBe('#e8e8e8');
  });

  test('dark mode: --zen-color-accent becomes #4da6ff', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'dark' });
    await page.goto('/tests/fixtures/css-only');
    const raw = await getCSSVar(page, '--zen-color-accent');
    expect(normalizeColor(raw)).toBe('#4da6ff');
  });

  test('dark tokens are blocked when data-zen-theme is present', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'dark' });
    await page.goto('/tests/fixtures/css-only');
    // Simulate the engine having set data-zen-theme
    await page.evaluate(() => document.documentElement.dataset.zenTheme = 'anything');
    const raw = await getCSSVar(page, '--zen-color-bg');
    // Should NOT be the dark value — selector is :root:not([data-zen-theme])
    expect(normalizeColor(raw)).toBe('#ffffff');
  });

  test('prefers-reduced-motion zeroes --zen-transition', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/tests/fixtures/css-only');
    const val = await getCSSVar(page, '--zen-transition');
    expect(val).toBe('0ms');
  });

  test('light mode: --zen-transition is NOT 0ms', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await page.goto('/tests/fixtures/css-only');
    const val = await getCSSVar(page, '--zen-transition');
    expect(val).not.toBe('0ms');
  });

});

// ── Engine-driven dark mode ────────────────────────────────────────────────────

test.describe('Engine-driven dark mode', () => {

  test('init() applies default-dark when OS is dark and no preference stored', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'dark' });
    await page.goto('/tests/fixtures/engine');
    await waitForReady(page);
    await expect(page.locator('html')).toHaveAttribute('data-zen-theme', 'default-dark');
  });

  test('init() applies default when OS is light', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'light' });
    await page.goto('/tests/fixtures/engine');
    await waitForReady(page);
    await expect(page.locator('html')).toHaveAttribute('data-zen-theme', 'default');
  });

  test('OS change to dark triggers darkVariant switch', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'light' });
    await page.goto('/tests/fixtures/engine');
    await waitForReady(page);

    await page.emulateMedia({ colorScheme: 'dark' });
    await expect(page.locator('html')).toHaveAttribute('data-zen-theme', 'default-dark', { timeout: 3000 });
  });

  test('OS change back to light triggers lightVariant switch', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'dark' });
    await page.goto('/tests/fixtures/engine');
    await waitForReady(page);

    await page.emulateMedia({ colorScheme: 'light' });
    await expect(page.locator('html')).toHaveAttribute('data-zen-theme', 'default', { timeout: 3000 });
  });

  test('explicit URL param prevents OS dark switch on init', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'dark' });
    await page.goto('/tests/fixtures/engine?zen=terminal');
    await waitForReady(page);
    await expect(page.locator('html')).toHaveAttribute('data-zen-theme', 'terminal');
  });

  test('explicit localStorage prevents OS dark switch on init', async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('zen:theme', 'zen-garden'));
    await page.emulateMedia({ colorScheme: 'dark' });
    await page.goto('/tests/fixtures/engine');
    await waitForReady(page);
    await expect(page.locator('html')).toHaveAttribute('data-zen-theme', 'zen-garden');
  });

  test('OS change does NOT override an explicit stored preference', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'light' });
    await page.goto('/tests/fixtures/engine');
    await waitForReady(page);

    // User explicitly picks a theme (writes to localStorage)
    await page.evaluate(() => window.zen.apply('terminal'));
    expect(await page.evaluate(() => localStorage.getItem('zen:theme'))).toBe('terminal');

    // OS goes dark
    await page.emulateMedia({ colorScheme: 'dark' });
    await page.waitForTimeout(500);

    // Should still be terminal, not default-dark
    await expect(page.locator('html')).toHaveAttribute('data-zen-theme', 'terminal');
  });

  test('OS-driven switch emits zen:change event', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'light' });
    await page.goto('/tests/fixtures/engine');
    await waitForReady(page);

    const countBefore = await page.evaluate(() =>
      window.__zenEvents.filter(e => e.type === 'zen:change').length
    );

    await page.emulateMedia({ colorScheme: 'dark' });
    await expect(page.locator('html')).toHaveAttribute('data-zen-theme', 'default-dark', { timeout: 3000 });

    const last = await page.evaluate(() =>
      window.__zenEvents.filter(e => e.type === 'zen:change').at(-1)
    );
    expect(last?.detail?.theme?.id).toBe('default-dark');
  });

  test('OS-driven switch does not write to localStorage', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'light' });
    await page.goto('/tests/fixtures/engine');
    await waitForReady(page);
    await page.emulateMedia({ colorScheme: 'dark' });
    await expect(page.locator('html')).toHaveAttribute('data-zen-theme', 'default-dark', { timeout: 3000 });

    const stored = await page.evaluate(() => localStorage.getItem('zen:theme'));
    expect(stored).toBeNull();
  });

});
