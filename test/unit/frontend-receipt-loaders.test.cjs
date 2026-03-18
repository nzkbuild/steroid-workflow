#!/usr/bin/env node
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');

const { loadDesignRoutingReceipt, loadUiReviewReceipt } = require('../../src/utils/frontend-receipt-loaders.cjs');

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

console.log('[unit] frontend-receipt-loaders.test.cjs');

const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'steroid-frontend-receipts-'));
const featureDir = path.join(tempRoot, 'sample');
fs.mkdirSync(featureDir, { recursive: true });

test('loadDesignRoutingReceipt normalizes and rewrites routing receipts', () => {
    fs.writeFileSync(
        path.join(featureDir, 'design-routing.json'),
        JSON.stringify(
            {
                domain: 'react',
                stack: 'react',
                auditOnly: false,
                wrapperSkill: 'steroid-react-implementation',
                importedSourceIds: ['ui-ux-pro-max'],
                prompt: 'Refresh dashboard UI',
                source: 'design-route',
                updatedAt: '2026-03-18T00:00:00.000Z',
            },
            null,
            2,
        ),
    );

    const receipt = loadDesignRoutingReceipt(featureDir, { rootDir: path.join(__dirname, '..', '..') });
    if (!receipt) throw new Error('Expected routing receipt');
    if (receipt.promptSource !== 'design-route') {
        throw new Error(`Unexpected promptSource: ${receipt.promptSource}`);
    }

    const rewritten = JSON.parse(fs.readFileSync(path.join(featureDir, 'design-routing.json'), 'utf-8'));
    if (rewritten.promptSource !== 'design-route') {
        throw new Error(`Expected rewritten governed shape: ${JSON.stringify(rewritten)}`);
    }
});

test('loadDesignRoutingReceipt returns null for malformed routing receipts', () => {
    fs.writeFileSync(path.join(featureDir, 'design-routing.json'), JSON.stringify({ stack: 'unknown' }, null, 2));
    const receipt = loadDesignRoutingReceipt(featureDir, { rootDir: path.join(__dirname, '..', '..') });
    if (receipt !== null) throw new Error(`Expected null, got ${JSON.stringify(receipt)}`);
});

test('loadUiReviewReceipt normalizes and rewrites ui review receipts', () => {
    fs.writeFileSync(
        path.join(featureDir, 'ui-review.json'),
        JSON.stringify(
            {
                feature: 'sample',
                status: 'conditional',
                findings: [{ severity: 'medium', title: 'Browser audit found polish issues', detail: '2 warnings' }],
                freshness: { source: 'verify-feature', reason: 'refresh' },
            },
            null,
            2,
        ),
    );

    const receipt = loadUiReviewReceipt('sample', featureDir);
    if (!receipt) throw new Error('Expected ui review receipt');
    if (receipt.status !== 'CONDITIONAL') {
        throw new Error(`Unexpected status: ${receipt.status}`);
    }

    const rewritten = JSON.parse(fs.readFileSync(path.join(featureDir, 'ui-review.json'), 'utf-8'));
    if (rewritten.status !== 'CONDITIONAL') {
        throw new Error(`Expected rewritten governed shape: ${JSON.stringify(rewritten)}`);
    }
});

test('loadUiReviewReceipt returns null for wrong feature or invalid status', () => {
    fs.writeFileSync(
        path.join(featureDir, 'ui-review.json'),
        JSON.stringify({ feature: 'other', status: 'maybe' }, null, 2),
    );
    const receipt = loadUiReviewReceipt('sample', featureDir);
    if (receipt !== null) throw new Error(`Expected null, got ${JSON.stringify(receipt)}`);
});

fs.rmSync(tempRoot, { recursive: true, force: true });

console.log(`  ${passed} passed, ${failed} failed`);
module.exports = { passed, failed };
