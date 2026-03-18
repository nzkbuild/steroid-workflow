# Provenance: Steroid Scan System Live Transplant

## Source Basis

This live transplant is sourced from the reset-lab governed baseline for:

- `steroid-scan-system` minimal slice

## Live Target Paths

- `governed/scan-system/MODULE.yaml`
- `governed/scan-system/LIVE-MAPPING.md`
- `governed/scan-system/PARITY.md`
- `governed/scan-system/examples/codebase_map.v1.yaml`
- `skills/steroid-scan/SKILL.md`
- `bin/steroid-run.cjs`

## Behavior Under Governance

- `.memory/changes/<feature>/request.json` is the durable live feature request receipt for scan
- `.memory/changes/<feature>/context.md` is the live durable codebase map artifact
- scan remains focused on structured mapping rather than planning or synthesis

## Out Of Scope

This live transplant does not yet provide:

- research synthesis
- implementation planning
- concern triage beyond the structured map
- secrets remediation

## Closure Basis

Closure status for this transplant is recorded in:

- `governed/scan-system/PARITY.md`
