# Live Mapping: Steroid Spec System

## Baseline

Authoritative baseline: reset-lab governed `steroid-spec-system` on 2026-03-18.

This live repo implements that governed subsystem through two existing runtime surfaces:

- `skills/steroid-specify/SKILL.md`
- `skills/steroid-architect/SKILL.md`

## Artifact Mapping

| Reset-Lab Artifact / Signal | Live Repo Surface | Notes |
| --- | --- | --- |
| `feature_request` | `.memory/changes/<feature>/vibe.md` plus optional `.memory/changes/<feature>/prompt.json` | Live repo still normalizes user intent into vibe/prompt artifacts before specification. |
| `spec_md` | `.memory/changes/<feature>/spec.md` | Implemented by `skills/steroid-specify/SKILL.md`. |
| `readiness_signal` | `**Status**: Ready for Research` in `spec.md` plus automatic handoff to research | Live deviation: signal is encoded by spec status and handoff, not as a standalone receipt artifact. |
| `plan_md` | `.memory/changes/<feature>/plan.md` | Implemented by `skills/steroid-architect/SKILL.md`. |

## Implementation Mapping

| Governed Baseline Behavior | Live Repo Implementation |
| --- | --- |
| spec generation | `skills/steroid-specify/SKILL.md` |
| planning generation | `skills/steroid-architect/SKILL.md` |
| downstream readiness handoff | `skills/steroid-specify/SKILL.md` one-sentence handoff plus `gate research` / `gate architect` enforcement |

## Explicit Deviations

1. The live repo does not expose `readiness_signal` as a standalone governed signal artifact.
   - It is represented by `spec.md` status and immediate research handoff.
2. The live repo implements one governed module across two runtime skills.
   - This is an implementation split, not a baseline redesign.

## Authority Order

For live `steroid-spec-system`, authority order is:

1. `governed/spec-system/MODULE.yaml`
2. this mapping note
3. `governed/spec-system/PROVENANCE.md`
4. `governed/spec-system/PARITY.md`
5. runtime skill files
