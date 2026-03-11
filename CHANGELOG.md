# Changelog

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
