---
name: steroid-verify
description: The verification skill for Steroid-Workflow. This skill runs after the engine completes all tasks, proving the code works before allowing archival. It performs core verification by default and can run optional deep scans. Produces verify.md and verify.json as evidence.
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
This is the core verification gate. It confirms review status, task completion, and runtime checks.

If you want optional deep scans for code smells and license auditing, run:
```bash
node steroid-run.cjs verify-feature <feature> --deep
```

## Two-Stage Review Gate (v5.0)

Before running the verification process, ensure the two-stage review is complete:

```bash
node steroid-run.cjs review status <feature>
```

If both stages show PASS, proceed to verification. If not:

1. Run `node steroid-run.cjs review spec <feature>` — then complete Stage 1
2. Run `node steroid-run.cjs review quality <feature>` — then complete Stage 2

**The review MUST pass both stages before core verification can pass and before `verify.json` can record a passing result.**

Source: `src/forks/superpowers/subagent.md` — "Spec compliance first, then code quality. Never skip reviews."

## The Verification Process

### Step 1: Load Context

Read these files to understand what was built:

1. `.memory/changes/<feature>/spec.md` — The acceptance criteria (what SHOULD be true)
2. `.memory/changes/<feature>/plan.md` — The task list (what was DONE)
3. `.memory/changes/<feature>/context.md` — The project context (tech stack, test infra)
4. `.memory/changes/<feature>/prompt.json` — The normalized user intent, if present

Extract:
- All acceptance scenarios (Given/When/Then) from spec.md
- All completed tasks from plan.md
- Test framework and run command from context.md
- All success criteria (SC-001, SC-002, etc.) from spec.md
- Recommended route, assumptions, and non-goals from prompt.json when available

If the feature followed the fix pipeline and uses `diagnosis.md` instead of `plan.md`, read that targeted fix plan as the execution source instead of failing immediately.

### Step 1b: Success Criteria Verification (v5.0.2)

Read spec.md for any `## Success Criteria` section. For EACH criterion:

1. **Verify it** — run the check if possible (e.g., `npm run build` for performance)
2. **Or mark explicitly** as "⚠️ Requires manual testing" with reason

Report in verify.md:

```markdown
## Success Criteria

| SC | Criterion | Status | Method |
|----|-----------|--------|--------|
| SC-001 | Lighthouse 95+ | ⚠️ Manual | Requires browser testing |
| SC-002 | Theme toggle <100ms | ✅ Verified | Measured via code review |
```

Do NOT mark verify.md as PASS if mandatory success criteria exist but none were checked.

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

### Step 3b: AI Code Smell Scan (optional deep verification)

AI models frequently produce code with invisible defects that non-technical users will never catch. Run these scans on the project:

**1. Dead Code & Phantom Dependencies** — via `knip` (MIT, 2M+ downloads)

```bash
node steroid-run.cjs 'npx knip --no-exit-code --reporter compact 2>&1 | head -50'
```

`knip` detects: unused files, unused exports, unused dependencies, AND missing dependencies (packages imported but not in `package.json`). It handles dynamic imports, TypeScript path aliases, and framework-specific patterns that grep cannot.

If `knip` reports missing dependencies → 🛑 **Critical** (app will crash on launch).
If `knip` reports unused dependencies → ⚠️ **Important** (bloated bundle).

**2. Circular Dependencies** — via `madge` (MIT)

```bash
node steroid-run.cjs 'npx madge --circular src/ 2>&1 | head -30'
```

Circular imports (A → B → C → A) cause `undefined` values at runtime. AI-generated code creates these constantly because the AI doesn't see the global dependency graph. If `madge` finds any → 🛑 **Critical**.

**3. Hardcoded Secrets** — via `gitleaks` (MIT, 100+ patterns)

```bash
node steroid-run.cjs 'npx @ziul285/gitleaks detect --no-git --source . 2>&1 | head -30'
```

Covers AWS, Stripe, Twilio, Firebase, Supabase, SendGrid, GitHub tokens, and 90+ other services. If any secrets found → 🛑 **Critical** (security breach risk).

If `gitleaks` is unavailable (Go binary not supported on platform), fall back to:
```bash
node steroid-run.cjs 'grep -rnE "(sk-|pk_live_|ghp_|AKIA|rk_live_|Bearer |password\s*=\s*\")" src/ --include="*.{js,ts,jsx,tsx,py}" | head -20'
```

**4. Placeholder Content & Deprecated APIs** (grep — no good MIT tool exists)

```bash
# Placeholder URLs and content
node steroid-run.cjs 'grep -rnE "(example\.com|lorem ipsum|placeholder|https?://api\.example)" src/ --include="*.{js,ts,jsx,tsx}" | head -20'

# Deprecated React patterns (if React project)
node steroid-run.cjs 'grep -rnE "(componentWillMount|componentWillReceiveProps|findDOMNode)" src/ --include="*.{js,ts,jsx,tsx}" | head -20'
```

If placeholders found → ⚠️ **Important**. If deprecated APIs found → ⚠️ **Important**.

**Verdict Rule**: If ANY 🛑 Critical finding exists, the final verdict MUST be **CONDITIONAL**, not PASS. Document each finding with file path, line number, and explanation.

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

**Test Enforcement (v5.0.2):** If spec.md has acceptance criteria AND the test count is 0:
- Verdict MUST be **CONDITIONAL**, not PASS
- Add warning: "⚠️ No tests found. TDD mandate not followed."
- List which acceptance criteria lack test coverage
- Exception: If spec explicitly notes "No tests required" or project is static/docs-only

### Step 5: Lint & Type Check (If Available)

```bash
# TypeScript projects
node steroid-run.cjs 'npx tsc --noEmit 2>&1 | tail -20'

# ESLint projects
node steroid-run.cjs 'npx eslint src/ --max-warnings=0 2>&1 | tail -20'
```

Only run if the tools are detected in `context.md` / `package.json`.

### Step 5a+: Language-Aware Verification (v5.4.0)

Read the tech stack from context.md and use the appropriate commands:

| Language | Build | Lint | Type Check | Test |
|----------|-------|------|------------|------|
| JS/TS | `npm run build` | `npx eslint src/` | `npx tsc --noEmit` | `npm test` |
| Python | `python -m py_compile *.py` | `flake8` or `ruff check .` | `mypy .` | `pytest` |
| Rust | `cargo build` | `cargo clippy` | (built-in) | `cargo test` |
| Go | `go build ./...` | `golangci-lint run` | (built-in) | `go test ./...` |
| Java | `mvn compile` or `gradle build` | `checkstyle` | (compiler) | `mvn test` or `gradle test` |
| Ruby | (none) | `rubocop` | (none) | `rspec` or `rake test` |
| PHP | (none) | `phpcs` or `phpstan` | (none) | `phpunit` |

Wrap ALL commands in: `node steroid-run.cjs '<command>'`

Only run the checks that match the detected language. Skip unavailable tools gracefully.

### Step 5b: Infrastructure Verification (v5.0.2)

Before writing the final verdict, check these physical items:

1. **Build** — `node steroid-run.cjs 'npm run build'` exits 0 (if build script exists)
2. **Lint warnings** — Run the project's linter. Report warnings AND errors, not just errors.
3. **Dependencies** — `node steroid-run.cjs 'npm ls --depth=0'` — no unmet peer deps
4. **Config integrity** — `.gitignore` still contains steroid entries
5. **Progress updated** — `.memory/progress.md` Codebase Patterns is not "Unknown"
6. **Version** — `package.json` has a valid semver `version` field (v5.2.0)
7. **README exists** — Project has a `README.md` with install + run instructions (v5.2.0)
8. **License audit** (v5.3.0) — Run `node steroid-run.cjs 'npx license-checker --summary 2>/dev/null || echo No license-checker'`. Flag GPL/AGPL (viral — may require open-sourcing), unlicensed, or deprecated packages. For non-technical users: "All dependencies use permissive licenses ✅" or "⚠️ Found GPL dependency"

Report each check in verify.md under `## Infrastructure`.

### Step 6: Determine Overall Status

**PASS** — All acceptance criteria IMPLEMENTED, no Critical issues, tests passing (if any)

**FAIL** — Any acceptance criterion MISSING, Critical issues found, or tests failing

**CONDITIONAL** — All criteria implemented but Important issues exist or no tests

### Step 7: Write verify.md / verify.json

Write results to `.memory/changes/<feature>/verify.md` and `.memory/changes/<feature>/verify.json`:

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
2. The archive command will now succeed (gate requires `verify.json` with PASS)

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
