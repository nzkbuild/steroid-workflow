---
name: steroid-diagnose
description: The debugging and diagnosis skill for Steroid-Workflow. Used when the user's intent is "fix" or "debug". Replaces the specify/research/architect phases with a focused 4-phase root cause investigation, then hands off a targeted fix plan to the engine.
---

# Steroid Diagnose (Fix/Debug Pipeline)

This skill replaces the full build pipeline when the user wants to **fix a bug** or **debug an issue**. Instead of vibe → specify → research → architect, it runs a focused diagnosis that produces `diagnosis.md` with root cause analysis and a targeted fix plan.

Adapted from:
- **Steroid Systematic Debugging** (see `Steroid internal reference`) — 4-phase root cause process
- **Steroid Root Cause Tracing** (see `Steroid internal reference`) — Backward call-stack tracing
- **Steroid Defense in Depth** (see `Steroid internal reference`) — Multi-layer validation after fix
- **Steroid Debugger** (see `Steroid internal reference`) — Codebase-aware debugging

## The Iron Law

```
NO FIXES WITHOUT ROOT CAUSE INVESTIGATION FIRST
```

Source: `Steroid internal reference` — "Random fixes waste time and create new bugs. Quick patches mask underlying issues."

If you haven't completed Phase 1 (Root Cause Investigation), you CANNOT propose fixes.

## The Circuit Breaker Mandate

All terminal commands MUST be wrapped in:
```
node steroid-run.cjs '<command>'
```

## Pipeline Position

This skill is triggered when `node steroid-run.cjs detect-intent "<message>"` returns `fix`.

**Fix/Debug pipeline:** scan → **diagnose** → engine (targeted) → verify

It runs AFTER `steroid-scan` (context.md must exist) and BEFORE `steroid-engine`.

If `.memory/changes/<feature>/prompt.json` exists, read it before diagnosis. Use it to preserve:
- the user's exact problem framing
- continuation or post-failure context
- any explicit non-goals so the diagnosis does not widen into a rebuild
- the recommended `diagnose-first` route if present

## The Four Phases

### Pre-Check

Before starting diagnosis, run the gate to ensure scan has completed:
```bash
node steroid-run.cjs gate diagnose <feature>
```
This verifies `context.md` exists from the scan phase.

### Phase 1: Root Cause Investigation

**BEFORE attempting ANY fix:**

1. **Read Error Messages Carefully**
   - Read stack traces completely
   - Note line numbers, file paths, error codes
   - Don't skip past warnings

2. **Reproduce Consistently**
   ```bash
   node steroid-run.cjs '<reproduction command>'
   ```
   - Can you trigger it reliably?
   - What are the exact steps?
   - If not reproducible → gather more data, don't guess

3. **Check Recent Changes**
   ```bash
   node steroid-run.cjs 'git log --oneline -10'
   node steroid-run.cjs 'git diff HEAD~3 --stat'
   ```
   - What changed recently that could cause this?
   - New dependencies? Config changes?

4. **Trace Data Flow**
   Use the backward tracing technique from `Steroid internal reference`:
   - Where does the bad value originate?
   - What called this function with bad input?
   - Keep tracing up until you find the source
   - Fix at source, not at symptom

### Phase 2: Pattern Analysis

1. **Find Working Examples** — Locate similar working code in the same codebase
2. **Compare Against References** — Read reference implementations COMPLETELY
3. **Identify Differences** — What's different between working and broken?
4. **Understand Dependencies** — What other components does this need?

### Phase 3: Hypothesis and Testing

1. **Form Single Hypothesis** — "I think X is the root cause because Y"
2. **Test Minimally** — Make the SMALLEST possible change to test
3. **One Variable at a Time** — Don't fix multiple things at once
4. **If It Doesn't Work** — Form NEW hypothesis, don't stack fixes

### Phase 4: Write Diagnosis

Write findings to `.memory/changes/<feature>/diagnosis.md`:

```markdown
# Diagnosis: <feature>

**Diagnosed:** <timestamp>
**Status:** ROOT_CAUSE_FOUND | NEEDS_MORE_DATA | ARCHITECTURAL_ISSUE

## Problem Statement

<What the user reported, in their words>

## Root Cause

<The actual root cause, traced to specific file:line>

## Evidence

- <What was observed>
- <What was expected>
- <Stack trace or error output>

## Fix Plan

- [ ] <Specific change 1 — file:line — what to change>
- [ ] <Specific change 2 — file:line — what to change>

## Regression Test

<How to verify the fix — a test case or manual steps>

## Files Affected

- `<file path>` — <what needs to change>
```

If `prompt.json` recorded assumptions or unresolved questions that affect reproduction, copy the relevant ones into the Problem Statement or Evidence section rather than silently discarding them.

## After Diagnosis

The diagnosis.md is handed to `steroid-engine`, which executes the fix plan tasks using TDD:
1. Write a failing test that reproduces the bug
2. Fix the code to make the test pass
3. Verify no other tests broke
4. Hand off to `steroid-verify`

## Red Flags — STOP and Return to Phase 1

If you catch yourself thinking:
- "Quick fix for now, investigate later"
- "Just try changing X and see if it works"
- "I don't fully understand but this might work"
- "One more fix attempt" (when already tried 2+)

**ALL of these mean: STOP. Return to Phase 1.**

## 3+ Fixes Failed = Question Architecture

If 3 or more fix attempts fail, this is NOT a bug — it's likely an **architectural problem**:
- Each fix reveals new coupling/shared state issues
- Fixes require "massive refactoring" to implement
- Each fix creates new symptoms elsewhere

**STOP and escalate to the user:** "This issue appears to be architectural, not a simple bug. Here's what I've found: [diagnosis]. I recommend [approach]. Would you like me to proceed or take a different approach?"

## Recovery-Aware Diagnosis (v4.0)

Instead of retrying blindly, use smart recovery:

```bash
node steroid-run.cjs recover
```

This provides graduated guidance based on how many errors have occurred (1-5). After diagnosis, record the pattern for future reference:

```bash
node steroid-run.cjs memory write gotchas '{"issue-keyword": "fix description"}'
```

## Referenced Forks

- `Steroid internal reference` — Full 4-phase debugging process (297 lines)
- `Steroid internal reference` — Backward tracing technique
- `Steroid internal reference` — Multi-layer validation
- `Steroid internal reference` — Replace timeouts with condition polling
- `Steroid internal reference` — Codebase-aware debugging agent
