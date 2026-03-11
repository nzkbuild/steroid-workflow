# Changelog

## [3.0.0] "Complete the Loop" - 2026-03-12

### The Vision
v2.x proved the pipeline (vibe → spec → research → architect → engine) works. But it was blind — no codebase awareness, no verification, and only one pipeline for all intents. v3.0 closes the loop: the AI now scans before it builds, verifies after it builds, and routes to different pipelines based on what you ask for.

### Added — New Skills (3)
- **`steroid-scan`** — Codebase awareness skill (Skill #0). Runs BEFORE vibe capture. Auto-detects tech stack, project structure, test infrastructure, existing patterns, and related code. Writes `context.md`. Adapted from GSD codebase-mapper (773 lines) and Ralph AGENTS.md system.
- **`steroid-verify`** — Proof of work skill (Skill #6). Runs AFTER engine completes all tasks. Performs spec compliance review, code quality review, test execution, lint/type checks, and anti-pattern scanning. Writes `verify.md` with PASS/FAIL/CONDITIONAL status. Adapted from GSD verifier (582 lines) and superpowers spec/code quality reviewers.
- **`steroid-diagnose`** — Fix/debug pipeline skill (Skill #7). Replaces the full build pipeline when the user wants to fix a bug. 4-phase root cause investigation → targeted fix plan → TDD → verify. Adapted from superpowers systematic-debugging (297 lines) and GSD debugger.

### Added — New CLI Commands (5)
- **`scan <feature>`** — Bootstraps `context.md` with auto-detected tech stack, framework, test runner, and test count
- **`detect-intent "<message>"`** — Classifies user intent into build/fix/refactor/migrate/document with confidence scoring
- **`detect-tests`** — Detects test framework configs (Jest, Vitest, Mocha, Pytest, Playwright, Cypress)
- **`verify-feature <feature>`** — Pre-check that all plan.md tasks are complete before verification
- **`--verbose` flag for detect-intent** — Shows confidence score and pipeline variant

### Added — Intent Routing
- 5 pipeline variants based on user intent:
  - **build**: scan → vibe → specify → research → architect → engine → verify
  - **fix**: scan → diagnose → engine (targeted) → verify
  - **refactor**: scan → specify → architect → engine → verify
  - **migrate**: scan → research → architect → engine → verify
  - **document**: scan → specify → engine → verify

### Changed — Pipeline (5 → 8 skills)
- Pipeline now starts with `steroid-scan` and ends with `steroid-verify`
- Gate map expanded: `vibe` gate requires `context.md`, `verify` gate requires `plan.md`
- Archive command now handles 7 files (was 4): added context.md, verify.md, diagnosis.md
- Engine completion flow updated: now hands off to verify before archiving (was archiving directly)

### Changed — Maestro Rules (IDE Configs)
- Rewritten for v3.0 with intent routing table, 8-skill pipeline table, and 10 CLI commands
- Pre-task checkpoint now checks for `steroid-scan` (was `steroid-vibe-capture`)
- Detection-first workflow: AI runs `detect-intent` before choosing pipeline

### Changed — Installer
- Step 2 now installs 8 skills (was 5)
- Final banner shows verification enforcement and intent routing
- Audit command checks for 7 skills (was 5): added scan and verify

### Added — Fork Library Expansion
- `src/forks/` expanded from 23 to 60 files (37 new files extracted)
- 9 new superpowers skills: systematic-debugging, verification-before-completion, dispatching-parallel-agents, brainstorming, executing-plans, writing-plans, finishing-a-development-branch, requesting-code-review, receiving-code-review
- 10 new GSD agents: gsd-verifier, gsd-codebase-mapper, gsd-debugger, gsd-executor, gsd-planner, gsd-roadmapper, gsd-integration-checker, gsd-nyquist-auditor, gsd-plan-checker, gsd-project-researcher
- 3 new spec-kit templates: agent-file, checklist, constitution
- 3 ralph extras: AGENTS.md, prd.json.example, CLAUDE.md

## [2.1.1] "ESM Hotfix" - 2026-03-11

### Fixed
- **ESM Compatibility Bug** — `steroid-run.js` was written as CommonJS but crashed in projects using `"type": "module"` in their `package.json`. Renamed the enforcer exclusively to `steroid-run.cjs` to force CommonJS execution universally across all environments.
- All IDE configs, skills, and documentation now reference `node steroid-run.cjs`.

## [2.1.0] "Lockdown" - 2026-03-11

### The Problem
Tested steroid-workflow on Gemini 3.1 Pro (High) in Antigravity IDE. The AI completely ignored all steroid rules — no skills loaded, no pipeline followed, no `steroid-run.cjs` used. Behaved identically to not having steroid installed. Root cause: rules were appended to bottom of config files (lowest LLM priority), only 2 IDEs supported, no physical enforcement at git level.

### Added
- **Git pre-commit hook** — physically blocks commits if no `plan.md` exists in `.memory/changes/`. AI cannot bypass this regardless of model or IDE
- **`audit` command** — `node steroid-run.cjs audit` verifies all enforcement layers are properly installed
- **Universal IDE coverage** — now injects Maestro rules into 6 IDEs: Gemini CLI/Antigravity, Cursor, Claude Code, GitHub Copilot, Windsurf, Aider
- **`EFFORT LEVEL 2.00` directive** — baked into Maestro rules to force deep processing mode
- **Pre-task checkpoint** — AI must check for steroid skills and circuit breaker status before any code task
- **`ARCHITECTURE.md`** — technical documentation for contributors (fork credits, command reference, enforcement layers)
- **Shared Maestro reference** — `.agents/steroid-maestro.md` for YAML-based IDEs

### Changed
- **Config injection now PREPENDS** — rules go to TOP of config files for maximum LLM priority (was appending to bottom)
- **Trigger intent widened** — from 4 words (build/create/design/make) to ALL development intents (fix, debug, add, update, refactor, implement, etc.)
- **README completely rewritten** — product-focused, no internal commands or fork credits exposed
- **Installer now 7 steps** (was 5) — added git hook + shared maestro reference steps
- **`.gitignore` expanded** — now covers `.agents/`, all IDE config files, with smart detection of pre-existing files

### Fixed
- IDE config files (GEMINI.md, .cursorrules, etc.) no longer pollute `git status` — properly gitignored
- Pre-existing config files are preserved and not added to `.gitignore` (installer detects files tracked by git)

## [2.0.2] - 2026-03-11

### Fixed
- Cursor handoff paths: all IDEs now install to `.agents/skills/` (unified target)
- Removed `.agents/skills/` and `.cursorrules` from git (installer-generated, shouldn't be versioned)
- Removed `steroid-run` bin entry from package.json (users use `node steroid-run.cjs`)
- `steroid-run.cjs` help text now shows `node steroid-run.cjs` instead of `npx steroid-run`
- CLI step numbering fixed (was showing 3/5, 4/5 — now properly 1/5 through 5/5)
- `.gitignore` now excludes `.agents/`, `.cursurrules`, `steroid-run.cjs`, `test-install/`

### Added
- `engines` field in package.json (`node >= 14.0.0`)
- `main` field in package.json
- `steroid-run.cjs` shown in README project structure

## [2.0.1] - 2026-03-11

### Fixed
- `steroid-run.cjs` now copied to user project root so `node steroid-run.cjs` always resolves
- Section numbering in steroid-specify, steroid-research, steroid-architect after gate insertion
- Engine now has gate check (`node steroid-run.cjs gate engine <feature>`)
- `check-plan` regex counts `[/]` in-progress tasks correctly
- Stale `openspec/changes/` reference after fork cleanup
- `commit` no longer creates empty commits (`--allow-empty` removed)

### Added
- Maestro injection now includes all 6 Pipeline Enforcement Commands
- `steroid-run.cjs` entry added to user's `.gitignore`
- CHANGELOG.md
- `.npmignore` for clean publishing

## [2.0.0] - 2026-03-11

### Added
- 5-skill autonomous pipeline: vibe-capture → specify → research → architect → engine
- 6 new `steroid-run.cjs` enforcement commands: `init-feature`, `gate`, `commit`, `log`, `check-plan`, `archive`
- Spec-driven development via Spec Kit templates
- Tech research phase via GSD researcher patterns
- Per-change folder structure (`.memory/changes/<feature>/`)
- Autonomous execution loop with `<promise>COMPLETE</promise>` signal
- Code ported from OpenSpec (`validateChangeName`), Ralph (progress/archive), GSD (researcher)

### Changed
- Fork cleanup: 8.6MB → 112KB (23 files, only referenced sources + LICENSE)
- `steroid-run.cjs` expanded from 158 to ~390 lines (3 → 9 commands)
- README fully rewritten for v2

## [1.0.0] - 2026-03-10

### Added
- Initial release: 3-skill pipeline (vibe-capture → architect → engine)
- Circuit breaker with 3-strike error tracking
- Anti-summarization verification
- MemoryCore state tracking
