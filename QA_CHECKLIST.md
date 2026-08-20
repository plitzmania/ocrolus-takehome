# Prototype QA and Private-Git Readiness

Use this checklist before sharing the repository. The executable scope is the
Python pay-stub trust router and the local-state review-desk simulation. OCR,
model inference, production storage, authentication, queues, and persistence
remain design-only.

The latest local evidence is recorded in
[`QA_REPORT.md`](QA_REPORT.md). Keep this checklist reusable and rerun it from
the final committed private-repository branch.

## 1. Clean checkout

- [ ] Clone or copy into a clean directory without `.venv`, `node_modules`,
  build output, caches, logs, or environment files.
- [ ] Confirm `git status --short` shows only intentional source changes.
- [ ] Confirm no remote is added until the repository owner and private
  visibility are approved.
- [ ] Confirm the confidential project brief is not committed.
- [ ] Search tracked files for API keys, private keys, tokens, customer data,
  full SSNs, local absolute paths, and personal email addresses.

## 2. Python router

Run from the repository root:

```bash
uv sync --extra test --no-editable
uv run --extra test --no-editable ruff check src tests
uv run --extra test --no-editable ruff format --check src tests
uv run --extra test --no-editable pytest
```

- [ ] All lint, format, and test checks pass.
- [ ] `clean_candidate.json` returns `AUTO_ACCEPT` and completed business data.
- [ ] `suspicious_ytd_candidate.json` returns `FIELD_REVIEW` and status only.
- [ ] `gross_net_mismatch_candidate.json` returns `FULL_REVIEW` and status only.
- [ ] `unreadable_candidate.json` returns `REJECT` and status only.
- [ ] Every public response validates against
  `schemas/pay_stub_result.schema.json`.
- [ ] The generated A9 review task exactly matches the checked-in frontend
  fixture.
- [ ] Fixtures remain labeled simulated and contain no real customer data.

## 3. Review-desk simulation

Run from `review-desk-site/`:

```bash
npm ci
npm run lint
npm test
```

- [ ] The production build and server-render test pass.
- [ ] The simulation banner is visible and clearly says nothing is stored.
- [ ] Both flagged issues can be selected by mouse and keyboard.
- [ ] Confirm, correct, unsupported, save/revalidate, escalation, and zoom
  controls respond and communicate their simulated outcome.
- [ ] Empty corrections show an accessible error rather than completing.
- [ ] Evidence highlighting follows the selected issue and stays aligned after
  zoom and resize.
- [ ] Layout is usable at approximately 1440, 1024, 768, 390, and 320 pixels.
- [ ] Light and dark appearance remain readable.
- [ ] Keyboard focus is visible; controls have names; text does not clip or
  overlap; browser console shows no application errors.
- [ ] No production queue, persistence, authorization, or real revalidation is
  implied by the copy.

## 4. Documentation consistency

- [ ] `README.md` quick-start commands work from a clean checkout.
- [ ] `SYSTEM_OVERVIEW.md` gives each component local context, cost/speed impact,
  and removal criteria.
- [ ] `DESIGN.md` contains A0 through A12 and labels A13 as backlog.
- [ ] Stage names, statuses, versions, review outcomes, the under-60-second SLO
  boundary, and the 99% definition agree across all documents and code.
- [ ] Each component includes measurable evaluation and removal criteria.
- [ ] Open policy values remain labeled TBD rather than fabricated.
- [ ] The model recommendation is specific but makes no unsupported accuracy
  claim.
- [ ] `WRITEUP.md` remains within the requested one-to-two-page intent after
  final formatting.

## 5. CI and private repository handoff

- [ ] GitHub Actions runs Python 3.9 and 3.12 lint, format, and tests.
- [ ] GitHub Actions installs the review desk from `package-lock.json`, then
  runs lint and its build-backed tests.
- [ ] Branch protection requires both CI jobs before merge.
- [ ] Create a **private** repository and grant only the requested reviewer.
- [ ] Push without the source brief, temporary QA files, local environment, or
  generated build directories.
- [ ] Add the remote only after repository owner, name, and visibility are
  confirmed.
- [ ] Run the complete checklist again against the pushed default branch.

## 6. Deployment gate

- [ ] Deployment source is the exact CI-passing commit.
- [ ] The hosted review desk remains clearly marked as a synthetic simulation.
- [ ] No secrets or persistent resources are required by the static demo.
- [ ] Access level is explicitly approved before any new deployment.
- [ ] Smoke-test the deployed URL and retain the commit SHA and rollback target.
