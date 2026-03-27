#!/usr/bin/env node
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');

const { run } = require('../../src/commands/verify.cjs');

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

function writeGovernedPlan(featureDir) {
    fs.writeFileSync(
        path.join(featureDir, 'plan.md'),
        [
            '# Implementation Plan: Sample Feature',
            '',
            '## Tech Stack',
            '- Node',
            '',
            '## Execution Checklist',
            '- [x] implement the feature',
            '- [x] write tests',
            '',
        ].join('\n'),
    );
}

function writeGovernedTasks(featureDir) {
    fs.writeFileSync(path.join(featureDir, 'tasks.md'), '# Tasks\n\n- done\n');
}

function writeExecutionReceipt(featureDir, feature) {
    writeJson(path.join(featureDir, 'execution.json'), {
        feature,
        status: 'COMPLETE',
        consumed_artifacts: ['plan.md', 'tasks.md'],
        updatedAt: new Date().toISOString(),
        source: 'execution.json',
    });
}

console.log('[unit] verify-command-modules.test.cjs');

const tmpBase = path.join(os.tmpdir(), `steroid-verify-modules-${Date.now()}`);
const changesDir = path.join(tmpBase, '.memory', 'changes');

test('verify-feature blocks when governed execution artifacts are missing', () => {
    const feature = 'missing-execution-artifacts';
    const featureDir = path.join(changesDir, feature);
    fs.mkdirSync(featureDir, { recursive: true });
    writeGovernedPlan(featureDir);
    writeJson(path.join(featureDir, 'review.json'), {
        feature,
        stage1: 'PASS',
        stage2: 'PASS',
        updatedAt: new Date().toISOString(),
    });

    const result = run(['verify-feature', feature], { targetDir: tmpBase });
    if (result.exitCode !== 1) throw new Error(`Unexpected exitCode: ${result.exitCode}`);
    if (!result.stderr.includes('tasks.md is missing for the governed engine path')) {
        throw new Error(`Unexpected stderr: ${result.stderr}`);
    }
    if (!result.stderr.includes(`Next command: node steroid-run.cjs pipeline-status ${feature}`)) {
        throw new Error(`Missing next command: ${result.stderr}`);
    }
});

test('verify-feature writes verify and completion receipts on success', () => {
    const feature = 'verify-success';
    const featureDir = path.join(changesDir, feature);
    fs.mkdirSync(featureDir, { recursive: true });
    fs.mkdirSync(path.join(tmpBase, '.memory', 'knowledge'), { recursive: true });
    writeGovernedPlan(featureDir);
    writeGovernedTasks(featureDir);
    writeExecutionReceipt(featureDir, feature);
    writeJson(path.join(featureDir, 'review.json'), {
        feature,
        stage1: 'PASS',
        stage2: 'PASS',
        updatedAt: new Date().toISOString(),
    });
    fs.writeFileSync(
        path.join(featureDir, 'review.md'),
        [
            '# Review Report: verify-success',
            '',
            '## Stage 1: Spec Compliance Review',
            '| 1 | Acceptance criteria | PASS | src/app.tsx:42 |',
            '**Stage 1 Result:** PASS',
            '',
            '## Stage 2: Code Quality Review',
            '- Verified implementation quality at src/app.tsx:42',
            '**Stage 2 Result:** PASS',
            '',
        ].join('\n'),
    );
    writeJson(path.join(tmpBase, '.memory', 'knowledge', 'tech-stack.json'), {
        language: 'TypeScript',
        framework: 'React',
        packageManager: 'npm',
    });

    const result = run(['verify-feature', feature], {
        targetDir: tmpBase,
        spawn: () => ({ status: 0, stdout: '', stderr: '' }),
    });
    if (result.exitCode !== 0) throw new Error(`Unexpected exitCode: ${result.exitCode} ${result.stderr || ''}`);
    if (!result.stdout.includes('Review gate')) throw new Error(`Unexpected stdout: ${result.stdout}`);
    if (!result.stdout.includes(`Next command: node steroid-run.cjs archive ${feature}`)) {
        throw new Error(`Missing archive guidance: ${result.stdout}`);
    }
    if (!result.stdout.includes('Verification confidence — REDUCED') && !result.stdout.includes('Verification confidence — HIGH')) {
        throw new Error(`Missing confidence line: ${result.stdout}`);
    }

    const verifyReceipt = JSON.parse(fs.readFileSync(path.join(featureDir, 'verify.json'), 'utf-8'));
    const completionReceipt = JSON.parse(fs.readFileSync(path.join(featureDir, 'completion.json'), 'utf-8'));
    if (verifyReceipt.status !== 'PASS') throw new Error(`Unexpected verify receipt: ${JSON.stringify(verifyReceipt)}`);
    if (completionReceipt.status !== 'PASS') {
        throw new Error(`Unexpected completion receipt: ${JSON.stringify(completionReceipt)}`);
    }
    if (JSON.stringify(completionReceipt.sourceArtifacts) !== JSON.stringify(['verify.json', 'progress.md'])) {
        throw new Error(`Unexpected completion source artifacts: ${JSON.stringify(completionReceipt)}`);
    }
    if (!verifyReceipt.confidence) {
        throw new Error(`Missing verify confidence: ${JSON.stringify(verifyReceipt)}`);
    }
});

test('verify-feature refreshes ui-review receipts for UI-intensive features', () => {
    const feature = 'verify-ui-review-artifact';
    const featureDir = path.join(changesDir, feature);
    fs.mkdirSync(featureDir, { recursive: true });
    writeGovernedPlan(featureDir);
    writeGovernedTasks(featureDir);
    writeExecutionReceipt(featureDir, feature);
    writeJson(path.join(featureDir, 'review.json'), {
        feature,
        stage1: 'PASS',
        stage2: 'PASS',
        updatedAt: new Date().toISOString(),
    });
    fs.writeFileSync(
        path.join(featureDir, 'review.md'),
        [
            '# Review Report: verify-ui-review-artifact',
            '',
            '## Stage 1: Spec Compliance Review',
            '| 1 | UI hierarchy updated | PASS | src/dashboard.tsx:18 |',
            '**Stage 1 Result:** PASS',
            '',
            '## Stage 2: Code Quality Review',
            '- Verified component structure in src/dashboard.tsx:18',
            '**Stage 2 Result:** PASS',
            '',
        ].join('\n'),
    );
    writeJson(path.join(featureDir, 'prompt.json'), {
        normalizedSummary: 'Refresh the landing page UI hierarchy',
        recommendedPipeline: 'standard-build',
    });
    writeJson(path.join(featureDir, 'design-routing.json'), {
        stack: 'react',
        auditOnly: false,
        wrapperSkill: 'steroid-react-implementation',
        importedSourceIds: ['steroid-design-system'],
    });
    fs.writeFileSync(path.join(featureDir, 'design-system.md'), '## Design System: verify-ui-review-artifact\n');

    const result = run(['verify-feature', feature], {
        targetDir: tmpBase,
        spawn: () => ({ status: 0, stdout: '', stderr: '' }),
    });
    if (result.exitCode !== 0) throw new Error(`Unexpected exitCode: ${result.exitCode}`);
    if (!result.stdout.includes('UI Review — refreshed from current verification evidence')) {
        throw new Error(`Missing UI review refresh message: ${result.stdout}`);
    }
    if (!fs.existsSync(path.join(featureDir, 'ui-review.md'))) throw new Error('ui-review.md was not written');
    const uiReviewReceipt = JSON.parse(fs.readFileSync(path.join(featureDir, 'ui-review.json'), 'utf-8'));
    if (uiReviewReceipt.freshness?.source !== 'verify-feature') {
        throw new Error(`Unexpected ui review freshness: ${JSON.stringify(uiReviewReceipt)}`);
    }
});

test('verify-feature writes browser-audit evidence into ui-review without legacy fallback', () => {
    const feature = 'verify-mixed-ui-evidence';
    const featureDir = path.join(changesDir, feature);
    fs.mkdirSync(featureDir, { recursive: true });
    writeGovernedPlan(featureDir);
    writeGovernedTasks(featureDir);
    writeExecutionReceipt(featureDir, feature);
    writeJson(path.join(featureDir, 'review.json'), {
        feature,
        stage1: 'PASS',
        stage2: 'PASS',
        updatedAt: new Date().toISOString(),
    });
    fs.writeFileSync(
        path.join(featureDir, 'review.md'),
        [
            '# Review Report: verify-mixed-ui-evidence',
            '',
            '## Stage 1: Spec Compliance Review',
            '| 1 | Dashboard loads | PASS | src/dashboard.tsx:11 |',
            '**Stage 1 Result:** PASS',
            '',
            '## Stage 2: Code Quality Review',
            '- Verified behavior in src/dashboard.tsx:11',
            '**Stage 2 Result:** PASS',
            '',
        ].join('\n'),
    );
    writeJson(path.join(featureDir, 'ui-audit.json'), {
        feature,
        finalUrl: 'https://preview.example.com/dashboard',
        target: 'https://preview.example.com/dashboard',
        consoleMessages: [],
        pageErrors: [],
        failedRequests: [],
        pageTitle: 'Mixed Dashboard',
    });

    const result = run(['verify-feature', feature], {
        targetDir: tmpBase,
        spawn: () => ({ status: 0, stdout: '', stderr: '' }),
    });
    if (result.exitCode !== 0) throw new Error(`Unexpected exitCode: ${result.exitCode}`);
    const uiReviewReceipt = JSON.parse(fs.readFileSync(path.join(featureDir, 'ui-review.json'), 'utf-8'));
    if (!uiReviewReceipt.evidence?.browserAudit?.present) {
        throw new Error(`Missing browser-audit evidence: ${JSON.stringify(uiReviewReceipt)}`);
    }
    if (uiReviewReceipt.evidence.designRoutePresent !== false) {
        throw new Error(`Expected no design route evidence: ${JSON.stringify(uiReviewReceipt)}`);
    }
});

test('verify-feature removes stale completion receipts on failure', () => {
    const feature = 'verify-clears-stale-completion';
    const featureDir = path.join(changesDir, feature);
    fs.mkdirSync(featureDir, { recursive: true });
    writeGovernedPlan(featureDir);
    writeGovernedTasks(featureDir);
    writeExecutionReceipt(featureDir, feature);
    writeJson(path.join(featureDir, 'review.json'), {
        feature,
        stage1: 'FAIL',
        stage2: 'PASS',
        updatedAt: new Date().toISOString(),
    });
    writeJson(path.join(featureDir, 'completion.json'), {
        feature,
        status: 'PASS',
        sourceArtifacts: ['verify.json'],
    });

    const result = run(['verify-feature', feature], { targetDir: tmpBase });
    if (result.exitCode !== 1) throw new Error(`Unexpected exitCode: ${result.exitCode}`);
    if (fs.existsSync(path.join(featureDir, 'completion.json'))) {
        throw new Error('stale completion.json was not removed');
    }
});

test('verify-feature blocks review receipts that lack real review evidence', () => {
    const feature = 'verify-weak-review-evidence';
    const featureDir = path.join(changesDir, feature);
    fs.mkdirSync(featureDir, { recursive: true });
    writeGovernedPlan(featureDir);
    writeGovernedTasks(featureDir);
    writeExecutionReceipt(featureDir, feature);
    writeJson(path.join(featureDir, 'review.json'), {
        feature,
        stage1: 'PASS',
        stage2: 'PASS',
        updatedAt: new Date().toISOString(),
    });
    fs.writeFileSync(
        path.join(featureDir, 'review.md'),
        [
            '# Review Report: verify-weak-review-evidence',
            '',
            '## Stage 1: Spec Compliance Review',
            '| 1 | _from spec.md_ | _status_ | _file:line_ |',
            '**Stage 1 Result:** PASS',
            '',
            '## Stage 2: Code Quality Review',
            '**Stage 2 Result:** PASS',
            '',
        ].join('\n'),
    );

    const result = run(['verify-feature', feature], { targetDir: tmpBase });
    if (result.exitCode !== 1) throw new Error(`Unexpected exitCode: ${result.exitCode}`);
    if (!result.stderr.includes('review.md still contains the default review template placeholders')) {
        throw new Error(`Unexpected stderr: ${result.stderr}`);
    }
});

test('verify-feature blocks malformed governed diagnosis artifacts', () => {
    const feature = 'verify-bad-diagnosis';
    const featureDir = path.join(changesDir, feature);
    fs.mkdirSync(featureDir, { recursive: true });
    fs.writeFileSync(path.join(featureDir, 'diagnosis.md'), '# Diagnosis\n\n- [x] Fix it\n');
    writeJson(path.join(featureDir, 'review.json'), {
        feature,
        stage1: 'PASS',
        stage2: 'PASS',
        updatedAt: new Date().toISOString(),
    });
    fs.writeFileSync(
        path.join(featureDir, 'review.md'),
        [
            '# Review Report: verify-bad-diagnosis',
            '',
            '## Stage 1: Spec Compliance Review',
            '| 1 | Fix path confirmed | PASS | src/fix.ts:9 |',
            '**Stage 1 Result:** PASS',
            '',
            '## Stage 2: Code Quality Review',
            '- Verified fix path in src/fix.ts:9',
            '**Stage 2 Result:** PASS',
            '',
        ].join('\n'),
    );

    const result = run(['verify-feature', feature], { targetDir: tmpBase });
    if (result.exitCode !== 1) throw new Error(`Unexpected exitCode: ${result.exitCode}`);
    if (!result.stderr.includes('diagnosis.md is missing governed structure')) {
        throw new Error(`Unexpected stderr: ${result.stderr}`);
    }
});

test('verify-feature rejects invalid --url values before fallback', () => {
    const feature = 'verify-invalid-url';
    const featureDir = path.join(changesDir, feature);
    fs.mkdirSync(featureDir, { recursive: true });
    writeGovernedPlan(featureDir);
    writeGovernedTasks(featureDir);
    writeExecutionReceipt(featureDir, feature);
    writeJson(path.join(featureDir, 'review.json'), {
        feature,
        stage1: 'PASS',
        stage2: 'PASS',
        updatedAt: new Date().toISOString(),
    });
    fs.writeFileSync(
        path.join(featureDir, 'review.md'),
        [
            '# Review Report: verify-invalid-url',
            '',
            '## Stage 1: Spec Compliance Review',
            '| 1 | URL path supported | PASS | src/app.tsx:5 |',
            '**Stage 1 Result:** PASS',
            '',
            '## Stage 2: Code Quality Review',
            '- Verified preview flow in src/app.tsx:5',
            '**Stage 2 Result:** PASS',
            '',
        ].join('\n'),
    );

    const result = run(['verify-feature', feature, '--url', 'not-a-url'], { targetDir: tmpBase });
    if (result.exitCode !== 1) throw new Error(`Unexpected exitCode: ${result.exitCode}`);
    if (!result.stderr.includes('--url must be a valid http(s) URL or hostname.')) {
        throw new Error(`Unexpected stderr: ${result.stderr}`);
    }
    if (!result.stderr.includes(`Next command: node steroid-run.cjs verify-feature ${feature} --url https://preview.example.com`)) {
        throw new Error(`Missing next command: ${result.stderr}`);
    }
});

test('verify-feature handles deep branches without legacy fallback', () => {
    const feature = 'verify-deep-modular';
    const featureDir = path.join(changesDir, feature);
    fs.mkdirSync(featureDir, { recursive: true });
    writeGovernedPlan(featureDir);
    writeGovernedTasks(featureDir);
    writeExecutionReceipt(featureDir, feature);
    writeJson(path.join(featureDir, 'review.json'), {
        feature,
        stage1: 'PASS',
        stage2: 'PASS',
        updatedAt: new Date().toISOString(),
    });
    fs.writeFileSync(
        path.join(featureDir, 'review.md'),
        [
            '# Review Report: verify-deep-modular',
            '',
            '## Stage 1: Spec Compliance Review',
            '| 1 | Deep dashboard route | PASS | src/dashboard.tsx:21 |',
            '**Stage 1 Result:** PASS',
            '',
            '## Stage 2: Code Quality Review',
            '- Verified route quality in src/dashboard.tsx:21',
            '**Stage 2 Result:** PASS',
            '',
        ].join('\n'),
    );
    writeJson(path.join(featureDir, 'prompt.json'), {
        normalizedSummary: 'Review the dashboard UI in depth',
        pipelineHint: 'scan → vibe → specify → research → architect → engine → verify',
    });
    writeJson(path.join(featureDir, 'design-routing.json'), {
        feature,
        stack: 'react',
        auditOnly: false,
        wrapperSkill: 'steroid-react-implementation',
        sourceInputIds: ['steroid-design-system'],
    });
    writeJson(path.join(tmpBase, '.memory', 'knowledge', 'tech-stack.json'), {
        language: 'TypeScript',
        framework: 'React',
        packageManager: 'npm',
    });

    const result = run(['verify-feature', feature, '--deep', '--url', 'https://example.test/dashboard'], {
        targetDir: tmpBase,
        spawn: (command, args) => {
            if (command === 'npm') return { status: 0, stdout: '', stderr: '' };
            if (command === 'npx') return { status: 0, stdout: '', stderr: '' };
            if (command === process.execPath) {
                return {
                    status: 0,
                    stdout: JSON.stringify({
                        ok: true,
                        finalUrl: 'https://example.test/dashboard',
                        target: 'https://example.test/dashboard',
                        consoleMessages: [],
                        pageErrors: [],
                        failedRequests: [],
                        pageTitle: 'Deep Dashboard',
                        screenshotPath: path.join(featureDir, 'ui-audit.png'),
                    }),
                    stderr: '',
                };
            }
            return { status: 0, stdout: '', stderr: '' };
        },
        accesslintAudit: () => ({
            fileCount: 1,
            violationCount: 0,
            highestImpact: 'none',
            results: [],
        }),
    });

    if (result.exitCode !== 0) throw new Error(`Unexpected exitCode: ${result.exitCode} ${result.stderr || ''}`);
    if (!result.stdout.includes('Deep scan: Playwright UI audit')) {
        throw new Error(`Missing deep browser audit output: ${result.stdout}`);
    }

    const verifyReceipt = JSON.parse(fs.readFileSync(path.join(featureDir, 'verify.json'), 'utf-8'));
    if (!verifyReceipt.deepRequested || !verifyReceipt.deepCompleted) {
        throw new Error(`Deep verification flags not set: ${JSON.stringify(verifyReceipt)}`);
    }
    if (!fs.existsSync(path.join(featureDir, 'ui-audit.json'))) {
        throw new Error('ui-audit.json was not written');
    }
    const previewUrl = fs.readFileSync(path.join(featureDir, 'preview-url.txt'), 'utf-8').trim();
    if (previewUrl !== 'https://example.test/dashboard') {
        throw new Error(`Unexpected preview-url.txt content: ${previewUrl}`);
    }
});

console.log(`  ${passed} passed, ${failed} failed`);
module.exports = { passed, failed };
