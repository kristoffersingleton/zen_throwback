/**
 * Zen — Dynamic Presentation Layer Engine
 *
 * A portable, framework-agnostic engine for runtime theme switching.
 * Supports four theming tiers:
 *   1. Token  — CSS custom property overrides
 *   2. Layer  — Full stylesheet injection via CSS @layer
 *   3. Component — Web Component registration overrides
 *   4. Generative — Seed-based procedural CSS generation
 *
 * Discovery protocol: <link rel="zen-manifest" href="/zen-manifest.json">
 * Persistence: localStorage key "zen:theme"
 * Shareable: URL param ?zen=<theme-id>
 */

const ZEN_STORAGE_KEY = 'zen:theme';
const ZEN_LAYER_NAME = 'zen.theme';
const ZEN_MANIFEST_REL = 'zen-manifest';
const ZEN_EVENT_PREFIX = 'zen:';

export class Zen extends EventTarget {
  #manifest = null;
  #activeTheme = null;
  #styleEl = null;
  #tokenEl = null;
  #options = {};

  /**
   * @param {object} options
   * @param {string} [options.manifest]      URL to zen-manifest.json (auto-discovered if omitted)
   * @param {boolean} [options.persist=true] Save preference to localStorage
   * @param {boolean} [options.urlParam=true] Read/write ?zen= URL param
   * @param {boolean} [options.transitions=true] Use View Transitions API when available
   * @param {string} [options.root=':root']  CSS selector for token injection
   */
  constructor(options = {}) {
    super();
    this.#options = {
      persist: true,
      urlParam: true,
      transitions: true,
      root: ':root',
      ...options,
    };
  }

  // ─── Initialisation ────────────────────────────────────────────────────────

  /**
   * Load the manifest and apply the appropriate initial theme.
   * Priority: URL param > localStorage > manifest default > first theme
   */
  async init() {
    const manifestUrl = this.#options.manifest ?? this.#discoverManifest();
    if (!manifestUrl) throw new Error('[Zen] No manifest found. Provide options.manifest or add <link rel="zen-manifest">.');

    this.#manifest = await this.#fetchManifest(manifestUrl);
    this.#ensureLayer();

    const initial = this.#resolveInitialTheme();
    if (initial) await this.apply(initial, { silent: false });

    this.#emit('ready', { manifest: this.#manifest });
    return this;
  }

  // ─── Theme application ─────────────────────────────────────────────────────

  /**
   * Apply a theme by id.
   * @param {string} themeId
   * @param {object} [opts]
   * @param {boolean} [opts.silent=false] Suppress events
   */
  async apply(themeId, opts = {}) {
    const theme = this.#getTheme(themeId);
    if (!theme) throw new Error(`[Zen] Unknown theme: "${themeId}"`);

    const run = async () => {
      await this.#applyTheme(theme);
      this.#activeTheme = theme;
      if (this.#options.persist) this.#persist(themeId);
      if (this.#options.urlParam) this.#updateUrlParam(themeId);
      if (!opts.silent) this.#emit('change', { theme });
    };

    if (this.#options.transitions && 'startViewTransition' in document) {
      await document.startViewTransition(run).finished;
    } else {
      await run();
    }

    return theme;
  }

  /**
   * Apply a random theme from the manifest (excludes current).
   */
  async random() {
    const available = this.#manifest.themes.filter(t => t.id !== this.#activeTheme?.id);
    const pick = available[Math.floor(Math.random() * available.length)];
    return this.apply(pick.id);
  }

  /**
   * Cycle to the next theme in manifest order.
   */
  async next() {
    const themes = this.#manifest.themes;
    const idx = themes.findIndex(t => t.id === this.#activeTheme?.id);
    const next = themes[(idx + 1) % themes.length];
    return this.apply(next.id);
  }

  /**
   * Reset to the manifest default (or first theme).
   */
  async reset() {
    const id = this.#manifest.default ?? this.#manifest.themes[0]?.id;
    if (id) await this.apply(id);
    if (this.#options.persist) localStorage.removeItem(ZEN_STORAGE_KEY);
  }

  // ─── Introspection ─────────────────────────────────────────────────────────

  get themes() {
    return this.#manifest?.themes ?? [];
  }

  get active() {
    return this.#activeTheme;
  }

  get manifest() {
    return this.#manifest;
  }

  // ─── Internal: theme application ───────────────────────────────────────────

  async #applyTheme(theme) {
    // Level 1: Token overrides (CSS custom properties on :root)
    if (theme.tokens) {
      this.#applyTokens(theme.tokens);
    }

    // Level 2: Layer stylesheet (full CSS injection)
    if (theme.stylesheet) {
      await this.#applyStylesheet(theme.stylesheet, theme);
    } else if (theme.tokens && !theme.stylesheet) {
      // Token-only theme: clear any previous layer stylesheet
      this.#clearStylesheet();
    }

    // Level 3: Web Component overrides
    if (theme.components) {
      await this.#applyComponents(theme.components);
    }

    // Level 4: Generative (JS module that exports a generate(seed) function)
    if (theme.generator) {
      await this.#applyGenerator(theme.generator, theme.seed);
    }

    // Set data attribute so authors can write [data-zen-theme="terminal"] selectors
    document.documentElement.dataset.zenTheme = theme.id;
    document.documentElement.dataset.zenTier = theme.tier ?? 'token';
  }

  #applyTokens(tokens) {
    if (!this.#tokenEl) {
      this.#tokenEl = document.createElement('style');
      this.#tokenEl.id = 'zen-tokens';
      document.head.prepend(this.#tokenEl); // prepend so @layer overrides win
    }
    const props = Object.entries(tokens)
      .map(([k, v]) => `  ${k.startsWith('--') ? k : '--zen-' + k}: ${v};`)
      .join('\n');
    this.#tokenEl.textContent = `${this.#options.root} {\n${props}\n}`;
  }

  async #applyStylesheet(url, theme) {
    const css = await this.#fetchCSS(url);
    // Wrap in @layer so it wins via layer order, not specificity
    const layered = `@layer ${ZEN_LAYER_NAME} {\n${css}\n}`;
    if (!this.#styleEl) {
      this.#styleEl = document.createElement('style');
      this.#styleEl.id = 'zen-layer';
      document.head.appendChild(this.#styleEl);
    }
    this.#styleEl.textContent = layered;
  }

  #clearStylesheet() {
    if (this.#styleEl) this.#styleEl.textContent = `@layer ${ZEN_LAYER_NAME} {}`;
  }

  async #applyComponents(componentMap) {
    // componentMap: { "zen-card": "/themes/terminal/card.js", ... }
    for (const [tagName, url] of Object.entries(componentMap)) {
      if (customElements.get(tagName)) {
        // Custom elements cannot be redefined once registered.
        // Strategy: upgrade via a wrapper or swap via slot content.
        // For now, emit a warning — full component swap requires
        // the host page to use the deferred registration pattern.
        console.warn(`[Zen] <${tagName}> already registered. Use zen-deferred registration for swappable components.`);
        continue;
      }
      const mod = await import(url);
      if (mod.default && typeof mod.default === 'function') {
        customElements.define(tagName, mod.default);
      }
    }
  }

  async #applyGenerator(generatorUrl, seed) {
    const mod = await import(generatorUrl);
    if (typeof mod.generate !== 'function') {
      throw new Error(`[Zen] Generator at ${generatorUrl} must export a named "generate" function.`);
    }
    const resolvedSeed = seed ?? Math.random().toString(36).slice(2);
    const css = await mod.generate(resolvedSeed);
    if (!this.#styleEl) {
      this.#styleEl = document.createElement('style');
      this.#styleEl.id = 'zen-layer';
      document.head.appendChild(this.#styleEl);
    }
    this.#styleEl.textContent = `@layer ${ZEN_LAYER_NAME} {\n${css}\n}`;
    document.documentElement.dataset.zenSeed = resolvedSeed;
  }

  // ─── Internal: layer setup ─────────────────────────────────────────────────

  /**
   * Inject a @layer declaration order so zen.theme wins over site styles
   * but can be overridden by user agent / high-specificity rules.
   * The declaration must come before any existing @layer rules.
   */
  #ensureLayer() {
    if (document.querySelector('#zen-layer-order')) return;
    const el = document.createElement('style');
    el.id = 'zen-layer-order';
    // Declare the layer order: site base < zen.theme
    // This means themes in zen.theme cascade *over* unlayered site CSS.
    el.textContent = `@layer base, ${ZEN_LAYER_NAME};`;
    document.head.prepend(el);
  }

  // ─── Internal: manifest & discovery ────────────────────────────────────────

  #discoverManifest() {
    const link = document.querySelector(`link[rel="${ZEN_MANIFEST_REL}"]`);
    return link?.href ?? null;
  }

  async #fetchManifest(url) {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`[Zen] Failed to fetch manifest: ${url} (${res.status})`);
    const manifest = await res.json();
    this.#validateManifest(manifest);
    return manifest;
  }

  #validateManifest(manifest) {
    if (!Array.isArray(manifest.themes)) throw new Error('[Zen] Manifest must have a "themes" array.');
    for (const t of manifest.themes) {
      if (!t.id) throw new Error('[Zen] Each theme must have an "id".');
      if (!t.name) throw new Error('[Zen] Each theme must have a "name".');
    }
  }

  async #fetchCSS(url) {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`[Zen] Failed to fetch stylesheet: ${url}`);
    return res.text();
  }

  // ─── Internal: persistence & URL ──────────────────────────────────────────

  #resolveInitialTheme() {
    if (this.#options.urlParam) {
      const param = new URL(location.href).searchParams.get('zen');
      if (param && this.#getTheme(param)) return param;
    }
    if (this.#options.persist) {
      const stored = localStorage.getItem(ZEN_STORAGE_KEY);
      if (stored && this.#getTheme(stored)) return stored;
    }
    return this.#manifest.default ?? this.#manifest.themes[0]?.id ?? null;
  }

  #persist(themeId) {
    localStorage.setItem(ZEN_STORAGE_KEY, themeId);
  }

  #updateUrlParam(themeId) {
    const url = new URL(location.href);
    url.searchParams.set('zen', themeId);
    history.replaceState(null, '', url);
  }

  // ─── Internal: helpers ─────────────────────────────────────────────────────

  #getTheme(id) {
    return this.#manifest?.themes.find(t => t.id === id) ?? null;
  }

  #emit(event, detail = {}) {
    // Dispatch on both this instance (for programmatic listeners) and document
    // (for DOM components like <zen-switcher> that can't hold a direct reference).
    const make = () => new CustomEvent(ZEN_EVENT_PREFIX + event, { detail });
    this.dispatchEvent(make());
    document.dispatchEvent(make());
  }
}

export default Zen;
