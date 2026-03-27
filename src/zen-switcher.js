/**
 * <zen-switcher> Web Component
 *
 * A self-contained UI for browsing and switching themes.
 * Usage:
 *   <zen-switcher></zen-switcher>
 *   <zen-switcher position="top-left"></zen-switcher>
 *
 * Attributes:
 *   position  top-left | top-right | bottom-left | bottom-right | inline (default: bottom-right)
 *
 * Listens for zen:ready and zen:change events on document.
 */

class ZenSwitcher extends HTMLElement {
  #zen = null;
  #shadow = null;

  static get observedAttributes() {
    return ['position'];
  }

  connectedCallback() {
    this.#shadow = this.attachShadow({ mode: 'open' });
    this.#shadow.innerHTML = this.#template();
    this.#bindToggle();

    // Wire up to a zen instance — may already be ready, or wait for it
    if (window.zen?.manifest) {
      this.#populate(window.zen);
    }
    document.addEventListener('zen:ready', () => {
      if (window.zen) this.#populate(window.zen);
    });
    document.addEventListener('zen:change', (e) => {
      this.#setActive(e.detail?.theme?.id);
    });
  }

  /** Called by demo page to pass zen instance explicitly */
  populate(zen) {
    this.#populate(zen);
  }

  // ─── Private ───────────────────────────────────────────────────────────────

  #populate(zen) {
    if (this.#zen === zen) return; // already populated with this instance
    this.#zen = zen;

    const list = this.#shadow.querySelector('.zen-theme-list');
    list.innerHTML = '';

    for (const theme of zen.themes) {
      const btn = document.createElement('button');
      btn.className = 'zen-theme-btn';
      btn.dataset.themeId = theme.id;
      btn.setAttribute('role', 'option');
      btn.title = theme.description ?? theme.name;
      // theme.name comes from the site's own manifest — same trust level as the page
      btn.innerHTML = `
        <span class="zen-swatch" style="${this.#swatchStyle(theme)}"></span>
        <span class="zen-label">${theme.name}</span>
        ${this.#tierBadge(theme.tier)}
      `;
      btn.addEventListener('click', () => zen.apply(theme.id));
      list.appendChild(btn);
    }

    // Replace buttons with clones to clear any previous listeners before re-adding
    const randomBtn = this.#shadow.querySelector('.zen-random');
    const resetBtn  = this.#shadow.querySelector('.zen-reset');
    const freshRandom = randomBtn.cloneNode(true);
    const freshReset  = resetBtn.cloneNode(true);
    randomBtn.replaceWith(freshRandom);
    resetBtn.replaceWith(freshReset);
    freshRandom.addEventListener('click', () => zen.random());
    freshReset.addEventListener('click', () => zen.reset());

    this.#setActive(zen.active?.id);
  }

  #setActive(id) {
    this.#shadow.querySelectorAll('.zen-theme-btn').forEach(btn => {
      const active = btn.dataset.themeId === id;
      btn.classList.toggle('active', active);
      btn.setAttribute('aria-selected', active);
    });
  }

  #bindToggle() {
    const toggle = this.#shadow.querySelector('.zen-toggle');
    const panel  = this.#shadow.querySelector('.zen-panel');
    if (!toggle || !panel) return;

    toggle.addEventListener('click', (e) => {
      e.stopPropagation();
      const open = panel.classList.toggle('open');
      toggle.setAttribute('aria-expanded', open);
    });

    // Close on outside click
    document.addEventListener('click', () => {
      panel.classList.remove('open');
      toggle.setAttribute('aria-expanded', 'false');
    });
    // Prevent panel clicks from bubbling to document
    panel.addEventListener('click', e => e.stopPropagation());
  }

  #swatchStyle(theme) {
    if (!theme.swatch) return 'background: #888';
    if (typeof theme.swatch === 'string') return `background: ${theme.swatch}`;
    const { bg, accent } = theme.swatch;
    return `background: linear-gradient(135deg, ${bg} 50%, ${accent} 50%)`;
  }

  #tierBadge(tier) {
    if (!tier || tier === 'token') return '';
    const labels = { layer: 'CSS', component: 'WC', generative: 'GEN' };
    return `<span class="zen-tier">${labels[tier] ?? tier}</span>`;
  }

  #positionCSS() {
    const pos = this.getAttribute('position') ?? 'bottom-right';
    const map = {
      'top-left':     'top: 16px; left: 16px;',
      'top-right':    'top: 16px; right: 16px;',
      'bottom-left':  'bottom: 16px; left: 16px;',
      'bottom-right': 'bottom: 16px; right: 16px;',
    };
    return { pos, css: map[pos] ?? map['bottom-right'] };
  }

  #template() {
    const { pos, css } = this.#positionCSS();
    const panelAbove = pos.includes('bottom');

    return `
      <style>
        :host {
          --z-bg: #1a1a1a;
          --z-surface: #2a2a2a;
          --z-border: #3a3a3a;
          --z-text: #e0e0e0;
          --z-accent: #7c6af7;
          --z-radius: 10px;
          --z-shadow: 0 8px 32px rgba(0,0,0,0.4);
          font-family: system-ui, sans-serif;
          font-size: 13px;
        }

        .zen-widget {
          position: fixed;
          z-index: 9999;
          ${css}
        }

        :host([position="inline"]) .zen-widget { position: static; }

        .zen-toggle {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 8px 12px;
          background: var(--z-bg);
          color: var(--z-text);
          border: 1px solid var(--z-border);
          border-radius: var(--z-radius);
          cursor: pointer;
          box-shadow: var(--z-shadow);
          font-size: 13px;
          font-family: inherit;
          transition: background 0.15s;
        }
        .zen-toggle:hover { background: var(--z-surface); }

        .zen-panel {
          display: none;
          position: absolute;
          ${panelAbove ? 'bottom: calc(100% + 8px); left: 0;' : 'top: calc(100% + 8px); left: 0;'}
          background: var(--z-bg);
          border: 1px solid var(--z-border);
          border-radius: var(--z-radius);
          box-shadow: var(--z-shadow);
          padding: 12px;
          min-width: 220px;
          max-height: 420px;
          overflow-y: auto;
        }
        .zen-panel.open { display: block; }

        .zen-panel-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 10px;
          color: var(--z-text);
          opacity: 0.6;
          font-size: 11px;
          text-transform: uppercase;
          letter-spacing: 0.08em;
        }

        .zen-theme-list {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .zen-theme-btn {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 8px 10px;
          background: transparent;
          color: var(--z-text);
          border: 1px solid transparent;
          border-radius: 6px;
          cursor: pointer;
          width: 100%;
          text-align: left;
          font-family: inherit;
          font-size: 13px;
          transition: background 0.1s, border-color 0.1s;
        }
        .zen-theme-btn:hover { background: var(--z-surface); }
        .zen-theme-btn.active {
          border-color: var(--z-accent);
          background: color-mix(in srgb, var(--z-accent) 12%, transparent);
        }

        .zen-swatch {
          width: 20px;
          height: 20px;
          border-radius: 4px;
          flex-shrink: 0;
          border: 1px solid rgba(255,255,255,0.1);
        }

        .zen-label { flex: 1; }

        .zen-tier {
          font-size: 9px;
          padding: 1px 4px;
          border-radius: 3px;
          background: var(--z-surface);
          color: var(--z-accent);
          border: 1px solid var(--z-border);
          font-family: monospace;
          letter-spacing: 0.05em;
        }

        .zen-actions {
          display: flex;
          gap: 6px;
          margin-top: 10px;
          padding-top: 10px;
          border-top: 1px solid var(--z-border);
        }

        .zen-action-btn {
          flex: 1;
          padding: 6px;
          background: var(--z-surface);
          color: var(--z-text);
          border: 1px solid var(--z-border);
          border-radius: 6px;
          cursor: pointer;
          font-family: inherit;
          font-size: 12px;
          transition: background 0.1s;
        }
        .zen-action-btn:hover { background: var(--z-border); }

        .zen-panel::-webkit-scrollbar { width: 4px; }
        .zen-panel::-webkit-scrollbar-track { background: transparent; }
        .zen-panel::-webkit-scrollbar-thumb { background: var(--z-border); border-radius: 2px; }
      </style>

      <div class="zen-widget">
        <button class="zen-toggle" aria-label="Switch presentation theme" aria-expanded="false" aria-haspopup="listbox">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
            <circle cx="12" cy="12" r="3"/>
            <path d="M12 2v2m0 16v2M4.22 4.22l1.42 1.42m12.72 12.72 1.42 1.42M2 12h2m16 0h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/>
          </svg>
          Themes
        </button>

        <div class="zen-panel" role="listbox" aria-label="Available themes">
          <div class="zen-panel-header">
            <span>Presentation</span>
          </div>
          <div class="zen-theme-list"></div>
          <div class="zen-actions">
            <button class="zen-action-btn zen-random" title="Apply a random theme">&#x2684; Random</button>
            <button class="zen-action-btn zen-reset" title="Reset to default">&#x21BA; Reset</button>
          </div>
        </div>
      </div>
    `;
  }
}

customElements.define('zen-switcher', ZenSwitcher);
export default ZenSwitcher;
