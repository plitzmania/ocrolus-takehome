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

Run the UI locally so the review path does not depend on a separate access
grant:

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

Run the manually transcribed assignment pay stub:

```bash
uv run --extra test --no-editable ocrolus-takehome-demo \
  fixtures/supplied_paystub_candidate.json --summary
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
architecture and rationale are linked from the public submission directory in
the root README.
