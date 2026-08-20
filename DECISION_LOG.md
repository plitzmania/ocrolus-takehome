# Decision Log

This log records the decisions made during the take-home, why they were made,
what was deliberately left out, and what evidence would cause a decision to be
revisited. It is source material for the Part C retrospective, not a substitute
for the technical design in [`DESIGN.md`](DESIGN.md).

Status meanings:

- **Accepted:** the project currently treats the decision as part of the design.
- **Provisional:** the direction is useful, but evaluation or a policy input is
  still required before production.
- **Deferred:** deliberately outside the current take-home scope.

## D-001 - Build the confidence, validation, and review router

- **Status:** Accepted
- **Recorded:** 2026-08-17
- **Decision:** Part B implements the pay-stub confidence, deterministic
  validation, and human-review router. It does not pretend to implement or run
  the upstream extraction model.
- **Why:** This is a meaningful component that can be exercised with typed
  candidates and edge cases within the stated 4-to-6-hour scope. It directly
  demonstrates what happens when the system is uncertain or inconsistent.
- **Tradeoff and deliberate cut:** The prototype is not an end-to-end document
  extractor. Model training, OCR, classification, production infrastructure,
  and the production review service remain design work. A thin review-desk
  simulation may demonstrate the router's internal task, but it must be labeled
  synthetic and cannot imply that persistence, audit, authorization, or live
  revalidation exists.
- **Revisit when:** The project scope expands beyond the take-home or a real
  fine-tuned checkpoint and evaluation corpus become available.

## D-002 - Separate technical design from the plain-English overview

- **Status:** Accepted
- **Recorded:** 2026-08-17
- **Decision:** Keep detailed contracts, stage mechanics, and policy inputs in
  `DESIGN.md`. Maintain `SYSTEM_OVERVIEW.md` as a less dense companion with
  processing and topology diagrams.
- **Why:** Engineers need an implementable design, while other readers need to
  understand the system without first learning every queue, artifact, and
  schema detail.
- **Tradeoff:** Two documents require consistency maintenance. The overview
  therefore links to the design, stays intentionally high-level, and labels
  unresolved details instead of creating a second technical specification.
- **Additional requirement:** Every pipeline section in the overview explains
  its timing and cost impact.
- **Revisit when:** The two documents begin to conflict or the final submission
  format imposes a tighter page limit.

## D-003 - Return document-supported facts, not underwriting conclusions

- **Status:** Accepted
- **Recorded:** 2026-08-17
- **Decision:** The pipeline reports only facts supported by the submitted
  document. Unsupported values are explicit `null` values. It does not
  annualize variable income, predict recurrence, or make a lending decision.
- **Why:** This keeps extraction separate from underwriting policy and prevents
  plausible but unsupported values from becoming business facts.
- **Tradeoff:** Downstream systems must perform their own policy calculations.
  That is deliberate because those calculations are outside the brief's
  extraction task.
- **Revisit when:** A separately owned downstream product supplies an explicit
  factual aggregation or underwriting contract.

## D-004 - Execute A3 as private CPU work before the vision model

- **Status:** Accepted
- **Recorded:** 2026-08-17
- **Decision:** A queue-driven, autoscaling CPU worker inside the private network
  renders pages, performs bounded corrections, measures image quality, stores
  derived page artifacts, and then enqueues A4. A3 does not call Qwen or another
  extraction model.
- **Why:** Rendering and ordinary image processing do not require expensive GPU
  inference. Standardized pages make classification, extraction, evidence
  mapping, latency, and resource use more predictable.
- **Tradeoff:** A separate stage adds a queue handoff and CPU latency, but it can
  prevent larger downstream GPU and review costs.
- **Revisit when:** Corpus benchmarks show that a model-based orientation or
  quality task materially improves field accuracy enough to justify its cost.

## D-005 - Limit A3 to safe, traceable corrections

- **Status:** Accepted
- **Recorded:** 2026-08-17
- **Decision:** A3 may apply trusted orientation, high-confidence quarter-turn
  rotation, modest deskew, and conservative brightness or contrast changes. It
  preserves the immutable source and records the coordinate transformation and
  processing provenance.
- **Why:** Upright, consistent pages help the later vision model, while source
  preservation and transform mapping keep evidence auditable.
- **Alternatives not selected:** A3 does not invent pixels, reconstruct text,
  remove marks, sharpen a value into a new reading, or automatically crop
  document content.
- **Tradeoff:** Conservative correction may leave some imperfect pages, but it
  avoids changing the meaning of a financial document.
- **Revisit when:** A proposed correction is proven on the held-out corpus to
  improve downstream field accuracy without changing evidentiary content.

## D-006 - Keep routine human review out of A3

- **Status:** Accepted
- **Recorded:** 2026-08-17
- **Decision:** Safe mechanical problems are corrected automatically. Usable
  borderline pages continue with warnings. Pages whose important content is
  missing or genuinely unreadable receive clear resubmission guidance. Manual
  A3 review is an exceptional, separately authorized path.
- **Why:** A person cannot recover information that is absent from a blurry or
  clipped source. Human effort is more valuable later when a readable page
  supports an uncertain financial value.
- **Tradeoff:** Some borderline pages will consume downstream processing before
  the system decides they need review. Passing warnings forward avoids rejecting
  potentially usable documents too early.
- **Revisit when:** Production data shows a well-defined A3 exception class that
  people can resolve reliably and cost-effectively.

## D-007 - Start A3 with local, replaceable document tools

- **Status:** Provisional
- **Recorded:** 2026-08-17
- **Decision:** Benchmark Poppler as the primary PDF renderer against MuPDF; use
  libvips for bounded raster operations, OpenCV for geometry and quality
  measurements, and headless LibreOffice for supported DOCX conversion.
- **Why:** These tools can run locally inside the controlled environment and
  keep customer files away from third-party conversion APIs.
- **Tradeoff:** Tool behavior, fidelity, resource use, security exposure, and
  licensing must be evaluated. The toolchain is versioned so an implementation
  can be replaced without changing the A3 contract.
- **Revisit when:** Representative-corpus benchmarks or security and licensing
  review favor a different renderer or image library.

## D-008 - Use Qwen3-VL-8B-Instruct as the extraction baseline to evaluate

- **Status:** Provisional
- **Recorded:** 2026-08-17
- **Decision:** Qwen3-VL-8B-Instruct is the initial A5 self-hosted baseline. It
  appears after A3 page preparation and A4 splitting and classification.
- **Why:** The brief requires a specific open-weight recommendation and
  company-controlled inference. The project needs a concrete starting point for
  comparison rather than a vague model family.
- **Tradeoff and alternatives:** The recommendation must be tested against
  larger Qwen variants, Gemma, and suitable Mistral vision models for field
  accuracy, latency, GPU cost, fine-tuning feasibility, licensing, and review
  rate. No unrun model is described as having achieved the target.
- **Revisit when:** Held-out evaluation shows another model offers a better
  accuracy-speed-cost frontier or the checkpoint fails a production constraint.

## D-009 - Do not invent thresholds or performance results

- **Status:** Accepted
- **Recorded:** 2026-08-17
- **Decision:** Numerical image-quality thresholds, render settings, confidence
  thresholds, and stage latency budgets must come from representative corpus
  evaluation and load tests. The design may set explicit targets, but it does
  not describe unmeasured performance as achieved.
- **Why:** The brief requires 99%+ field accuracy, under-60-second processing,
  and cost effectiveness. Unsupported numbers would make the design look more
  certain without making it more correct.
- **Tradeoff:** Some production parameters remain open in the take-home. The
  design compensates by stating the measurement and release process required to
  select them.
- **Revisit when:** Reproducible benchmark results are available.

## D-010 - Prefer targeted review over full-document review

- **Status:** Accepted
- **Recorded:** 2026-08-17
- **Decision:** A weak critical field cannot hide in a high document average.
  Isolated uncertain fields go to field review when safe; broader failures go to
  full review; a router rejection enters exception review before a human either
  produces a verified result or marks the document unprocessable. The policy
  minimizes review among choices that preserve accuracy, but does not promise
  that human review can be eliminated.
- **Why:** This protects field accuracy while limiting the slowest and most
  expensive part of the pipeline: human time.
- **Tradeoff:** Field-level evidence, confidence, and routing logic add schema
  and system complexity, but they reduce unnecessary full-document work and
  make review decisions explainable.
- **Revisit when:** Calibration shows that field review does not preserve enough
  context for reviewers to correct values reliably.

## D-011 - Treat one file as one document unless evidence requires a split

- **Status:** Accepted
- **Recorded:** 2026-08-17
- **Decision:** A4 uses the uploaded file boundary as a strong prior. The common
  path keeps all pages in one logical document. Conditional splitting activates
  only when page-level evidence shows a clear type change or new-document
  boundary; ambiguous evidence is flagged rather than forced.
- **Why:** Lenders will commonly upload documents as separate files, so full
  package splitting on every source adds unnecessary complexity. The brief also
  states that one PDF may contain multiple W-2s, so file boundaries cannot be an
  absolute invariant.
- **Tradeoff:** The system must still collect enough page-level evidence to
  detect the uncommon combined-file case. A strong file prior lowers cost and
  false splits but could miss subtle boundaries if the detection policy is too
  conservative.
- **Revisit when:** The submission API guarantees one logical document per file,
  or production data shows that combined PDFs are common enough to justify a
  package-first splitter.

## D-012 - Model A3 through A5 as one typed execution graph

- **Status:** Accepted
- **Recorded:** 2026-08-18
- **Decision:** The zoomed A3-through-A5 design is one execution DAG containing
  deterministic CPU nodes, explicit shared-state handoffs, routing and
  validation gates, bounded GPU extraction agents, and human or resubmission
  endpoints. `Agent` names are reserved for generative model tasks; CPU
  classifiers and matchers remain nodes in the same graph without being called
  agentic.
- **Why:** The graph must show the real execution topology and handoff contracts,
  not just the model calls. This makes cost boundaries, failure isolation, and
  conditional routing visible without misrepresenting ordinary classifiers as
  autonomous agents.
- **Tradeoff:** A graph view can encourage unnecessary nodes. Closely related
  CPU operations, such as fingerprinting, registry lookup, and drift scoring,
  remain inside one Template Familiarity Detector unless they later require
  different infrastructure or recovery behavior.
- **Revisit when:** A node gains an independent loop, toolset, owner, scaling
  profile, or failure policy that justifies splitting it into a separate graph
  node.

## D-013 - Route A5 by benchmarked workload, not a character cutoff

- **Status:** Accepted
- **Recorded:** 2026-08-18
- **Decision:** A deterministic CPU Extraction Work Planner selects one complete
  General Extraction Agent call when the logical document fits the approved
  serving profile. Otherwise it creates the minimum safe number of contiguous
  page groups, runs bounded parallel agent instances, and merges their outputs
  deterministically. The policy and decision inputs are fixed; all numerical
  workload and concurrency values are TBD until benchmarked on the chosen model,
  GPU, runtime, corpus, and expected load.
- **Why:** Character count does not represent the cost of scanned documents.
  Visual tokens, resolution, expected structured output, context limits, memory,
  and remaining latency determine whether one model request is safe. Whole-
  document inference preserves context, while bounded fan-out keeps legitimately
  large documents from violating runtime or model limits. Without this policy,
  an always-whole approach risks slow or failed large requests, while an
  always-split approach increases GPU requests, repeated token work, merge cost,
  and queueing pressure for ordinary documents. Selecting the least expensive
  shape that fits the latency envelope directly supports both the under-60-
  second and cost requirements.
- **Tradeoff:** Parallel chunks may reduce wall-clock latency, but they repeat
  prompt work, can increase total GPU cost, add reconciliation complexity, and
  can lose cross-page context. The design therefore prefers one call and caps
  fan-out rather than treating more parallelism as automatically faster.
- **Revisit when:** Model, GPU, or workload changes invalidate the versioned
  serving profile, or evaluation shows that semantic chunking reduces accuracy.

## D-014 - Start A5 with one general extraction agent

- **Status:** Accepted
- **Recorded:** 2026-08-18
- **Decision:** The initial A5 path uses one self-hosted General Extraction
  Agent, with Qwen3-VL-8B-Instruct as the provisional base-model recommendation.
  Recovery and format-specific Specialist Agents remain conditional extensions,
  not components of the initial path.
- **Why:** Multiple models are not automatically faster or cheaper. They add
  routing, GPU capacity, evaluation, deployment, and maintenance cost. A second
  agent is justified only when held-out results identify a repeatable failure
  slice and show a worthwhile end-to-end accuracy or cost improvement.
- **Tradeoff:** The initial General Extraction Agent may use more capacity than
  a future specialist on a common template, or may underperform a larger model
  on difficult documents. Starting with one agent produces the evidence needed
  to determine whether either addition is useful.
- **Revisit when:** Held-out and production-slice evaluation demonstrates a
  stable, routeable failure pattern or cost opportunity.

## D-015 - Keep Part A model details at pipeline-sketch altitude

- **Status:** Accepted
- **Recorded:** 2026-08-18
- **Decision:** Part A explains A5's model role, evidence output, whole-versus-
  fan-out logic, offline tuning loop, new-format behavior, and cost and latency
  implications. Fine-tuning hyperparameters, GPU configuration, and numerical
  serving thresholds are explicitly deferred to implementation evaluation.
- **Why:** The prompt asks for a clear sketch of the full extraction pipeline.
  These details do not change how the stages connect and would obscure the
  decisions that materially affect accuracy, latency, cost, and human review.
- **Tradeoff:** The design is not a deployment runbook. It remains rigorous by
  naming which values require benchmarking instead of presenting unsupported
  numbers.
- **Revisit when:** Part B implementation or a production-readiness review needs
  a concrete serving and training specification.

## D-016 - Define 99% accuracy as a customer-facing final-output metric

- **Status:** Accepted
- **Recorded:** 2026-08-18
- **Decision:** The primary 99%+ field-accuracy target applies to the final
  fields delivered to the lender after any required human correction. It is
  measured end to end on a held-out golden set, overall and by supported
  document type. Automatic field accuracy before review is a leading indicator,
  reported with straight-through coverage, review and correction rates,
  rejections, and review completion time.
- **Why:** Customers consume the final delivered data, not the intermediate
  model prediction. Measuring only the model would ignore validation and review,
  while measuring only the final result without operational indicators could
  hide a system that sends nearly everything to expensive human review.
- **Tradeoff:** Human correction can help the primary accuracy metric even when
  automation is weak. Separate automatic-accuracy, coverage, latency, and cost
  reporting makes that tradeoff visible rather than redefining the customer
  outcome. The release policy should reduce human work as far as the accuracy
  gate permits while retaining people for unresolved exceptions.
- **Revisit when:** The customer contract defines a different accuracy unit or
  excludes human-corrected results from its acceptance criteria.

## D-017 - Treat model confirmation and extra agents as validation gates

- **Status:** Accepted
- **Recorded:** 2026-08-18
- **Decision:** Qwen3-VL-8B-Instruct remains the specific starting
  recommendation and the initial graph uses one General Extraction Agent. The
  checkpoint is confirmed through an end-to-end comparison on the held-out
  golden set. A Recovery or Specialist Agent is introduced only after a routed
  comparison against the one-agent baseline proves a repeatable, detectable
  failure slice and a worthwhile improvement in total accuracy, latency, or
  cost after GPU and human-review costs are included. These gates run before
  release; production monitoring then validates the assumptions against real
  formats, traffic, latency, cost, review volume, and corrections.
- **Why:** Neither a model name nor a more complex graph proves performance.
  These choices depend on private evaluation data, intended hardware, traffic,
  and review economics that are not available in the take-home.
- **Tradeoff:** The submission cannot claim the provisional checkpoint is the
  measured winner. It still makes a concrete recommendation and defines the
  evidence that would confirm or replace it without leaving the architecture
  open-ended.
- **Revisit when:** Held-out benchmark, load-test, traffic, and review-cost data
  are available.

## D-018 - Withhold business data until a result is complete

- **Status:** Accepted
- **Recorded:** 2026-08-19
- **Decision:** Lender-facing responses contain pay-stub business values only
  for `COMPLETED_AUTO` or `COMPLETED_HUMAN_VERIFIED`. `NEEDS_REVIEW` and
  `UNPROCESSABLE` are status-only. A8's `REJECT` creates human exception review;
  technical failure remains a separate retryable job state. Human-verified
  values use a distinct status and no fabricated model-confidence score.
- **Why:** A lender should not have to identify and ignore uncertain fields.
  Withholding the entire candidate until completion makes the safety boundary
  enforceable in the schema. Human review remains available where automation
  cannot protect accuracy, while targeted review and policy calibration are
  explicitly intended to minimize how often it is needed.
- **Delivery:** Results are immutable numbered revisions. With no lender
  integration details available, the proposed default is a minimal signed
  webhook followed by authenticated retrieval, with polling fallback,
  at-least-once delivery, event-ID deduplication, bounded retry, and stale-
  revision protection. Detailed evidence, validation, provenance, and review
  history remain in the internal audit system.
- **Latency:** The standard p95 under-60-second SLO ends at an automatic result
  or a review-ready status. Human completion uses a separate visible SLA.
- **Tradeoff:** Status-only gating delays all business fields when even one field
  needs review, and at-least-once webhooks may duplicate notifications. The
  simpler consumer rule and reliable delivery are worth those costs; revision
  numbers make duplicates harmless.
- **Revisit when:** A lender requires safe partial-field delivery, an existing
  integration standard dictates another transport, or measured review latency
  justifies a more granular contract without weakening the accuracy boundary.

## D-019 - Give every component measurable removal criteria

- **Status:** Accepted
- **Recorded:** 2026-08-19
- **Decision:** Every pipeline component must state when it can be simplified,
  merged, replaced, or removed; what end-to-end evidence is required; how it is
  migrated and rolled back; and which infrastructure, data, tests, alerts,
  dependencies, and ownership are deleted afterward.
- **Why:** Early safety layers and architecture choices can otherwise become
  permanent technical debt even after another component covers their job.
- **Guardrail:** Removal must preserve the system's accuracy, privacy, security,
  latency, cost, and audit requirements on representative held-out data and
  traffic. Independent evaluation remains even when an automated learning step
  is removed.
- **Tradeoff:** Maintaining ablation tests and reversible boundaries adds near-
  term work, but it makes the production stack easier to simplify safely.
- **Revisit when:** The company adopts a stronger organization-wide
  decommissioning standard that subsumes this requirement.

## D-020 - Use durable idempotent stage boundaries instead of claiming exactly-once execution

- **Status:** Accepted
- **Recorded:** 2026-08-19
- **Decision:** Each stage writes an immutable, versioned result before
  acknowledging queued work. At-least-once delivery, conditional state changes,
  bounded retries, and idempotency keys make duplicate execution safe. Permanent
  document outcomes remain separate from exhausted technical jobs.
- **Why:** Queue and worker failures are normal distributed-system behavior.
  Exactly-once execution across storage, models, review, and delivery would be a
  misleading claim and could duplicate expensive GPU or human work.
- **Tradeoff:** Durable boundaries add state and compatibility management, but
  provide replay, recovery, and auditable failure handling.
- **Removal criteria:** A standalone queue or state service may merge into a
  shared platform after failure-injection, recovery, privacy, load, and cost
  tests prove equivalent behavior and rollback remains available.
- **Revisit when:** The company platform supplies a stronger established job
  contract that preserves these invariants.

## D-021 - Separate training, calibration, release testing, and production audit data

- **Status:** Accepted
- **Recorded:** 2026-08-19
- **Decision:** Keep model-training data, A8 calibration data, an untouched
  release test set, and production audit samples separate by source artifact and
  application, with template-family and time isolation where practical.
  Reviewer corrections enter learning only after evidence, schema, reviewer-
  quality, retention, and lineage checks.
- **Why:** Reusing calibration or related documents for final testing inflates
  accuracy. Learning only from reviewed cases also misses errors that were
  automatically accepted.
- **Tradeoff:** Strict splits and label QA reduce immediately available training
  volume and add offline work, but make the 99% claim and model comparisons
  credible.
- **Removal criteria:** Automated retraining or active-learning steps may stop
  after several controlled cycles show no measurable value. Independent test,
  audit, lineage, regression, and rollback controls remain.
- **Revisit when:** The evaluation owner approves a statistically stronger split
  or continuous-evaluation design with equivalent leakage protection.

## Open decisions

These are not decisions yet and should not be presented as settled in Part C:

- A3's numerical render profile, quality thresholds, and stage latency budget;
- A4's classifier, boundary signals and thresholds, and ambiguity-review policy;
- the allowed review rate, reviewer unit cost, queue capacity, and separate
  human-completion SLA;
- production traffic, review-capacity, retention, recovery, and unit-cost inputs.
