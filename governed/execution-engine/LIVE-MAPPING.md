# Live Mapping: Steroid Execution Engine

## Baseline

Authoritative baseline: reset-lab governed `steroid-execution-engine` on 2026-03-18.

This live repo currently implements that subsystem primarily through:

- `skills/steroid-engine/SKILL.md`

## Artifact Mapping

| Reset-Lab Artifact / Signal | Live Repo Surface | Notes |
| --- | --- | --- |
| `plan_md` | `.memory/changes/<feature>/plan.md` | Primary live consumed artifact. |
| `tasks_md` | `.memory/changes/<feature>/tasks.md` | Derived from the execution checklist in `plan.md` and mirrored during execution. |
| `execution_receipts` | `.memory/changes/<feature>/execution.json` | Durable execution receipt written during blocked or completed execution. |
| `blocker_signal` | circuit breaker faults, `recover`, and blocked-engine messages | Live deviation: blocker signaling is runtime behavior, not a standalone declared artifact. |

## Implementation Mapping

| Governed Baseline Behavior | Live Repo Implementation |
| --- | --- |
| plan-driven execution | `skills/steroid-engine/SKILL.md` |
| task ordering and execution loop | checklist loop in `skills/steroid-engine/SKILL.md` |
| blocker handling | circuit breaker, smoke test, anti-loop directive, and recovery flow in `skills/steroid-engine/SKILL.md` |

## Explicit Deviations

1. `blocker_signal` is behavioral rather than a declared runtime artifact.

## Consequence

This transplant now has credible standalone live equivalents for `tasks_md` and `execution_receipts`. The remaining deviation is limited to blocker signaling.

## Authority Order

For live `steroid-execution-engine`, authority order is:

1. `governed/execution-engine/MODULE.yaml`
2. this mapping note
3. `governed/execution-engine/PROVENANCE.md`
4. `governed/execution-engine/PARITY.md`
5. runtime skill file
