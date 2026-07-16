/**
 * design-tokens.json → src/styles/tokens.generated.css
 *
 * Tokens are law: the CSS custom properties the whole site styles against are
 * generated from the binding spec, never hand-edited. Run via pre{dev,build}.
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const t = JSON.parse(readFileSync(path.join(ROOT, 'design-tokens.json'), 'utf8'));

function hexToRgb(hex) {
  const h = hex.replace('#', '');
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)).join(', ');
}

const marginW = (t.components.marginalia.match(/(\d+)px/) || [, '132'])[1];

const css = `/* GENERATED from design-tokens.json — do not edit by hand. */
:root {
  --paper: ${t.colors.background};
  --surface: ${t.colors.surface};
  --ink: ${t.colors.text};
  --ink-rgb: ${hexToRgb(t.colors.text)};
  --text-muted: ${t.colors.textMuted};
  /* v2 palette: primary = the logo's steel-blue (interactive), coral = the ask
     (offerte/contact only), sky = non-text highlight, teal = approval events. */
  --primary: ${t.colors.primary};
  --primary-rgb: ${hexToRgb(t.colors.primary)};
  --coral: ${t.colors.secondary};
  --sky: ${t.colors.accent};
  --sky-rgb: ${hexToRgb(t.colors.accent)};
  --teal-dark: ${t.colors.semantic.success};
  --border: ${t.colors.border};
  --grid: rgba(${hexToRgb(t.colors.text)}, 0.06);
  --hairline: rgba(${hexToRgb(t.colors.text)}, 0.22);
  --margin-w: ${marginW}px;

  --font-display: ${t.typography.fontFamily.display};
  --font-body: ${t.typography.fontFamily.body};
  --font-mono: ${t.typography.fontFamily.mono};

  --radius-btn: ${t.borders.radius.sm};
  --radius-card: ${t.borders.radius.md};
  --border-thin: ${t.borders.width.thin};
  --border-thick: ${t.borders.width.thick};

  --shadow-card: ${t.shadows.sm};

  --dur-fast: ${t.animations.duration.fast};
  --dur-normal: ${t.animations.duration.normal};
  --dur-slow: ${t.animations.duration.slow};
  --ease-default: ${t.animations.easing.default};
  --ease-spring: ${t.animations.easing.spring};
}
`;

mkdirSync(path.join(ROOT, 'src/styles'), { recursive: true });
writeFileSync(path.join(ROOT, 'src/styles/tokens.generated.css'), css);
console.log('tokens.generated.css written from design-tokens.json');
