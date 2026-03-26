#!/usr/bin/env node
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');

const { run } = require('../../src/commands/review.cjs');

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

console.log('[unit] review-command-modules.test.cjs');

const tmpBase = path.join(os.tmpdir(), `steroid-review-modules-${Date.now()}`);
const feature = 'reviewable-feature';
const featureDir = path.join(tmpBase, '.memory', 'changes', feature);
fs.mkdirSync(featureDir, { recursive: true });

fs.writeFileSync(
    path.join(featureDir, 'spec.md'),
    [
        '# Specification: Reviewable Feature',
        '',
        '## User Stories',
        '### Story 1',
        '**Acceptance Criteria:**',
        '- Given a user opens the page',
        '',
        '## Success Criteria',
        '- Then the change persists',
        '',
    ].join('\n'),
);
fs.writeFileSync(
    path.join(featureDir, 'plan.md'),
    [
        '# Implementation Plan: Reviewable Feature',
        '',
        '## Tech Stack',
        '- Node',
        '',
        '## Execution Checklist',
        '- [x] create review flow',
        '',
    ].join('\n'),
);

test('review help prints the two-stage review usage', () => {
    const result = run(['review'], { targetDir: tmpBase, version: '7.0.0-beta.1' });
    if (result.exitCode !== 0) throw new Error(`Unexpected exitCode: ${result.exitCode}`);
    if (!result.stdout.includes('Two-stage review system')) throw new Error(`Unexpected stdout: ${result.stdout}`);
    if (!result.stdout.includes('review ui <feature>')) throw new Error(`Missing ui usage: ${result.stdout}`);
});

test('review spec writes template and receipt', () => {
    const result = run(['review', 'spec', feature], { targetDir: tmpBase, version: '7.0.0-beta.1' });
    if (result.exitCode !== 0) throw new Error(`Unexpected exitCode: ${result.exitCode}`);
    if (!result.stdout.includes('Review template written')) throw new Error(`Unexpected stdout: ${result.stdout}`);

    const reviewMd = fs.readFileSync(path.join(featureDir, 'review.md'), 'utf-8');
    const reviewJson = JSON.parse(fs.readFileSync(path.join(featureDir, 'review.json'), 'utf-8'));
    if (!reviewMd.includes('## Stage 1: Spec Compliance Review')) throw new Error(reviewMd);
    if (reviewJson.stage1 !== 'PENDING' || reviewJson.stage2 !== 'PENDING') {
        throw new Error(`Unexpected review receipt: ${JSON.stringify(reviewJson)}`);
    }
});

test('review status summarizes synced receipt state', () => {
    fs.writeFileSync(
        path.join(featureDir, 'review.md'),
        '**Stage 1 Result:** PASS\n**Stage 2 Result:** FAIL\n',
    );
    fs.writeFileSync(
        path.join(featureDir, 'ui-review.json'),
        JSON.stringify({ feature, status: 'CONDITIONAL' }, null, 2),
    );

    const result = run(['review', 'status', feature], { targetDir: tmpBase });
    if (result.exitCode !== 0) throw new Error(`Unexpected exitCode: ${result.exitCode}`);
    if (!result.stdout.includes('Stage 1 (Spec Compliance): PASS')) throw new Error(`Unexpected stdout: ${result.stdout}`);
    if (!result.stdout.includes('Stage 2 (Code Quality): FAIL')) throw new Error(`Unexpected stdout: ${result.stdout}`);
    if (!result.stdout.includes('UI Review: CONDITIONAL')) throw new Error(`Unexpected stdout: ${result.stdout}`);
    const reviewJson = JSON.parse(fs.readFileSync(path.join(featureDir, 'review.json'), 'utf-8'));
    if (reviewJson.stage1 !== 'PASS' || reviewJson.stage2 !== 'FAIL') {
        throw new Error(`Review receipt did not sync from markdown: ${JSON.stringify(reviewJson)}`);
    }
});

test('review quality blocks until stage 1 passes', () => {
    fs.writeFileSync(
        path.join(featureDir, 'review.md'),
        '**Stage 1 Result:** FAIL\n**Stage 2 Result:** PENDING\n',
    );
    const result = run(['review', 'quality', feature], { targetDir: tmpBase });
    if (result.exitCode !== 1) throw new Error(`Unexpected exitCode: ${result.exitCode}`);
    if (!result.stderr.includes('REVIEW GATE')) throw new Error(`Unexpected stderr: ${result.stderr}`);
});

test('review quality prints next-step guidance once stage 1 passes', () => {
    fs.writeFileSync(
        path.join(featureDir, 'review.md'),
        '**Stage 1 Result:** PASS\n**Stage 2 Result:** PENDING\n',
    );
    const result = run(['review', 'quality', feature], { targetDir: tmpBase });
    if (result.exitCode !== 0) throw new Error(`Unexpected exitCode: ${result.exitCode}`);
    if (!result.stdout.includes('Stage 2: Code Quality Review')) throw new Error(`Unexpected stdout: ${result.stdout}`);
});

test('review reset removes local review artifacts', () => {
    const result = run(['review', 'reset', feature], { targetDir: tmpBase });
    if (result.exitCode !== 0) throw new Error(`Unexpected exitCode: ${result.exitCode}`);
    if (!result.stdout.includes('Review reset')) throw new Error(`Unexpected stdout: ${result.stdout}`);
    if (fs.existsSync(path.join(featureDir, 'review.md'))) throw new Error('review.md still exists');
    if (fs.existsSync(path.join(featureDir, 'review.json'))) throw new Error('review.json still exists');
});

test('review ui refreshes frontend review receipts', () => {
    fs.writeFileSync(
        path.join(featureDir, 'prompt.json'),
        JSON.stringify(
            {
                normalizedSummary: 'Polish the dashboard UI hierarchy',
                recommendedPipeline: 'standard-build',
            },
            null,
            2,
        ),
    );
    fs.writeFileSync(
        path.join(featureDir, 'design-routing.json'),
        JSON.stringify(
            {
                stack: 'react',
                auditOnly: false,
                wrapperSkill: 'steroid-react-implementation',
                importedSourceIds: ['steroid-design-system'],
            },
            null,
            2,
        ),
    );
    fs.writeFileSync(path.join(featureDir, 'design-system.md'), '## Design System: reviewable-feature\n');
    fs.writeFileSync(
        path.join(featureDir, 'accessibility.json'),
        JSON.stringify({ violationCount: 0, highestImpact: 'none', fileCount: 1 }, null, 2),
    );

    const result = run(['review', 'ui', feature], { targetDir: tmpBase });
    if (result.exitCode !== 0) throw new Error(`Unexpected exitCode: ${result.exitCode}`);
    if (!result.stdout.includes('UI Review for')) throw new Error(`Unexpected stdout: ${result.stdout}`);
    if (!fs.existsSync(path.join(featureDir, 'ui-review.md'))) throw new Error('ui-review.md was not written');
    if (!fs.existsSync(path.join(featureDir, 'ui-review.json'))) throw new Error('ui-review.json was not written');
    const uiReview = fs.readFileSync(path.join(featureDir, 'ui-review.md'), 'utf-8');
    if (!uiReview.includes('## Review Checklist')) throw new Error(`Missing review checklist: ${uiReview}`);
    if (!uiReview.includes('keyboard-operable')) throw new Error(`Missing web review guidance: ${uiReview}`);
});

console.log(`  ${passed} passed, ${failed} failed`);
module.exports = { passed, failed };
