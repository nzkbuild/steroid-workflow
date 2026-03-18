# Live Mapping: Steroid Scan System

## Baseline

Authoritative baseline: reset-lab governed `steroid-scan-system` on 2026-03-18.

This live repo currently implements that governed subsystem through:

- `skills/steroid-scan/SKILL.md`
- `node steroid-run.cjs scan <feature>`

## Artifact Mapping

| Reset-Lab Artifact / Signal | Live Repo Surface | Notes |
| --- | --- | --- |
| `feature_request` | `.memory/changes/<feature>/request.json` | Durable live scan-time request receipt created before context capture. |
| `codebase_map` | `.memory/changes/<feature>/context.md` | Canonical live structured codebase map artifact. |

## Implementation Mapping

| Governed Baseline Behavior | Live Repo Implementation |
| --- | --- |
| initial request receipt for scan | `skills/steroid-scan/SKILL.md` |
| structured codebase mapping | `skills/steroid-scan/SKILL.md` |
| bootstrap context artifact | `node steroid-run.cjs scan <feature>` |

## Explicit Deviations

None for this governed slice.

## Authority Order

For live `steroid-scan-system`, authority order is:

1. `governed/scan-system/MODULE.yaml`
2. this mapping note
3. `governed/scan-system/PROVENANCE.md`
4. `governed/scan-system/PARITY.md`
5. runtime skill and CLI files
