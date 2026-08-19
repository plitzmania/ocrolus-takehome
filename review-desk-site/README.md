# Ocrolus Review Desk

Interactive companion to the A9 review-desk design in the Ocrolus take-home. It
demonstrates field-level evidence review, correction, escalation, and
revalidation with synthetic pay-stub data.

The page imports `app/review-task.json`, which is the checked-in output of the
Python `build_review_task` contract for
`fixtures/edge_cases/suspicious_ytd_candidate.json`. The root Python test suite
rebuilds that task and requires an exact match, so the frontend cannot silently
drift away from the router.

## Run locally

Requires Node.js 22.13 or newer.

```bash
npm install
npm run dev
```

Validate a production build with `npm run build`.

This is a product-design prototype, not a production review system. It does not
store submitted values or process real documents. Save, revalidation, and
escalation actions update local UI state only and are labeled as simulations.

The production workflow is intended to minimize human review through automatic
acceptance and targeted field tasks, but it retains reviewers for exceptions
that automation cannot resolve safely; it does not promise zero human need.
