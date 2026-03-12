# 🧬 Steroid-Workflow

**Turn one sentence into working software.**

An AI pipeline that takes your idea through 8 enforced phases — codebase scanning, vibe capture, specification, research, architecture, TDD implementation, and verification — so the AI can't cut corners, skip steps, or hallucinate solutions. v5.0 adds two-stage review (spec compliance + code quality gating), AI-to-human handoff reports, and an analytics dashboard.

## Install

```bash
npx steroid-workflow init
```

Run this inside any project with `git init`. That's it — no config, no dependencies, no terminal knowledge required.

### Update

```bash
npx steroid-workflow@latest update
```

Your project state (`.memory/`) is preserved. Only skills, configs, and enforcement layers are refreshed.

## How To Use

Just tell your AI what you want:

> "Build me a minimal habit tracker like Apple Health"

> "Fix the login bug that crashes on empty password"

> "Refactor the API layer to use proper error handling"

The AI automatically detects your intent and routes to the right pipeline:

| You say | AI does |
|---------|---------|
| "Build a dashboard" | Full pipeline: scan → vibe → spec → research → architect → engine → verify |
| "Fix the login bug" | Debug pipeline: scan → diagnose → targeted fix → verify |
| "Refactor the API" | Refactor pipeline: scan → specify target state → architect → engine → verify |
| "Upgrade to React 19" | Migration pipeline: scan → research → architect → engine → verify |
| "Document the API" | Docs pipeline: scan → specify → engine → verify |

If the AI doesn't activate automatically, say: **"Use the steroid pipeline."**

## The 8 Phases

| Phase | What happens | Output |
|-------|-------------|--------|
| 📡 **Scan** | Detects tech stack, project structure, test infra | `context.md` |
| 🎯 **Vibe Capture** | Translates your idea into a structured brief | `vibe.md` |
| 📋 **Specify** | Converts the brief into user stories with acceptance criteria | `spec.md` |
| 🔬 **Research** | Investigates the best tech stack and approaches | `research.md` |
| 🏗️ **Architect** | Creates an atomic execution plan with testable tasks | `plan.md` |
| ⚡ **Engine** | Builds it using TDD, commits atomically, captures learnings | Working code |
| ✅ **Verify** | Proves spec compliance, code quality, tests pass | `verify.md` |
| 🔍 **Diagnose** | Root cause analysis for bugs (fix intent only) | `diagnosis.md` |

Each phase hands off to the next. No manual intervention needed.

## What Makes It Different

Most AI coding tools rely on **suggestions** — hoping the AI follows instructions. Steroid-Workflow uses **physical enforcement**:

- 🔒 **Git hook** — Commits are blocked unless the AI went through the pipeline. No plan.md = no commit.
- ⚡ **Circuit breaker** — 5-level graduated recovery. The AI gets smarter guidance at each error level before tripping.
- ✅ **Verification** — The AI must prove its code works before archiving. No more "trust me, it's done."
- 🔍 **Intent routing** — Different pipelines for build, fix, refactor, migrate, and document tasks.
- 🚫 **Anti-summarization** — The AI can't write "...rest of code here..." and call it done.
- 🔀 **Gate checks** — Each phase requires the previous phase's output to exist. Can't skip steps.

## Supported IDEs

Works with any AI-powered IDE or CLI:

| IDE | Config |
|-----|--------|
| Gemini CLI / Antigravity | `GEMINI.md` |
| Cursor | `.cursorrules` |
| Claude Code | `CLAUDE.md` |
| GitHub Copilot | `.github/copilot-instructions.md` |
| Windsurf | `.windsurfrules` |
| Aider | `.agents/steroid-maestro.md` |

All configs are auto-generated during install.

## Verify Installation

```bash
node steroid-run.cjs audit
```

This checks that all enforcement layers (git hook, 8 skills, 7 gates, circuit breaker, IDE configs) are properly installed.

## Technical Details

See [ARCHITECTURE.md](ARCHITECTURE.md) for:
- How the pipeline enforcer works
- Full command reference for `steroid-run.cjs` (22+ commands)
- Intent routing, gate map, and memory system
- Two-stage review system, handoff reports, and analytics dashboard
- Smart recovery levels and story prioritization
- Fork credits and sources
- Project structure

## License

MIT © [nzkbuild](https://github.com/nzkbuild)
