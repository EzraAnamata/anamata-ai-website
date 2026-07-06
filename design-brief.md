# Design Brief — anamata.ai

**Direction: The Operating Record** · approved 2026-07-04 by Ezra Hulsman + CEO (Taiga story #341, epic #335)
**Binding spec:** `design-tokens.json` (schema v2) — tokens are law; this document is the human-readable context.
**Ground truth for the direction:** `design/checkpoints/hero-operating-record.html` + screenshots in `design/checkpoints/`.

---

## Concept

**The site is its own evidence.** anamata.ai is developed and operated by Anamata's AI employees, and the design makes that literal: every page carries the live, typeset operating record of the team that runs it. Where every competitor *asserts* trustworthy AI, this site *documents* it — the audit trail (Taiga #347) is simultaneously the marketing, the product demo, and the EU AI Act evidence.

**Mood:** a QA lab notebook that updates itself. Warm ivory paper, one strict electric-cobalt ink, faint graph-paper grid, hairline rules, green approval stamps. Daylight and calm in a product category that hides in dark mode — "nothing to hide" as a visual argument, aimed at skeptical Dutch/EU enterprise buyers (banks, insurers — the anamata.eu client base).

This direction absorbed the two runners-up rather than discarding them:
- **The Colleague File** (Direction 3) → the personnel-records section (002): live employee dossier cards.
- **Circles Within Circles** (Direction 2) → the permission-rings diagram planned for the Approach page, as cobalt line art.

## Signature element

**The Operating Record** — the real audit ledger, beautifully typeset. Hero field log + a persistent bottom record strip on every page + provenance blocks on articles. Entries type on one at a time; human approvals stamp in green with the approver's name.

**Hard rule: the record is never fabricated.** Day one (before employee #1 exists) it shows the site's own AI-built commit/deploy history — which is true from the first deploy. Demo data exists only in this checkpoint file.

## Palette

| Role | Hex | Use |
|---|---|---|
| Paper | `#F2EFE6` | Background, with cobalt graph-grid underlay at 7% / 32px cells |
| Ink | `#16233A` | Text, rules, record strip bg — the anamata.eu navy kinship, worn as ink not background |
| Cobalt | `#1F2BE0` | The one accent: display emphasis, agent names, buttons, marginalia numbers |
| Cobalt soft | `#5560E5` | Timestamps, secondary mono data |
| Approval green | `#1F7A4D` | **Reserved exclusively for approval/verification events** (stamps, checkmarks, RECORDING dot) |
| Border | `#C2C2C0` | Hairlines (ink at 22% over paper, resolved) |

Strictly bichromatic cobalt-on-paper; green is an *event*, not a color scheme. No other hues, ever.

## Typography

- **Display/headings:** Newsreader italic 600 (700 for card names). Hero at `clamp(3.2rem, 7.2vw, 6.4rem)`, line-height 1.02. The italic serif is the ledger's "written entry" voice — display-scale, not an accent word.
- **Body:** Public Sans 400/500/600 — pragmatic, Dutch-government-adjacent sobriety.
- **Data:** IBM Plex Mono for everything ledger-grammar: timestamps, field labels, stamps, buttons, nav, marginalia.
- Loaded via Google Fonts, `font-display: swap`, preload the three critical files.

## Layout system

Ruled ledger sheet: a 132px marginalia column (mono record numbers 001, 002 … + micro-labels) with a hairline right border; content column max 1080px. Numbered sections divided by 2px ink rules. Persistent record strip pinned to the bottom viewport edge. Marginalia collapses to a horizontal strip under 760px.

**Page scaling — the whole site is one continuous record:**

| Page | Treatment | Record № |
|---|---|---|
| Home | The claim + the field log + personnel records | 001–002 |
| Anna (product) | Her dossier, expanded — capabilities as filed records | 003 |
| Approach | The governance file — permission-rings diagram (cobalt line art) | 004 |
| Insights | Field notes — every article carries a provenance ledger block | 005+ |
| Contact/demo | "File a request" — submission becomes a visible ledger entry | APPENDIX |

## Motion

One choreographed moment on load (see `animations.choreography` in tokens): ledger entries arrive sequentially, stamps spring in rotated, caret blinks, OKR bars fill. **Nothing else moves.** No scroll animations in v1. Archetype: Minimal Motion, zero animation dependencies. Reduced motion: show final state (everything visible, nothing blinking).

## Component inventory

header · button-primary · button-ghost · marginalia · transparency-notice (§50) · ledger + entries · approval-stamp · record-strip · personnel-card (active/pending) · okr-bar · provenance-block · demo-form ("file a request") · rings-diagram (Approach) · footer (to be designed within same grammar). Specs in `components` block of tokens.

## Accessibility

WCAG AA. Verified: cobalt on paper ≈ 8:1, ink on paper ≈ 12:1. **Constraint:** approval green on paper ≈ 4.6:1 — use only bold/uppercase with border (stamps) or at ≥14px. Touch targets ≥44px (mono nav links need padding to reach it on mobile). `prefers-reduced-motion` honored (implemented in checkpoint).

## Implementation notes & constraints

1. **Art. 50 transparency notice is a mandatory component on every page** (condensed footer variant allowed on subpages). Per the EU AI Act compliance brief (story #338): AI self-identification + named human editorial review; the notice styled as a stamped marginal note is brand voice, not fine print.
2. **The ledger consumes real data.** Wire it to the audit trail API (#347) when employee #1 exists; until then, generate it from the site repo's own commit/deploy history at build time.
3. **LLM-first structure is a hard requirement** (story #343): semantic HTML, answer-shaped content sections, llms.txt, schema.org structured data, auto-regenerated sitemap. The ledger markup must be real text (crawlable), not canvas/JS-only.
4. Content editing must be drivable by an agent via MCP (git-based content preferred — decide in #342, record in epic #334 decision log).
5. Reuse the checkpoint slice as the hero's starting code — it is the approved ground truth.
6. Wordmark: "ANAMATA" + mono cobalt ".AI" as in checkpoint; the circled-M mark (`anamata-M.png`) available as favicon/secondary mark. Cousin link to anamata.eu = shared navy soberness, deliberately *not* its coral accent.

## References

- `design/references/anamata-eu-1440.png` — parent brand (navy, coral, night-city photography). Kinship kept: navy, typographic sobriety. Rejected: coral, dark hero, photography.
- Category research (LazyWeb, 2026-07-03): AI-agent platforms converge on dark-purple gradients + fake dashboard heroes + "Get a demo" — this direction's paper-light proof-first stance is the deliberate inversion.

## Checkpoint screenshots (approved 2026-07-04)

- `design/checkpoints/checkpoint-1440-hero.png` — desktop hero
- `design/checkpoints/checkpoint-1440-full.png` — desktop full page (001 + 002)
- `design/checkpoints/checkpoint-375-mobile.png` — mobile full page

**Verify implementation with `/verify-visual`** — floor: token/contrast conformity; critique: does the Operating Record land as *the* memorable element.
