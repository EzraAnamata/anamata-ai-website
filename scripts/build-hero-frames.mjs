/**
 * build-hero-frames.mjs — Anna hero asset pipeline (site v2, slice S2)
 *
 * Turns the local, uncommitted Anna source art into the shipped hero assets:
 *
 *   1. A 33-frame source GIF (wireframe → human, 600x900) → 33 WebP frames
 *      public/anna/frame-00.webp … frame-32.webp, consumed by AnnaScrub.astro
 *      as a scroll-scrubbed sequence. Total kept ≤ 2.0MB (tokens.imagery).
 *   2. A static split-face portrait PNG (1024x1536, 2:3) → the reduced-motion /
 *      no-JS / small-viewport fallback public/anna/anna-split-face.webp (≤200KB).
 *
 * PRIVACY / PROVENANCE
 *   - The source GIF (~13MB) and the source PNG are NEVER committed; they live
 *     outside the repo under ~/Coding/Anamata/. Only the derived WebP assets are
 *     committed — they are the shipped artifact (plan S2).
 *   - sharp writes no EXIF/XMP/ICC metadata unless asked to, so every output is
 *     metadata-stripped by construction (privacy scrub for the portrait too).
 *
 * USAGE
 *   node scripts/build-hero-frames.mjs <source.gif> [<split-face-source.png>]
 *
 *   Arg 1 (required): path to the 33-frame source GIF.
 *   Arg 2 (optional): path to the split-face portrait PNG. If omitted, the
 *     tallest portrait-orientation PNG in the GIF's directory is used, so the
 *     source filename never needs to be hard-coded here.
 *
 * Re-run after new source art lands (asset-refinement track). Idempotent:
 * overwrites public/anna/*.webp in place.
 */
import sharp from 'sharp';
import { readdirSync, mkdirSync, writeFileSync, statSync } from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const OUT = path.join(ROOT, 'public', 'anna');

const FRAME_COUNT = 33; // the sanctioned Anna sequence: frames 0..32
const FRAME_W = 600;
const FRAME_H = 900;
const FRAME_BUDGET = 2_000_000; // ≤2.0MB total across all frames
const FALLBACK_BUDGET = 200 * 1024; // ≤200KB for the static portrait

// Seam-heal (frames only): the source art carries a thin blue-teal artifact
// down the exact vertical midline, visible once the skin resolves. Heal the
// narrow midline band by linearly interpolating across the flanks — but ONLY
// where a pixel deviates from the local skin, so ordinary detail is untouched
// and the wireframe frames (band ≈ flanks) are left alone.
const SEAM_BAND = 3; // ±3px → the 6px midline band that gets inspected
const SEAM_FLANK = 6; // 6px reference strip on each side of the band
const SEAM_THRESHOLD = 50; // sum-abs RGB deviation vs flank mean; skin p50≈24, seam ≫90

function die(msg) {
  console.error(`\n  build-hero-frames: ${msg}\n`);
  process.exit(1);
}

/** Locate the split-face source without hard-coding its (Dutch) filename. */
async function findSplitFacePng(gifPath, explicit) {
  if (explicit) return explicit;
  const dir = path.dirname(path.resolve(gifPath));
  const pngs = readdirSync(dir)
    .filter((f) => f.toLowerCase().endsWith('.png'))
    .map((f) => path.join(dir, f));
  let best = null;
  let bestArea = 0;
  for (const p of pngs) {
    try {
      const { width, height } = await sharp(p).metadata();
      // the split-face portrait is tall (2:3); skip square/landscape marks/logos
      if (height > width && width * height > bestArea) {
        best = p;
        bestArea = width * height;
      }
    } catch {
      /* not a readable image — skip */
    }
  }
  if (!best) die('no portrait-orientation PNG found next to the GIF; pass it as arg 2');
  return best;
}

/**
 * Heal the midline seam in place on a raw RGB(A) frame buffer. For each row,
 * take the mean of the flank strips on either side of the band; every band
 * pixel that deviates from the flank mean beyond the threshold is replaced by
 * a linear interpolation between the two flank means (positioned by column).
 * Only the SEAM_BAND columns are ever touched — nothing else can change.
 */
function healSeam(data, w, h, ch) {
  const mid = Math.floor(w / 2);
  const idx = (x, y) => (y * w + x) * ch;
  const leftRefX = mid - SEAM_BAND - 1; // inner edge of the left flank
  const rightRefX = mid + SEAM_BAND; // inner edge of the right flank
  for (let y = 0; y < h; y++) {
    const L = [0, 0, 0];
    const R = [0, 0, 0];
    for (let x = mid - SEAM_BAND - SEAM_FLANK; x <= mid - SEAM_BAND - 1; x++) {
      const o = idx(x, y);
      L[0] += data[o]; L[1] += data[o + 1]; L[2] += data[o + 2];
    }
    for (let x = mid + SEAM_BAND; x <= mid + SEAM_BAND + SEAM_FLANK - 1; x++) {
      const o = idx(x, y);
      R[0] += data[o]; R[1] += data[o + 1]; R[2] += data[o + 2];
    }
    for (let c = 0; c < 3; c++) { L[c] /= SEAM_FLANK; R[c] /= SEAM_FLANK; }
    const m0 = (L[0] + R[0]) / 2, m1 = (L[1] + R[1]) / 2, m2 = (L[2] + R[2]) / 2;
    for (let x = mid - SEAM_BAND; x <= mid + SEAM_BAND - 1; x++) {
      const o = idx(x, y);
      const dev = Math.abs(data[o] - m0) + Math.abs(data[o + 1] - m1) + Math.abs(data[o + 2] - m2);
      if (dev <= SEAM_THRESHOLD) continue; // leave ordinary skin/detail alone
      const t = (x - leftRefX) / (rightRefX - leftRefX);
      data[o] = Math.round(L[0] * (1 - t) + R[0] * t);
      data[o + 1] = Math.round(L[1] * (1 - t) + R[1] * t);
      data[o + 2] = Math.round(L[2] * (1 - t) + R[2] * t);
    }
  }
}

async function encodeFrames(gifPath) {
  // Probe the GIF's page count so we fail loudly if the source isn't 33 frames.
  const meta = await sharp(gifPath, { animated: true }).metadata();
  const pages = meta.pages ?? 1;
  if (pages !== FRAME_COUNT) {
    die(`source GIF has ${pages} frames, expected ${FRAME_COUNT} — wrong source?`);
  }

  // Extract + seam-heal each frame ONCE as raw pixels, then reuse across the
  // quality search (raw extraction is the expensive part).
  const raws = [];
  for (let i = 0; i < FRAME_COUNT; i++) {
    const { data, info } = await sharp(gifPath, { page: i })
      .resize(FRAME_W, FRAME_H, { fit: 'cover' })
      .raw()
      .toBuffer({ resolveWithObject: true });
    healSeam(data, info.width, info.height, info.channels);
    raws.push({ data, info });
  }

  // Encode from high to low quality until the whole sequence fits the budget.
  for (const quality of [82, 78, 74, 70, 66, 60, 55, 50]) {
    let total = 0;
    const buffers = [];
    for (const { data, info } of raws) {
      const buf = await sharp(data, {
        raw: { width: info.width, height: info.height, channels: info.channels },
      })
        .webp({ quality, effort: 6 })
        .toBuffer();
      buffers.push(buf);
      total += buf.length;
    }
    if (total <= FRAME_BUDGET) {
      buffers.forEach((buf, i) =>
        writeFileSync(path.join(OUT, `frame-${String(i).padStart(2, '0')}.webp`), buf)
      );
      return { quality, total };
    }
    console.log(`  q${quality}: ${(total / 1e6).toFixed(2)}MB over budget, retrying lower…`);
  }
  die('could not fit 33 frames under 2.0MB even at q50 — check the source');
}

async function encodeFallback(pngPath) {
  for (const quality of [86, 80, 74, 68, 62, 56, 50]) {
    const buf = await sharp(pngPath)
      .resize(FRAME_W, FRAME_H, { fit: 'cover' })
      .webp({ quality, effort: 6 })
      .toBuffer(); // sharp emits no metadata by default → EXIF/XMP stripped
    if (buf.length <= FALLBACK_BUDGET) {
      writeFileSync(path.join(OUT, 'anna-split-face.webp'), buf);
      return { quality, size: buf.length };
    }
  }
  die('could not fit the split-face fallback under 200KB — check the source');
}

async function main() {
  const gifPath = process.argv[2];
  if (!gifPath) die('usage: node scripts/build-hero-frames.mjs <source.gif> [<split-face.png>]');
  const pngPath = await findSplitFacePng(gifPath, process.argv[3]);

  mkdirSync(OUT, { recursive: true });

  console.log(`  frames  ← ${gifPath}`);
  const frames = await encodeFrames(gifPath);
  console.log(`  frames  → public/anna/frame-00..32.webp  (q${frames.quality}, ${(frames.total / 1e6).toFixed(2)}MB total)`);

  console.log(`  fallback ← <split-face source, ${statSync(pngPath).size} bytes, not committed>`);
  const fb = await encodeFallback(pngPath);
  console.log(`  fallback → public/anna/anna-split-face.webp  (q${fb.quality}, ${(fb.size / 1024).toFixed(0)}KB)`);
}

main().catch((e) => die(e?.message ?? String(e)));
