# Zen Presentation Layer Protocol — v1 Specification

## Overview

The Zen protocol is a set of lightweight conventions that enable dynamic, user-controlled
restyling of any web page. It is inspired by CSS Zen Garden (2003) but designed for
runtime use, cross-site portability, and progressive adoption.

---

## 1. Discovery

A Zen-enabled page declares its manifest via:

```html
<link rel="zen-manifest" href="/zen-manifest.json">
<meta name="zen:tokens" content="v1">
```

The `rel="zen-manifest"` link points to a manifest file (see §3).
The `meta name="zen:tokens"` tag signals that the page's CSS is built against the
v1 design token contract (see §4), enabling token-only themes to work without
any knowledge of page markup.

---

## 2. User Preference

Theme preference is stored and resolved in this priority order:

1. **URL parameter** — `?zen=<theme-id>` (highest priority; enables shareable links)
2. **localStorage** — key `zen:theme` (cross-session persistence)
3. **Manifest default** — the `default` field in the manifest
4. **First theme** in the manifest array (fallback)

A browser extension implementing this protocol should use a per-origin storage
(e.g. `chrome.storage.local`) keyed by `zen:<origin>:theme`.

---

## 3. Manifest Format

`/zen-manifest.json` (path is configurable):

```json
{
  "version": "1",
  "default": "default",
  "themes": [
    {
      "id": "default",
      "name": "Default",
      "description": "Baseline readable theme.",
      "tier": "token",
      "swatch": { "bg": "#fff", "accent": "#0070f3" },
      "tokens": {
        "--zen-color-bg":    "#ffffff",
        "--zen-color-text":  "#111111",
        "--zen-color-accent":"#0070f3"
      }
    },
    {
      "id": "terminal",
      "name": "Terminal",
      "tier": "layer",
      "swatch": { "bg": "#0d1117", "accent": "#39ff14" },
      "tokens": { "..." },
      "stylesheet": "/themes/terminal/theme.css"
    },
    {
      "id": "procedural",
      "name": "Generative",
      "tier": "generative",
      "swatch": "#888",
      "generator": "/themes/generative/generator.js"
    }
  ]
}
```

Full JSON Schema: `themes/manifest.schema.json`

---

## 4. Design Token Contract (v1)

Sites declare CSS variables on `:root` within `@layer base`. Themes override them.
This is the "interface" that decouples themes from site markup.

### Required tokens (v1)

| Token | Description | Default |
|-------|-------------|---------|
| `--zen-color-bg` | Page background | `#ffffff` |
| `--zen-color-surface` | Cards, sidebars | `#f5f5f5` |
| `--zen-color-text` | Primary body text | `#111111` |
| `--zen-color-muted` | Secondary/caption | `#666666` |
| `--zen-color-accent` | Links, CTAs | `#0070f3` |
| `--zen-color-border` | Dividers | `#e0e0e0` |
| `--zen-font-body` | Body font stack | `system-ui` |
| `--zen-font-heading` | Heading font stack | `inherit` |
| `--zen-font-mono` | Monospace stack | `monospace` |
| `--zen-font-size-base` | Root font size | `1rem` |
| `--zen-line-height` | Body leading | `1.6` |
| `--zen-max-width` | Prose column width | `68ch` |
| `--zen-space-unit` | Spacing base unit | `1rem` |
| `--zen-radius` | Border radius | `6px` |
| `--zen-transition` | Transition shorthand | `150ms ease` |

Additional tokens are defined in `themes/tokens.css` and are optional but recommended.

---

## 5. Theming Tiers

Tiers are progressive — a Level 4 theme can include everything from lower tiers.

### Level 1: Token

Override CSS custom properties only. No stylesheet needed.
Works on **any site** that uses the token contract.

```json
{ "tier": "token", "tokens": { "--zen-color-bg": "#0d1117" } }
```

### Level 2: Layer

Inject a full CSS file into `@layer zen.theme`. This layer sits above the site's
`@layer base` in the cascade, so overrides work cleanly without `!important`.

```json
{ "tier": "layer", "tokens": {…}, "stylesheet": "/themes/my/theme.css" }
```

The engine wraps the fetched CSS in:
```css
@layer zen.theme { /* your CSS here */ }
```

### Level 3: Component

Register Web Component overrides via ES module URLs. Requires the host page to
use **deferred element registration** (do not call `customElements.define()` before
the engine runs). Once an element is registered in the browser, it cannot be
redefined — this is a fundamental platform constraint.

```json
{
  "tier": "component",
  "components": { "zen-card": "/themes/my/card.js" }
}
```

Each module should default-export a class extending `HTMLElement`.

### Level 4: Generative

A JS module that exports a `generate(seed: string): string | Promise<string>` function.
The return value is CSS injected into `@layer zen.theme`.

```json
{
  "tier": "generative",
  "generator": "/themes/gen/generator.js",
  "seed": "optional-default-seed"
}
```

If `seed` is omitted from the manifest, a random seed is generated per page load.
The active seed is stored in `document.documentElement.dataset.zenSeed` and reflected
in the URL param `?zen=random-seed&zen-seed=<value>` (future: v2).

---

## 6. CSS Layer Order

The engine injects the following layer declaration at the earliest possible point in `<head>`:

```css
@layer base, zen.theme;
```

This means:
- Site styles in `@layer base` are overridable by themes
- Theme styles in `@layer zen.theme` win via layer order, not specificity
- No `!important` needed in either direction

---

## 7. Events

The engine is an `EventTarget` and emits CustomEvents on `document`:

| Event | Detail | When |
|-------|--------|------|
| `zen:ready` | `{ manifest }` | After manifest loaded and initial theme applied |
| `zen:change` | `{ theme }` | After each successful theme application |

---

## 8. Data Attributes

The engine sets these attributes on `<html>` after each theme switch:

| Attribute | Value |
|-----------|-------|
| `data-zen-theme` | Theme ID (e.g. `"terminal"`) |
| `data-zen-tier` | Theme tier (e.g. `"layer"`) |
| `data-zen-seed` | Seed value (generative themes only) |

This enables authors to write tier- or theme-specific CSS:

```css
[data-zen-theme="terminal"] .sidebar { display: none; }
[data-zen-tier="generative"] h1 { font-size: 3rem; }
```

---

## 9. View Transitions

When the browser supports the View Transitions API (`document.startViewTransition`),
theme switches are wrapped in a transition for smooth visual continuity.
Disable with `options.transitions = false`.

The base token CSS includes default `::view-transition-*` animations (fade).
Themes can override these to define their own transition personalities.

---

## 10. Adoption Checklist

For site authors who want to support Zen:

- [ ] Add `<link rel="zen-manifest">` and `<meta name="zen:tokens">` to `<head>`
- [ ] Include `themes/tokens.css` (or equivalent `@layer base` token declarations)
- [ ] Build site CSS against `--zen-*` custom properties
- [ ] Create `zen-manifest.json` with at least one theme
- [ ] Optionally: include `<zen-switcher>` for the built-in UI

For theme authors publishing to a community registry (future):

- [ ] Follow the manifest schema (v1)
- [ ] Test at Level 1 (tokens) before adding Level 2+ complexity
- [ ] Include a `swatch` for visual preview
- [ ] Provide `prefers-reduced-motion` support (omit animations or use `--zen-transition: 0ms`)
- [ ] Test with `prefers-color-scheme: dark`

---

## 11. Relation to Existing Standards

| Standard | Relation |
|----------|----------|
| CSS Custom Properties | The token contract builds on this directly |
| CSS `@layer` | Engine uses layer order for clean cascade management |
| View Transitions API | Used for animated theme switching |
| Web Components / Custom Elements | Level 3 theming target |
| `prefers-color-scheme` | Themes should honour this; the engine exposes it as a future hook |
| UserCSS / Stylus | Community convention; Zen adds machine-readable discovery and JS API |
| W3C Design Tokens | Zen tokens are a practical subset; compatible with the draft spec |

---

*Specification version 1.0 — subject to community iteration.*
