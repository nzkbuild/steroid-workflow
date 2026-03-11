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

1. **Captures the vibe** — Translates your idea into a structured vibe profile
2. **Writes a spec** — Converts the vibe into formal user stories with testable acceptance criteria
3. **Researches the tech** — Investigates the best libraries, patterns, and pitfalls before committing
4. **Architects a plan** — Selects the tech stack and breaks it into atomic, testable tasks
5. **Builds it with TDD** — Loops through each task using Test-Driven Development, commits atomically, captures learnings, and only stops when everything passes

You never touch a terminal. You never see a stack trace.

## The Pipeline Enforcer

Unlike other AI coding tools that rely on prompt instructions alone, steroid-workflow **physically enforces** every critical behavior through `steroid-run.js` — a Node.js CLI that the AI cannot bypass.

### Circuit Breaker (Original)
| Command | What It Physically Enforces |
|---------|---------------------------|
| `node steroid-run.js '<command>'` | Every terminal command tracked, 3 errors → hard stop |
| `node steroid-run.js verify <file> --min-lines=<n>` | Blocks code summarization (AI can't fake implementations) |
| `node steroid-run.js reset` | Reset error counter after human intervention |
| `node steroid-run.js status` | Show circuit breaker state |

### Pipeline Enforcement (Ported from ecosystem forks)
| Command | What It Physically Enforces | Ported From |
|---------|---------------------------|-------------|
| `node steroid-run.js init-feature <slug>` | Validates kebab-case, creates folder structure | OpenSpec |
| `node steroid-run.js gate <phase> <feature>` | Can't skip phases (spec must exist before architect) | New |
| `node steroid-run.js commit <message>` | Atomic commits in `feat(steroid):` format | Ralph/GSD |
| `node steroid-run.js log <feature> <message>` | Progress tracking that can't be forgotten | Ralph |
| `node steroid-run.js check-plan <feature>` | Physical task completion counter | New |
| `node steroid-run.js archive <feature>` | Date-stamped feature archival | Ralph |

### Progress Tracking
| Command | What It Shows |
|---------|--------------|
| `node steroid-run.js progress` | Full execution learnings log |
| `node steroid-run.js progress --patterns` | Only codebase patterns discovered |

## The 5-Skill Pipeline

| # | Skill | Role | Output | Enforcement |
|---|-------|------|--------|-------------|
| 1 | `steroid-vibe-capture` | Translates vague ideas into structured vibe profile | `.memory/changes/<feature>/vibe.md` | `init-feature` |
| 2 | `steroid-specify` | Converts vibe into spec with acceptance criteria | `.memory/changes/<feature>/spec.md` | `gate specify` |
| 3 | `steroid-research` | Investigates best tech stack and patterns | `.memory/changes/<feature>/research.md` | `gate research` |
| 4 | `steroid-architect` | Creates atomic execution checklist from spec + research | `.memory/changes/<feature>/plan.md` | `gate architect` |
| 5 | `steroid-engine` | Executes checklist using TDD + autonomous loop | Working code | `commit`, `log`, `check-plan`, `archive` |

Each skill automatically hands off to the next. No manual invocation needed.

## How It Works Under The Hood

The system integrates battle-tested patterns from the open source AI engineering ecosystem. Raw source files are preserved in `src/forks/` — the AI reads these during execution to apply the full engineering logic.

### Core Forks (integrated into skills)
- **[obra/superpowers](https://github.com/obra/superpowers)** — TDD methodology and subagent-driven development with Implementer/Reviewer split
- **[Kiyoraka/Project-AI-MemoryCore](https://github.com/Kiyoraka/Project-AI-MemoryCore)** — Continuous state-tracking via markdown/JSON files

### Ecosystem Forks (code ported into `steroid-run.js`)
- **[snarktank/ralph](https://github.com/snarktank/ralph)** — Autonomous loop: progress tracking, archive pattern, `<promise>COMPLETE</promise>` signal
- **[gsd-build/get-shit-done](https://github.com/gsd-build/get-shit-done)** — Research phase: tech investigation with confidence levels (HIGH/MEDIUM/LOW)
- **[Fission-AI/OpenSpec](https://github.com/Fission-AI/OpenSpec)** — Per-change folders: `validateChangeName()` kebab-case validation ported into `init-feature`
- **[github/spec-kit](https://github.com/github/spec-kit)** — Spec-driven development: prioritized user stories with Given/When/Then acceptance criteria
- **[gotalab/cc-sdd](https://github.com/gotalab/cc-sdd)** — Kiro-style requirements→design→tasks pipeline (reference)
- **[bmad-code-org/BMAD-METHOD](https://github.com/bmad-code-org/BMAD-METHOD)** — Agile AI-driven development with specialized agents (reference)

All forks are MIT licensed.

## IDE Support

The installer injects auto-trigger rules into:
- `GEMINI.md` (Gemini CLI / Antigravity)
- `.cursorrules` (Cursor)

When the AI detects "build", "create", or "design" intent, it automatically starts the pipeline.

## Project Structure

```
your-project/
├── .memory/
│   ├── execution_state.json       ← Circuit breaker state
│   ├── progress.md                ← Cross-task learnings log
│   └── changes/
│       └── <feature>/
│           ├── vibe.md            ← Captured user intent
│           ├── spec.md            ← Acceptance criteria
│           ├── research.md        ← Tech investigation results
│           ├── plan.md            ← Atomic execution checklist
│           └── archive/           ← Completed features
├── src/forks/                     ← Referenced fork source (112KB total)
│   ├── superpowers/               ← TDD + subagent logic (5 files)
│   ├── memorycore/                ← State tracking (3 files)
│   ├── ralph/                     ← Autonomous loop pattern (4 files)
│   ├── gsd/                       ← Research agent (3 files)
│   ├── openspec/                  ← Per-change folder pattern (2 files)
│   ├── spec-kit/                  ← Spec templates (4 files)
│   ├── cc-sdd/                    ← SDD reference (1 file)
│   └── bmad-method/               ← Agile AI reference (1 file)
├── .agents/skills/                ← The 5 steroid skills
├── GEMINI.md                      ← Auto-trigger rules
└── .cursorrules                   ← Auto-trigger rules
```

## License

MIT © [nzkbuild](https://github.com/nzkbuild)
