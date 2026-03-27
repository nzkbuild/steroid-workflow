# Steroid-Workflow

[![npm version](https://img.shields.io/npm/v/steroid-workflow)](https://www.npmjs.com/package/steroid-workflow)
[![license](https://img.shields.io/npm/l/steroid-workflow)](LICENSE)
[![node](https://img.shields.io/node/v/steroid-workflow)](https://nodejs.org)
[![CI](https://github.com/nzkbuild/steroid-workflow/actions/workflows/ci.yml/badge.svg)](https://github.com/nzkbuild/steroid-workflow/actions/workflows/ci.yml)

Steroid-Workflow is a guardrailed AI coding runtime for people who want AI speed without AI chaos.

It gives your assistant a real delivery path:

- understand the request
- inspect the codebase
- write a spec
- research the right approach
- make a plan
- build with guardrails
- verify before claiming success

The result is simple: less guessing, less fake progress, fewer broken handoffs, and much better output quality.

## Why People Use It

Raw AI coding tools are fast, but they drift:

- they jump to code before understanding the task
- they forget requirements halfway through
- they claim things are done without proof
- they patch symptoms instead of finding causes
- they leave you with a pile of files and no confidence

Steroid-Workflow is built to stop that.

It gives the model a structured path, machine-readable receipts, gate checks, and safer runtime behavior so completion has to be earned, not narrated.

## Quick Start

### Stable

```bash
npx steroid-workflow init
```

### Beta

```bash
npx steroid-workflow@beta init
```

Then, inside your project, tell your assistant what you want:

```text
Build me a habit tracker like Apple Health
```

If it drifts, say:

```text
Use the steroid pipeline.
```

Works with any AI-powered IDE or CLI that can follow project instructions.

Once Steroid is installed, the simplest workflow is:

```bash
node steroid-run.cjs start habit-tracker
node steroid-run.cjs next habit-tracker
node steroid-run.cjs finish habit-tracker
```

## What Steroid Does

Steroid turns vague requests into a real workflow with checkpoints.

### Primary journey

For most work, the top-level flow is:

```text
start <feature> -> next <feature> -> finish <feature>
```

`start` bootstraps the feature and scan, `next` answers what to do now, and `finish` tells you whether review, verification, and archive are actually ready.

### Under the hood

Under the hood, Steroid still routes the work through a stricter internal pipeline. For normal feature work that usually means:

```text
scan -> vibe -> spec -> research -> architect -> engine -> review -> verify -> archive
```

For bug and repair work, the route becomes more diagnose-and-fix oriented instead of forcing the full feature path.

### What gets produced

As the workflow moves forward, Steroid writes durable artifacts under `.memory/changes/<feature>/`, including:

- `request.json`
- `context.md`
- `prompt.json`
- `prompt.md`
- `vibe.md`
- `spec.md`
- `research.md`
- `plan.md`
- `tasks.md`
- `execution.json`
- `review.md`
- `review.json`
- `verify.md`
- `verify.json`
- `completion.json`

These are not just logs. They are used by the runtime to decide whether later phases are allowed to proceed.

## What Makes It Different

### It blocks fake completion

Steroid does not just ask the model to “be careful.” It checks for real artifacts and receipts before allowing later phases like verify, report, and archive.

### It pushes the assistant to think before coding

The model is guided through codebase scanning, specification, research, architecture, and execution instead of improvising from the first prompt.

### It is safer for brownfield work

Steroid is designed for real repos, not just toy greenfield demos. It helps reduce silent deletion, fake tests, and reckless edits.

### It handles both product work and repair work

Feature building and debugging are different jobs. Steroid gives them different paths.

## Frontend Intelligence

### Frontend Support

Steroid has built-in frontend flows for UI-heavy work.

For UI-intensive features, it can generate and enforce:

- `design-routing.json`
- `design-system.md`
- `accessibility.json`
- `ui-audit.json`
- `ui-review.md`
- `ui-review.json`

That means frontend work is not just “make it look nice.” It can be routed, reviewed, audited, and verified like the rest of the pipeline.

Useful commands:

```bash
node steroid-run.cjs design-route "<message>" --feature <feature> --write
node steroid-run.cjs design-system --feature <feature> --write
node steroid-run.cjs design-prep "<message>" --feature <feature> --write
node steroid-run.cjs verify-feature <feature>
node steroid-run.cjs verify-feature <feature> --deep
node steroid-run.cjs verify-feature <feature> --deep --url <preview>
node steroid-run.cjs review ui <feature>
```

Steroid pairs this path with its internal frontend intelligence layer so UI-heavy work can move through a more opinionated design-and-review flow instead of pure freeform prompting.

If `ui-review.json` is `FAIL`, archive will stay blocked until the frontend issues are resolved.

## Safety and Guardrails

Steroid includes hardening specifically aimed at preventing common AI failure modes:

- intent routing so different kinds of work take different paths
- Prompt Intelligence for vague or messy requests
- circuit-breaker behavior for repeated failure
- command confinement and allowlist checks
- guarded file operations
- true verification receipts instead of “trust me”
- Optional Deep Verification for stronger frontend and runtime evidence

### Prompt Intelligence

Steroid can normalize rough user requests into something the rest of the pipeline can actually work with.

Useful commands:

```bash
node steroid-run.cjs normalize-prompt "<message>"
node steroid-run.cjs prompt-health "<message>"
node steroid-run.cjs session-detect
```

Optional Deep Verification is available through `verify-feature --deep`, and `verify-feature --deep --url <preview>` lets you point that browser-backed verification path at a specific preview when needed.

## Stable vs Beta

### Stable

Use stable if you want the most conservative install:

```bash
npx steroid-workflow init
```

### Beta

Use beta if you want the newest runtime hardening and governed workflow improvements first:

```bash
npx steroid-workflow@beta init
```

Current beta work focuses on:

- stricter artifact enforcement
- stronger verification and archive checks
- safer command/runtime behavior
- improved frontend routing and review receipts

## Update

```bash
npx steroid-workflow@latest update
```

or:

```bash
npx steroid-workflow@beta update
```

Your `.memory/` project state is preserved.

## Verify Installation

```bash
node steroid-run.cjs audit
```

This checks the enforcement/runtime setup inside the current project.

## License

MIT © [nzkbuild](https://github.com/nzkbuild)
