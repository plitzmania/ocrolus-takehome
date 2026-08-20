# Ocrolus Take-Home Project

Status: Part B prototype and all A0-A12 production-design sections are drafted.
The automated readiness suite and initial desktop/mobile browser smoke test
pass. Final human review, clean-checkout CI, and private publication remain.

## Current implementation status

Implemented:

- Versioned factual pay-stub output contract and JSON Schema
- Delivery gate that withholds business fields from every noncompleted result
- Typed pay-stub candidate model aligned with the final output contract
- Earnings and deductions as variable line-item arrays
- Explicit null handling and decimal/date normalization
- Deterministic required-field, date, current/YTD line-total, and gross-to-net checks
- Configurable provisional field-confidence policy
- Critical-field-aware human-review routing
- Synthetic fixtures covering all four routing decisions
- Full-result and compact-summary command-line demos
- Schema-backed automated tests for parsing, validation, confidence, routing,
  CLI output, and the public result
- Shareable interactive review-desk mock with an embedded overview preview
- Part C prototype write-up
- Reproducible dependency lock and GitHub Actions test workflow
- Interactive review-desk frontend wired to the Python A9 review-task contract
- Component-by-component removal criteria for reducing stack size and technical debt
- A11 operations, privacy, reliability, observability, and cost-control design
- A12 evaluation, correction feedback, fine-tuning, drift, and release design

Still pending:

- Production policy inputs that require customer traffic, security, retention,
  reviewer, statistical, recovery, and cost decisions
- Backlog: add a submission-level envelope that groups multiple logical document
  results, tracks package and per-document status, and optionally reports factual
  cross-document observations without annualizing income or applying underwriting
  policy
- Final requirement-by-requirement review
- Complete the remaining human checks in the repository QA checklist: clean
  checkout, 1024/768/320 px, light appearance, and keyboard-only review
- GitHub publication after the repository owner and visibility are confirmed

## Objective

Create a private-repository-ready submission for the Ocrolus hands-on project that is credible within the stated 4-to-6-hour scope.

## Scope decision

Build the pay-stub confidence, validation, and human-review router as the implemented component.

The production policy is intended to minimize human review through accurate
automation and targeted field tasks, while retaining review as a necessary
safety path for documents automation cannot resolve. The project does not
promise zero human involvement.

The prototype will accept a typed candidate extraction, apply deterministic validation and field-level confidence policy, and return one of:

- `AUTO_ACCEPT`
- `FIELD_REVIEW`
- `FULL_REVIEW`
- `REJECT`

Any manually transcribed pay stub will be described honestly as simulated
upstream model output, not as output from a model that was not run.

## Full-system design

The design will cover:

1. Encrypted document ingress
2. File and security validation
3. Rendering and image-quality assessment
4. Page splitting and document classification
5. Fine-tuned multimodal extraction
6. Raw candidate output with confidence, evidence, and proposed field and
   line-item matches
7. Normalization of formats and labels into a typed candidate, with checks for
   row, column, and field-assignment problems
8. Deterministic validation without silently repairing values
9. Confidence calibration and routing
10. Automatic acceptance or targeted human review
11. Versioned API output and audit logging
12. Human corrections returned to the training pipeline

## Evaluation approach

Every detailed pipeline section includes an explicit evaluation plan covering
its correctness, failure behavior, latency, and cost. Component tests are kept
separate from the end-to-end customer field-accuracy measurement so the source
of an error can be identified.

For normalization specifically, a frozen held-out set pairs raw observations
with verified canonical results. It measures formatting accuracy,
current-versus-YTD and line-item association accuracy, label-mapping accuracy,
ambiguity
detection, evidence preservation, and whether the stage ever creates an
unsupported value. The same documents are then run through extraction and
normalization together and included in the full-pipeline evaluation. The
submission does not claim the brief's 99%+ target until that held-out end-to-end
evaluation has been run.

## A7 sanity-checker plan

### Scope and accepted direction

A7 is a versioned, deterministic CPU stage between A6 normalization and A8
confidence routing. It applies fixed rules to the typed candidate and returns
stable issues with a code, severity, message, and affected JSON Pointer. It
never calls a model, changes an extracted value, fills a missing value, or
rearranges line items to force a reconciliation. Passing A7 means only that the
current rules found no known contradiction; it is not proof that the extraction
is correct.

The implemented pay-stub rules cover required critical values, date order,
line-item completeness, nonnegative current-versus-YTD plausibility, current
and YTD line-total reconciliation, and current and YTD gross-to-net arithmetic.
The prototype uses a one-cent tolerance and carries all issues into the internal
audit and review record. A8, not A7, chooses `AUTO_ACCEPT`, `FIELD_REVIEW`,
`FULL_REVIEW`, or `REJECT`. Human corrections must run through A7 again before
delivery; the lender-facing result does not expose detailed validation issues.

### Constraint coverage

- The rules support the 99%+ customer-field target by catching known
  contradictions, but the project makes no accuracy claim until held-out
  end-to-end evaluation measures both caught errors and incorrect fields that
  pass the rules.
- A7 is bounded, in-house CPU work with no model or third-party API call. Its
  latency and cost must be benchmarked inside the under-60-second standard path.
- Exact issue paths enable targeted review, while false-positive review volume
  and reviewer minutes are included in the cost evaluation.
- Revalidation after correction prevents a reviewer edit from bypassing the
  same consistency checks applied to model output.

### Remaining work and release evidence

- Align the production A6-to-A7 contract on canonical RFC 6901 paths; the
  prototype currently translates internal dotted paths at the result boundary.
- Confirm required and critical fields, severity, currency and rounding rules,
  date relationships, and any audited exception policy using downstream and
  compliance input.
- Add verified edge cases for off-cycle pay, reversals, negative adjustments,
  incomplete printed totals, unfamiliar labels, and long line-item arrays.
- Evaluate rule precision and recall, incorrect fields that pass A7,
  false-positive review rate, issue-code stability, p95 latency, CPU cost, and
  the A8 review volume on a held-out corpus.
- Version every released catalog and require deterministic replay and
  end-to-end regression results before promotion.

## A8 traffic-controller plan

### Scope and accepted direction

A8 combines field confidence, evidence availability, document-quality signals,
and A7 issues to select `AUTO_ACCEPT`, `FIELD_REVIEW`, `FULL_REVIEW`, or
`REJECT`. It evaluates critical fields individually, so a high average cannot
hide one risky financial value. With a fixed policy version, the decision and
reason codes are deterministic.

The project does not propose production confidence thresholds without the
golden corpus, reviewer measurements, traffic mix, and cost data needed to
justify them. The prototype values remain illustrative configuration. The
accepted design is the process for defining and improving the policy. It reduces
review as far as measured accuracy and latency allow, but never treats human
review as a path that can be promised away.

### Definition and hill-climbing approach

The constraint is at least 99% correct final delivered field instances, with
wrong, missing, malformed, misassigned, and unsupported extra values counted as
errors. Among policies that preserve that accuracy and an under-60-second
automatic result or review-ready disposition, the optimization first maximizes
eligible-document completion and straight-through coverage, then minimizes
inference and human-review cost. An eligible difficult document cannot be
rejected simply to improve measured accuracy. Automatic accuracy, completion,
rejection, and review volume remain separate metrics so human work or selective
rejection cannot hide weak automation.

Use separate training, calibration, and untouched test splits. Calibrate raw
scores against observed correctness, search field- and document-specific
routing policies on the calibration split, freeze the full versioned policy,
and verify all accuracy, latency, and cost gates on the test split. Group errors
and avoidable reviews into slices, improve the highest-impact slice, and repeat
against the same baseline. Passing changes enter shadow mode or a bounded
canary, and a random sample of auto-accepted results is audited to avoid
selective-label bias.

### Remaining work and release evidence

- Confirm critical fields, reviewer accuracy and capacity, review unit cost,
  statistical release requirements, and the separate human-completion SLA. The
  under-60-second endpoint is an automatic result or review-ready status.
- Build calibration and untouched test splits from representative golden data,
  isolated from training and policy tuning.
- Report final and automatic accuracy, straight-through coverage, field- and
  full-review rates, false accepts, avoidable reviews, latency, reviewer
  minutes, and total cost by document and field slice.
- Test routing precedence, all four outcomes, weak critical fields, boundary and
  missing scores, stable reason paths, policy replay, and bounded execution.
- Version model, calibration, rules, and routing together; require offline
  regression, safe deployment, production audit sampling, and rollback.

## A9 review-desk plan

### Scope and accepted direction

A9 turns A8's `FIELD_REVIEW` and `FULL_REVIEW` outcomes into controlled human
tasks. Reviewers see the original page, highlighted evidence, proposed value,
reason for review, and enough row or column context to make a document-supported
correction. They can confirm, correct, mark unsupported, or escalate; they do
not make underwriting decisions or fill unsupported values.

Every action creates an auditable candidate version and preserves the model's
original observation. Corrected fields receive `human` attribution and return
through typed parsing, the A7 sanity checker, and the A8 traffic controller
before A10 delivery. A remaining error reopens or escalates the task rather than
being silently overridden.

### Constraint coverage

- Reviewed values count in the 99%+ final customer-field metric, and reviewer
  accuracy, false confirmations, rework, and agreement are measured separately.
- The under-60-second online SLO produces an automatic result or review-ready
  disposition; review queue, handling, and corrected completion use separate
  explicit SLAs that still remain visible to the customer.
- The application and evidence stay inside company-controlled infrastructure
  with tenant-scoped, role-based, time-limited, audited access.
- Field review is preferred when safe because human minutes are the dominant
  cost; full review preserves context for broader or critical failures. The
  workflow is optimized to minimize reviewer need, not to claim it will be zero.
- Only quality-checked corrections enter A12's offline learning process, and no
  reviewer action changes a live model or routing threshold directly.

### Deliverable and remaining work

- The repository-owned `mockups/review-desk.png` preview is embedded directly
  in `SYSTEM_OVERVIEW.md`. The runnable `review-desk-site/` simulation consumes
  a checked-in task produced by the Python review contract; a cross-language
  test prevents the UI fixture from drifting from the router.
- Confirm reviewer qualifications, queue priority, completion SLAs, staffing and
  cost, quality-audit and second-review rates, maximum attempts, override and
  resubmission policy, and correction-reason taxonomy.
- Implement durable leases, idempotent submissions, immutable candidate
  versions, stale-edit protection, and complete review audit events.
- Evaluate reviewer accuracy, false confirmations, agreement, wait and handle
  time, rework, escalation, completion SLA, and cost on verified review tasks.
- Test tenant isolation, evidence alignment, accessibility, bounded review
  loops, revalidation, load, access revocation, and sensitive-data logging.

## A11 operations and reliability plan

### Scope and accepted direction

A11 surrounds the online pipeline with durable, idempotent stage execution,
bounded retries, immutable revisions, privacy controls, capacity management,
observability, incident handling, deployment safety, backup, and recovery. It
does not alter financial facts or convert technical failures into confidence
decisions. The standard online SLO remains p95 under 60 seconds from finalized
upload to an automatic result or review-ready status; human completion has a
separate visible SLA.

Every result records the compatible pipeline, model, render, schema, rules,
calibration, and routing versions. Candidate releases pass offline regression,
shadow comparison where feasible, and a bounded canary with rollback. Logs use
IDs, timings, versions, and reason codes rather than customer values or images.

### Remaining production inputs and evidence

- Confirm traffic, workload, concurrency, availability, stage budgets, RPO,
  RTO, regional, retention, legal-hold, deletion, and cost targets.
- Load-test mixed document traffic and review work; report queue, stage, and
  end-to-end latency, saturation, retries, failures, resource use, and cost.
- Test duplicate delivery, worker loss, storage and GPU failure, database
  failover, webhook outage, backup restore, tenant isolation, egress denial,
  log redaction, access revocation, and retention deletion.
- Consolidate infrastructure only after shared replacements pass the same load,
  recovery, privacy, audit, and cost gates with rollback and full cleanup.

## A12 evaluation and learning plan

### Scope and accepted direction

A12 keeps training, confidence calibration, untouched release testing, and
production audit data separate by source artifact and application, with
template-family and time isolation where possible. The 99% target is final
customer field accuracy measured end to end; automatic accuracy, false accepts,
coverage, review, rejection, latency, and cost remain separate gates.

Reviewer corrections become training candidates only after schema validation,
A7 revalidation, evidence checks, reviewer-quality gates, retention checks, and
versioned dataset inclusion. They never update a live model or policy directly.
Each pinned model, calibration, rule, and routing bundle must beat the current
baseline offline, then pass shadow and canary gates with rollback.

### Remaining production inputs and evidence

- Confirm the field-accuracy unit, critical-field false-accept budgets, minimum
  sample sizes, confidence intervals, promotion authority, and rollback gates.
- Define labeling, adjudication, reviewer audit, permitted training use,
  lineage, retention, deletion, and template-isolation policy.
- Publish reproducible release reports with slice counts, confidence intervals,
  paired baseline comparisons, calibration, hardware latency, review impact,
  and total cost.
- Audit random automatic completions to prevent selective-label bias and use
  drift evidence, not a schedule alone, to trigger retraining investigations.
- Remove automated learning steps that show no measured benefit across several
  cycles; retain independent evaluation, lineage, audit sampling, and rollback.

## Model recommendation

Recommend Qwen3-VL-8B-Instruct as the initial self-hosted baseline, subject to evaluation against larger Qwen variants, Gemma, and appropriate Mistral vision models.

The submission will not claim that the selected model achieves the required accuracy without evaluation against Ocrolus's held-out golden dataset.

## Prototype capabilities

- Typed pay-stub schema
- Earnings and deductions represented as line items
- Explicit null handling
- Field-level confidence and evidence
- Arithmetic reconciliation
- Date validation
- Required-field validation
- Critical-field-aware routing
- Human-review reasons and targeted fields
- Configurable provisional thresholds

## Implemented tests

1. Clean extraction auto-accepts
2. Synthetic pay stub flags suspicious YTD deduction fields
3. Gross/net mismatch triggers full review
4. Missing critical field triggers full review
5. Isolated uncertain noncritical field triggers field review
6. Unreadable input triggers rejection
7. Unknown deduction labels are preserved
8. Optional null fields are not guessed
9. Weak critical-field confidence cannot hide inside an average
10. Every demo result validates against the public JSON Schema
11. CLI summary mode exposes the routing decision and exact review paths

## Planned repository structure

```text
ocrolus-takehome/
├── README.md
├── DESIGN.md
├── WRITEUP.md
├── PROJECT_PLAN.md
├── pyproject.toml
├── src/ocrolus_takehome/
│   ├── models.py
│   ├── validation.py
│   ├── confidence.py
│   ├── routing.py
│   ├── result.py
│   └── demo.py
├── fixtures/
│   ├── clean_candidate.json
│   └── edge_cases/
├── mockups/
│   ├── review-desk.html
│   └── review-desk.png
└── tests/
    ├── test_validation.py
    ├── test_confidence.py
    ├── test_routing.py
    ├── test_result.py
    └── test_demo.py
```

## Explicit exclusions

- No actual model training or fine-tuning
- No claim of measured 99% accuracy
- No claim that Qwen was run unless it actually is
- No OCR or document-classifier implementation
- No production cloud infrastructure
- No production review service, queue, authentication, or persistence; the
  shipped frontend is an explicitly local-state workflow simulation
- No public repository or external sharing without approval
- No fabricated time log

## Completion criteria

- All automated tests pass
- The demo produces valid typed JSON
- Every requirement in the brief is addressed
- The main trade-offs and exclusions are explicit
- No secrets or unnecessary sensitive data are included
- The system design is implementable by an engineer
- A separate defense sheet explains every major decision
- Every system component has measurable removal or merge criteria, required
  proof, cleanup scope, and a rollback path
