'use strict';

const fs = require('fs');
const path = require('path');
const { mergeKnowledge } = require('../utils/merge-knowledge.cjs');

const VALID_STORES = ['tech-stack', 'patterns', 'decisions', 'gotchas'];

function canHandle(command) {
    return command === 'memory' || command === 'progress';
}

function buildRuntimeContext(context = {}) {
    const targetDir = context.targetDir || process.cwd();
    const memoryDir = path.join(targetDir, '.memory');
    return {
        targetDir,
        memoryDir,
        progressFile: path.join(memoryDir, 'progress.md'),
        knowledgeDir: path.join(memoryDir, 'knowledge'),
        metricsDir: path.join(memoryDir, 'metrics'),
    };
}

function ensureKnowledgeDir(knowledgeDir) {
    if (!fs.existsSync(knowledgeDir)) {
        fs.mkdirSync(knowledgeDir, { recursive: true });
    }
}

function storeFilePath(knowledgeDir, store) {
    return path.join(knowledgeDir, `${store}.json`);
}

function summarizeProgressContent(progressContent) {
    const content = String(progressContent || '').trim();
    if (!content) return null;

    const patternsMatch = content.match(/## Codebase Patterns[\s\S]*?(?=\n## |\n---|\Z)/);
    const section = patternsMatch ? patternsMatch[0] : content;
    const normalized = section
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 240);

    return normalized || null;
}

function collectMemorySummary(runtime) {
    ensureKnowledgeDir(runtime.knowledgeDir);

    const stores = {};
    let totalEntries = 0;
    let latestUpdate = null;

    for (const store of VALID_STORES) {
        const filePath = storeFilePath(runtime.knowledgeDir, store);
        if (!fs.existsSync(filePath)) {
            stores[store] = {
                present: false,
                entries: 0,
                updatedAt: null,
            };
            continue;
        }

        try {
            const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
            const entries = Object.keys(data).filter((key) => key !== '_lastUpdated').length;
            const updatedAt = data._lastUpdated || null;
            stores[store] = {
                present: true,
                entries,
                updatedAt,
            };
            totalEntries += entries;
            if (updatedAt && (!latestUpdate || updatedAt > latestUpdate)) {
                latestUpdate = updatedAt;
            }
        } catch {
            stores[store] = {
                present: false,
                entries: 0,
                updatedAt: null,
                corrupt: true,
            };
        }
    }

    const progressContent = fs.existsSync(runtime.progressFile)
        ? fs.readFileSync(runtime.progressFile, 'utf-8')
        : '';
    const progressSummary = summarizeProgressContent(progressContent);

    const recommendedActions = [];
    if (!stores['tech-stack'].present) recommendedActions.push('Run scan to populate tech-stack memory.');
    if (!stores['patterns'].present) recommendedActions.push('Capture codebase patterns from progress or research outputs.');
    if (!stores['decisions'].present) recommendedActions.push('Record locked architecture decisions after architect/review work.');
    if (!stores['gotchas'].present) recommendedActions.push('Save verification and implementation pitfalls into gotchas.');
    if (!progressSummary) recommendedActions.push('Write progress.md or refresh progress to preserve current working context.');

    return {
        generatedAt: new Date().toISOString(),
        totalEntries,
        latestUpdate,
        stores,
        progressSummary,
        recommendedActions,
    };
}

function handleProgress(argv = [], context = {}) {
    const runtime = buildRuntimeContext(context);
    if (!fs.existsSync(runtime.progressFile)) {
        return {
            handled: true,
            area: 'memory',
            command: 'progress',
            exitCode: 0,
            stdout: '[steroid-run] No progress log found yet. It will be created when the engine starts building.\n',
        };
    }

    const content = fs.readFileSync(runtime.progressFile, 'utf-8');
    if (argv.includes('--patterns')) {
        const patternsMatch = content.match(/## Codebase Patterns[\s\S]*?(?=\n## [^C]|\n---|\Z)/);
        if (patternsMatch) {
            return {
                handled: true,
                area: 'memory',
                command: 'progress',
                exitCode: 0,
                stdout: `${patternsMatch[0].trim()}\n`,
            };
        }
        return {
            handled: true,
            area: 'memory',
            command: 'progress',
            exitCode: 0,
            stdout: '[steroid-run] No codebase patterns captured yet.\n',
        };
    }

    return {
        handled: true,
        area: 'memory',
        command: 'progress',
        exitCode: 0,
        stdout: content.endsWith('\n') ? content : `${content}\n`,
    };
}

function handleMemoryShow(argv = [], context = {}) {
    const runtime = buildRuntimeContext(context);
    ensureKnowledgeDir(runtime.knowledgeDir);
    const store = argv[2];
    if (!store || !VALID_STORES.includes(store)) {
        return {
            handled: true,
            area: 'memory',
            command: 'memory',
            exitCode: 1,
            stderr: `[steroid-run] ❌ Unknown store: "${store}". Valid: ${VALID_STORES.join(', ')}\n`,
        };
    }

    const filePath = storeFilePath(runtime.knowledgeDir, store);
    if (!fs.existsSync(filePath)) {
        return {
            handled: true,
            area: 'memory',
            command: 'memory',
            exitCode: 0,
            stdout: `[steroid-run] 📭 Store "${store}" is empty. It will be populated as the pipeline runs.\n`,
        };
    }

    try {
        const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
        return {
            handled: true,
            area: 'memory',
            command: 'memory',
            exitCode: 0,
            stdout: `${JSON.stringify(data, null, 2)}\n`,
        };
    } catch {
        fs.unlinkSync(filePath);
        return {
            handled: true,
            area: 'memory',
            command: 'memory',
            exitCode: 1,
            stderr: `[steroid-run] ⚠️  Store "${store}" has invalid JSON. Resetting.\n`,
        };
    }
}

function handleMemoryShowAll(context = {}) {
    const runtime = buildRuntimeContext(context);
    ensureKnowledgeDir(runtime.knowledgeDir);
    const lines = [];
    let hasData = false;

    for (const store of VALID_STORES) {
        const filePath = storeFilePath(runtime.knowledgeDir, store);
        if (!fs.existsSync(filePath)) continue;
        try {
            const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
            lines.push(`\n## ${store}`);
            lines.push(JSON.stringify(data, null, 2));
            hasData = true;
        } catch {
            lines.push(`\n## ${store} — ⚠️ corrupt (will reset on next write)`);
        }
    }

    if (!hasData && lines.length === 0) {
        return {
            handled: true,
            area: 'memory',
            command: 'memory',
            exitCode: 0,
            stdout: '[steroid-run] 📭 No knowledge stored yet. Run a scan to populate tech-stack.\n',
        };
    }

    return {
        handled: true,
        area: 'memory',
        command: 'memory',
        exitCode: 0,
        stdout: `${lines.join('\n').trimStart()}\n`,
    };
}

function handleMemoryWrite(argv = [], context = {}) {
    const runtime = buildRuntimeContext(context);
    ensureKnowledgeDir(runtime.knowledgeDir);
    const store = argv[2];
    const jsonStr = argv.slice(3).join(' ');

    if (!store || !VALID_STORES.includes(store)) {
        return {
            handled: true,
            area: 'memory',
            command: 'memory',
            exitCode: 1,
            stderr: `[steroid-run] ❌ Unknown store: "${store}". Valid: ${VALID_STORES.join(', ')}\n`,
        };
    }
    if (!jsonStr) {
        return {
            handled: true,
            area: 'memory',
            command: 'memory',
            exitCode: 1,
            stderr: '[steroid-run] ❌ No JSON data provided.\n',
        };
    }
    if (Buffer.byteLength(jsonStr, 'utf-8') > 102400) {
        return {
            handled: true,
            area: 'memory',
            command: 'memory',
            exitCode: 1,
            stderr: '[steroid-run] ❌ JSON payload too large (max 100KB).\n',
        };
    }

    let newData;
    try {
        newData = JSON.parse(jsonStr);
    } catch (error) {
        return {
            handled: true,
            area: 'memory',
            command: 'memory',
            exitCode: 1,
            stderr: `[steroid-run] ❌ Invalid JSON: ${error.message}\n`,
        };
    }

    if (!newData || typeof newData !== 'object' || Array.isArray(newData)) {
        return {
            handled: true,
            area: 'memory',
            command: 'memory',
            exitCode: 1,
            stderr: '[steroid-run] ❌ JSON must be an object.\n',
        };
    }

    const filePath = storeFilePath(runtime.knowledgeDir, store);
    let existing = {};
    if (fs.existsSync(filePath)) {
        try {
            existing = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
        } catch {
            existing = {};
        }
    }

    const merged = mergeKnowledge(existing, newData);
    merged._lastUpdated = new Date().toISOString();
    fs.writeFileSync(filePath, JSON.stringify(merged, null, 2));
    return {
        handled: true,
        area: 'memory',
        command: 'memory',
        exitCode: 0,
        stdout: `[steroid-run] ✅ Knowledge written to ${store}.json\n`,
    };
}

function handleMemoryStats(context = {}) {
    const runtime = buildRuntimeContext(context);
    ensureKnowledgeDir(runtime.knowledgeDir);
    const lines = ['[steroid-run] 🧠 Memory Statistics', ''];
    let totalEntries = 0;

    for (const store of VALID_STORES) {
        const filePath = storeFilePath(runtime.knowledgeDir, store);
        if (!fs.existsSync(filePath)) {
            lines.push(`  ${store}: empty`);
            continue;
        }
        try {
            const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
            const count = Object.keys(data).filter((key) => key !== '_lastUpdated').length;
            totalEntries += count;
            lines.push(`  ${store}: ${count} entries (updated: ${data._lastUpdated || 'unknown'})`);
        } catch {
            lines.push(`  ${store}: ⚠️ corrupt`);
        }
    }

    const errorPatternsFile = path.join(runtime.metricsDir, 'error-patterns.json');
    const featuresFile = path.join(runtime.metricsDir, 'features.json');

    if (fs.existsSync(errorPatternsFile)) {
        try {
            const errorPatterns = JSON.parse(fs.readFileSync(errorPatternsFile, 'utf-8'));
            const patterns = Array.isArray(errorPatterns.patterns) ? errorPatterns.patterns : [];
            lines.push(`  error-patterns: ${patterns.length} patterns tracked`);
        } catch {
            // Ignore malformed metrics files to match legacy behavior.
        }
    }

    if (fs.existsSync(featuresFile)) {
        try {
            const featureMetrics = JSON.parse(fs.readFileSync(featuresFile, 'utf-8'));
            const features = Object.keys(featureMetrics).filter((key) => key !== '_lastUpdated');
            lines.push(`  features: ${features.length} features tracked`);
        } catch {
            // Ignore malformed metrics files to match legacy behavior.
        }
    }

    lines.push('');
    lines.push(`  Total knowledge entries: ${totalEntries}`);
    return {
        handled: true,
        area: 'memory',
        command: 'memory',
        exitCode: 0,
        stdout: `${lines.join('\n')}\n`,
    };
}

function handleMemorySummary(context = {}) {
    const runtime = buildRuntimeContext(context);
    const summary = collectMemorySummary(runtime);
    const populatedStores = VALID_STORES.filter((store) => summary.stores[store].present);
    const lines = [
        '[steroid-run] 🧠 Memory Summary',
        '',
        `  Populated stores: ${populatedStores.length > 0 ? populatedStores.join(', ') : 'none'}`,
        `  Total knowledge entries: ${summary.totalEntries}`,
        `  Latest update: ${summary.latestUpdate || 'unknown'}`,
        `  Progress snapshot: ${summary.progressSummary || 'not captured yet'}`,
        '',
        '  Recommended next actions:',
    ];

    if (summary.recommendedActions.length === 0) {
        lines.push('  - Memory coverage looks healthy.');
    } else {
        for (const action of summary.recommendedActions) {
            lines.push(`  - ${action}`);
        }
    }

    return {
        handled: true,
        area: 'memory',
        command: 'memory',
        exitCode: 0,
        stdout: `${lines.join('\n')}\n`,
    };
}

function handleMemorySave(context = {}) {
    const runtime = buildRuntimeContext(context);
    const summary = collectMemorySummary(runtime);
    const outputPath = path.join(runtime.knowledgeDir, 'session-summary.json');
    fs.writeFileSync(outputPath, JSON.stringify(summary, null, 2));

    return {
        handled: true,
        area: 'memory',
        command: 'memory',
        exitCode: 0,
        stdout: `[steroid-run] ✅ Session memory checkpoint written to .memory/knowledge/session-summary.json\n`,
    };
}

function handleMemory(argv = [], context = {}) {
    const sub = argv[1];

    if (!sub || sub === '--help') {
        return {
            handled: true,
            area: 'memory',
            command: 'memory',
            exitCode: 0,
            stdout:
                '\n[steroid-run] memory — Structured project knowledge store.\n\n' +
                'Usage:\n' +
                '  node steroid-run.cjs memory show [store]       Show a knowledge store (tech-stack|patterns|decisions|gotchas)\n' +
                '  node steroid-run.cjs memory show-all           Show all knowledge stores\n' +
                '  node steroid-run.cjs memory summary            Show an aggregated memory summary\n' +
                '  node steroid-run.cjs memory save               Write session-summary.json from current memory\n' +
                '  node steroid-run.cjs memory write <store> <json>  Write/merge data into a store\n' +
                '  node steroid-run.cjs memory stats              Show memory statistics\n\n' +
                'Stores:\n' +
                '  tech-stack   — Language, framework, deps (from scan/research)\n' +
                '  patterns     — Codebase patterns and conventions (from AGENTS.md/scan)\n' +
                '  decisions    — Locked architectural decisions (from architect phase)\n' +
                '  gotchas      — Known pitfalls and workarounds (from engine/verify)\n',
        };
    }

    if (sub === 'show') return handleMemoryShow(argv, context);
    if (sub === 'show-all') return handleMemoryShowAll(context);
    if (sub === 'summary') return handleMemorySummary(context);
    if (sub === 'save') return handleMemorySave(context);
    if (sub === 'write') return handleMemoryWrite(argv, context);
    if (sub === 'stats') return handleMemoryStats(context);

    return {
        handled: true,
        area: 'memory',
        command: 'memory',
        exitCode: 1,
        stderr: `[steroid-run] ❌ Unknown memory subcommand: "${sub}". Run: node steroid-run.cjs memory --help\n`,
    };
}

function run(argv = [], context = {}) {
    const command = argv[0] || '';
    if (command === 'progress') {
        return handleProgress(argv, context);
    }
    if (command === 'memory') {
        return handleMemory(argv, context);
    }

    return {
        handled: true,
        area: 'memory',
        command,
    };
}

module.exports = {
    canHandle,
    handleProgress,
    handleMemory,
    handleMemoryShow,
    handleMemoryShowAll,
    handleMemorySummary,
    handleMemorySave,
    handleMemoryWrite,
    handleMemoryStats,
    run,
};
