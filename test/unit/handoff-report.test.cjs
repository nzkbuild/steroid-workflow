#!/usr/bin/env node
'use strict';

const { generateHandoffReportContent } = require('../../src/utils/handoff-report.cjs');

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

console.log('[unit] handoff-report.test.cjs');

test('generates a spec-only report with recorded criteria and no verify receipt', () => {
    const report = generateHandoffReportContent({
        feature: 'sample',
        version: '6.3.0-beta.1',
        now: '2026-03-18T00:00:00.000Z',
        specContent: '# Specification: Sample\n\nGiven a user opens the page\nWhen they click save\nThen the change persists\n',
    });
    if (!report.includes('3 acceptance criteria recorded in spec.md')) {
        throw new Error(report);
    }
    if (!report.includes('_No verify.md found._')) {
        throw new Error(report);
    }
});

test('includes prompt interpretation details when prompt.json is valid', () => {
    const report = generateHandoffReportContent({
        feature: 'sample',
        version: '6.3.0-beta.1',
        promptReceiptContent: JSON.stringify({
            primaryIntent: 'feature',
            secondaryIntents: ['docs'],
            continuationState: 'new',
            complexity: 'medium',
            ambiguity: 'low',
            recommendedPipeline: 'research',
        }),
    });
    if (!report.includes('- Primary Intent: feature') || !report.includes('- Secondary Intents: docs')) {
        throw new Error(report);
    }
});

test('falls back cleanly when prompt.json is malformed', () => {
    const report = generateHandoffReportContent({
        feature: 'sample',
        version: '6.3.0-beta.1',
        promptReceiptContent: '{',
    });
    if (!report.includes('_prompt.json found but could not be parsed._')) {
        throw new Error(report);
    }
});

test('summarizes checklist progress and deferred items from plan.md', () => {
    const report = generateHandoffReportContent({
        feature: 'sample',
        version: '6.3.0-beta.1',
        planContent: [
            '# Implementation Plan: Sample',
            '',
            '## Tech Stack',
            '- Node',
            '',
            '## Execution Checklist',
            '- [x] done task',
            '- [ ] deferred task',
            '```md',
            '- [ ] ignored example',
            '```',
            '',
        ].join('\n'),
    });
    if (!report.includes('1/2 tasks completed (50%)')) {
        throw new Error(report);
    }
    if (!report.includes('1 items were not completed:') || !report.includes('- [ ] deferred task')) {
        throw new Error(report);
    }
});

test('includes frontend quality policy summary and blockers', () => {
    const report = generateHandoffReportContent({
        feature: 'sample',
        version: '6.3.0-beta.1',
        verifyReceipt: { deepRequested: true },
        uiReviewReceipt: {
            status: 'CONDITIONAL',
            verifyStatus: 'CONDITIONAL',
            stack: 'react',
            wrapperSkill: 'steroid-react-implementation',
            freshness: { source: 'verify-feature', reason: 'Deep verification' },
            findings: [{ severity: 'medium', title: 'Browser runtime evidence missing', detail: 'No ui-audit.json' }],
        },
    });
    if (!report.includes('## Frontend Quality')) {
        throw new Error(report);
    }
    if (!report.includes('Frontend policy blockers:') || !report.includes('Override available: --force-ui')) {
        throw new Error(report);
    }
});

console.log(`  ${passed} passed, ${failed} failed`);
module.exports = { passed, failed };
