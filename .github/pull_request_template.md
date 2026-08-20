## Summary

Describe the scoped change and the design or prototype section it affects.

## Verification

- [ ] `uv run --extra test --no-editable ruff check src tests`
- [ ] `uv run --extra test --no-editable ruff format --check src tests`
- [ ] `uv run --extra test --no-editable pytest`
- [ ] `cd review-desk-site && npm ci && npm run lint && npm test`
- [ ] Public output and internal review-task contracts remain synchronized
- [ ] Documentation, evaluation, and removal criteria are updated where needed
- [ ] No secrets, customer data, full SSNs, generated builds, or source brief
      were added

## Risk and rollback

State the failure mode, affected users or documents, and how to revert safely.
