---
name: steroid-verify
description: The verification skill for Steroid-Workflow. This skill runs after the engine completes all tasks, proving the code works before allowing archival. It performs spec compliance review, code quality review, test execution, and anti-pattern scanning. Produces verify.md as evidence.
---

# Steroid Verify (Proof of Work)

This skill runs **after** the engine completes all tasks in `plan.md`. It proves the AI's code actually works before the feature can be archived. Without verification, the pipeline is just a promise — this skill makes it proof.

Adapted from:
- **GSD Verifier** (see `src/forks/gsd/agents/gsd-verifier.md`) — Goal-backward verification, 3-level artifact checks, anti-pattern scanning
- **Superpowers Spec Compliance Review** (see `src/forks/superpowers/spec-reviewer-prompt.md`) — Independent requirement verification
- **Superpowers Code Quality Review** (see `src/forks/superpowers/code-quality-reviewer-prompt.md`) — Structural quality checks
- **Superpowers Verification Before Completion** (see `src/forks/superpowers/verification-before-completion/SKILL.md`) — Evidence-before-claims gate

## The Iron Law

```
NO COMPLETION CLAIMS WITHOUT FRESH VERIFICATION EVIDENCE
```

Source: `src/forks/superpowers/verification-before-completion/SKILL.md` — "Claiming work is complete without verification is dishonesty, not efficiency."

If you haven't run the verification command and seen its output, you cannot claim the feature passes.

## The Circuit Breaker Mandate

All terminal commands executed by this skill MUST be wrapped in the physical Node.js circuit breaker:

```
node steroid-run.cjs '<command>'
```

## Phase Gate (Physical Enforcement)

Before doing anything, run the gate check:
```
node steroid-run.cjs gate verify <feature>
```
If this command fails, STOP. The engine phase is not complete.

Then run the feature verification pre-check:
```
node steroid-run.cjs verify-feature <feature>
```
This confirms all tasks in `plan.md` are marked `[x]`.

## The Verification Process

### Step 1: Load Context

Read these files to understand what was built:

1. `.memory/changes/<feature>/spec.md` — The acceptance criteria (what SHOULD be true)
2. `.memory/changes/<feature>/plan.md` — The task list (what was DONE)
3. `.memory/changes/<feature>/context.md` — The project context (tech stack, test infra)

Extract:
- All acceptance scenarios (Given/When/Then) from spec.md
- All completed tasks from plan.md
- Test framework and run command from context.md

### Step 2: Spec Compliance Review

**Source: `src/forks/superpowers/spec-reviewer-prompt.md`**

> "Your job is to compare the task's stated requirements against the actual code. Do NOT trust the implementer's report. Read the actual code."

For EACH acceptance criterion in spec.md:

1. **Find the code** that implements it (grep for related functions, components, routes)
2. **Read the actual code** — not just the file name, the implementation
3. **Determine status:**
   - ✅ **IMPLEMENTED** — Code exists AND handles the described scenario
   - ⚠️ **PARTIAL** — Code exists but missing edge cases or error handling
   - ❌ **MISSING** — No code found that addresses this criterion
   - 🔄 **EXTRA** — Code does something NOT in the spec (flag for review)

**Critical mindset** (from GSD Verifier): "Do NOT trust SUMMARY.md claims. SUMMARYs document what the AI SAID it did. You verify what ACTUALLY exists in the code. These often differ."

### Step 3: Code Quality Review

**Source: `src/forks/superpowers/code-quality-reviewer-prompt.md`**

Review all files created or modified during the feature. For each file, check:

1. **Single Responsibility** — Does each file/function do one thing?
2. **Naming** — Are names descriptive and consistent with project conventions?
3. **Error Handling** — Are errors caught and handled appropriately?
4. **No Stubs** — Are there any placeholder implementations?

**Anti-Pattern Scanning** (from GSD Verifier):

```bash
# TODO/FIXME/placeholder comments
node steroid-run.cjs 'grep -rn "TODO\|FIXME\|HACK\|PLACEHOLDER" <file>'

# Empty implementations
node steroid-run.cjs 'grep -rn "return null\|return {}\|return \[\]\|=> {}" <file>'

# Console.log-only handlers
node steroid-run.cjs 'grep -rn "console\.log" <file>'
```

Categorize issues by severity:
- 🛑 **Critical** — Prevents feature from working (missing implementation, broken import)
- ⚠️ **Important** — Works but fragile (no error handling, hardcoded values)
- ℹ️ **Minor** — Cosmetic or style issues (naming, unused imports)

### Step 4: Test Execution

Read the test framework from `context.md`. If tests exist:

```bash
node steroid-run.cjs '<test-command>'
```

Record:
- Whether tests pass or fail
- Number of tests run
- Any test failures with file + line

If NO test framework detected, note this as a gap but don't fail verification.

### Step 5: Lint & Type Check (If Available)

```bash
# TypeScript projects
node steroid-run.cjs 'npx tsc --noEmit 2>&1 | tail -20'

# ESLint projects
node steroid-run.cjs 'npx eslint src/ --max-warnings=0 2>&1 | tail -20'
```

Only run if the tools are detected in `context.md` / `package.json`.

### Step 6: Determine Overall Status

**PASS** — All acceptance criteria IMPLEMENTED, no Critical issues, tests passing (if any)

**FAIL** — Any acceptance criterion MISSING, Critical issues found, or tests failing

**CONDITIONAL** — All criteria implemented but Important issues exist or no tests

### Step 7: Write verify.md

Write results to `.memory/changes/<feature>/verify.md`:

```markdown
# Verification Report: <feature>

**Verified:** <timestamp>
**Status:** PASS | FAIL | CONDITIONAL
**Spec Score:** <implemented>/<total> criteria verified

## Spec Compliance

| # | Criterion | Status | Evidence |
|---|-----------|--------|----------|
| 1 | <from spec.md> | ✅ IMPLEMENTED | <file:line — what it does> |
| 2 | <from spec.md> | ❌ MISSING | <what's not there> |

## Code Quality

### Issues Found

| File | Line | Severity | Issue |
|------|------|----------|-------|
| <path> | <line> | 🛑 Critical | <description> |
| <path> | <line> | ⚠️ Important | <description> |

### Strengths
- <positive observations>

## Test Results

- **Framework:** <from context.md>
- **Result:** <pass/fail/no tests>
- **Tests Run:** <count>
- **Failures:** <count and details>

## Lint / Type Check

- **TypeScript:** <pass/fail/not applicable>
- **ESLint:** <pass/fail/not applicable>

## Anti-Patterns

| File | Line | Pattern | Impact |
|------|------|---------|--------|
| <path> | <line> | <TODO/stub/empty> | <what it affects> |

## Overall Assessment

<2-3 sentence summary. What works, what doesn't, what needs attention.>

---

_Verified: <timestamp>_
_Verifier: steroid-verify_
```

## After Verification

### If PASS:
1. Output: "✅ Verification passed. Feature ready to archive."
2. The archive command will now succeed (gate requires verify.md with PASS)

### If FAIL:
1. Output: "❌ Verification failed. <count> issues must be resolved."
2. List the Critical/Missing items
3. The engine must re-run to fix these items before re-verification

### If CONDITIONAL:
1. Output: "⚠️ Verification conditional. Feature works but has <count> Important issues."
2. Ask the user: "Archive now or fix first?"

## The Silence Directive

The human at the keyboard is a non-technical System Builder. Do NOT dump raw test output, grep results, or lint errors to the main chat.

Instead:
- Summarize: "Found 2 issues in the login component that need fixing."
- Show the verify.md summary, not the raw evidence

## Referenced Forks

- `src/forks/gsd/agents/gsd-verifier.md` — The complete goal-backward verification system (582 lines)
- `src/forks/superpowers/spec-reviewer-prompt.md` — Spec compliance review template (62 lines)
- `src/forks/superpowers/code-quality-reviewer-prompt.md` — Code quality review template (27 lines)
- `src/forks/superpowers/verification-before-completion/SKILL.md` — Evidence-before-claims gate (140 lines)
- `src/forks/superpowers/systematic-debugging/SKILL.md` — If verification reveals bugs, use this for diagnosis
