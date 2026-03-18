# Provenance: Steroid Review And Verify Live Transplant

## Source Basis

This live transplant is sourced from the reset-lab governed baseline for:

- `steroid-review-and-verify` first slice
- `steroid-review-and-verify` review expansion

## Live Target Paths

- `governed/review-and-verify/MODULE.yaml`
- `governed/review-and-verify/LIVE-MAPPING.md`
- `governed/review-and-verify/PARITY.md`
- `governed/review-and-verify/examples/review_report.v1.md`
- `governed/review-and-verify/examples/verification_verdict.v1.yaml`
- `skills/steroid-verify/SKILL.md`

## Behavior Under Governance

- `.memory/changes/<feature>/tasks.md` is the live durable task input artifact for review
- `.memory/changes/<feature>/execution.json` is the live durable execution evidence artifact for verification
- `.memory/changes/<feature>/review.json` with `review.md` companion is the live durable review output
- `.memory/changes/<feature>/verify.json` with `verify.md` companion is the live durable verification output
- evidence-before-claims semantics remain governed

## Out Of Scope

This live transplant does not yet provide:

- standalone frontend audit artifact governance
- browser or accessibility adapter execution governance
- release decision policy governance
- feedback handling governance

## Closure Basis

Closure status for this transplant is recorded in:

- `governed/review-and-verify/PARITY.md`
