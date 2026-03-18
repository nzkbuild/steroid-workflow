#!/usr/bin/env node
'use strict';

const { buildUiArchivePolicy, summarizeUiReviewStatus } = require('../../src/utils/ui-archive-policy.cjs');

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

console.log('[unit] ui-archive-policy.test.cjs');

test('summarizeUiReviewStatus returns FAIL for critical findings', () => {
    const status = summarizeUiReviewStatus([{ severity: 'critical', title: 'Runtime failures' }]);
    if (status !== 'FAIL') throw new Error(`Unexpected status: ${status}`);
});

test('summarizeUiReviewStatus returns CONDITIONAL for medium findings', () => {
    const status = summarizeUiReviewStatus([{ severity: 'medium', title: 'Polish issues' }]);
    if (status !== 'CONDITIONAL') throw new Error(`Unexpected status: ${status}`);
});

test('buildUiArchivePolicy passes when no receipt exists', () => {
    const policy = buildUiArchivePolicy(null);
    if (policy.decision !== 'PASS') throw new Error(`Unexpected policy: ${JSON.stringify(policy)}`);
});

test('buildUiArchivePolicy blocks FAIL receipts', () => {
    const policy = buildUiArchivePolicy({ status: 'FAIL', findings: [] });
    if (policy.decision !== 'BLOCK') throw new Error(`Unexpected policy: ${JSON.stringify(policy)}`);
});

test('buildUiArchivePolicy blocks conditional deep verification without browser evidence', () => {
    const policy = buildUiArchivePolicy(
        {
            status: 'CONDITIONAL',
            findings: [{ title: 'Browser runtime evidence missing', severity: 'medium' }],
        },
        { deepRequested: true },
    );
    if (policy.decision !== 'BLOCK_CONDITIONAL') {
        throw new Error(`Unexpected policy: ${JSON.stringify(policy)}`);
    }
    if (policy.overrideFlag !== '--force-ui') {
        throw new Error(`Expected override flag, got ${policy.overrideFlag}`);
    }
});

test('buildUiArchivePolicy warns for conditional polish issues', () => {
    const policy = buildUiArchivePolicy({
        status: 'CONDITIONAL',
        findings: [{ title: 'Browser audit found polish issues', severity: 'medium' }],
    });
    if (policy.decision !== 'WARN_CONDITIONAL') {
        throw new Error(`Unexpected policy: ${JSON.stringify(policy)}`);
    }
    if (policy.warnReasons.length !== 1) {
        throw new Error(`Unexpected warnings: ${JSON.stringify(policy)}`);
    }
});

test('buildUiArchivePolicy warns when conditional receipts have no findings', () => {
    const policy = buildUiArchivePolicy({ status: 'CONDITIONAL', findings: [] });
    if (!policy.warnReasons.some((reason) => reason.includes('no structured findings'))) {
        throw new Error(`Expected missing-findings warning: ${JSON.stringify(policy)}`);
    }
});

console.log(`  ${passed} passed, ${failed} failed`);
module.exports = { passed, failed };
