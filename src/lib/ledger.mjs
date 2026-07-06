/**
 * The Operating Record — build-time ledger from this repo's real git history.
 *
 * Hard rule (design-tokens.json concept.avoid): the record is never
 * fabricated. Until the audit-trail API (#347) exists, entries are the site's
 * own commit/deploy history, resolved at build time. Deploy entries are only
 * added in CI, from environment facts of the approved deployment run.
 */
import { execSync } from 'node:child_process';

const REPO_URL = 'https://github.com/EzraAnamata/anamata-ai-website';

function git(args) {
  return execSync(`git ${args}`, { encoding: 'utf8' }).trim();
}

function fmtTs(iso) {
  const d = new Date(iso);
  const p = (n) => String(n).padStart(2, '0');
  return `${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

/** Latest commits, oldest→newest so the ledger reads downward like a log. */
export function getCommitEntries(limit = 6) {
  const raw = git(`log -n ${limit} --format=%h%x09%an%x09%aI%x09%s`);
  return raw
    .split('\n')
    .filter(Boolean)
    .map((line) => {
      const [hash, author, iso, subject] = line.split('\t');
      return {
        kind: 'commit',
        hash,
        author,
        iso,
        ts: fmtTs(iso),
        subject,
        url: `${REPO_URL}/commit/${hash}`,
      };
    })
    .reverse();
}

/**
 * Deploy entry — only in CI, after the production environment gate passed.
 * The workflow exports these from the facts of the approved run.
 */
export function getDeployEntry() {
  const { DEPLOY_RUN_NUMBER, DEPLOY_APPROVER, DEPLOY_TIME, DEPLOY_RUN_URL } = process.env;
  if (!DEPLOY_RUN_NUMBER) return null;
  return {
    kind: 'deploy',
    ts: fmtTs(DEPLOY_TIME || new Date().toISOString()),
    iso: DEPLOY_TIME || new Date().toISOString(),
    subject: `deployed build #${DEPLOY_RUN_NUMBER} to anamata.ai`,
    // GitHub display names can carry suffixes like "Ezra Hulsman | Anamata"
    approver: (DEPLOY_APPROVER || '').split('|')[0].trim() || null,
    url: DEPLOY_RUN_URL || `${REPO_URL}/actions`,
  };
}

export function getLedger(limit = 6) {
  const entries = getCommitEntries(limit);
  const deploy = getDeployEntry();
  if (deploy) entries.push(deploy);
  return entries;
}

/** Feeds the persistent record strip: the most recent action on record. */
export function getLastAction() {
  const ledger = getLedger(1);
  const last = ledger[ledger.length - 1];
  if (last.kind === 'deploy') {
    return `${last.ts} · ${last.subject}${last.approver ? ` · approved ${last.approver.toLowerCase()}` : ''}`;
  }
  return `${last.ts} · ${last.subject} · ${last.author.toLowerCase()}`;
}
