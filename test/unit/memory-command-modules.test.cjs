#!/usr/bin/env node
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const {
    handleProgress,
    handleMemory,
    handleMemoryShow,
    handleMemoryShowAll,
    handleMemorySummary,
    handleMemorySave,
    handleMemoryWrite,
    handleMemoryStats,
} = require('../../src/commands/memory.cjs');

let passed = 0;
let failed = 0;

function test(name, fn) {
    try {
        fn();
        passed++;
        console.log(`  ✅ ${name}`);
    } catch (error) {
        failed++;
        console.log(`  ❌ ${name}: ${error.message}`);
    }
}

console.log('[unit] memory-command-modules.test.cjs');

const tmpBase = path.join(os.tmpdir(), `steroid-memory-modules-${Date.now()}`);
const memoryDir = path.join(tmpBase, '.memory');
const knowledgeDir = path.join(memoryDir, 'knowledge');
const metricsDir = path.join(memoryDir, 'metrics');
fs.mkdirSync(knowledgeDir, { recursive: true });
fs.mkdirSync(metricsDir, { recursive: true });

test('handleProgress shows a friendly message when no log exists', () => {
    const result = handleProgress(['progress'], { targetDir: tmpBase });
    if (result.exitCode !== 0) throw new Error(`Unexpected exitCode: ${result.exitCode}`);
    if (!result.stdout.includes('No progress log found yet')) throw new Error(`Unexpected stdout: ${result.stdout}`);
});

test('handleProgress extracts the codebase patterns section', () => {
    fs.writeFileSync(
        path.join(memoryDir, 'progress.md'),
        '# Progress\n\n## Codebase Patterns\n\n- Use CommonJS\n\n---\n\n## Later\n\nMore\n',
    );
    const result = handleProgress(['progress', '--patterns'], { targetDir: tmpBase });
    if (result.exitCode !== 0) throw new Error(`Unexpected exitCode: ${result.exitCode}`);
    if (!result.stdout.includes('## Codebase Patterns')) throw new Error(`Missing patterns section: ${result.stdout}`);
    if (result.stdout.includes('## Later')) throw new Error(`Included too much content: ${result.stdout}`);
});

test('handleMemoryWrite merges data into a store', () => {
    const result = handleMemoryWrite(['memory', 'write', 'patterns', '{"rules":["a"],"nested":{"x":1}}'], {
        targetDir: tmpBase,
    });
    if (result.exitCode !== 0) throw new Error(`Unexpected exitCode: ${result.exitCode}`);
    const written = JSON.parse(fs.readFileSync(path.join(knowledgeDir, 'patterns.json'), 'utf-8'));
    if (!written.rules.includes('a')) throw new Error(`Missing merged rule: ${JSON.stringify(written)}`);
    if (written.nested.x !== 1) throw new Error(`Missing nested merge: ${JSON.stringify(written)}`);
    if (!written._lastUpdated) throw new Error('Missing _lastUpdated');
});

test('handleMemoryShow prints store contents', () => {
    const result = handleMemoryShow(['memory', 'show', 'patterns'], { targetDir: tmpBase });
    if (result.exitCode !== 0) throw new Error(`Unexpected exitCode: ${result.exitCode}`);
    if (!result.stdout.includes('"rules"')) throw new Error(`Unexpected stdout: ${result.stdout}`);
});

test('handleMemoryShowAll prints all populated stores', () => {
    fs.writeFileSync(
        path.join(knowledgeDir, 'decisions.json'),
        JSON.stringify({ architecture: 'modular', _lastUpdated: new Date().toISOString() }, null, 2),
    );
    const result = handleMemoryShowAll({ targetDir: tmpBase });
    if (result.exitCode !== 0) throw new Error(`Unexpected exitCode: ${result.exitCode}`);
    if (!result.stdout.includes('## patterns')) throw new Error(`Missing patterns output: ${result.stdout}`);
    if (!result.stdout.includes('## decisions')) throw new Error(`Missing decisions output: ${result.stdout}`);
});

test('handleMemoryStats reports per-store counts', () => {
    fs.writeFileSync(
        path.join(metricsDir, 'error-patterns.json'),
        JSON.stringify({ patterns: [{ id: 'missing-tests' }] }, null, 2),
    );
    fs.writeFileSync(
        path.join(metricsDir, 'features.json'),
        JSON.stringify({ dashboard: { status: 'done' }, checkout: { status: 'wip' }, _lastUpdated: new Date().toISOString() }, null, 2),
    );
    const result = handleMemoryStats({ targetDir: tmpBase });
    if (result.exitCode !== 0) throw new Error(`Unexpected exitCode: ${result.exitCode}`);
    if (!result.stdout.includes('patterns: 2 entries')) throw new Error(`Missing patterns stats: ${result.stdout}`);
    if (!result.stdout.includes('tech-stack: empty')) throw new Error(`Missing empty store stats: ${result.stdout}`);
    if (!result.stdout.includes('error-patterns: 1 patterns tracked')) throw new Error(`Missing error-patterns stats: ${result.stdout}`);
    if (!result.stdout.includes('features: 2 features tracked')) throw new Error(`Missing features stats: ${result.stdout}`);
    if (!result.stdout.includes('Total knowledge entries:')) throw new Error(`Missing total count: ${result.stdout}`);
});

test('handleMemorySummary reports aggregated state and recommendations', () => {
    const result = handleMemorySummary({ targetDir: tmpBase });
    if (result.exitCode !== 0) throw new Error(`Unexpected exitCode: ${result.exitCode}`);
    if (!result.stdout.includes('Memory Summary')) throw new Error(`Missing summary header: ${result.stdout}`);
    if (!result.stdout.includes('Populated stores: patterns, decisions')) {
        throw new Error(`Unexpected populated stores: ${result.stdout}`);
    }
    if (!result.stdout.includes('Recommended next actions:')) {
        throw new Error(`Missing recommendations: ${result.stdout}`);
    }
    if (!result.stdout.includes('Role: operational context snapshot')) {
        throw new Error(`Missing role guidance: ${result.stdout}`);
    }
    if (!result.stdout.includes('Next command:')) {
        throw new Error(`Missing next command: ${result.stdout}`);
    }
});

test('handleMemorySave writes a session checkpoint artifact', () => {
    const result = handleMemorySave({ targetDir: tmpBase });
    if (result.exitCode !== 0) throw new Error(`Unexpected exitCode: ${result.exitCode}`);
    if (!result.stdout.includes('session-summary.json')) throw new Error(`Unexpected stdout: ${result.stdout}`);
    const summaryPath = path.join(knowledgeDir, 'session-summary.json');
    if (!fs.existsSync(summaryPath)) throw new Error('session-summary.json missing');
    const summary = JSON.parse(fs.readFileSync(summaryPath, 'utf-8'));
    if (summary.totalEntries < 1) throw new Error(`Unexpected summary: ${JSON.stringify(summary)}`);
    if (!summary.stores.patterns.present) throw new Error(`Patterns store not captured: ${JSON.stringify(summary)}`);
    if (!result.stdout.includes('Next command: node steroid-run.cjs memory summary')) {
        throw new Error(`Missing next command: ${result.stdout}`);
    }
});

test('handleMemory routes help and unknown subcommands', () => {
    let result = handleMemory(['memory'], { targetDir: tmpBase });
    if (result.exitCode !== 0) throw new Error(`Unexpected help exitCode: ${result.exitCode}`);
    if (!result.stdout.includes('Structured project knowledge store')) {
        throw new Error(`Missing help text: ${result.stdout}`);
    }
    if (!result.stdout.includes('memory save')) {
        throw new Error(`Missing save command in help text: ${result.stdout}`);
    }
    if (!result.stdout.includes('Primary use:')) {
        throw new Error(`Missing primary use guidance: ${result.stdout}`);
    }

    result = handleMemory(['memory', 'unknown-subcommand'], { targetDir: tmpBase });
    if (result.exitCode !== 1) throw new Error(`Unexpected unknown exitCode: ${result.exitCode}`);
    if (!result.stderr.includes('Unknown memory subcommand')) throw new Error(`Unexpected stderr: ${result.stderr}`);
    if (!result.stderr.includes('memory --help')) throw new Error(`Missing help hint: ${result.stderr}`);
});

console.log(`  ${passed} passed, ${failed} failed`);
module.exports = { passed, failed };
