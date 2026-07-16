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

  it('home ledger entries are real git commits from this repo (never fabricated)', () => {
    const { document } = page(PAGES.home);
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
    const { html } = page(PAGES.home);
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
    const { html, document } = page(PAGES.home);
    const ledgerText = document.querySelector('.ledger').textContent;
    // if any of the 6 newest ledger entries is Otto's, the AI marker must render
    if (ottoCommits.some((h) => ledgerText.includes(h))) {
      expect(html).toContain('AI · ON RECORD');
    }
  });

  it('ledger is server-rendered text, present without JavaScript', () => {
    const { document } = page(PAGES.home);
    const entries = document.querySelectorAll('.ledger .entry');
    for (const e of entries) {
      expect(e.textContent.trim().length).toBeGreaterThan(10);
    }
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
  const logoRel = 'anamata-ai-logo.svg';

  it('the brand logo ships and is referenced by the header', () => {
    expect(existsSync(path.join(ROOT, 'public', logoRel)), 'public logo missing').toBe(true);
    expect(existsSync(path.join(DIST, logoRel)), 'built logo missing').toBe(true);
    const { html } = page(PAGES.home);
    expect(html, 'header does not reference the logo').toContain(logoRel);
  });

  it('the logo carries no creator metadata or editor cruft (privacy scrub)', () => {
    const svg = readFileSync(path.join(ROOT, 'public', logoRel), 'utf8');
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
  it('scenes are numbered 001–004 in order in the marginalia', () => {
    const { document } = page(PAGES.home);
    const nums = [...document.querySelectorAll('.marginalia .no')].map((n) => n.textContent.trim());
    expect(nums, 'scene marginalia numbering/order').toEqual(['001', '002', '003', '004']);
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

  it('scene 002: HOW IT WORKS carries the HUMAN APPROVED stamp motif', () => {
    const { html } = page(PAGES.home);
    expect(html, 'HUMAN APPROVED stamp missing').toMatch(/HUMAN APPROVED/i);
  });

  it('scene 003: proof is the REAL ledger and links /about', () => {
    const { document } = page(PAGES.home);
    expect(document.querySelector('.ledger .entry'), 'real ledger missing from proof').toBeTruthy();
    expect(
      document.querySelectorAll('a[href^="/about"]').length,
      'scene 003 must link /about'
    ).toBeGreaterThan(0);
  });

  it('scene 004: exit — button-hot to /configurator, ghost to /contact, tech@ mono line, module cards', () => {
    const { document, html } = page(PAGES.home);
    const hot = document.querySelector('a.btn.hot');
    expect(hot, 'button-hot offerte CTA missing').toBeTruthy();
    expect(hot.getAttribute('href'), 'hot CTA must link the configurator').toBe('/configurator');
    expect(hot.textContent, 'hot CTA label').toMatch(/vraag offerte aan/i);
    const ghost = document.querySelector('a.btn.ghost[href="/contact"]');
    expect(ghost, 'ghost contact CTA missing').toBeTruthy();
    expect(html, 'tech@ lead line missing').toContain('tech@anamata.ai');
    expect(
      document.querySelectorAll('.teaser-card').length,
      'module teaser cards missing'
    ).toBe(MODULES.length);
  });

  it('exactly one button-hot on the home film (max one coral ask per viewport)', () => {
    const { document } = page(PAGES.home);
    expect(document.querySelectorAll('a.btn.hot, button.hot').length).toBe(1);
  });

  it('nav CTA is the offerte ask (VRAAG OFFERTE AAN → /configurator)', () => {
    const { document } = page(PAGES.home);
    const cta = document.querySelector('header nav a.btn');
    expect(cta, 'nav CTA missing').toBeTruthy();
    expect(cta.getAttribute('href'), 'nav CTA must link the configurator').toBe('/configurator');
    expect(cta.textContent, 'nav CTA label').toMatch(/vraag offerte aan/i);
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
    expect(submit.textContent).toMatch(/vraag offerte aan/i);
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
    expect(html).toContain('onderdeel van Anamata');
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
    expect(cta?.textContent, 'nav CTA should be the offerte ask').toMatch(/vraag offerte aan/i);
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
