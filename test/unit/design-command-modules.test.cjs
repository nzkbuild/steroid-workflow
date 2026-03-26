#!/usr/bin/env node
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');

const { run } = require('../../src/commands/design.cjs');

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

console.log('[unit] design-command-modules.test.cjs');

const tmpBase = path.join(os.tmpdir(), `steroid-design-modules-${Date.now()}`);
const feature = 'ui-refresh';
const featureDir = path.join(tmpBase, '.memory', 'changes', feature);
fs.mkdirSync(featureDir, { recursive: true });

fs.writeFileSync(
    path.join(featureDir, 'prompt.json'),
    JSON.stringify(
        {
            feature,
            normalizedSummary: 'Redesign the analytics dashboard for better hierarchy',
            pipelineHint: 'scan → vibe → specify → research → architect → engine → verify',
        },
        null,
        2,
    ),
);

test('design-route writes a routing receipt for an existing feature', () => {
    const result = run(
        ['design-route', 'redesign the analytics dashboard', '--feature', feature, '--write'],
        { targetDir: tmpBase },
    );
    if (result.exitCode !== 0) throw new Error(`Unexpected exitCode: ${result.exitCode}`);
    if (!result.stdout.includes('Design Route')) throw new Error(`Unexpected stdout: ${result.stdout}`);

    const receipt = JSON.parse(fs.readFileSync(path.join(featureDir, 'design-routing.json'), 'utf-8'));
    if (!Array.isArray(receipt.sourceInputIds) || receipt.sourceInputIds.length === 0) {
        throw new Error(`Expected sourceInputIds in receipt: ${JSON.stringify(receipt)}`);
    }
    if (receipt.source !== 'design-route') throw new Error(`Unexpected source: ${receipt.source}`);
});

test('design-prep can derive prompt context from feature artifacts and write outputs', () => {
    const result = run(['design-prep', '--feature', feature, '--write', '--force'], { targetDir: tmpBase });
    if (result.exitCode !== 0) throw new Error(`Unexpected exitCode: ${result.exitCode}`);
    if (!result.stdout.includes('Design system: written/refreshed')) {
        throw new Error(`Unexpected stdout: ${result.stdout}`);
    }

    const designSystemPath = path.join(featureDir, 'design-system.md');
    if (!fs.existsSync(designSystemPath)) throw new Error('design-system.md was not written');
    const designSystem = fs.readFileSync(designSystemPath, 'utf-8');
    if (!designSystem.includes('# Design System:')) throw new Error(designSystem);
});

test('design-system writes artifact and receipt when requested directly', () => {
    const featureTwo = 'landing-refresh';
    const featureTwoDir = path.join(tmpBase, '.memory', 'changes', featureTwo);
    fs.mkdirSync(featureTwoDir, { recursive: true });

    const result = run(
        ['design-system', 'design a polished landing page hero', '--feature', featureTwo, '--write'],
        { targetDir: tmpBase },
    );
    if (result.exitCode !== 0) throw new Error(`Unexpected exitCode: ${result.exitCode}`);
    if (!result.stdout.includes('Artifact: .memory/changes/landing-refresh/design-system.md')) {
        throw new Error(`Unexpected stdout: ${result.stdout}`);
    }

    if (!fs.existsSync(path.join(featureTwoDir, 'design-system.md'))) {
        throw new Error('design-system.md missing');
    }
    if (!fs.existsSync(path.join(featureTwoDir, 'design-routing.json'))) {
        throw new Error('design-routing.json missing');
    }
});

test('prompt-health uses modular prompt intelligence and session inspection', () => {
    const result = run(['prompt-health', 'make the dashboard feel more premium'], { targetDir: tmpBase });
    if (result.exitCode !== 0) throw new Error(`Unexpected exitCode: ${result.exitCode}`);
    if (!result.stdout.includes('Prompt Health')) throw new Error(`Unexpected stdout: ${result.stdout}`);
    if (!result.stdout.includes('Recommended action:')) throw new Error(`Unexpected stdout: ${result.stdout}`);
});

test('session-detect reports active feature and circuit state', () => {
    fs.mkdirSync(path.join(tmpBase, '.memory'), { recursive: true });
    fs.writeFileSync(
        path.join(tmpBase, '.memory', 'execution_state.json'),
        JSON.stringify({ error_count: 2, status: 'active' }, null, 2),
    );

    const result = run(['session-detect'], { targetDir: tmpBase });
    if (result.exitCode !== 0) throw new Error(`Unexpected exitCode: ${result.exitCode}`);
    if (!result.stdout.includes('Session Detection')) throw new Error(`Unexpected stdout: ${result.stdout}`);
    if (!result.stdout.includes('Circuit state: active (2 errors)')) {
        throw new Error(`Unexpected stdout: ${result.stdout}`);
    }
});

console.log(`  ${passed} passed, ${failed} failed`);
module.exports = { passed, failed };
