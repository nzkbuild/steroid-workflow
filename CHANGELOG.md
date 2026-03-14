# Changelog

## [6.0.0] "Integrity Release" - 2026-03-14

### The Vision
The SimpleHR incident autopsy revealed that verify-feature was pure theater — it counted `[x]` markers but never ran a build. The engine could produce 41 tasks of silent drift with fabricated outputs, dead routes, and disconnected architecture. v6.0.0 makes the pipeline physically verify what it claims to have built.

### Added — Physical Verification (`steroid-run.cjs`)
- **`verify-feature` rewrite** — 7-step physical verification: plan completeness, `npm run build`, `npm run lint`, `npm test`, dead route detection, orphan file detection, memory freshness check. Replaces the old `[x]` counter.
- **`smoke-test` command** — Stack-aware build check. Detects Node.js (build script or `tsc --noEmit`), Rust (`cargo check`), Go (`go build`). Called by engine heartbeat every 3 tasks.
- **Shell-free subcommands** — `fs-mkdir`, `fs-rm`, `fs-cp`, `fs-mv`, `fs-ls`, `git-init`. Pure Node.js `fs` operations — no shell quoting issues, no POSIX/Windows split.
- **`fs-rm` safety guard** — Refuses to delete `.git`, `.memory`, `steroid-run.cjs`, `node_modules`.
- **`scan --force` flag** — Bypasses 24-hour freshness check. Required after scaffold to populate memory immediately.
- **Dead route detection** — Scans `href=` / `Link href=` in `.tsx`/`.jsx` and checks for matching `page.tsx` in App Router structure.
- **Orphan file detection** — Finds hooks and type files in `src/hooks/` and `src/types/` that are never imported.

### Added — Allowlist & Quoting
- **Expanded command allowlist** — 15 new commands: `rm`, `rmdir`, `del`, `rd`, `move`, `copy`, `xcopy`, `powershell`, `pwsh`, `cmd`, `grep`, `findstr`, `head`, `tail`, `touch`, `sed`, `awk`.
- **Smart re-quoting** — Arguments containing spaces are automatically wrapped in quotes before shell passthrough.

### Added — Engine Skill (`steroid-engine/SKILL.md`)
- **Heartbeat check** — Mandatory `smoke-test` every 3 tasks. If it fails, engine must stop and fix before continuing.
- **TDD hard gate** — If plan has test items but `verify-feature` finds 0 test files, verification FAILS regardless of build status.
- **Mandatory knowledge writes** — Every 5th task must write to `gotchas` and `patterns` knowledge stores. Verified by `verify-feature`.
- **Scaffold section rewrite** — Uses `fs-cp`/`fs-rm` subcommands instead of platform-specific shell commands.
- **Git init rewrite** — Uses `git-init` subcommand instead of raw shell `git init && git add -A && git commit`.
- **Post-scaffold rescan** — Now uses `scan --force` to bypass freshness, marked as PHYSICAL GATE.

### Fixed
- **`const commandStr` crash** — Re-quoting code reassigned `commandStr` which was declared `const`. Changed to `let`. This would have crashed every shell command execution.

### Changed
- **Version**: 5.9.1 → 6.0.0 (semver major — `verify-feature` behavior is breaking)
- **Tests**: 17 new unit tests for v6.0.0 features. Total: 101 tests (54 smoke + 47 unit), 0 failures.

## [5.9.1] "Universal Agent" - 2026-03-14

### Added
- **OpenAI Codex support** — `AGENTS.md` auto-generated on init with steroid pipeline instructions
- **Cline support** — `.clinerules` auto-generated on init with steroid pipeline instructions
- **Audit agent coverage** — `audit` command now reports all 7 agent config files (Gemini, Cursor, Claude, Codex, Windsurf, Cline, Copilot)
- **README updated** — 8 supported agents listed (7 auto-configured + Aider via shared maestro)

## [5.9.0] "Trust Layer" - 2026-03-14

### Added
- **Audit trail receipts** — SHA-256 stamped proof of each gate pass, written to `.memory/audit-trail.md`
- **Pipeline status command** — `pipeline-status <feature>` shows 8-phase progress bar with file checks and line counts
- **Command suggestions** — Levenshtein-based typo detection ("Did you mean: status?") for unknown commands
- **Pipeline budget config** — Optional `.memory/config.json` for user preferences (maxPhases, strictGates, autoRecover)
- **Scan drift detection** — Re-scanning compares against previous `context.md` and surfaces file count changes
- **Welcome-back awareness** — After 4+ hours of inactivity, prints circuit breaker status and active feature on next command
- **Execution telemetry** — Tracks command usage counts in `.memory/metrics/usage.json` for dashboard insights
- **CI badge** — Added GitHub Actions status badge to README
- **Levenshtein utility** — Extracted `src/utils/levenshtein.cjs` with 10 unit tests
- **Config template** — Default `memory-template/config.json` for new project initialization

## [5.8.0] "Quality" - 2026-03-14

### Added
- **Unit test suite** — 20 tests for `mergeKnowledge` and `friendlyHint` utilities (run via `npm run test:unit`)
- **ESLint** — Bug-catching linter with minimal rules (`no-undef`, `no-duplicate-case`, `eqeqeq`, `prefer-const`)
- **Prettier** — Code formatter matching existing style (single quotes, 4-space indent, 120 char width)
- **CONTRIBUTING.md** — Contributor guide covering project structure, development workflow, code style, and commit conventions
- **New npm scripts** — `test:unit`, `test:smoke`, `lint`, `format`, `format:check`

### Changed
- **`npm test`** now runs both smoke tests (54) and unit tests (20) — 74 total
- **`package.json`** — Added ESLint and Prettier as devDependencies

## [5.7.0] "Organized" - 2026-03-14

### Added
- **GitHub Actions CI** — Automated test runs on push/PR for Node 18, 20, and 22
- **Extracted utility modules** — `src/utils/merge-knowledge.cjs` and `src/utils/friendly-hints.cjs` for independent unit testing (canonical copies remain inline in `steroid-run.cjs`)
- **JSDoc annotations** — All 22+ command handlers, utility functions, and constants documented with JSDoc types and descriptions
- **Section map** — File-level header in `steroid-run.cjs` with navigable section index (line numbers for every command)

### Changed
- **Code organization** — `steroid-run.cjs` reorganized with 11 major section dividers (`═══`) grouping related commands: Circuit Breaker, Reports, Knowledge, Pipeline Enforcement, Intelligence, Review System, Analytics, and Execution Guards

## [5.6.1] "Hardened" - 2026-03-14

### Security
- **Command allowlist guard** — Only known development commands (npm, node, git, python, cargo, go, etc.) can execute through the circuit breaker. Unknown commands are blocked, preventing prompt injection attacks.
- **Memory write size limit** — JSON payloads to `memory write` capped at 100KB to prevent disk abuse.

### Fixed
- **Node engine requirement** — Corrected from `>=14.0.0` to `>=18.17.0` (code uses `readdirSync({ recursive: true })` which requires Node 18.17+).
- **`.npmignore` restored** — Was lost since v2.0.1; ensures `npm pack` produces a clean package.

### Changed
- **README.md rewrite** — Product-first structure with npm badges, mermaid pipeline diagram, problem statement, quick start, and user-facing language. All version annotations removed. Technical internals moved to ARCHITECTURE.md reference.

## [5.5.1] - 2026-03-13

### Added
- **Version automation**: `prepublishOnly` hook auto-patches `SW_VERSION` fallback
- **`knip` integration**: Dead code and phantom dependency detection (replaces grep)
- **`madge` integration**: Circular dependency detection in verify phase
- **`gitleaks` integration**: 100+ secret pattern scanning (with grep fallback)
- **Pattern Persistence**: Engine writes patterns to `.memory/knowledge/` for cross-feature learning
- **Session Learnings**: Engine captures technical insights in `progress.md`

### Fixed
- `SW_VERSION` hardcoded fallback was stale (`5.4.1` instead of `5.5.0`)

## [5.5.0] "Quality of Life" - 2026-03-13

### Added
- **Adaptive Discussion**: AI detects user technical level and adapts questions
- **Hard Constraints**: `Hard Constraints & Directives` field prevents prompt loss
- **Brownfield/Greenfield Detection**: Prevents accidental overwrites on existing projects
- **Anti-Deletion Guard**: AI cannot delete existing code unless spec says to
- **True TDD Guard**: Trivial tests forbidden
- **Anti-Loop Directive**: At Error 3/5, AI must stop guessing and re-read files
- **AI Code Smell Scan**: Phantom imports, secrets, placeholders, deprecated APIs
- **Bug Report Generator**: `node steroid-run.cjs report`
- **Industry Standards & Compliance**: GDPR, HIPAA, PCI DSS, WCAG, OWASP checks
- **Compliance Baseline**: Auto-added checklist items in architect phase
- **Constraint Pass-Through**: User directives survive vibe → spec → research unchanged

## [5.4.1] HOTFIX - 2026-03-13

### Critical Fix
- **SW_VERSION crash on fresh install** — `steroid-run.cjs` crashed immediately on any project because `path.join(__dirname, '..', 'package.json')` doesn't exist when the file is copied to the user's project root (which is the normal install case). Fixed with `fs.existsSync` guard, `.memory/.steroid-version` fallback, and hardcoded default.

## [5.4.0] "Universal Engine" - 2026-03-13

### The Vision
Steroid is no longer a Node.js-only tool. v5.4.0 transforms it into a universal pipeline that detects, builds, and verifies projects in 10 languages, handles monorepos and complex architectures, and ships with a README that reflects everything it can do.

### Added — Scan Skill
- **10-Language Detection** — Now detects: JavaScript/TypeScript, Python, Rust, Go, Java/Kotlin, Ruby, PHP, C#/.NET, Dart/Flutter. Checks ALL manifest files to support multi-language projects.

### Added — Research Skill
- **Complex Architecture Table** — If a project involves monorepos, Docker, microservices, multi-language, databases, auth, real-time, or CI/CD, the research skill now investigates them specifically with a guided research matrix.

### Added — Engine Skill
- **Multi-Directory Projects** — Engine now handles monorepo workspaces (apps/web, apps/api) with guidance for per-subdirectory commands, root-level commits, and separate verification.

### Added — Verify Skill
- **Language-Aware Verification** — Build, lint, type check, and test commands now adapt to the detected language (Python: pytest/flake8, Rust: cargo test/clippy, Go: go test, Java: mvn test, etc.)

### Changed — README.md
- **Full Overhaul** — README now reflects v5.x features: multi-language support table, enterprise-grade output section, two-stage review, dashboard analytics, and supported IDE matrix.

## [5.3.0] "Enterprise Grade" - 2026-03-13

### The Vision
Steroid now produces output that meets enterprise standards — with license checks, error handling, deployment docs, CI/CD, environment config, code comments, and GitHub setup guidance. No more weekend-hackathon-quality output.

### Added — Verify Skill
- **License Audit** — Verify checks dependencies for GPL/AGPL (viral licenses), unlicensed, or deprecated packages. Reports in verify.md.

### Added — Architect Skill
- **Error Handling Baseline** — Every plan auto-includes: error boundaries, loading states, 404 pages, input validation
- **Environment & Deployment** — Auto-added tasks: .env.example, .gitignore secrets, deployment docs in README, CI/CD workflow (GitHub only)

### Added — Research Skill
- **Deployment Strategy** — Every research output now includes: platform recommendation, build command, output dir, env vars

### Added — Engine Skill
- **Commenting Standards** — Module headers, JSDoc on public functions, explain WHY not WHAT, no obvious comments
- **Remote Check** — After git init, checks for remote. If none: notes "local only", skips CI/CD generation

### Added — Vibe Capture Skill
- **Remote Repo Check** — Documents whether user has GitHub/remote. Determines if CI/CD and deploy steps are generated downstream.

### Added — CLI (steroid-run.cjs)
- **`no-remote` Friendly Hint** — Plain-English 4-step GitHub setup guide when no remote is detected

## [5.2.0] "Ship Ready" - 2026-03-13

### The Vision
Every project built by steroid should be ship-ready — with documentation, version control, versioning, and no stale references. v5.2.0 also eliminates all 14 hardcoded version strings that drifted since v5.0.

### Fixed — CLI (steroid-run.cjs)
- **Dynamic Version** — All 14 hardcoded `v5.0` strings replaced with `SW_VERSION` read from package.json. Reports, reviews, audit, and dashboard now always show the correct version.
- **Git Init Check** — Commit command now verifies `.git/` exists before attempting `git add`. Shows plain-English hint if missing.
- **Git-Failed Hint** — Both `git add` and `git commit` failure handlers now include friendly hint: "💡 A save operation failed. Ask the AI to try the commit again."
- **Stale Reference Detection** — Audit command scans skill files for old version strings and reports drift.

### Fixed — CLI (cli.js)
- **Maestro Dynamic Version** — Maestro title now reads from `pkg.version` instead of hardcoded `v5.0`. Prevents future version drift.

### Added — Architect Skill
- **Documentation Baseline** — Every plan now auto-includes: README.md, CHANGELOG.md, semver version in package.json
- **Versioning Guidance** — Auto-added task to set package.json version to 0.1.0

### Added — Verify Skill
- **Infrastructure: Version Check** — Verify now checks package.json has valid semver
- **Infrastructure: README Check** — Verify now checks README.md exists with install + run instructions

### Added — Engine Skill
- **Git Init Check** — After first scaffold task, engine verifies git is initialized and provides init command if missing

## [5.1.0] "Guide the Human" - 2026-03-13

### The Vision
Steroid-Workflow is built for non-technical vibe coders, but the pipeline assumed users understood development concepts. v5.1.0 makes the pipeline guide users: ask the right questions when prompts are vague, ensure every plan includes accessibility and SEO, check for security issues during research, give visibility into token usage, and speak plain English when things go wrong.

### Added — Research Skill
- **Security Considerations** (mandatory) — Every research output now includes dependency audit, XSS/CSRF, auth strategy, secrets management, and HTTPS notes. Even static sites get a one-liner.

### Added — Vibe Capture Skill
- **Prompt Quality Check** — When user prompts are vague, the AI fills sensible defaults (audience, scale, tech preference) and documents assumptions in vibe.md instead of guessing silently

### Added — Architect Skill
- **Mandatory Quality Tasks** — Every execution checklist now auto-includes: semantic HTML, accessibility (aria-labels, alt text), SEO (meta tags, OG), responsive verification, performance optimization

### Added — Engine Skill
- **Post-Scaffold Rescan** — After the first scaffold task, engine re-runs `scan` to update context.md with the actual tech stack
- **Token-Aware Checkpoints** — Every 5th task outputs a progress checkpoint, giving users a natural breakpoint to split sessions

### Added — CLI
- **Friendly Error Messages** — Gate blocked, circuit breaker tripped, and git failures now include plain-English hints telling non-technical users what to do next

## [5.0.2] "Quality at Every Gate" - 2026-03-13

### The Vision
Dogfooding v5.0.1 on a real portfolio build revealed that while the pipeline runs, its verification is shallow — PASS verdict despite zero tests, unchecked success criteria, stale progress.md, and version mismatches between researched and installed packages. v5.0.2 makes every gate actually verify quality.

### Fixed — Engine Skill (steroid-engine)
- **Post-Scaffold Update** — Engine must update `progress.md` Codebase Patterns after the first scaffold task (was staying "Unknown" after installing Next.js)
- **Version Verification** — Engine must cross-check installed package versions vs research.md recommendations (prevents Tailwind 3.4+ researched but v4 installed, causing `@theme` lint errors)
- **Protected Files** — Explicit no-overwrite list: `.gitignore`, `package.json`, `tsconfig.json`, `.env`, framework configs, `.memory/`

### Fixed — Verify Skill (steroid-verify)
- **Success Criteria Verification** — Verify must now check spec.md's Success Criteria (SC-001, SC-002, etc.) or explicitly mark as "Requires manual testing" instead of ignoring them
- **Test Enforcement** — If spec.md has acceptance criteria AND test count is 0, verdict must be CONDITIONAL, not PASS
- **Infrastructure Checklist** — New mandatory pre-verdict checks: build succeeds, lint clean, deps resolve, `.gitignore` intact, progress.md updated

## [5.0.1] "Harden the Pipeline" - 2026-03-13

### The Vision
Dogfooding v5.0 on a real portfolio build revealed that the AI overwrites `.gitignore` during the engine phase, and the Maestro rules injected into every IDE were frozen at v3.0 — missing all v4.0/v5.0 commands.

### Fixed — .gitignore Protection
- **Commit guardrail** — `commit` command now checks `.gitignore` for required steroid entries (`.memory/`, `steroid-run.cjs`, `.agents/`, `src/forks/`) before every commit. Auto-restores missing entries with a warning.
- **Engine skill instruction** — `steroid-engine/SKILL.md` now explicitly forbids overwriting `.gitignore`

### Fixed — Maestro Rules (Affects All Installed Projects)
- **Title updated** — `v3.0 Maestro` → `v5.0 Maestro`
- **Error threshold** — `hard-stop at 3` → `hard-stop at 5` (stale since v4.0)
- **12 new commands added** — memory, recover, stories, review (spec/quality/status), report (generate/list), dashboard
- **`.gitignore` protection rule** added to Maestro injected content

### Fixed — Installer
- **Banner** — `6 IDE configs` → `5 IDE configs` (correct count)

### Changed
- Users who run `npx steroid-workflow@latest update` will get corrected Maestro rules in all IDE configs

## [5.0.0] "Beyond Code" - 2026-03-13

### The Vision
v4.0 gave the AI structured memory and graduated recovery. But it still operated as a single-brain AI — reviewing its own work, with no handoff report and no project health visibility. v5.0 adds the crown jewels from the superpowers fork: two-stage review (spec compliance then code quality), AI-to-human handoff reports, and an analytics dashboard.

### Added — Two-Stage Review System
- **`review` command** — Two-stage gated review for feature validation
- **`review spec <feature>`** — Stage 1: Spec compliance review (AI reads code vs spec.md criteria)
- **`review quality <feature>`** — Stage 2: Code quality review (checks naming, error handling, anti-patterns)
- **`review status <feature>`** — Shows pass/fail/pending for each stage
- **`review reset <feature>`** — Clears review for re-review
- **Stage gating** — Quality review blocked until spec review passes
- **`review.md` artifact** — Structured output per feature with stage results table

### Added — AI-to-Human Handoff Reports
- **`report` command** — Generate and view handoff reports
- **`report generate <feature>`** — Generates report from spec.md, plan.md, verify.md, review.md
- **`report show <feature>`** — Displays a handoff report
- **`report list`** — Lists all generated reports
- **`.memory/reports/`** — New directory for handoff reports
- **Auto-generation on archive** — Handoff report generated automatically when a feature is archived

### Added — Analytics Dashboard
- **`dashboard` command** — One-command project health overview
- Shows: features completed, avg errors/feature, error pattern analysis, circuit breaker state, knowledge store coverage, reports count

### Fixed
- **Commit command error threshold** — Corrected from 3 to 5 (v4.0 leftover from pre-graduated recovery)
- **Commit command error tracking** — Now records to `error_history[]` like all other error paths

### Changed
- `review.md` added to archive file list
- `audit` command now shows reports health and review system status in summary
- `steroid-verify/SKILL.md` updated with Two-Stage Review Gate prerequisite check
- `steroid-engine/SKILL.md` updated with post-implementation review reminder
- Smoke tests expanded from 24 → 35 (11 new tests for review, report, dashboard)

## [4.0.0] "Make It Learn" - 2026-03-12

### The Vision
v3.1 hardened gate enforcement and added smoke tests. But the pipeline still forgot everything between features — no structured memory, a blunt 3-strike kill switch, and flat task lists with no priority. v4.0 gives the AI a brain: structured knowledge stores that persist across features, graduated error recovery, and prioritized story execution.

### Added — Structured Memory System
- **`memory` command** — 4 knowledge stores: `tech-stack`, `patterns`, `decisions`, `gotchas`
- **`memory show <store>`** — Display a specific knowledge store
- **`memory show-all`** — Display all knowledge stores
- **`memory write <store> <json>`** — Write/merge data into a store (arrays deduplicate, objects deep-merge)
- **`memory stats`** — Show entry counts, last update times, and metrics summary
- **`.memory/knowledge/`** — New directory auto-created by scan, writable by AI skills
- **Scan auto-populates `tech-stack.json`** — language, framework, test framework captured on every scan

### Added — Smart Recovery (Graduated Error Handling)
- **`recover` command** — 5-level recovery guidance based on error count:
  - Level 1: Retry with different approach
  - Level 2: Pause and re-read plan
  - Level 3: Self-diagnose using error-patterns.json
  - Level 4: Escalate with full error history to user
  - Level 5: Hard stop (circuit breaker tripped)
- **Error history tracking** — `execution_state.json` now records `error_history[]` and `recovery_actions[]`
- **Auto-recorded error patterns** — `.memory/metrics/error-patterns.json` populated on every error (last 50 kept)

### Added — Prioritized Story Execution
- **`stories <feature>`** — Lists all stories grouped by P1/P2/P3 priority
- **`stories <feature> next`** — Shows next story respecting foundational blocking (P1 must complete before P2/P3)
- **P1 breakdown in check-plan** — `check-plan` now shows P1 vs P2/P3 completion when priorities exist
- **Priority format** — Plans can use `- [ ] P1: Story title` for priorities, `- [ ] [P] P2: Story` for parallel markers

### Added — Metrics Tracking
- **Feature metrics** — `archive` now records feature completion data to `.memory/metrics/features.json`
- **Knowledge store health in audit** — `audit` now shows which knowledge stores are populated

### Changed
- Circuit breaker threshold from 3 → 5 errors (graduated recovery at each level)
- Each error level provides specific recovery guidance via `recover` command
- `status` command shows recovery level (🟢 CLEAR → 🟡 LOGGED → 🟠 RE-READ → 🔶 DIAGNOSING → 🔴 ESCALATED → 🛑 TRIPPED)
- `reset` command clears recovery state and error history
- Tripped banner now shows `recover` and `reset` commands
- Audit summary includes knowledge store count
- Skills updated: `steroid-scan` writes to knowledge stores, `steroid-engine` reads knowledge + checks story priority, `steroid-diagnose` uses smart recovery
- Smoke tests expanded from 16 → 24 (8 new tests for memory, recover, stories)

## [3.1.0] "Polish & Harden" - 2026-03-12

### The Vision
v3.0 shipped the 8-skill pipeline, but had enforcement gaps: the diagnose skill had no gate, the audit missed a skill, archives weren't verified, and scan results didn't feed back into progress.md. v3.1 hardens every enforcement layer.

### Added — Gate Enforcement
- **`diagnose` gate** — requires `context.md` before diagnosis (ensures scan ran first)
- **Engine/verify alt-path** — gates accept `diagnosis.md` as alternative to `plan.md` for fix pipeline
- **Archive verification gate** — blocks archiving without `verify.md` containing PASS or CONDITIONAL verdict
- **`--force` flag for archive** — bypasses verification gate for abandoned features or edge cases

### Added — Audit Hardening
- **`steroid-diagnose` skill check** — audit now checks all 8 skills (was missing diagnose)
- **Version display** — audit header shows installed steroid-workflow version
- **Content validation** — verifies `steroid-run.cjs` isn't a stub (min 100 lines)
- **Gate chain integrity** — displays all 7 gates in the audit summary
- **Enhanced summary** — shows skill count and gate count alongside pass/fail

### Added — Intelligence
- **TypeScript detection** — scan checks for `tsconfig.json` and reports "TypeScript" instead of generic "JavaScript/TypeScript"
- **Progress.md enrichment** — scan auto-populates `## Codebase Patterns` in progress.md on first run, or updates placeholder text in existing progress.md

### Added — Testing
- **Smoke test suite** — `npm test` runs `test/smoke.test.cjs` (16 tests, zero dependencies)
- Tests cover: help, status, all 5 intents, gate validation, feature name validation, and error handling

### Changed
- Gate map expanded from 6 → 7 gates (added `diagnose`)
- Gate help text updated to list all 7 phases
- `steroid-diagnose/SKILL.md` now includes gate pre-check instruction
- `package.json` test script updated from placeholder to smoke test

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
