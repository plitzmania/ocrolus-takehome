# Part C: How I Thought About It

## What I chose to build and why

I chose to build the trust layer between model extraction and delivery: a
pay-stub validator, confidence policy, and human-review router. The prototype
starts with typed candidate data from a simulated upstream extractor. It
checks the values and each field's confidence, then decides whether to accept
the result, ask a reviewer to inspect named fields, send the whole document for
review, or send an unreadable source to exception review. It produces an
internal decision with reasons and evidence, then exposes business data to the
lender only after the result is complete.

I chose this piece specifically because the difficult question in financial
document extraction is not whether a model can produce plausible JSON; it is
when the system should trust that JSON. A wrong net-pay value can look
well-formed and still cause a consequential downstream error. The router makes
that boundary explicit and testable. It also fit the time box while allowing me
to define a real output contract, exercise clean and adversarial cases, and
connect model output to human review without presenting a synthetic demo as a
production extractor.

The implementation combines deterministic checks for missing or inconsistent
values with a confidence policy that evaluates fields individually. I did not
route on average confidence alone, because many strong fields could hide one
weak but important value such as net pay. The four outcomes make the operational
consequence clear: accept, targeted review, full review, or request a better
source after human confirmation. The policy is meant to minimize human review
as far as measured accuracy allows, but it does not promise that review can be
eliminated.

## What I deliberately left out and why

I did not build OCR, image cleanup, document classification, model inference,
or fine-tuning. The included fixtures are explicitly synthetic upstream output,
and their confidence values are inputs chosen to exercise routing behavior,
not measured probabilities. Building a thin model demo without a representative
labeled corpus would have consumed most of the time box while saying very
little about production accuracy. Worse, it could make hand-selected examples
look like evaluation evidence. I preferred to make the boundary honest and the
implemented component rigorous.

I also did not build a production review service, database, or queue. I included
an interactive review-desk frontend wired to a versioned internal task from the
Python router, but its actions are deliberately simulated and stored only in
browser state. Durable task assignment, audit history, access control, reviewer
quality, and reprocessing after corrections need product and operational
decisions that a frontend prototype cannot validate.

Finally, I limited the executable prototype to pay stubs. The larger design
covers W-2s, bank statements, and multi-document packages, but implementing
those paths would have traded depth for breadth. I also left confidence
calibration and the final threshold values out. The code has configurable
example thresholds so every route can be demonstrated, but choosing production
values without labeled data, review costs, and an agreed error budget would be
false precision. The prototype returns only facts supported by the document;
it does not annualize variable earnings or make underwriting decisions.

## Main trade-offs

The first trade-off was a narrow, dependable component instead of an end-to-end
extractor. The core remains deterministic, inspectable, and covered by tests;
the frontend makes that boundary demonstrable without pretending to implement
OCR or model inference. The design also isolates the decision policy from the
eventual extraction model.

The second trade-off was explainability versus coverage. Arithmetic and date
rules are cheap and easy to audit, but two incorrect numbers can still
reconcile. Confidence adds another signal, but uncalibrated scores are not
probabilities of correctness. The system combines both signals and preserves
source evidence, while leaving real error rates to production evaluation.

The third trade-off was targeted review versus workflow simplicity. Sending an
isolated uncertain field to a reviewer should reduce human time, but it requires
stable field paths, accurate evidence, and enough context to make the right
correction. The router escalates critical, low-confidence, or broad failures to
full review. That is conservative, although too much review could make the
system slow or expensive. I therefore optimize for straight-through completion
and targeted review among policies that preserve accuracy, while retaining
people for the exceptions automation cannot safely resolve.

The fourth trade-off was transparency versus safe delivery. Internal reviewers
need candidate values, confidence, evidence, and validation findings, but a
lender could mistakenly consume those fields. The lender-facing contract
therefore returns status only until the result is complete, while the richer
audit record remains inside the controlled environment.

## What I would do differently with more time or a full team

My next step would be to connect this contract to a real self-hosted extractor
and build a representative golden dataset before adding more rules. I would
separate training, calibration, and untouched test sets; calibrate confidence
by field type and meaningful document slices; and measure exact field accuracy,
false auto-accepts, straight-through coverage, review rate, p50/p95 latency, and
cost per completed document. I would run the policy in shadow mode and audit a
random sample of auto-accepted results before enabling automatic delivery.

With a full team, I would build the review service alongside the data and
evaluation work. Corrections would be revalidated, versioned, and retained as
auditable training candidates. Platform and security work would add idempotent
submissions, tenant-isolated storage, observability, load and failure testing,
versioning, and rollback gates. I would extend the contracts to W-2s and bank
statements only after the pay-stub path met the agreed targets.

## Questions I would want answered before production

1. Which fields are critical to downstream decisions, how is the 99% accuracy
   target calculated, and what false-auto-accept rate is acceptable for each
   critical field?
2. What separate human-review turnaround, capacity, and unit-cost targets should
   apply after the under-60-second automatic-result or review-ready endpoint,
   and what submission, status, and webhook conventions do existing lender
   integrations already require?
3. How representative is the available labeled corpus across employer
   templates, languages, image quality, and recent format drift, and what data
   retention, access, and audit requirements apply to documents and reviewer
   corrections?
