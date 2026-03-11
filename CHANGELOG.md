# Changelog

## [2.0.2] - 2026-03-11

### Fixed
- Cursor handoff paths: all IDEs now install to `.agents/skills/` (unified target)
- Removed `.agents/skills/` and `.cursorrules` from git (installer-generated, shouldn't be versioned)
- Removed `steroid-run` bin entry from package.json (users use `node steroid-run.js`)
- `steroid-run.js` help text now shows `node steroid-run.js` instead of `npx steroid-run`
- CLI step numbering fixed (was showing 3/5, 4/5 — now properly 1/5 through 5/5)
- `.gitignore` now excludes `.agents/`, `.cursurrules`, `steroid-run.js`, `test-install/`

### Added
- `engines` field in package.json (`node >= 14.0.0`)
- `main` field in package.json
- `steroid-run.js` shown in README project structure

## [2.0.1] - 2026-03-11

### Fixed
- `steroid-run.js` now copied to user project root so `node steroid-run.js` always resolves
- Section numbering in steroid-specify, steroid-research, steroid-architect after gate insertion
- Engine now has gate check (`node steroid-run.js gate engine <feature>`)
- `check-plan` regex counts `[/]` in-progress tasks correctly
- Stale `openspec/changes/` reference after fork cleanup
- `commit` no longer creates empty commits (`--allow-empty` removed)

### Added
- Maestro injection now includes all 6 Pipeline Enforcement Commands
- `steroid-run.js` entry added to user's `.gitignore`
- CHANGELOG.md
- `.npmignore` for clean publishing

## [2.0.0] - 2026-03-11

### Added
- 5-skill autonomous pipeline: vibe-capture → specify → research → architect → engine
- 6 new `steroid-run.js` enforcement commands: `init-feature`, `gate`, `commit`, `log`, `check-plan`, `archive`
- Spec-driven development via Spec Kit templates
- Tech research phase via GSD researcher patterns
- Per-change folder structure (`.memory/changes/<feature>/`)
- Autonomous execution loop with `<promise>COMPLETE</promise>` signal
- Code ported from OpenSpec (`validateChangeName`), Ralph (progress/archive), GSD (researcher)

### Changed
- Fork cleanup: 8.6MB → 112KB (23 files, only referenced sources + LICENSE)
- `steroid-run.js` expanded from 158 to ~390 lines (3 → 9 commands)
- README fully rewritten for v2

## [1.0.0] - 2026-03-10

### Added
- Initial release: 3-skill pipeline (vibe-capture → architect → engine)
- Circuit breaker with 3-strike error tracking
- Anti-summarization verification
- MemoryCore state tracking
