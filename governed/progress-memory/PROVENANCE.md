# Provenance: Steroid Progress Memory Live Transplant

## Source Basis

This live transplant is sourced from the reset-lab governed baseline for:

- `steroid-progress-memory` minimal slice

## Live Target Paths

- `governed/progress-memory/MODULE.yaml`
- `governed/progress-memory/LIVE-MAPPING.md`
- `governed/progress-memory/PARITY.md`
- `governed/progress-memory/examples/progress_log.v1.yaml`
- `skills/steroid-engine/SKILL.md`
- `bin/steroid-run.cjs`

## Behavior Under Governance

- `.memory/progress.md` is the live durable progress artifact
- progress capture remains append-only
- verification outcomes and execution learnings are captured into the live progress artifact without replacing prior entries

## Out Of Scope

This live transplant does not yet provide:

- feature-local progress artifacts separate from `.memory/progress.md`
- structured knowledge store governance
- archival diary behavior
- project activation queue governance

## Closure Basis

Closure status for this transplant is recorded in:

- `governed/progress-memory/PARITY.md`
