# Provenance: Steroid Execution Engine Live Transplant

## Source Basis

This live transplant is sourced from the reset-lab governed baseline for:

- `steroid-execution-engine` first slice
- `steroid-execution-engine` task-generation expansion

## Live Target Paths

- `governed/execution-engine/MODULE.yaml`
- `governed/execution-engine/LIVE-MAPPING.md`
- `governed/execution-engine/PARITY.md`
- `governed/execution-engine/examples/tasks_md.v1.md`
- `governed/execution-engine/examples/execution_receipts.v1.yaml`
- `skills/steroid-engine/SKILL.md`

## Behavior Under Governance

- plan-driven execution remains the live execution entry point
- `.memory/changes/<feature>/tasks.md` is the live durable task artifact
- `.memory/changes/<feature>/execution.json` is the live durable execution receipt
- blocker handling and guarded command discipline remain governed execution behavior

## Out Of Scope

This live transplant does not yet provide:

- standalone declared runtime `blocker_signal`

## Closure Basis

Closure status for this transplant is recorded in:

- `governed/execution-engine/PARITY.md`
