# Zen Throwback

**CSS Zen Garden, evolved.** A portable, framework-agnostic engine that lets visitors dynamically restyle any web page — at runtime, with no page reload.

Inspired by [CSS Zen Garden](https://www.csszengarden.com/) (2003), which showed that a single HTML document could look radically different depending solely on its stylesheet. Zen Throwback picks up that thread: themes switch instantly, preferences persist across sessions, and shareable links let you send friends your view of a site. If enough sites adopt the [discovery protocol](#adoption), a browser extension could apply your preferred aesthetic everywhere.

Runtime CSS theme-switching for any website. Zero dependencies, framework agnostic.
Drop in two lines of HTML, build against CSS custom properties, and visitors can restyle your page instantly — including procedurally generated themes from a seed string.

---

## Quick demo

```bash
npm run dev
# open http://localhost:3900/demo/
```

Click any theme in the floating panel (bottom-right), or try the **Generative** theme and type any word as a seed — the same seed always produces the same result.

---

## How it works

Sites expose a set of CSS custom properties (the *token contract*). Themes implement that contract. The engine handles loading, switching, persistence, and the `<zen-switcher>` UI widget.

### Four theming tiers

Themes operate at one or more levels:

| Tier | What it does | Effort per theme |
|------|-------------|-----------------|
| **1 — Token** | Overrides ~20 CSS custom properties on `:root` | ~20 lines of JSON |
| **2 — Layer** | Injects a full stylesheet via CSS `@layer` | One CSS file |
| **3 — Component** | Registers Web Component overrides (structural changes) | One JS module per element |
| **4 — Generative** | A JS function produces CSS from a seed string | One JS module |

Tier 1 is the foundation — any site that builds against the token contract gets theme support for free, even from themes that know nothing about its markup.

---

## Using Zen on your site

### 1. Declare the manifest

Add two lines to your `<head>`:

```html
<link rel="zen-manifest" href="/zen-manifest.json">
<meta name="zen:tokens" content="v1">
```

The `rel="zen-manifest"` link is the discovery hook — tools and future browser extensions can find it automatically.

### 2. Include the token contract CSS

```html
<link rel="stylesheet" href="/themes/tokens.css">
```

Or copy the `@layer base { :root { ... } }` block into your own stylesheet. Build your site's CSS against `--zen-*` variables:

```css
.card {
  background:    var(--zen-color-surface);
  border:        var(--zen-border-width) var(--zen-border-style) var(--zen-color-border);
  border-radius: var(--zen-radius);
  font-family:   var(--zen-font-body);
  transition:    border-color var(--zen-transition);
}
```

### 3. Create your manifest

`zen-manifest.json` lists your themes. A minimal token-only example:

```json
{
  "version": "1",
  "default": "default",
  "themes": [
    {
      "id": "default",
      "name": "Default",
      "tier": "token",
      "swatch": { "bg": "#ffffff", "accent": "#0070f3" },
      "tokens": {
        "--zen-color-bg":    "#ffffff",
        "--zen-color-text":  "#111111",
        "--zen-color-accent":"#0070f3",
        "--zen-font-body":   "system-ui, sans-serif"
      }
    }
  ]
}
```

Full schema: [`themes/manifest.schema.json`](themes/manifest.schema.json)

### 4. Load the engine

```html
<script type="module">
  import Zen from '/src/zen.js';
  import '/src/zen-switcher.js'; // optional UI widget

  const zen = new Zen(); // auto-discovers <link rel="zen-manifest">

  // Register listeners BEFORE init() so zen:ready fires into them
  zen.addEventListener('zen:ready',  () => console.log('ready:', zen.active));
  zen.addEventListener('zen:change', e => console.log('changed to:', e.detail.theme));

  await zen.init();
  window.zen = zen; // expose for <zen-switcher> and browser console
</script>

<!-- Drop-in theme picker UI -->
<zen-switcher position="bottom-right"></zen-switcher>
```

---

## API

```js
const zen = new Zen(options);
await zen.init();         // load manifest, apply initial theme

zen.apply('terminal');    // switch to a theme by id
zen.random();             // pick a random theme (excludes current)
zen.next();               // cycle to next theme in manifest order
zen.reset();              // restore default, clear localStorage

zen.themes                // array of theme objects from the manifest
zen.active                // currently active theme object
zen.manifest              // the loaded manifest
```

### Options

```js
new Zen({
  manifest:    '/zen-manifest.json', // URL to manifest (auto-discovered if omitted)
  persist:     true,                 // save preference to localStorage
  urlParam:    true,                 // read/write ?zen= URL param
  transitions: true,                 // use View Transitions API when available
  root:        ':root',              // CSS selector for token injection
})
```

### Events

Both the `zen` instance and `document` emit these events:

```js
// On the instance (direct reference)
zen.addEventListener('zen:ready',  e => { /* e.detail.manifest */ });
zen.addEventListener('zen:change', e => { /* e.detail.theme    */ });

// On document (useful for Web Components without a direct reference)
document.addEventListener('zen:change', e => { /* e.detail.theme */ });
```

### URL sharing

When `urlParam: true` (default), the active theme is reflected in `?zen=<id>`:

```
https://example.com/page?zen=terminal
```

Share this URL and visitors see the same theme on load.

### `<zen-switcher>` attributes

```html
<zen-switcher position="bottom-right"></zen-switcher>
<!-- position: top-left | top-right | bottom-left | bottom-right | inline -->
```

### Data attributes on `<html>`

```css
/* Target a specific theme in your CSS */
[data-zen-theme="terminal"] .sidebar { display: none; }
[data-zen-tier="generative"] h1      { font-size: 3rem; }
```

---

## Writing themes

### Tier 1 — Token theme

No CSS file needed. Just override variables in your manifest:

```json
{
  "id": "neon-noir",
  "name": "Neon Noir",
  "tier": "token",
  "swatch": { "bg": "#0a0010", "accent": "#ff00aa" },
  "tokens": {
    "--zen-color-bg":    "#0a0010",
    "--zen-color-text":  "#e8d4ff",
    "--zen-color-accent":"#ff00aa",
    "--zen-font-body":   "\"Segoe UI\", sans-serif"
  }
}
```

### Tier 2 — Layer theme

Add a `stylesheet` field pointing to a CSS file. The engine wraps it in `@layer zen.theme` automatically — no need for `!important`:

```json
{
  "id": "terminal",
  "tier": "layer",
  "tokens": { "...": "..." },
  "stylesheet": "/themes/terminal/theme.css"
}
```

See [`themes/terminal/theme.css`](themes/terminal/theme.css) for a working example (scanlines, blinking cursor, monospace everything).

### Tier 4 — Generative theme

Export a `generate(seed)` function that returns a CSS string. Same seed = same output, always.

```js
// themes/my-generator/generator.js
export function generate(seed) {
  // deterministic from seed
  const hue = hashToRange(seed, 0, 360);
  return `
    :root {
      --zen-color-bg:    hsl(${hue}, 10%, 97%);
      --zen-color-accent:hsl(${hue}, 70%, 45%);
    }
  `;
}
```

```json
{
  "id": "my-gen",
  "tier": "generative",
  "generator": "/themes/my-generator/generator.js",
  "seed": "optional-default-seed"
}
```

See [`themes/generative/generator.js`](themes/generative/generator.js) for the full implementation using a mulberry32 PRNG to deterministically pick palette, type stack, and layout.

---

## Dark mode

Zen has two layers of dark mode support that work together:

### CSS-only auto-dark (zero JS)

`tokens.css` includes a `@media (prefers-color-scheme: dark)` block inside `@layer base`. Any site that includes `tokens.css` and builds against `--zen-*` variables gets automatic dark mode with no JavaScript at all. The override only applies when no explicit theme has been chosen (`[data-zen-theme]` is not set).

### Engine-driven variant switching

Themes can declare a `darkVariant` (and `lightVariant`) in the manifest pointing to their dark/light counterpart:

```json
{
  "id": "default",
  "darkVariant": "default-dark",
  "tokens": { "..." }
},
{
  "id": "default-dark",
  "lightVariant": "default",
  "tokens": { "--zen-color-bg": "#111111", "..." }
}
```

When `systemColorScheme: true` (the default), the engine:
- Applies the `darkVariant` automatically on load if the OS is in dark mode and no explicit preference is stored
- Watches for OS changes at runtime and switches instantly
- Never overwrites an explicit user choice (URL param or localStorage takes precedence)

To opt out:

```js
const zen = new Zen({ systemColorScheme: false });
```

## Token reference

The full contract is defined in [`themes/tokens.css`](themes/tokens.css). Key tokens:

| Token | Default | Description |
|-------|---------|-------------|
| `--zen-color-bg` | `#ffffff` | Page background |
| `--zen-color-surface` | `#f5f5f5` | Cards, code blocks |
| `--zen-color-text` | `#111111` | Body text |
| `--zen-color-muted` | `#666666` | Captions, secondary |
| `--zen-color-accent` | `#0070f3` | Links, CTAs |
| `--zen-color-border` | `#e0e0e0` | Dividers |
| `--zen-font-body` | `system-ui` | Body font stack |
| `--zen-font-heading` | `inherit` | Heading font stack |
| `--zen-font-mono` | `monospace` | Code font stack |
| `--zen-font-size-base` | `1rem` | Root size |
| `--zen-line-height` | `1.6` | Body leading |
| `--zen-max-width` | `68ch` | Prose column width |
| `--zen-space-unit` | `1rem` | Spacing base |
| `--zen-radius` | `6px` | Border radius |
| `--zen-transition` | `150ms ease` | Transition shorthand |

Colour tokens are registered with `@property` so browsers can transition between them smoothly — theme switches animate even without the View Transitions API.

---

## Browser support

| Feature | Support | Notes |
|---------|---------|-------|
| CSS Custom Properties | All modern browsers | Universal |
| CSS `@layer` | Chrome 99+, Firefox 97+, Safari 15.4+ | Safe for production |
| `@property` typed tokens | Chrome 85+, Firefox 120+, Safari 16.4+ | Graceful fallback |
| Web Components | All modern browsers | `<zen-switcher>` |
| View Transitions | Chrome 111+, Edge 111+ | Progressive enhancement — no-op elsewhere |

---

## Project structure

```
zen_throwback/
├── src/
│   ├── zen.js            # Core engine — zero dependencies
│   └── zen-switcher.js   # <zen-switcher> Web Component
├── themes/
│   ├── tokens.css        # Design token contract + base layout
│   ├── manifest.json     # Example manifest with 7 themes
│   ├── manifest.schema.json
│   ├── default/          # (token-only, no CSS file)
│   ├── terminal/         # Tier 2 — CRT green aesthetic
│   ├── brutalist/        # Tier 2 — raw borders, typographic extremes
│   ├── newspaper/        # Tier 2 — CSS columns, drop caps
│   └── generative/       # Tier 4 — PRNG palette + type + layout
│       └── generator.js
├── demo/
│   └── index.html        # Live demo (run with `npm run dev`)
├── SPEC.md               # Full protocol specification
└── package.json
```

---

## The bigger picture

The interesting question is whether the `rel="zen-manifest"` convention becomes a community standard — like OpenGraph or `rel="canonical"` — that browser extensions can hook into. A Stylus-style extension that reads the manifest on any page and applies your global preferred theme would complete the vision: **you choose how the web looks, and it looks that way everywhere**.

See [`SPEC.md`](SPEC.md) for the full protocol specification.

---

## Contributing

Themes, bug fixes, and spec improvements welcome. To add a theme:

1. Create a folder under `themes/`
2. Add a CSS file (Tier 2) or JS generator (Tier 4) if needed
3. Add an entry to `themes/manifest.json`
4. Test with `npm run dev`

---

## License

MIT
