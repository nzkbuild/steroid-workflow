#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const targetDir = process.cwd();
const stateFile = path.join(targetDir, '.memory', 'execution_state.json');
const memoryDir = path.join(targetDir, '.memory');
const changesDir = path.join(memoryDir, 'changes');
const progressFile = path.join(memoryDir, 'progress.md');

// --- Argument Parsing ---
const args = process.argv.slice(2);

if (args.length === 0 || args[0] === '--help' || args[0] === '-h') {
    console.log(`
steroid-run — The physical pipeline enforcer for AI-driven development.

Usage:
  Circuit Breaker:
    npx steroid-run '<command>'                       Execute a command with error tracking
    npx steroid-run verify <file> --min-lines=<n>     Verify file meets minimum line count
    npx steroid-run reset                             Reset the error counter to 0
    npx steroid-run status                            Show current circuit breaker state

  Pipeline Enforcement:
    npx steroid-run init-feature <slug>               Create feature folder structure
    npx steroid-run gate <phase> <feature>            Check phase prerequisites
    npx steroid-run commit <message>                  Atomic git commit in steroid format
    npx steroid-run log <feature> <message>           Append to progress log
    npx steroid-run check-plan <feature>              Count remaining tasks in plan
    npx steroid-run archive <feature>                 Archive completed feature

  Progress:
    npx steroid-run progress                          Show execution learnings log
    npx steroid-run progress --patterns               Show only codebase patterns

The circuit breaker tracks errors in .memory/execution_state.json.
After 3 consecutive errors, all execution is blocked until you run 'reset'.
`);
    process.exit(0);
}

// --- Ensure state file exists ---
if (!fs.existsSync(stateFile)) {
    if (!fs.existsSync(path.dirname(stateFile))) {
        fs.mkdirSync(path.dirname(stateFile), { recursive: true });
    }
    fs.writeFileSync(stateFile, JSON.stringify({ error_count: 0, last_error: null, status: 'active' }, null, 2));
}

let state;
try {
    state = JSON.parse(fs.readFileSync(stateFile, 'utf-8'));
} catch (e) {
    state = { error_count: 0, last_error: null, status: 'active' };
}

// --- Reset Command (P0 Fix B2) ---
if (args[0] === 'reset') {
    state.error_count = 0;
    state.last_error = null;
    state.status = 'active';
    fs.writeFileSync(stateFile, JSON.stringify(state, null, 2));
    console.log('[steroid-run] ✅ Circuit breaker reset. Error count is now 0/3. You may resume.');
    process.exit(0);
}

// --- Status Command ---
if (args[0] === 'status') {
    console.log(`[steroid-run] Circuit Breaker Status:`);
    console.log(`  Error Count: ${state.error_count}/3`);
    console.log(`  Status: ${state.error_count >= 3 ? '🔴 TRIPPED' : '🟢 ACTIVE'}`);
    if (state.last_error) console.log(`  Last Error: ${state.last_error}`);
    process.exit(0);
}

// --- Progress Command (Ralph pattern) ---
if (args[0] === 'progress') {
    const progressFile = path.join(targetDir, '.memory', 'progress.md');
    if (!fs.existsSync(progressFile)) {
        console.log('[steroid-run] No progress log found yet. It will be created when the engine starts building.');
        process.exit(0);
    }
    const content = fs.readFileSync(progressFile, 'utf-8');
    if (args.includes('--patterns')) {
        // Extract only the Codebase Patterns section
        const patternsMatch = content.match(/## Codebase Patterns[\s\S]*?(?=\n## [^C]|\n---|\Z)/);
        if (patternsMatch) {
            console.log(patternsMatch[0].trim());
        } else {
            console.log('[steroid-run] No codebase patterns captured yet.');
        }
    } else {
        console.log(content);
    }
    process.exit(0);
}

// ============================================================
// PIPELINE ENFORCEMENT COMMANDS (Ported from ecosystem forks)
// ============================================================

// --- Init Feature Command (Ported from OpenSpec change-utils.ts) ---
// Source: src/forks/openspec/src/utils/change-utils.ts validateChangeName() + createChange()
if (args[0] === 'init-feature') {
    const slug = args[1];
    if (!slug) {
        console.error('[steroid-run] Usage: npx steroid-run init-feature <slug>');
        console.error('  Example: npx steroid-run init-feature habit-tracker');
        process.exit(1);
    }

    // Ported from OpenSpec validateChangeName() — kebab-case validation with specific error messages
    const kebabCasePattern = /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/;
    if (!kebabCasePattern.test(slug)) {
        if (/[A-Z]/.test(slug)) {
            console.error(`[steroid-run] ❌ Feature name must be lowercase (use kebab-case). Got: "${slug}"`);
        } else if (/\s/.test(slug)) {
            console.error(`[steroid-run] ❌ Feature name cannot contain spaces (use hyphens). Got: "${slug}"`);
        } else if (/_/.test(slug)) {
            console.error(`[steroid-run] ❌ Feature name cannot contain underscores (use hyphens). Got: "${slug}"`);
        } else if (slug.startsWith('-') || slug.endsWith('-')) {
            console.error(`[steroid-run] ❌ Feature name cannot start or end with a hyphen. Got: "${slug}"`);
        } else if (/--/.test(slug)) {
            console.error(`[steroid-run] ❌ Feature name cannot contain consecutive hyphens. Got: "${slug}"`);
        } else {
            console.error(`[steroid-run] ❌ Feature name must be kebab-case (e.g., habit-tracker, todo-app). Got: "${slug}"`);
        }
        process.exit(1);
    }

    // Ported from OpenSpec createChange() — directory creation with duplicate check
    const featureDir = path.join(changesDir, slug);
    if (fs.existsSync(featureDir)) {
        console.log(`[steroid-run] ⚠️  Feature "${slug}" already exists at ${featureDir}`);
        process.exit(0);
    }

    fs.mkdirSync(path.join(featureDir, 'archive'), { recursive: true });
    console.log(`[steroid-run] ✅ Feature folder created: .memory/changes/${slug}/`);
    console.log(`  📁 .memory/changes/${slug}/`);
    console.log(`  📁 .memory/changes/${slug}/archive/`);
    process.exit(0);
}

// --- Gate Command (Phase prerequisites — new, no fork has this) ---
if (args[0] === 'gate') {
    const phase = args[1];
    const feature = args[2];

    if (!phase || !feature) {
        console.error('[steroid-run] Usage: npx steroid-run gate <phase> <feature>');
        console.error('  Phases: specify, research, architect, engine');
        process.exit(1);
    }

    const featureDir = path.join(changesDir, feature);
    const gates = {
        specify: { requires: 'vibe.md', minLines: 5, label: 'Vibe capture' },
        research: { requires: 'spec.md', minLines: 10, label: 'Specification' },
        architect: { requires: 'research.md', minLines: 10, label: 'Research' },
        engine: { requires: 'plan.md', minLines: 10, label: 'Architecture' },
    };

    const gate = gates[phase];
    if (!gate) {
        console.error(`[steroid-run] ❌ Unknown phase: "${phase}". Valid phases: ${Object.keys(gates).join(', ')}`);
        process.exit(1);
    }

    const requiredFile = path.join(featureDir, gate.requires);
    if (!fs.existsSync(requiredFile)) {
        console.error(`[steroid-run] 🚫 GATE BLOCKED: ${gate.label} phase not complete.`);
        console.error(`  Missing: .memory/changes/${feature}/${gate.requires}`);
        console.error(`  The "${phase}" phase cannot start until ${gate.requires} exists.`);
        process.exit(1);
    }

    const lines = fs.readFileSync(requiredFile, 'utf-8').split('\n').length;
    if (lines < gate.minLines) {
        console.error(`[steroid-run] 🚫 GATE BLOCKED: ${gate.requires} looks incomplete (${lines} lines, need ${gate.minLines}+).`);
        process.exit(1);
    }

    console.log(`[steroid-run] ✅ Gate passed: ${gate.requires} exists (${lines} lines). Proceeding to ${phase}.`);
    process.exit(0);
}

// --- Commit Command (Atomic commit — adapted from Ralph/GSD patterns) ---
// Source: src/forks/ralph/prompt.md atomic commit format
if (args[0] === 'commit') {
    const message = args.slice(1).join(' ');
    if (!message) {
        console.error('[steroid-run] Usage: npx steroid-run commit <message>');
        console.error('  Example: npx steroid-run commit "Create HabitCard component"');
        process.exit(1);
    }

    const commitMsg = `feat(steroid): ${message}`;
    console.log(`[steroid-run] Committing: ${commitMsg}`);

    const add = spawnSync('git', ['add', '-A'], { cwd: targetDir, stdio: 'inherit' });
    if (add.status !== 0) {
        state.error_count += 1;
        state.last_error = 'git add -A failed';
        state.status = state.error_count >= 3 ? 'tripped' : 'active';
        fs.writeFileSync(stateFile, JSON.stringify(state, null, 2));
        console.error(`[steroid-run] ❌ git add failed. ERROR ${state.error_count}/3.`);
        process.exit(1);
    }

    const commit = spawnSync('git', ['commit', '-m', commitMsg], { cwd: targetDir, stdio: 'inherit' });
    if (commit.status !== 0) {
        state.error_count += 1;
        state.last_error = `git commit failed: "${commitMsg}"`;
        state.status = state.error_count >= 3 ? 'tripped' : 'active';
        fs.writeFileSync(stateFile, JSON.stringify(state, null, 2));
        console.error(`[steroid-run] ❌ git commit failed. ERROR ${state.error_count}/3.`);
        process.exit(1);
    }

    // Success resets error counter (same as regular command execution)
    state.error_count = 0;
    state.last_error = null;
    state.status = 'active';
    fs.writeFileSync(stateFile, JSON.stringify(state, null, 2));
    console.log(`[steroid-run] ✅ Committed: ${commitMsg}`);
    process.exit(0);
}

// --- Log Command (Ported from Ralph ralph.sh progress pattern) ---
// Source: src/forks/ralph/ralph.sh lines 76-79 (progress init) + prompt.md learnings format
if (args[0] === 'log') {
    const feature = args[1];
    const message = args.slice(2).join(' ');

    if (!feature || !message) {
        console.error('[steroid-run] Usage: npx steroid-run log <feature> <message>');
        console.error('  Example: npx steroid-run log habit-tracker "Implemented HabitCard component"');
        process.exit(1);
    }

    // Initialize progress file if it doesn't exist (ported from ralph.sh lines 76-79)
    if (!fs.existsSync(progressFile)) {
        const initContent = `# Steroid Progress Log\nStarted: ${new Date().toISOString()}\n\n## Codebase Patterns\n\n[Patterns will be added here as tasks are completed]\n\n---\n`;
        fs.writeFileSync(progressFile, initContent);
    }

    // Append timestamped entry (adapted from Ralph prompt.md learnings format)
    const timestamp = new Date().toISOString().replace('T', ' ').split('.')[0];
    const entry = `\n## [${timestamp}] — ${feature}: ${message}\n---\n`;
    fs.appendFileSync(progressFile, entry);
    console.log(`[steroid-run] ✅ Logged: ${message}`);
    process.exit(0);
}

// --- Check Plan Command (Physical task counter — new) ---
if (args[0] === 'check-plan') {
    const feature = args[1];
    if (!feature) {
        console.error('[steroid-run] Usage: npx steroid-run check-plan <feature>');
        process.exit(1);
    }

    const planFile = path.join(changesDir, feature, 'plan.md');
    if (!fs.existsSync(planFile)) {
        console.error(`[steroid-run] ❌ No plan found at .memory/changes/${feature}/plan.md`);
        process.exit(1);
    }

    const content = fs.readFileSync(planFile, 'utf-8');
    const total = (content.match(/- \[[ x/]\]/g) || []).length;
    const done = (content.match(/- \[x\]/g) || []).length;
    const remaining = total - done;
    const percent = total > 0 ? Math.round((done / total) * 100) : 0;

    console.log(`[steroid-run] 📊 Plan: ${done}/${total} tasks complete (${percent}%)`);

    if (remaining === 0 && total > 0) {
        console.log('[steroid-run] ✅ All tasks complete! Ready to archive.');
        process.exit(0);
    } else {
        console.log(`[steroid-run] ⏳ ${remaining} tasks remaining.`);
        process.exit(1);
    }
}

// --- Archive Command (Ported from Ralph ralph.sh archive pattern) ---
// Source: src/forks/ralph/ralph.sh lines 50-63 (archive previous run)
if (args[0] === 'archive') {
    const feature = args[1];
    if (!feature) {
        console.error('[steroid-run] Usage: npx steroid-run archive <feature>');
        process.exit(1);
    }

    const featureDir = path.join(changesDir, feature);
    const archiveDir = path.join(featureDir, 'archive');

    if (!fs.existsSync(featureDir)) {
        console.error(`[steroid-run] ❌ Feature "${feature}" not found at .memory/changes/${feature}/`);
        process.exit(1);
    }

    if (!fs.existsSync(archiveDir)) {
        fs.mkdirSync(archiveDir, { recursive: true });
    }

    // Ported from ralph.sh: archive with date stamp
    const date = new Date().toISOString().split('T')[0];
    const filesToArchive = ['vibe.md', 'spec.md', 'research.md', 'plan.md'];
    let archived = 0;

    for (const file of filesToArchive) {
        const src = path.join(featureDir, file);
        if (fs.existsSync(src)) {
            const dest = path.join(archiveDir, `${date}-${file}`);
            fs.copyFileSync(src, dest);
            fs.unlinkSync(src);
            archived++;
        }
    }

    console.log(`[steroid-run] ✅ Archived ${archived} files to .memory/changes/${feature}/archive/`);
    console.log(`[steroid-run] 🎉 Feature "${feature}" archived. Ready for next build.`);
    process.exit(0);
}

// --- Circuit Breaker Check ---
if (state.error_count >= 3) {
    console.error(`
========================================================================
[STEROID-CIRCUIT-BREAKER TRIPPED] 🛑
Maximum error tolerance reached (3/3).
AI Agent: YOU ARE ORDERED TO STOP TERMINAL EXECUTION IMMEDIATELY.
DO NOT RUN DESTRUCTIVE COMMANDS. DO NOT ATTEMPT TO SILENTLY FIX THIS.
Present the user with the exact error log and file context, and ask for
human validation to pivot the architecture or manually intervene.

To resume after fixing the issue, run:   npx steroid-run reset
========================================================================
`);
    process.exit(1);
}

// --- Verify Command (Anti-Summarization) ---
if (args[0] === 'verify') {
    const targetFile = args[1];
    const minLinesArg = args.find(a => a.startsWith('--min-lines='));

    if (!targetFile || !minLinesArg) {
        console.error("Usage: npx steroid-run verify <file> --min-lines=<number>");
        process.exit(1);
    }

    const minLines = parseInt(minLinesArg.split('=')[1], 10);
    const fullPath = path.resolve(targetDir, targetFile);

    if (!fs.existsSync(fullPath)) {
        console.error(`[STEROID-VERIFY ERROR]: File does not exist at ${fullPath}`);
        process.exit(1);
    }

    const content = fs.readFileSync(fullPath, 'utf-8');
    const lineCount = content.split('\n').length;

    if (lineCount < minLines) {
        console.error(`\n[STEROID-VERIFY ERROR] 🛑 AI SHORTCUT DETECTED 🛑`);
        console.error(`File ${targetFile} has ${lineCount} lines, but requires at least ${minLines} lines.`);
        console.error(`Do not summarize code. You MUST write the full implementation.`);
        process.exit(1);
    }

    console.log(`[STEROID-VERIFY SUCCESS] ✅ File passes validation (${lineCount} lines >= ${minLines} required).`);
    process.exit(0);
}

// --- Execution Mode ---
const commandStr = args.join(' ');
console.log(`[steroid-run] Executing: ${commandStr}`);

const child = spawnSync(commandStr, {
    shell: true,
    stdio: 'inherit'
});

// --- State Machine Update ---
if (child.status !== 0) {
    state.error_count += 1;
    state.last_error = `Command failed: "${commandStr}" (exit code ${child.status})`;
    state.status = state.error_count >= 3 ? 'tripped' : 'active';
    console.error(`\n[steroid-run] ❌ ERROR ${state.error_count}/3. ${state.error_count >= 3 ? 'CIRCUIT BREAKER TRIPPED. Run "npx steroid-run reset" to resume.' : 'Tracking error.'}`);
} else {
    state.error_count = 0;
    state.last_error = null;
    state.status = 'active';
}

fs.writeFileSync(stateFile, JSON.stringify(state, null, 2));
process.exit(child.status);
