# 🧬 Steroid-Workflow

**Turn one sentence into working software.**

An AI pipeline that takes your idea through 5 enforced phases — vibe capture, specification, research, architecture, and TDD implementation — so the AI can't cut corners, skip steps, or hallucinate solutions.

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

> "Add user authentication with Google sign-in"

> "Create a dashboard page for tracking daily sales"

The AI automatically activates the steroid pipeline and works through 5 phases:

```
Your idea → Vibe → Spec → Research → Architecture → Working Code
```

If the AI doesn't activate automatically, say: **"Use the steroid pipeline."**

## The 5 Phases

| Phase | What happens | Output |
|-------|-------------|--------|
| 🎯 **Vibe Capture** | Translates your idea into a structured brief | `vibe.md` |
| 📋 **Specify** | Converts the brief into user stories with acceptance criteria | `spec.md` |
| 🔬 **Research** | Investigates the best tech stack and approaches | `research.md` |
| 🏗️ **Architect** | Creates an atomic execution plan with testable tasks | `plan.md` |
| ⚡ **Engine** | Builds it using TDD, commits atomically, captures learnings | Working code |

Each phase hands off to the next. No manual intervention needed.

## What Makes It Different

Most AI coding tools rely on **suggestions** — hoping the AI follows instructions. Steroid-Workflow uses **physical enforcement**:

- 🔒 **Git hook** — Commits are blocked unless the AI went through the pipeline. No plan.md = no commit.
- ⚡ **Circuit breaker** — 3 errors and the AI is forced to stop and ask for help instead of spiraling.
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

This checks that all enforcement layers (git hook, skills, circuit breaker, IDE configs) are properly installed.

## Technical Details

See [ARCHITECTURE.md](ARCHITECTURE.md) for:
- How the pipeline enforcer works
- Command reference for `steroid-run.cjs`
- Fork credits and sources
- Project structure

## License

MIT © [nzkbuild](https://github.com/nzkbuild)
