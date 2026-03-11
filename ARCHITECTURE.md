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
| Command | Purpose |
|---------|---------|
| `node steroid-run.cjs '<command>'` | Execute with error tracking (3 errors → hard stop) |
| `node steroid-run.cjs verify <file> --min-lines=<n>` | Block code summarization |
| `node steroid-run.cjs reset` | Reset error counter after human intervention |
| `node steroid-run.cjs status` | Show circuit breaker state |

### Pipeline Enforcement
| Command | Purpose | Origin |
|---------|---------|--------|
| `init-feature <slug>` | Create feature folder (validates kebab-case) | OpenSpec |
| `scan <feature>` | Bootstrap codebase context (writes context.md) | GSD/Ralph |
| `gate <phase> <feature>` | Check phase prerequisites | New |
| `commit <message>` | Atomic commit in `feat(steroid):` format | Ralph/GSD |
| `log <feature> <message>` | Append to progress log | Ralph |
| `check-plan <feature>` | Count remaining tasks | New |
| `verify-feature <feature>` | Pre-check before verification skill | GSD |
| `archive <feature>` | Date-stamped feature archival | Ralph |

### Intelligence (v3.0)
| Command | Purpose | Origin |
|---------|---------|--------|
| `detect-intent "<message>"` | Classify user intent (build/fix/refactor/migrate/document) | New |
| `detect-tests` | Detect test framework in current project | GSD |

### Progress & Diagnostics
| Command | Purpose |
|---------|---------|
| `progress` | Show execution learnings log |
| `progress --patterns` | Show only codebase patterns |
| `audit` | Verify all enforcement layers are installed (7 skills) |

## The 8-Skill Pipeline (v3.0)

### Build Intent (Full Pipeline)
| # | Skill | Input | Output |
|---|-------|-------|--------|
| 0 | `steroid-scan` | Project codebase | `.memory/changes/<feature>/context.md` |
| 1 | `steroid-vibe-capture` | User's natural language | `.memory/changes/<feature>/vibe.md` |
| 2 | `steroid-specify` | `vibe.md` | `.memory/changes/<feature>/spec.md` |
| 3 | `steroid-research` | `spec.md` | `.memory/changes/<feature>/research.md` |
| 4 | `steroid-architect` | `spec.md` + `research.md` | `.memory/changes/<feature>/plan.md` |
| 5 | `steroid-engine` | `plan.md` | Working code (TDD loop) |
| 6 | `steroid-verify` | Completed code | `.memory/changes/<feature>/verify.md` |
| 7 | `steroid-diagnose` | Bug/error report | `.memory/changes/<feature>/diagnosis.md` |

### Intent Routing (v3.0)
| Intent | Pipeline |
|--------|---------|
| **build** | scan → vibe → specify → research → architect → engine → verify |
| **fix** | scan → diagnose → engine (targeted) → verify |
| **refactor** | scan → specify → architect → engine → verify |
| **migrate** | scan → research → architect → engine → verify |
| **document** | scan → specify → engine → verify |

### Gate Map
| Phase | Requires | Min Lines |
|-------|----------|-----------|
| `vibe` | `context.md` | 5 |
| `specify` | `vibe.md` | 5 |
| `research` | `spec.md` | 10 |
| `architect` | `research.md` | 10 |
| `engine` | `plan.md` | 10 |
| `verify` | `plan.md` | 10 |

## Project Structure

```
your-project/
├── steroid-run.cjs                 ← Pipeline enforcer (copied by installer)
├── .git/hooks/pre-commit          ← Physical commit enforcement
├── .memory/
│   ├── execution_state.json       ← Circuit breaker state
│   ├── progress.md                ← Cross-task learnings log
│   └── changes/
│       └── <feature>/
│           ├── context.md         ← Codebase scan results (v3.0)
│           ├── vibe.md            ← Captured user intent
│           ├── spec.md            ← Acceptance criteria
│           ├── research.md        ← Tech investigation results
│           ├── plan.md            ← Atomic execution checklist
│           ├── verify.md          ← Verification report (v3.0)
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
