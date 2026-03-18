# Live Mapping: Steroid Review And Verify

## Baseline

Authoritative baseline: reset-lab governed `steroid-review-and-verify` on 2026-03-18.

This live repo currently implements that governed subsystem through:

- `skills/steroid-verify/SKILL.md`

## Artifact Mapping

| Reset-Lab Artifact / Signal | Live Repo Surface | Notes |
| --- | --- | --- |
| `tasks_md` | `.memory/changes/<feature>/tasks.md` | Primary live review input artifact produced by the governed execution engine transplant. |
| `review_report` | `.memory/changes/<feature>/review.json` plus `.memory/changes/<feature>/review.md` | `review.json` is the machine-readable review receipt; `review.md` is the human-readable companion. |
| `execution_receipts` | `.memory/changes/<feature>/execution.json` | Primary live verification evidence artifact produced by the governed execution engine transplant. |
| `verification_verdict` | `.memory/changes/<feature>/verify.json` plus `.memory/changes/<feature>/verify.md` | `verify.json` is the machine-readable verification verdict; `verify.md` is the human-readable companion. |

## Implementation Mapping

| Governed Baseline Behavior | Live Repo Implementation |
| --- | --- |
| two-stage review flow | `skills/steroid-verify/SKILL.md` review gate and review commands |
| evidence-before-claims verification | `skills/steroid-verify/SKILL.md` verification gate and final receipt rules |
| durable review artifacts | `skills/steroid-verify/SKILL.md` writes `review.md` and `review.json` |
| durable verification artifacts | `skills/steroid-verify/SKILL.md` writes `verify.md` and `verify.json` |

## Explicit Deviations

None for this governed slice.

## Authority Order

For live `steroid-review-and-verify`, authority order is:

1. `governed/review-and-verify/MODULE.yaml`
2. this mapping note
3. `governed/review-and-verify/PROVENANCE.md`
4. `governed/review-and-verify/PARITY.md`
5. runtime skill file
