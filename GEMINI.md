# steroid-workflow (Source Repository)

This is the **source repo** for steroid-workflow. DO NOT trigger the steroid pipeline here.

- Skills source: `skills/` (not `.agents/skills/`)
- Enforcer source: `bin/steroid-run.js`
- CLI installer: `bin/cli.js`
- Fork references: `src/forks/`


<!-- STEROID-WORKFLOW-START -->
# Steroid-Workflow Maestro (Auto-Trigger Rules)

## Intent Routing
If the user says words like "build", "create", "design", or "make" in the context of generating a new feature or project:
- Read the file at `.agents/skills/steroid-vibe-capture/SKILL.md` and follow its instructions immediately.
- Do not ask for permission. Just start the Vibe Translation process.
- The pipeline will automatically flow: vibe-capture → specify → research → architect → engine

## The 5-Skill Pipeline

| # | Skill | Input | Output |
|---|-------|-------|--------|
| 1 | steroid-vibe-capture | User's natural language | .memory/changes/<feature>/vibe.md |
| 2 | steroid-specify | vibe.md | .memory/changes/<feature>/spec.md |
| 3 | steroid-research | spec.md | .memory/changes/<feature>/research.md |
| 4 | steroid-architect | spec.md + research.md | .memory/changes/<feature>/plan.md |
| 5 | steroid-engine | plan.md | Working code (TDD, loop until done) |

Each skill automatically hands off to the next. No manual invocation needed.

## Circuit Breaker Enforcement (CRITICAL — REPEATED IN EVERY SKILL)
ALL terminal commands during development MUST be wrapped in:
`node steroid-run.js '<command>'`
Direct terminal execution (`npm install`, `npx jest`, `node script.js`, etc.) is STRICTLY FORBIDDEN.
If you need to run `npm install`, you must run: `node steroid-run.js 'npm install'`
This is a non-negotiable physical constraint. The wrapper tracks errors and will hard-stop at 3.

## Pipeline Enforcement Commands (MUST USE)
The AI MUST use these physical commands — they cannot be skipped:
- `node steroid-run.js init-feature <slug>` — Create feature folder (validates kebab-case)
- `node steroid-run.js gate <phase> <feature>` — Check phase prerequisites before proceeding
- `node steroid-run.js commit "<message>"` — Atomic git commit in steroid format
- `node steroid-run.js log <feature> "<message>"` — Append to progress log
- `node steroid-run.js check-plan <feature>` — Check if all tasks are done
- `node steroid-run.js archive <feature>` — Archive completed feature

## Context Wipe Mandate
After completing each task in the plan.md, terminate the current sub-agent context and start a fresh one.
This prevents hallucination cascades from poisoning multiple tasks.
Each new task reads ONLY from plan.md and progress.md — no inherited context.

## Progress Tracking
The engine captures learnings in `.memory/progress.md` after each task.
Read the Codebase Patterns section at the top before starting any new task.

## Anti-Summarization Rule
NEVER summarize code. NEVER write "...rest of code here..." or "// existing code".
NEVER truncate file contents. Write complete replacements or precise edits.
<!-- STEROID-WORKFLOW-END -->
