# Part B handoff

This repository is a runnable prototype of a pay-stub trust router and its
reviewer workflow. It starts after OCR/model extraction, using synthetic JSON
fixtures so the routing, safety, and review contracts can be evaluated without
external services or credentials.

## Run the complete demo

Requirements: Git, Python 3.9 or newer, and
[`uv`](https://docs.astral.sh/uv/getting-started/installation/).

```bash
git clone https://github.com/plitzmania/ocrolus-takehome.git
cd ocrolus-takehome
./demo
```

The command runs all four routing scenarios, demonstrates that uncertain
business data is withheld from the lender-facing response, and summarizes the
review task passed to the frontend.

## Open the reviewer UI

The hosted prototype is available at
[ocrolus-review-desk.benteplitzky15.chatgpt.site](https://ocrolus-review-desk.benteplitzky15.chatgpt.site).
It is privately shared, so a new recipient must be granted access first.
The **Backend demo** tab randomly replays scenarios A–D from the same
contract-checked Python payload; the **Reviewer workflow** tab demonstrates the
human exception path.

To run the same UI locally:

```bash
cd review-desk-site
npm ci
npm run dev
```

## Use the backend directly

Route one simulated extraction:

```bash
uv run --extra test --no-editable ocrolus-takehome-demo \
  fixtures/edge_cases/suspicious_ytd_candidate.json --summary
```

Generate the internal task consumed by the review desk:

```bash
uv run --extra test --no-editable ocrolus-review-task \
  fixtures/edge_cases/suspicious_ytd_candidate.json \
  --state CLAIMED --reviewer-id demo-reviewer
```

## Verify the handoff

```bash
uv run --extra test --no-editable ruff check src tests
uv run --extra test --no-editable ruff format --check src tests
uv run --extra test --no-editable pytest
```

## What is intentionally not included

The prototype does not perform OCR, accept document uploads, persist reviewer
actions, authenticate reviewers, or run a production queue. The frontend's
save, revalidation, and escalation actions are local simulations. Production
architecture and trade-offs are documented in `DESIGN.md`,
`SYSTEM_OVERVIEW.md`, and `WRITEUP.md`.
