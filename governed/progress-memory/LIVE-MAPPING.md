# Live Mapping: Steroid Progress Memory

## Baseline

Authoritative baseline: reset-lab governed `steroid-progress-memory` on 2026-03-18.

This live repo currently implements that governed subsystem through:

- `.memory/progress.md`
- `node steroid-run.cjs log <feature> <message>`
- `skills/steroid-engine/SKILL.md`

## Artifact Mapping

| Reset-Lab Artifact / Signal | Live Repo Surface | Notes |
| --- | --- | --- |
| `verification_verdict` | `.memory/changes/<feature>/verify.json` | Governed upstream verification artifact consumed before final progress capture for this slice. |
| `progress_log` | `.memory/progress.md` | Canonical append-only live progress artifact. |

## Implementation Mapping

| Governed Baseline Behavior | Live Repo Implementation |
| --- | --- |
| append-only progress capture | `node steroid-run.cjs log <feature> <message>` appends timestamped entries to `.memory/progress.md` |
| execution learnings written to progress log | `skills/steroid-engine/SKILL.md` requires progress.md updates during execution |
| durable progress artifact | `.memory/progress.md` remains the single live progress log surface |

## Explicit Deviations

None for this governed slice.

## Authority Order

For live `steroid-progress-memory`, authority order is:

1. `governed/progress-memory/MODULE.yaml`
2. this mapping note
3. `governed/progress-memory/PROVENANCE.md`
4. `governed/progress-memory/PARITY.md`
5. runtime CLI and skill files
