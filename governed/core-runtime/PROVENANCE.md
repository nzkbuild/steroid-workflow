# Provenance: Steroid Core Runtime Live Transplant

## Source Basis

This live transplant is sourced from the reset-lab governed baseline for:

- `steroid-core-runtime` minimal slice

## Live Target Paths

- `governed/core-runtime/MODULE.yaml`
- `governed/core-runtime/LIVE-MAPPING.md`
- `governed/core-runtime/PARITY.md`
- `governed/core-runtime/examples/completion_receipt.v1.yaml`
- `skills/steroid-verify/SKILL.md`
- `bin/steroid-run.cjs`

## Behavior Under Governance

- `.memory/changes/<feature>/completion.json` is the live durable completion artifact
- completion preparation remains downstream of `verify.json` and `.memory/progress.md`
- completion receipt preserves fixed completion choices before archive execution

## Out Of Scope

This live transplant does not yet provide:

- merge execution governance
- push/review execution governance
- keep/discard execution governance
- workspace cleanup governance

## Closure Basis

Closure status for this transplant is recorded in:

- `governed/core-runtime/PARITY.md`
