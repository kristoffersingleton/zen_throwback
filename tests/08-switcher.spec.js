import { test, expect } from '@playwright/test';
import { waitForReady, gotoFixture } from './helpers/zen.js';

// Helper: query inside <zen-switcher>'s open shadow root
const shadow = (page) => ({
  locator: (sel) => page.locator(`#switcher`).locator(`css=*`).filter({}).and(
    // Use evaluate for shadow DOM queries
    page.locator('#switcher')
  ),
  // Returns the count of elements matching `sel` inside the shadow root
  count: (sel) => page.evaluate(
    (s) => document.querySelector('#switcher')?.shadowRoot?.querySelectorAll(s).length ?? 0,
    sel
  ),
  // Returns the nth element's attribute
  attr: (sel, idx, attr) => page.evaluate(
    ([s, i, a]) => document.querySelector('#switcher')?.shadowRoot?.querySelectorAll(s)[i]?.getAttribute(a),
    [sel, idx, attr]
  ),
  // Returns textContent of element
  text: (sel, idx = 0) => page.evaluate(
    ([s, i]) => document.querySelector('#switcher')?.shadowRoot?.querySelectorAll(s)[i]?.textContent?.trim(),
    [sel, idx]
  ),
  // Clicks the nth matching element
  click: (sel, idx = 0) => page.evaluate(
    ([s, i]) => document.querySelector('#switcher')?.shadowRoot?.querySelectorAll(s)[i]?.click(),
    [sel, idx]
  ),
  // Check if element has a class
  hasClass: (sel, idx, cls) => page.evaluate(
    ([s, i, c]) => document.querySelector('#switcher')?.shadowRoot?.querySelectorAll(s)[i]?.classList.contains(c),
    [sel, idx, cls]
  ),
});

test.describe('<zen-switcher> Web Component', () => {

  test.beforeEach(async ({ page }) => {
    await gotoFixture(page);
  });

  // ── Initial render ────────────────────────────────────────────────────────

  test('renders one button per theme (8 total)', async ({ page }) => {
    const s = shadow(page);
    const count = await s.count('.zen-theme-btn');
    expect(count).toBe(8);
  });

  test('first button has data-theme-id="default"', async ({ page }) => {
    const s = shadow(page);
    const attr = await s.attr('.zen-theme-btn', 0, 'data-theme-id');
    expect(attr).toBe('default');
  });

  test('last button has data-theme-id="random-seed"', async ({ page }) => {
    const s = shadow(page);
    const count = await s.count('.zen-theme-btn');
    const attr = await s.attr('.zen-theme-btn', count - 1, 'data-theme-id');
    expect(attr).toBe('random-seed');
  });

  test('active button has class "active"', async ({ page }) => {
    const s = shadow(page);
    // default is active; it's the first button
    const hasActive = await s.hasClass('.zen-theme-btn', 0, 'active');
    expect(hasActive).toBe(true);
  });

  test('active button has aria-selected="true"', async ({ page }) => {
    const s = shadow(page);
    const attr = await s.attr('.zen-theme-btn', 0, 'aria-selected');
    expect(attr).toBe('true');
  });

  test('non-active buttons do not have class "active"', async ({ page }) => {
    const s = shadow(page);
    const count = await s.count('.zen-theme-btn');
    const results = await Promise.all(
      Array.from({ length: count - 1 }, (_, i) => s.hasClass('.zen-theme-btn', i + 1, 'active'))
    );
    expect(results.every(r => r === false)).toBe(true);
  });

  test('token-tier theme has no tier badge', async ({ page }) => {
    const s = shadow(page);
    // default is token-tier — its button should have no .zen-tier element
    const badgeCount = await page.evaluate(() => {
      const btn = document.querySelector('#switcher')?.shadowRoot?.querySelectorAll('.zen-theme-btn')[0];
      return btn?.querySelectorAll('.zen-tier').length ?? -1;
    });
    expect(badgeCount).toBe(0);
  });

  test('layer-tier theme has "CSS" badge', async ({ page }) => {
    // terminal is index 2 in the manifest
    const s = shadow(page);
    const badgeText = await page.evaluate(() => {
      const btns = document.querySelector('#switcher')?.shadowRoot?.querySelectorAll('.zen-theme-btn');
      const terminalBtn = [...btns].find(b => b.dataset.themeId === 'terminal');
      return terminalBtn?.querySelector('.zen-tier')?.textContent?.trim();
    });
    expect(badgeText).toBe('CSS');
  });

  test('generative-tier theme has "GEN" badge', async ({ page }) => {
    const badgeText = await page.evaluate(() => {
      const btns = document.querySelector('#switcher')?.shadowRoot?.querySelectorAll('.zen-theme-btn');
      const genBtn = [...btns].find(b => b.dataset.themeId === 'random-seed');
      return genBtn?.querySelector('.zen-tier')?.textContent?.trim();
    });
    expect(badgeText).toBe('GEN');
  });

  test('two-colour swatch uses linear-gradient', async ({ page }) => {
    const swatchStyle = await page.evaluate(() => {
      const btns = document.querySelector('#switcher')?.shadowRoot?.querySelectorAll('.zen-theme-btn');
      const defaultBtn = [...btns].find(b => b.dataset.themeId === 'default');
      return defaultBtn?.querySelector('.zen-swatch')?.getAttribute('style');
    });
    expect(swatchStyle).toContain('linear-gradient');
  });

  test('string swatch uses flat background colour', async ({ page }) => {
    const swatchStyle = await page.evaluate(() => {
      const btns = document.querySelector('#switcher')?.shadowRoot?.querySelectorAll('.zen-theme-btn');
      const genBtn = [...btns].find(b => b.dataset.themeId === 'random-seed');
      return genBtn?.querySelector('.zen-swatch')?.getAttribute('style');
    });
    expect(swatchStyle).toContain('background: #888');
  });

  // ── Toggle panel ──────────────────────────────────────────────────────────

  test('panel is initially closed', async ({ page }) => {
    const hasOpen = await page.evaluate(() =>
      document.querySelector('#switcher')?.shadowRoot?.querySelector('.zen-panel')?.classList.contains('open')
    );
    expect(hasOpen).toBe(false);
  });

  test('clicking toggle opens the panel', async ({ page }) => {
    await page.evaluate(() =>
      document.querySelector('#switcher')?.shadowRoot?.querySelector('.zen-toggle')?.click()
    );
    const hasOpen = await page.evaluate(() =>
      document.querySelector('#switcher')?.shadowRoot?.querySelector('.zen-panel')?.classList.contains('open')
    );
    expect(hasOpen).toBe(true);
  });

  test('toggle aria-expanded is true when panel is open', async ({ page }) => {
    await page.evaluate(() =>
      document.querySelector('#switcher')?.shadowRoot?.querySelector('.zen-toggle')?.click()
    );
    const expanded = await page.evaluate(() =>
      document.querySelector('#switcher')?.shadowRoot?.querySelector('.zen-toggle')?.getAttribute('aria-expanded')
    );
    expect(expanded).toBe('true');
  });

  test('clicking outside closes the panel', async ({ page }) => {
    // Open the panel
    await page.evaluate(() =>
      document.querySelector('#switcher')?.shadowRoot?.querySelector('.zen-toggle')?.click()
    );
    // Click somewhere outside the switcher
    await page.locator('#heading').click();
    const hasOpen = await page.evaluate(() =>
      document.querySelector('#switcher')?.shadowRoot?.querySelector('.zen-panel')?.classList.contains('open')
    );
    expect(hasOpen).toBe(false);
  });

  // ── Theme switching ───────────────────────────────────────────────────────

  test('clicking a theme button applies that theme', async ({ page }) => {
    await page.evaluate(() => {
      const btns = document.querySelector('#switcher')?.shadowRoot?.querySelectorAll('.zen-theme-btn');
      const terminalBtn = [...btns].find(b => b.dataset.themeId === 'terminal');
      terminalBtn?.click();
    });
    await expect(page.locator('html')).toHaveAttribute('data-zen-theme', 'terminal');
  });

  test('active state updates when theme is changed programmatically', async ({ page }) => {
    await page.evaluate(() => window.zen.apply('brutalist'));
    await expect(page.locator('html')).toHaveAttribute('data-zen-theme', 'brutalist');

    const brutalistActive = await page.evaluate(() => {
      const btns = document.querySelector('#switcher')?.shadowRoot?.querySelectorAll('.zen-theme-btn');
      return [...btns].find(b => b.dataset.themeId === 'brutalist')?.classList.contains('active');
    });
    expect(brutalistActive).toBe(true);

    const defaultActive = await page.evaluate(() => {
      const btns = document.querySelector('#switcher')?.shadowRoot?.querySelectorAll('.zen-theme-btn');
      return [...btns].find(b => b.dataset.themeId === 'default')?.classList.contains('active');
    });
    expect(defaultActive).toBe(false);
  });

  test('Random button triggers a theme change', async ({ page }) => {
    const before = await page.locator('html').getAttribute('data-zen-theme');
    await page.evaluate(() =>
      document.querySelector('#switcher')?.shadowRoot?.querySelector('.zen-random')?.click()
    );
    // Wait for the theme to change (data-test-last-theme is set by zen:change handler)
    await expect(page.locator('html')).not.toHaveAttribute('data-test-last-theme', before ?? '', { timeout: 3000 });
  });

  test('Reset button restores default theme', async ({ page }) => {
    await page.evaluate(() => window.zen.apply('terminal'));
    await expect(page.locator('html')).toHaveAttribute('data-zen-theme', 'terminal');

    await page.evaluate(() =>
      document.querySelector('#switcher')?.shadowRoot?.querySelector('.zen-reset')?.click()
    );
    await expect(page.locator('html')).toHaveAttribute('data-zen-theme', 'default');
  });

  // ── Duplicate population guard ────────────────────────────────────────────

  test('calling populate() twice with the same instance does not double the button list', async ({ page }) => {
    await page.evaluate(() => {
      const sw = document.querySelector('#switcher');
      sw.populate(window.zen);
      sw.populate(window.zen);
    });
    const count = await page.evaluate(() =>
      document.querySelector('#switcher')?.shadowRoot?.querySelectorAll('.zen-theme-btn').length
    );
    expect(count).toBe(8);
  });

});
