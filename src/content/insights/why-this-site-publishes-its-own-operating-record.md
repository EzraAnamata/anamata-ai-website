---
title: "Why this site publishes its own operating record"
description: "anamata.ai is built and operated by AI under named human approval. Instead of claiming that, we publish the evidence: the site's own commit and deploy history, typeset on every page."
published: 2026-07-06
draftedBy: "site agent (Claude)"
approvedBy: "E. Hulsman"
record: "005"
---

## What is the operating record?

The operating record is the audit trail of the AI systems that build and run this website, published on the website itself. The field log on the [home page](/) and the strip at the bottom of every page are not illustrations — they are generated at build time from this site's public [git repository](https://github.com/EzraAnamata/anamata-ai-website). Every entry links to a real commit. If it isn't in the repository's history, it doesn't appear here.

## Why publish it?

Every company selling AI says it is trustworthy. A claim like that can't be verified from a landing page — so we removed the claim and published the evidence instead.

Anamata builds AI employees: agents with an identity, a permission boundary, and a named human who approves their work. The most honest demonstration is the one you are looking at. This site is the first workplace: drafted by AI, reviewed by a human editor, deployed only after a named person approves the release.

## How the approval gate works

- An AI agent proposes a change as a pull request in the public repository.
- A human reviews the proposal. Nothing publishes on an AI's own authority — the deploy pipeline is bound to an approval step that only a named person can pass.
- On approval, the change deploys automatically, and the deployment itself becomes a new entry in the record, stamped with the approver's name.

The same gate that protects this website is the gate that will govern Anamata's AI employees at client organisations. We are not shipping anything we don't run ourselves first.

## What this means under the EU AI Act

Article 50 of the EU AI Act requires that AI-generated content is disclosed and that people are told when they interact with an AI system. You will find that notice on every page of this site — not in the fine print, but stamped where you can see it. The operating record goes one step further than the law requires: it doesn't just disclose that AI wrote this, it shows you each step, with the human who approved it, on the record.

## What's next

The record you see today is the site's own commit and deploy history — true from the first deploy. As Anamata's AI employees come online, their audit trails join the same record: actions, approvals, and boundaries, typeset in daylight.
