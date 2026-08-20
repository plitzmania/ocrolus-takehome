# Pay-Stub Confidence and Review Router

This repository is the working prototype for Part B of the Ocrolus take-home.
It implements one component of a larger document-extraction pipeline: the gate
that decides whether a pay-stub extraction can be accepted automatically or
needs human attention.

For a recipient-ready setup and usage guide, start with
[`HANDOFF.md`](HANDOFF.md).
Parts A and C are linked from the
[submission directory](https://docs.google.com/document/d/1vY05eTzC16V8VOTYStIKH9Ir94Ef6nXYgahRm8NJFic/edit).

The prototype deliberately starts **after** OCR/model extraction. Synthetic
JSON fixtures stand in for the typed output of an upstream model. The code
parses that output, runs deterministic consistency checks, evaluates
field-level confidence, and produces one of four internal routing decisions:

- `AUTO_ACCEPT` — all checks and confidence gates pass
- `FIELD_REVIEW` — a small, identified set of fields needs review
- `FULL_REVIEW` — a critical field or deterministic check fails
- `REJECT` — automation cannot continue safely and requires exception review

The production review cycle is intended to minimize human work through
automatic acceptance and targeted field review, but it does not assume people
can be removed from every difficult document. Accuracy remains the delivery
gate.

## Quick start

The package requires Python 3.9 or newer and has no runtime dependencies.

For a presentation-ready, one-command walkthrough of all four routes, the
delivery safety gate, and the frontend handoff:

```bash
./demo
```

The equivalent [`uv`](https://docs.astral.sh/uv/) commands are:

```bash
uv sync --extra test --no-editable
uv run --extra test --no-editable ocrolus-takehome-showcase
```

With standard Python tooling:

```bash
python3 -m venv .venv
source .venv/bin/activate
python -m pip install '.[test]'
ocrolus-takehome-showcase
```

Run the reviewer interface in a second terminal:

```bash
cd review-desk-site
npm ci
npm run dev
```

Omit `--summary` to print the lender-facing, delivery-gated response. An
auto-accepted fixture includes the completed business data; every review route
returns status only:

```bash
uv run --extra test --no-editable ocrolus-takehome-demo fixtures/clean_candidate.json
```

## Try every routing outcome

```bash
uv run --extra test --no-editable ocrolus-takehome-showcase
```

The compact output shows `AUTO_ACCEPT`, `FIELD_REVIEW`, `FULL_REVIEW`, and
`REJECT`, proves that uncertain business values are withheld, summarizes the
internal task sent to the review desk. Use
`ocrolus-takehome-demo <fixture> --summary` only when you want to inspect an
individual scenario.

To run the supplied assignment pay stub through the same component:

```bash
uv run --extra test --no-editable ocrolus-takehome-demo \
  fixtures/supplied_paystub_candidate.json --summary
```

That fixture is an explicit manual transcription, not claimed OCR or model
output. It preserves the printed line items, omits the full Social Security
number, leaves unprinted pay frequency null, and routes the two suspicious YTD
deductions to review.

## How it works

```text
simulated extractor JSON
          |
          v
typed parsing and normalization
          |
          +----------------------+
          |                      |
          v                      v
deterministic checks      confidence policy
          |                      |
          +----------+-----------+
                     v
              review router
                     |
                     v
       delivery-gated, schema-valid response
```

Deterministic checks cover:

- required fields and pay-period date order
- current and YTD earnings line-item totals
- current and YTD deduction line-item totals
- current and YTD gross-minus-deductions-to-net equations
- suspicious line items whose YTD amount is lower than the current amount
- nonzero gross or deduction totals with no extracted line items

The confidence policy uses field-level values rather than only an overall
average. This prevents many high-confidence fields from hiding one weak
critical field. Thresholds are configurable in `ConfidencePolicy`; the current
values are illustrative and must be calibrated against a representative,
labeled production dataset.

The shipped reviewer interface shows how an authorized reviewer sees source
context, resolves a flagged field, and sends the correction back through
revalidation. It consumes the internal task produced by `build_review_task`,
and a cross-language contract test keeps its bundled task synchronized with the
Python router. The interface is an exception path designed to minimize
full-document human work, not a claim that review will never be needed.

The UI is explicitly in simulation mode: interactions are local and nothing is
stored. A repository-owned static preview is available at
[`mockups/review-desk.png`](mockups/review-desk.png).

## Simulated input

Each field in a fixture contains the value an upstream extractor might return,
its confidence, and optional page evidence:

```json
{
  "value": "2500.00",
  "confidence": 0.99,
  "evidence": {
    "page": 1,
    "text": "$2,500.00",
    "bounding_box": [0.70, 0.42, 0.86, 0.46]
  }
}
```

Synthetic fixtures are explicitly labeled `simulated_upstream_output`. The
supplied-stub fixture is labeled `manual_transcription_of_supplied_paystub`.
All confidence values are test inputs, not measured probabilities. The code
does not claim to perform OCR, model inference, or confidence calibration.

The prototype requires a well-formed typed candidate: ISO dates and monetary
values with no more than two decimal places. Invalid candidate syntax fails at
the input boundary. The production design is broader: normalization would
retain an otherwise usable candidate while marking an individual unparseable
field as null with an issue for review.

## Output contract

The CLI keeps routing reasons, validation findings, field confidence, and
evidence inside the internal candidate and review flow. The lender-facing
response returns business values only for `COMPLETED_AUTO` or a future
`COMPLETED_HUMAN_VERIFIED` revision. `NEEDS_REVIEW` and `UNPROCESSABLE` are
status-only, so an integration cannot accidentally consume uncertain values.
The machine-readable contract is
[`schemas/pay_stub_result.schema.json`](schemas/pay_stub_result.schema.json),
and the test suite validates every demo fixture against it.

`ocrolus-review-task` creates the separate internal A9 payload used by the
reviewer interface. This separation is intentional: the review desk can see the
candidate and evidence needed to resolve an exception, while the lender-facing
response continues to withhold those values until completion.

## Repository map

```text
src/ocrolus_takehome/   typed input, validation, confidence, routing, output
fixtures/               synthetic clean and edge-case extractor outputs
schemas/                final pay-stub JSON Schema
tests/                  unit, routing, CLI, and schema-contract tests
review-desk-site/        interactive reviewer UI wired to an internal task
mockups/                 repository-native reviewer preview
```

## Deliberate boundary

This is not an end-to-end document extractor. OCR, image preprocessing,
document classification, model serving, and the production review service
remain part of the design. The included reviewer UI has no authentication,
queue, persistence, concurrency control, or real document backend. It is a
functional demonstration of the contract and workflow, not a production
application. That boundary keeps the prototype honest and testable within the
stated time budget.
