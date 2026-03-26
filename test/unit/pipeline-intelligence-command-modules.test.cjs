#!/usr/bin/env node
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');

const { run } = require('../../src/commands/pipeline.cjs');

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

console.log('[unit] pipeline-intelligence-command-modules.test.cjs');

const tmpBase = path.join(os.tmpdir(), `steroid-pipeline-intel-${Date.now()}`);
const changesDir = path.join(tmpBase, '.memory', 'changes');
fs.mkdirSync(changesDir, { recursive: true });

test('normalize-prompt --write persists prompt.json and prompt.md for a feature', () => {
    const feature = 'prompt-receipt';
    const featureDir = path.join(changesDir, feature);
    fs.mkdirSync(featureDir, { recursive: true });

    const result = run(['normalize-prompt', 'make it feel more premium', '--feature', feature, '--write'], {
        targetDir: tmpBase,
    });
    if (result.exitCode !== 0) throw new Error(`Expected exit 0, got ${result.exitCode}`);

    const receiptPath = path.join(featureDir, 'prompt.json');
    if (!fs.existsSync(receiptPath)) throw new Error('prompt.json was not written');

    const receipt = JSON.parse(fs.readFileSync(receiptPath, 'utf-8'));
    if (receipt.primaryIntent !== 'build') throw new Error(`Unexpected primaryIntent: ${receipt.primaryIntent}`);
    if (receipt.source !== 'normalize-prompt') throw new Error(`Unexpected source: ${receipt.source}`);

    const briefPath = path.join(featureDir, 'prompt.md');
    if (!fs.existsSync(briefPath)) throw new Error('prompt.md was not written');

    const brief = fs.readFileSync(briefPath, 'utf-8');
    if (!brief.includes('# Prompt Brief: prompt-receipt')) throw new Error('prompt.md missing heading');
    if (!brief.includes(`Recommended Route: ${receipt.recommendedPipeline}`)) {
        throw new Error('prompt.md missing route summary');
    }
});

test('detect-intent returns the primary intent and verbose context', () => {
    const result = run(['detect-intent', 'fix the login bug', '--verbose'], { targetDir: tmpBase });
    if (result.exitCode !== 0) throw new Error(`Unexpected exitCode: ${result.exitCode}`);
    if (!result.stdout.startsWith('fix\n')) throw new Error(`Unexpected stdout: ${result.stdout}`);
    if (!result.stdout.includes('Intent: fix')) throw new Error(`Unexpected stdout: ${result.stdout}`);
    if (!result.stdout.includes('Pipeline:')) throw new Error(`Unexpected stdout: ${result.stdout}`);
});

test('detect-tests reports test framework config and scripts', () => {
    fs.writeFileSync(
        path.join(tmpBase, 'package.json'),
        JSON.stringify(
            {
                name: 'pipeline-intel-fixture',
                scripts: {
                    test: 'vitest run',
                    'test:watch': 'vitest',
                },
            },
            null,
            2,
        ),
    );
    fs.writeFileSync(path.join(tmpBase, 'vitest.config.ts'), 'export default {};\n');

    const result = run(['detect-tests'], { targetDir: tmpBase });
    if (result.exitCode !== 0) throw new Error(`Unexpected exitCode: ${result.exitCode}`);
    if (!result.stdout.includes('Vitest')) throw new Error(`Unexpected stdout: ${result.stdout}`);
    if (!result.stdout.includes('Test script: "vitest run"')) throw new Error(`Unexpected stdout: ${result.stdout}`);
    if (!result.stdout.includes('Watch script: "vitest"')) throw new Error(`Unexpected stdout: ${result.stdout}`);
});

console.log(`  ${passed} passed, ${failed} failed`);
module.exports = { passed, failed };
