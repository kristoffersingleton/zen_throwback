/**
 * Shared Playwright test helpers for Zen Throwback.
 */

/** Wait for the engine to be fully initialised. */
export async function waitForReady(page) {
  await page.waitForFunction(() => window.zen?.manifest && document.documentElement.dataset.testReady === 'true');
}

/**
 * Read a CSS custom property from a selector's computed style.
 * Returns the trimmed string value as the browser normalises it.
 * @param {import('@playwright/test').Page} page
 * @param {string} varName   e.g. '--zen-color-bg'
 * @param {string} selector  CSS selector (default: ':root')
 */
export async function getCSSVar(page, varName, selector = ':root') {
  return page.evaluate(
    ([v, s]) => getComputedStyle(document.querySelector(s)).getPropertyValue(v).trim(),
    [varName, selector]
  );
}

/** Get a data attribute from <html>. */
export async function getDataAttr(page, attr) {
  return page.locator('html').getAttribute(attr);
}

/** Clear zen theme preference from localStorage. */
export async function clearZenStorage(page) {
  await page.evaluate(() => localStorage.removeItem('zen:theme'));
}

/** Set zen theme preference in localStorage (before page load, use addInitScript instead). */
export async function setZenStorage(page, themeId) {
  await page.evaluate((id) => localStorage.setItem('zen:theme', id), themeId);
}

/**
 * Navigate to the engine fixture with an optional ?zen= param and optional
 * localStorage preset (injected before the page script runs).
 */
export async function gotoFixture(page, { param, storage, colorScheme } = {}) {
  if (storage !== undefined) {
    await page.addInitScript(
      (id) => localStorage.setItem('zen:theme', id),
      storage
    );
  }
  // Use clean URLs (no .html) — serve redirects *.html → * and drops query strings.
  const url = param
    ? `/tests/fixtures/engine?zen=${encodeURIComponent(param)}`
    : '/tests/fixtures/engine';
  await page.goto(url);
  await waitForReady(page);
}

/**
 * Normalise a CSS color value to lowercase hex for cross-browser comparison.
 * Handles rgb(r, g, b) → #rrggbb.
 * Falls back to returning the original string if parsing fails.
 */
export function normalizeColor(cssValue) {
  const m = cssValue.match(/^rgb\(\s*(\d+),\s*(\d+),\s*(\d+)\s*\)$/);
  if (!m) return cssValue.toLowerCase();
  return '#' + [m[1], m[2], m[3]]
    .map(n => parseInt(n).toString(16).padStart(2, '0'))
    .join('');
}
