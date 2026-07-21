/**
 * build-og-image.mjs — compose the 1200×630 social card (og:image).
 *
 * Source is the IN-REPO, already-metadata-stripped signature portrait
 * (public/anna/anna-split-face.webp, the wireframe→human split-face) plus the
 * outlined brand wordmark (public/anamata-ai-logo.svg). NOTHING is generated via
 * Higgsfield (credit-gated, Ezra approval only) and the original source PNG (with
 * its Dutch filename) is never read or referenced here — the card is fully
 * reproducible from committed, scrubbed assets via `npm run og` (pure Node, no
 * browser, no committed font binaries, no network).
 *
 * The card is the site in miniature: brand-white graph paper, navy ink, the
 * split-face portrait, one primary-blue kicker, and the "on the record" line.
 * Output PNG carries no EXIF/XMP (sharp does not copy input metadata unless
 * asked; we never ask).
 *
 * TYPE: the real brand glyphs (Poppins 200/600, IBM Plex Mono 600) are converted
 * to SVG <path> outlines with opentype.js reading the @fontsource WOFF files, so
 * sharp/librsvg rasterises actual brand letterforms. (librsvg silently ignores
 * data-URI @font-face — a card built that way is DejaVu fallback, not Poppins —
 * so we must NOT rely on @font-face here; paths are the mechanism.)
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import opentype from 'opentype.js';

const ROOT = path.resolve(import.meta.dirname, '..');
const OUT = path.join(ROOT, 'public', 'og-image.png');
const PORTRAIT = path.join(ROOT, 'public', 'anna', 'anna-split-face.webp');

const W = 1200;
const H = 630;
const PORTRAIT_W = 456; // right column width
const TEXT_X = 72; // left text margin

// --- tokens (kept in sync with design-tokens.json; card is a static asset) ---
const PAPER = '#FAFAFA';
const INK = '#041524';
const PRIMARY = '#2C548C';
const MUTED = '#5A7080';
const GRID = 'rgba(4, 21, 36, 0.06)';

// --- fonts as glyph outlines (opentype.js reads the @fontsource WOFF files) ---
const font = (rel) => {
  const buf = readFileSync(path.join(ROOT, 'node_modules', rel));
  return opentype.parse(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength));
};
const poppins200 = font('@fontsource/poppins/files/poppins-latin-200-normal.woff');
const poppins600 = font('@fontsource/poppins/files/poppins-latin-600-normal.woff');
const mono600 = font('@fontsource/ibm-plex-mono/files/ibm-plex-mono-latin-600-normal.woff');

/**
 * Render a string to a single SVG <path> of glyph outlines, baseline at (x, y).
 * Per-glyph advance gives predictable letter-spacing (em) for the tracked mono
 * lines; opentype's @font-face-free path output is what librsvg can actually
 * rasterise.
 */
function textPath(f, text, x, y, size, { fill, letterSpacing = 0 } = {}) {
  const ls = letterSpacing * size;
  let cursor = x;
  const d = [];
  for (const ch of text) {
    const glyph = f.charToGlyph(ch);
    // Integer pen position: opentype.js can emit a NaN control point for curved
    // glyphs (C/O/R…) placed at fractional offsets, and librsvg then silently
    // renders the path only up to the NaN — truncating the line. Rounding avoids
    // it (and is crisper); the NaN guard below makes any recurrence fail loudly.
    d.push(glyph.getPath(Math.round(cursor), y, size).toPathData(2));
    cursor += (glyph.advanceWidth / f.unitsPerEm) * size + ls;
  }
  const data = d.join(' ');
  if (data.includes('NaN')) {
    throw new Error(`OG text path has NaN for ${JSON.stringify(text)} — refusing to ship a truncated card`);
  }
  return `<path d="${data}" fill="${fill}"/>`;
}

// outlined wordmark → rasterise to a known height so it never depends on fonts
const logoBuf = await sharp(path.join(ROOT, 'public', 'anamata-ai-logo.svg'))
  .resize({ height: 44 })
  .png()
  .toBuffer();
const logoMeta = await sharp(logoBuf).metadata();
const logoDataUri = `data:image/png;base64,${logoBuf.toString('base64')}`;

const overlay = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs>
    <pattern id="grid" width="32" height="32" patternUnits="userSpaceOnUse">
      <path d="M32 0 H0 V32" fill="none" stroke="${GRID}" stroke-width="1"/>
    </pattern>
  </defs>

  <rect width="${W}" height="${H}" fill="${PAPER}"/>
  <rect width="${W}" height="${H}" fill="url(#grid)"/>

  <!-- brand wordmark (outlined paths, rasterised) -->
  <image x="${TEXT_X}" y="70" width="${logoMeta.width}" height="${logoMeta.height}" href="${logoDataUri}"/>

  <!-- mono kicker -->
  ${textPath(mono600, 'EMPLOYEE #001 · ON THE RECORD', TEXT_X, 228, 20, { fill: PRIMARY, letterSpacing: 0.08 })}

  <!-- display headline (Poppins ExtraLight, sentence-case as shipped) -->
  ${textPath(poppins200, 'Anna,', TEXT_X, 312, 78, { fill: INK })}
  ${textPath(poppins200, 'your digital AI assistant', TEXT_X, 392, 54, { fill: INK })}

  <!-- supporting line (Poppins 600) -->
  ${textPath(poppins600, 'An AI colleague in Microsoft Teams —', TEXT_X, 452, 23, { fill: MUTED })}
  ${textPath(poppins600, 'bounded, human-approved, on the record.', TEXT_X, 484, 23, { fill: MUTED })}

  <!-- record line (mono) -->
  ${textPath(mono600, 'ANAMATA.AI · EU AI ACT §50 · THE SITE IS ITS OWN EVIDENCE', TEXT_X, 560, 15, { fill: INK, letterSpacing: 0.06 })}
</svg>`;

const portrait = await sharp(PORTRAIT)
  .resize({ width: PORTRAIT_W, height: H, fit: 'cover', position: 'top' })
  .toBuffer();

await sharp({ create: { width: W, height: H, channels: 4, background: PAPER } })
  .composite([
    { input: Buffer.from(overlay), top: 0, left: 0 },
    { input: portrait, top: 0, left: W - PORTRAIT_W },
    // 2px ink rule dividing the text zone from the portrait
    {
      input: Buffer.from(
        `<svg xmlns="http://www.w3.org/2000/svg" width="2" height="${H}"><rect width="2" height="${H}" fill="${INK}"/></svg>`
      ),
      top: 0,
      left: W - PORTRAIT_W,
    },
  ])
  .png()
  .toFile(OUT);

console.log(`og-image.png written (${W}x${H}) — Poppins/Plex glyphs as paths + split-face portrait`);
