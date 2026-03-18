#!/usr/bin/env node
'use strict';

const path = require('path');
const {
    normalizeCompletionReceipt,
    normalizeDesignRoutingReceipt,
    normalizeExecutionReceipt,
    normalizeUiReviewReceipt,
    normalizeVerifyReceipt,
} = require('../../src/utils/governed-receipts.cjs');

let passed = 0;
let failed = 0;

function test(name, fn) {
    try {
        fn();
        passed++;
        console.log(`  ✅ ${name}`);
    } catch (e) {
        failed++;
        console.log(`  ❌ ${name}: ${e.message}`);
    }
}

console.log('[unit] governed-receipts.test.cjs');

test('normalizes design routing receipts and preserves provenance fields', () => {
    const receipt = normalizeDesignRoutingReceipt(
        {
            domain: 'react',
            stack: 'react',
            auditOnly: false,
            wrapperSkill: 'steroid-react-implementation',
            importedSourceIds: ['ui-ux-pro-max'],
            prompt: 'Refresh the dashboard UI.',
            source: 'design-route',
            updatedAt: '2026-03-18T00:00:00.000Z',
        },
        { rootDir: path.join(__dirname, '..', '..') },
    );
    if (!receipt) throw new Error('Expected routing receipt to normalize');
    if (receipt.promptSource !== 'design-route') throw new Error(`Unexpected promptSource: ${receipt.promptSource}`);
    if (receipt.source !== 'design-route') throw new Error(`Unexpected source: ${receipt.source}`);
    if (receipt.generatedAt !== '2026-03-18T00:00:00.000Z') {
        throw new Error(`Unexpected generatedAt: ${receipt.generatedAt}`);
    }
    if (receipt.updatedAt !== '2026-03-18T00:00:00.000Z') {
        throw new Error(`Unexpected updatedAt: ${receipt.updatedAt}`);
    }
});

test('normalizes verify receipts and preserves deep verification flags', () => {
    const receipt = normalizeVerifyReceipt(
        {
            feature: 'sample',
            status: 'pass',
            reviewPassed: true,
            checks: { lint: 'PASS' },
            deepRequested: true,
            deepCompleted: false,
        },
        'sample',
    );
    if (!receipt) throw new Error('Expected verify receipt to normalize');
    if (receipt.status !== 'PASS') throw new Error(`Unexpected verify status: ${receipt.status}`);
    if (!receipt.deepRequested || receipt.deepCompleted) {
        throw new Error(`Unexpected deep verify flags: ${JSON.stringify(receipt)}`);
    }
});

test('normalizes completion receipts from source_artifacts and default options', () => {
    const receipt = normalizeCompletionReceipt(
        {
            feature: 'sample',
            status: 'conditional',
            source_artifacts: ['verify.json', 'progress.md'],
            nextActions: ['archive'],
        },
        'sample',
    );
    if (!receipt) throw new Error('Expected completion receipt to normalize');
    if (receipt.status !== 'CONDITIONAL') throw new Error(`Unexpected completion status: ${receipt.status}`);
    if (JSON.stringify(receipt.sourceArtifacts) !== JSON.stringify(['verify.json', 'progress.md'])) {
        throw new Error(`Unexpected sourceArtifacts: ${JSON.stringify(receipt)}`);
    }
    if (receipt.options.length !== 4) throw new Error(`Expected default completion options: ${JSON.stringify(receipt)}`);
});

test('normalizes execution receipts from consumed_artifacts', () => {
    const receipt = normalizeExecutionReceipt(
        {
            feature: 'sample',
            status: 'complete',
            consumed_artifacts: ['plan.md', 'tasks.md'],
        },
        'sample',
    );
    if (!receipt) throw new Error('Expected execution receipt to normalize');
    if (receipt.status !== 'COMPLETE') throw new Error(`Unexpected execution status: ${receipt.status}`);
    if (JSON.stringify(receipt.consumedArtifacts) !== JSON.stringify(['plan.md', 'tasks.md'])) {
        throw new Error(`Unexpected consumed artifacts: ${JSON.stringify(receipt)}`);
    }
});

test('normalizes ui review receipts into governed shape', () => {
    const receipt = normalizeUiReviewReceipt(
        {
            feature: 'sample',
            status: 'conditional',
            findings: [{ severity: 'medium', title: 'Browser audit found polish issues', detail: '2 warnings.' }],
            freshness: { source: 'review ui', reason: 'Manual refresh requested.' },
        },
        'sample',
    );
    if (!receipt) throw new Error('Expected ui review receipt to normalize');
    if (receipt.status !== 'CONDITIONAL') throw new Error(`Unexpected ui review status: ${receipt.status}`);
    if (receipt.freshness.source !== 'review ui') throw new Error(`Unexpected freshness source: ${receipt.freshness.source}`);
    if (receipt.findings.length !== 1) throw new Error(`Unexpected findings: ${JSON.stringify(receipt.findings)}`);
});

console.log(`  ${passed} passed, ${failed} failed`);
module.exports = { passed, failed };
