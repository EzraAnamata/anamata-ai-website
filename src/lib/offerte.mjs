/**
 * Offerte (configurator) — shared model + mailto builder.
 *
 * Single source of truth for BOTH the page (server-render + client script) and
 * launch-checks. Submission reuses the contact page's mechanism: a prefilled
 * mailto: opens the visitor's own mail client — nothing leaves the origin, no
 * backend, no third-party form service. NO prices anywhere (gefaseerd webshop:
 * you configure, we quote).
 */

export const OFFERTE_EMAIL = 'offerte@anamata.ai';

/**
 * Field length caps. This is the real defense that keeps the encoded mailto:
 * URL under the ~1900-char practical client limit — launch-checks asserts the
 * worst case (every field maxed, every module picked) stays below it.
 */
export const FIELD_MAX = { name: 60, org: 80, email: 90, note: 260 };

/**
 * The orderable modules, in ledger grammar. Card-stock rows with a square
 * checkbox stamp; mono spec fields. No prices — the exit is an offerte request.
 */
export const MODULES = [
  {
    id: 'anna',
    name: 'Anna',
    kicker: 'AI-EMPLOYEE',
    spec: 'The AI employee working inside Microsoft Teams — a permission ring around what she may touch and a human approval gate on anything that leaves it.',
    fields: [
      ['runs in', 'Microsoft Teams'],
      ['boundary', 'permission ring'],
      ['gate', 'named human approval'],
    ],
  },
  {
    id: 'cv-tool',
    name: 'CV-tool',
    kicker: 'MODULE',
    spec: 'Structured CV intake and candidate dossiers — the same record grammar, applied to recruitment.',
    fields: [
      ['intake', 'CV documents'],
      ['output', 'structured dossier'],
    ],
  },
  {
    id: 'couplings',
    name: 'Couplings & plugins',
    kicker: 'MODULE',
    spec: 'Connections into the stack you already run, added step by step. Marketplace catalogue lands later.',
    fields: [
      ['scope', 'on request'],
      ['rollout', 'phased'],
    ],
  },
];

/**
 * Build the offerte email body from a picked set. Pure — deterministic given
 * its input, so the client and the test produce identical output.
 */
export function buildOfferteBody({ name, org, email, note, modules }) {
  const picked = MODULES.filter((m) => modules.includes(m.id));
  const lines = [
    'Offerte request filed from anamata.ai/configurator',
    '',
    'Modules:',
    ...(picked.length ? picked.map((m) => `- ${m.name}`) : ['- (no module selected)']),
    '',
    `Name: ${name}`,
    `Organisation: ${org || '—'}`,
    `Reply-to: ${email}`,
    '',
    'Note:',
    note || '—',
  ];
  return lines.join('\n');
}

export const OFFERTE_SUBJECT = 'Offerte request via anamata.ai';

/** Build the full mailto: href for a picked set. */
export function buildOfferteHref(data) {
  const subject = encodeURIComponent(OFFERTE_SUBJECT);
  const body = encodeURIComponent(buildOfferteBody(data));
  return `mailto:${OFFERTE_EMAIL}?subject=${subject}&body=${body}`;
}

/**
 * Worst-case encoded href length: every field maxed with a space (which
 * percent-encodes to %20 — the worst case for ASCII input, 3x expansion) and
 * every module picked.
 */
export function worstCaseHrefLength() {
  const pad = (n) => ' '.repeat(n);
  return buildOfferteHref({
    name: pad(FIELD_MAX.name),
    org: pad(FIELD_MAX.org),
    email: pad(FIELD_MAX.email),
    note: pad(FIELD_MAX.note),
    modules: MODULES.map((m) => m.id),
  }).length;
}
