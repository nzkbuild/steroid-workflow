'use strict';

const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const { resolvePathWithinRoot } = require('../utils/path-guards.cjs');
const { tokenizeCommand, validateExecutionCommandTokens } = require('../utils/command-guards.cjs');
const { findBlockedShellSyntax, stripWrappingQuotes } = require('../utils/trust-helpers.cjs');
const { analyzePrompt } = require('../utils/prompt-intelligence.cjs');
const { summarizeRouteProgress } = require('../utils/prompt-intelligence.cjs');
const { inspectPromptSessionState } = require('../utils/session-state.cjs');
const { formatPromptMarkdown } = require('../utils/prompt-brief.cjs');
const {
    loadCompletionReceipt,
    loadRequestReceipt,
    loadVerifyReceipt,
    saveExecutionReceipt,
    saveRequestReceipt,
} = require('../utils/receipt-loaders.cjs');
const { buildFeatureArtifactState, formatPipelineStatus } = require('../utils/pipeline-status.cjs');
const { friendlyHint } = require('../utils/friendly-hints.cjs');
const { parseChecklistStats, validateGovernedPhaseArtifact } = require('../utils/governed-artifacts.cjs');
const { bootstrapFeatureDesignArtifacts, readJsonFile } = require('../utils/design-workflow.cjs');
const { loadDesignRoutingReceipt, loadUiReviewReceipt } = require('../utils/frontend-receipt-loaders.cjs');
const { detectUiFeatureForGate, refreshUiReviewArtifacts } = require('../utils/frontend-review.cjs');
const { resolveRepoRoot } = require('../utils/fork-sources.cjs');
const { buildUiArchivePolicy } = require('../utils/ui-archive-policy.cjs');
const { generateHandoffReportContent } = require('../utils/handoff-report.cjs');
const { createArchiveStamp, getArchiveDestinationPath } = require('../utils/trust-helpers.cjs');

const PIPELINE_COMMANDS = new Set([
    'reset',
    'recover',
    'status',
    'pipeline-status',
    'git-init',
    'init-feature',
    'gate',
    'commit',
    'log',
    'check-plan',
    'stories',
    'smoke-test',
    'archive',
    'scan',
    'detect-intent',
    'normalize-prompt',
    'detect-tests',
    'run',
    'verify',
]);

const ALLOWED_COMMANDS = new Set([
    'npm',
    'npx',
    'node',
    'pnpm',
    'yarn',
    'bun',
    'bunx',
    'deno',
    'git',
    'echo',
    'cat',
    'ls',
    'dir',
    'mkdir',
    'cp',
    'mv',
    'type',
    'where',
    'rm',
    'rmdir',
    'del',
    'rd',
    'move',
    'copy',
    'xcopy',
    'grep',
    'findstr',
    'head',
    'tail',
    'touch',
    'sed',
    'awk',
    'python',
    'python3',
    'pip',
    'pip3',
    'poetry',
    'uv',
    'cargo',
    'rustc',
    'rustup',
    'go',
    'dotnet',
    'flutter',
    'dart',
    'ruby',
    'gem',
    'bundle',
    'rake',
    'php',
    'composer',
    'java',
    'javac',
    'mvn',
    'gradle',
    'gradlew',
    'make',
    'cmake',
    'docker',
    'docker-compose',
    'tsc',
    'eslint',
    'prettier',
    'jest',
    'vitest',
    'mocha',
    'pytest',
    'knip',
    'madge',
    'gitleaks',
]);

function canHandle(command) {
    return PIPELINE_COMMANDS.has(command);
}

function buildRuntimeContext(context = {}) {
    const targetDir = context.targetDir || process.cwd();
    return {
        targetDir,
        stateFile: context.stateFile || path.join(targetDir, '.memory', 'execution_state.json'),
        memoryDir: path.join(targetDir, '.memory'),
        changesDir: path.join(targetDir, '.memory', 'changes'),
        progressFile: path.join(targetDir, '.memory', 'progress.md'),
        knowledgeDir: path.join(targetDir, '.memory', 'knowledge'),
        metricsDir: path.join(targetDir, '.memory', 'metrics'),
        reportsDir: path.join(targetDir, '.memory', 'reports'),
        runtimeRoot: context.runtimeRoot || resolveRepoRoot(),
        version: context.version || loadPackageVersion(targetDir),
    };
}

function loadPackageVersion(targetDir) {
    const pkgPath = path.join(targetDir, 'package.json');
    if (!fs.existsSync(pkgPath)) {
        return '7.0.0-beta.1';
    }

    try {
        const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
        return typeof pkg.version === 'string' ? pkg.version : '7.0.0-beta.1';
    } catch {
        return '7.0.0-beta.1';
    }
}

function readStateFile(stateFile) {
    try {
        return JSON.parse(fs.readFileSync(stateFile, 'utf-8'));
    } catch {
        return {
            error_count: 0,
            last_error: null,
            status: 'active',
            recovery_actions: [],
        };
    }
}

function writeStateFile(stateFile, state) {
    fs.mkdirSync(path.dirname(stateFile), { recursive: true });
    fs.writeFileSync(stateFile, JSON.stringify(state, null, 2));
}

function writeJsonFile(filePath, data) {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

function countTestFiles(dir) {
    let count = 0;
    if (!fs.existsSync(dir)) return count;

    try {
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        for (const entry of entries) {
            const fullPath = path.join(dir, entry.name);
            if (entry.isDirectory()) {
                count += countTestFiles(fullPath);
            } else if (
                entry.isFile() &&
                (entry.name.includes('.test.') || entry.name.includes('.spec.') || entry.name.startsWith('test_'))
            ) {
                count++;
            }
        }
    } catch {
        return count;
    }

    return count;
}

function detectProjectStack(targetDir) {
    let language = 'Unknown';
    let framework = 'Unknown';
    let packageManager = 'Unknown';
    let testFramework = 'Not detected';
    let testCommand = 'Not configured';

    const pkgPath = path.join(targetDir, 'package.json');
    if (fs.existsSync(pkgPath)) {
        try {
            const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
            language = 'JavaScript/TypeScript';
            packageManager = fs.existsSync(path.join(targetDir, 'pnpm-lock.yaml'))
                ? 'pnpm'
                : fs.existsSync(path.join(targetDir, 'yarn.lock'))
                  ? 'yarn'
                  : 'npm';

            const deps = { ...pkg.dependencies, ...pkg.devDependencies };
            if (deps.next) framework = `Next.js ${deps.next}`;
            else if (deps.react) framework = `React ${deps.react}`;
            else if (deps.vue) framework = `Vue ${deps.vue}`;
            else if (deps.svelte || deps['@sveltejs/kit']) framework = 'SvelteKit';
            else if (deps.express) framework = `Express ${deps.express}`;
            else if (deps.fastify) framework = `Fastify ${deps.fastify}`;
            else if (deps.hono) framework = `Hono ${deps.hono}`;
            else framework = 'Node.js';

            if (deps.vitest) {
                testFramework = 'Vitest';
                testCommand = 'npx vitest';
            } else if (deps.jest) {
                testFramework = 'Jest';
                testCommand = 'npx jest';
            } else if (deps.mocha) {
                testFramework = 'Mocha';
                testCommand = 'npx mocha';
            } else if (deps['@playwright/test']) {
                testFramework = 'Playwright';
                testCommand = 'npx playwright test';
            }

            if (pkg.scripts && pkg.scripts.test && pkg.scripts.test !== 'echo "Error: no test specified" && exit 1') {
                testCommand = 'npm test';
            }
        } catch {
            // Ignore invalid package metadata and keep heuristics going.
        }
    }

    if (language === 'JavaScript/TypeScript') {
        language = fs.existsSync(path.join(targetDir, 'tsconfig.json')) ? 'TypeScript' : 'JavaScript';
    }

    if (fs.existsSync(path.join(targetDir, 'requirements.txt')) || fs.existsSync(path.join(targetDir, 'pyproject.toml'))) {
        language = 'Python';
        packageManager = fs.existsSync(path.join(targetDir, 'pyproject.toml')) ? 'poetry/pip' : 'pip';
        framework = fs.existsSync(path.join(targetDir, 'manage.py'))
            ? 'Django'
            : fs.existsSync(path.join(targetDir, 'app.py'))
              ? 'Flask'
              : 'Python';
        if (fs.existsSync(path.join(targetDir, 'pytest.ini')) || fs.existsSync(path.join(targetDir, 'pyproject.toml'))) {
            testFramework = 'Pytest';
            testCommand = 'pytest';
        }
    }

    if (fs.existsSync(path.join(targetDir, 'go.mod'))) {
        language = 'Go';
        packageManager = 'go mod';
        framework = 'Go';
        testFramework = 'go test';
        testCommand = 'go test ./...';
    }

    if (fs.existsSync(path.join(targetDir, 'Cargo.toml'))) {
        language = 'Rust';
        packageManager = 'cargo';
        framework = 'Rust';
        testFramework = 'cargo test';
        testCommand = 'cargo test';
    }

    const testCount =
        countTestFiles(path.join(targetDir, 'src')) +
        countTestFiles(path.join(targetDir, 'tests')) +
        countTestFiles(path.join(targetDir, 'test')) +
        countTestFiles(path.join(targetDir, '__tests__'));

    return {
        language,
        framework,
        packageManager,
        testFramework,
        testCommand,
        testCount,
    };
}

function handleStatus(context = {}) {
    const runtime = buildRuntimeContext(context);
    const state = readStateFile(runtime.stateFile);
    const levels = ['🟢 CLEAR', '🟡 LOGGED', '🟠 RE-READ', '🔶 DIAGNOSING', '🔴 ESCALATED', '🛑 TRIPPED'];
    const level = Math.min(state.error_count || 0, 5);
    const lines = ['[steroid-run] Circuit Breaker Status:'];
    lines.push(`  Error Count: ${state.error_count || 0}/5`);
    lines.push(`  Level: ${levels[level]}`);
    if (state.last_error) lines.push(`  Last Error: ${state.last_error}`);
    const recoveryActions = Array.isArray(state.recovery_actions) ? state.recovery_actions : [];
    if (recoveryActions.length > 0) {
        lines.push('  Recovery Actions:');
        for (const action of recoveryActions) {
            lines.push(`    - ${action}`);
        }
    }
    return {
        handled: true,
        area: 'pipeline',
        command: 'status',
        exitCode: 0,
        stdout: `${lines.join('\n')}\n`,
    };
}

function handleReset(context = {}) {
    const runtime = buildRuntimeContext(context);
    writeStateFile(runtime.stateFile, {
        error_count: 0,
        last_error: null,
        status: 'active',
        recovery_actions: [],
        error_history: [],
    });

    return {
        handled: true,
        area: 'pipeline',
        command: 'reset',
        exitCode: 0,
        stdout: '[steroid-run] ✅ Circuit breaker reset. Error count is now 0/5. You may resume.\n',
    };
}

function handleRecover(context = {}) {
    const runtime = buildRuntimeContext(context);
    const state = readStateFile(runtime.stateFile);
    const level = state.error_count || 0;

    if (level === 0) {
        return {
            handled: true,
            area: 'pipeline',
            command: 'recover',
            exitCode: 0,
            stdout: '[steroid-run] ✅ No errors to recover from. Circuit breaker is clear.\n',
        };
    }

    let errorPatterns = { patterns: [] };
    const errorPatternsFile = path.join(runtime.metricsDir, 'error-patterns.json');
    if (fs.existsSync(errorPatternsFile)) {
        try {
            errorPatterns = JSON.parse(fs.readFileSync(errorPatternsFile, 'utf-8'));
        } catch {
            errorPatterns = { patterns: [] };
        }
    }

    if (!Array.isArray(state.recovery_actions)) {
        state.recovery_actions = [];
    }

    const lines = [`\n[steroid-run] 🔧 Smart Recovery — Error Level ${level}/5\n`];

    if (level === 1) {
        lines.push('  📋 Level 1: LOGGED — Retry with a different approach.');
        lines.push(`  Last error: ${state.last_error}`);
        lines.push('');
        lines.push('  Suggested actions:');
        lines.push('    1. Re-read the error message carefully');
        lines.push('    2. Try a different implementation approach');
        lines.push('    3. Check if the command syntax is correct');
        state.recovery_actions.push(`L1 recovery: retry suggested at ${new Date().toISOString()}`);
    } else if (level === 2) {
        lines.push('  📖 Level 2: RE-READ — Pause and re-read your plan.');
        lines.push(`  Last error: ${state.last_error}`);
        lines.push('');
        lines.push('  Suggested actions:');
        lines.push('    1. Re-read plan.md or diagnosis.md for the current feature');
        lines.push('    2. Verify your approach matches the architecture');
        lines.push('    3. Check if dependencies are installed');
        state.recovery_actions.push(`L2 recovery: re-read suggested at ${new Date().toISOString()}`);
    } else if (level === 3) {
        lines.push('  🔍 Level 3: SELF-DIAGNOSE — Checking error-patterns.json...');
        lines.push(`  Last error: ${state.last_error}`);
        lines.push('');
        const patterns = Array.isArray(errorPatterns.patterns) ? errorPatterns.patterns : [];
        if (patterns.length > 0) {
            const lastErr = String(state.last_error || '').toLowerCase();
            const matches = patterns.filter((pattern) => lastErr.includes(String(pattern.keyword || '').toLowerCase()));
            if (matches.length > 0) {
                lines.push('  🎯 Matching error patterns found:');
                for (const match of matches) {
                    lines.push(`    Pattern: ${match.keyword}`);
                    lines.push(`    Fix: ${match.fix || match.error}`);
                    lines.push('');
                }
            } else {
                lines.push('  No matching patterns. Recording this error for future diagnosis.');
            }
        } else {
            lines.push('  No error patterns recorded yet. This error will be tracked.');
        }
        state.recovery_actions.push(`L3 recovery: self-diagnosis at ${new Date().toISOString()}`);
    } else if (level === 4) {
        lines.push('  🚨 Level 4: ESCALATED — Present diagnosis to user.');
        lines.push(`  Last error: ${state.last_error}`);
        lines.push('');
        lines.push('  ⚠️  This feature has hit 4 errors. The AI should:');
        lines.push('    1. STOP all terminal execution');
        lines.push('    2. Present ALL errors encountered (check error_history in execution_state.json)');
        lines.push('    3. Propose 2-3 alternative approaches');
        lines.push('    4. Wait for human decision before continuing');
        lines.push('');
        lines.push('  Error history:');
        if (Array.isArray(state.error_history) && state.error_history.length > 0) {
            for (const error of state.error_history) {
                lines.push(`    - ${error}`);
            }
        }
        state.recovery_actions.push(`L4 recovery: escalation at ${new Date().toISOString()}`);
    } else {
        lines.push('  🛑 Level 5: HARD STOP — Circuit breaker tripped.');
        lines.push(friendlyHint('circuit-tripped'));
        lines.push('  Run: node steroid-run.cjs reset');
    }

    writeStateFile(runtime.stateFile, state);

    return {
        handled: true,
        area: 'pipeline',
        command: 'recover',
        exitCode: level >= 5 ? 1 : 0,
        stdout: `${lines.join('\n')}\n`,
    };
}

function handleInitFeature(argv = [], context = {}) {
    const runtime = buildRuntimeContext(context);
    const slug = argv[1];
    if (!slug) {
        return {
            handled: true,
            area: 'pipeline',
            command: 'init-feature',
            exitCode: 1,
            stderr:
                '[steroid-run] Usage: npx steroid-run init-feature <slug>\n' +
                '  Example: npx steroid-run init-feature habit-tracker\n',
        };
    }

    const kebabCasePattern = /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/;
    if (!kebabCasePattern.test(slug)) {
        let message = `[steroid-run] ❌ Feature name must be kebab-case (e.g., habit-tracker, todo-app). Got: "${slug}"\n`;
        if (/[A-Z]/.test(slug)) {
            message = `[steroid-run] ❌ Feature name must be lowercase (use kebab-case). Got: "${slug}"\n`;
        } else if (/\s/.test(slug)) {
            message = `[steroid-run] ❌ Feature name cannot contain spaces (use hyphens). Got: "${slug}"\n`;
        } else if (/_/.test(slug)) {
            message = `[steroid-run] ❌ Feature name cannot contain underscores (use hyphens). Got: "${slug}"\n`;
        } else if (slug.startsWith('-') || slug.endsWith('-')) {
            message = `[steroid-run] ❌ Feature name cannot start or end with a hyphen. Got: "${slug}"\n`;
        } else if (/--/.test(slug)) {
            message = `[steroid-run] ❌ Feature name cannot contain consecutive hyphens. Got: "${slug}"\n`;
        }
        return {
            handled: true,
            area: 'pipeline',
            command: 'init-feature',
            exitCode: 1,
            stderr: message,
        };
    }

    const featureDir = path.join(runtime.changesDir, slug);
    if (fs.existsSync(featureDir)) {
        return {
            handled: true,
            area: 'pipeline',
            command: 'init-feature',
            exitCode: 0,
            stdout: `[steroid-run] ⚠️  Feature "${slug}" already exists at ${featureDir}\n`,
        };
    }

    fs.mkdirSync(path.join(featureDir, 'archive'), { recursive: true });
    return {
        handled: true,
        area: 'pipeline',
        command: 'init-feature',
        exitCode: 0,
        stdout:
            `[steroid-run] ✅ Feature folder created: .memory/changes/${slug}/\n` +
            `  📁 .memory/changes/${slug}/\n` +
            `  📁 .memory/changes/${slug}/archive/\n` +
            `  🧠 Next: node steroid-run.cjs normalize-prompt "<user prompt>" --feature ${slug} --write\n`,
    };
}

function getMissingDesignArtifactsForPhase(featureDir, phase, promptReceipt = null) {
    if (!['architect', 'engine'].includes(phase)) {
        return [];
    }
    if (!detectUiFeatureForGate(featureDir, promptReceipt)) {
        return [];
    }

    const missing = [];
    if (!loadDesignRoutingReceipt(featureDir, { rootDir: resolveRepoRoot() })) {
        missing.push('design-routing.json');
    }
    if (!fs.existsSync(path.join(featureDir, 'design-system.md'))) {
        missing.push('design-system.md');
    }
    return missing;
}

function appendGateAuditTrail(runtime, feature, phase, fileName, lineCount, content, errorCount) {
    try {
        const hash = crypto.createHash('sha256').update(content).digest('hex').slice(0, 12);
        const auditFile = path.join(runtime.memoryDir, 'audit-trail.md');
        const receipt =
            `\n## [${new Date().toISOString()}] Gate: ${phase} → ${feature}\n` +
            `- **Passed**: ${fileName} (${lineCount} lines, sha256: ${hash})\n` +
            `- **Circuit breaker**: ${errorCount}/5 errors\n`;
        if (!fs.existsSync(auditFile)) {
            fs.writeFileSync(
                auditFile,
                '# Steroid Audit Trail\n\n_Tamper-evident log of pipeline phase completions._\n',
            );
        }
        fs.appendFileSync(auditFile, receipt);
    } catch {
        // best effort only
    }
}

function extractChecklistLines(content) {
    const sanitized = String(content || '').replace(/```[\s\S]*?```/g, '');
    return sanitized.match(/^- \[[ x/]\].+$/gm) || [];
}

function syncTasksArtifact(feature, featureDir, planContent) {
    const checklistLines = extractChecklistLines(planContent);
    const tasksContent = [
        `# Tasks: ${feature}`,
        '',
        `**Source**: .memory/changes/${feature}/plan.md`,
        `**Updated**: ${new Date().toISOString()}`,
        '',
        '## Execution Checklist',
        '',
        ...(checklistLines.length > 0 ? checklistLines : ['- [ ] No checklist items found in plan.md']),
        '',
    ].join('\n');
    fs.writeFileSync(path.join(featureDir, 'tasks.md'), tasksContent);
}

function parseStories(planContent) {
    const storyRegex = /^- \[([ x/])\] (\[P\] )?(?:(P[123]):)?\s*(.+)$/gm;
    const stories = [];
    let match;
    let index = 0;
    while ((match = storyRegex.exec(planContent)) !== null) {
        index++;
        stories.push({
            index,
            status: match[1] === 'x' ? 'done' : match[1] === '/' ? 'in-progress' : 'todo',
            parallel: !!match[2],
            priority: match[3] || 'P2',
            title: match[4].trim(),
        });
    }
    return stories;
}

function handleGate(argv = [], context = {}) {
    const runtime = buildRuntimeContext(context);
    const phase = argv[1];
    const feature = argv[2];

    if (!phase || !feature) {
        return {
            handled: true,
            area: 'pipeline',
            command: 'gate',
            exitCode: 1,
            stderr:
                '[steroid-run] Usage: npx steroid-run gate <phase> <feature>\n' +
                '  Phases: vibe, specify, research, architect, diagnose, engine, verify\n',
        };
    }

    const featureDir = path.join(runtime.changesDir, feature);
    const artifactState = buildFeatureArtifactState(featureDir);
    const promptReceipt = readJsonFile(path.join(featureDir, 'prompt.json'));
    const routeSummary = promptReceipt ? summarizeRouteProgress(promptReceipt, artifactState) : null;
    const requestReceipt = loadRequestReceipt(feature, featureDir);
    const gates = {
        vibe: { requires: 'context.md', minLines: 5, label: 'Codebase scan' },
        specify: { requires: 'vibe.md', minLines: 5, label: 'Vibe capture' },
        research: { requires: 'spec.md', minLines: 10, label: 'Specification' },
        architect: { requires: 'research.md', minLines: 10, label: 'Research' },
        diagnose: { requires: 'context.md', minLines: 5, label: 'Codebase scan' },
        engine: {
            requires: 'plan.md',
            minLines: 10,
            label: 'Architecture',
            alt: { requires: 'diagnosis.md', minLines: 10, label: 'Diagnosis' },
        },
        verify: {
            requires: 'plan.md',
            minLines: 10,
            label: 'Engine execution',
            alt: { requires: 'diagnosis.md', minLines: 10, label: 'Diagnosis (fix pipeline)' },
        },
    };

    const gate = gates[phase];
    if (!gate) {
        return {
            handled: true,
            area: 'pipeline',
            command: 'gate',
            exitCode: 1,
            stderr: `[steroid-run] ❌ Unknown phase: "${phase}". Valid phases: ${Object.keys(gates).join(', ')}\n`,
        };
    }

    if (['vibe', 'diagnose'].includes(phase) && !requestReceipt.requestedAt) {
        return {
            handled: true,
            area: 'pipeline',
            command: 'gate',
            exitCode: 1,
            stderr:
                `[steroid-run] 🚫 GATE BLOCKED: governed scan receipt is incomplete.\n` +
                `  Missing: .memory/changes/${feature}/request.json\n` +
                `  The "${phase}" phase cannot start until request.json and context.md both exist.\n` +
                `  Run: node steroid-run.cjs scan ${feature}\n`,
        };
    }

    const requiredFile = path.join(featureDir, gate.requires);
    const primaryExists = fs.existsSync(requiredFile);

    if (!primaryExists && gate.alt) {
        const altFile = path.join(featureDir, gate.alt.requires);
        if (fs.existsSync(altFile)) {
            const altContent = fs.readFileSync(altFile, 'utf-8');
            const altLines = altContent.split('\n').length;
            if (altLines >= gate.alt.minLines) {
                const altGovernedShape = validateGovernedPhaseArtifact(gate.alt.requires, altContent);
                if (!altGovernedShape.ok) {
                    return {
                        handled: true,
                        area: 'pipeline',
                        command: 'gate',
                        exitCode: 1,
                        stderr:
                            `[steroid-run] 🚫 GATE BLOCKED: ${gate.alt.requires} is missing governed structure.\n` +
                            `  ${altGovernedShape.reason}\n` +
                            `${friendlyHint('gate-incomplete')}\n`,
                    };
                }

                let stdout = `[steroid-run] ✅ Gate passed (alt): ${gate.alt.requires} exists (${altLines} lines). Proceeding to ${phase} via fix pipeline.\n`;
                if (routeSummary) {
                    stdout += `  Route guidance: ${routeSummary.expectedRoute} (${routeSummary.status}) — ${routeSummary.detail}\n`;
                    if (routeSummary.next.phase !== 'complete' && routeSummary.next.phase !== phase) {
                        stdout += `  Suggested next step: ${routeSummary.next.phase} — ${routeSummary.next.reason}\n`;
                    }
                }
                return {
                    handled: true,
                    area: 'pipeline',
                    command: 'gate',
                    exitCode: 0,
                    stdout,
                };
            }

            let stderr = `[steroid-run] 🚫 GATE BLOCKED: ${gate.alt.requires} looks incomplete (${altLines} lines, need ${gate.alt.minLines}+).\n`;
            if (routeSummary) {
                stderr += `  Route guidance: ${routeSummary.expectedRoute} (${routeSummary.status}) — ${routeSummary.detail}\n`;
                if (routeSummary.next.phase !== 'complete') {
                    stderr += `  Suggested next step: ${routeSummary.next.phase} — ${routeSummary.next.reason}\n`;
                }
            }
            return {
                handled: true,
                area: 'pipeline',
                command: 'gate',
                exitCode: 1,
                stderr,
            };
        }
    }

    if (!primaryExists) {
        let stderr =
            `[steroid-run] 🚫 GATE BLOCKED: ${gate.label} phase not complete.\n` +
            `  Missing: .memory/changes/${feature}/${gate.requires}\n`;
        if (gate.alt) {
            stderr += `  Alt path: .memory/changes/${feature}/${gate.alt.requires} (also missing)\n`;
        }
        stderr += `  The "${phase}" phase cannot start until ${gate.requires}${gate.alt ? ` or ${gate.alt.requires}` : ''} exists.\n`;
        if (routeSummary) {
            stderr += `  Route guidance: ${routeSummary.expectedRoute} (${routeSummary.status}) — ${routeSummary.detail}\n`;
            if (routeSummary.next.phase !== 'complete') {
                stderr += `  Suggested next step: ${routeSummary.next.phase} — ${routeSummary.next.reason}\n`;
            }
        }
        stderr += `${friendlyHint('gate-blocked')}\n`;
        return {
            handled: true,
            area: 'pipeline',
            command: 'gate',
            exitCode: 1,
            stderr,
        };
    }

    const content = fs.readFileSync(requiredFile, 'utf-8');
    const lineCount = content.split('\n').length;
    if (lineCount < gate.minLines) {
        let stderr = `[steroid-run] 🚫 GATE BLOCKED: ${gate.requires} looks incomplete (${lineCount} lines, need ${gate.minLines}+).\n`;
        if (routeSummary) {
            stderr += `  Route guidance: ${routeSummary.expectedRoute} (${routeSummary.status}) — ${routeSummary.detail}\n`;
            if (routeSummary.next.phase !== 'complete') {
                stderr += `  Suggested next step: ${routeSummary.next.phase} — ${routeSummary.next.reason}\n`;
            }
        }
        stderr += `${friendlyHint('gate-incomplete')}\n`;
        return {
            handled: true,
            area: 'pipeline',
            command: 'gate',
            exitCode: 1,
            stderr,
        };
    }

    const governedShape = validateGovernedPhaseArtifact(gate.requires, content);
    if (!governedShape.ok) {
        return {
            handled: true,
            area: 'pipeline',
            command: 'gate',
            exitCode: 1,
            stderr:
                `[steroid-run] 🚫 GATE BLOCKED: ${gate.requires} is missing governed structure.\n` +
                `  ${governedShape.reason}\n` +
                `${friendlyHint('gate-incomplete')}\n`,
        };
    }

    const missingDesignArtifacts = getMissingDesignArtifactsForPhase(featureDir, phase, promptReceipt);
    if (missingDesignArtifacts.length > 0) {
        let stderr =
            `[steroid-run] 🚫 DESIGN GATE BLOCKED: ${phase} requires UI design artifacts for this feature.\n` +
            `  Missing: ${missingDesignArtifacts.join(', ')}\n`;
        if (!promptReceipt) {
            stderr += `  Run: node steroid-run.cjs normalize-prompt "<user prompt>" --feature ${feature} --write\n`;
        }
        stderr +=
            `  Run: node steroid-run.cjs design-route "<user prompt>" --feature ${feature} --write\n` +
            `  Run: node steroid-run.cjs design-system --feature ${feature} --write\n` +
            '  UI-intensive work must produce a routing receipt and design system before architecture or engine can proceed.\n';
        return {
            handled: true,
            area: 'pipeline',
            command: 'gate',
            exitCode: 1,
            stderr,
        };
    }

    let stdout = '';
    if (phase === 'research') {
        const designBootstrap = bootstrapFeatureDesignArtifacts(feature, featureDir, {
            source: 'gate:research',
            projectName: feature,
            rootDir: runtime.runtimeRoot,
        });
        if (!designBootstrap.ok) {
            return {
                handled: true,
                area: 'pipeline',
                command: 'gate',
                exitCode: 1,
                stderr:
                    '[steroid-run] 🚫 DESIGN PREP FAILED: research could not bootstrap UI design artifacts.\n' +
                    `  Reason: ${designBootstrap.reason}\n` +
                    `  Try: node steroid-run.cjs design-route "<user prompt>" --feature ${feature} --write\n` +
                    `  Then: node steroid-run.cjs design-system --feature ${feature} --write\n`,
            };
        }
        if (!designBootstrap.skipped) {
            const routeAction = designBootstrap.designRouteWritten ? 'wrote design-routing.json' : 'kept design-routing.json';
            const systemAction = designBootstrap.auditOnly
                ? 'skipped design-system.md (audit-only route)'
                : designBootstrap.designSystemWritten
                  ? 'wrote design-system.md'
                  : 'kept design-system.md';
            stdout += `[steroid-run] 🎨 Research prep: ${routeAction}; ${systemAction}.\n`;
        }
    }

    stdout += `[steroid-run] ✅ Gate passed: ${gate.requires} exists (${lineCount} lines). Proceeding to ${phase}.\n`;
    if (routeSummary) {
        stdout += `  Route guidance: ${routeSummary.expectedRoute} (${routeSummary.status}) — ${routeSummary.detail}\n`;
        if (routeSummary.next.phase !== 'complete' && routeSummary.next.phase !== phase) {
            stdout += `  Suggested next step: ${routeSummary.next.phase} — ${routeSummary.next.reason}\n`;
        }
    }

    const state = readStateFile(runtime.stateFile);
    appendGateAuditTrail(runtime, feature, phase, gate.requires, lineCount, content, state.error_count || 0);

    return {
        handled: true,
        area: 'pipeline',
        command: 'gate',
        exitCode: 0,
        stdout,
    };
}

function handleCommit(argv = [], context = {}) {
    const runtime = buildRuntimeContext(context);
    const message = argv.slice(1).join(' ');
    if (!message) {
        return {
            handled: true,
            area: 'pipeline',
            command: 'commit',
            exitCode: 1,
            stderr:
                '[steroid-run] Usage: npx steroid-run commit <message>\n' +
                '  Example: npx steroid-run commit "Create HabitCard component"\n',
        };
    }

    const commitMsg = `feat(steroid): ${message}`;
    const lines = [`[steroid-run] Committing: ${commitMsg}`];
    const gitDir = path.join(runtime.targetDir, '.git');
    if (!fs.existsSync(gitDir)) {
        return {
            handled: true,
            area: 'pipeline',
            command: 'commit',
            exitCode: 1,
            stdout: `${lines.join('\n')}\n`,
            stderr: `[steroid-run] ⚠️  No .git repository found.\n${friendlyHint('no-git')}\n`,
        };
    }

    const gitignorePath = path.join(runtime.targetDir, '.gitignore');
    const requiredGitignoreEntries = ['.memory/', '.steroid/', 'steroid-run.cjs', '.agents/'];
    if (fs.existsSync(gitignorePath)) {
        const content = fs.readFileSync(gitignorePath, 'utf-8');
        const missing = requiredGitignoreEntries.filter((entry) => !content.includes(entry));
        if (missing.length > 0) {
            fs.appendFileSync(
                gitignorePath,
                '\n# Steroid-Workflow (auto-restored by commit guard)\n' + missing.join('\n') + '\n',
            );
            lines.push(
                `[steroid-run] ⚠️  .gitignore was missing steroid entries. Auto-restored: ${missing.join(', ')}`,
            );
        }
    }

    const state = readStateFile(runtime.stateFile);
    const spawn = context.spawnFn || spawnSync;
    const addResult = spawn('git', ['add', '-A'], { cwd: runtime.targetDir, stdio: 'pipe', encoding: 'utf-8' });
    if (addResult.status !== 0) {
        state.error_count = (state.error_count || 0) + 1;
        state.last_error = 'git add -A failed';
        if (!Array.isArray(state.error_history)) state.error_history = [];
        state.error_history.push(`[${new Date().toISOString()}] git add failed`);
        state.status = state.error_count >= 5 ? 'tripped' : 'active';
        writeStateFile(runtime.stateFile, state);
        return {
            handled: true,
            area: 'pipeline',
            command: 'commit',
            exitCode: 1,
            stdout: `${lines.join('\n')}\n${String(addResult.stdout || '')}`,
            stderr: `[steroid-run] ❌ git add failed. ERROR ${state.error_count}/5.\n${friendlyHint('git-failed')}\n${String(addResult.stderr || '')}`,
        };
    }

    const commitResult = spawn('git', ['commit', '-m', commitMsg], {
        cwd: runtime.targetDir,
        stdio: 'pipe',
        encoding: 'utf-8',
    });
    if (commitResult.status !== 0) {
        state.error_count = (state.error_count || 0) + 1;
        state.last_error = `git commit failed: "${commitMsg}"`;
        if (!Array.isArray(state.error_history)) state.error_history = [];
        state.error_history.push(`[${new Date().toISOString()}] git commit failed: "${commitMsg}"`);
        state.status = state.error_count >= 5 ? 'tripped' : 'active';
        writeStateFile(runtime.stateFile, state);
        return {
            handled: true,
            area: 'pipeline',
            command: 'commit',
            exitCode: 1,
            stdout: `${lines.join('\n')}\n${String(commitResult.stdout || '')}`,
            stderr: `[steroid-run] ❌ git commit failed. ERROR ${state.error_count}/5.\n${friendlyHint('git-failed')}\n${String(commitResult.stderr || '')}`,
        };
    }

    state.error_count = 0;
    state.last_error = null;
    state.status = 'active';
    writeStateFile(runtime.stateFile, state);
    lines.push(`[steroid-run] ✅ Committed: ${commitMsg}`);

    return {
        handled: true,
        area: 'pipeline',
        command: 'commit',
        exitCode: 0,
        stdout: `${lines.join('\n')}\n${String(commitResult.stdout || '')}`,
        stderr: String(commitResult.stderr || ''),
    };
}

function handleLog(argv = [], context = {}) {
    const runtime = buildRuntimeContext(context);
    const feature = argv[1];
    const message = argv.slice(2).join(' ');

    if (!feature || !message) {
        return {
            handled: true,
            area: 'pipeline',
            command: 'log',
            exitCode: 1,
            stderr:
                '[steroid-run] Usage: npx steroid-run log <feature> <message>\n' +
                '  Example: npx steroid-run log habit-tracker "Implemented HabitCard component"\n',
        };
    }

    if (!fs.existsSync(runtime.progressFile)) {
        const initContent =
            `# Steroid Progress Log\nStarted: ${new Date().toISOString()}\n\n` +
            '## Codebase Patterns\n\n' +
            '[Patterns will be added here as tasks are completed]\n\n---\n';
        fs.mkdirSync(path.dirname(runtime.progressFile), { recursive: true });
        fs.writeFileSync(runtime.progressFile, initContent);
    }

    const timestamp = new Date().toISOString().replace('T', ' ').split('.')[0];
    const entry = `\n## [${timestamp}] — ${feature}: ${message}\n---\n`;
    fs.appendFileSync(runtime.progressFile, entry);

    return {
        handled: true,
        area: 'pipeline',
        command: 'log',
        exitCode: 0,
        stdout: `[steroid-run] ✅ Logged: ${message}\n`,
    };
}

function handleCheckPlan(argv = [], context = {}) {
    const runtime = buildRuntimeContext(context);
    const feature = argv[1];
    if (!feature) {
        return {
            handled: true,
            area: 'pipeline',
            command: 'check-plan',
            exitCode: 1,
            stderr: '[steroid-run] Usage: npx steroid-run check-plan <feature>\n',
        };
    }

    const featureDir = path.join(runtime.changesDir, feature);
    const planFile = path.join(featureDir, 'plan.md');
    if (!fs.existsSync(planFile)) {
        return {
            handled: true,
            area: 'pipeline',
            command: 'check-plan',
            exitCode: 1,
            stderr: `[steroid-run] ❌ No plan found at .memory/changes/${feature}/plan.md\n`,
        };
    }

    const content = fs.readFileSync(planFile, 'utf-8');
    const { total, done, remaining, percent } = parseChecklistStats(content);
    syncTasksArtifact(feature, featureDir, content);

    const lines = [
        `[steroid-run] 📊 Plan: ${done}/${total} tasks complete (${percent}%)`,
        `[steroid-run]    Tasks: .memory/changes/${feature}/tasks.md`,
    ];

    const sanitized = String(content || '').replace(/```[\s\S]*?```/g, '');
    const p1 = (sanitized.match(/^- \[[ x]\] (?:\[P\] )?P1:/gm) || []).length;
    const p1Done = (sanitized.match(/^- \[x\] (?:\[P\] )?P1:/gm) || []).length;
    if (p1 > 0) {
        lines.push(`[steroid-run]    P1: ${p1Done}/${p1} | P2/P3: ${done - p1Done}/${total - p1}`);
        if (p1Done < p1) {
            lines.push(
                `[steroid-run] ⚠️  ${p1 - p1Done} P1 (foundational) stories remaining. Complete these first.`,
            );
        }
    }

    if (remaining === 0 && total > 0) {
        saveExecutionReceipt(featureDir, {
            feature,
            status: 'COMPLETE',
            consumedArtifacts: ['plan.md', 'tasks.md'],
            summary: 'Execution checklist is fully complete and ready for verification.',
        });
        lines.push('[steroid-run] ✅ All tasks complete! Ready to verify.');
        lines.push(`[steroid-run]    Execution receipt: .memory/changes/${feature}/execution.json`);
        return {
            handled: true,
            area: 'pipeline',
            command: 'check-plan',
            exitCode: 0,
            stdout: `${lines.join('\n')}\n`,
        };
    }

    lines.push(`[steroid-run] ⏳ ${remaining} tasks remaining.`);
    return {
        handled: true,
        area: 'pipeline',
        command: 'check-plan',
        exitCode: 1,
        stdout: `${lines.join('\n')}\n`,
    };
}

function handleStories(argv = [], context = {}) {
    const runtime = buildRuntimeContext(context);
    const feature = argv[1];
    const sub = argv[2];

    if (!feature) {
        return {
            handled: true,
            area: 'pipeline',
            command: 'stories',
            exitCode: 1,
            stderr: '[steroid-run] Usage: npx steroid-run stories <feature> [next|list]\n',
        };
    }

    const planFile = path.join(runtime.changesDir, feature, 'plan.md');
    if (!fs.existsSync(planFile)) {
        return {
            handled: true,
            area: 'pipeline',
            command: 'stories',
            exitCode: 1,
            stderr: `[steroid-run] ❌ No plan found at .memory/changes/${feature}/plan.md\n`,
        };
    }

    const content = fs.readFileSync(planFile, 'utf-8');
    const stories = parseStories(content);

    if (stories.length === 0) {
        const total = (content.match(/- \[[ x/]\]/g) || []).length;
        const done = (content.match(/- \[x\]/g) || []).length;
        return {
            handled: true,
            area: 'pipeline',
            command: 'stories',
            exitCode: 0,
            stdout:
                '[steroid-run] ⚠️  No stories found in plan.md. Use format: - [ ] P1: Story title\n' +
                '  Stories without priority markers are treated as P2.\n' +
                `  (Plain tasks: ${done}/${total} complete)\n`,
        };
    }

    if (!sub || sub === 'list') {
        const p1 = stories.filter((story) => story.priority === 'P1');
        const p2 = stories.filter((story) => story.priority === 'P2');
        const p3 = stories.filter((story) => story.priority === 'P3');
        const lines = ['', `[steroid-run] 📋 Stories for "${feature}"`, ''];

        const renderGroup = (label, group) => {
            if (group.length === 0) return;
            lines.push(`  ${label}:`);
            for (const story of group) {
                const icon = story.status === 'done' ? '✅' : story.status === 'in-progress' ? '🔄' : '⬜';
                const parallel = story.parallel ? ' [P]' : '';
                lines.push(`    ${icon} #${story.index} ${story.title}${parallel}`);
            }
            lines.push('');
        };

        renderGroup('🔴 P1 — Must Have (MVP)', p1);
        renderGroup('🟡 P2 — Should Have', p2);
        renderGroup('🟢 P3 — Nice to Have', p3);

        const doneCount = stories.filter((story) => story.status === 'done').length;
        lines.push(`  Progress: ${doneCount}/${stories.length} stories complete`);

        const p1Incomplete = p1.filter((story) => story.status !== 'done');
        if (p1Incomplete.length > 0) {
            lines.push('');
            lines.push(`  ⚠️  FOUNDATIONAL BLOCK: ${p1Incomplete.length} P1 stories incomplete.`);
            lines.push('  Complete all P1 stories before starting P2/P3 work.');
        }

        return {
            handled: true,
            area: 'pipeline',
            command: 'stories',
            exitCode: 0,
            stdout: `${lines.join('\n')}\n`,
        };
    }

    if (sub === 'next') {
        const p1Todo = stories.filter((story) => story.priority === 'P1' && story.status === 'todo');
        const p2Todo = stories.filter((story) => story.priority === 'P2' && story.status === 'todo');
        const p3Todo = stories.filter((story) => story.priority === 'P3' && story.status === 'todo');
        const p1Incomplete = stories.filter((story) => story.priority === 'P1' && story.status !== 'done');

        if (p1Incomplete.length > 0 && p1Todo.length > 0) {
            return {
                handled: true,
                area: 'pipeline',
                command: 'stories',
                exitCode: 0,
                stdout: `[steroid-run] 🎯 Next story: #${p1Todo[0].index} ${p1Todo[0].title} (P1 — foundational)\n`,
            };
        }

        if (p1Incomplete.length > 0 && p1Todo.length === 0) {
            const inProgress = p1Incomplete.filter((story) => story.status === 'in-progress');
            if (inProgress.length > 0) {
                return {
                    handled: true,
                    area: 'pipeline',
                    command: 'stories',
                    exitCode: 0,
                    stdout:
                        `[steroid-run] ⏳ P1 story in progress: #${inProgress[0].index} ${inProgress[0].title}\n` +
                        '  Complete this before moving to the next story.\n',
                };
            }
        }

        const next = p2Todo[0] || p3Todo[0];
        return {
            handled: true,
            area: 'pipeline',
            command: 'stories',
            exitCode: 0,
            stdout: next
                ? `[steroid-run] 🎯 Next story: #${next.index} ${next.title} (${next.priority})\n`
                : '[steroid-run] ✅ All stories complete!\n',
        };
    }

    return {
        handled: true,
        area: 'pipeline',
        command: 'stories',
        exitCode: 1,
        stderr: `[steroid-run] ❌ Unknown stories subcommand: "${sub}". Use: list, next\n`,
    };
}

function handleSmokeTest(context = {}) {
    const runtime = buildRuntimeContext(context);
    const spawn = context.spawnFn || spawnSync;
    const lines = ['[steroid-run] 🔍 Running smoke test...'];
    const pkgPath = path.join(runtime.targetDir, 'package.json');

    if (fs.existsSync(pkgPath)) {
        try {
            const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
            if (pkg.scripts && pkg.scripts.build) {
                lines.push('[steroid-run]   Stack: Node.js (build script detected)');
                const build = spawn('npm', ['run', 'build'], {
                    cwd: runtime.targetDir,
                    stdio: 'pipe',
                    timeout: 60000,
                    shell: true,
                    encoding: 'utf-8',
                });
                if (build.status === 0) {
                    lines.push('[steroid-run] ✅ Smoke test PASSED: build succeeded.');
                    return {
                        handled: true,
                        area: 'pipeline',
                        command: 'smoke-test',
                        exitCode: 0,
                        stdout: `${lines.join('\n')}\n`,
                    };
                }

                const errOutput = String(build.stderr || build.stdout || '')
                    .trim()
                    .split('\n')
                    .slice(-8)
                    .join('\n');
                const state = readStateFile(runtime.stateFile);
                state.error_count = (state.error_count || 0) + 1;
                state.last_error = 'smoke-test: build failed';
                if (!Array.isArray(state.error_history)) state.error_history = [];
                state.error_history.push(`[${new Date().toISOString()}] smoke-test: build failed`);
                state.status = state.error_count >= 5 ? 'tripped' : 'active';
                writeStateFile(runtime.stateFile, state);
                return {
                    handled: true,
                    area: 'pipeline',
                    command: 'smoke-test',
                    exitCode: 1,
                    stdout: `${lines.join('\n')}\n`,
                    stderr: `[steroid-run] ❌ Smoke test FAILED: build error.\n${errOutput}\n`,
                };
            }

            const tsConfig = path.join(runtime.targetDir, 'tsconfig.json');
            if (fs.existsSync(tsConfig)) {
                lines.push('[steroid-run]   Stack: TypeScript (no build script, using tsc --noEmit)');
                const tsc = spawn('npx', ['tsc', '--noEmit'], {
                    cwd: runtime.targetDir,
                    stdio: 'pipe',
                    timeout: 60000,
                    shell: true,
                    encoding: 'utf-8',
                });
                if (tsc.status === 0) {
                    lines.push('[steroid-run] ✅ Smoke test PASSED: type check succeeded.');
                    return {
                        handled: true,
                        area: 'pipeline',
                        command: 'smoke-test',
                        exitCode: 0,
                        stdout: `${lines.join('\n')}\n`,
                    };
                }

                const errOutput = String(tsc.stdout || '')
                    .trim()
                    .split('\n')
                    .slice(-8)
                    .join('\n');
                return {
                    handled: true,
                    area: 'pipeline',
                    command: 'smoke-test',
                    exitCode: 1,
                    stdout: `${lines.join('\n')}\n`,
                    stderr: `[steroid-run] ❌ Smoke test FAILED: type errors found.\n${errOutput}\n`,
                };
            }

            lines.push('[steroid-run] ⏭️  No build script or tsconfig.json. Smoke test skipped.');
            return {
                handled: true,
                area: 'pipeline',
                command: 'smoke-test',
                exitCode: 0,
                stdout: `${lines.join('\n')}\n`,
            };
        } catch (error) {
            return {
                handled: true,
                area: 'pipeline',
                command: 'smoke-test',
                exitCode: 1,
                stdout: `${lines.join('\n')}\n`,
                stderr: `[steroid-run] ❌ Smoke test error: ${error.message}\n`,
            };
        }
    }

    const altStacks = [
        { file: 'Cargo.toml', cmd: 'cargo', args: ['check'], name: 'Rust' },
        { file: 'go.mod', cmd: 'go', args: ['build', './...'], name: 'Go' },
    ];
    for (const alt of altStacks) {
        if (fs.existsSync(path.join(runtime.targetDir, alt.file))) {
            lines.push(`[steroid-run]   Stack: ${alt.name}`);
            const check = spawn(alt.cmd, alt.args, {
                cwd: runtime.targetDir,
                stdio: 'pipe',
                timeout: 120000,
                encoding: 'utf-8',
            });
            if (check.status === 0) {
                lines.push(`[steroid-run] ✅ Smoke test PASSED: ${alt.cmd} ${alt.args.join(' ')} succeeded.`);
                return {
                    handled: true,
                    area: 'pipeline',
                    command: 'smoke-test',
                    exitCode: 0,
                    stdout: `${lines.join('\n')}\n`,
                };
            }
            return {
                handled: true,
                area: 'pipeline',
                command: 'smoke-test',
                exitCode: 1,
                stdout: `${lines.join('\n')}\n`,
                stderr: `[steroid-run] ❌ Smoke test FAILED: ${alt.cmd} check failed.\n`,
            };
        }
    }

    lines.push('[steroid-run] ⏭️  No recognized project file. Smoke test skipped.');
    return {
        handled: true,
        area: 'pipeline',
        command: 'smoke-test',
        exitCode: 0,
        stdout: `${lines.join('\n')}\n`,
    };
}

function handleArchive(argv = [], context = {}) {
    const runtime = buildRuntimeContext(context);
    const state = readStateFile(runtime.stateFile);
    const feature = argv[1];
    const force = argv.includes('--force');
    const forceUi = argv.includes('--force-ui');

    if (!feature) {
        return {
            handled: true,
            area: 'pipeline',
            command: 'archive',
            exitCode: 1,
            stderr: '[steroid-run] Usage: npx steroid-run archive <feature>\n',
        };
    }

    const featureDir = path.join(runtime.changesDir, feature);
    const archiveDir = path.join(featureDir, 'archive');
    if (!fs.existsSync(featureDir)) {
        return {
            handled: true,
            area: 'pipeline',
            command: 'archive',
            exitCode: 1,
            stderr: `[steroid-run] ❌ Feature "${feature}" not found at .memory/changes/${feature}/\n`,
        };
    }

    const verifyReceipt = loadVerifyReceipt(feature, featureDir);
    if (verifyReceipt.status) {
        if (!['PASS', 'CONDITIONAL'].includes(verifyReceipt.status)) {
            return {
                handled: true,
                area: 'pipeline',
                command: 'archive',
                exitCode: 1,
                stderr:
                    `[steroid-run] 🚫 ARCHIVE BLOCKED: verify.json status is ${verifyReceipt.status}.\n` +
                    `  Run verification first: node steroid-run.cjs verify-feature ${feature}\n`,
            };
        }
    } else if (!force) {
        return {
            handled: true,
            area: 'pipeline',
            command: 'archive',
            exitCode: 1,
            stderr:
                '[steroid-run] 🚫 ARCHIVE BLOCKED: No verify.json receipt found.\n' +
                '  Features must be verified before archiving.\n' +
                `  Run: node steroid-run.cjs verify-feature ${feature}\n`,
        };
    }

    const lines = [];
    if (!verifyReceipt.status && force) {
        lines.push('[steroid-run] ⚠️  --force flag used. Archiving without verification.');
    }

    if (!force) {
        const completionReceipt = loadCompletionReceipt(feature, featureDir);
        if (!completionReceipt.status) {
            return {
                handled: true,
                area: 'pipeline',
                command: 'archive',
                exitCode: 1,
                stderr:
                    '[steroid-run] 🚫 ARCHIVE BLOCKED: No completion.json receipt found.\n' +
                    `  Run: node steroid-run.cjs verify-feature ${feature}\n`,
            };
        }
        if (completionReceipt.status !== verifyReceipt.status) {
            return {
                handled: true,
                area: 'pipeline',
                command: 'archive',
                exitCode: 1,
                stderr:
                    `[steroid-run] 🚫 ARCHIVE BLOCKED: completion.json status ${completionReceipt.status} does not match verify.json status ${verifyReceipt.status}.\n` +
                    `  Run: node steroid-run.cjs verify-feature ${feature}\n`,
            };
        }
    }

    const uiReviewRefresh = refreshUiReviewArtifacts(feature, featureDir, {
        verifyStatus: verifyReceipt.status || 'PENDING',
        deepMode: !!verifyReceipt.deepRequested,
        refreshSource: 'archive',
    });
    if (uiReviewRefresh.attempted && uiReviewRefresh.refreshed) {
        lines.push(`[steroid-run] 🔄 Refreshed UI review before archive: ${uiReviewRefresh.reason}`);
    }

    const uiReviewReceipt = uiReviewRefresh.receipt || loadUiReviewReceipt(feature, featureDir);
    const uiArchivePolicy = buildUiArchivePolicy(uiReviewReceipt, {
        deepRequested: !!verifyReceipt.deepRequested,
    });
    if (uiArchivePolicy.decision === 'BLOCK') {
        return {
            handled: true,
            area: 'pipeline',
            command: 'archive',
            exitCode: 1,
            stdout: lines.length ? `${lines.join('\n')}\n` : '',
            stderr:
                '[steroid-run] 🚫 ARCHIVE BLOCKED: ui-review.json status is FAIL.\n' +
                '  Frontend quality issues still need resolution before archiving this UI feature.\n' +
                `  Run: node steroid-run.cjs verify-feature ${feature}${uiReviewReceipt?.previewTarget ? ` --deep --url ${uiReviewReceipt.previewTarget}` : ''}\n`,
        };
    }
    if (uiArchivePolicy.decision === 'BLOCK_CONDITIONAL') {
        if (!forceUi) {
            let stderr =
                '[steroid-run] 🚫 ARCHIVE BLOCKED: ui-review.json is CONDITIONAL with blocking frontend issues.\n';
            for (const reason of uiArchivePolicy.blockReasons) {
                stderr += `  - ${reason}\n`;
            }
            stderr += `  Override only if you accept the frontend risk: node steroid-run.cjs archive ${feature} --force-ui\n`;
            return {
                handled: true,
                area: 'pipeline',
                command: 'archive',
                exitCode: 1,
                stdout: lines.length ? `${lines.join('\n')}\n` : '',
                stderr,
            };
        }
        lines.push('[steroid-run] ⚠️  --force-ui override used. Archiving with blocking frontend cautions.');
        for (const reason of uiArchivePolicy.blockReasons) {
            lines.push(`  - ${reason}`);
        }
    } else if (uiArchivePolicy.decision === 'WARN_CONDITIONAL') {
        lines.push('[steroid-run] ⚠️  Frontend review is CONDITIONAL. Archive may proceed with caution.');
        for (const reason of uiArchivePolicy.warnReasons) {
            lines.push(`  - ${reason}`);
        }
    }

    fs.mkdirSync(archiveDir, { recursive: true });
    const archiveStamp = createArchiveStamp();
    const filesToArchive = [
        'context.md',
        'request.json',
        'prompt.json',
        'prompt.md',
        'vibe.md',
        'spec.md',
        'research.md',
        'plan.md',
        'tasks.md',
        'execution.json',
        'verify.md',
        'verify.json',
        'completion.json',
        'ui-review.md',
        'ui-review.json',
        'diagnosis.md',
        'review.md',
        'review.json',
    ];
    let archived = 0;
    for (const file of filesToArchive) {
        const src = path.join(featureDir, file);
        if (!fs.existsSync(src)) continue;
        const dest = getArchiveDestinationPath(archiveDir, archiveStamp, file, (candidate) => fs.existsSync(candidate));
        fs.copyFileSync(src, dest);
        fs.unlinkSync(src);
        archived++;
    }

    lines.push(`[steroid-run] ✅ Archived ${archived} files to .memory/changes/${feature}/archive/`);
    lines.push(`[steroid-run] 🎉 Feature "${feature}" archived. Ready for next build.`);

    fs.mkdirSync(runtime.metricsDir, { recursive: true });
    const featuresFile = path.join(runtime.metricsDir, 'features.json');
    let featuresData = {};
    if (fs.existsSync(featuresFile)) {
        try {
            featuresData = JSON.parse(fs.readFileSync(featuresFile, 'utf-8'));
        } catch {
            featuresData = {};
        }
    }
    featuresData[feature] = {
        archived: new Date().toISOString(),
        filesArchived: archived,
        errorCount: state.error_count || 0,
        status: 'complete',
        uiReviewStatus: uiReviewReceipt?.status || null,
        uiReviewFindings: Array.isArray(uiReviewReceipt?.findings) ? uiReviewReceipt.findings.length : 0,
        uiReviewRefreshSource: uiReviewReceipt?.freshness?.source || null,
        uiReviewGeneratedAt: uiReviewReceipt?.generatedAt || null,
        uiReviewRecommendation: uiArchivePolicy.recommendation || null,
        uiReviewOverrideUsed: forceUi,
    };
    featuresData._lastUpdated = new Date().toISOString();
    fs.writeFileSync(featuresFile, JSON.stringify(featuresData, null, 2));
    lines.push(`[steroid-run]    Metrics: feature "${feature}" recorded in features.json`);

    fs.mkdirSync(runtime.reportsDir, { recursive: true });
    const report = generateHandoffReportContent({
        feature,
        version: runtime.version,
        archived: true,
        specContent: readOptionalArchivedArtifact(featureDir, 'spec.md'),
        promptReceiptContent: readOptionalArchivedArtifact(featureDir, 'prompt.json'),
        verifyContent: readOptionalArchivedArtifact(featureDir, 'verify.md'),
        verifyReceipt,
        planContent: readOptionalArchivedArtifact(featureDir, 'plan.md'),
        reviewContent: readOptionalArchivedArtifact(featureDir, 'review.md'),
        uiReviewReceipt,
        state,
    });
    const reportFilePath = path.join(runtime.reportsDir, `${feature}.md`);
    fs.writeFileSync(reportFilePath, report);
    lines.push(`[steroid-run]    Report: .memory/reports/${feature}.md`);

    return {
        handled: true,
        area: 'pipeline',
        command: 'archive',
        exitCode: 0,
        stdout: `${lines.join('\n')}\n`,
    };
}

function readOptionalArchivedArtifact(featureDir, name) {
    const activePath = path.join(featureDir, name);
    if (fs.existsSync(activePath)) {
        return fs.readFileSync(activePath, 'utf-8');
    }

    const archiveDir = path.join(featureDir, 'archive');
    if (!fs.existsSync(archiveDir)) return null;
    const archived = fs
        .readdirSync(archiveDir)
        .filter((fileName) => fileName.endsWith(name))
        .sort();
    if (archived.length === 0) return null;
    return fs.readFileSync(path.join(archiveDir, archived[archived.length - 1]), 'utf-8');
}

function handleGitInit(context = {}) {
    const runtime = buildRuntimeContext(context);
    const spawn = context.spawnFn || spawnSync;
    if (fs.existsSync(path.join(runtime.targetDir, '.git'))) {
        return {
            handled: true,
            area: 'pipeline',
            command: 'git-init',
            exitCode: 0,
            stdout: '[steroid-run] ⏭️  Git already initialized. Skipping.\n',
        };
    }

    const lines = ['[steroid-run] Initializing git repository...'];
    const init = spawn('git', ['init'], {
        cwd: runtime.targetDir,
        stdio: 'pipe',
        encoding: 'utf-8',
    });
    if (init.status !== 0) {
        return {
            handled: true,
            area: 'pipeline',
            command: 'git-init',
            exitCode: 1,
            stdout: `${lines.join('\n')}\n${String(init.stdout || '')}`,
            stderr: `[steroid-run] ❌ git init failed.\n${String(init.stderr || '')}`,
        };
    }

    const add = spawn('git', ['add', '-A'], {
        cwd: runtime.targetDir,
        stdio: 'pipe',
        encoding: 'utf-8',
    });
    if (add.status !== 0) {
        return {
            handled: true,
            area: 'pipeline',
            command: 'git-init',
            exitCode: 1,
            stdout: `${lines.join('\n')}\n${String(init.stdout || '')}${String(add.stdout || '')}`,
            stderr: `[steroid-run] ❌ git add -A failed.\n${String(add.stderr || '')}`,
        };
    }

    const commit = spawn('git', ['commit', '-m', 'feat(steroid): initial scaffold checkpoint'], {
        cwd: runtime.targetDir,
        stdio: 'pipe',
        encoding: 'utf-8',
    });
    if (commit.status !== 0) {
        return {
            handled: true,
            area: 'pipeline',
            command: 'git-init',
            exitCode: 1,
            stdout:
                `${lines.join('\n')}\n` +
                `${String(init.stdout || '')}${String(add.stdout || '')}${String(commit.stdout || '')}`,
            stderr: `[steroid-run] ❌ git commit failed.\n${String(commit.stderr || '')}`,
        };
    }

    lines.push('[steroid-run] ✅ Git initialized with scaffold checkpoint.');
    return {
        handled: true,
        area: 'pipeline',
        command: 'git-init',
        exitCode: 0,
        stdout: `${lines.join('\n')}\n${String(init.stdout || '')}${String(add.stdout || '')}${String(commit.stdout || '')}`,
        stderr: `${String(init.stderr || '')}${String(add.stderr || '')}${String(commit.stderr || '')}`,
    };
}

function handlePipelineStatus(argv = [], context = {}) {
    const runtime = buildRuntimeContext(context);
    const feature = argv[1];
    if (!feature) {
        return {
            handled: true,
            area: 'pipeline',
            command: 'pipeline-status',
            exitCode: 1,
            stderr: '[steroid-run] Usage: npx steroid-run pipeline-status <feature>\n',
        };
    }

    const featureDir = path.join(runtime.changesDir, feature);
    if (!fs.existsSync(featureDir)) {
        return {
            handled: true,
            area: 'pipeline',
            command: 'pipeline-status',
            exitCode: 1,
            stderr: `[steroid-run] ❌ Feature "${feature}" not found.\n`,
        };
    }

    let promptReceipt = null;
    try {
        promptReceipt = JSON.parse(fs.readFileSync(path.join(featureDir, 'prompt.json'), 'utf-8'));
    } catch {
        promptReceipt = null;
    }

    return {
        handled: true,
        area: 'pipeline',
        command: 'pipeline-status',
        exitCode: 0,
        stdout: formatPipelineStatus(feature, featureDir, promptReceipt),
    };
}

function handleVerify(argv = [], context = {}) {
    const runtime = buildRuntimeContext(context);
    const targetFile = argv[1];
    const minLinesArg = argv.find((arg) => arg.startsWith('--min-lines='));

    if (!targetFile || !minLinesArg) {
        return {
            handled: true,
            area: 'pipeline',
            command: 'verify',
            exitCode: 1,
            stderr: 'Usage: node steroid-run.cjs verify <file> --min-lines=<number>\n',
        };
    }

    const minLines = parseInt(minLinesArg.split('=')[1], 10);
    const fullPath = resolvePathWithinRoot(runtime.targetDir, targetFile, { mustExist: true });
    if (!fullPath) {
        return {
            handled: true,
            area: 'pipeline',
            command: 'verify',
            exitCode: 1,
            stderr: '[STEROID-VERIFY ERROR]: File path must stay inside the current project root.\n',
        };
    }

    if (!fs.existsSync(fullPath)) {
        return {
            handled: true,
            area: 'pipeline',
            command: 'verify',
            exitCode: 1,
            stderr: `[STEROID-VERIFY ERROR]: File does not exist at ${fullPath}\n`,
        };
    }

    const content = fs.readFileSync(fullPath, 'utf-8');
    const lineCount = content.split('\n').length;

    if (lineCount < minLines) {
        return {
            handled: true,
            area: 'pipeline',
            command: 'verify',
            exitCode: 1,
            stderr:
                `\n[STEROID-VERIFY ERROR] 🛑 AI SHORTCUT DETECTED 🛑\n` +
                `File ${targetFile} has ${lineCount} lines, but requires at least ${minLines} lines.\n` +
                'Do not summarize code. You MUST write the full implementation.\n',
        };
    }

    return {
        handled: true,
        area: 'pipeline',
        command: 'verify',
        exitCode: 0,
        stdout: `[STEROID-VERIFY SUCCESS] ✅ File passes validation (${lineCount} lines >= ${minLines} required).\n`,
    };
}

function parseRunInvocation(argv = [], context = {}) {
    const runtime = buildRuntimeContext(context);
    let executionCwd = runtime.targetDir;
    let cwdProvided = false;
    const executionArgs = [];

    for (const arg of argv.slice(1)) {
        if (arg.startsWith('--cwd=')) {
            const requestedCwd = arg.slice('--cwd='.length);
            if (!requestedCwd) {
                return {
                    ok: false,
                    stderr: "[steroid-run] Usage: node steroid-run.cjs run --cwd=<path> '<command>'\n",
                };
            }
            executionCwd = resolvePathWithinRoot(runtime.targetDir, requestedCwd, { mustExist: true });
            cwdProvided = true;
        } else {
            executionArgs.push(arg);
        }
    }

    if (!cwdProvided || executionArgs.length === 0) {
        return {
            ok: false,
            stderr: "[steroid-run] Usage: node steroid-run.cjs run --cwd=<path> '<command>'\n",
        };
    }
    if (!executionCwd) {
        return {
            ok: false,
            stderr: '[steroid-run] 🚫 SAFETY: --cwd must stay inside the current project root.\n',
        };
    }
    if (!fs.existsSync(executionCwd) || !fs.statSync(executionCwd).isDirectory()) {
        return {
            ok: false,
            stderr: `[steroid-run] ❌ Working directory does not exist: ${path.relative(runtime.targetDir, executionCwd)}\n`,
        };
    }

    return {
        ok: true,
        runtime,
        executionCwd,
        executionArgs,
        commandStr: executionArgs.join(' '),
    };
}

function handleRun(argv = [], context = {}) {
    const parsed = parseRunInvocation(argv, context);
    if (!parsed.ok) {
        return {
            handled: true,
            area: 'pipeline',
            command: 'run',
            exitCode: 1,
            stderr: parsed.stderr,
        };
    }

    const { runtime, executionCwd, executionArgs, commandStr } = parsed;
    const normalizedCommandStr = stripWrappingQuotes(commandStr.trim());
    const blockedSyntax = findBlockedShellSyntax(normalizedCommandStr);
    if (blockedSyntax) {
        return {
            handled: true,
            area: 'pipeline',
            command: 'run',
            exitCode: 1,
            stderr:
                `\n[STEROID-COMMAND-GUARD] 🛑 BLOCKED: Shell control syntax "${blockedSyntax}" is not allowed.\n` +
                '  Run one command at a time through the circuit breaker.\n' +
                '  For multi-step work, execute separate steroid-run commands.\n',
        };
    }

    let commandTokens = [];
    try {
        commandTokens = tokenizeCommand(commandStr);
    } catch (error) {
        return {
            handled: true,
            area: 'pipeline',
            command: 'run',
            exitCode: 1,
            stderr: `\n[STEROID-COMMAND-GUARD] 🛑 BLOCKED: ${error.message}\n`,
        };
    }

    const baseCommand = (commandTokens[0] || '').replace(/^['"]|['"]$/g, '').toLowerCase();
    if (!ALLOWED_COMMANDS.has(baseCommand)) {
        return {
            handled: true,
            area: 'pipeline',
            command: 'run',
            exitCode: 1,
            stderr:
                `\n[STEROID-COMMAND-GUARD] 🛑 BLOCKED: Unknown command "${baseCommand}"\n` +
                '  Only known development commands are allowed through the circuit breaker.\n' +
                `  Allowed: ${[...ALLOWED_COMMANDS].sort().join(', ')}\n`,
        };
    }

    const validatedCommand = validateExecutionCommandTokens(commandTokens, {
        resolvePath: (candidate, options = {}) => resolvePathWithinRoot(runtime.targetDir, candidate, options),
    });
    if (!validatedCommand.ok) {
        return {
            handled: true,
            area: 'pipeline',
            command: 'run',
            exitCode: 1,
            stderr: `\n${validatedCommand.message}\n`,
        };
    }

    const state = readStateFile(runtime.stateFile);
    const executionLabel = path.relative(runtime.targetDir, executionCwd) || '.';
    const spawnFn = context.spawnFn || spawnSync;
    const child = spawnFn(commandTokens[0], commandTokens.slice(1), {
        cwd: executionCwd,
        shell: false,
        stdio: 'pipe',
        encoding: 'utf-8',
    });

    const prefix = `[steroid-run] Executing${executionLabel === '.' ? '' : ` in ${executionLabel}`}: ${commandStr}\n`;
    const childStdout = typeof child.stdout === 'string' ? child.stdout : String(child.stdout || '');
    const childStderr = typeof child.stderr === 'string' ? child.stderr : String(child.stderr || '');

    if (child.error) {
        state.error_count = (state.error_count || 0) + 1;
        state.last_error = `Command failed in "${executionLabel}": "${commandStr}" (${child.error.message})`;
        if (!state.error_history) state.error_history = [];
        state.error_history.push(`[${new Date().toISOString()}] ${state.last_error}`);
        if (!state.recovery_actions) state.recovery_actions = [];
        state.status = state.error_count >= 5 ? 'tripped' : 'active';
        writeStateFile(runtime.stateFile, state);
        return {
            handled: true,
            area: 'pipeline',
            command: 'run',
            exitCode: typeof child.status === 'number' ? child.status : 1,
            stdout: prefix + childStdout,
            stderr: `\n[steroid-run] ❌ Failed to execute "${baseCommand}": ${child.error.message}\n${childStderr}`,
        };
    }

    if (child.status !== 0) {
        state.error_count = (state.error_count || 0) + 1;
        state.last_error = `Command failed in "${executionLabel}": "${commandStr}" (exit code ${child.status})`;
        if (!state.error_history) state.error_history = [];
        state.error_history.push(`[${new Date().toISOString()}] ${state.last_error}`);
        if (!state.recovery_actions) state.recovery_actions = [];
        state.status = state.error_count >= 5 ? 'tripped' : 'active';
        writeStateFile(runtime.stateFile, state);
        return {
            handled: true,
            area: 'pipeline',
            command: 'run',
            exitCode: child.status,
            stdout: prefix + childStdout,
            stderr:
                childStderr +
                `\n[steroid-run] ❌ ERROR ${state.error_count}/5. ` +
                ({
                    1: 'Try a different approach. Run: node steroid-run.cjs recover',
                    2: 'Re-read your plan. Run: node steroid-run.cjs recover',
                    3: 'Self-diagnosing... Run: node steroid-run.cjs recover',
                    4: '⚠️ STOP and present errors to user. Run: node steroid-run.cjs recover',
                    5: 'CIRCUIT BREAKER TRIPPED. Run "node steroid-run.cjs reset" to resume.',
                }[Math.min(state.error_count, 5)] || '') +
                '\n',
        };
    }

    state.error_count = 0;
    state.last_error = null;
    state.status = 'active';
    writeStateFile(runtime.stateFile, state);
    return {
        handled: true,
        area: 'pipeline',
        command: 'run',
        exitCode: 0,
        stdout: prefix + childStdout,
        stderr: childStderr,
    };
}

function handleNormalizePrompt(argv = [], context = {}) {
    const runtime = buildRuntimeContext(context);
    const featureFlagIndex = argv.indexOf('--feature');
    const feature = featureFlagIndex !== -1 ? argv[featureFlagIndex + 1] : null;
    const controlArgs = new Set(['--json', '--write', '--feature']);
    if (feature) controlArgs.add(feature);
    const message = argv
        .slice(1)
        .filter((arg, index) => !(featureFlagIndex !== -1 && index + 1 === featureFlagIndex) && !controlArgs.has(arg))
        .join(' ');

    if (!message) {
        return {
            handled: true,
            area: 'pipeline',
            command: 'normalize-prompt',
            exitCode: 1,
            stderr:
                '[steroid-run] Usage: npx steroid-run normalize-prompt "<user message>" [--json] [--feature <feature> --write]\n',
        };
    }

    const sessionState = inspectPromptSessionState(runtime.targetDir);
    const analysis = analyzePrompt(message, sessionState);

    if (argv.includes('--write')) {
        if (!feature) {
            return {
                handled: true,
                area: 'pipeline',
                command: 'normalize-prompt',
                exitCode: 1,
                stderr: '[steroid-run] ❌ --write requires --feature <feature>.\n',
            };
        }
        const featureDir = path.join(runtime.targetDir, '.memory', 'changes', feature);
        if (!fs.existsSync(featureDir)) {
            return {
                handled: true,
                area: 'pipeline',
                command: 'normalize-prompt',
                exitCode: 1,
                stderr: `[steroid-run] ❌ Feature "${feature}" not found. Run: npx steroid-run init-feature ${feature}\n`,
            };
        }
        writeJsonFile(path.join(featureDir, 'prompt.json'), {
            ...analysis,
            sessionState,
            source: 'normalize-prompt',
            updatedAt: new Date().toISOString(),
        });
        fs.writeFileSync(path.join(featureDir, 'prompt.md'), formatPromptMarkdown(feature, analysis, sessionState));
    }

    if (argv.includes('--json')) {
        return {
            handled: true,
            area: 'pipeline',
            command: 'normalize-prompt',
            exitCode: 0,
            stdout: `${JSON.stringify({ ...analysis, sessionState }, null, 2)}\n`,
        };
    }

    const lines = [
        '[steroid-run] 🧠 Prompt Intelligence',
        `  Summary: ${analysis.normalizedSummary}`,
        `  Primary intent: ${analysis.primaryIntent}`,
    ];
    if (analysis.secondaryIntents.length > 0) {
        lines.push(`  Secondary intents: ${analysis.secondaryIntents.join(', ')}`);
    }
    lines.push(`  Continuation: ${analysis.continuationState}`);
    lines.push(`  Complexity: ${analysis.complexity}`);
    lines.push(`  Ambiguity: ${analysis.ambiguity}`);
    lines.push(`  Recommended route: ${analysis.recommendedPipeline}`);
    lines.push(`  Pipeline hint: ${analysis.pipelineHint}`);
    if (analysis.assumptions.length > 0) {
        lines.push(`  Assumptions: ${analysis.assumptions.join(' | ')}`);
    }
    if (analysis.unresolvedQuestions.length > 0) {
        lines.push(`  Unresolved: ${analysis.unresolvedQuestions.join(' | ')}`);
    }
    if (analysis.splitRecommended) {
        lines.push(`  Suggested split: ${analysis.suggestedFeatures.join(' || ')}`);
    }
    if (argv.includes('--write')) {
        lines.push(`  Receipt: .memory/changes/${feature}/prompt.json`);
        lines.push(`  Brief: .memory/changes/${feature}/prompt.md`);
    }

    return {
        handled: true,
        area: 'pipeline',
        command: 'normalize-prompt',
        exitCode: 0,
        stdout: `${lines.join('\n')}\n`,
    };
}

function handleDetectIntent(argv = [], context = {}) {
    const message = argv.filter((arg, index) => index > 0 && arg !== '--verbose').join(' ');
    if (!message) {
        return {
            handled: true,
            area: 'pipeline',
            command: 'detect-intent',
            exitCode: 1,
            stderr:
                '[steroid-run] Usage: npx steroid-run detect-intent "<user message>"\n' +
                '  Example: npx steroid-run detect-intent "fix the login bug"\n',
        };
    }

    const runtime = buildRuntimeContext(context);
    const analysis = analyzePrompt(message, inspectPromptSessionState(runtime.targetDir));
    const lines = [analysis.primaryIntent];

    if (argv.includes('--verbose')) {
        lines.push(`[steroid-run] Intent: ${analysis.primaryIntent} (confidence: ${analysis.confidence})`);
        if (analysis.secondaryIntents.length > 0) {
            lines.push(`[steroid-run] Secondary: ${analysis.secondaryIntents.join(', ')}`);
        }
        lines.push(`[steroid-run] Ambiguity: ${analysis.ambiguity}`);
        lines.push(`[steroid-run] Complexity: ${analysis.complexity}`);
        lines.push(`[steroid-run] Continuation: ${analysis.continuationState}`);
        lines.push(`[steroid-run] Route: ${analysis.recommendedPipeline}`);
        lines.push(`[steroid-run] Pipeline: ${analysis.pipelineHint}`);
        if (analysis.splitRecommended) {
            lines.push('[steroid-run] Split suggested: yes');
        }
    }

    return {
        handled: true,
        area: 'pipeline',
        command: 'detect-intent',
        exitCode: 0,
        stdout: `${lines.join('\n')}\n`,
    };
}

function handleDetectTests(context = {}) {
    const runtime = buildRuntimeContext(context);
    const lines = ['[steroid-run] 🔍 Detecting test infrastructure...', ''];
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
            if (fs.existsSync(path.join(runtime.targetDir, file))) {
                lines.push(`  ✅ ${config.name} — config found at ${file}`);
                detected = true;
                break;
            }
        }
    }

    const pkgPath = path.join(runtime.targetDir, 'package.json');
    if (fs.existsSync(pkgPath)) {
        try {
            const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
            if (pkg.scripts) {
                const testScript = pkg.scripts.test;
                if (testScript && testScript !== 'echo "Error: no test specified" && exit 1') {
                    lines.push(`  📋 Test script: "${testScript}"`);
                }
                if (pkg.scripts['test:watch']) lines.push(`  📋 Watch script: "${pkg.scripts['test:watch']}"`);
                if (pkg.scripts['test:coverage']) lines.push(`  📋 Coverage script: "${pkg.scripts['test:coverage']}"`);
            }
        } catch {
            // Ignore invalid package.json and keep the command informative.
        }
    }

    if (!detected) {
        lines.push('  ⚠️  No test framework config detected.');
        lines.push('  💡 Consider adding one: npx vitest init, npx jest --init, etc.');
    }

    lines.push('');
    return {
        handled: true,
        area: 'pipeline',
        command: 'detect-tests',
        exitCode: 0,
        stdout: `${lines.join('\n')}\n`,
    };
}

function handleScan(argv = [], context = {}) {
    const runtime = buildRuntimeContext(context);
    const feature = argv[1];
    if (!feature) {
        return {
            handled: true,
            area: 'pipeline',
            command: 'scan',
            exitCode: 1,
            stderr:
                '[steroid-run] Usage: npx steroid-run scan <feature>\n' +
                '  Example: npx steroid-run scan habit-tracker\n' +
                '  This creates a basic context.md. The AI skill fills in the details.\n',
        };
    }

    const featureDir = path.join(runtime.changesDir, feature);
    if (!fs.existsSync(featureDir)) {
        return {
            handled: true,
            area: 'pipeline',
            command: 'scan',
            exitCode: 1,
            stderr: `[steroid-run] ❌ Feature "${feature}" not found. Run: npx steroid-run init-feature ${feature}\n`,
        };
    }

    const contextFile = path.join(featureDir, 'context.md');
    const requestFile = path.join(featureDir, 'request.json');
    const requestSummary = 'Feature initialized for governed scan context capture.';
    const forceFlag = argv.includes('--force');
    const lines = [];

    if (fs.existsSync(contextFile)) {
        if (!fs.existsSync(requestFile)) {
            saveRequestReceipt(featureDir, {
                feature,
                source: 'scan',
                summary: requestSummary,
            });
        }
        const stats = fs.statSync(contextFile);
        const ageMs = Date.now() - stats.mtimeMs;
        const ageHours = ageMs / (1000 * 60 * 60);
        if (ageHours < 24 && !forceFlag) {
            return {
                handled: true,
                area: 'pipeline',
                command: 'scan',
                exitCode: 0,
                stdout:
                    `[steroid-run] ✅ Context already captured (${Math.round(ageHours)}h ago). Skipping scan.\n` +
                    `[steroid-run]    Request receipt: .memory/changes/${feature}/request.json\n` +
                    '[steroid-run]    Use --force to bypass freshness check.\n',
            };
        }

        if (forceFlag) {
            lines.push('[steroid-run] 🔄 Force rescan requested. Bypassing freshness check...');
        } else {
            lines.push(`[steroid-run] ⚠️  Context is ${Math.round(ageHours)}h old. Re-scanning...`);
        }
    }

    saveRequestReceipt(featureDir, {
        feature,
        source: 'scan',
        summary: requestSummary,
    });

    const stack = detectProjectStack(runtime.targetDir);
    const timestamp = new Date().toISOString();
    const contextContent = `# Project Context for ${feature}

**Scanned:** ${timestamp}
**Note:** This is a bootstrap scan. The steroid-scan skill will enrich this with detailed analysis.

## Tech Stack

- **Language:** ${stack.language}
- **Framework:** ${stack.framework}
- **Package Manager:** ${stack.packageManager}

## Test Infrastructure

- **Framework:** ${stack.testFramework}
- **Run Command:** \`${stack.testCommand}\`
- **Existing Tests:** ${stack.testCount}

## Project Structure

> To be filled by steroid-scan skill (see \`skills/steroid-scan/SKILL.md\`)

## Existing Patterns

> To be filled by steroid-scan skill from AGENTS.md / progress.md

## Related Code

> To be filled by steroid-scan skill based on feature keyword search
`;

    fs.writeFileSync(contextFile, contextContent);
    lines.push(
        `[steroid-run] 📡 Context captured: ${stack.language}/${stack.framework}, ${stack.testCount} tests found.`,
    );
    lines.push(`[steroid-run]    Written to: .memory/changes/${feature}/context.md`);
    lines.push('[steroid-run]    The steroid-scan skill will enrich this with detailed analysis.');

    fs.mkdirSync(runtime.knowledgeDir, { recursive: true });
    const techStackFile = path.join(runtime.knowledgeDir, 'tech-stack.json');
    fs.writeFileSync(
        techStackFile,
        JSON.stringify(
            {
                language: stack.language,
                framework: stack.framework,
                packageManager: stack.packageManager,
                testFramework: stack.testFramework,
                testCommand: stack.testCommand,
                testCount: stack.testCount,
                _lastUpdated: new Date().toISOString(),
                _source: 'scan',
            },
            null,
            2,
        ),
    );
    lines.push('[steroid-run]    Knowledge: tech-stack.json updated.');
    lines.push(`[steroid-run]    Request receipt: .memory/changes/${feature}/request.json`);

    if (!fs.existsSync(runtime.progressFile)) {
        const progressContent = `# Steroid Progress Log\nStarted: ${timestamp}\n\n## Codebase Patterns\n\n- **Language**: ${stack.language}\n- **Framework**: ${stack.framework}\n- **Package Manager**: ${stack.packageManager}\n- **Test Framework**: ${stack.testFramework}\n- **Test Command**: \`${stack.testCommand}\`\n- **Existing Tests**: ${stack.testCount}\n\n---\n`;
        fs.mkdirSync(path.dirname(runtime.progressFile), { recursive: true });
        fs.writeFileSync(runtime.progressFile, progressContent);
        lines.push('[steroid-run]    Also created progress.md with codebase patterns.');
    } else {
        const existing = fs.readFileSync(runtime.progressFile, 'utf-8');
        if (existing.includes('[Patterns will be added here')) {
            const updated = existing.replace(
                /\[Patterns will be added here[^\]]*\]/,
                `**Language**: ${stack.language}\n- **Framework**: ${stack.framework}\n- **Package Manager**: ${stack.packageManager}\n- **Test Framework**: ${stack.testFramework}\n- **Test Command**: \`${stack.testCommand}\`\n- **Existing Tests**: ${stack.testCount}`,
            );
            fs.writeFileSync(runtime.progressFile, updated);
            lines.push('[steroid-run]    Updated progress.md codebase patterns.');
        }
    }

    return {
        handled: true,
        area: 'pipeline',
        command: 'scan',
        exitCode: 0,
        stdout: `${lines.join('\n')}\n`,
    };
}

function run(argv = [], context = {}) {
    const command = argv[0] || '';
    if (command === 'init-feature') {
        return handleInitFeature(argv, context);
    }
    if (command === 'gate') {
        return handleGate(argv, context);
    }
    if (command === 'commit') {
        return handleCommit(argv, context);
    }
    if (command === 'log') {
        return handleLog(argv, context);
    }
    if (command === 'check-plan') {
        return handleCheckPlan(argv, context);
    }
    if (command === 'stories') {
        return handleStories(argv, context);
    }
    if (command === 'smoke-test') {
        return handleSmokeTest(context);
    }
    if (command === 'archive') {
        return handleArchive(argv, context);
    }
    if (command === 'git-init') {
        return handleGitInit(context);
    }
    if (command === 'reset') {
        return handleReset(context);
    }
    if (command === 'recover') {
        return handleRecover(context);
    }
    if (command === 'status') {
        return handleStatus(context);
    }
    if (command === 'normalize-prompt') {
        return handleNormalizePrompt(argv, context);
    }
    if (command === 'pipeline-status') {
        return handlePipelineStatus(argv, context);
    }
    if (command === 'detect-intent') {
        return handleDetectIntent(argv, context);
    }
    if (command === 'detect-tests') {
        return handleDetectTests(context);
    }
    if (command === 'scan') {
        return handleScan(argv, context);
    }
    if (command === 'verify') {
        return handleVerify(argv, context);
    }
    if (command === 'run') {
        return handleRun(argv, context);
    }

    return {
        handled: true,
        area: 'pipeline',
        command,
    };
}

module.exports = {
    canHandle,
    handleInitFeature,
    handleGate,
    handleCommit,
    handleLog,
    handleCheckPlan,
    handleStories,
    handleSmokeTest,
    handleArchive,
    handleGitInit,
    handleReset,
    handleRecover,
    handleStatus,
    handlePipelineStatus,
    handleNormalizePrompt,
    handleDetectIntent,
    handleDetectTests,
    handleScan,
    handleVerify,
    handleRun,
    parseRunInvocation,
    run,
};
