#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const targetDir = process.cwd();
const stateFile = path.join(targetDir, '.memory', 'execution_state.json');
const memoryDir = path.join(targetDir, '.memory');
const changesDir = path.join(memoryDir, 'changes');
const progressFile = path.join(memoryDir, 'progress.md');
const knowledgeDir = path.join(memoryDir, 'knowledge');
const metricsDir = path.join(memoryDir, 'metrics');
const reportsDir = path.join(memoryDir, 'reports');

// --- Knowledge Merge Helper (v4.0) ---
function mergeKnowledge(existing, incoming) {
    const result = { ...existing };
    for (const [key, value] of Object.entries(incoming)) {
        if (Array.isArray(value) && Array.isArray(result[key])) {
            result[key] = [...new Set([...result[key], ...value])];
        } else if (value && typeof value === 'object' && !Array.isArray(value)
            && result[key] && typeof result[key] === 'object' && !Array.isArray(result[key])) {
            result[key] = mergeKnowledge(result[key], value);
        } else {
            result[key] = value;
        }
    }
    return result;
}

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

  Stories:
    node steroid-run.cjs stories <feature>                 List prioritized stories (P1/P2/P3)
    node steroid-run.cjs stories <feature> next            Show next story to work on

  Review:
    node steroid-run.cjs review spec <feature>             Stage 1: Spec compliance review
    node steroid-run.cjs review quality <feature>          Stage 2: Code quality review
    node steroid-run.cjs review status <feature>           Show review stage status
    node steroid-run.cjs review reset <feature>            Reset review for re-review

  Reports:
    node steroid-run.cjs report generate <feature>         Generate handoff report
    node steroid-run.cjs report show <feature>             Show a handoff report
    node steroid-run.cjs report list                       List all handoff reports

  Analytics:
    node steroid-run.cjs dashboard                         Show project health dashboard

  Recovery:
    node steroid-run.cjs recover                           Smart recovery guidance (levels 1-5)

  Intelligence:
    node steroid-run.cjs detect-intent "<message>"         Detect user intent (build/fix/refactor/migrate/document)
    node steroid-run.cjs detect-tests                      Detect test framework in current project

  Progress:
    node steroid-run.cjs progress                          Show execution learnings log
    node steroid-run.cjs progress --patterns               Show only codebase patterns

  Knowledge:
    node steroid-run.cjs memory show <store>               Show a knowledge store
    node steroid-run.cjs memory show-all                   Show all knowledge stores
    node steroid-run.cjs memory write <store> <json>       Write data to a store
    node steroid-run.cjs memory stats                      Show memory statistics

  Diagnostics:
    node steroid-run.cjs audit                             Verify all enforcement layers are installed

The circuit breaker tracks errors in .memory/execution_state.json.
After 5 consecutive errors (graduated recovery at each level), execution is blocked until you run 'reset'.
Run 'recover' after any error for smart fix suggestions.
`);
    process.exit(0);
}

// --- Ensure state file exists ---
if (!fs.existsSync(stateFile)) {
    if (!fs.existsSync(path.dirname(stateFile))) {
        fs.mkdirSync(path.dirname(stateFile), { recursive: true });
    }
    fs.writeFileSync(stateFile, JSON.stringify({ error_count: 0, last_error: null, status: 'active', recovery_actions: [], error_history: [] }, null, 2));
}

let state;
try {
    state = JSON.parse(fs.readFileSync(stateFile, 'utf-8'));
} catch (e) {
    state = { error_count: 0, last_error: null, status: 'active', recovery_actions: [], error_history: [] };
}

// --- Reset Command (P0 Fix B2) ---
if (args[0] === 'reset') {
    state.error_count = 0;
    state.last_error = null;
    state.status = 'active';
    state.recovery_actions = [];
    state.error_history = [];
    fs.writeFileSync(stateFile, JSON.stringify(state, null, 2));
    console.log('[steroid-run] ✅ Circuit breaker reset. Error count is now 0/5. You may resume.');
    process.exit(0);
}

// --- Recover Command (Smart recovery — v4.0) ---
// Source: src/forks/superpowers implementer-prompt.md status types
if (args[0] === 'recover') {
    const level = state.error_count;

    if (level === 0) {
        console.log('[steroid-run] ✅ No errors to recover from. Circuit breaker is clear.');
        process.exit(0);
    }

    let errorPatterns = { patterns: [] };
    const errorPatternsFile = path.join(metricsDir, 'error-patterns.json');
    if (fs.existsSync(errorPatternsFile)) {
        try { errorPatterns = JSON.parse(fs.readFileSync(errorPatternsFile, 'utf-8')); } catch (e) { /* ignore */ }
    }

    console.log(`\n[steroid-run] 🔧 Smart Recovery — Error Level ${level}/5\n`);

    if (!state.recovery_actions) state.recovery_actions = [];

    if (level === 1) {
        console.log('  📋 Level 1: LOGGED — Retry with a different approach.');
        console.log(`  Last error: ${state.last_error}`);
        console.log('');
        console.log('  Suggested actions:');
        console.log('    1. Re-read the error message carefully');
        console.log('    2. Try a different implementation approach');
        console.log('    3. Check if the command syntax is correct');
        state.recovery_actions.push(`L1 recovery: retry suggested at ${new Date().toISOString()}`);
    } else if (level === 2) {
        console.log('  📖 Level 2: RE-READ — Pause and re-read your plan.');
        console.log(`  Last error: ${state.last_error}`);
        console.log('');
        console.log('  Suggested actions:');
        console.log('    1. Re-read plan.md or diagnosis.md for the current feature');
        console.log('    2. Verify your approach matches the architecture');
        console.log('    3. Check if dependencies are installed');
        state.recovery_actions.push(`L2 recovery: re-read suggested at ${new Date().toISOString()}`);
    } else if (level === 3) {
        console.log('  🔍 Level 3: SELF-DIAGNOSE — Checking error-patterns.json...');
        console.log(`  Last error: ${state.last_error}`);
        console.log('');
        if (errorPatterns.patterns.length > 0) {
            const lastErr = (state.last_error || '').toLowerCase();
            const matches = errorPatterns.patterns.filter(p =>
                lastErr.includes((p.keyword || '').toLowerCase())
            );
            if (matches.length > 0) {
                console.log('  🎯 Matching error patterns found:');
                for (const m of matches) {
                    console.log(`    Pattern: ${m.keyword}`);
                    console.log(`    Fix: ${m.fix || m.error}`);
                    console.log('');
                }
            } else {
                console.log('  No matching patterns. Recording this error for future diagnosis.');
            }
        } else {
            console.log('  No error patterns recorded yet. This error will be tracked.');
        }
        state.recovery_actions.push(`L3 recovery: self-diagnosis at ${new Date().toISOString()}`);
    } else if (level === 4) {
        console.log('  🚨 Level 4: ESCALATED — Present diagnosis to user.');
        console.log(`  Last error: ${state.last_error}`);
        console.log('');
        console.log('  ⚠️  This feature has hit 4 errors. The AI should:');
        console.log('    1. STOP all terminal execution');
        console.log('    2. Present ALL errors encountered (check error_history in execution_state.json)');
        console.log('    3. Propose 2-3 alternative approaches');
        console.log('    4. Wait for human decision before continuing');
        console.log('');
        console.log('  Error history:');
        if (state.error_history && state.error_history.length > 0) {
            for (const err of state.error_history) {
                console.log(`    - ${err}`);
            }
        }
        state.recovery_actions.push(`L4 recovery: escalation at ${new Date().toISOString()}`);
    } else {
        console.log('  🛑 Level 5: HARD STOP — Circuit breaker tripped.');
        console.log('  Run: node steroid-run.cjs reset');
    }

    fs.writeFileSync(stateFile, JSON.stringify(state, null, 2));
    process.exit(level >= 5 ? 1 : 0);
}

// --- Status Command ---
if (args[0] === 'status') {
    const levels = ['🟢 CLEAR', '🟡 LOGGED', '🟠 RE-READ', '🔶 DIAGNOSING', '🔴 ESCALATED', '🛑 TRIPPED'];
    const level = Math.min(state.error_count, 5);
    console.log(`[steroid-run] Circuit Breaker Status:`);
    console.log(`  Error Count: ${state.error_count}/5`);
    console.log(`  Level: ${levels[level]}`);
    if (state.last_error) console.log(`  Last Error: ${state.last_error}`);
    if (state.recovery_actions && state.recovery_actions.length > 0) {
        console.log(`  Recovery Actions:`);
        for (const action of state.recovery_actions) {
            console.log(`    - ${action}`);
        }
    }
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

// --- Memory Command (Structured knowledge store — v4.0) ---
// Source: src/forks/memorycore/master-memory.md + src/forks/ralph/AGENTS.md
if (args[0] === 'memory') {
    const sub = args[1];

    if (!sub || sub === '--help') {
        console.log(`
[steroid-run] memory — Structured project knowledge store.

Usage:
  node steroid-run.cjs memory show [store]       Show a knowledge store (tech-stack|patterns|decisions|gotchas)
  node steroid-run.cjs memory show-all           Show all knowledge stores
  node steroid-run.cjs memory write <store> <json>  Write/merge data into a store
  node steroid-run.cjs memory stats              Show memory statistics

Stores:
  tech-stack   — Language, framework, deps (from scan/research)
  patterns     — Codebase patterns and conventions (from AGENTS.md/scan)
  decisions    — Locked architectural decisions (from architect phase)
  gotchas      — Known pitfalls and workarounds (from engine/verify)
`);
        process.exit(0);
    }

    if (!fs.existsSync(knowledgeDir)) {
        fs.mkdirSync(knowledgeDir, { recursive: true });
    }

    const validStores = ['tech-stack', 'patterns', 'decisions', 'gotchas'];

    if (sub === 'show') {
        const store = args[2];
        if (!store || !validStores.includes(store)) {
            console.error(`[steroid-run] ❌ Unknown store: "${store}". Valid: ${validStores.join(', ')}`);
            process.exit(1);
        }
        const storeFile = path.join(knowledgeDir, `${store}.json`);
        if (!fs.existsSync(storeFile)) {
            console.log(`[steroid-run] 📭 Store "${store}" is empty. It will be populated as the pipeline runs.`);
            process.exit(0);
        }
        try {
            const data = JSON.parse(fs.readFileSync(storeFile, 'utf-8'));
            console.log(JSON.stringify(data, null, 2));
        } catch (e) {
            console.error(`[steroid-run] ⚠️  Store "${store}" has invalid JSON. Resetting.`);
            fs.unlinkSync(storeFile);
            process.exit(1);
        }
        process.exit(0);
    }

    if (sub === 'show-all') {
        let hasData = false;
        for (const store of validStores) {
            const storeFile = path.join(knowledgeDir, `${store}.json`);
            if (fs.existsSync(storeFile)) {
                try {
                    const data = JSON.parse(fs.readFileSync(storeFile, 'utf-8'));
                    console.log(`\n## ${store}`);
                    console.log(JSON.stringify(data, null, 2));
                    hasData = true;
                } catch (e) {
                    console.log(`\n## ${store} — ⚠️ corrupt (will reset on next write)`);
                }
            }
        }
        if (!hasData) {
            console.log('[steroid-run] 📭 No knowledge stored yet. Run a scan to populate tech-stack.');
        }
        process.exit(0);
    }

    if (sub === 'write') {
        const store = args[2];
        const jsonStr = args.slice(3).join(' ');
        if (!store || !validStores.includes(store)) {
            console.error(`[steroid-run] ❌ Unknown store: "${store}". Valid: ${validStores.join(', ')}`);
            process.exit(1);
        }
        if (!jsonStr) {
            console.error('[steroid-run] ❌ No JSON data provided.');
            process.exit(1);
        }
        let newData;
        try {
            newData = JSON.parse(jsonStr);
        } catch (e) {
            console.error(`[steroid-run] ❌ Invalid JSON: ${e.message}`);
            process.exit(1);
        }

        const storeFile = path.join(knowledgeDir, `${store}.json`);
        let existing = {};
        if (fs.existsSync(storeFile)) {
            try { existing = JSON.parse(fs.readFileSync(storeFile, 'utf-8')); } catch (e) { existing = {}; }
        }

        const merged = mergeKnowledge(existing, newData);
        merged._lastUpdated = new Date().toISOString();
        fs.writeFileSync(storeFile, JSON.stringify(merged, null, 2));
        console.log(`[steroid-run] ✅ Knowledge written to ${store}.json`);
        process.exit(0);
    }

    if (sub === 'stats') {
        let totalEntries = 0;
        console.log('\n[steroid-run] 🧠 Memory Statistics\n');
        for (const store of validStores) {
            const storeFile = path.join(knowledgeDir, `${store}.json`);
            if (fs.existsSync(storeFile)) {
                try {
                    const data = JSON.parse(fs.readFileSync(storeFile, 'utf-8'));
                    const keys = Object.keys(data).filter(k => k !== '_lastUpdated');
                    console.log(`  ${store}: ${keys.length} entries (updated: ${data._lastUpdated || 'unknown'})`);
                    totalEntries += keys.length;
                } catch (e) {
                    console.log(`  ${store}: ⚠️ corrupt`);
                }
            } else {
                console.log(`  ${store}: empty`);
            }
        }
        const errorPatternsFile = path.join(metricsDir, 'error-patterns.json');
        const featuresFile = path.join(metricsDir, 'features.json');
        if (fs.existsSync(errorPatternsFile)) {
            try {
                const ep = JSON.parse(fs.readFileSync(errorPatternsFile, 'utf-8'));
                const patterns = ep.patterns || [];
                console.log(`  error-patterns: ${patterns.length} patterns tracked`);
            } catch (e) { /* ignore */ }
        }
        if (fs.existsSync(featuresFile)) {
            try {
                const feat = JSON.parse(fs.readFileSync(featuresFile, 'utf-8'));
                const features = Object.keys(feat).filter(k => k !== '_lastUpdated');
                console.log(`  features: ${features.length} features tracked`);
            } catch (e) { /* ignore */ }
        }
        console.log(`\n  Total knowledge entries: ${totalEntries}`);
        process.exit(0);
    }

    console.error(`[steroid-run] ❌ Unknown memory subcommand: "${sub}". Run: node steroid-run.cjs memory --help`);
    process.exit(1);
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

    // v4.0: Knowledge store health
    console.log('  Knowledge stores:');
    const knowledgeStores = ['tech-stack', 'patterns', 'decisions', 'gotchas'];
    let knowledgeCount = 0;
    for (const store of knowledgeStores) {
        const storeFile = path.join(knowledgeDir, `${store}.json`);
        if (fs.existsSync(storeFile)) {
            try {
                JSON.parse(fs.readFileSync(storeFile, 'utf-8'));
                console.log(`    ✅ ${store}.json`);
                knowledgeCount++;
            } catch (e) {
                console.log(`    ⚠️  ${store}.json — corrupt JSON`);
            }
        } else {
            console.log(`    ○  ${store}.json — not populated`);
        }
    }

    console.log('');

    // v5.0: Reports health
    console.log('  Handoff reports:');
    if (fs.existsSync(reportsDir)) {
        const reports = fs.readdirSync(reportsDir).filter(f => f.endsWith('.md'));
        console.log(`    ${reports.length} report(s) generated`);
    } else {
        console.log('    \u25cb  No reports generated yet');
    }

    // v5.0: Review system check
    console.log('');
    console.log('  Review system: \u2705 Two-stage review available (v5.0)');

    console.log('');
    console.log(`  Result: ${passed} passed, ${failed} failed, ${ideCount} IDE(s), ${skillCount} skills, ${gateCount} gates, ${knowledgeCount}/4 knowledge stores, review system v5.0`);

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
        if (!state.error_history) state.error_history = [];
        state.error_history.push(`[${new Date().toISOString()}] git add failed`);
        state.status = state.error_count >= 5 ? 'tripped' : 'active';
        fs.writeFileSync(stateFile, JSON.stringify(state, null, 2));
        console.error(`[steroid-run] ❌ git add failed. ERROR ${state.error_count}/5.`);
        process.exit(1);
    }

    const commit = spawnSync('git', ['commit', '-m', commitMsg], { cwd: targetDir, stdio: 'inherit' });
    if (commit.status !== 0) {
        state.error_count += 1;
        state.last_error = `git commit failed: "${commitMsg}"`;
        if (!state.error_history) state.error_history = [];
        state.error_history.push(`[${new Date().toISOString()}] git commit failed: "${commitMsg}"`);
        state.status = state.error_count >= 5 ? 'tripped' : 'active';
        fs.writeFileSync(stateFile, JSON.stringify(state, null, 2));
        console.error(`[steroid-run] ❌ git commit failed. ERROR ${state.error_count}/5.`);
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

    // v4.0: If plan has priorities, show breakdown
    const p1 = (content.match(/- \[[ x/]\] (?:\[P\] )?P1:/g) || []).length;
    const p1Done = (content.match(/- \[x\] (?:\[P\] )?P1:/g) || []).length;
    if (p1 > 0) {
        console.log(`[steroid-run]    P1: ${p1Done}/${p1} | P2/P3: ${done - p1Done}/${total - p1}`);
        if (p1Done < p1) {
            console.log(`[steroid-run] ⚠️  ${p1 - p1Done} P1 (foundational) stories remaining. Complete these first.`);
        }
    }

    if (remaining === 0 && total > 0) {
        console.log('[steroid-run] ✅ All tasks complete! Ready to archive.');
        process.exit(0);
    } else {
        console.log(`[steroid-run] ⏳ ${remaining} tasks remaining.`);
        process.exit(1);
    }
}

// --- Stories Command (Prioritized story execution — v4.0) ---
// Source: src/forks/spec-kit tasks-template.md + src/forks/ralph prd.json
if (args[0] === 'stories') {
    const feature = args[1];
    const sub = args[2];

    if (!feature) {
        console.error('[steroid-run] Usage: npx steroid-run stories <feature> [next|list]');
        process.exit(1);
    }

    const planFile = path.join(changesDir, feature, 'plan.md');
    if (!fs.existsSync(planFile)) {
        console.error(`[steroid-run] ❌ No plan found at .memory/changes/${feature}/plan.md`);
        process.exit(1);
    }

    const content = fs.readFileSync(planFile, 'utf-8');

    const storyRegex = /^- \[([ x/])\] (\[P\] )?(?:(P[123]):)?\s*(.+)$/gm;
    const stories = [];
    let match;
    let index = 0;
    while ((match = storyRegex.exec(content)) !== null) {
        index++;
        stories.push({
            index,
            status: match[1] === 'x' ? 'done' : match[1] === '/' ? 'in-progress' : 'todo',
            parallel: !!match[2],
            priority: match[3] || 'P2',
            title: match[4].trim(),
        });
    }

    if (stories.length === 0) {
        console.log('[steroid-run] ⚠️  No stories found in plan.md. Use format: - [ ] P1: Story title');
        console.log('  Stories without priority markers are treated as P2.');
        const total2 = (content.match(/- \[[ x/]\]/g) || []).length;
        const done2 = (content.match(/- \[x\]/g) || []).length;
        console.log(`  (Plain tasks: ${done2}/${total2} complete)`);
        process.exit(0);
    }

    if (!sub || sub === 'list') {
        const p1 = stories.filter(s => s.priority === 'P1');
        const p2 = stories.filter(s => s.priority === 'P2');
        const p3 = stories.filter(s => s.priority === 'P3');

        console.log(`\n[steroid-run] 📋 Stories for "${feature}"\n`);

        const renderGroup = (label, group) => {
            if (group.length === 0) return;
            console.log(`  ${label}:`);
            for (const s of group) {
                const icon = s.status === 'done' ? '✅' : s.status === 'in-progress' ? '🔄' : '⬜';
                const par = s.parallel ? ' [P]' : '';
                console.log(`    ${icon} #${s.index} ${s.title}${par}`);
            }
            console.log('');
        };

        renderGroup('🔴 P1 — Must Have (MVP)', p1);
        renderGroup('🟡 P2 — Should Have', p2);
        renderGroup('🟢 P3 — Nice to Have', p3);

        const doneCount = stories.filter(s => s.status === 'done').length;
        console.log(`  Progress: ${doneCount}/${stories.length} stories complete`);

        const p1Incomplete = p1.filter(s => s.status !== 'done');
        if (p1Incomplete.length > 0) {
            console.log(`\n  ⚠️  FOUNDATIONAL BLOCK: ${p1Incomplete.length} P1 stories incomplete.`);
            console.log('  Complete all P1 stories before starting P2/P3 work.');
        }

        process.exit(0);
    }

    if (sub === 'next') {
        const p1Todo = stories.filter(s => s.priority === 'P1' && s.status === 'todo');
        const p2Todo = stories.filter(s => s.priority === 'P2' && s.status === 'todo');
        const p3Todo = stories.filter(s => s.priority === 'P3' && s.status === 'todo');

        const p1Incomplete = stories.filter(s => s.priority === 'P1' && s.status !== 'done');
        if (p1Incomplete.length > 0 && p1Todo.length > 0) {
            console.log(`[steroid-run] 🎯 Next story: #${p1Todo[0].index} ${p1Todo[0].title} (P1 — foundational)`);
            process.exit(0);
        }
        if (p1Incomplete.length > 0 && p1Todo.length === 0) {
            const inProgress = p1Incomplete.filter(s => s.status === 'in-progress');
            if (inProgress.length > 0) {
                console.log(`[steroid-run] ⏳ P1 story in progress: #${inProgress[0].index} ${inProgress[0].title}`);
                console.log('  Complete this before moving to the next story.');
                process.exit(0);
            }
        }

        const next = p2Todo[0] || p3Todo[0];
        if (next) {
            console.log(`[steroid-run] 🎯 Next story: #${next.index} ${next.title} (${next.priority})`);
        } else {
            console.log('[steroid-run] ✅ All stories complete!');
        }
        process.exit(0);
    }

    console.error(`[steroid-run] ❌ Unknown stories subcommand: "${sub}". Use: list, next`);
    process.exit(1);
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
    const filesToArchive = ['context.md', 'vibe.md', 'spec.md', 'research.md', 'plan.md', 'verify.md', 'diagnosis.md', 'review.md'];
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

    // v4.0: Record feature metrics
    if (!fs.existsSync(metricsDir)) fs.mkdirSync(metricsDir, { recursive: true });
    const featuresFile = path.join(metricsDir, 'features.json');
    let featuresData = {};
    if (fs.existsSync(featuresFile)) {
        try { featuresData = JSON.parse(fs.readFileSync(featuresFile, 'utf-8')); } catch (e) { featuresData = {}; }
    }
    featuresData[feature] = {
        archived: new Date().toISOString(),
        filesArchived: archived,
        errorCount: state.error_count,
        status: 'complete',
    };
    featuresData._lastUpdated = new Date().toISOString();
    fs.writeFileSync(featuresFile, JSON.stringify(featuresData, null, 2));
    console.log(`[steroid-run]    Metrics: feature "${feature}" recorded in features.json`);

    // v5.0: Auto-generate handoff report on archive
    if (!fs.existsSync(reportsDir)) fs.mkdirSync(reportsDir, { recursive: true });
    const findArchiveFile = (name) => {
        const archivedPath = path.join(archiveDir, `${date}-${name}`);
        const activePath = path.join(featureDir, name);
        if (fs.existsSync(archivedPath)) return fs.readFileSync(archivedPath, 'utf-8');
        if (fs.existsSync(activePath)) return fs.readFileSync(activePath, 'utf-8');
        return null;
    };
    const specContent = findArchiveFile('spec.md');
    const verifyContent = findArchiveFile('verify.md');
    const planContent = findArchiveFile('plan.md');
    const reviewContent = findArchiveFile('review.md');

    let report = `# Handoff Report: ${feature}\n\n`;
    report += `**Completed:** ${new Date().toISOString()}\n`;
    report += `**Status:** Archived\n`;
    report += `**Generated by:** steroid-workflow v5.0\n\n`;

    report += `## What Was Built\n\n`;
    if (specContent) {
        const criteria = specContent.match(/(?:Given|When|Then|Scenario).+/gi) || [];
        report += criteria.length > 0 ? `${criteria.length} acceptance scenarios implemented.\n` : '_See spec.md._\n';
    } else {
        report += '_No spec.md found._\n';
    }

    report += `\n## What Was Tested\n\n`;
    if (verifyContent) {
        const statusMatch2 = verifyContent.match(/\*\*Status:\*\* (PASS|FAIL|CONDITIONAL)/);
        report += `**Verification:** ${statusMatch2 ? statusMatch2[1] : 'Unknown'}\n`;
    } else {
        report += '_Not formally verified._\n';
    }

    report += `\n## Review Status\n\n`;
    if (reviewContent) {
        const s1 = reviewContent.match(/Stage 1 \(Spec\): (PASS|FAIL|PENDING)/);
        const s2 = reviewContent.match(/Stage 2 \(Quality\): (PASS|FAIL|PENDING)/);
        report += `- Spec Review: ${s1 ? s1[1] : 'Not Run'}\n`;
        report += `- Quality Review: ${s2 ? s2[1] : 'Not Run'}\n`;
    } else {
        report += '_No review performed._\n';
    }

    report += `\n## Build Health\n\n`;
    report += `- Errors during build: ${state.error_count}\n`;

    report += `\n---\n_Generated by steroid-workflow v5.0_\n`;

    const reportFilePath = path.join(reportsDir, `${feature}.md`);
    fs.writeFileSync(reportFilePath, report);
    console.log(`[steroid-run]    Report: .memory/reports/${feature}.md`);

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

    // v4.0: Write tech-stack knowledge store
    if (!fs.existsSync(knowledgeDir)) {
        fs.mkdirSync(knowledgeDir, { recursive: true });
    }
    const techStackFile = path.join(knowledgeDir, 'tech-stack.json');
    const techStackData = {
        language,
        framework,
        packageManager,
        testFramework,
        testCommand,
        testCount,
        _lastUpdated: new Date().toISOString(),
        _source: 'scan',
    };
    fs.writeFileSync(techStackFile, JSON.stringify(techStackData, null, 2));
    console.log(`[steroid-run]    Knowledge: tech-stack.json updated.`);

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

// --- Review Command (Two-stage review system — v5.0) ---
// Source: src/forks/superpowers/subagent.md + spec-reviewer-prompt.md + code-quality-reviewer-prompt.md
if (args[0] === 'review') {
    const sub = args[1];
    const feature = args[2];

    if (!sub || sub === '--help') {
        console.log(`
[steroid-run] review — Two-stage review system for feature validation.

Usage:
  node steroid-run.cjs review spec <feature>       Stage 1: Spec compliance review
  node steroid-run.cjs review quality <feature>    Stage 2: Code quality review (requires Stage 1 PASS)
  node steroid-run.cjs review status <feature>     Show review status for a feature
  node steroid-run.cjs review reset <feature>      Reset review state (re-review)

Stages:
  Stage 1 (Spec Review)   — "Did the AI build what was requested?"
  Stage 2 (Quality Review) — "Is it well-built?"
                             Only runs after Stage 1 passes.

Output: .memory/changes/<feature>/review.md

Source: src/forks/superpowers/subagent.md (two-stage review flow)
`);
        process.exit(0);
    }

    if (!feature) {
        console.error('[steroid-run] Usage: node steroid-run.cjs review <spec|quality|status|reset> <feature>');
        process.exit(1);
    }

    const featureDir = path.join(changesDir, feature);
    const reviewFile = path.join(featureDir, 'review.md');

    if (sub === 'status') {
        if (!fs.existsSync(reviewFile)) {
            console.log(`[steroid-run] 📋 No review started for "${feature}".`);
            console.log('  Run: node steroid-run.cjs review spec ' + feature);
            process.exit(0);
        }
        const content = fs.readFileSync(reviewFile, 'utf-8');
        const specMatch = content.match(/Stage 1 \(Spec\): (PASS|FAIL|PENDING)/);
        const qualityMatch = content.match(/Stage 2 \(Quality\): (PASS|FAIL|PENDING)/);
        const specStatus = specMatch ? specMatch[1] : 'NOT RUN';
        const qualityStatus = qualityMatch ? qualityMatch[1] : 'NOT RUN';

        const icons = { PASS: '✅', FAIL: '❌', PENDING: '⏳', 'NOT RUN': '○' };
        console.log(`[steroid-run] 📋 Review Status for "${feature}":`);
        console.log(`  ${icons[specStatus]} Stage 1 (Spec Compliance): ${specStatus}`);
        console.log(`  ${icons[qualityStatus]} Stage 2 (Code Quality): ${qualityStatus}`);

        if (specStatus === 'PASS' && qualityStatus === 'PASS') {
            console.log('\n  ✅ Both stages passed. Ready for verification.');
        } else if (specStatus === 'FAIL') {
            console.log('\n  ❌ Spec review failed. Fix issues and re-run: node steroid-run.cjs review spec ' + feature);
        } else if (specStatus === 'PASS' && qualityStatus !== 'PASS') {
            console.log('\n  ⏳ Spec passed. Run quality review: node steroid-run.cjs review quality ' + feature);
        }
        process.exit(0);
    }

    if (sub === 'reset') {
        if (fs.existsSync(reviewFile)) {
            fs.unlinkSync(reviewFile);
            console.log(`[steroid-run] 🔄 Review reset for "${feature}". Run: node steroid-run.cjs review spec ${feature}`);
        } else {
            console.log(`[steroid-run] No review to reset for "${feature}".`);
        }
        process.exit(0);
    }

    if (sub === 'spec') {
        const specFile = path.join(featureDir, 'spec.md');
        const planFile = path.join(featureDir, 'plan.md');

        if (!fs.existsSync(specFile)) {
            console.error(`[steroid-run] ❌ No spec.md found for "${feature}". Cannot run spec review without acceptance criteria.`);
            process.exit(1);
        }
        if (!fs.existsSync(planFile)) {
            console.error(`[steroid-run] ❌ No plan.md found for "${feature}". Cannot run spec review without task list.`);
            process.exit(1);
        }

        console.log(`[steroid-run] 🔍 Stage 1: Spec Compliance Review for "${feature}"...`);
        console.log('');
        console.log('  The AI should now:');
        console.log('  1. Read .memory/changes/' + feature + '/spec.md — extract ALL acceptance criteria');
        console.log('  2. Read .memory/changes/' + feature + '/plan.md — extract ALL completed tasks');
        console.log('  3. For EACH criterion, grep/read the actual implementation code');
        console.log('  4. Determine status: ✅ IMPLEMENTED | ⚠️ PARTIAL | ❌ MISSING | 🔄 EXTRA');
        console.log('  5. Write findings to .memory/changes/' + feature + '/review.md');
        console.log('');
        console.log('  Source: src/forks/superpowers/spec-reviewer-prompt.md');
        console.log('  CRITICAL: Do NOT trust the implementer\'s report. Read the actual code.');
        console.log('');

        const reviewContent = `# Review Report: ${feature}\n\n**Started:** ${new Date().toISOString()}\n\n## Review Status\n\n- Stage 1 (Spec): PENDING\n- Stage 2 (Quality): PENDING\n\n## Stage 1: Spec Compliance Review\n\n_AI: Fill this section after reviewing code against spec.md criteria._\n\n| # | Criterion | Status | Evidence |\n|---|-----------|--------|----------|\n| 1 | _from spec.md_ | _status_ | _file:line_ |\n\n**Spec Score:** _/_ criteria verified\n**Stage 1 Result:** PENDING\n\n---\n\n## Stage 2: Code Quality Review\n\n_Blocked until Stage 1 passes._\n\n---\n\n_Reviewer: steroid-review v5.0_\n`;
        if (!fs.existsSync(featureDir)) fs.mkdirSync(featureDir, { recursive: true });
        fs.writeFileSync(reviewFile, reviewContent);
        console.log(`[steroid-run] 📝 Review template written to .memory/changes/${feature}/review.md`);
        console.log('  AI: Complete the spec review, then update Stage 1 Result to PASS or FAIL.');
        process.exit(0);
    }

    if (sub === 'quality') {
        if (!fs.existsSync(reviewFile)) {
            console.error(`[steroid-run] ❌ No review started. Run Stage 1 first: node steroid-run.cjs review spec ${feature}`);
            process.exit(1);
        }

        const content = fs.readFileSync(reviewFile, 'utf-8');
        if (!content.includes('Stage 1 (Spec): PASS') && !content.includes('Stage 1 Result: PASS')) {
            console.error('[steroid-run] 🚫 REVIEW GATE: Stage 1 (Spec) has not passed.');
            console.error('  Stage 2 (Quality) cannot run until Stage 1 passes.');
            console.error('  Fix spec issues and update review.md, or re-run: node steroid-run.cjs review spec ' + feature);
            process.exit(1);
        }

        console.log(`[steroid-run] 🔍 Stage 2: Code Quality Review for "${feature}"...`);
        console.log('');
        console.log('  The AI should now:');
        console.log('  1. Review all files created/modified during this feature');
        console.log('  2. Check: Single responsibility, naming, error handling, no stubs');
        console.log('  3. Run anti-pattern scan: TODO/FIXME, empty returns, console.log-only handlers');
        console.log('  4. Categorize: 🛑 Critical | ⚠️ Important | ℹ️ Minor');
        console.log('  5. Update Stage 2 section in review.md');
        console.log('');
        console.log('  Source: src/forks/superpowers/code-quality-reviewer-prompt.md');
        process.exit(0);
    }

    console.error(`[steroid-run] ❌ Unknown review subcommand: "${sub}". Run: node steroid-run.cjs review --help`);
    process.exit(1);
}

// --- Report Command (AI-to-Human handoff — v5.0) ---
// Source: src/forks/gsd research-synthesizer + src/forks/ralph progress.txt + src/forks/spec-kit success-criteria
if (args[0] === 'report') {
    const sub = args[1];
    const feature = args[2];

    if (!sub || sub === '--help') {
        console.log(`
[steroid-run] report — AI-to-Human handoff reports.

Usage:
  node steroid-run.cjs report generate <feature>   Generate handoff report after archive
  node steroid-run.cjs report show <feature>       Show a feature's handoff report
  node steroid-run.cjs report list                 List all handoff reports

Reports are written to .memory/reports/<feature>.md

Source: src/forks/gsd research-synthesizer (executive summary pattern)
`);
        process.exit(0);
    }

    if (!fs.existsSync(reportsDir)) {
        fs.mkdirSync(reportsDir, { recursive: true });
    }

    if (sub === 'list') {
        const files = fs.existsSync(reportsDir) ? fs.readdirSync(reportsDir).filter(f => f.endsWith('.md')) : [];
        if (files.length === 0) {
            console.log('[steroid-run] 📭 No handoff reports yet. Archive a feature to generate one.');
            process.exit(0);
        }
        console.log('\n[steroid-run] 📋 Handoff Reports\n');
        for (const f of files) {
            const content = fs.readFileSync(path.join(reportsDir, f), 'utf-8');
            const statusMatch = content.match(/\*\*Status:\*\* (.+)/);
            const dateMatch = content.match(/\*\*Completed:\*\* (.+)/);
            const status = statusMatch ? statusMatch[1] : 'unknown';
            const date = dateMatch ? dateMatch[1] : 'unknown';
            console.log(`  📄 ${f.replace('.md', '')} — ${status} (${date})`);
        }
        process.exit(0);
    }

    if (sub === 'show') {
        if (!feature) {
            console.error('[steroid-run] Usage: node steroid-run.cjs report show <feature>');
            process.exit(1);
        }
        const reportFile = path.join(reportsDir, `${feature}.md`);
        if (!fs.existsSync(reportFile)) {
            console.error(`[steroid-run] ❌ No report found for "${feature}".`);
            process.exit(1);
        }
        console.log(fs.readFileSync(reportFile, 'utf-8'));
        process.exit(0);
    }

    if (sub === 'generate') {
        if (!feature) {
            console.error('[steroid-run] Usage: node steroid-run.cjs report generate <feature>');
            process.exit(1);
        }

        const featureDir = path.join(changesDir, feature);
        const archiveDir = path.join(featureDir, 'archive');

        const findFile = (name) => {
            if (fs.existsSync(archiveDir)) {
                const archiveFiles = fs.readdirSync(archiveDir).filter(f => f.endsWith(name));
                if (archiveFiles.length > 0) return fs.readFileSync(path.join(archiveDir, archiveFiles[archiveFiles.length - 1]), 'utf-8');
            }
            const activePath = path.join(featureDir, name);
            if (fs.existsSync(activePath)) return fs.readFileSync(activePath, 'utf-8');
            return null;
        };

        const specContent = findFile('spec.md');
        const verifyContent = findFile('verify.md');
        const planContent = findFile('plan.md');
        const reviewContent = findFile('review.md');

        let report = `# Handoff Report: ${feature}\n\n`;
        report += `**Completed:** ${new Date().toISOString()}\n`;
        report += `**Generated by:** steroid-workflow v5.0\n\n`;

        report += `## What Was Built\n\n`;
        if (specContent) {
            const criteria = specContent.match(/(?:Given|When|Then|Scenario).+/gi) || [];
            if (criteria.length > 0) {
                report += `${criteria.length} acceptance scenarios implemented:\n\n`;
                for (const c of criteria.slice(0, 10)) report += `- ${c.trim()}\n`;
                if (criteria.length > 10) report += `- _(and ${criteria.length - 10} more)_\n`;
            } else {
                report += '_See spec.md for full acceptance criteria._\n';
            }
        } else {
            report += '_No spec.md found._\n';
        }

        report += `\n## What Was Tested\n\n`;
        if (verifyContent) {
            const statusMatch = verifyContent.match(/\*\*Status:\*\* (PASS|FAIL|CONDITIONAL)/);
            const scoreMatch = verifyContent.match(/\*\*Spec Score:\*\* (.+)/);
            report += `**Status:** ${statusMatch ? statusMatch[1] : 'Unknown'}\n`;
            if (scoreMatch) report += `**Score:** ${scoreMatch[1]}\n`;
            const testMatch = verifyContent.match(/\*\*Result:\*\* (.+)/);
            if (testMatch) report += `**Tests:** ${testMatch[1]}\n`;
        } else {
            report += '_No verify.md found._\n';
        }

        report += `\n## Review Status\n\n`;
        if (reviewContent) {
            const s1 = reviewContent.match(/Stage 1 \(Spec\): (PASS|FAIL|PENDING)/);
            const s2 = reviewContent.match(/Stage 2 \(Quality\): (PASS|FAIL|PENDING)/);
            report += `- Spec Review: ${s1 ? s1[1] : 'Not Run'}\n`;
            report += `- Quality Review: ${s2 ? s2[1] : 'Not Run'}\n`;
        } else {
            report += '_No two-stage review performed._\n';
        }

        report += `\n## Tasks Completed\n\n`;
        if (planContent) {
            const total = (planContent.match(/- \[[ x/]\]/g) || []).length;
            const done = (planContent.match(/- \[x\]/g) || []).length;
            report += `${done}/${total} tasks completed (${total > 0 ? Math.round((done / total) * 100) : 0}%)\n`;
        } else {
            report += '_No plan.md found._\n';
        }

        report += `\n## Known Limitations\n\n`;
        if (planContent) {
            const deferred = planContent.match(/- \[ \].+/g) || [];
            if (deferred.length > 0) {
                report += `${deferred.length} items were not completed:\n\n`;
                for (const d of deferred.slice(0, 5)) report += `${d}\n`;
                if (deferred.length > 5) report += `- _(and ${deferred.length - 5} more)_\n`;
            } else {
                report += 'All planned tasks were completed.\n';
            }
        } else {
            report += '_Unknown — no plan.md available._\n';
        }

        report += `\n## Build Health\n\n`;
        report += `- Circuit breaker errors during build: ${state.error_count}\n`;
        if (state.error_history && state.error_history.length > 0) {
            report += '- Errors encountered:\n';
            for (const err of state.error_history.slice(-5)) report += `  - ${err}\n`;
        }

        report += `\n---\n\n_Generated by steroid-workflow v5.0 handoff system_\n`;

        const reportFile = path.join(reportsDir, `${feature}.md`);
        fs.writeFileSync(reportFile, report);
        console.log(`[steroid-run] 📄 Handoff report generated: .memory/reports/${feature}.md`);
        console.log(`  Run: node steroid-run.cjs report show ${feature}`);
        process.exit(0);
    }

    console.error(`[steroid-run] ❌ Unknown report subcommand: "${sub}". Run: node steroid-run.cjs report --help`);
    process.exit(1);
}

// --- Dashboard Command (Analytics dashboard — v5.0) ---
// Source: src/forks/ralph progress.txt metrics + src/forks/gsd confidence-breakdown
if (args[0] === 'dashboard') {
    console.log('\n[steroid-run] 📊 Steroid-Workflow Dashboard\n');

    // 1. Features summary
    const featuresFile = path.join(metricsDir, 'features.json');
    let featuresData = {};
    if (fs.existsSync(featuresFile)) {
        try { featuresData = JSON.parse(fs.readFileSync(featuresFile, 'utf-8')); } catch (e) { /* ignore */ }
    }
    const featureNames = Object.keys(featuresData).filter(k => k !== '_lastUpdated');

    console.log('  ── Features ──────────────────────────────');
    if (featureNames.length === 0) {
        console.log('  No features archived yet.');
    } else {
        let totalErrors = 0;
        for (const name of featureNames) {
            const f = featuresData[name];
            const icon = f.status === 'complete' ? '✅' : '⏳';
            const errors = f.errorCount || 0;
            totalErrors += errors;
            const fDate = f.archived ? f.archived.split('T')[0] : 'unknown';
            console.log(`  ${icon} ${name} — ${errors} error(s) — ${fDate}`);
        }
        const avgErrors = featureNames.length > 0 ? (totalErrors / featureNames.length).toFixed(1) : 0;
        console.log(`\n  Total: ${featureNames.length} features | Avg errors: ${avgErrors}/feature`);
    }

    // 2. Error patterns
    console.log('\n  ── Error Patterns ────────────────────────');
    const errorPatternsFile = path.join(metricsDir, 'error-patterns.json');
    if (fs.existsSync(errorPatternsFile)) {
        try {
            const ep = JSON.parse(fs.readFileSync(errorPatternsFile, 'utf-8'));
            const patterns = ep.patterns || [];
            console.log(`  ${patterns.length} errors recorded`);
            if (patterns.length > 0) {
                const keywords = {};
                for (const p of patterns) {
                    const kw = p.keyword || 'unknown';
                    keywords[kw] = (keywords[kw] || 0) + 1;
                }
                const sorted = Object.entries(keywords).sort((a, b) => b[1] - a[1]).slice(0, 5);
                if (sorted.length > 0) {
                    console.log('  Top error sources:');
                    for (const [kw, count] of sorted) console.log(`    ${count}x — ${kw}`);
                }
            }
        } catch (e) {
            console.log('  ⚠️ Error patterns file corrupt');
        }
    } else {
        console.log('  No error patterns recorded yet.');
    }

    // 3. Circuit breaker state
    console.log('\n  ── Circuit Breaker ───────────────────────');
    const levels = ['🟢 CLEAR', '🟡 LOGGED', '🟠 RE-READ', '🔶 DIAGNOSING', '🔴 ESCALATED', '🛑 TRIPPED'];
    const level = Math.min(state.error_count, 5);
    console.log(`  Current: ${levels[level]} (${state.error_count}/5 errors)`);
    const tripCount = (state.recovery_actions || []).filter(a => a.includes('L4') || a.includes('L5')).length;
    console.log(`  Escalations this session: ${tripCount}`);

    // 4. Knowledge store health
    console.log('\n  ── Knowledge Stores ──────────────────────');
    const kStores = ['tech-stack', 'patterns', 'decisions', 'gotchas'];
    let populated = 0;
    for (const store of kStores) {
        const storeFile = path.join(knowledgeDir, `${store}.json`);
        if (fs.existsSync(storeFile)) {
            try {
                const data = JSON.parse(fs.readFileSync(storeFile, 'utf-8'));
                const entries = Object.keys(data).filter(k => k !== '_lastUpdated').length;
                console.log(`  ✅ ${store}: ${entries} entries`);
                populated++;
            } catch (e) {
                console.log(`  ⚠️ ${store}: corrupt`);
            }
        } else {
            console.log(`  ○  ${store}: empty`);
        }
    }
    console.log(`  Coverage: ${populated}/4 stores populated`);

    // 5. Reports
    console.log('\n  ── Handoff Reports ───────────────────────');
    if (fs.existsSync(reportsDir)) {
        const reports = fs.readdirSync(reportsDir).filter(f => f.endsWith('.md'));
        console.log(`  ${reports.length} report(s) generated`);
    } else {
        console.log('  No reports generated yet.');
    }

    console.log('\n  ─────────────────────────────────────────');
    console.log('');
    process.exit(0);
}

// --- Circuit Breaker Check ---
if (state.error_count >= 5) {
    console.error(`
========================================================================
[STEROID-CIRCUIT-BREAKER TRIPPED] 🛑
Maximum error tolerance reached (5/5).
All 5 recovery levels exhausted.
AI Agent: YOU ARE ORDERED TO STOP TERMINAL EXECUTION IMMEDIATELY.
DO NOT RUN DESTRUCTIVE COMMANDS. DO NOT ATTEMPT TO SILENTLY FIX THIS.
Present the user with the exact error log and file context, and ask for
human validation to pivot the architecture or manually intervene.

Run: npx steroid-run recover     (to review error history)
Run: npx steroid-run reset       (to resume after fixing)
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
    if (!state.error_history) state.error_history = [];
    state.error_history.push(`[${new Date().toISOString()}] ${state.last_error}`);
    if (!state.recovery_actions) state.recovery_actions = [];
    state.status = state.error_count >= 5 ? 'tripped' : 'active';

    // v4.0: Graduated recovery messages
    const recoveryHints = {
        1: 'Try a different approach. Run: node steroid-run.cjs recover',
        2: 'Re-read your plan. Run: node steroid-run.cjs recover',
        3: 'Self-diagnosing... Run: node steroid-run.cjs recover',
        4: '⚠️ STOP and present errors to user. Run: node steroid-run.cjs recover',
        5: 'CIRCUIT BREAKER TRIPPED. Run "npx steroid-run reset" to resume.',
    };
    const hint = recoveryHints[Math.min(state.error_count, 5)];
    console.error(`\n[steroid-run] ❌ ERROR ${state.error_count}/5. ${hint}`);

    // v4.0: Record error pattern for future self-diagnosis
    if (!fs.existsSync(metricsDir)) fs.mkdirSync(metricsDir, { recursive: true });
    const errorPatternsFile = path.join(metricsDir, 'error-patterns.json');
    let errorPatterns = { patterns: [] };
    if (fs.existsSync(errorPatternsFile)) {
        try { errorPatterns = JSON.parse(fs.readFileSync(errorPatternsFile, 'utf-8')); } catch (e) { /* ignore */ }
    }
    errorPatterns.patterns.push({
        keyword: commandStr.split(' ')[0],
        error: state.last_error,
        timestamp: new Date().toISOString(),
    });
    if (errorPatterns.patterns.length > 50) {
        errorPatterns.patterns = errorPatterns.patterns.slice(-50);
    }
    fs.writeFileSync(errorPatternsFile, JSON.stringify(errorPatterns, null, 2));
} else {
    state.error_count = 0;
    state.last_error = null;
    state.status = 'active';
}

fs.writeFileSync(stateFile, JSON.stringify(state, null, 2));
process.exit(child.status);
