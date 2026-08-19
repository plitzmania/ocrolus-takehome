# Fixtures

These files are synthetic examples of typed upstream model output. They are not
claimed to be OCR or model output from the supplied pay stub. Confidence values
exist to exercise routing branches; they are not calibrated probabilities.

The included scenarios are:

- `clean_candidate.json` -> `AUTO_ACCEPT`
- `edge_cases/suspicious_ytd_candidate.json` -> `FIELD_REVIEW`
- `edge_cases/gross_net_mismatch_candidate.json` -> `FULL_REVIEW`
- `edge_cases/unreadable_candidate.json` -> `REJECT`

These are internal router outcomes. The lender-facing response contains full
business data only for `AUTO_ACCEPT`; every review outcome, including `REJECT`,
is status-only until a human resolves it. The review policy is intended to
minimize human need, not to assume every document can be automated safely.

If a supplied pay stub is manually transcribed for a demo, that candidate must
retain the same honest `source` label.
