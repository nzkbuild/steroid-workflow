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

This is the only enforcement that works regardless of AI model, IDE, or prompt quality. Commits made via `node steroid-run.js commit` use the `feat(steroid):` prefix, which the hook recognizes and allows through.

## Pipeline Enforcer (`steroid-run.js`)

All AI terminal commands are routed through this CLI wrapper.

### Circuit Breaker
| Command | Purpose |
|---------|---------|
| `node steroid-run.js '<command>'` | Execute with error tracking (3 errors → hard stop) |
| `node steroid-run.js verify <file> --min-lines=<n>` | Block code summarization |
| `node steroid-run.js reset` | Reset error counter after human intervention |
| `node steroid-run.js status` | Show circuit breaker state |

### Pipeline Enforcement
| Command | Purpose | Origin |
|---------|---------|--------|
| `init-feature <slug>` | Create feature folder (validates kebab-case) | OpenSpec |
| `gate <phase> <feature>` | Check phase prerequisites | New |
| `commit <message>` | Atomic commit in `feat(steroid):` format | Ralph/GSD |
| `log <feature> <message>` | Append to progress log | Ralph |
| `check-plan <feature>` | Count remaining tasks | New |
| `archive <feature>` | Date-stamped feature archival | Ralph |

### Progress & Diagnostics
| Command | Purpose |
|---------|---------|
| `progress` | Show execution learnings log |
| `progress --patterns` | Show only codebase patterns |
| `audit` | Verify all enforcement layers are installed |

## The 5-Skill Pipeline

| # | Skill | Input | Output |
|---|-------|-------|--------|
| 1 | `steroid-vibe-capture` | User's natural language | `.memory/changes/<feature>/vibe.md` |
| 2 | `steroid-specify` | `vibe.md` | `.memory/changes/<feature>/spec.md` |
| 3 | `steroid-research` | `spec.md` | `.memory/changes/<feature>/research.md` |
| 4 | `steroid-architect` | `spec.md` + `research.md` | `.memory/changes/<feature>/plan.md` |
| 5 | `steroid-engine` | `plan.md` | Working code (TDD loop) |

## Project Structure

```
your-project/
├── steroid-run.js                 ← Pipeline enforcer (copied by installer)
├── .git/hooks/pre-commit          ← Physical commit enforcement
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
├── .agents/
│   ├── skills/                    ← The 5 steroid skills
│   └── steroid-maestro.md         ← Shared Maestro reference
├── src/forks/                     ← Referenced fork sources (112KB)
├── GEMINI.md                      ← Maestro rules (Gemini/Antigravity)
├── CLAUDE.md                      ← Maestro rules (Claude Code)
├── .cursorrules                   ← Maestro rules (Cursor)
├── .windsurfrules                 ← Maestro rules (Windsurf)
└── .github/copilot-instructions.md ← Maestro rules (Copilot)
```

## Fork Credits

All integrated forks are MIT licensed:

### Core Forks (integrated into skills)
- **[obra/superpowers](https://github.com/obra/superpowers)** — TDD methodology and subagent-driven development
- **[Kiyoraka/Project-AI-MemoryCore](https://github.com/Kiyoraka/Project-AI-MemoryCore)** — Continuous state-tracking via markdown/JSON

### Ecosystem Forks (code ported into `steroid-run.js`)
- **[snarktank/ralph](https://github.com/snarktank/ralph)** — Autonomous loop: progress tracking, archive pattern
- **[gsd-build/get-shit-done](https://github.com/gsd-build/get-shit-done)** — Research phase: tech investigation with confidence levels
- **[Fission-AI/OpenSpec](https://github.com/Fission-AI/OpenSpec)** — Per-change folders: kebab-case validation
- **[github/spec-kit](https://github.com/github/spec-kit)** — Spec-driven development: Given/When/Then acceptance criteria
- **[gotalab/cc-sdd](https://github.com/gotalab/cc-sdd)** — Requirements→design→tasks pipeline (reference)
- **[bmad-code-org/BMAD-METHOD](https://github.com/bmad-code-org/BMAD-METHOD)** — Agile AI-driven development (reference)
