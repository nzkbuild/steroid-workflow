# Architecture

Technical documentation for contributors and power users.

## Enforcement Layers

Steroid-Workflow uses a 3-layer enforcement model:

```
Layer 3: Git Pre-Commit Hook          ← HARD BLOCK (can't bypass)
Layer 2: Config PREPEND + Effort 2.0  ← HIGH PRIORITY (top of config)
Layer 1: Universal IDE Coverage       ← REACH (all major AI IDEs)
```

### Layer 1: IDE Config Injection

The installer injects Maestro rules (the AI's operating instructions) into config files for 6 IDEs. Rules are **prepended** to the top of each config file for maximum LLM priority — models weight beginning-of-context instructions higher than end-of-context.

### Layer 2: Effort Directive

Every injected config starts with:

```
SPECIAL INSTRUCTION: Think silently if needed. EFFORT LEVEL 2.00
```

This forces the AI to use deep processing mode, reducing the chance it skims past the steroid rules.

### Layer 3: Git Pre-Commit Hook

A shell script at `.git/hooks/pre-commit` that:

1. Detects if source code files (`.js`, `.ts`, `.py`, etc.) are being committed
2. If yes, checks that `.memory/changes/*/plan.md` exists
3. If no plan exists, **blocks the commit** with a message telling the AI to use the pipeline

This is the only enforcement that works regardless of AI model, IDE, or prompt quality. Commits made via `node steroid-run.cjs commit` use the `feat(steroid):` prefix, which the hook recognizes and allows through.

## Pipeline Enforcer (`steroid-run.cjs`)

All AI terminal commands are routed through this CLI wrapper.

### Circuit Breaker

| Command                                              | Purpose                                                                 |
| ---------------------------------------------------- | ----------------------------------------------------------------------- |
| `node steroid-run.cjs '<command>'`                   | Execute with error tracking (5 errors → graduated recovery → hard stop) |
| `node steroid-run.cjs run --cwd=<path> '<command>'`  | Execute safely inside a subdirectory without `cd && ...`                |
| `node steroid-run.cjs verify <file> --min-lines=<n>` | Block code summarization                                                |
| `node steroid-run.cjs reset`                         | Reset error counter + clear recovery state                              |
| `node steroid-run.cjs status`                        | Show circuit breaker state + recovery level                             |
| `node steroid-run.cjs recover`                       | Smart recovery guidance based on error level (v4.0)                     |

### Shell-Free FS

| Command                                                                                                                              | Purpose                                         |
| ------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------- | --------------------------------- |
| `node steroid-run.cjs fs-cat <file...> [--head=<n>] [--optional]`                                                                    | Read text files without shell builtins          |
| `node steroid-run.cjs fs-find [path...] [--name=<glob>] [--type=file                                                                 | dir] [--max-depth=<n>] [--limit=<n>] [--count]` | Find files without shell globbing |
| `node steroid-run.cjs fs-grep <pattern> [path...] [--include=<glob>] [--files-with-matches] [--limit=<n>] [--ignore-case] [--fixed]` | Search files without `grep`/`findstr`           |
| `node steroid-run.cjs fs-ls [path]`                                                                                                  | Show a condensed directory tree                 |
| `node steroid-run.cjs fs-mkdir <path>`                                                                                               | Create directories recursively                  |
| `node steroid-run.cjs fs-cp <src> <dest>`                                                                                            | Copy file or directory                          |
| `node steroid-run.cjs fs-mv <src> <dest>`                                                                                            | Move or rename file/directory                   |
| `node steroid-run.cjs fs-rm <path>`                                                                                                  | Remove file or directory safely                 |

### Pipeline Enforcement

| Command                                               | Purpose                                                                                                                                                                                                          | Origin    |
| ----------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------- |
| `init-feature <slug>`                                 | Create feature folder (validates kebab-case)                                                                                                                                                                     | OpenSpec  |
| `scan <feature>`                                      | Bootstrap codebase context (writes context.md)                                                                                                                                                                   | GSD/Ralph |
| `gate <phase> <feature>`                              | Check phase prerequisites                                                                                                                                                                                        | New       |
| `commit <message>`                                    | Atomic commit in `feat(steroid):` format                                                                                                                                                                         | Ralph/GSD |
| `log <feature> <message>`                             | Append to progress log                                                                                                                                                                                           | Ralph     |
| `check-plan <feature>`                                | Count remaining tasks                                                                                                                                                                                            | New       |
| `verify-feature <feature> [--deep] [--url <preview>]` | Core verification gate; `--deep` adds optional scanners and browser audit, and verification refreshes UI review receipts from current evidence                                                                   | GSD       |
| `review ui <feature>`                                 | Refresh frontend review receipts from current UI evidence                                                                                                                                                        | Steroid   |
| `archive <feature>`                                   | Date-stamped feature archival (requires `verify.json` PASS/CONDITIONAL`; refreshes stale UI review receipts, blocks on `ui-review.json` FAIL, and can require `--force-ui` for blocking `CONDITIONAL` frontend risk) | Ralph     |

### Intelligence (v3.0)

| Command                        | Purpose                                                    | Origin |
| ------------------------------ | ---------------------------------------------------------- | ------ |
| `detect-intent "<message>"`    | Classify user intent (build/fix/refactor/migrate/document) | New    |
| `normalize-prompt "<message>"` | Normalize a raw user prompt into a structured brief        | New    |
| `design-prep "<message>"`      | Generate design-routing + design-system together           | New    |
| `design-route "<message>"`     | Route UI work to Steroid's internalized frontend systems   | New    |
| `design-system "<message>"`    | Generate a design-system artifact from imported UI systems | New    |
| `prompt-health "<message>"`    | Score prompt clarity, ambiguity, and risk                  | New    |
| `session-detect`               | Detect continuation/recovery/project session state         | New    |
| `detect-tests`                 | Detect test framework in current project                   | GSD    |

### Progress & Diagnostics

| Command               | Purpose                                                               |
| --------------------- | --------------------------------------------------------------------- |
| `progress`            | Show execution learnings log                                          |
| `progress --patterns` | Show only codebase patterns                                           |
| `audit`               | Verify all enforcement layers (8 skills, 7 gates, 4 knowledge stores) |

### Knowledge & Memory (v4.0)

| Command                       | Purpose                                                              | Origin           |
| ----------------------------- | -------------------------------------------------------------------- | ---------------- |
| `memory show <store>`         | Display a knowledge store (tech-stack, patterns, decisions, gotchas) | MemoryCore       |
| `memory show-all`             | Display all knowledge stores                                         | MemoryCore       |
| `memory write <store> <json>` | Write/merge data into a store                                        | MemoryCore/Ralph |
| `memory stats`                | Show entry counts and metrics                                        | MemoryCore       |

### Stories & Recovery (v4.0)

| Command                  | Purpose                                    | Origin         |
| ------------------------ | ------------------------------------------ | -------------- |
| `stories <feature>`      | List prioritized stories (P1/P2/P3)        | spec-kit       |
| `stories <feature> next` | Show next story (P1 foundational blocking) | spec-kit/Ralph |
| `recover`                | Smart recovery guidance (5 levels)         | superpowers    |

## The 8-Skill Pipeline (v3.0)

### Governed Baseline

The live repo now carries governed baseline transplants under `governed/`. `governed/spec-system/` is authoritative for the live `steroid-spec-system` mapping and its parity/provenance notes.
`governed/execution-engine/` is authoritative for the live `steroid-execution-engine` mapping and documents the current runtime task and execution artifacts.
`governed/review-and-verify/` is authoritative for the live `steroid-review-and-verify` mapping and its review/verification artifact surface.
`governed/progress-memory/` is authoritative for the live `steroid-progress-memory` mapping and its append-only progress artifact surface.
`governed/core-runtime/` is authoritative for the live `steroid-core-runtime` mapping and its completion artifact surface.

### Build Intent (Full Pipeline)

| #   | Skill                  | Input                     | Output                                   |
| --- | ---------------------- | ------------------------- | ---------------------------------------- |
| 0   | `steroid-scan`         | Project codebase          | `.memory/changes/<feature>/context.md`   |
| 1   | `steroid-vibe-capture` | User's natural language   | `.memory/changes/<feature>/vibe.md`      |
| 2   | `steroid-specify`      | `vibe.md`                 | `.memory/changes/<feature>/spec.md`      |
| 3   | `steroid-research`     | `spec.md`                 | `.memory/changes/<feature>/research.md`  |
| 4   | `steroid-architect`    | `spec.md` + `research.md` | `.memory/changes/<feature>/plan.md`      |
| 5   | `steroid-engine`       | `plan.md`                 | Working code + `tasks.md` + `execution.json` |
| 6   | `steroid-verify`       | Completed code            | `.memory/changes/<feature>/review.md`, `.memory/changes/<feature>/review.json`, `.memory/changes/<feature>/verify.md`, `.memory/changes/<feature>/verify.json`, `.memory/changes/<feature>/completion.json`    |
| 7   | `steroid-diagnose`     | Bug/error report          | `.memory/changes/<feature>/diagnosis.md` |

### Intent Routing (v3.0)

| Intent       | Pipeline                                                       |
| ------------ | -------------------------------------------------------------- |
| **build**    | scan → vibe → specify → research → architect → engine → verify |
| **fix**      | scan → diagnose → engine (targeted) → verify                   |
| **refactor** | scan → specify → architect → engine → verify                   |
| **migrate**  | scan → research → architect → engine → verify                  |
| **document** | scan → specify → engine → verify                               |

### Prompt Intelligence (v6.2.0)

Before vibe capture locks the feature direction, steroid-workflow can create a machine-readable prompt interpretation receipt at `.memory/changes/<feature>/prompt.json` and a human-readable companion at `.memory/changes/<feature>/prompt.md`.

The receipt records:

- primary and secondary intents
- continuation state
- ambiguity, complexity, and risk
- assumptions and non-goals
- unresolved questions
- recommended pipeline route

That receipt is not just an intake helper. It is meant to travel through vibe, spec, research, architect, diagnose, engine, verify, archive, and handoff reporting so later phases do not silently forget early assumptions.

For UI-intensive work, the prompt layer can be followed by `.memory/changes/<feature>/design-routing.json` and `.memory/changes/<feature>/design-system.md` so research, architecture, engine, and verify can all see the same imported frontend-system decisions. `gate research` now auto-prepares those artifacts when possible, and `gate architect` / `gate engine` hard-block UI-intensive work until they exist. When local HTML targets exist, `verify-feature` can also write `.memory/changes/<feature>/accessibility.json` from the internalized AccessLint runtime, `verify-feature --deep` can write `.memory/changes/<feature>/ui-audit.json` from the internal browser audit when a preview URL or auditable HTML target is available, and UI verification writes `.memory/changes/<feature>/ui-review.md` plus `.memory/changes/<feature>/ui-review.json` to summarize the combined frontend evidence. The UI review receipt now carries freshness metadata so `pipeline-status`, handoff reports, and dashboard output can show who refreshed the verdict and when the newest frontend evidence landed. `archive <feature>` and `report generate <feature>` refresh stale UI review receipts before making decisions so newer frontend evidence is not ignored, and archive now distinguishes cautionary `CONDITIONAL` frontend reviews from blocking `CONDITIONAL` cases that require `--force-ui` to proceed. Preview target resolution prefers `--url`, then deploy env vars, common `.env*` files, project preview receipts, feature preview receipts, `package.json` preview metadata, and finally local HTML files.

### Approved Adaptive Routes

| Route            | Use Case                                           |
| ---------------- | -------------------------------------------------- |
| `standard-build` | Normal feature work                                |
| `diagnose-first` | Bugs, regressions, symptom-driven fixes            |
| `resume-mode`    | Continue unfinished work from recent session state |
| `lite-change`    | Trivial, low-risk edits                            |
| `research-heavy` | Migrations and high-risk changes                   |
| `split-work`     | Multi-intent prompts that should be decomposed     |

### Gate Map (v3.1)

| Phase       | Requires                         | Alt Path       | Min Lines |
| ----------- | -------------------------------- | -------------- | --------- |
| `vibe`      | `context.md`                     | —              | 5         |
| `specify`   | `vibe.md`                        | —              | 5         |
| `research`  | `spec.md`                        | —              | 10        |
| `architect` | `research.md`                    | —              | 10        |
| `diagnose`  | `context.md`                     | —              | 5         |
| `engine`    | `plan.md`                        | `diagnosis.md` | 10        |
| `verify`    | `plan.md`                        | `diagnosis.md` | 10        |
| `archive`   | `verify.json` (PASS/CONDITIONAL) | `--force` flag | —         |

## Project Structure

```
your-project/
├── steroid-run.cjs                 ← Pipeline enforcer (copied by installer)
├── .git/hooks/pre-commit          ← Physical commit enforcement
├── .memory/
│   ├── execution_state.json       ← Circuit breaker state (error_count, error_history, recovery_actions)
│   ├── progress.md                ← Cross-task learnings log
│   ├── knowledge/                 ← Structured memory (v4.0)
│   │   ├── tech-stack.json        ← Language, framework, deps (auto-populated by scan)
│   │   ├── patterns.json          ← Codebase patterns and conventions
│   │   ├── decisions.json         ← Locked architectural decisions
│   │   └── gotchas.json           ← Known pitfalls and workarounds
│   ├── metrics/                   ← Performance tracking (v4.0)
│   │   ├── error-patterns.json    ← Auto-recorded error patterns (last 50)
│   │   └── features.json          ← Feature completion data
│   └── changes/
│       └── <feature>/
│           ├── context.md         ← Codebase scan results (v3.0)
│           ├── prompt.json        ← Machine-readable prompt interpretation receipt (v6.2.0)
│           ├── prompt.md          ← Human-readable prompt brief (v6.2.0)
│           ├── vibe.md            ← Captured user intent
│           ├── spec.md            ← Acceptance criteria
│           ├── research.md        ← Tech investigation results
│           ├── plan.md            ← Atomic execution checklist (supports P1/P2/P3 priorities)
│           ├── tasks.md           ← Live task artifact mirrored from the execution checklist
│           ├── execution.json     ← Machine-readable execution receipt
│           ├── review.md          ← Human-readable two-stage review notes
│           ├── review.json        ← Machine-readable review receipt
│           ├── verify.md          ← Human-readable verification report
│           ├── verify.json        ← Machine-readable verification receipt
│           ├── completion.json    ← Machine-readable completion receipt
│           ├── diagnosis.md       ← Bug diagnosis (v3.0, fix intent only)
│           └── archive/           ← Completed features
├── .agents/
│   ├── skills/                    ← The 8 steroid skills
│   └── steroid-maestro.md         ← Shared Maestro reference
├── src/forks/                     ← Referenced fork sources (60 files)
├── GEMINI.md                      ← Maestro rules (Gemini/Antigravity)
├── CLAUDE.md                      ← Maestro rules (Claude Code)
├── .cursorrules                   ← Maestro rules (Cursor)
├── .windsurfrules                 ← Maestro rules (Windsurf)
└── .github/copilot-instructions.md ← Maestro rules (Copilot)
```

Live repo governance notes for contributors:

- `governed/spec-system/MODULE.yaml` is the live law surface for the transplanted spec system
- `governed/spec-system/LIVE-MAPPING.md` defines how governed artifacts map onto current runtime files
- `governed/execution-engine/MODULE.yaml` is the live law surface for the transplanted execution system
- `governed/execution-engine/LIVE-MAPPING.md` defines how governed execution artifacts map onto current runtime files
- `governed/review-and-verify/MODULE.yaml` is the live law surface for the transplanted review and verification system
- `governed/review-and-verify/LIVE-MAPPING.md` defines how governed review and verification artifacts map onto current runtime files
- `governed/progress-memory/MODULE.yaml` is the live law surface for the transplanted progress-memory system
- `governed/progress-memory/LIVE-MAPPING.md` defines how governed progress artifacts map onto current runtime files
- `governed/core-runtime/MODULE.yaml` is the live law surface for the transplanted core runtime system
- `governed/core-runtime/LIVE-MAPPING.md` defines how governed completion artifacts map onto current runtime files
- skill files remain implementation surfaces, not the top authority

## Fork Credits

All integrated forks are MIT licensed:

### Core Forks (integrated into skills)

- **[obra/superpowers](https://github.com/obra/superpowers)** — TDD, subagent-driven development, systematic debugging, verification-before-completion, code review
- **[Kiyoraka/Project-AI-MemoryCore](https://github.com/Kiyoraka/Project-AI-MemoryCore)** — Continuous state-tracking via markdown/JSON

### Ecosystem Forks (code ported into `steroid-run.cjs`)

- **[snarktank/ralph](https://github.com/snarktank/ralph)** — Autonomous loop: progress tracking, archive pattern, AGENTS.md system
- **[gsd-build/get-shit-done](https://github.com/gsd-build/get-shit-done)** — Verifier, codebase mapper, debugger, phase researcher, planner, executor, roadmapper
- **[Fission-AI/OpenSpec](https://github.com/Fission-AI/OpenSpec)** — Per-change folders: kebab-case validation
- **[github/spec-kit](https://github.com/github/spec-kit)** — Spec-driven development: Given/When/Then acceptance criteria, templates
- **[gotalab/cc-sdd](https://github.com/gotalab/cc-sdd)** — Requirements→design→tasks pipeline (reference)
- **[bmad-code-org/BMAD-METHOD](https://github.com/bmad-code-org/BMAD-METHOD)** — Agile AI-driven development (reference)
