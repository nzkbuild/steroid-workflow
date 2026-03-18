# Live Mapping: Steroid Core Runtime

## Baseline

Authoritative baseline: reset-lab governed `steroid-core-runtime` on 2026-03-18.

This live repo currently implements that governed subsystem through:

- `skills/steroid-verify/SKILL.md`
- `node steroid-run.cjs archive <feature>`

## Artifact Mapping

| Reset-Lab Artifact / Signal | Live Repo Surface | Notes |
| --- | --- | --- |
| `verification_verdict` | `.memory/changes/<feature>/verify.json` | Governed upstream verification artifact. |
| `progress_log` | `.memory/progress.md` | Governed upstream append-only progress artifact. |
| `completion_receipt` | `.memory/changes/<feature>/completion.json` | Durable live completion receipt prepared after verification and before archive. |

## Implementation Mapping

| Governed Baseline Behavior | Live Repo Implementation |
| --- | --- |
| completion prepared only after verification | `skills/steroid-verify/SKILL.md` |
| completion receipt includes fixed choices | `skills/steroid-verify/SKILL.md` writes `.memory/changes/<feature>/completion.json` |
| archive remains downstream of completion preparation | `node steroid-run.cjs archive <feature>` |

## Explicit Deviations

None for this governed slice.

## Authority Order

For live `steroid-core-runtime`, authority order is:

1. `governed/core-runtime/MODULE.yaml`
2. this mapping note
3. `governed/core-runtime/PROVENANCE.md`
4. `governed/core-runtime/PARITY.md`
5. runtime skill and CLI files
