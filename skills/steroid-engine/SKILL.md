---
name: steroid-engine
description: The execution orchestrator for Steroid-Workflow. This skill should be used when executing an implementation plan from .memory/project_state.md. It enforces rigorous Test-Driven Development and the Implementer/Reviewer sub-agent split, physically constrained by the steroid-run Node.js circuit breaker.
---

# Steroid Engine (Execution Orchestrator)

This skill orchestrates the execution of the project checklist in `.memory/project_state.md`. It uses the Subagent-Driven Development model forked from `obra/superpowers` (see `src/forks/superpowers/subagent.md` and `src/forks/superpowers/tdd.md` for the raw, unmodified source logic).

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

## The Execution Loop (Subagent-Driven Development)

To process the checklist in `.memory/project_state.md`, follow the raw `subagent-driven-development` methodology from `src/forks/superpowers/subagent.md`:

### For each `[ ]` task in `.memory/project_state.md`:

**Phase 1: Implementation**

Dispatch a fresh Implementer sub-agent. Provide it with:
- The full text of the current task from `.memory/project_state.md`
- The raw TDD methodology from `src/forks/superpowers/tdd.md`
- The `steroid-run` mandate (all commands via `npx steroid-run`)

The Implementer sub-agent follows the Red-Green-Refactor cycle from the forked TDD skill:

1. **RED** - Write one minimal failing test. Run: `npx steroid-run 'npm test <path>'`. Confirm it fails because the feature is missing, not a typo.
2. **GREEN** - Write the minimal code to pass the test. Run: `npx steroid-run 'npm test <path>'`. Confirm passing.
3. **REFACTOR** - Clean up duplication. Confirm tests stay green.

Reference the full TDD rules in `src/forks/superpowers/tdd.md`. The Implementer MUST follow The Iron Law: no production code without a failing test first.

**Phase 2: Spec Compliance Review**

Dispatch a SEPARATE, fresh Reviewer sub-agent using the prompt template from `src/forks/superpowers/spec-reviewer-prompt.md`. Give it:
- The original task specification from `.memory/project_state.md`
- The code that was committed by the Implementer

The Reviewer's ONLY job is to compare the committed code against the spec. If the Implementer took a shortcut, summarized code, or missed a requirement, the Reviewer flags it as `❌ Issues Found` and the Implementer must fix it.

**Phase 3: Code Quality Review**

Dispatch another fresh Reviewer sub-agent using `src/forks/superpowers/code-quality-reviewer-prompt.md`. This reviewer checks for code quality issues independently of the spec.

**Phase 4: Verify & Mark Done**

Run: `npx steroid-run verify <primary-file> --min-lines=<expected>`

If passing, update `.memory/project_state.md` to mark the task as `[x]`.

### Context Wipe Between Tasks

After completing a task, the current sub-agent contexts MUST be terminated. Each new task starts with completely fresh sub-agent contexts reading only from `.memory/project_state.md`. This prevents the hallucination cascade where one bad shortcut poisons the rest of the project.

## The Silence Directive

The human sitting at the keyboard is a non-technical System Builder. NEVER dump sub-agent logs, stack traces, or TDD bash outputs to the main chat window.

When an entire task completes both Implementation and Review, output EXACTLY one line to the human:

"✅ [Task Name] completed and verified."

When all tasks are complete, output: "🎉 The technical blueprint is fully implemented!"

## Referenced Forks

To understand the full, unmodified logic behind this skill, read:

- `src/forks/superpowers/tdd.md` - The complete TDD methodology (372 lines)
- `src/forks/superpowers/subagent.md` - The complete Subagent execution model (276 lines)
- `src/forks/superpowers/implementer-prompt.md` - The Implementer dispatch template
- `src/forks/superpowers/spec-reviewer-prompt.md` - The Spec Reviewer dispatch template
- `src/forks/superpowers/code-quality-reviewer-prompt.md` - The Quality Reviewer dispatch template
- `src/forks/memorycore/save-protocol.md` - The continuous state-tracking protocol (222 lines)
