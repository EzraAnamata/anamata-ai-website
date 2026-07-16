/**
 * build-og-image.mjs — compose the 1200×630 social card (og:image).
 *
 * Source is the IN-REPO, already-metadata-stripped signature portrait
 * (public/anna/anna-split-face.webp, the wireframe→human split-face) plus the
 * outlined brand wordmark (public/anamata-ai-logo.svg). NOTHING is generated via
 * Higgsfield (credit-gated, Ezra approval only) and the original source PNG (with
 * its Dutch filename) is never read or referenced here — the card is fully
 * reproducible from committed, scrubbed assets.
 *
 * The card is the site in miniature: brand-white graph paper, navy ink, the
 * split-face portrait, one primary-blue kicker, and the "on the record" line.
 * Output PNG carries no EXIF/XMP (sharp does not copy input metadata unless
 * asked; we never ask). Run: `npm run og` (also part of no build gate — the
 * committed PNG is the shipped asset, like the hero frames).
 *
 * Fonts: Poppins + IBM Plex Mono are embedded into the overlay SVG as base64
 * @font-face data URIs so librsvg (via sharp) renders the real brand type
 * regardless of what is installed system-wide.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

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

const b64 = (rel) => readFileSync(path.join(ROOT, 'node_modules', rel)).toString('base64');
const poppins200 = b64('@fontsource/poppins/files/poppins-latin-200-normal.woff2');
const poppins600 = b64('@fontsource/poppins/files/poppins-latin-600-normal.woff2');
const mono600 = b64('@fontsource/ibm-plex-mono/files/ibm-plex-mono-latin-600-normal.woff2');

// outlined wordmark → rasterise to a known height so it never depends on fonts
const logoBuf = await sharp(path.join(ROOT, 'public', 'anamata-ai-logo.svg'))
  .resize({ height: 44 })
  .png()
  .toBuffer();
const logoMeta = await sharp(logoBuf).metadata();
const logoDataUri = `data:image/png;base64,${logoBuf.toString('base64')}`;

const overlay = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs>
    <style>
      @font-face { font-family:'Poppins'; font-weight:200; src:url(data:font/woff2;base64,${poppins200}) format('woff2'); }
      @font-face { font-family:'Poppins'; font-weight:600; src:url(data:font/woff2;base64,${poppins600}) format('woff2'); }
      @font-face { font-family:'IBM Plex Mono'; font-weight:600; src:url(data:font/woff2;base64,${mono600}) format('woff2'); }
    </style>
    <pattern id="grid" width="32" height="32" patternUnits="userSpaceOnUse">
      <path d="M32 0 H0 V32" fill="none" stroke="${GRID}" stroke-width="1"/>
    </pattern>
  </defs>

  <rect width="${W}" height="${H}" fill="${PAPER}"/>
  <rect width="${W}" height="${H}" fill="url(#grid)"/>

  <!-- brand wordmark (outlined paths, rasterised) -->
  <image x="${TEXT_X}" y="70" width="${logoMeta.width}" height="${logoMeta.height}" href="${logoDataUri}"/>

  <!-- mono kicker -->
  <text x="${TEXT_X}" y="228" font-family="IBM Plex Mono" font-weight="600" font-size="20" letter-spacing="2" fill="${PRIMARY}">EMPLOYEE #001 · ON THE RECORD</text>

  <!-- display headline (Poppins ExtraLight, sentence-case as shipped) -->
  <text x="${TEXT_X}" y="312" font-family="Poppins" font-weight="200" font-size="78" fill="${INK}">Anna,</text>
  <text x="${TEXT_X}" y="392" font-family="Poppins" font-weight="200" font-size="54" fill="${INK}">your digital AI assistant</text>

  <!-- supporting line -->
  <text x="${TEXT_X}" y="452" font-family="Poppins" font-weight="600" font-size="23" fill="${MUTED}">An AI employee in Microsoft Teams —</text>
  <text x="${TEXT_X}" y="484" font-family="Poppins" font-weight="600" font-size="23" fill="${MUTED}">bounded, human-approved, on the record.</text>

  <!-- record line -->
  <text x="${TEXT_X}" y="560" font-family="IBM Plex Mono" font-weight="600" font-size="15" letter-spacing="1.5" fill="${INK}" opacity="0.55">ANAMATA.AI · EU AI ACT §50 · THE SITE IS ITS OWN EVIDENCE</text>

  <!-- 2px ink rule dividing text zone from the portrait -->
  <rect x="${W - PORTRAIT_W}" y="0" width="2" height="${H}" fill="${INK}"/>
</svg>`;

const portrait = await sharp(PORTRAIT)
  .resize({ width: PORTRAIT_W, height: H, fit: 'cover', position: 'top' })
  .toBuffer();

await sharp({ create: { width: W, height: H, channels: 4, background: PAPER } })
  .composite([
    { input: Buffer.from(overlay), top: 0, left: 0 },
    { input: portrait, top: 0, left: W - PORTRAIT_W },
    // redraw the divider on top of the portrait edge
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

console.log(`og-image.png written (${W}x${H}) from anna-split-face.webp + wordmark`);
