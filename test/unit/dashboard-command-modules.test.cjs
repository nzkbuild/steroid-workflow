#!/usr/bin/env node
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');

const { handleDashboard } = require('../../src/commands/dashboard.cjs');

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

function writeJson(filePath, data) {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

console.log('[unit] dashboard-command-modules.test.cjs');

test('handleDashboard surfaces frontend quality aggregates from metrics', () => {
    const tmpBase = path.join(os.tmpdir(), `steroid-dashboard-${Date.now()}`);
    const memoryDir = path.join(tmpBase, '.memory');
    writeJson(path.join(memoryDir, 'metrics', 'features.json'), {
        landing: {
            archived: '2026-03-17T00:00:00.000Z',
            filesArchived: 10,
            errorCount: 1,
            status: 'complete',
            uiReviewStatus: 'PASS',
            uiReviewRefreshSource: 'verify-feature',
            uiReviewRecommendation: 'READY',
        },
        dashboard: {
            archived: '2026-03-18T00:00:00.000Z',
            filesArchived: 8,
            errorCount: 2,
            status: 'complete',
            uiReviewStatus: 'CONDITIONAL',
            uiReviewRefreshSource: 'review ui',
            uiReviewRecommendation: 'CAUTION',
        },
        _lastUpdated: '2026-03-18T00:00:00.000Z',
    });
    writeJson(path.join(memoryDir, 'metrics', 'error-patterns.json'), {
        patterns: [
            { keyword: 'npm', error: 'build failed' },
            { keyword: 'npm', error: 'lint failed' },
            { keyword: 'git', error: 'push failed' },
        ],
    });
    writeJson(path.join(memoryDir, 'execution_state.json'), {
        error_count: 2,
        recovery_actions: ['L4 escalate for review'],
    });
    writeJson(path.join(memoryDir, 'knowledge', 'tech-stack.json'), { framework: 'React', _lastUpdated: '2026-03-18' });
    writeJson(path.join(memoryDir, 'knowledge', 'patterns.json'), { patterns: ['cards'] });
    writeJson(path.join(memoryDir, 'knowledge', 'decisions.json'), { decisions: ['use vite'] });
    writeJson(path.join(memoryDir, 'knowledge', 'gotchas.json'), { gotchas: ['hydrate mismatch'] });
    fs.mkdirSync(path.join(memoryDir, 'reports'), { recursive: true });
    fs.writeFileSync(path.join(memoryDir, 'reports', 'landing.md'), '# Report\n');

    const result = handleDashboard({ targetDir: tmpBase });
    if (result.exitCode !== 0) throw new Error(`Unexpected exitCode: ${result.exitCode}`);
    if (!result.stdout.includes('Frontend quality: 1 PASS, 1 CONDITIONAL, 0 FAIL')) {
        throw new Error(`Missing frontend quality aggregate: ${result.stdout}`);
    }
    if (!result.stdout.includes('Frontend freshness: 1 verify-feature, 1 review ui')) {
        throw new Error(`Missing freshness aggregate: ${result.stdout}`);
    }
    if (!result.stdout.includes('Frontend release recommendation: 1 READY, 1 CAUTION')) {
        throw new Error(`Missing recommendation aggregate: ${result.stdout}`);
    }
    if (!result.stdout.includes('Top error sources:')) {
        throw new Error(`Missing error pattern section: ${result.stdout}`);
    }
    if (!result.stdout.includes('Current: 🟠 RE-READ (2/5 errors)')) {
        throw new Error(`Missing circuit breaker status: ${result.stdout}`);
    }
});

test('handleDashboard stays informative when metrics are absent', () => {
    const tmpBase = path.join(os.tmpdir(), `steroid-dashboard-empty-${Date.now()}`);
    fs.mkdirSync(tmpBase, { recursive: true });

    const result = handleDashboard({ targetDir: tmpBase });
    if (result.exitCode !== 0) throw new Error(`Unexpected exitCode: ${result.exitCode}`);
    if (!result.stdout.includes('No features archived yet.')) {
        throw new Error(`Missing empty feature state: ${result.stdout}`);
    }
    if (!result.stdout.includes('No error patterns recorded yet.')) {
        throw new Error(`Missing empty error state: ${result.stdout}`);
    }
});

console.log(`  ${passed} passed, ${failed} failed`);
module.exports = { passed, failed };
