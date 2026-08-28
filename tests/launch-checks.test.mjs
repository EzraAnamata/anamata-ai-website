/**
 * Launch checks for anamata.ai v1 (Taiga #342).
 *
 * These tests run against the built site in dist/ and define "done":
 *  - every page in the design-brief page table exists and is well-formed
 *  - the Art. 50 transparency notice is on every page (EU AI Act DoD)
 *  - the operating-record ledger is REAL (derived from this repo's git
 *    history, never fabricated) and is crawlable text, not JS-injected
 *  - the record strip is on every page
 *  - no request leaves the origin (self-hosted fonts — GDPR)
 *  - semantic HTML basics hold (one h1, landmarks, no dead internal links)
 *  - design tokens in CSS match design-tokens.json (tokens are law)
 *  - the deploy workflow only ships through the human-approved
 *    'production' environment (the approval gate)
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync, existsSync, statSync } from 'node:fs';
import { execSync } from 'node:child_process';
import path from 'node:path';
import fg from 'fast-glob';
import { parseHTML } from 'linkedom';
import YAML from 'yaml';
import { MODULES, FIELD_MAX, worstCaseHrefLength } from '../src/lib/offerte.mjs';

const ROOT = path.resolve(import.meta.dirname, '..');
const DIST = path.join(ROOT, 'dist');

const PAGES = {
  home: 'index.html',
  about: 'about/index.html',
  insights: 'insights/index.html',
  contact: 'contact/index.html',
  configurator: 'configurator/index.html',
};

// /approach and /anna became meta-refresh redirect stubs in S5 (their content
// folded into /about). Stubs are not content pages — they carry no §50 notice,
// record strip or <main> — so the "every page" assertions must skip them.
const isRedirectStub = (html) => /http-equiv=["']?refresh/i.test(html);

const TOKENS = JSON.parse(readFileSync(path.join(ROOT, 'design-tokens.json'), 'utf8'));

function page(rel) {
  const file = path.join(DIST, rel);
  const html = readFileSync(file, 'utf8');
  const { document } = parseHTML(html);
  return { html, document };
}

let allPages = [];
beforeAll(() => {
  allPages = fg
    .sync('**/*.html', { cwd: DIST })
    .filter((p) => p !== '404.html')
    .filter((p) => !isRedirectStub(readFileSync(path.join(DIST, p), 'utf8')));
});

describe('pages exist (design-brief page table)', () => {
  for (const [name, rel] of Object.entries(PAGES)) {
    it(`${name} page is built at /${rel}`, () => {
      expect(existsSync(path.join(DIST, rel)), `${rel} missing`).toBe(true);
    });
  }

  it('at least one insights article is built', () => {
    const articles = fg.sync('insights/*/index.html', { cwd: DIST });
    expect(articles.length).toBeGreaterThanOrEqual(1);
  });

  it('sitemap and robots.txt are built', () => {
    expect(existsSync(path.join(DIST, 'sitemap-index.xml'))).toBe(true);
    expect(existsSync(path.join(DIST, 'robots.txt'))).toBe(true);
  });

  it('sitemap lists the configurator page', () => {
    const urls = fg
      .sync('sitemap-*.xml', { cwd: DIST })
      .map((f) => readFileSync(path.join(DIST, f), 'utf8'))
      .join('');
    expect(urls, 'configurator missing from sitemap').toContain('anamata.ai/configurator');
  });

  it('sitemap lists /about and excludes the redirected /anna and /approach', () => {
    const sm = readFileSync(path.join(DIST, 'sitemap-0.xml'), 'utf8');
    expect(sm, 'sitemap should list /about').toContain('anamata.ai/about');
    expect(sm, 'sitemap must not list the redirected /anna').not.toContain('anamata.ai/anna');
    expect(sm, 'sitemap must not list the redirected /approach').not.toContain(
      'anamata.ai/approach'
    );
  });
});

describe('Art. 50 transparency notice — mandatory on every page', () => {
  it('every built page carries the transparency notice', () => {
    expect(allPages.length).toBeGreaterThan(0);
    for (const rel of allPages) {
      const { html } = page(rel);
      expect(html, `${rel}: missing §50 notice glyph`).toContain('§50');
      expect(html, `${rel}: missing Art. 50 notice text`).toMatch(/EU AI ACT/i);
      expect(html, `${rel}: notice must mention human review`).toMatch(/human/i);
    }
  });

  it('every page carries machine-readable AI-provenance meta (Art. 50(2))', () => {
    expect(allPages.length).toBeGreaterThan(0);
    for (const rel of allPages) {
      const { document } = page(rel);
      const meta = document.querySelector('meta[name="ai-generated"]');
      expect(meta, `${rel}: missing ai-generated meta`).toBeTruthy();
      expect(meta.getAttribute('content')).toMatch(/true/);
    }
  });
});

describe('the operating record is real and crawlable', () => {
  it('record strip is present on every page', () => {
    expect(allPages.length).toBeGreaterThan(0);
    for (const rel of allPages) {
      const { document } = page(rel);
      expect(
        document.querySelector('.record-strip'),
        `${rel}: missing record strip`
      ).toBeTruthy();
    }
  });

  it('about ledger entries are real git commits from this repo (never fabricated)', () => {
    // S8 (#368): the live operating record moved off home to /about.
    const { document } = page(PAGES.about);
    const entries = [...document.querySelectorAll('.ledger .entry')];
    expect(entries.length).toBeGreaterThanOrEqual(3);

    const subjects = execSync('git log --format=%s', { cwd: ROOT, encoding: 'utf8' })
      .trim()
      .split('\n');
    const hashes = execSync('git log --format=%h', { cwd: ROOT, encoding: 'utf8' })
      .trim()
      .split('\n');

    // every non-deploy ledger entry must correspond to a real commit
    const ledgerText = entries.map((e) => e.textContent).join('\n');
    const matched = hashes.filter((h) => ledgerText.includes(h));
    expect(
      matched.length,
      'ledger entries must reference real commit hashes from this repo'
    ).toBeGreaterThanOrEqual(Math.min(3, subjects.length));
  });

  it('ledger contains no demo/fabricated data from the checkpoint', () => {
    const { html } = page(PAGES.about);
    // sentinels from the checkpoint's demo ledger — must never ship
    for (const demo of ['research-agent', 'build #142', '“keyword brief', 'keyword brief:']) {
      expect(html, `fabricated checkpoint data leaked: ${demo}`).not.toContain(demo);
    }
  });

  it('AI-authored commits are marked as AI in the ledger (docs/authorship.md)', () => {
    // convention active from the first Otto commit onward; conditional so the
    // suite stays meaningful on pre-convention checkouts
    const ottoCommits = execSync('git log --author="^Otto$" --format=%h -n 6', {
      cwd: ROOT,
      encoding: 'utf8',
    })
      .trim()
      .split('\n')
      .filter(Boolean);
    if (ottoCommits.length === 0) return;
    const { html, document } = page(PAGES.about);
    const ledgerText = document.querySelector('.ledger').textContent;
    // if any of the 6 newest ledger entries is Otto's, the AI marker must render
    if (ottoCommits.some((h) => ledgerText.includes(h))) {
      expect(html).toContain('AI · ON RECORD');
    }
  });

  it('ledger is server-rendered text, present without JavaScript', () => {
    const { document } = page(PAGES.about);
    const entries = document.querySelectorAll('.ledger .entry');
    for (const e of entries) {
      expect(e.textContent.trim().length).toBeGreaterThan(10);
    }
  });
});

describe('S11 — data-boundary block in the governance file (#380.5-7)', () => {
  // Claims are sourced to anna-assistant repo docs (claim discipline, spec §2);
  // each maps to a documented, enforced behaviour — see the PR body.
  it('the data-boundary block sits inside A004 (the governance file)', () => {
    const { document } = page(PAGES.about);
    const gov = document.querySelector('#governance');
    expect(gov, 'governance section A004 must exist').toBeTruthy();
    const block = gov.querySelector('.data-boundary');
    expect(block, 'data-boundary block must live inside A004').toBeTruthy();
  });

  it('states what is NOT shared with the model in a shared session (#380.5)', () => {
    const { document } = page(PAGES.about);
    const text = document.querySelector('#governance .data-boundary').textContent;
    expect(text).toContain('PRIVATE CONTEXT STAYS OUT OF SHARED SESSIONS');
    expect(text).toMatch(/never (placed|put) in the AI model/i);
  });

  it('states per-person context isolation (#380.6)', () => {
    const { document } = page(PAGES.about);
    const text = document.querySelector('#governance .data-boundary').textContent;
    expect(text).toContain("EACH PERSON'S CONTEXT IS ISOLATED");
    expect(text).toMatch(/not reachable from another/i);
  });

  it('states per-person context access control (#380.7)', () => {
    const { document } = page(PAGES.about);
    const text = document.querySelector('#governance .data-boundary').textContent;
    expect(text).toContain('ACCESS IS SET PER PERSON');
    expect(text).toMatch(/assigned per person/i);
  });

  it('A004 is otherwise intact (rings + gate + §50 unaffected)', () => {
    const { document, html } = page(PAGES.about);
    const gov = document.querySelector('#governance');
    // the permission ring model and the approval-gate stamp still render
    expect(gov.textContent).toContain('permission ring');
    expect(gov.querySelector('.stamp')?.textContent).toContain('HUMAN APPROVED');
    // the sitewide Art. 50 (§50) notice is untouched on /about
    expect(html).toContain('§50');
    expect(html).toMatch(/EU AI ACT/i);
  });
});

describe('privacy — nothing leaves the origin (GDPR)', () => {
  it('no page references external origins (fonts self-hosted, no CDNs, no trackers)', () => {
    const files = fg.sync('**/*.{html,css}', { cwd: DIST });
    expect(files.length).toBeGreaterThan(0);
    for (const rel of files) {
      const content = readFileSync(path.join(DIST, rel), 'utf8');
      // resources the browser auto-loads: src attrs, <link href>, css url()
      const srcRefs = content.match(/\ssrc=["']https?:\/\/[^"']+["']/g);
      const linkRefs = content.match(/<link[^>]+href=["']https?:\/\/[^"']+["']/g);
      const cssRefs = content.match(/url\(\s*["']?https?:\/\/[^)"']+/g);
      const external = [...(srcRefs || []), ...(linkRefs || []), ...(cssRefs || [])]
        // own production origin (canonical/og links) is not an external request
        .filter((ref) => !ref.includes('https://anamata.ai'));
      expect(external, `${rel}: external resource refs: ${external}`).toEqual([]);
      expect(content, `${rel}: Google Fonts CDN reference`).not.toContain('fonts.googleapis.com');
      expect(content, `${rel}: gstatic reference`).not.toContain('fonts.gstatic.com');
    }
  });
});

describe('semantic HTML (structural prep for #343)', () => {
  it('every page has exactly one h1, a main landmark and lang attribute', () => {
    expect(allPages.length).toBeGreaterThan(0);
    for (const rel of allPages) {
      const { document } = page(rel);
      expect(document.querySelectorAll('h1').length, `${rel}: h1 count`).toBe(1);
      expect(document.querySelector('main'), `${rel}: missing <main>`).toBeTruthy();
      expect(document.documentElement.getAttribute('lang'), `${rel}: lang`).toBe('en');
      expect(document.querySelector('title')?.textContent?.length).toBeGreaterThan(5);
      expect(
        document.querySelector('meta[name="description"]'),
        `${rel}: missing meta description`
      ).toBeTruthy();
    }
  });

  it('no dead internal links', () => {
    expect(allPages.length).toBeGreaterThan(0);
    for (const rel of allPages) {
      const { document } = page(rel);
      const links = [...document.querySelectorAll('a[href^="/"]')].map((a) =>
        a.getAttribute('href').split('#')[0]
      );
      for (const href of links) {
        if (!href || href === '/') continue;
        const clean = href.replace(/\/$/, '');
        const target = [
          path.join(DIST, clean, 'index.html'),
          path.join(DIST, clean),
          path.join(DIST, `${clean}.html`),
        ].some(existsSync);
        expect(target, `${rel}: dead link ${href}`).toBe(true);
      }
    }
  });

  it('reduced motion is honored (show-final-state strategy in CSS)', () => {
    const cssFiles = fg.sync('**/*.{css,html}', { cwd: DIST });
    const all = cssFiles.map((f) => readFileSync(path.join(DIST, f), 'utf8')).join('');
    expect(all).toContain('prefers-reduced-motion');
  });
});

describe('tokens are law', () => {
  it('built CSS carries the exact token palette', () => {
    const files = fg.sync('**/*.{css,html}', { cwd: DIST });
    const all = files.map((f) => readFileSync(path.join(DIST, f), 'utf8')).join('').toUpperCase();
    for (const [role, hex] of [
      ['paper', TOKENS.colors.background],
      ['ink', TOKENS.colors.text],
      ['primary', TOKENS.colors.primary],
      ['coral', TOKENS.colors.secondary],
      ['sky', TOKENS.colors.accent],
      ['approval teal', TOKENS.colors.semantic.success],
    ]) {
      expect(all, `token color missing from built CSS: ${role} ${hex}`).toContain(
        hex.toUpperCase()
      );
    }
  });

  it('token fonts are used (v2: Poppins + IBM Plex Mono)', () => {
    const files = fg.sync('**/*.{css,html}', { cwd: DIST });
    const all = files.map((f) => readFileSync(path.join(DIST, f), 'utf8')).join('');
    for (const family of ['Poppins', 'IBM Plex Mono']) {
      expect(all, `font family missing: ${family}`).toContain(family);
    }
  });

  it('the v1 fonts are gone everywhere in the built site (no Newsreader, no Public Sans)', () => {
    const files = fg.sync('**/*.{css,html,woff,woff2,ttf}', { cwd: DIST });
    for (const rel of files) {
      // filename check catches font files; content check catches @font-face / stacks
      expect(rel, `${rel}: Newsreader font file leaked`).not.toMatch(/newsreader/i);
      expect(rel, `${rel}: Public Sans font file leaked`).not.toMatch(/public-sans/i);
      if (/\.(css|html)$/.test(rel)) {
        const content = readFileSync(path.join(DIST, rel), 'utf8');
        expect(content, `${rel}: Newsreader reference`).not.toMatch(/Newsreader/i);
        expect(content, `${rel}: Public Sans reference`).not.toMatch(/Public\s*Sans/i);
      }
    }
  });
});

describe('v2 brand logo (creator metadata scrubbed)', () => {
  // #415: the wordmark refresh Bas sent via Teams ships as a PNG (1798x388).
  // The privacy scrub is a rule about the ASSET, not about SVG — editors stamp
  // themselves into PNG text chunks exactly as they do into SVG metadata, so the
  // assertion below follows whichever format the header actually references.
  const LOGO_CANDIDATES = ['anamata-ai-logo.png', 'anamata-ai-logo.svg'];

  const shippedLogo = () => {
    const { html } = page(PAGES.home);
    return LOGO_CANDIDATES.find((rel) => html.includes(rel));
  };

  it('the brand logo ships and is referenced by the header', () => {
    const rel = shippedLogo();
    expect(rel, `header references none of: ${LOGO_CANDIDATES.join(', ')}`).toBeTruthy();
    expect(existsSync(path.join(ROOT, 'public', rel)), 'public logo missing').toBe(true);
    expect(existsSync(path.join(DIST, rel)), 'built logo missing').toBe(true);
  });

  it('the logo carries no creator metadata or editor cruft (privacy scrub)', () => {
    const rel = shippedLogo();
    const file = path.join(ROOT, 'public', rel);

    if (rel.endsWith('.svg')) {
      const svg = readFileSync(file, 'utf8');
      for (const forbidden of [
        'Michel',
        'Created by',
        'sodipodi',
        'inkscape',
        '<metadata',
        'docname',
      ]) {
        expect(svg, `logo still contains "${forbidden}"`).not.toContain(forbidden);
      }
      return;
    }

    // PNG: parse the chunk list rather than substring-scanning the file — the
    // compressed pixel data would false-positive on short words at random.
    const buf = readFileSync(file);
    const chunks = [];
    let i = 8;
    while (i < buf.length) {
      const len = buf.readUInt32BE(i);
      const type = buf.toString('latin1', i + 4, i + 8);
      chunks.push(type);
      i += 12 + len;
      if (type === 'IEND') break;
    }
    for (const t of ['tEXt', 'iTXt', 'zTXt', 'eXIf', 'tIME']) {
      expect(chunks, `logo PNG still carries a ${t} metadata chunk`).not.toContain(t);
    }
  });

  it('the header reserves the wordmark box so the logo cannot shift layout (CLS)', () => {
    const { document } = page(PAGES.home);
    const img = document.querySelector('header .wordmark img');
    expect(img, 'header wordmark img missing').toBeTruthy();
    const w = Number(img.getAttribute('width'));
    const h = Number(img.getAttribute('height'));
    expect(w > 0 && h > 0, 'wordmark must carry intrinsic width/height').toBe(true);
  });
});

describe('contrast pairs (computed WCAG ratios, not hand-math)', () => {
  const srgb = (c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  const luminance = (hex) => {
    const h = hex.replace('#', '');
    const [r, g, b] = [0, 2, 4].map((i) => srgb(parseInt(h.slice(i, i + 2), 16) / 255));
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  const ratio = (a, b) => {
    const l1 = luminance(a);
    const l2 = luminance(b);
    return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
  };
  const { colors } = TOKENS;
  const paper = colors.background;

  it('text-safe colors clear AA (4.5:1) on paper', () => {
    for (const [role, hex] of [
      ['ink', colors.text],
      ['primary', colors.primary],
      ['textMuted', colors.textMuted],
      ['approval teal', colors.semantic.success],
    ]) {
      expect(ratio(hex, paper), `${role} ${hex} on paper is ${ratio(hex, paper).toFixed(2)}:1`).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('coral clears large-text/UI (3.0:1) with white — buttons only, never body text', () => {
    expect(ratio(colors.secondary, '#FFFFFF')).toBeGreaterThanOrEqual(3.0);
  });

  it('sky is a non-text highlight only — it fails as text on paper (documents the reservation)', () => {
    expect(ratio(colors.accent, paper)).toBeLessThan(4.5);
  });
});

describe('S2 — Anna hero asset pipeline (frames + static fallback)', () => {
  const ANNA = path.join(ROOT, 'public', 'anna');
  const FRAME_COUNT = 33; // 0..32, the sanctioned Anna wireframe→human sequence
  const FRAME_BUDGET = 2_000_000; // ≤2.0MB total (tokens.imagery / plan S2)
  const FALLBACK_BUDGET = 200 * 1024; // static split-face ≤200KB

  const frameName = (i) => `frame-${String(i).padStart(2, '0')}.webp`;

  it('all 33 scroll-scrub frames exist and are non-empty WebP', () => {
    for (let i = 0; i < FRAME_COUNT; i++) {
      const f = path.join(ANNA, frameName(i));
      expect(existsSync(f), `${frameName(i)} missing — run scripts/build-hero-frames.mjs`).toBe(true);
      const buf = readFileSync(f);
      expect(buf.length, `${frameName(i)} is empty`).toBeGreaterThan(0);
      // RIFF/WEBP magic
      expect(buf.slice(0, 4).toString('ascii'), `${frameName(i)} not RIFF`).toBe('RIFF');
      expect(buf.slice(8, 12).toString('ascii'), `${frameName(i)} not WEBP`).toBe('WEBP');
    }
  });

  it('there is no stray 34th frame (exactly the sanctioned sequence)', () => {
    expect(existsSync(path.join(ANNA, frameName(FRAME_COUNT))), 'extra frame present').toBe(false);
  });

  it('total frame bytes stay within the ≤2.0MB budget', () => {
    let total = 0;
    for (let i = 0; i < FRAME_COUNT; i++) total += statSync(path.join(ANNA, frameName(i))).size;
    expect(total, `frames total ${(total / 1e6).toFixed(2)}MB > 2.0MB budget`).toBeLessThanOrEqual(FRAME_BUDGET);
  });

  it('static split-face fallback exists, is WebP, and is ≤200KB', () => {
    const f = path.join(ANNA, 'anna-split-face.webp');
    expect(existsSync(f), 'anna-split-face.webp missing').toBe(true);
    const buf = readFileSync(f);
    expect(buf.slice(0, 4).toString('ascii')).toBe('RIFF');
    expect(buf.slice(8, 12).toString('ascii')).toBe('WEBP');
    expect(buf.length, `fallback ${(buf.length / 1024).toFixed(0)}KB > 200KB`).toBeLessThanOrEqual(FALLBACK_BUDGET);
  });

  it('the fallback carries no EXIF/XMP metadata (privacy scrub)', () => {
    const buf = readFileSync(path.join(ANNA, 'anna-split-face.webp'));
    // WebP metadata lives in EXIF/XMP RIFF chunks; XMP payloads carry the Adobe namespace
    expect(buf.includes(Buffer.from('EXIF')), 'fallback still has an EXIF chunk').toBe(false);
    expect(buf.includes(Buffer.from('http://ns.adobe.com/xap/')), 'fallback still has XMP').toBe(false);
  });
});

describe('S2 — AnnaScrub component (fallbacks + CLS reservation)', () => {
  const src = path.join(ROOT, 'src', 'components', 'AnnaScrub.astro');

  it('the component exists', () => {
    expect(existsSync(src), 'src/components/AnnaScrub.astro missing').toBe(true);
  });

  it('renders the static split-face fallback as default markup (no-JS path)', () => {
    const s = readFileSync(src, 'utf8');
    expect(s, 'fallback image not referenced').toContain('/anna/anna-split-face.webp');
  });

  it('reserves the portrait box with explicit dimensions (CLS 0)', () => {
    const s = readFileSync(src, 'utf8');
    // the 600x900 frame box must be reserved so no layout shift occurs
    expect(s).toMatch(/width=["']600["']/);
    expect(s).toMatch(/height=["']900["']/);
  });

  it('drives the scrub from the frame sequence', () => {
    const s = readFileSync(src, 'utf8');
    expect(s, 'frame sequence path not referenced').toMatch(/\/anna\/frame-/);
  });

  it('honors reduced motion and no-JS (static-final-state fallback)', () => {
    const s = readFileSync(src, 'utf8');
    expect(s, 'no reduced-motion guard').toContain('prefers-reduced-motion');
  });

  it('falls back to the static portrait below 760px (no rotation)', () => {
    const s = readFileSync(src, 'utf8');
    expect(s, 'no <760px guard').toMatch(/760/);
  });

  it('rotates on scroll via CSS 3D transform (perspective + rotateY), not a 3D runtime', () => {
    const s = readFileSync(src, 'utf8');
    expect(s).toMatch(/perspective\(1200px\)/);
    expect(s).toMatch(/rotateY/);
  });
});

describe('S3 — home rebuilt as the film (scenes 0–004)', () => {
  it('scenes are numbered H001–H004 in order in the marginalia (S9 FITS + S10a MEET)', () => {
    // S8 (#368): HOW (autonomy) and PROOF (ledger) moved to /about. S9 (spec
    // §1.4/§4.1) lands a FITS strip between WHAT and EXIT; S10a (spec §1.5/§4.1)
    // appends the Meet-Anna form at the page end. Numbering follows on-page order
    // AS BUILT and is gapless at every deploy (§1): rebased, the sequence is
    // hero → what (H001) → fits (H002) → exit (H003) → meet (H004).
    // Per-page prefixed numbering (Ezra 2026-07-21).
    const { document } = page(PAGES.home);
    const nums = [...document.querySelectorAll('.marginalia .no')].map((n) => n.textContent.trim());
    expect(nums, 'scene marginalia numbering/order').toEqual(['H001', 'H002', 'H003', 'H004']);
  });

  it('scene 0 hero: mono kicker + a text H1 (LCP-eligible), no CTA buttons in the scrub stage', () => {
    const { document } = page(PAGES.home);
    const hero = document.querySelector('.anna-scrub');
    expect(hero, 'AnnaScrub hero missing').toBeTruthy();
    expect(hero.textContent, 'EMPLOYEE #001 kicker missing').toContain('EMPLOYEE #001');
    // H1 is the LCP element and must be real text, not an image.
    const h1 = document.querySelector('h1');
    expect(h1, 'hero h1 missing').toBeTruthy();
    expect(h1.querySelector('img'), 'h1 must be text, not an image (LCP-eligible text)').toBeFalsy();
    expect(h1.textContent.trim().length, 'h1 has no text').toBeGreaterThan(0);
    // no CTA buttons inside the scrub stage (they'd fight the scrub).
    expect(hero.querySelectorAll('a.btn, button').length, 'no CTAs inside the scrub stage').toBe(0);
  });

  it('scene 001: demo ledger entries are present and visibly labeled as examples', () => {
    const { document } = page(PAGES.home);
    const demo = document.querySelector('.demo-ledger');
    expect(demo, 'demo ledger missing').toBeTruthy();
    expect(
      demo.querySelectorAll('.demo-entry').length,
      'demo entries missing'
    ).toBeGreaterThanOrEqual(3);
    // must clearly disclaim being the real operating record.
    expect(demo.textContent, 'demo entries not labeled as examples').toMatch(/example/i);
    expect(demo.textContent, 'demo must disclaim being the real record').toMatch(
      /not the (live |operating )?record/i
    );
    // demo entries must NEVER masquerade as real ledger entries.
    expect(
      demo.querySelectorAll('.ledger .entry').length,
      'demo must not be structured as the real ledger'
    ).toBe(0);
  });

  it('S8: the HOW/autonomy section and the live ledger are gone from home', () => {
    const { document } = page(PAGES.home);
    expect(document.querySelector('.how-rows'), 'HOW section must move off home').toBeFalsy();
    expect(document.querySelector('.ledger .entry'), 'live ledger must move off home').toBeFalsy();
  });

  it('S8: home still routes to the record on /about (the what points at the proof)', () => {
    const { document } = page(PAGES.home);
    const main = document.querySelector('main');
    expect(
      main.querySelectorAll('a[href^="/about"]').length,
      'home must link to /about where the record now lives'
    ).toBeGreaterThan(0);
  });

  it('hero band + exit: coral primary is SEE ANNA IN ACTION → #meet-anna; the exit quote demotes to secondary', () => {
    // S10b (§1.1/§1.5/§4.1): home's ONE coral primary is the hero exit band
    // (below the scrub stage) — so the FIRST a.btn.hot on the page is now
    // "SEE ANNA IN ACTION" → the Meet-Anna form, not the configurator quote.
    const { document, html } = page(PAGES.home);
    const hot = document.querySelector('a.btn.hot');
    expect(hot, 'hero coral primary missing').toBeTruthy();
    expect(hot.getAttribute('href'), 'hero coral must jump to the Meet-Anna form').toBe(
      '#meet-anna'
    );
    expect(hot.textContent, 'hero coral label').toMatch(/see anna in action/i);
    // the exit quote is now the secondary variant (§1.5): btn, never btn hot.
    const ghostQuote = document.querySelector('a.btn.secondary[href="/configurator"]');
    expect(ghostQuote, 'exit quote must demote to secondary on home').toBeTruthy();
    expect(ghostQuote.textContent, 'demoted quote keeps its label').toMatch(/request a quote/i);
    const secondary = document.querySelector('a.btn.secondary[href="/contact"]');
    expect(secondary, 'secondary contact CTA missing').toBeTruthy();
    expect(html, 'tech@ lead line missing').toContain('tech@anamata.ai');
    expect(
      document.querySelectorAll('.teaser-card').length,
      'module teaser cards missing'
    ).toBe(MODULES.length);
  });

  it('exactly one button-hot on the home film (max one coral ask per viewport)', () => {
    // Rule unchanged (§4.1); post-S10b the single referent is the hero primary.
    const { document } = page(PAGES.home);
    expect(document.querySelectorAll('a.btn.hot, button.hot').length).toBe(1);
  });

  it('nav CTA is the quote ask (REQUEST A QUOTE → /configurator)', () => {
    const { document } = page(PAGES.home);
    const cta = document.querySelector('header nav a.btn');
    expect(cta, 'nav CTA missing').toBeTruthy();
    expect(cta.getAttribute('href'), 'nav CTA must link the configurator').toBe('/configurator');
    expect(cta.textContent, 'nav CTA label').toMatch(/request a quote/i);
  });

  it('the persistent record strip is present on the home film', () => {
    const { document } = page(PAGES.home);
    expect(document.querySelector('.record-strip'), 'record strip missing on home').toBeTruthy();
  });
});

describe('configurator (/configurator) — order form in ledger grammar (S4)', () => {
  it('lists every orderable module', () => {
    const { document } = page(PAGES.configurator);
    const rows = [...document.querySelectorAll('.module-row')];
    expect(rows.length, 'one card-stock row per module').toBe(MODULES.length);
    const text = document.querySelector('main').textContent;
    for (const m of MODULES) {
      expect(text, `module "${m.name}" not present`).toContain(m.name);
    }
  });

  it('each module row has a square checkbox stamp control', () => {
    const { document } = page(PAGES.configurator);
    const boxes = document.querySelectorAll('.module-row input[type="checkbox"]');
    expect(boxes.length, 'a checkbox per module').toBe(MODULES.length);
  });

  it('shows NO prices anywhere on the page (gefaseerd — offerte only)', () => {
    const { document } = page(PAGES.configurator);
    // user-visible content only — the "$" in bundled JS template literals is
    // not a price, so we scan rendered text, not the raw script/style source
    const html = document.querySelector('main').textContent;
    const forbidden = [
      /[€$£]/,
      /\bEUR\b/i,
      /\bprijs/i,
      /\bprijzen/i,
      /\bprice/i,
      /\bpricing/i,
      /\btarief/i,
      /per\s+maand/i,
      /per\s+month/i,
      /\/mo\b/i,
    ];
    for (const re of forbidden) {
      expect(re.test(html), `price signal matched ${re} on the configurator page`).toBe(false);
    }
  });

  it('has the offerte contact fields and a button-hot submit CTA', () => {
    const { document } = page(PAGES.configurator);
    const form = document.querySelector('form.offerte-form');
    expect(form, 'offerte form missing').toBeTruthy();
    for (const name of ['name', 'org', 'email', 'note']) {
      expect(
        form.querySelector(`[name="${name}"]`),
        `field "${name}" missing`
      ).toBeTruthy();
    }
    const submit = form.querySelector('button[type="submit"]');
    expect(submit, 'submit button missing').toBeTruthy();
    expect(submit.textContent).toMatch(/request a quote/i);
    expect(submit.className, 'submit must use the button-hot style').toMatch(/\bhot\b/);
  });

  it('files via mailto only — no backend, no third-party endpoint', () => {
    const { document, html } = page(PAGES.configurator);
    const form = document.querySelector('form.offerte-form');
    // a client-side mailto flow posts nowhere: no form action, no method=post
    expect(form.getAttribute('action'), 'form must not POST to a backend').toBeFalsy();
    // the plain-email fallback puts the destination mailto in the page
    expect(html, 'mailto mechanism not present').toContain('mailto:');
  });

  it('renders the submission confirmation as a ledger entry', () => {
    const { document } = page(PAGES.configurator);
    const confirm = document.querySelector('.offerte-confirmation.ledger');
    expect(confirm, 'confirmation ledger block missing').toBeTruthy();
    expect(confirm.querySelector('.entry'), 'confirmation entry missing').toBeTruthy();
    expect(confirm.querySelector('.stamp'), 'confirmation stamp missing').toBeTruthy();
  });

  it('picks mirror into a live order-record ledger column', () => {
    const { document } = page(PAGES.configurator);
    const record = document.querySelector('.order-record.ledger');
    expect(record, 'order-record ledger column missing').toBeTruthy();
    expect(record.querySelector('.ledger-head'), 'order-record head missing').toBeTruthy();
  });

  it('caps every field so the worst-case mailto URL stays under ~1900 chars', () => {
    const { document } = page(PAGES.configurator);
    const form = document.querySelector('form.offerte-form');
    for (const [name, max] of Object.entries(FIELD_MAX)) {
      const field = form.querySelector(`[name="${name}"]`);
      expect(
        Number(field.getAttribute('maxlength')),
        `field "${name}" must cap at ${max}`
      ).toBe(max);
    }
    expect(worstCaseHrefLength(), 'worst-case mailto exceeds practical limit').toBeLessThan(1900);
  });
});

describe('deploy approval gate (reused later by AI employee #1)', () => {
  const wfPath = path.join(ROOT, '.github/workflows/deploy.yml');

  it('deploy workflow exists and parses', () => {
    expect(existsSync(wfPath)).toBe(true);
    expect(() => YAML.parse(readFileSync(wfPath, 'utf8'))).not.toThrow();
  });

  it('the deploy job runs only behind the production environment gate', () => {
    const wf = YAML.parse(readFileSync(wfPath, 'utf8'));
    const deploy = wf.jobs?.deploy;
    expect(deploy, 'deploy job missing').toBeTruthy();
    const env = typeof deploy.environment === 'string' ? deploy.environment : deploy.environment?.name;
    expect(env, 'deploy job must be bound to the production environment').toBe('production');
  });

  it('deploy requires build+tests to pass first and never runs on pull requests', () => {
    const wf = YAML.parse(readFileSync(wfPath, 'utf8'));
    const deploy = wf.jobs.deploy;
    expect(deploy.needs, 'deploy must depend on a test/build job').toBeTruthy();
    const on = wf.on ?? wf[true]; // YAML 1.1 quirk: bare `on:` may parse as boolean true
    const triggers = typeof on === 'string' ? [on] : Object.keys(on);
    expect(triggers, 'deploy workflow must not trigger on pull_request').not.toContain(
      'pull_request'
    );
  });
});

describe('S5 — /about consolidation', () => {
  it('about states anamata.ai is part of Anamata', () => {
    const { html } = page(PAGES.about);
    expect(html).toContain('part of Anamata');
  });

  it('about explains the site is AI-run — the CIO/CTO second-look page', () => {
    const { html } = page(PAGES.about);
    expect(html, 'missing run-by-AI framing').toMatch(/run by AI/i);
    expect(html, 'missing second-look framing').toMatch(/second look/i);
    expect(html, 'missing CIO reference').toContain('CIO');
    expect(html, 'missing CTO reference').toContain('CTO');
  });

  it('about carries the personnel cards, the rings diagram and a condensed transparency notice', () => {
    const { document } = page(PAGES.about);
    expect(
      document.querySelectorAll('.card').length,
      'personnel cards missing'
    ).toBeGreaterThanOrEqual(3);
    expect(document.querySelector('.rings-svg'), 'rings diagram missing').toBeTruthy();
    expect(
      document.querySelector('.notice.condensed'),
      'condensed transparency notice missing'
    ).toBeTruthy();
  });
});

describe('S5 — old routes redirect to /about', () => {
  for (const old of ['approach', 'anna']) {
    it(`/${old} is a meta-refresh redirect stub pointing at /about`, () => {
      const file = path.join(DIST, old, 'index.html');
      expect(existsSync(file), `${old}/index.html missing`).toBe(true);
      const html = readFileSync(file, 'utf8');
      expect(isRedirectStub(html), `${old}: no meta refresh`).toBe(true);
      expect(html, `${old}: does not target /about`).toMatch(/\/about/);
    });
  }
});

describe('S5 — nav and footer shape', () => {
  it('header nav: About replaces Anna/Approach; team → /about#team, insights and offerte CTA kept', () => {
    const { document } = page(PAGES.about);
    const nav = document.querySelector('header nav');
    const hrefs = [...nav.querySelectorAll('a')].map((a) => a.getAttribute('href'));
    expect(hrefs, 'About link missing from header').toContain('/about');
    // S3: personnel cards moved to /about, so the stale /#personnel anchor now
    // points at the /about team section.
    expect(hrefs, 'The team link should point at /about#team').toContain('/about#team');
    expect(hrefs, 'stale home personnel anchor still present').not.toContain('/#personnel');
    expect(hrefs, 'Insights link changed').toContain('/insights');
    expect(hrefs, 'Anna link not removed from header').not.toContain('/anna');
    expect(hrefs, 'Approach link not removed from header').not.toContain('/approach');
    const cta = nav.querySelector('a.btn');
    // S3: the nav CTA is now the offerte ask, not REQUEST A DEMO.
    expect(cta?.textContent, 'nav CTA should be the quote ask').toMatch(/request a quote/i);
    expect(cta?.getAttribute('href'), 'nav CTA must link the configurator').toBe('/configurator');
  });

  it('footer nav: ABOUT replaces ANNA/APPROACH; tech@ second-lead channel present', () => {
    const { document, html } = page(PAGES.about);
    const fnav = document.querySelector('footer nav');
    const hrefs = [...fnav.querySelectorAll('a')].map((a) => a.getAttribute('href'));
    expect(hrefs, 'ABOUT link missing from footer').toContain('/about');
    expect(hrefs, 'ANNA link not removed from footer').not.toContain('/anna');
    expect(hrefs, 'APPROACH link not removed from footer').not.toContain('/approach');
    expect(html, 'tech@ second-lead channel line missing').toContain('tech@anamata.ai');
  });
});

describe('S6 — launch QA', () => {
  // ---- Item 4: Art. 50 transparency present & cited on every content page ----
  it('every page cites EU AI Act Article 50 in its machine-readable provenance meta', () => {
    expect(allPages.length).toBeGreaterThan(0);
    for (const rel of allPages) {
      const { document } = page(rel);
      const meta = document.querySelector('meta[name="ai-generated"]');
      expect(meta, `${rel}: missing ai-generated meta`).toBeTruthy();
      expect(
        meta.getAttribute('content'),
        `${rel}: provenance meta must cite Art. 50`
      ).toMatch(/art\.?\s*50/i);
    }
  });

  it('the human-readable §50 notice names Article 50 on every content page', () => {
    for (const rel of allPages) {
      const { html } = page(rel);
      expect(html, `${rel}: notice must name Article 50`).toMatch(/ART\.?\s*50/i);
    }
  });

  // ---- Item 5: OG image (1200x630, metadata-stripped) wired absolute ----
  describe('OG / social card', () => {
    const OG_REL = 'og-image.png';
    const OG_ABS = 'https://anamata.ai/og-image.png';

    it('the OG image is committed to public/ and built into dist/', () => {
      expect(existsSync(path.join(ROOT, 'public', OG_REL)), 'public OG image missing').toBe(true);
      expect(existsSync(path.join(DIST, OG_REL)), 'built OG image missing').toBe(true);
    });

    it('the OG image is a 1200x630 PNG', () => {
      const buf = readFileSync(path.join(ROOT, 'public', OG_REL));
      // PNG signature + IHDR: width @ byte 16, height @ byte 20 (big-endian u32)
      expect(buf.slice(1, 4).toString('ascii'), 'not a PNG').toBe('PNG');
      const width = buf.readUInt32BE(16);
      const height = buf.readUInt32BE(20);
      expect(width, `OG width ${width}`).toBe(1200);
      expect(height, `OG height ${height}`).toBe(630);
    });

    it('the OG image carries no EXIF/XMP metadata (privacy scrub)', () => {
      const buf = readFileSync(path.join(ROOT, 'public', OG_REL));
      expect(buf.includes(Buffer.from('eXIf')), 'OG image still has an eXIf chunk').toBe(false);
      expect(
        buf.includes(Buffer.from('http://ns.adobe.com/xap/')),
        'OG image still has XMP'
      ).toBe(false);
    });

    it('every content page sets an absolute og:image and a twitter card', () => {
      for (const rel of allPages) {
        const { document } = page(rel);
        const og = document.querySelector('meta[property="og:image"]');
        expect(og, `${rel}: og:image missing`).toBeTruthy();
        expect(og.getAttribute('content'), `${rel}: og:image must be absolute`).toBe(OG_ABS);
        expect(
          document.querySelector('meta[property="og:title"]'),
          `${rel}: og:title missing`
        ).toBeTruthy();
        expect(
          document.querySelector('meta[property="og:url"]')?.getAttribute('content'),
          `${rel}: og:url must be absolute`
        ).toMatch(/^https:\/\/anamata\.ai\//);
        const tw = document.querySelector('meta[name="twitter:card"]');
        expect(tw?.getAttribute('content'), `${rel}: twitter:card`).toBe('summary_large_image');
      }
    });
  });

  // ---- Item 7: token casing prose reconciled to shipped reality ----
  it('the display weightPairing prose documents the shipped sentence-case headings', () => {
    const prose = TOKENS.typography.weightPairing.display;
    expect(prose, 'display prose must acknowledge sentence-case section headings').toMatch(
      /sentence.?case/i
    );
  });

  // ---- Item 3: focus visibility (a11y) ----
  it('a visible keyboard-focus indicator is defined (:focus-visible in built CSS)', () => {
    const files = fg.sync('**/*.{css,html}', { cwd: DIST });
    const all = files.map((f) => readFileSync(path.join(DIST, f), 'utf8')).join('');
    expect(all, 'no :focus-visible focus ring anywhere').toContain(':focus-visible');
  });

  // ---- Item 9: footer / scene-004 tech@ dedupe ----
  it('the tech@ hook line is not duplicated at the home page bottom (footer only)', () => {
    const { html } = page(PAGES.home);
    const matches = html.match(/DRAWN HERE BY HOW THIS SITE RUNS\?/gi) || [];
    expect(
      matches.length,
      `tech@ hook appears ${matches.length}× on home — footer carries it globally, so scene 004 must not repeat it`
    ).toBe(1);
  });

  // ---- Contact addresses (Ezra decision 2026-07-17): no personal address ----
  describe('contact addresses', () => {
    it('the personal address ezrahulsman appears nowhere in the built site', () => {
      const files = fg.sync('**/*.{html,js,mjs,css,xml,txt,svg,json}', { cwd: DIST });
      expect(files.length).toBeGreaterThan(0);
      for (const rel of files) {
        const content = readFileSync(path.join(DIST, rel), 'utf8');
        expect(content, `${rel}: leaks the personal address ezrahulsman`).not.toMatch(
          /ezrahulsman/i
        );
      }
    });

    it('the configurator offerte flow files to offerte@anamata.ai', () => {
      const { html } = page(PAGES.configurator);
      expect(html, 'configurator must use offerte@anamata.ai').toContain(
        'mailto:offerte@anamata.ai'
      );
    });

    it('the contact page general channel is info@anamata.ai', () => {
      const { html } = page(PAGES.contact);
      expect(html, 'contact must use info@anamata.ai').toContain('mailto:info@anamata.ai');
    });

    it('the tech@ channel is unchanged', () => {
      expect(page(PAGES.home).html, 'tech@anamata.ai must remain').toContain('tech@anamata.ai');
    });
  });

  // ---- Item 10: no-mail-client fallback on the two filing pages ----
  for (const [name, rel] of [
    ['contact', PAGES.contact],
    ['configurator', PAGES.configurator],
  ]) {
    it(`${name} renders the plain-email fallback for visitors with no mail client`, () => {
      const { document } = page(rel);
      const main = document.querySelector('main');
      expect(main.textContent, `${name}: 'Prefer plain email?' fallback missing`).toMatch(
        /prefer plain email/i
      );
      const fallbackMailto = [...main.querySelectorAll('a[href^="mailto:"]')];
      expect(
        fallbackMailto.length,
        `${name}: fallback mailto link missing`
      ).toBeGreaterThanOrEqual(1);
    });
  }
});

describe('S7 — delta fixes (persona/channel scrub, coral softening)', () => {
  const scannable = () => fg.sync('**/*.{html,js,mjs,css,xml,txt,svg,json}', { cwd: DIST });

  // #371 — no real company name in the personas
  it('the built site names no real company (Albert Heijn) anywhere', () => {
    const files = scannable();
    expect(files.length).toBeGreaterThan(0);
    for (const rel of files) {
      const content = readFileSync(path.join(DIST, rel), 'utf8');
      expect(content, `${rel}: leaks the Albert Heijn reference`).not.toMatch(
        /albert\s*heijn/i
      );
    }
  });

  it('the persona intro keeps its rhythm but stays generic', () => {
    const { document } = page(PAGES.home);
    const intro = document.querySelector('.first-scene .sec-intro')?.textContent ?? '';
    expect(intro, 'persona intro missing its "drowning in systems" beat').toMatch(
      /drowning in systems/i
    );
    expect(intro, 'persona intro must not name a real company').not.toMatch(/albert\s*heijn/i);
  });

  // #372 — WhatsApp dropped from every channel mention, no Slack replacement
  it('the built site mentions no WhatsApp channel anywhere', () => {
    const files = scannable();
    for (const rel of files) {
      const content = readFileSync(path.join(DIST, rel), 'utf8');
      expect(content, `${rel}: leaks a WhatsApp channel mention`).not.toMatch(/whatsapp/i);
    }
  });

  it('the channels line (now on /about) keeps Teams (live) and Telegram, drops WhatsApp and adds no Slack', () => {
    // S8 (#368): channels/couplings moved off home into the Anna dossier on
    // /about; Telegram is softened (Peter 2026-07-21: Teams first, no Slack).
    const { document } = page(PAGES.about);
    const channelsRow = [...document.querySelectorAll('.dossier-rows .drow')].find((r) =>
      /channels/i.test(r.querySelector('.dk')?.textContent ?? '')
    );
    expect(channelsRow, 'channels row missing').toBeTruthy();
    const text = channelsRow.textContent;
    expect(text, 'Microsoft Teams should stay').toMatch(/Microsoft Teams/);
    expect(text, 'Telegram may stay (softened)').toMatch(/Telegram/);
    expect(text, 'WhatsApp must be gone').not.toMatch(/whatsapp/i);
    expect(text, 'Slack must not be added as a replacement').not.toMatch(/slack/i);
  });

  // #370 — softened coral CTA fill still clears the white-on-coral guardrail
  it('the softened coral fill no longer ships the loud original and keeps AA on white', () => {
    const srgb = (c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
    const luminance = (hex) => {
      const h = hex.replace('#', '');
      const [r, g, b] = [0, 2, 4].map((i) => srgb(parseInt(h.slice(i, i + 2), 16) / 255));
      return 0.2126 * r + 0.7152 * g + 0.0722 * b;
    };
    const ratio = (a, b) => {
      const l1 = luminance(a);
      const l2 = luminance(b);
      return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
    };
    // #415 (Bas 28-08): #E15857 is REINSTATED as the CTA fill. S7 had retired it in
    // favour of #C85F52; Bas asked for it back and that is an authorised design
    // change of record, so this asserts the new intent instead of the old one.
    expect(TOKENS.colors.secondary.toUpperCase()).toBe('#E15857');
    // white-on-coral must still clear AA for the ≥18px bold button label (3:1).
    // #E15857 on white measures 3.66:1, so the guardrail still holds.
    expect(ratio(TOKENS.colors.secondary, '#FFFFFF')).toBeGreaterThanOrEqual(3.0);
    // The CTA fill must actually reach the shipped stylesheet.
    //
    // NOTE: this previously globbed '**/*.css' inside dist/ and had been passing
    // vacuously for its whole life — Astro inlines global.css into <style> blocks,
    // so dist ships ZERO .css files and the expectation ran against an empty
    // string. Reading html too is what makes this assertion mean anything.
    const css = fg
      .sync('**/*.{css,html}', { cwd: DIST })
      .map((f) => readFileSync(path.join(DIST, f), 'utf8'))
      .join('')
      .toUpperCase();
    expect(css, 'the CTA coral never reaches the shipped stylesheet').toContain(
      TOKENS.colors.secondary.toUpperCase()
    );
  });
});

describe('S8 — register ("AI colleague") + structure (home is the "what")', () => {
  // #367 (Peter 2026-07-21): the register is "AI colleague" — NOT "AI employee",
  // NOT "AI PA". The ledger conceit ("EMPLOYEE #001", personnel-file stamps) is a
  // deliberate design element and is intentionally NOT covered by the prose guard
  // below (it matches "EMPLOYEE"/"AI-EMPLOYEE", never the prose "AI employee").
  const prose = () => fg.sync('**/*.{html,js,mjs,xml,txt}', { cwd: DIST });

  it('the register "AI colleague" is present in the shipped prose', () => {
    const files = prose();
    const all = files.map((f) => readFileSync(path.join(DIST, f), 'utf8')).join('');
    expect(all, 'register "AI colleague" not found in built site').toMatch(/AI colleague/i);
  });

  it('the old "AI employee" prose register is gone everywhere (conceit stamps excepted)', () => {
    for (const rel of prose()) {
      const content = readFileSync(path.join(DIST, rel), 'utf8');
      // matches the prose register only ("AI employee"); the ledger conceit uses
      // "EMPLOYEE #001" / "AI-EMPLOYEE" (no bare "AI employee") and is untouched.
      expect(content, `${rel}: stale "AI employee" prose register`).not.toMatch(/\bAI employee/i);
    }
  });

  it('the section-001 heading lands Peter\'s point — work nobody should spend time on', () => {
    const { document } = page(PAGES.home);
    const heading = document.querySelector('.first-scene .sec-title')?.textContent ?? '';
    // accepts the live candidate family (V1/V2/V3) while Peter/Ezra finalize wording
    expect(heading, 'section-001 heading missing the "work nobody should ... time on" family').toMatch(
      /should (spend|waste) time on|manual work/i
    );
  });

  it('the HUMAN APPROVED stamp motif now lives on /about (moved from home)', () => {
    const { html } = page(PAGES.about);
    expect(html, 'HUMAN APPROVED stamp missing from /about').toMatch(/HUMAN APPROVED/i);
  });

  it('the live "commit widget" ledger now renders on /about', () => {
    const { document } = page(PAGES.about);
    expect(
      document.querySelector('.ledger .entry'),
      'the operating-record ledger must render on /about'
    ).toBeTruthy();
  });

  it('About uses per-page prefixed numbering A001–A004 in order', () => {
    // Numbering model (Ezra 2026-07-21): per-page, page-letter prefix, 3-digit.
    const { document } = page(PAGES.about);
    const nums = [...document.querySelectorAll('.marginalia .no')].map((n) => n.textContent.trim());
    expect(nums, 'About marginalia numbering/order').toEqual(['A001', 'A002', 'A003', 'A004']);
  });

  it('About retains Anna\'s end-user disclosure claim through the dossier collapse', () => {
    // F2: collapsing Permission/Oversight/Disclosure must NOT lose the product-
    // level Art-50 claim that Anna identifies herself to end users.
    // whole-page text (the dossier is a <section>, not <main>); normalize the
    // source line-wrap between "first" and "interaction"
    const text = page(PAGES.about).document.body.textContent.replace(/\s+/g, ' ');
    expect(text, 'end-user disclosure ("first interaction") missing').toMatch(/first interaction/i);
    expect(text, 'end-user disclosure must cite Art. 50').toMatch(/art\.?\s*50/i);
  });

  it('the primary CTA is English site-wide — no "VRAAG OFFERTE AAN" anywhere', () => {
    const files = fg.sync('**/*.{html,js,mjs}', { cwd: DIST });
    for (const rel of files) {
      const content = readFileSync(path.join(DIST, rel), 'utf8');
      expect(content, `${rel}: Dutch CTA "VRAAG OFFERTE AAN" still shipped`).not.toMatch(
        /vraag offerte aan/i
      );
    }
  });

  it('the shared CtaBlock exit renders the dual-path ask on the content pages', () => {
    // S10b (§1.5/§4.1): the coral quote stays primary on /about + insights (the
    // ready-to-buy pages, untouched by omission). Home passes quote="secondary",
    // so its quote link is the secondary variant — the coral there is the hero band.
    for (const rel of [PAGES.about, PAGES.insights]) {
      const { document } = page(rel);
      const hot = document.querySelector('a.btn.hot[href="/configurator"]');
      expect(hot, `${rel}: coral quote CTA missing`).toBeTruthy();
      expect(hot.textContent, `${rel}: quote CTA label`).toMatch(/request a quote/i);
      const demo = document.querySelector('a.btn.secondary[href="/contact"]');
      expect(demo, `${rel}: secondary demo CTA missing`).toBeTruthy();
    }
    // Home: the same CtaBlock, quote demoted to secondary (btn, never btn hot).
    // Scope to the .cta-row exit block so the nav's own /configurator link (also
    // a plain btn) can't satisfy this by accident.
    const { document } = page(PAGES.home);
    const homeQuote = document.querySelector('.cta-row a.btn[href="/configurator"]');
    expect(homeQuote, 'home: exit quote link missing').toBeTruthy();
    expect(homeQuote.className, 'home: exit quote must NOT be coral (btn hot)').not.toMatch(
      /\bhot\b/
    );
    expect(homeQuote.textContent, 'home: quote keeps its label').toMatch(/request a quote/i);
    expect(
      document.querySelector('.cta-row a.btn.secondary[href="/contact"]'),
      'home: secondary demo CTA missing'
    ).toBeTruthy();
  });
});

describe('S9 — WHAT pass (question→action pairs + FITS strip)', () => {
  // Spec §1.2: each demo-entry gains the triggering employee question (mono,
  // quoted) AHEAD of the logged action — merge, never replace, the ledger conceit.
  it('every example pairs a quoted employee question ahead of the logged action', () => {
    const { document } = page(PAGES.home);
    const entries = [...document.querySelectorAll('.demo-ledger .demo-entry')];
    expect(entries.length, 'need ≥3 example pairs (spec §1.2 AC)').toBeGreaterThanOrEqual(3);
    for (const e of entries) {
      const kids = [...e.children];
      const ask = e.querySelector('.ask');
      const act = e.querySelector('.act');
      expect(ask, 'each entry needs the triggering employee question').toBeTruthy();
      expect(act, 'each entry keeps the logged action').toBeTruthy();
      // quoted (straight or curly) and rendered mono
      expect(ask.textContent.trim(), 'question must be quoted').toMatch(/^["“].+["”]$/);
      expect(ask.className, 'question must be mono').toMatch(/\bmono\b/);
      // the question must come AHEAD of the action
      expect(kids.indexOf(ask) < kids.indexOf(act), 'question must precede the action').toBe(true);
    }
  });

  // Spec §1.2: DEMO labeling stays exactly as shipped (record-is-never-fabricated).
  it('DEMO labeling survives the pairs — banner + per-entry EXAMPLE stamps intact', () => {
    const { document } = page(PAGES.home);
    const demo = document.querySelector('.demo-ledger');
    expect(demo.getAttribute('aria-label'), 'ledger still framed as illustrative').toMatch(
      /not the live/i
    );
    expect(demo.querySelector('.demo-head .warn')?.textContent, 'DEMO warning banner').toMatch(
      /DEMO/
    );
    const entries = [...demo.querySelectorAll('.demo-entry')];
    const tags = [...demo.querySelectorAll('.demo-entry .tag')];
    expect(tags.length, 'every entry keeps its EXAMPLE stamp').toBe(entries.length);
    for (const t of tags) expect(t.textContent, 'stamp reads EXAMPLE').toMatch(/example/i);
  });

  // Spec §1.4: neither "MCP" nor "Slack" appears anywhere on home.
  //
  // History, so this does not get re-litigated a third time: the Slack ban was
  // briefly relaxed on 28-08 to allow a hedged "coming soon", then reinstated the
  // same day when Bas settled on Teams-only until the #417 POC actually exists.
  // Marketing mentions follow the feature, not the roadmap.
  it('home names no channel/connector jargon — no "MCP", no "Slack"', () => {
    const { html } = page(PAGES.home);
    expect(html, 'home must not name MCP (koppelbaar in plain English only)').not.toMatch(/\bMCP\b/);
    expect(html, 'home must not name Slack (Teams-only until the #417 POC ships)').not.toMatch(
      /slack/i
    );
  });

  // Spec §1.4: one compact FITS strip — Teams today, connectors as koppelbaar,
  // technical depth one click away on /about.
  it('the FITS strip states Teams-today + the connectors and links to /about for depth', () => {
    const { document } = page(PAGES.home);
    const strip = document.querySelector('.fits-strip');
    expect(strip, 'FITS strip missing (spec §1.4)').toBeTruthy();
    const text = strip.textContent;
    expect(text, "Teams named as today's channel").toMatch(/Microsoft Teams/);
    for (const conn of ['ClockWise', 'Loket', 'Remote']) {
      expect(text, `connector ${conn} missing`).toContain(conn);
    }
    const more = strip.querySelector('a[href="/about"], a[href^="/about#"]');
    expect(more, 'FITS must route the technical deep-dive to /about').toBeTruthy();
  });
});

describe('S10a — Meet-Anna form via the shared RequestForm (§1.5)', () => {
  const SRC = path.join(ROOT, 'src');
  const REQUEST_FORM = path.join(SRC, 'components', 'RequestForm.astro');
  const CONTACT_SRC = path.join(SRC, 'pages', 'contact.astro');
  const HOME_SRC = path.join(SRC, 'pages', 'index.astro');
  const CONTACT_FIELDS = ['name', 'org', 'email', 'request'];

  // ---- Step 0: one form, extracted — single source, not copied markup ----
  it('the shared RequestForm component exists', () => {
    expect(existsSync(REQUEST_FORM), 'src/components/RequestForm.astro missing').toBe(true);
  });

  it('the form field markup lives ONLY in the component (no copied markup on the pages)', () => {
    const component = readFileSync(REQUEST_FORM, 'utf8');
    // the discriminating field (the request textarea) must live in the component
    expect(component, 'component missing the request field').toContain('name="request"');
    expect(component, 'component missing the form element').toContain('class="request-form"');
    // and NOT be duplicated inline on either consuming page — they import it
    for (const [label, file] of [['contact', CONTACT_SRC], ['home', HOME_SRC]]) {
      const src = readFileSync(file, 'utf8');
      expect(src, `${label} must import the shared RequestForm`).toMatch(
        /import\s+RequestForm\s+from\s+['"][^'"]*RequestForm\.astro['"]/
      );
      expect(src, `${label} still inlines the form textarea (copied markup)`).not.toContain(
        'name="request"'
      );
      expect(src, `${label} still inlines the form element (copied markup)`).not.toContain(
        'class="request-form"'
      );
    }
  });

  it('CONTACT_EMAIL is threaded to the component as a prop by both consumers', () => {
    for (const [label, file] of [['contact', CONTACT_SRC], ['home', HOME_SRC]]) {
      const src = readFileSync(file, 'utf8');
      expect(src, `${label} must pass CONTACT_EMAIL to RequestForm`).toMatch(/CONTACT_EMAIL=/);
    }
  });

  // ---- Home consumes the same component with contact's field set ----
  it('home renders the shared form with contact\'s minimal field set', () => {
    const { document } = page(PAGES.home);
    const form = document.querySelector('form.request-form');
    expect(form, 'home is not rendering the shared request form').toBeTruthy();
    for (const name of CONTACT_FIELDS) {
      expect(form.querySelector(`[name="${name}"]`), `home form field "${name}" missing`).toBeTruthy();
    }
  });

  // ---- The MEET section ----
  it('the MEET sheet resolves at #meet-anna with header + verbatim subheader', () => {
    const { document } = page(PAGES.home);
    const meet = document.getElementById('meet-anna');
    expect(meet, 'anchor #meet-anna does not resolve on home').toBeTruthy();
    const heading = meet.querySelector('.sec-title')?.textContent?.trim();
    expect(heading, 'MEET heading must be "Meet Anna"').toBe('Meet Anna');
    expect(
      meet.textContent.replace(/\s+/g, ' '),
      'MEET subheader (Bas verbatim) missing'
    ).toContain(
      "Book a short introduction and explore what Anna could take off your team's hands."
    );
    // the shared form lives inside the MEET section
    expect(meet.querySelector('form.request-form'), 'MEET section missing the form').toBeTruthy();
  });

  it('the MEET marginalia label is MEET', () => {
    const { document } = page(PAGES.home);
    const meet = document.getElementById('meet-anna');
    const lbl = meet.querySelector('.marginalia .lbl')?.textContent ?? '';
    expect(lbl, 'MEET marginalia label missing').toMatch(/MEET/i);
  });

  // ---- One-coral law: home's form submit is secondary (secondary), never hot ----
  it('home\'s form submit renders secondary (btn, not btn hot)', () => {
    const { document } = page(PAGES.home);
    const submit = document.querySelector('form.request-form button[type="submit"]');
    expect(submit, 'home form submit missing').toBeTruthy();
    expect(submit.className, 'home form submit must not be coral (btn hot)').not.toMatch(/\bhot\b/);
    expect(submit.className, 'home form submit must carry the btn style').toMatch(/\bbtn\b/);
  });

  it('home still has exactly one coral primary (post-S10b: the hero band)', () => {
    // §4.1 one-hot rule unchanged; the referent moves per slice. Post-S10b the
    // single coral is the hero exit band (SEE ANNA IN ACTION → #meet-anna); the
    // CtaBlock quote is now the secondary variant (§1.5).
    const { document } = page(PAGES.home);
    const hot = [...document.querySelectorAll('a.btn.hot, button.hot')];
    expect(hot.length, 'home must keep exactly one .btn.hot').toBe(1);
    expect(hot[0].getAttribute('href'), 'the one coral is now the hero Meet-Anna primary').toBe(
      '#meet-anna'
    );
  });

  it('home does not reintroduce a live-ledger .entry via the form (record lives on /about)', () => {
    const { document } = page(PAGES.home);
    expect(
      document.querySelector('.ledger .entry'),
      'the form confirmation must not ship as a .ledger .entry on home'
    ).toBeFalsy();
  });

  // ---- The "Explore Anna for your team" secondary link after H001 → #meet-anna ----
  it('an "Explore Anna for your team" secondary link points at #meet-anna', () => {
    const { document } = page(PAGES.home);
    const link = [...document.querySelectorAll('a[href="#meet-anna"]')].find((a) =>
      /explore anna for your team/i.test(a.textContent)
    );
    expect(link, '"Explore Anna for your team" link to #meet-anna missing').toBeTruthy();
    expect(link.className, 'the explore link must be secondary, never coral (btn hot)').not.toMatch(
      /\bhot\b/
    );
  });

  // ---- /contact stays behavior-preserving: its coral submit is untouched ----
  it('/contact keeps its coral (btn hot) submit — untouched by the extraction', () => {
    const { document } = page(PAGES.contact);
    const submit = document.querySelector('form.request-form button[type="submit"]');
    expect(submit, 'contact form submit missing after extraction').toBeTruthy();
    expect(submit.className, 'contact submit must stay coral (btn hot)').toMatch(/\bhot\b/);
  });
});

describe('copy rule: no em-dash in prose (design-tokens.json -> copy.emDash)', () => {
  // Bas, 28-08: the em-dash is the most recognisable AI-writing tell, and this
  // site's whole argument is that it does not read as generated. The rule lives in
  // design-tokens.json under "copy" and is enforced here.
  //
  // This walks TEXT NODES rather than elements, which is what lets the three
  // documented exceptions survive precisely instead of by a blanket class skip:
  //   1. uppercase mono LABEL separators (ledger grammar) — a label sits in its
  //      own text node, so "TRANSPARENCY NOTICE — EU AI ACT, ART. 50" passes while
  //      the sentence beside it in the same <p> is still checked
  //   2. page <title> tags (Name — Descriptor | Brand, for SEO/OG cards)
  //   3. real git commit subjects and approver stamps in the operating record,
  //      generated from history and never edited: the ledger is never fabricated
  const LEDGER_ROW = new Set(['act', 'stamp', 'ts', 'tag', 'agent', 'v', 'role']);
  const SKIP_TAGS = new Set(['TITLE', 'SCRIPT', 'STYLE']);

  const textNodesWithEmDash = (document) => {
    const found = [];
    const walk = (node, ancestry) => {
      for (const child of node.childNodes || []) {
        if (child.nodeType === 3) {
          const text = (child.textContent || '').replace(/\s+/g, ' ');
          if (text.includes('\u2014')) found.push({ text, ancestry });
          continue;
        }
        if (child.nodeType !== 1) continue;
        if (SKIP_TAGS.has(child.tagName)) continue;
        const cls = (child.getAttribute('class') || '').split(/\s+/).filter(Boolean);
        walk(child, [...ancestry, { tag: child.tagName.toLowerCase(), cls }]);
      }
    };
    walk(document.body || document, []);
    return found;
  };

  // a label is text with no lowercase letters at all: that IS the exception
  const isLabel = (text) => !/[a-z]/.test(text);
  const inLedgerRow = (ancestry) =>
    ancestry.some((a) => a.cls.some((c) => LEDGER_ROW.has(c)));

  it('no shipped prose contains an em-dash', () => {
    const offenders = [];
    for (const rel of allPages) {
      const { document } = page(rel);
      for (const { text, ancestry } of textNodesWithEmDash(document)) {
        if (isLabel(text)) continue;
        if (inLedgerRow(ancestry)) continue;
        const i = text.indexOf('\u2014');
        const path = ancestry
          .slice(-2)
          .map((a) => a.tag + (a.cls[0] ? '.' + a.cls[0] : ''))
          .join(' > ');
        offenders.push(`${rel} [${path}]: ...${text.slice(Math.max(0, i - 55), i + 55).trim()}...`);
      }
    }
    expect(offenders, `em-dash found in prose:\n  ${offenders.join('\n  ')}`).toEqual([]);
  });

  it('the documented exceptions really are still present, so the rule is not vacuous', () => {
    // if a future refactor stops rendering labels or the field log, this test
    // would start passing for the wrong reason. Prove the exercised paths exist.
    const { document } = page(PAGES.about);
    const all = textNodesWithEmDash(document);
    expect(all.length, 'no em-dash text nodes at all: the guard has nothing to exempt').toBeGreaterThan(0);
    expect(all.some(({ text }) => isLabel(text)), 'no uppercase label with an em-dash found').toBe(true);
  });

  it('the rule lives in the design system, not only in this test', () => {
    expect(TOKENS.copy, 'design-tokens.json is missing the "copy" section').toBeTruthy();
    expect(TOKENS.copy.emDash, 'copy.emDash rule missing').toMatch(/never use an em-dash/i);
    expect(
      TOKENS.copy.emDashExceptions,
      'the documented exceptions must travel with the rule'
    ).toBeTruthy();
  });
});

describe('S12 — design pass: white ground + centered measure (#415)', () => {
  // Astro inlines global.css into <style> blocks — dist ships no .css files,
  // so the built stylesheet must be read out of the HTML.
  const builtCss = () =>
    fg
      .sync('**/*.{css,html}', { cwd: DIST })
      .map((f) => readFileSync(path.join(DIST, f), 'utf8'))
      .join('\n');

  // Minification can merge selector lists and strip whitespace, so match rules
  // by exact selector membership rather than assuming `.sel {` survives intact.
  const rulesFor = (css, selector) =>
    [...css.matchAll(/([^{}]+)\{([^}]*)\}/g)]
      .filter(([, sel]) => sel.split(',').some((s) => s.trim() === selector))
      .map(([, , body]) => body)
      .join('\n');

  it('the page ground ships as the --paper token value from the spec', () => {
    const css = builtCss();
    expect(
      css,
      `--paper must carry design-tokens.json colors.background (${TOKENS.colors.background})`
    ).toMatch(new RegExp(`--paper:\\s*${TOKENS.colors.background}`, 'i'));
  });

  it('ground and card stock are the same value — the white-ground change of record (Bas 18-08)', () => {
    // #415: the paper ground becomes white, so page and card surface match.
    // Consequence to watch visually: with background == surface, the 1px ink
    // borders, hard offset shadow and punch-holes carry the card boundary alone.
    // The value itself lives in design-tokens.json — tokens are law, not this test.
    expect(TOKENS.colors.background.toUpperCase()).toBe(TOKENS.colors.surface.toUpperCase());
  });

  it('the layout tokens reach the CSS as custom properties', () => {
    const css = builtCss();
    expect(css, '--max-w missing (layout.maxWidth must reach the CSS)').toMatch(
      new RegExp(`--max-w:\\s*${TOKENS.layout.maxWidth}`)
    );
    expect(css, '--content-w missing (layout.contentWidth must reach the CSS)').toMatch(
      new RegExp(`--content-w:\\s*${TOKENS.layout.contentWidth}`)
    );
    // a token nobody consumes is dead weight: --max-w bounds the full-width bands
    expect(css, '--max-w is emitted but never consumed').toMatch(/var\(\s*--max-w\s*\)/);
  });

  it('the ledger sheet stays left-aligned, with the marginalia rule near the edge', () => {
    // Ezra 28-08, superseding the centring introduced earlier the same day.
    // Centring the sheet answered Bas' right-hand whitespace note, but it dragged
    // the marginalia rule inward with it (486px in at 1920px) and the page read as
    // centred rather than left-aligned, which is wrong for a ledger. The rule
    // belongs near the viewport edge; the right-hand gulf is answered by a wider
    // content measure instead, which is affordable because prose caps itself in ch
    // regardless of how wide the column gets (asserted below).
    const sheet = rulesFor(builtCss(), '.sheet');
    expect(sheet, '.sheet rule not found in built CSS').not.toBe('');
    expect(sheet, '.sheet must stay a marginalia + content grid').toMatch(
      /var\(\s*--margin-w\s*\)/
    );
    expect(
      sheet,
      '.sheet must NOT centre itself: that pushes the marginalia rule off the left edge'
    ).not.toMatch(/padding-inline/);
  });

  it('prose keeps its own reading measure independent of the column width', () => {
    // this is what makes a wide content column safe: widening --content-w must
    // never widen running text, or the fix trades one problem for a worse one
    const intro = rulesFor(builtCss(), '.sec-intro');
    expect(intro, '.sec-intro rule not found').not.toBe('');
    expect(intro, '.sec-intro must cap its measure in ch, not inherit the column').toMatch(
      /max-width:\s*\d+(\.\d+)?ch/
    );
  });

  it('the content measure comes from the token, not a hardcoded pixel value', () => {
    const content = rulesFor(builtCss(), '.content');
    expect(content, '.content rule not found in built CSS').not.toBe('');
    expect(content, '.content must take its measure from var(--content-w)').toMatch(
      /max-width:\s*var\(\s*--content-w\s*\)/
    );
  });

  it('the ground is plain everywhere, with no graph-paper texture (Ezra 28-08)', () => {
    // The 32px graph-paper gradients are gone site-wide. Note this was painted in
    // TWO places: the body rule and the hero stage in AnnaScrub.astro, which had
    // its own copy. A body-only assertion passed while the hero still tiled the
    // grid, which is exactly the gap that shipped a "fixed" background still
    // showing grid lines on mobile, where the hero IS the first screen.
    // So this asserts across the whole built stylesheet, not one rule.
    const body = rulesFor(builtCss(), 'body');
    expect(body, 'body rule not found in built CSS').not.toBe('');
    expect(body, 'body must take the plain paper ground').toMatch(
      /background:\s*var\(\s*--paper\s*\)/
    );

    const css = builtCss();
    expect(css, 'the graph-paper gradient is back somewhere in the shipped CSS').not.toMatch(
      /repeating-linear-gradient/
    );
    expect(css, 'a 32px tile is back: that is the graph-paper underlay').not.toMatch(
      /background-size:\s*32px\s+32px/
    );
    expect(css, '--grid is back: nothing should consume a grid colour now').not.toMatch(
      /var\(\s*--grid\s*\)/
    );
  });

  it('the secondary buttons are filled, not transparent (Bas 28-08)', () => {
    // They read as weak on the white ground, so .btn.secondary is now filled with what
    // used to be its border colour. Coral stays exclusive to .btn.hot.
    const secondary = rulesFor(builtCss(), '.btn.secondary');
    expect(secondary, '.btn.secondary rule not found in built CSS').not.toBe('');
    expect(secondary, '.btn.secondary must be filled with --primary').toMatch(
      /background:\s*var\(\s*--primary\s*\)/
    );
    expect(secondary, '.btn.secondary must carry light text').toMatch(/color:\s*var\(\s*--paper\s*\)/);
    expect(secondary, '.btn.secondary must never take the coral fill').not.toMatch(
      /var\(\s*--coral\s*\)/
    );
  });

  it('the teaser cards separate from the white ground, and stay AA for muted text', () => {
    const srgb = (c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
    const lum = (hex) => {
      const h = hex.replace('#', '');
      const [r, g, b] = [0, 2, 4].map((i) => srgb(parseInt(h.slice(i, i + 2), 16) / 255));
      return 0.2126 * r + 0.7152 * g + 0.0722 * b;
    };
    const ratio = (a, b) => {
      const l1 = lum(a);
      const l2 = lum(b);
      return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
    };
    const tint = TOKENS.colors.surfaceSunken;
    expect(tint, 'surfaceSunken token missing').toBeTruthy();
    // it must actually differ from the page ground, or the card has no edge at all
    expect(tint.toUpperCase()).not.toBe(TOKENS.colors.background.toUpperCase());
    // and muted text on the tint must still clear AA — this is the ceiling that
    // rules out the 20-25% ink fill originally suggested (that lands at 3.20:1)
    expect(
      ratio(TOKENS.colors.textMuted, tint),
      `muted text on the card tint is ${ratio(TOKENS.colors.textMuted, tint).toFixed(2)}:1`
    ).toBeGreaterThanOrEqual(4.5);

    const card = rulesFor(builtCss(), '.teaser-card');
    expect(card, '.teaser-card must take the sunken tint, not plain --surface').toMatch(
      /background:\s*var\(\s*--surface-sunken\s*\)/
    );
  });

  it('the hero subline carries no em-dash (Rider A, #374)', () => {
    // Bas 18-08: "maybe remove the — too obvious — em-dash?"
    const { document } = page(PAGES.home);
    const subline = document.querySelector('.anna-scrub .anna-sub')?.textContent ?? '';
    expect(subline, 'hero subline not found — selector drifted, fix the test not the copy').not.toBe('');
    expect(subline, 'hero subline still contains an em-dash').not.toMatch(/\u2014/);
  });
});
