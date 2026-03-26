#!/usr/bin/env node
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const {
    handleArchive,
    handleCheckPlan,
    handleCommit,
    handleGate,
    handleGitInit,
    handleInitFeature,
    handleLog,
    handleReset,
    handleRecover,
    handleSmokeTest,
    handleStatus,
    handleStories,
    handleVerify,
} = require('../../src/commands/pipeline.cjs');

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

console.log('[unit] pipeline-command-modules.test.cjs');

const tmpBase = path.join(os.tmpdir(), `steroid-pipeline-modules-${Date.now()}`);
fs.mkdirSync(tmpBase, { recursive: true });
fs.mkdirSync(path.join(tmpBase, '.memory'), { recursive: true });

test('handleStatus renders current circuit breaker state', () => {
    const stateFile = path.join(tmpBase, '.memory', 'execution_state.json');
    fs.writeFileSync(
        stateFile,
        JSON.stringify(
            {
                error_count: 2,
                last_error: 'sample failure',
                recovery_actions: ['L1 recovery', 'L2 recovery'],
            },
            null,
            2,
        ),
    );

    const result = handleStatus({ targetDir: tmpBase, stateFile });
    if (result.exitCode !== 0) throw new Error(`Unexpected exitCode: ${result.exitCode}`);
    if (!result.stdout.includes('Error Count: 2/5')) throw new Error(`Missing error count: ${result.stdout}`);
    if (!result.stdout.includes('sample failure')) throw new Error(`Missing last error: ${result.stdout}`);
    if (!result.stdout.includes('L1 recovery')) throw new Error(`Missing recovery actions: ${result.stdout}`);
});

test('handleReset clears circuit breaker state', () => {
    const stateFile = path.join(tmpBase, '.memory', 'execution_state.json');
    fs.writeFileSync(
        stateFile,
        JSON.stringify(
            {
                error_count: 4,
                last_error: 'broken run',
                status: 'tripped',
                recovery_actions: ['L1 recovery'],
                error_history: ['old failure'],
            },
            null,
            2,
        ),
    );

    const result = handleReset({ targetDir: tmpBase, stateFile });
    if (result.exitCode !== 0) throw new Error(`Unexpected exitCode: ${result.exitCode}`);
    if (!result.stdout.includes('Circuit breaker reset')) throw new Error(`Unexpected stdout: ${result.stdout}`);
    const state = JSON.parse(fs.readFileSync(stateFile, 'utf-8'));
    if (state.error_count !== 0) throw new Error(`Expected error_count reset, got ${state.error_count}`);
    if (state.last_error !== null) throw new Error(`Expected last_error reset, got ${state.last_error}`);
    if (state.status !== 'active') throw new Error(`Expected active status, got ${state.status}`);
    if ((state.recovery_actions || []).length !== 0) throw new Error('Expected recovery actions cleared');
    if ((state.error_history || []).length !== 0) throw new Error('Expected error history cleared');
});

test('handleRecover exits cleanly when no errors exist', () => {
    const stateFile = path.join(tmpBase, '.memory', 'execution_state.json');
    fs.writeFileSync(
        stateFile,
        JSON.stringify({ error_count: 0, last_error: null, status: 'active', recovery_actions: [] }, null, 2),
    );

    const result = handleRecover({ targetDir: tmpBase, stateFile });
    if (result.exitCode !== 0) throw new Error(`Unexpected exitCode: ${result.exitCode}`);
    if (!result.stdout.includes('No errors to recover from')) throw new Error(`Unexpected stdout: ${result.stdout}`);
});

test('handleRecover records recovery action for escalated levels', () => {
    const stateFile = path.join(tmpBase, '.memory', 'execution_state.json');
    fs.writeFileSync(
        stateFile,
        JSON.stringify(
            {
                error_count: 4,
                last_error: 'persistent failure',
                status: 'active',
                recovery_actions: [],
                error_history: ['one', 'two'],
            },
            null,
            2,
        ),
    );

    const result = handleRecover({ targetDir: tmpBase, stateFile });
    if (result.exitCode !== 0) throw new Error(`Unexpected exitCode: ${result.exitCode}`);
    if (!result.stdout.includes('Level 4: ESCALATED')) throw new Error(`Unexpected stdout: ${result.stdout}`);
    const state = JSON.parse(fs.readFileSync(stateFile, 'utf-8'));
    if (!(state.recovery_actions || []).some((entry) => entry.includes('L4 recovery'))) {
        throw new Error(`Missing L4 recovery action: ${JSON.stringify(state)}`);
    }
});

test('handleInitFeature creates a governed feature folder', () => {
    const result = handleInitFeature(['init-feature', 'habit-tracker'], { targetDir: tmpBase });
    if (result.exitCode !== 0) throw new Error(`Unexpected exitCode: ${result.exitCode}`);
    if (!result.stdout.includes('Feature folder created')) throw new Error(`Unexpected stdout: ${result.stdout}`);
    if (!fs.existsSync(path.join(tmpBase, '.memory', 'changes', 'habit-tracker', 'archive'))) {
        throw new Error('Feature archive directory was not created');
    }
});

test('handleGate passes vibe when request and context receipts exist', () => {
    const feature = 'gate-vibe-pass';
    const featureDir = path.join(tmpBase, '.memory', 'changes', feature);
    fs.mkdirSync(featureDir, { recursive: true });
    fs.writeFileSync(
        path.join(featureDir, 'request.json'),
        JSON.stringify({ feature, requestedAt: new Date().toISOString(), source: 'scan', summary: 'test' }, null, 2),
    );
    fs.writeFileSync(path.join(featureDir, 'context.md'), '# Context\n\nLine 1\nLine 2\nLine 3\nLine 4\n');

    const result = handleGate(['gate', 'vibe', feature], { targetDir: tmpBase });
    if (result.exitCode !== 0) throw new Error(`Unexpected exitCode: ${result.exitCode}`);
    if (!result.stdout.includes('Gate passed')) throw new Error(`Unexpected stdout: ${result.stdout}`);
});

test('handleGate blocks vibe when request receipt is missing', () => {
    const feature = 'gate-vibe-block';
    const featureDir = path.join(tmpBase, '.memory', 'changes', feature);
    fs.mkdirSync(featureDir, { recursive: true });
    fs.writeFileSync(path.join(featureDir, 'context.md'), '# Context\n\nLine 1\nLine 2\nLine 3\nLine 4\n');

    const result = handleGate(['gate', 'vibe', feature], { targetDir: tmpBase });
    if (result.exitCode !== 1) throw new Error(`Unexpected exitCode: ${result.exitCode}`);
    if (!result.stderr.includes('governed scan receipt is incomplete')) {
        throw new Error(`Unexpected stderr: ${result.stderr}`);
    }
});

test('handleCommit blocks when no git repository exists', () => {
    const result = handleCommit(['commit', 'test message'], { targetDir: tmpBase });
    if (result.exitCode !== 1) throw new Error(`Unexpected exitCode: ${result.exitCode}`);
    if (!result.stderr.includes('No .git repository found')) throw new Error(`Unexpected stderr: ${result.stderr}`);
});

test('handleLog appends to progress log', () => {
    const result = handleLog(['log', 'habit-tracker', 'Implemented', 'card'], { targetDir: tmpBase });
    if (result.exitCode !== 0) throw new Error(`Unexpected exitCode: ${result.exitCode}`);
    if (!result.stdout.includes('Logged: Implemented card')) throw new Error(`Unexpected stdout: ${result.stdout}`);
    const progressPath = path.join(tmpBase, '.memory', 'progress.md');
    const content = fs.readFileSync(progressPath, 'utf-8');
    if (!content.includes('habit-tracker: Implemented card')) {
        throw new Error(`Missing progress entry: ${content}`);
    }
});

test('handleCheckPlan writes tasks artifact and reports remaining work', () => {
    const feature = 'check-plan-feature';
    const featureDir = path.join(tmpBase, '.memory', 'changes', feature);
    fs.mkdirSync(featureDir, { recursive: true });
    fs.writeFileSync(
        path.join(featureDir, 'plan.md'),
        '# Implementation Plan: Test\n\n## Tech Stack\n- Runtime: node\n\n## Execution Checklist\n\n- [x] P1: First task\n- [ ] P2: Second task\n',
    );

    const result = handleCheckPlan(['check-plan', feature], { targetDir: tmpBase });
    if (result.exitCode !== 1) throw new Error(`Unexpected exitCode: ${result.exitCode}`);
    if (!result.stdout.includes('1 tasks remaining')) throw new Error(`Unexpected stdout: ${result.stdout}`);
    if (!fs.existsSync(path.join(featureDir, 'tasks.md'))) throw new Error('tasks.md was not written');
});

test('handleStories lists prioritized stories from plan.md', () => {
    const feature = 'stories-feature';
    const featureDir = path.join(tmpBase, '.memory', 'changes', feature);
    fs.mkdirSync(featureDir, { recursive: true });
    fs.writeFileSync(
        path.join(featureDir, 'plan.md'),
        '# Implementation Plan: Stories\n\n## Tech Stack\n- Runtime: node\n\n## Execution Checklist\n\n- [ ] P1: Foundation\n- [/] P2: Middle work\n- [x] P3: Nice to have\n',
    );

    const result = handleStories(['stories', feature], { targetDir: tmpBase });
    if (result.exitCode !== 0) throw new Error(`Unexpected exitCode: ${result.exitCode}`);
    if (!result.stdout.includes('P1 — Must Have')) throw new Error(`Unexpected stdout: ${result.stdout}`);
    if (!result.stdout.includes('FOUNDATIONAL BLOCK')) throw new Error(`Unexpected stdout: ${result.stdout}`);
});

test('handleSmokeTest skips when no recognized project file exists', () => {
    const smokeRoot = path.join(tmpBase, 'smoke-skip');
    fs.mkdirSync(smokeRoot, { recursive: true });
    const result = handleSmokeTest({ targetDir: smokeRoot });
    if (result.exitCode !== 0) throw new Error(`Unexpected exitCode: ${result.exitCode}`);
    if (!result.stdout.includes('No recognized project file')) throw new Error(`Unexpected stdout: ${result.stdout}`);
});

test('handleGitInit skips when git is already initialized', () => {
    const gitRoot = path.join(tmpBase, 'git-init-skip');
    fs.mkdirSync(path.join(gitRoot, '.git'), { recursive: true });
    const result = handleGitInit({ targetDir: gitRoot });
    if (result.exitCode !== 0) throw new Error(`Unexpected exitCode: ${result.exitCode}`);
    if (!result.stdout.includes('Git already initialized')) throw new Error(`Unexpected stdout: ${result.stdout}`);
});

test('handleArchive blocks when verify receipt is missing', () => {
    const feature = 'archive-missing-verify';
    const featureDir = path.join(tmpBase, '.memory', 'changes', feature);
    fs.mkdirSync(featureDir, { recursive: true });
    const result = handleArchive(['archive', feature], { targetDir: tmpBase, version: '7.0.0-beta.1' });
    if (result.exitCode !== 1) throw new Error(`Unexpected exitCode: ${result.exitCode}`);
    if (!result.stderr.includes('No verify.json receipt found')) throw new Error(`Unexpected stderr: ${result.stderr}`);
});

test('handleArchive archives verified feature artifacts and writes report', () => {
    const feature = 'archive-success';
    const featureDir = path.join(tmpBase, '.memory', 'changes', feature);
    fs.mkdirSync(path.join(featureDir, 'archive'), { recursive: true });
    fs.writeFileSync(path.join(featureDir, 'spec.md'), '# Specification: Archive Success\n\n## User Stories\n\n### Story 1\n- As a user, I want archive\n**Acceptance Criteria:**\n- Given success\n\n## Success Criteria\n- archived\n');
    fs.writeFileSync(path.join(featureDir, 'plan.md'), '# Implementation Plan: Archive Success\n\n## Tech Stack\n- Runtime: node\n\n## Execution Checklist\n\n- [x] P1: done\n');
    fs.writeFileSync(path.join(featureDir, 'verify.md'), '# Verify Report: archive-success\n\n**Status:** PASS\n**Spec Score:** 1/1\n**Result:** Verification passed\n');
    fs.writeFileSync(path.join(featureDir, 'review.md'), '**Stage 1 Result:** PASS\n**Stage 2 Result:** PASS\n');
    fs.writeFileSync(path.join(featureDir, 'verify.json'), JSON.stringify({ feature, status: 'PASS', source: 'verify.json' }, null, 2));
    fs.writeFileSync(
        path.join(featureDir, 'completion.json'),
        JSON.stringify({ feature, status: 'PASS', sourceArtifacts: ['verify.json'], nextActions: ['archive'] }, null, 2),
    );
    const result = handleArchive(['archive', feature], { targetDir: tmpBase, version: '7.0.0-beta.1' });
    if (result.exitCode !== 0) throw new Error(`Unexpected exitCode: ${result.exitCode}`);
    if (!result.stdout.includes('Archived')) throw new Error(`Unexpected stdout: ${result.stdout}`);
    if (!fs.existsSync(path.join(tmpBase, '.memory', 'reports', `${feature}.md`))) {
        throw new Error('handoff report was not written');
    }
    const archiveEntries = fs.readdirSync(path.join(featureDir, 'archive'));
    if (!archiveEntries.some((entry) => entry.endsWith('verify.json'))) {
        throw new Error(`verify.json was not archived: ${JSON.stringify(archiveEntries)}`);
    }
});

test('handleVerify succeeds for files meeting the minimum line count', () => {
    const filePath = path.join(tmpBase, 'enough-lines.txt');
    fs.writeFileSync(filePath, 'one\ntwo\nthree\n');
    const result = handleVerify(['verify', 'enough-lines.txt', '--min-lines=3'], { targetDir: tmpBase });
    if (result.exitCode !== 0) throw new Error(`Unexpected exitCode: ${result.exitCode}`);
    if (!result.stdout.includes('passes validation')) throw new Error(`Unexpected output: ${result.stdout}`);
});

test('handleVerify blocks files outside the project root', () => {
    const outside = path.join(os.tmpdir(), `outside-${Date.now()}.txt`);
    fs.writeFileSync(outside, 'one\ntwo\nthree\n');
    const relOutside = path.relative(tmpBase, outside);
    const result = handleVerify(['verify', relOutside, '--min-lines=3'], { targetDir: tmpBase });
    if (result.exitCode !== 1) throw new Error(`Unexpected exitCode: ${result.exitCode}`);
    if (!result.stderr.includes('current project root')) throw new Error(`Unexpected stderr: ${result.stderr}`);
});

test('handleVerify blocks summarized files below the minimum line count', () => {
    const filePath = path.join(tmpBase, 'too-short.txt');
    fs.writeFileSync(filePath, 'one\ntwo');
    const result = handleVerify(['verify', 'too-short.txt', '--min-lines=3'], { targetDir: tmpBase });
    if (result.exitCode !== 1) throw new Error(`Unexpected exitCode: ${result.exitCode}`);
    if (!result.stderr.includes('AI SHORTCUT DETECTED')) throw new Error(`Unexpected stderr: ${result.stderr}`);
});

console.log(`  ${passed} passed, ${failed} failed`);
module.exports = { passed, failed };
