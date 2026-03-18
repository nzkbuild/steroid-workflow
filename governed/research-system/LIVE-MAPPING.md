# Live Mapping: Steroid Research System

## Baseline

Authoritative baseline: reset-lab governed `steroid-research-system` on 2026-03-18.

This live repo currently implements that governed subsystem through:

- `skills/steroid-research/SKILL.md`

## Artifact Mapping

| Reset-Lab Artifact / Signal | Live Repo Surface | Notes |
| --- | --- | --- |
| `codebase_map` | `.memory/changes/<feature>/context.md` | Canonical live structured map artifact from the governed scan slice. |
| `research_summary` | `.memory/changes/<feature>/research.md` | Canonical live durable research artifact. |

## Implementation Mapping

| Governed Baseline Behavior | Live Repo Implementation |
| --- | --- |
| structured research synthesis from codebase map | `skills/steroid-research/SKILL.md` |
| confidence and gap reporting | `skills/steroid-research/SKILL.md` |
| durable research artifact | `.memory/changes/<feature>/research.md` |

## Explicit Deviations

1. The live research implementation also consumes `.memory/changes/<feature>/spec.md` as an upstream scoped brief.
   - This is an implementation addition on top of the governed `codebase_map` input, not a replacement for it.

## Authority Order

For live `steroid-research-system`, authority order is:

1. `governed/research-system/MODULE.yaml`
2. this mapping note
3. `governed/research-system/PROVENANCE.md`
4. `governed/research-system/PARITY.md`
5. runtime skill file
