# Parity: Steroid Scan System Live Transplant

## Scope

This receipt covers live transplant parity for:

- `feature_request` mapping to `.memory/changes/<feature>/request.json`
- `codebase_map` mapping to `.memory/changes/<feature>/context.md`

## Parity Targets

1. `request-to-scan-ordering`
2. `codebase-map-structure`
3. `file-path-heavy-output`

## Governed Basis

- `governed/scan-system/MODULE.yaml`
- `governed/scan-system/LIVE-MAPPING.md`
- `governed/scan-system/examples/codebase_map.v1.yaml`
- `skills/steroid-scan/SKILL.md`
- `bin/steroid-run.cjs`

## Verdicts

### `request-to-scan-ordering`

Verdict: `PASS`

Reasoning:

- `skills/steroid-scan/SKILL.md` now requires `.memory/changes/<feature>/request.json` to exist before the structured scan output is finalized.
- `node steroid-run.cjs scan <feature>` remains the bootstrap entry point for the downstream `context.md` artifact.

### `codebase-map-structure`

Verdict: `PASS`

Reasoning:

- `.memory/changes/<feature>/context.md` is the canonical live structured map artifact for this slice.
- `governed/scan-system/examples/codebase_map.v1.yaml` preserves the governed expectation for stack, structure, testing, and concern mapping.

### `file-path-heavy-output`

Verdict: `PASS`

Reasoning:

- `skills/steroid-scan/SKILL.md` explicitly requires project structure, entry points, config, test paths, and related code paths.
- That preserves the file-path-heavy output shape of the governed scan slice.

## Overall Parity Status

Overall parity status for the live `steroid-scan-system` transplant: `PASS`

Interpretation:

- The live transplant preserves a durable request receipt and durable structured codebase map.
- The live transplant preserves focused mapping semantics without widening into research or planning.
