# Ocrolus Review Desk

Interactive companion to the A9 review-desk design in the Ocrolus take-home. It
demonstrates field-level evidence review, correction, escalation, and
revalidation with synthetic pay-stub data. A second **Backend demo** tab
randomly replays one of four Python-generated fixtures so reviewers can see the
validation, routing, delivery gate, and optional UI handoff without opening a
terminal.

The page imports `app/review-task.json`, which is the checked-in output of the
Python `build_review_task` contract for
`fixtures/edge_cases/suspicious_ytd_candidate.json`. The root Python test suite
rebuilds that task and requires an exact match, so the frontend cannot silently
drift away from the router.

The backend tab imports `app/backend-showcase.json`. The root showcase test
rebuilds that payload from all four Python fixtures and requires an exact match.

## Run locally

Requires Node.js 22.13 or newer.

```bash
npm ci
npm run dev
```

Validate the exact locked dependency set with:

```bash
npm run lint
npm test
```

`npm test` builds the production worker and checks its rendered HTML.

This is a product-design prototype, not a production review system. It does not
store submitted values or process real documents. Save, revalidation, and
escalation actions update local UI state only and are labeled as simulations.

The production workflow is intended to minimize human review through automatic
acceptance and targeted field tasks, but it retains reviewers for exceptions
that automation cannot resolve safely; it does not promise zero human need.

## Removal criteria

This simulated UI should be removed from the submission when it no longer adds
clear evidence of the A9 workflow or when maintaining its Python-to-frontend
contract costs more than the demonstration value. In production, a dedicated
review path may be retired for a defined document cohort only after sustained
automatic accuracy and random audits show that the path is no longer needed.
Any removal must preserve an exception route, retain required audit history,
delete unused deployment and dependencies, and support rapid rollback.
