#!/usr/bin/env node
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');

const {
    loadCompletionReceipt,
    loadExecutionReceipt,
    loadRequestReceipt,
    loadReviewReceipt,
    loadVerifyReceipt,
    parseVerifyMarkdownStatus,
    saveCompletionReceipt,
    saveExecutionReceipt,
    saveRequestReceipt,
    saveReviewReceipt,
    saveVerifyReceipt,
} = require('../../src/utils/receipt-loaders.cjs');

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

console.log('[unit] receipt-loaders.test.cjs');

const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'steroid-receipt-loaders-'));
const featureDir = path.join(tempRoot, 'sample');
fs.mkdirSync(featureDir, { recursive: true });

test('parseVerifyMarkdownStatus reads governed verify status lines', () => {
    const status = parseVerifyMarkdownStatus('**Status:** CONDITIONAL\n');
    if (status !== 'CONDITIONAL') throw new Error(`Unexpected status: ${status}`);
});

test('loadReviewReceipt syncs review.md into review.json', () => {
    fs.writeFileSync(featureDir + '/review.md', '**Stage 1 Result:** PASS\n**Stage 2 Result:** FAIL\n');
    const receipt = loadReviewReceipt('sample', featureDir);
    if (receipt.stage1 !== 'PASS' || receipt.stage2 !== 'FAIL') {
        throw new Error(`Unexpected review receipt: ${JSON.stringify(receipt)}`);
    }
    const reviewJson = JSON.parse(fs.readFileSync(featureDir + '/review.json', 'utf-8'));
    if (reviewJson.source !== 'review.md-synced') {
        throw new Error(`Expected synced source, got ${reviewJson.source}`);
    }
});

test('saveReviewReceipt writes review.json in governed shape', () => {
    saveReviewReceipt(featureDir, { feature: 'sample', stage1: 'PASS', stage2: 'PASS' });
    const reviewJson = JSON.parse(fs.readFileSync(featureDir + '/review.json', 'utf-8'));
    if (reviewJson.stage1 !== 'PASS' || reviewJson.stage2 !== 'PASS') {
        throw new Error(`Unexpected saved review receipt: ${JSON.stringify(reviewJson)}`);
    }
});

test('loadVerifyReceipt preserves deep verification flags from verify.json', () => {
    fs.writeFileSync(
        featureDir + '/verify.json',
        JSON.stringify(
            {
                feature: 'sample',
                status: 'pass',
                confidence: 'REDUCED',
                reviewPassed: true,
                checks: { lint: 'PASS' },
                deepRequested: true,
                deepCompleted: false,
            },
            null,
            2,
        ),
    );
    const receipt = loadVerifyReceipt('sample', featureDir);
    if (receipt.status !== 'PASS' || receipt.confidence !== 'REDUCED' || !receipt.deepRequested || receipt.deepCompleted) {
        throw new Error(`Unexpected verify receipt: ${JSON.stringify(receipt)}`);
    }
});

test('saveVerifyReceipt writes verify.json in governed shape', () => {
    saveVerifyReceipt(featureDir, {
        feature: 'sample',
        status: 'PASS',
        confidence: 'HIGH',
        reviewPassed: true,
        checks: { test: 'PASS' },
        deepRequested: true,
        deepCompleted: true,
    });
    const verifyJson = JSON.parse(fs.readFileSync(featureDir + '/verify.json', 'utf-8'));
    if (!verifyJson.deepRequested || !verifyJson.deepCompleted || verifyJson.confidence !== 'HIGH') {
        throw new Error(`Unexpected saved verify receipt: ${JSON.stringify(verifyJson)}`);
    }
});

test('loadRequestReceipt normalizes request fields', () => {
    fs.writeFileSync(
        featureDir + '/request.json',
        JSON.stringify(
            {
                feature: 'sample',
                requestedAt: '2026-03-18T00:00:00.000Z',
                source: 12,
                summary: 'test summary',
            },
            null,
            2,
        ),
    );
    const receipt = loadRequestReceipt('sample', featureDir);
    if (receipt.source !== 'request.json' || receipt.summary !== 'test summary') {
        throw new Error(`Unexpected request receipt: ${JSON.stringify(receipt)}`);
    }
});

test('saveRequestReceipt writes request.json with defaults', () => {
    saveRequestReceipt(featureDir, { feature: 'sample' });
    const requestJson = JSON.parse(fs.readFileSync(featureDir + '/request.json', 'utf-8'));
    if (requestJson.source !== 'scan') throw new Error(`Unexpected source: ${requestJson.source}`);
});

test('loadCompletionReceipt normalizes source_artifacts alias and options', () => {
    fs.writeFileSync(
        featureDir + '/completion.json',
        JSON.stringify(
            {
                feature: 'sample',
                status: 'conditional',
                source_artifacts: ['verify.json', 'progress.md'],
                nextActions: ['archive'],
            },
            null,
            2,
        ),
    );
    const receipt = loadCompletionReceipt('sample', featureDir);
    if (receipt.status !== 'CONDITIONAL' || receipt.sourceArtifacts.length !== 2 || receipt.options.length !== 4) {
        throw new Error(`Unexpected completion receipt: ${JSON.stringify(receipt)}`);
    }
});

test('saveCompletionReceipt writes both sourceArtifacts fields', () => {
    saveCompletionReceipt(featureDir, {
        feature: 'sample',
        status: 'PASS',
        sourceArtifacts: ['verify.json', 'progress.md'],
    });
    const completionJson = JSON.parse(fs.readFileSync(featureDir + '/completion.json', 'utf-8'));
    if (JSON.stringify(completionJson.sourceArtifacts) !== JSON.stringify(completionJson.source_artifacts)) {
        throw new Error(`Expected mirrored source artifact fields: ${JSON.stringify(completionJson)}`);
    }
});

test('loadExecutionReceipt normalizes consumed_artifacts alias', () => {
    fs.writeFileSync(
        featureDir + '/execution.json',
        JSON.stringify(
            {
                feature: 'sample',
                status: 'complete',
                consumed_artifacts: ['plan.md', 'tasks.md'],
            },
            null,
            2,
        ),
    );
    const receipt = loadExecutionReceipt('sample', featureDir);
    if (receipt.status !== 'COMPLETE' || receipt.consumedArtifacts.length !== 2) {
        throw new Error(`Unexpected execution receipt: ${JSON.stringify(receipt)}`);
    }
});

test('saveExecutionReceipt writes governed execution receipt shape', () => {
    saveExecutionReceipt(featureDir, {
        feature: 'sample',
        status: 'COMPLETE',
        consumedArtifacts: ['plan.md', 'tasks.md'],
    });
    const executionJson = JSON.parse(fs.readFileSync(featureDir + '/execution.json', 'utf-8'));
    if (!Array.isArray(executionJson.consumed_artifacts) || executionJson.consumed_artifacts.length !== 2) {
        throw new Error(`Unexpected execution receipt: ${JSON.stringify(executionJson)}`);
    }
});

fs.rmSync(tempRoot, { recursive: true, force: true });

console.log(`  ${passed} passed, ${failed} failed`);
module.exports = { passed, failed };
