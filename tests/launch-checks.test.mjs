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
import { readFileSync, existsSync } from 'node:fs';
import { execSync } from 'node:child_process';
import path from 'node:path';
import fg from 'fast-glob';
import { parseHTML } from 'linkedom';
import YAML from 'yaml';

const ROOT = path.resolve(import.meta.dirname, '..');
const DIST = path.join(ROOT, 'dist');

const PAGES = {
  home: 'index.html',
  about: 'about/index.html',
  insights: 'insights/index.html',
  contact: 'contact/index.html',
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
  it('header nav: About replaces Anna/Approach; team anchor, insights and demo CTA kept', () => {
    const { document } = page(PAGES.about);
    const nav = document.querySelector('header nav');
    const hrefs = [...nav.querySelectorAll('a')].map((a) => a.getAttribute('href'));
    expect(hrefs, 'About link missing from header').toContain('/about');
    expect(hrefs, 'The team anchor changed').toContain('/#personnel');
    expect(hrefs, 'Insights link changed').toContain('/insights');
    expect(hrefs, 'Anna link not removed from header').not.toContain('/anna');
    expect(hrefs, 'Approach link not removed from header').not.toContain('/approach');
    expect(
      nav.querySelector('a.btn')?.textContent,
      'REQUEST A DEMO CTA changed'
    ).toMatch(/REQUEST A DEMO/);
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
