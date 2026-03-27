import { test, expect } from '@playwright/test';
import { waitForReady, gotoFixture } from './helpers/zen.js';

test.describe('Theme priority resolution', () => {

  // ── URL param beats everything ────────────────────────────────────────────

  test('?zen= param overrides localStorage', async ({ page }) => {
    await gotoFixture(page, { param: 'terminal', storage: 'brutalist' });
    await expect(page.locator('html')).toHaveAttribute('data-zen-theme', 'terminal');
  });

  test('?zen= param overrides manifest default', async ({ page }) => {
    await gotoFixture(page, { param: 'neon-noir' });
    await expect(page.locator('html')).toHaveAttribute('data-zen-theme', 'neon-noir');
  });

  test('invalid ?zen= param falls through to localStorage', async ({ page }) => {
    await gotoFixture(page, { param: 'does-not-exist', storage: 'brutalist' });
    await expect(page.locator('html')).toHaveAttribute('data-zen-theme', 'brutalist');
  });

  // ── localStorage beats manifest default ───────────────────────────────────

  test('localStorage preference is applied without URL param', async ({ page }) => {
    await gotoFixture(page, { storage: 'zen-garden' });
    await expect(page.locator('html')).toHaveAttribute('data-zen-theme', 'zen-garden');
  });

  test('invalid localStorage value falls through to manifest default', async ({ page }) => {
    await gotoFixture(page, { storage: 'not-a-real-theme' });
    await expect(page.locator('html')).toHaveAttribute('data-zen-theme', 'default');
  });

  // ── Manifest default as final fallback ────────────────────────────────────

  test('no URL param, no storage → manifest default', async ({ page }) => {
    await gotoFixture(page);
    await expect(page.locator('html')).toHaveAttribute('data-zen-theme', 'default');
  });

});

// Dark-mode priority tests live in a separate describe so they can be
// skipped on projects that don't emulate dark mode.
test.describe('Dark mode priority', () => {
  // These tests are only meaningful on dark-scheme browser projects.
  // They will also run on light projects but assert the light-mode fallback.

  test('explicit ?zen= overrides OS dark mode', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'dark' });
    await gotoFixture(page, { param: 'terminal' });
    await expect(page.locator('html')).toHaveAttribute('data-zen-theme', 'terminal');
  });

  test('explicit localStorage overrides OS dark mode', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'dark' });
    await gotoFixture(page, { storage: 'zen-garden' });
    await expect(page.locator('html')).toHaveAttribute('data-zen-theme', 'zen-garden');
  });

});
