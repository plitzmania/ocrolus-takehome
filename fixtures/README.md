# Fixtures

Most files are synthetic examples of typed upstream model output. Confidence
values exist to exercise routing branches; they are not calibrated
probabilities.

The included scenarios are:

- `clean_candidate.json` -> `AUTO_ACCEPT`
- `edge_cases/suspicious_ytd_candidate.json` -> `FIELD_REVIEW`
- `edge_cases/gross_net_mismatch_candidate.json` -> `FULL_REVIEW`
- `edge_cases/unreadable_candidate.json` -> `REJECT`
- `supplied_paystub_candidate.json` -> `FULL_REVIEW`

These are internal router outcomes. The lender-facing response contains full
business data only for `AUTO_ACCEPT`; every review outcome, including `REJECT`,
is status-only until a human resolves it. The review policy is intended to
minimize human need, not to assume every document can be automated safely.

`supplied_paystub_candidate.json` is a manual transcription of the assignment's
pay stub. It is explicitly labeled `manual_transcription_of_supplied_paystub`;
it is not claimed to be OCR or model output. The transcription omits the full
Social Security number and does not infer a pay frequency that the stub does
not print.
