---
name: steroid-engine
description: The autonomous execution orchestrator for Steroid-Workflow. This skill reads .memory/changes/<feature>/plan.md and loops through the execution checklist using TDD, committing atomically per task, capturing learnings, and stopping only on completion or circuit breaker trip.
---

# Steroid Engine (Autonomous Execution Orchestrator)

This skill autonomously executes the checklist in `.memory/changes/<feature>/plan.md`. It uses the Subagent-Driven Development model forked from `obra/superpowers` (see `src/forks/superpowers/subagent.md` and `src/forks/superpowers/tdd.md`) combined with the autonomous loop pattern from Ralph (see `src/forks/ralph/prompt.md`).

## The Circuit Breaker Mandate

All terminal commands executed by this skill or any sub-agent it dispatches MUST be wrapped in the physical Node.js circuit breaker:

```
npx steroid-run '<command>'
```

Direct terminal commands (`npm install`, `npx jest`, `node script.js`, etc.) are strictly forbidden. The `steroid-run` wrapper physically tracks errors in `.memory/execution_state.json`. If the error count reaches 3, the wrapper hard-faults and prevents further execution. The AI has no ability to override this.

## Anti-Summarization Directive

NEVER summarize code. NEVER write comments like `// rest of the code here` or `// ...existing code...`. NEVER truncate file contents. If modifying a file, write the complete replacement content or use precise line-targeted edits.

Before marking any task as `[x]`, run the verification guard:

```
npx steroid-run verify <path/to/file> --min-lines=<expected>
```

If the file is shorter than expected, the verify command will exit with an error, blocking the task from completion.

## Pre-Execution Setup

Before starting the checklist, create a rollback safety point:

```
npx steroid-run 'git init && git add -A && git commit -m steroid-checkpoint --allow-empty'
```

If the build goes wrong, the user can recover with `git reset --hard steroid-checkpoint`.

## The Autonomous Execution Loop

This engine is a **loop**, not a single pass. It processes tasks one at a time until ALL tasks are `[x]` or the circuit breaker trips.

### Detecting Environment Capabilities

Before starting, determine if the current IDE supports sub-agent dispatch (e.g., Claude Code with tool_use). If sub-agents are available, use **Full Mode**. If not (e.g., Cursor, Gemini CLI), use **Fallback Mode**.

### Reading Progress First

Before starting any task, read `.memory/progress.md` — especially the **Codebase Patterns** section at the top (if it exists). Previous task iterations may have documented patterns and gotchas that help you avoid repeating mistakes.

### Loop: For each `[ ]` task in `.memory/changes/<feature>/plan.md`:

**Step 0: Progress Signal**

Before starting each task, output one line to the user:
"🔨 Working on: [Task Name]..."

This gives the user visibility without breaking the silence directive.

**Phase 1: Implementation (TDD)**

Dispatch a fresh Implementer sub-agent. Provide it with:
- The full text of the current task from `plan.md`
- The raw TDD methodology from `src/forks/superpowers/tdd.md`
- The `steroid-run` mandate (all commands via `npx steroid-run`)
- The Codebase Patterns section from `progress.md` (if any)

The Implementer sub-agent follows the Red-Green-Refactor cycle from the forked TDD skill:

1. **RED** - Write one minimal failing test. Run: `npx steroid-run 'npm test <path>'`. Confirm it fails because the feature is missing, not a typo.
2. **GREEN** - Write the minimal code to pass the test. Run: `npx steroid-run 'npm test <path>'`. Confirm passing.
3. **REFACTOR** - Clean up duplication. Confirm tests stay green.

Reference the full TDD rules in `src/forks/superpowers/tdd.md`. The Implementer MUST follow The Iron Law: no production code without a failing test first.

**Phase 2: Spec Compliance Review**

Dispatch a SEPARATE, fresh Reviewer sub-agent using the prompt template from `src/forks/superpowers/spec-reviewer-prompt.md`. Give it:
- The original task specification from `plan.md`
- The acceptance criteria from `.memory/changes/<feature>/spec.md` (if referenced)
- The code that was committed by the Implementer

The Reviewer's ONLY job is to compare the committed code against the spec. If the Implementer took a shortcut, summarized code, or missed a requirement, the Reviewer flags it as `❌ Issues Found` and the Implementer must fix it.

**Phase 3: Code Quality Review**

Dispatch another fresh Reviewer sub-agent using `src/forks/superpowers/code-quality-reviewer-prompt.md`. This reviewer checks for code quality issues independently of the spec.

**Phase 4: Verify, Commit & Log (Physical Enforcement)**

1. Run: `npx steroid-run verify <primary-file> --min-lines=<expected>`
2. If passing, mark the task as `[x]` in `plan.md`
3. Commit atomically using the physical commit command:
   ```
   npx steroid-run commit "<task-description>"
   ```
4. Log the task completion using the physical log command:
   ```
   npx steroid-run log <feature> "<what was implemented — one sentence>"
   ```

5. If you discover reusable patterns, add them to the **Codebase Patterns** section at the TOP of `progress.md`:

```markdown
## Codebase Patterns
- Example: Use `date-fns startOfDay()` for all date comparisons
- Example: Tailwind class `rounded-xl shadow-sm` for Apple Health card style
- Example: Always wrap localStorage.setItem in try/catch
```

Only add patterns that are **general and reusable**, not task-specific details.

**Step 5: Check Completion & Loop**

After completing a task, physically check if all tasks are done:
```
npx steroid-run check-plan <feature>
```
- If exit code 0 (all complete) → proceed to Completion
- If exit code 1 (tasks remaining) → wipe sub-agent contexts, loop back to Step 0 with the next `[ ]` task

---

### Fallback Mode (Single-Context IDEs)

If sub-agent dispatch is NOT available (Cursor, Gemini CLI, etc.), execute the task yourself using the TDD cycle above, then perform a self-review by answering these 5 questions before marking `[x]`:

1. Does the code implement EVERY requirement from the task specification? (Yes/No)
2. Are there any comments like `// TODO`, `// rest of code`, or `...` in the output? (Must be No)
3. Does the primary file pass `npx steroid-run verify`? (Must pass)
4. Do all tests pass via `npx steroid-run 'npm test'`? (Must pass)
5. Is the code complete enough that a fresh AI context could understand it without additional explanation? (Must be Yes)

If ANY answer fails, fix the issue before marking `[x]`.

### Context Wipe Between Tasks

After completing a task, the current sub-agent contexts MUST be terminated. Each new task starts with completely fresh sub-agent contexts reading only from `plan.md` and `progress.md`. This prevents the hallucination cascade where one bad shortcut poisons the rest of the project.

## Completion

When `npx steroid-run check-plan <feature>` exits with code 0 (all tasks complete):

1. Archive the feature using the physical archive command:
   ```
   npx steroid-run archive <feature>
   ```
2. Output to the user: "🎉 The technical blueprint is fully implemented!"
3. Signal completion: `<promise>COMPLETE</promise>`

## The Silence Directive

The human at the keyboard is a non-technical System Builder. NEVER dump sub-agent logs, stack traces, or TDD bash outputs to the main chat window.

Instead of showing raw error output, summarize issues in one non-technical sentence. Example: "I hit a snag installing dependencies. Working on fixing it."

When a task completes, output: "✅ [Task Name] completed and verified."
When ALL tasks are complete, output: "🎉 The technical blueprint is fully implemented!"

## Referenced Forks

To understand the full, unmodified logic behind this skill, read:

- `src/forks/superpowers/tdd.md` - The complete TDD methodology (372 lines)
- `src/forks/superpowers/subagent.md` - The complete Subagent execution model (276 lines)
- `src/forks/superpowers/implementer-prompt.md` - The Implementer dispatch template
- `src/forks/superpowers/spec-reviewer-prompt.md` - The Spec Reviewer dispatch template
- `src/forks/superpowers/code-quality-reviewer-prompt.md` - The Quality Reviewer dispatch template
- `src/forks/memorycore/save-protocol.md` - The continuous state-tracking protocol (222 lines)
- `src/forks/ralph/prompt.md` - The Ralph autonomous loop prompt (109 lines)
- `src/forks/ralph/ralph.sh` - The Ralph loop script (114 lines)
