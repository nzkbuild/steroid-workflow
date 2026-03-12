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
    node steroid-run.cjs '<command>'                       Execute a command with error tracking
    node steroid-run.cjs verify <file> --min-lines=<n>     Verify file meets minimum line count
    node steroid-run.cjs reset                             Reset the error counter to 0
    node steroid-run.cjs status                            Show current circuit breaker state

  Pipeline Enforcement:
    node steroid-run.cjs init-feature <slug>               Create feature folder structure
    node steroid-run.cjs gate <phase> <feature>            Check phase prerequisites
    node steroid-run.cjs scan <feature>                    Run codebase scan (writes context.md)
    node steroid-run.cjs commit <message>                  Atomic git commit in steroid format
    node steroid-run.cjs log <feature> <message>           Append to progress log
    node steroid-run.cjs check-plan <feature>              Count remaining tasks in plan
    node steroid-run.cjs archive <feature>                 Archive completed feature
    node steroid-run.cjs verify-feature <feature>          Run verification (writes verify.md)

  Intelligence:
    node steroid-run.cjs detect-intent "<message>"         Detect user intent (build/fix/refactor/migrate/document)
    node steroid-run.cjs detect-tests                      Detect test framework in current project

  Progress:
    node steroid-run.cjs progress                          Show execution learnings log
    node steroid-run.cjs progress --patterns               Show only codebase patterns

  Diagnostics:
    node steroid-run.cjs audit                             Verify all enforcement layers are installed

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

// --- Audit Command (Verify all enforcement layers) ---
if (args[0] === 'audit') {
    // Version display
    let version = 'unknown';
    try {
        const pkgPath = path.join(__dirname, '..', 'package.json');
        version = JSON.parse(fs.readFileSync(pkgPath, 'utf-8')).version;
    } catch (e) { /* installed copy may not have package.json nearby */ }

    console.log('');
    console.log(`[steroid-run] 🔍 Auditing enforcement layers... (v${version})`);
    console.log('');

    let passed = 0;
    let failed = 0;
    let skillCount = 0;

    const checks = [
        {
            name: 'Git pre-commit hook',
            path: path.join(targetDir, '.git', 'hooks', 'pre-commit'),
            test: 'contains',
            marker: 'STEROID-WORKFLOW',
        },
        {
            name: 'Skills (scan)',
            path: path.join(targetDir, '.agents', 'skills', 'steroid-scan', 'SKILL.md'),
            test: 'exists',
            isSkill: true,
        },
        {
            name: 'Skills (vibe-capture)',
            path: path.join(targetDir, '.agents', 'skills', 'steroid-vibe-capture', 'SKILL.md'),
            test: 'exists',
            isSkill: true,
        },
        {
            name: 'Skills (specify)',
            path: path.join(targetDir, '.agents', 'skills', 'steroid-specify', 'SKILL.md'),
            test: 'exists',
            isSkill: true,
        },
        {
            name: 'Skills (research)',
            path: path.join(targetDir, '.agents', 'skills', 'steroid-research', 'SKILL.md'),
            test: 'exists',
            isSkill: true,
        },
        {
            name: 'Skills (architect)',
            path: path.join(targetDir, '.agents', 'skills', 'steroid-architect', 'SKILL.md'),
            test: 'exists',
            isSkill: true,
        },
        {
            name: 'Skills (engine)',
            path: path.join(targetDir, '.agents', 'skills', 'steroid-engine', 'SKILL.md'),
            test: 'exists',
            isSkill: true,
        },
        {
            name: 'Skills (verify)',
            path: path.join(targetDir, '.agents', 'skills', 'steroid-verify', 'SKILL.md'),
            test: 'exists',
            isSkill: true,
        },
        {
            name: 'Skills (diagnose)',
            path: path.join(targetDir, '.agents', 'skills', 'steroid-diagnose', 'SKILL.md'),
            test: 'exists',
            isSkill: true,
        },
        {
            name: 'Circuit breaker state',
            path: path.join(targetDir, '.memory', 'execution_state.json'),
            test: 'exists',
        },
        {
            name: 'Pipeline enforcer',
            path: path.join(targetDir, 'steroid-run.cjs'),
            test: 'exists',
        },
        {
            name: 'Pipeline enforcer (content check)',
            path: path.join(targetDir, 'steroid-run.cjs'),
            test: 'min-lines',
            minLines: 100,
        },
    ];

    // Check IDE configs (at least one should have the marker)
    const ideConfigs = [
        { name: 'GEMINI.md', path: path.join(targetDir, 'GEMINI.md') },
        { name: '.cursorrules', path: path.join(targetDir, '.cursorrules') },
        { name: 'CLAUDE.md', path: path.join(targetDir, 'CLAUDE.md') },
        { name: '.windsurfrules', path: path.join(targetDir, '.windsurfrules') },
        { name: '.github/copilot-instructions.md', path: path.join(targetDir, '.github', 'copilot-instructions.md') },
    ];

    // Run core checks
    for (const check of checks) {
        if (!fs.existsSync(check.path)) {
            console.log(`  ❌ ${check.name} — missing`);
            failed++;
        } else if (check.test === 'contains') {
            const content = fs.readFileSync(check.path, 'utf-8');
            if (content.includes(check.marker)) {
                console.log(`  ✅ ${check.name}`);
                passed++;
                if (check.isSkill) skillCount++;
            } else {
                console.log(`  ❌ ${check.name} — exists but not steroid hook`);
                failed++;
            }
        } else if (check.test === 'min-lines') {
            const content = fs.readFileSync(check.path, 'utf-8');
            const lineCount = content.split('\n').length;
            if (lineCount >= check.minLines) {
                console.log(`  ✅ ${check.name} (${lineCount} lines)`);
                passed++;
            } else {
                console.log(`  ❌ ${check.name} — too short (${lineCount} lines, need ${check.minLines}+)`);
                failed++;
            }
        } else {
            console.log(`  ✅ ${check.name}`);
            passed++;
            if (check.isSkill) skillCount++;
        }
    }

    // Gate chain integrity check
    const expectedGates = ['vibe', 'specify', 'research', 'architect', 'diagnose', 'engine', 'verify'];
    const gateCount = expectedGates.length;
    console.log('');
    console.log(`  Gate chain: ${gateCount} gates (${expectedGates.join(' → ')})`);
    passed++;

    // Check IDE configs
    let ideCount = 0;
    console.log('');
    console.log('  IDE Maestro rules:');
    for (const ide of ideConfigs) {
        if (fs.existsSync(ide.path)) {
            const content = fs.readFileSync(ide.path, 'utf-8');
            if (content.includes('STEROID-WORKFLOW-START')) {
                console.log(`    ✅ ${ide.name}`);
                ideCount++;
            } else {
                console.log(`    ⚠️  ${ide.name} — exists but no Maestro rules`);
            }
        } else {
            console.log(`    ○  ${ide.name} — not installed`);
        }
    }

    if (ideCount === 0) {
        console.log(`    ❌ No IDE config has Maestro rules!`);
        failed++;
    } else {
        passed++;
    }

    console.log('');
    console.log(`  Result: ${passed} passed, ${failed} failed, ${ideCount} IDE(s) configured, ${skillCount} skills, ${gateCount} gates`);

    if (failed > 0) {
        console.log('');
        console.log('  Fix: Run "npx steroid-workflow init" to reinstall missing layers.');
        process.exit(1);
    } else {
        console.log('  All enforcement layers active. 🔒');
        process.exit(0);
    }
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
        console.error('  Phases: vibe, specify, research, architect, diagnose, engine, verify');
        process.exit(1);
    }

    const featureDir = path.join(changesDir, feature);
    const gates = {
        vibe: { requires: 'context.md', minLines: 5, label: 'Codebase scan' },
        specify: { requires: 'vibe.md', minLines: 5, label: 'Vibe capture' },
        research: { requires: 'spec.md', minLines: 10, label: 'Specification' },
        architect: { requires: 'research.md', minLines: 10, label: 'Research' },
        diagnose: { requires: 'context.md', minLines: 5, label: 'Codebase scan' },
        engine: { requires: 'plan.md', minLines: 10, label: 'Architecture', alt: { requires: 'diagnosis.md', minLines: 10, label: 'Diagnosis' } },
        verify: { requires: 'plan.md', minLines: 10, label: 'Engine execution', alt: { requires: 'diagnosis.md', minLines: 10, label: 'Diagnosis (fix pipeline)' } },
    };

    const gate = gates[phase];
    if (!gate) {
        console.error(`[steroid-run] ❌ Unknown phase: "${phase}". Valid phases: ${Object.keys(gates).join(', ')}`);
        process.exit(1);
    }

    const requiredFile = path.join(featureDir, gate.requires);
    const primaryExists = fs.existsSync(requiredFile);

    // Check alt-path (e.g., fix pipeline uses diagnosis.md instead of plan.md)
    if (!primaryExists && gate.alt) {
        const altFile = path.join(featureDir, gate.alt.requires);
        if (fs.existsSync(altFile)) {
            const altLines = fs.readFileSync(altFile, 'utf-8').split('\n').length;
            if (altLines >= gate.alt.minLines) {
                console.log(`[steroid-run] ✅ Gate passed (alt): ${gate.alt.requires} exists (${altLines} lines). Proceeding to ${phase} via fix pipeline.`);
                process.exit(0);
            } else {
                console.error(`[steroid-run] 🚫 GATE BLOCKED: ${gate.alt.requires} looks incomplete (${altLines} lines, need ${gate.alt.minLines}+).`);
                process.exit(1);
            }
        }
    }

    if (!primaryExists) {
        console.error(`[steroid-run] 🚫 GATE BLOCKED: ${gate.label} phase not complete.`);
        console.error(`  Missing: .memory/changes/${feature}/${gate.requires}`);
        if (gate.alt) {
            console.error(`  Alt path: .memory/changes/${feature}/${gate.alt.requires} (also missing)`);
        }
        console.error(`  The "${phase}" phase cannot start until ${gate.requires}${gate.alt ? ` or ${gate.alt.requires}` : ''} exists.`);
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

    // v3.1: Verification gate — archive requires verify.md with PASS/CONDITIONAL
    const verifyFile = path.join(featureDir, 'verify.md');
    if (fs.existsSync(verifyFile)) {
        const verifyContent = fs.readFileSync(verifyFile, 'utf-8');
        if (!verifyContent.includes('PASS') && !verifyContent.includes('CONDITIONAL')) {
            console.error(`[steroid-run] 🚫 ARCHIVE BLOCKED: verify.md exists but has no PASS/CONDITIONAL verdict.`);
            console.error(`  Run verification first: node steroid-run.cjs verify-feature ${feature}`);
            process.exit(1);
        }
    } else {
        console.error(`[steroid-run] 🚫 ARCHIVE BLOCKED: No verify.md found.`);
        console.error(`  Features must be verified before archiving.`);
        console.error(`  Run: node steroid-run.cjs verify-feature ${feature}`);
        if (!args.includes('--force')) {
            process.exit(1);
        }
        console.log(`[steroid-run] ⚠️  --force flag used. Archiving without verification.`);
    }

    if (!fs.existsSync(archiveDir)) {
        fs.mkdirSync(archiveDir, { recursive: true });
    }

    // Ported from ralph.sh: archive with date stamp
    const date = new Date().toISOString().split('T')[0];
    const filesToArchive = ['context.md', 'vibe.md', 'spec.md', 'research.md', 'plan.md', 'verify.md', 'diagnosis.md'];
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

// ============================================================
// v3.0 COMMANDS (Codebase Awareness & Intent Routing)
// ============================================================

// --- Scan Command (Bootstraps context.md — adapted from GSD codebase-mapper) ---
// Source: src/forks/gsd/agents/gsd-codebase-mapper.md
if (args[0] === 'scan') {
    const feature = args[1];
    if (!feature) {
        console.error('[steroid-run] Usage: npx steroid-run scan <feature>');
        console.error('  Example: npx steroid-run scan habit-tracker');
        console.error('  This creates a basic context.md. The AI skill fills in the details.');
        process.exit(1);
    }

    const featureDir = path.join(changesDir, feature);
    if (!fs.existsSync(featureDir)) {
        console.error(`[steroid-run] ❌ Feature "${feature}" not found. Run: npx steroid-run init-feature ${feature}`);
        process.exit(1);
    }

    const contextFile = path.join(featureDir, 'context.md');

    // Check for existing context.md that's less than 24h old
    if (fs.existsSync(contextFile)) {
        const stats = fs.statSync(contextFile);
        const ageMs = Date.now() - stats.mtimeMs;
        const ageHours = ageMs / (1000 * 60 * 60);
        if (ageHours < 24) {
            console.log(`[steroid-run] ✅ Context already captured (${Math.round(ageHours)}h ago). Skipping scan.`);
            process.exit(0);
        }
        console.log(`[steroid-run] ⚠️  Context is ${Math.round(ageHours)}h old. Re-scanning...`);
    }

    // Auto-detect basic project info and bootstrap context.md
    let language = 'Unknown';
    let framework = 'Unknown';
    let packageManager = 'Unknown';
    let testFramework = 'Not detected';
    let testCommand = 'Not configured';

    // Detect from package.json
    const pkgPath = path.join(targetDir, 'package.json');
    if (fs.existsSync(pkgPath)) {
        try {
            const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
            language = 'JavaScript/TypeScript';
            packageManager = fs.existsSync(path.join(targetDir, 'pnpm-lock.yaml')) ? 'pnpm'
                : fs.existsSync(path.join(targetDir, 'yarn.lock')) ? 'yarn' : 'npm';

            // Detect framework
            const deps = { ...pkg.dependencies, ...pkg.devDependencies };
            if (deps['next']) framework = `Next.js ${deps['next']}`;
            else if (deps['react']) framework = `React ${deps['react']}`;
            else if (deps['vue']) framework = `Vue ${deps['vue']}`;
            else if (deps['svelte'] || deps['@sveltejs/kit']) framework = 'SvelteKit';
            else if (deps['express']) framework = `Express ${deps['express']}`;
            else if (deps['fastify']) framework = `Fastify ${deps['fastify']}`;
            else if (deps['hono']) framework = `Hono ${deps['hono']}`;
            else framework = 'Node.js';

            // Detect test framework
            if (deps['vitest']) { testFramework = 'Vitest'; testCommand = 'npx vitest'; }
            else if (deps['jest']) { testFramework = 'Jest'; testCommand = 'npx jest'; }
            else if (deps['mocha']) { testFramework = 'Mocha'; testCommand = 'npx mocha'; }
            else if (deps['@playwright/test']) { testFramework = 'Playwright'; testCommand = 'npx playwright test'; }

            // Override with scripts.test if available
            if (pkg.scripts && pkg.scripts.test && pkg.scripts.test !== 'echo "Error: no test specified" && exit 1') {
                testCommand = 'npm test';
            }
        } catch (e) { /* ignore parse errors */ }
    }

    // Refine: check for TypeScript specifically
    if (language === 'JavaScript/TypeScript') {
        if (fs.existsSync(path.join(targetDir, 'tsconfig.json'))) {
            language = 'TypeScript';
        } else {
            language = 'JavaScript';
        }
    }

    // Detect from Python
    if (fs.existsSync(path.join(targetDir, 'requirements.txt')) || fs.existsSync(path.join(targetDir, 'pyproject.toml'))) {
        language = 'Python';
        packageManager = 'pip';
        if (fs.existsSync(path.join(targetDir, 'pyproject.toml'))) packageManager = 'poetry/pip';
        framework = fs.existsSync(path.join(targetDir, 'manage.py')) ? 'Django'
            : fs.existsSync(path.join(targetDir, 'app.py')) ? 'Flask' : 'Python';
        if (fs.existsSync(path.join(targetDir, 'pytest.ini')) || fs.existsSync(path.join(targetDir, 'pyproject.toml'))) {
            testFramework = 'Pytest';
            testCommand = 'pytest';
        }
    }

    // Detect from Go
    if (fs.existsSync(path.join(targetDir, 'go.mod'))) {
        language = 'Go';
        packageManager = 'go mod';
        framework = 'Go';
        testFramework = 'go test';
        testCommand = 'go test ./...';
    }

    // Detect from Rust
    if (fs.existsSync(path.join(targetDir, 'Cargo.toml'))) {
        language = 'Rust';
        packageManager = 'cargo';
        framework = 'Rust';
        testFramework = 'cargo test';
        testCommand = 'cargo test';
    }

    // Count existing test files
    let testCount = 0;
    const countTestsIn = (dir) => {
        if (!fs.existsSync(dir)) return;
        try {
            const items = fs.readdirSync(dir, { recursive: true });
            for (const item of items) {
                if (typeof item === 'string' && (item.includes('.test.') || item.includes('.spec.') || item.startsWith('test_'))) {
                    testCount++;
                }
            }
        } catch (e) { /* ignore */ }
    };
    countTestsIn(path.join(targetDir, 'src'));
    countTestsIn(path.join(targetDir, 'tests'));
    countTestsIn(path.join(targetDir, 'test'));
    countTestsIn(path.join(targetDir, '__tests__'));

    // Write bootstrap context.md
    const timestamp = new Date().toISOString();
    const contextContent = `# Project Context for ${feature}

**Scanned:** ${timestamp}
**Note:** This is a bootstrap scan. The steroid-scan skill will enrich this with detailed analysis.

## Tech Stack

- **Language:** ${language}
- **Framework:** ${framework}
- **Package Manager:** ${packageManager}

## Test Infrastructure

- **Framework:** ${testFramework}
- **Run Command:** \`${testCommand}\`
- **Existing Tests:** ${testCount}

## Project Structure

> To be filled by steroid-scan skill (see \`skills/steroid-scan/SKILL.md\`)

## Existing Patterns

> To be filled by steroid-scan skill from AGENTS.md / progress.md

## Related Code

> To be filled by steroid-scan skill based on feature keyword search
`;

    fs.writeFileSync(contextFile, contextContent);
    console.log(`[steroid-run] 📡 Context captured: ${language}/${framework}, ${testCount} tests found.`);
    console.log(`[steroid-run]    Written to: .memory/changes/${feature}/context.md`);
    console.log(`[steroid-run]    The steroid-scan skill will enrich this with detailed analysis.`);

    // Enrich progress.md with codebase patterns
    if (!fs.existsSync(progressFile)) {
        const progressContent = `# Steroid Progress Log\nStarted: ${timestamp}\n\n## Codebase Patterns\n\n- **Language**: ${language}\n- **Framework**: ${framework}\n- **Package Manager**: ${packageManager}\n- **Test Framework**: ${testFramework}\n- **Test Command**: \`${testCommand}\`\n- **Existing Tests**: ${testCount}\n\n---\n`;
        fs.writeFileSync(progressFile, progressContent);
        console.log(`[steroid-run]    Also created progress.md with codebase patterns.`);
    } else {
        const existing = fs.readFileSync(progressFile, 'utf-8');
        if (existing.includes('[Patterns will be added here')) {
            const updated = existing.replace(
                /\[Patterns will be added here[^\]]*\]/,
                `**Language**: ${language}\n- **Framework**: ${framework}\n- **Package Manager**: ${packageManager}\n- **Test Framework**: ${testFramework}\n- **Test Command**: \`${testCommand}\`\n- **Existing Tests**: ${testCount}`
            );
            fs.writeFileSync(progressFile, updated);
            console.log(`[steroid-run]    Updated progress.md codebase patterns.`);
        }
    }

    process.exit(0);
}

// --- Detect Intent Command (Keyword-based intent classification) ---
if (args[0] === 'detect-intent') {
    const message = args.slice(1).join(' ').toLowerCase();
    if (!message) {
        console.error('[steroid-run] Usage: npx steroid-run detect-intent "<user message>"');
        console.error('  Example: npx steroid-run detect-intent "fix the login bug"');
        process.exit(1);
    }

    // Keyword-based scoring (reliable, no AI needed)
    const intents = {
        fix: ['fix', 'bug', 'debug', 'broken', 'error', 'crash', 'issue', 'wrong', 'failing', 'not working', 'doesnt work', "doesn't work", 'investigate'],
        refactor: ['refactor', 'restructure', 'reorganize', 'clean up', 'cleanup', 'improve', 'optimize', 'simplify', 'extract', 'decouple'],
        migrate: ['migrate', 'migration', 'upgrade', 'switch to', 'move to', 'convert', 'port', 'transition'],
        document: ['document', 'docs', 'readme', 'jsdoc', 'comment', 'explain', 'annotate', 'api docs', 'documentation'],
        build: ['build', 'create', 'add', 'make', 'implement', 'feature', 'new', 'design', 'develop', 'setup', 'set up'],
    };

    let bestIntent = 'build'; // default
    let bestScore = 0;

    for (const [intent, keywords] of Object.entries(intents)) {
        let score = 0;
        for (const keyword of keywords) {
            if (message.includes(keyword)) {
                score += keyword.length; // Longer keywords = more specific = higher weight
            }
        }
        if (score > bestScore) {
            bestScore = score;
            bestIntent = intent;
        }
    }

    // Pipeline mapping
    const pipelines = {
        build: 'scan → vibe → specify → research → architect → engine → verify',
        fix: 'scan → diagnose → engine (targeted) → verify',
        refactor: 'scan → specify (target state) → architect → engine → verify',
        migrate: 'scan → research (target tech) → architect → engine → verify',
        document: 'scan → specify (doc scope) → engine (docs) → verify',
    };

    console.log(bestIntent);
    if (args.includes('--verbose')) {
        console.log(`[steroid-run] Intent: ${bestIntent} (score: ${bestScore})`);
        console.log(`[steroid-run] Pipeline: ${pipelines[bestIntent]}`);
    }
    process.exit(0);
}

// --- Detect Tests Command (Test framework auto-detection) ---
// Source: src/forks/gsd/agents/gsd-phase-researcher.md validation architecture
if (args[0] === 'detect-tests') {
    console.log('[steroid-run] 🔍 Detecting test infrastructure...');
    console.log('');

    // Check config files
    const testConfigs = [
        { name: 'Jest', files: ['jest.config.js', 'jest.config.ts', 'jest.config.mjs', 'jest.config.cjs'] },
        { name: 'Vitest', files: ['vitest.config.ts', 'vitest.config.js', 'vitest.config.mts'] },
        { name: 'Mocha', files: ['.mocharc.yml', '.mocharc.json', '.mocharc.js'] },
        { name: 'Pytest', files: ['pytest.ini', 'pyproject.toml', 'setup.cfg'] },
        { name: 'Playwright', files: ['playwright.config.ts', 'playwright.config.js'] },
        { name: 'Cypress', files: ['cypress.config.ts', 'cypress.config.js', 'cypress.json'] },
    ];

    let detected = false;
    for (const config of testConfigs) {
        for (const file of config.files) {
            if (fs.existsSync(path.join(targetDir, file))) {
                console.log(`  ✅ ${config.name} — config found at ${file}`);
                detected = true;
                break;
            }
        }
    }

    // Check package.json scripts
    const pkgPath = path.join(targetDir, 'package.json');
    if (fs.existsSync(pkgPath)) {
        try {
            const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
            if (pkg.scripts) {
                const testScript = pkg.scripts.test;
                if (testScript && testScript !== 'echo "Error: no test specified" && exit 1') {
                    console.log(`  📋 Test script: "${testScript}"`);
                }
                if (pkg.scripts['test:watch']) console.log(`  📋 Watch script: "${pkg.scripts['test:watch']}"`);
                if (pkg.scripts['test:coverage']) console.log(`  📋 Coverage script: "${pkg.scripts['test:coverage']}"`);
            }
        } catch (e) { /* ignore */ }
    }

    if (!detected) {
        console.log('  ⚠️  No test framework config detected.');
        console.log('  💡 Consider adding one: npx vitest init, npx jest --init, etc.');
    }

    console.log('');
    process.exit(0);
}

// --- Verify Feature Command (Placeholder — full implementation in steroid-verify skill) ---
if (args[0] === 'verify-feature') {
    const feature = args[1];
    if (!feature) {
        console.error('[steroid-run] Usage: npx steroid-run verify-feature <feature>');
        process.exit(1);
    }

    const featureDir = path.join(changesDir, feature);
    const planFile = path.join(featureDir, 'plan.md');

    if (!fs.existsSync(planFile)) {
        console.error(`[steroid-run] ❌ No plan found. Complete the engine phase first.`);
        process.exit(1);
    }

    // Check all tasks are done
    const content = fs.readFileSync(planFile, 'utf-8');
    const total = (content.match(/- \[[ x/]\]/g) || []).length;
    const done = (content.match(/- \[x\]/g) || []).length;

    if (done < total) {
        console.error(`[steroid-run] ❌ Plan incomplete (${done}/${total}). Finish all tasks before verification.`);
        process.exit(1);
    }

    console.log(`[steroid-run] ✅ Plan complete (${done}/${total}). Ready for verification.`);
    console.log(`[steroid-run] 📋 The steroid-verify skill will now run spec compliance and code quality reviews.`);
    console.log(`[steroid-run]    Results will be written to .memory/changes/${feature}/verify.md`);
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
