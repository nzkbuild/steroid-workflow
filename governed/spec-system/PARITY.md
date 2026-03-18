# Parity: Steroid Spec System Live Transplant

## Scope

This receipt covers live transplant parity for:

- `feature_request` mapping into live intake artifacts
- `spec_md` mapping to `.memory/changes/<feature>/spec.md`
- `plan_md` mapping to `.memory/changes/<feature>/plan.md`

## Parity Targets

1. `spec-driven-ordering`
2. `specification-structure`
3. `spec-to-plan-ordering`
4. `planning-structure`

## Governed Basis

- `governed/spec-system/MODULE.yaml`
- `governed/spec-system/LIVE-MAPPING.md`
- `governed/spec-system/examples/spec_md.v1.md`
- `governed/spec-system/examples/plan_md.v1.md`
- `skills/steroid-specify/SKILL.md`
- `skills/steroid-architect/SKILL.md`

## Verdicts

### `spec-driven-ordering`

Verdict: `PASS`

Reasoning:

- `skills/steroid-specify/SKILL.md` consumes the live feature intake artifacts and writes `spec.md`.
- `skills/steroid-architect/SKILL.md` consumes `spec.md` only after research completes, preserving specification-first ordering.

### `specification-structure`

Verdict: `PASS`

Reasoning:

- `skills/steroid-specify/SKILL.md` requires user stories, acceptance criteria, edge cases, success criteria, and hard constraints.
- `governed/spec-system/examples/spec_md.v1.md` preserves the governed structural fixture for `spec_md`.

### `spec-to-plan-ordering`

Verdict: `PASS`

Reasoning:

- `skills/steroid-architect/SKILL.md` requires `.memory/changes/<feature>/spec.md` and `.memory/changes/<feature>/research.md` before `plan.md` can be produced.
- The live runtime still keeps plan generation downstream of the specification artifact.

### `planning-structure`

Verdict: `PASS`

Reasoning:

- `skills/steroid-architect/SKILL.md` requires explicit tech stack and execution checklist structure.
- `governed/spec-system/examples/plan_md.v1.md` preserves the governed structural fixture for `plan_md`.

## Overall Parity Status

Overall parity status for the live `steroid-spec-system` transplant: `PASS`

Interpretation:

- The live transplant is parity-aligned for the governed spec and plan surfaces.
- The live mapping keeps one explicit deviation: readiness signaling is encoded by status and handoff instead of a standalone live artifact.
