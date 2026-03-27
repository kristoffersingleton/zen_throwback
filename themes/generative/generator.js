/**
 * Generative Theme — Level 4
 *
 * Exports a `generate(seed)` function that returns a CSS string.
 * The seed is a short string; the same seed always produces the same theme.
 *
 * Algorithm:
 *   1. Hash the seed into a deterministic stream of pseudo-random floats
 *   2. Pick a base hue and derive a full HSL palette
 *   3. Select a type personality (humanist | grotesque | slab | monospace)
 *   4. Select a layout personality (centered | asymmetric | dense | airy)
 *   5. Output CSS custom property overrides + structural tweaks
 */

// ── Deterministic PRNG (mulberry32) ──────────────────────────────────────────

function hashSeed(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = (h * 0x01000193) >>> 0;
  }
  return h;
}

function makePRNG(seed) {
  let state = hashSeed(typeof seed === 'string' ? seed : String(seed));
  return function rand() {
    state |= 0;
    state = state + 0x6d2b79f5 | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = t + Math.imul(t ^ (t >>> 7), 61 | t) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ── Colour generation ─────────────────────────────────────────────────────────

function hsl(h, s, l) {
  return `hsl(${Math.round(h)}, ${Math.round(s)}%, ${Math.round(l)}%)`;
}

function generatePalette(rand) {
  const baseHue = rand() * 360;
  const saturation = 20 + rand() * 60;   // 20–80%
  const isDark = rand() > 0.5;

  // Analogous accent: ±30–120° offset
  const accentOffset = 30 + rand() * 90;
  const accentHue = (baseHue + accentOffset) % 360;
  const accentSat = 50 + rand() * 50;

  if (isDark) {
    return {
      bg:       hsl(baseHue, Math.min(saturation * 0.3, 20), 8 + rand() * 6),
      surface:  hsl(baseHue, Math.min(saturation * 0.3, 20), 13 + rand() * 5),
      text:     hsl(baseHue, 10, 85 + rand() * 10),
      muted:    hsl(baseHue, 15, 55 + rand() * 15),
      accent:   hsl(accentHue, accentSat, 55 + rand() * 20),
      border:   hsl(baseHue, 15, 20 + rand() * 10),
      dark: true,
    };
  } else {
    return {
      bg:       hsl(baseHue, Math.min(saturation * 0.15, 12), 97 - rand() * 5),
      surface:  hsl(baseHue, Math.min(saturation * 0.2, 15), 92 - rand() * 5),
      text:     hsl(baseHue, 10, 8 + rand() * 8),
      muted:    hsl(baseHue, 12, 40 + rand() * 15),
      accent:   hsl(accentHue, accentSat, 30 + rand() * 25),
      border:   hsl(baseHue, 12, 80 + rand() * 10),
      dark: false,
    };
  }
}

// ── Type personality ──────────────────────────────────────────────────────────

const TYPE_PERSONALITIES = [
  {
    name: 'humanist',
    body: 'Optima, Candara, "Segoe UI", system-ui, sans-serif',
    heading: '"Gill Sans", "Gill Sans MT", Calibri, sans-serif',
    sizeBase: '1rem',
    lineHeight: '1.65',
    letterSpacing: '0',
    headingWeight: '600',
  },
  {
    name: 'grotesque',
    body: '"Helvetica Neue", Helvetica, Arial, sans-serif',
    heading: '"Arial Black", "Helvetica Neue", sans-serif',
    sizeBase: '1rem',
    lineHeight: '1.5',
    letterSpacing: '-0.01em',
    headingWeight: '800',
  },
  {
    name: 'slab',
    body: 'Rockwell, "Courier New", Georgia, serif',
    heading: 'Rockwell, "Rockwell Extra Bold", serif',
    sizeBase: '1.05rem',
    lineHeight: '1.6',
    letterSpacing: '0',
    headingWeight: '700',
  },
  {
    name: 'monospace',
    body: '"Fira Code", "Cascadia Code", ui-monospace, monospace',
    heading: 'inherit',
    sizeBase: '0.95rem',
    lineHeight: '1.7',
    letterSpacing: '0',
    headingWeight: '700',
  },
  {
    name: 'serif',
    body: 'Georgia, "Times New Roman", serif',
    heading: '"Palatino Linotype", Palatino, Georgia, serif',
    sizeBase: '1.05rem',
    lineHeight: '1.75',
    letterSpacing: '0',
    headingWeight: '700',
  },
];

// ── Layout personality ────────────────────────────────────────────────────────

const LAYOUT_PERSONALITIES = [
  { name: 'centered',    maxWidth: '65ch',  paddingX: '2rem',  radius: '6px',  spaceUnit: '1rem' },
  { name: 'narrow',     maxWidth: '52ch',  paddingX: '1.5rem', radius: '4px', spaceUnit: '0.9rem' },
  { name: 'wide',       maxWidth: '85ch',  paddingX: '3rem',  radius: '8px',  spaceUnit: '1.1rem' },
  { name: 'dense',      maxWidth: '72ch',  paddingX: '1rem',  radius: '2px',  spaceUnit: '0.8rem' },
  { name: 'airy',       maxWidth: '60ch',  paddingX: '4rem',  radius: '12px', spaceUnit: '1.3rem' },
  { name: 'sharp',      maxWidth: '70ch',  paddingX: '2rem',  radius: '0px',  spaceUnit: '1rem' },
];

// ── Main generator ────────────────────────────────────────────────────────────

/**
 * Generate a CSS string from a seed.
 * @param {string} seed
 * @returns {string} CSS to inject into @layer zen.theme
 */
export function generate(seed) {
  const rand = makePRNG(seed);

  const palette = generatePalette(rand);
  const type = TYPE_PERSONALITIES[Math.floor(rand() * TYPE_PERSONALITIES.length)];
  const layout = LAYOUT_PERSONALITIES[Math.floor(rand() * LAYOUT_PERSONALITIES.length)];

  // Transition speed: fast, normal, slow, or none
  const transitions = ['0ms', '100ms ease', '200ms ease', '300ms cubic-bezier(0.4,0,0.2,1)'];
  const transition = transitions[Math.floor(rand() * transitions.length)];

  // Heading transformation: none, uppercase, or small-caps
  const headingTransforms = ['none', 'uppercase', 'none'];
  const headingTransform = headingTransforms[Math.floor(rand() * headingTransforms.length)];

  // H1 size: between 2.2 and 4.5rem
  const h1size = (2.2 + rand() * 2.3).toFixed(2) + 'rem';

  // Accent decoration style
  const accentStyles = ['solid', 'dashed', 'dotted', 'double'];
  const accentStyle = accentStyles[Math.floor(rand() * accentStyles.length)];

  const css = `
  /* Generative theme — seed: ${seed} */
  /* Personality: ${type.name} type | ${layout.name} layout | ${palette.dark ? 'dark' : 'light'} palette */

  :root {
    --zen-color-bg:        ${palette.bg};
    --zen-color-surface:   ${palette.surface};
    --zen-color-text:      ${palette.text};
    --zen-color-muted:     ${palette.muted};
    --zen-color-accent:    ${palette.accent};
    --zen-color-border:    ${palette.border};

    --zen-font-body:       ${type.body};
    --zen-font-heading:    ${type.heading};
    --zen-font-size-base:  ${type.sizeBase};
    --zen-line-height:     ${type.lineHeight};
    --zen-letter-spacing:  ${type.letterSpacing};

    --zen-max-width:       ${layout.maxWidth};
    --zen-padding-x:       ${layout.paddingX};
    --zen-radius:          ${layout.radius};
    --zen-space-unit:      ${layout.spaceUnit};
    --zen-transition:      ${transition};
  }

  h1, h2, h3, h4 {
    font-weight: ${type.headingWeight};
    text-transform: ${headingTransform};
  }

  h1 { font-size: ${h1size}; }

  a {
    text-decoration-style: ${accentStyle};
  }

  /* Accent border on blockquote */
  blockquote {
    border-left: 4px ${accentStyle} var(--zen-color-accent);
  }
  `;

  return css;
}

export default generate;
