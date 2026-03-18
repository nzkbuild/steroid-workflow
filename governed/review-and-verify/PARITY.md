# Parity: Steroid Review And Verify Live Transplant

## Scope

This receipt covers live transplant parity for:

- `tasks_md` mapping to `.memory/changes/<feature>/tasks.md`
- `review_report` mapping to `.memory/changes/<feature>/review.json` and `.memory/changes/<feature>/review.md`
- `execution_receipts` mapping to `.memory/changes/<feature>/execution.json`
- `verification_verdict` mapping to `.memory/changes/<feature>/verify.json` and `.memory/changes/<feature>/verify.md`

## Parity Targets

1. `tasks-to-review-ordering`
2. `review-report-structure`
3. `execution-to-verification-ordering`
4. `verification-verdict-structure`

## Governed Basis

- `governed/review-and-verify/MODULE.yaml`
- `governed/review-and-verify/LIVE-MAPPING.md`
- `governed/review-and-verify/examples/review_report.v1.md`
- `governed/review-and-verify/examples/verification_verdict.v1.yaml`
- `skills/steroid-verify/SKILL.md`

## Verdicts

### `tasks-to-review-ordering`

Verdict: `PASS`

Reasoning:

- `skills/steroid-verify/SKILL.md` now requires `.memory/changes/<feature>/tasks.md` to be loaded as the task-completion input for review.
- The live review stage remains upstream of final verification and preserves the governed two-stage review order.

### `review-report-structure`

Verdict: `PASS`

Reasoning:

- `skills/steroid-verify/SKILL.md` now defines `.memory/changes/<feature>/review.md` and `.memory/changes/<feature>/review.json` as the durable review outputs from the two-stage review gate.
- `governed/review-and-verify/examples/review_report.v1.md` preserves the governed structural expectation for severity-based review findings and recommendations.

### `execution-to-verification-ordering`

Verdict: `PASS`

Reasoning:

- `skills/steroid-verify/SKILL.md` now requires `.memory/changes/<feature>/execution.json` to be loaded as fresh execution evidence when present.
- The final verification verdict remains downstream of execution evidence and the two-stage review gate.

### `verification-verdict-structure`

Verdict: `PASS`

Reasoning:

- `skills/steroid-verify/SKILL.md` writes `.memory/changes/<feature>/verify.md` and `.memory/changes/<feature>/verify.json` as the durable verification outputs.
- `governed/review-and-verify/examples/verification_verdict.v1.yaml` preserves the governed structural expectation for a machine-readable verdict attributable to fresh evidence.

## Overall Parity Status

Overall parity status for the live `steroid-review-and-verify` transplant: `PASS`

Interpretation:

- The live transplant preserves durable review outputs and durable verification outputs.
- The live transplant preserves evidence-before-claims verification semantics.
