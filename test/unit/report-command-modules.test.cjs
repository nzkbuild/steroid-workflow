#!/usr/bin/env node
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');

const { run } = require('../../src/commands/report.cjs');

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

console.log('[unit] report-command-modules.test.cjs');

const tmpBase = path.join(os.tmpdir(), `steroid-report-modules-${Date.now()}`);
const memoryDir = path.join(tmpBase, '.memory');
const changesDir = path.join(memoryDir, 'changes');
const reportsDir = path.join(memoryDir, 'reports');
const feature = 'sample-feature';
const featureDir = path.join(changesDir, feature);

fs.mkdirSync(featureDir, { recursive: true });

writeJson(path.join(memoryDir, 'execution_state.json'), {
    error_count: 1,
    status: 'warning',
    last_error: 'example failure',
    error_history: [{ command: 'npm test', error: 'failed once' }],
});

fs.writeFileSync(
    path.join(featureDir, 'spec.md'),
    [
        '# Specification: Sample Feature',
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
        '# Implementation Plan: Sample Feature',
        '',
        '## Tech Stack',
        '- Node',
        '',
        '## Execution Checklist',
        '- [x] implement report generation',
        '- [ ] finish archive pass',
        '',
    ].join('\n'),
);
fs.writeFileSync(
    path.join(featureDir, 'verify.md'),
    [
        '# Verify: Sample Feature',
        '',
        '**Status:** PASS',
        '**Spec Score:** 2/2',
        '**Result:** Tests green',
        '',
    ].join('\n'),
);
fs.writeFileSync(
    path.join(featureDir, 'review.md'),
    [
        '# Review Report: Sample Feature',
        '',
        '## Review Status',
        '',
        '- Stage 1 (Spec): PASS',
        '- Stage 2 (Quality): PASS',
        '',
    ].join('\n'),
);
writeJson(path.join(featureDir, 'prompt.json'), {
    primaryIntent: 'feature',
    continuationState: 'new',
    complexity: 'medium',
    ambiguity: 'low',
    recommendedPipeline: 'research',
});
writeJson(path.join(featureDir, 'verify.json'), {
    feature,
    status: 'PASS',
    reviewPassed: true,
    checks: {},
    deepRequested: false,
    deepCompleted: false,
    updatedAt: new Date().toISOString(),
    source: 'verify.json',
});
writeJson(path.join(featureDir, 'ui-review.json'), {
    feature,
    status: 'PASS',
    verifyStatus: 'PASS',
    stack: 'react',
    wrapperSkill: 'steroid-react-implementation',
    freshness: {
        source: 'verify-feature',
        reason: 'Deep verification',
    },
    findings: [],
});

test('report generates a bug report by default', () => {
    const result = run(['report'], { targetDir: tmpBase, version: '7.0.0-beta.1' });
    if (result.exitCode !== 0) throw new Error(`Unexpected exitCode: ${result.exitCode}`);
    if (!result.stdout.includes('Bug report saved')) throw new Error(`Unexpected stdout: ${result.stdout}`);
    const bugReport = fs.readFileSync(path.join(memoryDir, 'bug-report.md'), 'utf-8');
    if (!bugReport.includes('Steroid Workflow Bug Report')) throw new Error('Bug report file was not created');
    if (!bugReport.includes('example failure')) throw new Error('Bug report is missing execution state details');
});

test('report generate writes a handoff report', () => {
    const result = run(['report', 'generate', feature], { targetDir: tmpBase, version: '7.0.0-beta.1' });
    if (result.exitCode !== 0) throw new Error(`Unexpected exitCode: ${result.exitCode} ${result.stderr || ''}`);
    if (!result.stdout.includes(`.memory/reports/${feature}.md`)) throw new Error(`Unexpected stdout: ${result.stdout}`);
    const report = fs.readFileSync(path.join(reportsDir, `${feature}.md`), 'utf-8');
    if (!report.includes('# Handoff Report: sample-feature')) throw new Error(report);
    if (!report.includes('## Frontend Quality')) throw new Error(report);
});

test('report show prints a generated report', () => {
    const result = run(['report', 'show', feature], { targetDir: tmpBase });
    if (result.exitCode !== 0) throw new Error(`Unexpected exitCode: ${result.exitCode}`);
    if (!result.stdout.includes('# Handoff Report: sample-feature')) throw new Error(`Unexpected stdout: ${result.stdout}`);
});

test('report list summarizes available reports', () => {
    const result = run(['report', 'list'], { targetDir: tmpBase });
    if (result.exitCode !== 0) throw new Error(`Unexpected exitCode: ${result.exitCode}`);
    if (!result.stdout.includes('Handoff Reports')) throw new Error(`Missing list header: ${result.stdout}`);
    if (!result.stdout.includes('sample-feature')) throw new Error(`Missing report listing: ${result.stdout}`);
});

test('report generate blocks malformed governed artifacts', () => {
    const brokenFeature = 'broken-feature';
    const brokenDir = path.join(changesDir, brokenFeature);
    fs.mkdirSync(brokenDir, { recursive: true });
    fs.writeFileSync(path.join(brokenDir, 'spec.md'), '# Specification: Broken\n');

    const result = run(['report', 'generate', brokenFeature], { targetDir: tmpBase });
    if (result.exitCode !== 1) throw new Error(`Unexpected exitCode: ${result.exitCode}`);
    if (!result.stderr.includes('REPORT BLOCKED')) throw new Error(`Unexpected stderr: ${result.stderr}`);
});

console.log(`  ${passed} passed, ${failed} failed`);
module.exports = { passed, failed };
