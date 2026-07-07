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

## Before this convention (commits up to and including `b4babc4`)

The repository predates this convention by one release. Commits from the root
through the v1 merge were AI-built as well, but were recorded under the
operator's identity (Ezra Hulsman) and signed with his key, because the
AI-identity convention did not exist yet. Those signatures attest that the
operator stood behind the work; the human approval trail for that era lives in
the pull-request and deployment-approval history. History was deliberately NOT
rewritten when the convention was introduced: the v1 merge commit carries
GitHub's signature over the human merge action, and rewriting would have
destroyed that marker — the record keeps its receipts, including the receipt
that the convention arrived after the first release.

## Message style

Commit messages follow Conventional Commits (`type: subject`, ≤72 chars),
regardless of author. Subjects render in the site's public ledger — write them
to be read.
