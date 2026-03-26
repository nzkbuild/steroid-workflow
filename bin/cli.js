#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { copyRecursiveSync } = require('../src/install/fs-helpers.cjs');
const {
    resolveMemoryTemplateDir,
    resolveRuntimeServicesDir,
} = require('../src/install/runtime-layout.cjs');

const targetDir = process.cwd();
const sourceDir = path.join(__dirname, '..');
const pkg = require(path.join(sourceDir, 'package.json'));

// --- Argument Parsing ---
const args = process.argv.slice(2);

if (args.includes('--help') || args.includes('-h')) {
    console.log(`
steroid-workflow v${pkg.version}
${pkg.description}

Usage:
  npx steroid-workflow init            Install into the current project
  npx steroid-workflow update          Update to the latest version
  npx steroid-workflow init --force    Overwrite existing .memory/ state
  npx steroid-workflow --help          Show this help
  npx steroid-workflow --version       Show version

Inside your project (after init):
  node steroid-run.cjs report          Generate a bug report (.memory/bug-report.md)
`);
    process.exit(0);
}

if (args.includes('--version') || args.includes('-v')) {
    console.log(`steroid-workflow v${pkg.version}`);
    process.exit(0);
}

// Command detection
const command = args.find((a) => ['init', 'update'].includes(a)) || 'init';
const isUpdate = command === 'update';
const forceMode = args.includes('--force');

// --- Detect currently installed version ---
function getInstalledVersion() {
    try {
        // Check if steroid-run.cjs exists and try to find version marker
        const maestroFile = path.join(targetDir, 'GEMINI.md');
        if (fs.existsSync(maestroFile)) {
            const content = fs.readFileSync(maestroFile, 'utf-8');
            const match = content.match(/STEROID-WORKFLOW-START/);
            if (match) {
                // Check for version stamp in .memory
                const versionFile = path.join(targetDir, '.memory', '.steroid-version');
                if (fs.existsSync(versionFile)) {
                    return fs.readFileSync(versionFile, 'utf-8').trim();
                }
                return 'unknown (pre-2.1.0)';
            }
        }
        return null; // Not installed
    } catch {
        return null;
    }
}

/**
 * Injects content into a config file using markers.
 * PREPENDS if content doesn't already exist (for maximum LLM priority).
 * Replaces in-place if markers already found (re-install).
 */
function injectContent(filePath, content, markerStart, markerEnd) {
    const block = `${markerStart}\n${content}\n${markerEnd}`;

    if (!fs.existsSync(filePath)) {
        fs.writeFileSync(filePath, `${block}\n`);
        return;
    }

    const existing = fs.readFileSync(filePath, 'utf-8');

    if (existing.includes(markerStart)) {
        // Replace existing block in-place
        const regex = new RegExp(escapeRegExp(markerStart) + '[\\s\\S]*?' + escapeRegExp(markerEnd), 'g');
        const updated = existing.replace(regex, block);
        fs.writeFileSync(filePath, updated);
    } else {
        // PREPEND for maximum LLM priority (not append!)
        fs.writeFileSync(filePath, `${block}\n\n${existing}`);
    }
}

function escapeRegExp(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// --- Maestro Content (The Rules) ---

const MARKER_START = '<!-- STEROID-WORKFLOW-START -->';
const MARKER_END = '<!-- STEROID-WORKFLOW-END -->';

const maestroContent = `SPECIAL INSTRUCTION: Think silently if needed. EFFORT LEVEL 2.00

> [!CAUTION]
> You MUST read and follow ALL steroid-workflow rules below BEFORE executing ANY task.
> This is a PHYSICAL CONSTRAINT, not a suggestion. Violations will be caught by git hooks.

# Steroid-Workflow v${pkg.version} Maestro (Auto-Trigger Rules)

## Pre-Task Checkpoint (MANDATORY)
Before writing ANY code:
1. Check if \\\`.agents/skills/steroid-scan/SKILL.md\\\` exists
2. If it exists → You are in a steroid-workflow project. Follow the pipeline below.
3. Run \\\`node steroid-run.cjs status\\\` to confirm circuit breaker is active
4. Do NOT skip this check. A git pre-commit hook will block commits without pipeline artifacts.

## Intent Routing (v3.0)
For ANY development task, FIRST detect the intent:
\\\`node steroid-run.cjs detect-intent "<user message>" --verbose\\\`

This returns the intent AND the correct pipeline variant:

| Intent | Trigger Words | Pipeline |
|--------|--------------|---------|
| **build** | build, create, add, make, implement | scan → vibe → specify → research → architect → engine → verify |
| **fix** | fix, bug, debug, broken, error | scan → diagnose → engine (targeted) → verify |
| **refactor** | refactor, restructure, optimize | scan → specify (target state) → architect → engine → verify |
| **migrate** | migrate, upgrade, switch to | scan → research (target tech) → architect → engine → verify |
| **document** | document, docs, readme | scan → specify (doc scope) → engine (docs) → verify |

For **build** intent (default): Read \\\`.agents/skills/steroid-scan/SKILL.md\\\` and begin the full pipeline.
For **fix** intent: Read \\\`.agents/skills/steroid-diagnose/SKILL.md\\\` after scan.
For other intents: Follow the pipeline variant above, skipping non-applicable phases.

## Prompt Intelligence (v6.2.0)
Before the workflow locks onto a path, use the prompt intelligence layer when the request is vague, mixed, non-technical, or resumptive:
- \\\`node steroid-run.cjs normalize-prompt "<message>"\\\` — infer intent, ambiguity, complexity, assumptions, and recommended route
- \\\`node steroid-run.cjs normalize-prompt "<message>" --feature <feature> --write\\\` — persist \\\`.memory/changes/<feature>/prompt.json\\\` and \\\`prompt.md\\\`
- \\\`node steroid-run.cjs design-prep "<message>" --feature <feature> --write\\\` — generate both \\\`.memory/changes/<feature>/design-routing.json\\\` and \\\`design-system.md\\\` together
- \\\`node steroid-run.cjs design-route "<message>" --feature <feature> --write\\\` — persist \\\`.memory/changes/<feature>/design-routing.json\\\` for UI-intensive work
- \\\`node steroid-run.cjs design-system --feature <feature> --write\\\` — generate \\\`.memory/changes/<feature>/design-system.md\\\` from Steroid's internal source library
- \\\`node steroid-run.cjs prompt-health "<message>"\\\` — score clarity, completeness, ambiguity, and risk
- \\\`node steroid-run.cjs session-detect\\\` — detect whether this looks like new work, continuation, or post-failure recovery

If \\\`prompt.json\\\` exists, treat it as a first-class handoff artifact. Preserve its assumptions, non-goals, continuation context, and recommended route in later phases.

## Frontend / UI Design Gate
If the task affects UI, UX, visual hierarchy, landing pages, dashboards, responsive layout, motion, forms, onboarding, navigation, or component styling:
- Treat design quality as a first-class requirement, not cosmetic polish
- Prefer Steroid's internal design pipeline over assistant-specific global skill installs. The router centers \\\`steroid-design-orchestrator\\\` and Steroid frontend intelligence, then applies the right implementation and audit systems for the stack
- During research, produce a concrete design system before implementation: pattern, style direction, color tokens, typography, spacing, radii, shadows, states, motion rules, accessibility constraints, and anti-patterns
- During architecture and engine, translate that design system into explicit tasks and code instead of inventing a second design direction
- During verify, expect Steroid to persist \\\`.memory/changes/<feature>/accessibility.json\\\`, optional deep browser evidence in \\\`.memory/changes/<feature>/ui-audit.json\\\`, and consolidated frontend review receipts in \\\`.memory/changes/<feature>/ui-review.md\\\` + \\\`.memory/changes/<feature>/ui-review.json\\\`
- For preview-backed deep UI verification, use \\\`node steroid-run.cjs verify-feature <feature> --deep --url <preview>\\\` when Steroid cannot auto-discover the target
- Do NOT ship generic gradients, random glassmorphism, placeholder hero sections, inconsistent card styles, or default "AI app" aesthetics

## The 8-Skill Pipeline (Build Intent — Full)

| # | Skill | Input | Output |
|---|-------|-------|--------|
| 0 | steroid-scan | Project codebase | .memory/changes/<feature>/request.json + context.md |
| 1 | steroid-vibe-capture | User's natural language | .memory/changes/<feature>/vibe.md |
| 2 | steroid-specify | vibe.md | .memory/changes/<feature>/spec.md |
| 3 | steroid-research | spec.md | .memory/changes/<feature>/research.md |
| 4 | steroid-architect | spec.md + research.md | .memory/changes/<feature>/plan.md |
| 5 | steroid-engine | plan.md | Working code + .memory/changes/<feature>/tasks.md + .memory/changes/<feature>/execution.json |
| 6 | steroid-verify | Completed code | .memory/changes/<feature>/review.md + review.json + verify.md + verify.json + completion.json |
| 7 | steroid-diagnose | Bug/error report | .memory/changes/<feature>/diagnosis.md |

Skills 0-6 flow automatically for build intent. Skill 7 is used only for fix/debug intent.

## Circuit Breaker Enforcement (CRITICAL — REPEATED IN EVERY SKILL)
ALL terminal commands during development MUST be wrapped in:
\\\`node steroid-run.cjs '<command>'\\\`
Direct terminal execution (\\\`npm install\\\`, \\\`npx jest\\\`, \\\`node script.js\\\`, etc.) is STRICTLY FORBIDDEN.
If you need to run \\\`npm install\\\`, you must run: \\\`node steroid-run.cjs 'npm install'\\\`
This is a non-negotiable physical constraint. The wrapper tracks errors and will hard-stop at 5.

## Pipeline Enforcement Commands (MUST USE)
The AI MUST use these physical commands — they cannot be skipped:
- \\\`node steroid-run.cjs init-feature <slug>\\\` — Create feature folder (validates kebab-case)
- \\\`node steroid-run.cjs scan <feature>\\\` — Bootstrap codebase context (writes request.json + context.md)
- \\\`node steroid-run.cjs gate <phase> <feature>\\\` — Check phase prerequisites before proceeding
- \\\`node steroid-run.cjs commit "<message>"\\\` — Atomic git commit in steroid format
- \\\`node steroid-run.cjs log <feature> "<message>"\\\` — Append to progress log
- \\\`node steroid-run.cjs check-plan <feature>\\\` — Check if all tasks are done
- \\\`node steroid-run.cjs verify-feature <feature> [--deep]\\\` — Core verification gate (writes review.md + review.json + verify.md + verify.json + completion.json; optional \\\`--deep\\\` adds scanners)
- \\\`node steroid-run.cjs archive <feature>\\\` — Archive completed feature (\\\`--force-ui\\\` is available if blocking frontend cautions are explicitly accepted)
- \\\`node steroid-run.cjs detect-intent "<message>"\\\` — Classify user intent
- \\\`node steroid-run.cjs normalize-prompt "<message>"\\\` — Normalize a raw user prompt into a structured brief
- \\\`node steroid-run.cjs design-prep "<message>"\\\` — Prepare both UI design artifacts together
- \\\`node steroid-run.cjs design-route "<message>"\\\` — Route UI work to Steroid's internal frontend systems
- \\\`node steroid-run.cjs design-system "<message>"\\\` — Generate a design-system artifact from Steroid frontend intelligence
- \\\`node steroid-run.cjs prompt-health "<message>"\\\` — Score prompt quality before committing to a route
- \\\`node steroid-run.cjs session-detect\\\` — Inspect current project/session state
- \\\`node steroid-run.cjs detect-tests\\\` — Detect test framework in project

## v4.0+ Commands
- \\\`node steroid-run.cjs memory show-all\\\` — View all knowledge stores before coding
- \\\`node steroid-run.cjs memory write <store> '<json>'\\\` — Record patterns, decisions, gotchas
- \\\`node steroid-run.cjs recover\\\` — Smart recovery guidance (5 graduated levels)
- \\\`node steroid-run.cjs stories <feature> next\\\` — Get next prioritized story (P1/P2/P3)
- \\\`node steroid-run.cjs review spec <feature>\\\` — Stage 1: Spec compliance review
- \\\`node steroid-run.cjs review quality <feature>\\\` — Stage 2: Code quality review (after Stage 1 passes)
- \\\`node steroid-run.cjs review ui <feature>\\\` — Refresh frontend review receipts from current UI evidence
- \\\`node steroid-run.cjs review status <feature>\\\` — Check review stage status
- \\\`node steroid-run.cjs report generate <feature>\\\` — Generate handoff report and auto-refresh stale UI review receipts when newer frontend evidence exists
- \\\`node steroid-run.cjs report list\\\` — List all handoff reports
- \\\`node steroid-run.cjs dashboard\\\` — Project health analytics

## .gitignore Protection (v5.0.1)
NEVER overwrite the project's .gitignore. If you need to add entries, ALWAYS APPEND.
The commit command auto-restores steroid entries if missing, but do not rely on this.

## Context Wipe Mandate
After completing each task in the plan.md, terminate the current sub-agent context and start a fresh one.
This prevents hallucination cascades from poisoning multiple tasks.
Each new task reads ONLY from plan.md and progress.md — no inherited context.

## Progress Tracking
The engine captures learnings in \\\`.memory/progress.md\\\` after each task.
Read the Codebase Patterns section at the top before starting any new task.

## Anti-Summarization Rule
NEVER summarize code. NEVER write "...rest of code here..." or "// existing code".
NEVER truncate file contents. Write complete replacements or precise edits.`;

// --- Git Pre-Commit Hook ---

const PRE_COMMIT_HOOK = `#!/bin/sh
# Steroid-Workflow Pre-Commit Enforcement v2.1.0
# This hook ensures the AI followed the pipeline before committing.
# Installed by: npx steroid-workflow init

# Allow steroid commits to pass through (already went through pipeline)
COMMIT_SOURCE="$2"
if [ "$COMMIT_SOURCE" = "message" ]; then
  # Check if it's a steroid commit via the message file
  MSG_FILE="$1"
  if [ -n "$MSG_FILE" ] && [ -f "$MSG_FILE" ]; then
    if grep -q "^feat(steroid):" "$MSG_FILE" 2>/dev/null; then
      exit 0
    fi
  fi
fi

# Check: Are source code files being committed?
CODE_FILES=$(git diff --cached --name-only --diff-filter=ACM | grep -E '\\.(js|ts|jsx|tsx|py|go|rs|java|rb|php|vue|svelte|css|html|swift|kt|dart|c|cpp|h|cs|scala|ex|exs|hs|ml|clj|r|jl|lua|zig|nim|v|d|sql)$' || true)

if [ -z "$CODE_FILES" ]; then
  # No code files staged, allow commit (docs, config, etc.)
  exit 0
fi

# Check: Does .memory/changes/ directory exist?
if [ ! -d ".memory/changes" ]; then
  echo ""
  echo "============================================================"
  echo " STEROID-WORKFLOW: Commit blocked"
  echo "============================================================"
  echo ""
  echo " No .memory/changes/ directory found."
  echo " The AI must use the steroid pipeline before committing code."
  echo ""
  echo " Tell your AI:"
  echo "   \\"Use the steroid pipeline to implement this.\\""
  echo ""
  echo "============================================================"
  echo ""
  exit 1
fi

# Check: Is there at least one plan.md in any feature?
PLANS=$(find .memory/changes -name "plan.md" -maxdepth 2 2>/dev/null)
if [ -z "$PLANS" ]; then
  echo ""
  echo "============================================================"
  echo " STEROID-WORKFLOW: Commit blocked"
  echo "============================================================"
  echo ""
  echo " No plan.md found in any feature folder."
  echo " The AI skipped the pipeline:"
  echo "   vibe -> spec -> research -> architect -> engine"
  echo ""
  echo " Tell your AI:"
  echo "   \\"Follow the steroid pipeline.\\""
  echo ""
  echo "============================================================"
  echo ""
  exit 1
fi

# All checks passed
exit 0
`;

// --- Installation Target ---
const skillsTarget = '.agents/skills';

// --- Main Installation ---

console.log('');
console.log('╔══════════════════════════════════════════════╗');
console.log(`║     🧬 Steroid-Workflow v${pkg.version}                ║`);
console.log('╚══════════════════════════════════════════════╝');

const installedVersion = getInstalledVersion();
if (isUpdate && !installedVersion) {
    console.log('');
    console.log('⚠️  No existing installation found. Running fresh install instead.');
} else if (isUpdate && installedVersion) {
    console.log(`   Updating: ${installedVersion} → v${pkg.version}`);
} else if (!isUpdate && installedVersion) {
    console.log(`   Reinstalling over: ${installedVersion}`);
}
console.log('');

// Step 1: Install Memory Templates
const memoryDir = path.join(targetDir, '.memory');
if (fs.existsSync(memoryDir) && !forceMode) {
    console.log('📦 [1/7] Runtime memory schema...');
    console.log('   ⚠️  .memory/ already exists. Skipping to preserve your project state.');
    console.log('   (Use --force to overwrite)');
} else {
    console.log('📦 [1/7] Installing runtime memory schema...');
    copyRecursiveSync(resolveMemoryTemplateDir(sourceDir), memoryDir);
    const changesDir = path.join(memoryDir, 'changes');
    if (!fs.existsSync(changesDir)) {
        fs.mkdirSync(changesDir, { recursive: true });
    }
    console.log('   ✅ .memory/ created with execution_state.json, progress.md, and changes/ folder');
}

// Step 2: Install Skills
console.log('🧠 [2/7] Installing Steroid skills (8-skill pipeline)...');
const destSkills = path.join(targetDir, skillsTarget);
copyRecursiveSync(path.join(sourceDir, 'skills'), destSkills);
console.log(`   ✅ Skills installed to ${skillsTarget}/`);
console.log(`      → scan → vibe-capture → specify → research → architect → engine → verify (+ diagnose)`);

// Step 3: Install runtime assets + steroid-run.cjs
console.log('📦 [3/7] Installing Steroid runtime assets and pipeline enforcer...');
copyRecursiveSync(path.join(sourceDir, 'src', 'services'), resolveRuntimeServicesDir(targetDir));
fs.copyFileSync(path.join(sourceDir, 'bin', 'steroid-run.cjs'), path.join(targetDir, 'steroid-run.cjs'));
console.log('   ✅ Runtime services installed to .steroid/runtime/services/');
console.log('   ✅ steroid-run.cjs copied to project root (pipeline enforcer)');

// Step 4: Inject IDE Trigger Rules (The Maestro) — ALL major IDEs
console.log('🔌 [4/7] Injecting Maestro rules into IDE configs...');

// Track which config files existed before install (don't gitignore pre-existing ones)
const preExistingConfigs = [];

const ideConfigs = [
    { name: 'GEMINI.md', path: 'GEMINI.md', label: 'Gemini CLI / Antigravity' },
    { name: '.cursorrules', path: '.cursorrules', label: 'Cursor' },
    { name: 'CLAUDE.md', path: 'CLAUDE.md', label: 'Claude Code' },
    { name: '.windsurfrules', path: '.windsurfrules', label: 'Windsurf' },
    { name: 'copilot-instructions.md', path: '.github/copilot-instructions.md', label: 'GitHub Copilot' },
    { name: 'AGENTS.md', path: 'AGENTS.md', label: 'OpenAI Codex' },
    { name: '.clinerules', path: '.clinerules', label: 'Cline' },
];
const ideConfigCount = ideConfigs.length;

for (const config of ideConfigs) {
    const fullPath = path.join(targetDir, config.path);

    // Track pre-existing files
    if (fs.existsSync(fullPath)) {
        preExistingConfigs.push(config.path);
    }

    // Ensure parent directory exists (for .github/copilot-instructions.md)
    const parentDir = path.dirname(fullPath);
    if (!fs.existsSync(parentDir)) {
        fs.mkdirSync(parentDir, { recursive: true });
    }

    injectContent(fullPath, maestroContent, MARKER_START, MARKER_END);
    console.log(`   ✅ ${config.label} → ${config.path}`);
}

// Step 5: Install Git Pre-Commit Hook
console.log('🔒 [5/7] Installing git pre-commit hook (physical enforcement)...');
const gitDir = path.join(targetDir, '.git');
if (fs.existsSync(gitDir)) {
    const hooksDir = path.join(gitDir, 'hooks');
    if (!fs.existsSync(hooksDir)) {
        fs.mkdirSync(hooksDir, { recursive: true });
    }

    const hookPath = path.join(hooksDir, 'pre-commit');
    const hookExists = fs.existsSync(hookPath);

    if (hookExists && !forceMode) {
        // Check if it's our hook or user's own hook
        const existingHook = fs.readFileSync(hookPath, 'utf-8');
        if (existingHook.includes('STEROID-WORKFLOW')) {
            fs.writeFileSync(hookPath, PRE_COMMIT_HOOK, { mode: 0o755 });
            console.log('   ✅ Pre-commit hook updated');
        } else {
            console.log('   ⚠️  Pre-commit hook already exists (not ours). Skipping to avoid conflict.');
            console.log('   (Use --force to overwrite)');
        }
    } else {
        fs.writeFileSync(hookPath, PRE_COMMIT_HOOK, { mode: 0o755 });
        console.log('   ✅ Pre-commit hook installed → .git/hooks/pre-commit');
        console.log('      Commits with code changes are BLOCKED unless a plan.md exists.');
    }
} else {
    console.log('   ⚠️  No .git directory found. Initialize git first: git init');
    console.log('   Then re-run: npx steroid-workflow init');
}

// Step 6: Setup .gitignore
console.log('📋 [6/7] Setting up .gitignore...');
const userGitignore = path.join(targetDir, '.gitignore');

// Base entries (always gitignored)
const gitignoreEntries = ['.memory/', '.steroid/', 'steroid-run.cjs', '.agents/'];

// Only gitignore IDE config files that were CREATED by us (not pre-existing)
for (const config of ideConfigs) {
    if (!preExistingConfigs.includes(config.path)) {
        gitignoreEntries.push(config.path);
    }
}

if (fs.existsSync(userGitignore)) {
    const existing = fs.readFileSync(userGitignore, 'utf-8');
    const toAdd = gitignoreEntries.filter((e) => !existing.includes(e));
    if (toAdd.length > 0) {
        fs.appendFileSync(userGitignore, '\n# Steroid-Workflow (auto-added)\n' + toAdd.join('\n') + '\n');
        console.log(`   ✅ Added ${toAdd.length} entries to .gitignore`);
    } else {
        console.log('   ✅ .gitignore already has steroid entries');
    }
} else {
    fs.writeFileSync(userGitignore, '# Steroid-Workflow\n' + gitignoreEntries.join('\n') + '\nnode_modules/\n');
    console.log('   ✅ Created .gitignore');
}

if (preExistingConfigs.length > 0) {
    console.log(`   ℹ️  Kept ${preExistingConfigs.join(', ')} tracked (pre-existing)`);
}

// Step 7: Shared Maestro reference for YAML-based IDEs (Aider)
console.log('📄 [7/7] Creating shared Maestro reference...');
const sharedMaestro = path.join(targetDir, '.agents', 'steroid-maestro.md');
if (!fs.existsSync(path.dirname(sharedMaestro))) {
    fs.mkdirSync(path.dirname(sharedMaestro), { recursive: true });
}
fs.writeFileSync(sharedMaestro, `${MARKER_START}\n${maestroContent}\n${MARKER_END}\n`);
console.log('   ✅ .agents/steroid-maestro.md created (shared reference for all IDEs)');

// Stamp installed version
const versionFile = path.join(targetDir, '.memory', '.steroid-version');
fs.writeFileSync(versionFile, pkg.version);

// Done
const verb = isUpdate ? 'updated' : 'installed';
console.log('');
console.log('╔══════════════════════════════════════════════════════════════╗');
console.log(`║  ✅ Steroid-Workflow v${pkg.version} ${verb}!${' '.repeat(Math.max(0, 25 - verb.length))}║`);
console.log('║                                                              ║');
console.log('║  🔒 Git hook active — AI cannot commit without pipeline      ║');
console.log(`║  🧠 ${String(ideConfigCount).padEnd(2)} IDE configs injected — universal coverage             ║`);
console.log('║  📋 Pipeline: scan → vibe → spec → research → arch → engine ║');
console.log('║  ✅ Verification: steroid-verify enforces proof of work       ║');
console.log('║  🔍 Intent routing: build/fix/refactor/migrate/document      ║');
console.log('╚══════════════════════════════════════════════════════════════╝');
console.log('');
if (isUpdate) {
    console.log('Update complete. All enforcement layers refreshed.');
    console.log('');
    console.log('Verify:');
    console.log('  node steroid-run.cjs audit');
} else {
    console.log('Tell your AI what you want to build:');
    console.log('  👉 "Build me a minimal to-do app that looks like Notion"');
    console.log('  👉 "Add user authentication to my app"');
    console.log('  👉 "Fix the login bug and refactor the auth module"');
    console.log('');
    console.log('The AI will automatically activate the steroid pipeline.');
    console.log('If it doesn\'t, say: "Use the steroid pipeline."');
    console.log('');
    console.log('Verify installation:');
    console.log('  node steroid-run.cjs audit');
}
console.log('');
console.log('Future updates:');
console.log('  npx steroid-workflow@latest update');
console.log('');
