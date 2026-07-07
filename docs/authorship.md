# Authorship on the record

This website is built and operated by AI, with named humans approving what
ships. The git history is part of the site's operating record, so authorship
in this repository is a statement of fact, not a formality. The rules:

## Who commits

- **Otto** (`Otto <otto@anamata.ai>`) is the AI identity that authors site
  changes. The name is the convention for "this change was produced by an AI
  system operating this repository"; the address is a stable identifier, not a
  mailbox. Otto's commits are **unsigned** on purpose.
- **Humans act through signatures.** Human-in-the-loop events are
  cryptographically signed: pull-request merges made on GitHub carry GitHub's
  web-flow signature over the merging human's action, deployment approvals are
  recorded (with the approver's name) in the Actions log and stamped into the
  site's ledger, and any commit a person makes directly is GPG-signed with
  their own key.

**The distinguishing rule: a signature means a human acted; an unsigned commit
authored by Otto means an AI did the work.** One is not a substitute for the
other — every Otto change still reaches production only through a signed human
merge and a named deployment approval.

## History note: the convention was applied retroactively (2026-07-07)

The repository predates this convention by one release. The v1 commits were
AI-built too, but were initially recorded under the operator's identity
(Ezra Hulsman, GPG-signed) because the AI-identity convention did not exist
yet. On 2026-07-07, at the owner's explicit direction, history was rewritten
so that AI work is attributed to Otto from the very first commit — which is
what actually happened. Original commit timestamps were preserved; the v1
pull-request merge commit remains authored by the human who merged it.

What the rewrite necessarily gave up, on the record: the pre-rewrite GPG
signatures (including GitHub's web-flow signature on the v1 merge commit) are
not part of the current history. The human approval trail for the v1 era is
therefore attested by GitHub's own records rather than in-graph signatures:
pull requests #1–#2 (merged by the owner) and the named production deployment
approvals in the Actions log. From this note onward, the signed-means-human
rule applies to new history.

## Message style

Commit messages follow Conventional Commits (`type: subject`, ≤72 chars),
regardless of author. Subjects render in the site's public ledger — write them
to be read.
