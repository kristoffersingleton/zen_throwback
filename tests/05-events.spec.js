import { test, expect } from '@playwright/test';
import { waitForReady, gotoFixture } from './helpers/zen.js';

test.describe('Events', () => {

  test.beforeEach(async ({ page }) => {
    await gotoFixture(page);
  });

  // ── zen:ready ─────────────────────────────────────────────────────────────

  test('zen:ready is captured before init completes', async ({ page }) => {
    const readyEvents = await page.evaluate(() =>
      window.__zenEvents.filter(e => e.type === 'zen:ready')
    );
    expect(readyEvents).toHaveLength(1);
  });

  test('zen:ready detail contains manifest with themes array', async ({ page }) => {
    const detail = await page.evaluate(() =>
      window.__zenEvents.find(e => e.type === 'zen:ready')?.detail
    );
    expect(Array.isArray(detail?.manifest?.themes)).toBe(true);
    expect(detail.manifest.themes.length).toBe(8);
  });

  test('zen:ready fires on document', async ({ page }) => {
    // Add a document-level listener before init via addInitScript
    const page2 = await page.context().newPage();
    let captured = null;
    await page2.addInitScript(() => {
      window.__docReadyFired = false;
      document.addEventListener('zen:ready', (e) => {
        window.__docReadyFired = true;
        window.__docReadyDetail = e.detail;
      });
    });
    await page2.goto('/tests/fixtures/engine');
    await waitForReady(page2);
    const fired = await page2.evaluate(() => window.__docReadyFired);
    expect(fired).toBe(true);
    await page2.close();
  });

  test('zen:ready fires exactly once', async ({ page }) => {
    const count = await page.evaluate(() =>
      window.__zenEvents.filter(e => e.type === 'zen:ready').length
    );
    expect(count).toBe(1);
  });

  // ── zen:change ────────────────────────────────────────────────────────────

  test('zen:change fires on the instance when apply() is called', async ({ page }) => {
    await page.evaluate(() => window.zen.apply('terminal'));
    const last = await page.evaluate(() =>
      window.__zenEvents.filter(e => e.type === 'zen:change').at(-1)
    );
    expect(last?.detail?.theme?.id).toBe('terminal');
  });

  test('zen:change fires on document', async ({ page }) => {
    const page2 = await page.context().newPage();
    await page2.addInitScript(() => {
      window.__docChanges = [];
      document.addEventListener('zen:change', (e) => window.__docChanges.push(e.detail));
    });
    await page2.goto('/tests/fixtures/engine');
    await waitForReady(page2);
    await page2.evaluate(() => window.zen.apply('brutalist'));
    const changes = await page2.evaluate(() => window.__docChanges);
    expect(changes.some(d => d.theme?.id === 'brutalist')).toBe(true);
    await page2.close();
  });

  test('zen:change detail contains id, name, and tier', async ({ page }) => {
    await page.evaluate(() => window.zen.apply('terminal'));
    const detail = await page.evaluate(() =>
      window.__zenEvents.filter(e => e.type === 'zen:change').at(-1)?.detail
    );
    expect(detail?.theme?.id).toBe('terminal');
    expect(detail?.theme?.name).toBe('Terminal');
    expect(detail?.theme?.tier).toBe('layer');
  });

  test('zen:change does NOT fire when silent: true', async ({ page }) => {
    const before = await page.evaluate(() =>
      window.__zenEvents.filter(e => e.type === 'zen:change').length
    );
    await page.evaluate(() => window.zen.apply('brutalist', { silent: true }));
    const after = await page.evaluate(() =>
      window.__zenEvents.filter(e => e.type === 'zen:change').length
    );
    expect(after).toBe(before);
  });

  test('zen:change fires on next()', async ({ page }) => {
    await page.evaluate(() => window.zen.next());
    const last = await page.evaluate(() =>
      window.__zenEvents.filter(e => e.type === 'zen:change').at(-1)
    );
    expect(last?.detail?.theme?.id).toBeTruthy();
    expect(last?.detail?.theme?.id).not.toBe('default');
  });

  test('zen:change fires on random()', async ({ page }) => {
    await page.evaluate(() => window.zen.random());
    const last = await page.evaluate(() =>
      window.__zenEvents.filter(e => e.type === 'zen:change').at(-1)
    );
    expect(last?.detail?.theme?.id).toBeTruthy();
  });

  test('zen:change fires on reset()', async ({ page }) => {
    await page.evaluate(() => window.zen.apply('terminal'));
    await page.evaluate(() => window.zen.reset());
    const last = await page.evaluate(() =>
      window.__zenEvents.filter(e => e.type === 'zen:change').at(-1)
    );
    expect(last?.detail?.theme?.id).toBe('default');
  });

});
