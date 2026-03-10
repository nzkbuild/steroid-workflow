# 🧬 Steroid-Workflow

**An NPM-installable AI agency-in-a-box that lets non-technical people build software through prompting alone — while physically preventing the AI from taking shortcuts, hallucinating, or destroying their project.**

## Install

```bash
npx steroid-workflow init
```

That's it. No config, no dependencies, no terminal knowledge required.

## What It Does

You type one sentence like:

> "Build me a minimal habit tracker like Apple Health"

And the system autonomously:

1. **Captures the vibe** — Translates your idea into a structured spec (`.memory/user_vibe.md`)
2. **Architects a plan** — Selects the tech stack and breaks it into atomic, testable tasks (`.memory/project_state.md`)
3. **Builds it with TDD** — Executes each task using rigorous Test-Driven Development, with a fresh reviewer sub-agent verifying every step

You never touch a terminal. You never see a stack trace.

## The Circuit Breaker

The AI is physically constrained by a Node.js wrapper called `steroid-run`.

- **Every** terminal command the AI runs goes through `npx steroid-run '<command>'`
- If a command fails, the wrapper increments an error counter in `.memory/execution_state.json`
- At **3 errors**, the wrapper **hard-stops** the AI and demands human intervention
- The `verify` command checks file length to block the AI from faking code with summaries:
  ```
  npx steroid-run verify ./src/component.tsx --min-lines=50
  ```
- The circuit breaker **never** runs destructive commands like `git reset`

## The 3-Skill Pipeline

| Skill | Role | Output |
|-------|------|--------|
| `steroid-vibe-capture` | Translates vague ideas into structured specs | `.memory/user_vibe.md` |
| `steroid-architect` | Selects tech stack, creates atomic checklist | `.memory/project_state.md` |
| `steroid-engine` | Executes checklist using TDD + reviewer sub-agents | Working code |

Each skill hands off automatically to the next. No manual invocation needed.

## How It Works Under The Hood

The execution engine is forked from battle-tested open source AI engineering tools:

- **[obra/superpowers](https://github.com/obra/superpowers)** — TDD methodology (372 lines) and subagent-driven development with Implementer/Reviewer split (276 lines)
- **[Kiyoraka/Project-AI-MemoryCore](https://github.com/Kiyoraka/Project-AI-MemoryCore)** — Continuous state-tracking via markdown/JSON files
- **[ComposioHQ/awesome-claude-skills](https://github.com/ComposioHQ/awesome-claude-skills)** — Structural prompt engineering standards
- **[sickn33/antigravity-awesome-skills](https://github.com/sickn33/antigravity-awesome-skills)** — CLI distribution architecture

The raw, unmodified source files are preserved in `src/forks/` so the AI can reference the full engineering logic during execution.

## IDE Support

The installer injects auto-trigger rules into:
- `GEMINI.md` (Gemini CLI / Antigravity)
- `.cursorrules` (Cursor)

When the AI detects "build", "create", or "design" intent, it automatically starts the pipeline without requiring you to type skill names.

## Project Structure

```
your-project/
├── .memory/
│   ├── execution_state.json   ← Circuit breaker state
│   ├── user_vibe.md           ← Your captured intent
│   └── project_state.md       ← The execution checklist
├── src/forks/
│   ├── superpowers/           ← Raw TDD + subagent logic (846 lines)
│   └── memorycore/            ← Raw state tracking (467 lines)
├── .agents/skills/            ← The 3 steroid skills
├── GEMINI.md                  ← Auto-trigger rules
└── .cursorrules               ← Auto-trigger rules
```

## License

MIT © [nzkbuild](https://github.com/nzkbuild)
