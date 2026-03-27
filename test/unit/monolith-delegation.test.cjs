#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

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

console.log('[unit] monolith-delegation.test.cjs');

const source = fs.readFileSync(path.join(__dirname, '..', '..', 'bin', 'steroid-run.cjs'), 'utf-8');
const compatSource = fs.readFileSync(path.join(__dirname, '..', '..', 'src', 'runtime', 'standalone-compat.cjs'), 'utf-8');

test('entrypoint prefers modular runtime and falls back to compatibility runtime', () => {
    for (const requiredPath of [
        "const repoCliEntry = path.join(__dirname, '..', 'src', 'cli', 'index.cjs');",
        "const installedCliEntry = path.join(targetDir, '.steroid', 'runtime', 'src', 'cli', 'index.cjs');",
        "const repoCompatEntry = path.join(__dirname, '..', 'src', 'runtime', 'standalone-compat.cjs');",
        "const installedCompatEntry = path.join(targetDir, '.steroid', 'runtime', 'src', 'runtime', 'standalone-compat.cjs');",
    ]) {
        if (!source.includes(requiredPath)) {
            throw new Error(`Missing runtime entry resolution path: ${requiredPath}`);
        }
    }
    if (!source.includes('if (!runCliEntry(installedCliEntry) && !runCliEntry(repoCliEntry)) {')) {
        throw new Error('Missing modular-first entrypoint flow');
    }
    if (!source.includes('runCompatEntry(installedCompatEntry)') || !source.includes('runCompatEntry(repoCompatEntry)')) {
        throw new Error('Missing compatibility fallback flow');
    }
});

test('compatibility runtime still contains the migrated workflow command registry', () => {
    for (const command of ['archive', 'smoke-test', 'git-init', 'pipeline-status']) {
        if (!compatSource.includes(`'${command}'`)) {
            throw new Error(`Missing migrated command in modular registry: ${command}`);
        }
    }
});

test('compatibility runtime imports canonical helper modules directly', () => {
    for (const utilityPath of [
        "../utils/receipt-loaders.cjs",
        "../utils/frontend-receipt-loaders.cjs",
        "../utils/trust-helpers.cjs",
        "../utils/frontend-review.cjs",
        "../utils/ui-archive-policy.cjs",
        "../utils/pipeline-status.cjs",
        "../utils/prompt-intelligence.cjs",
    ]) {
        if (!compatSource.includes(utilityPath)) {
            throw new Error(`Missing canonical utility import: ${utilityPath}`);
        }
    }
});

console.log(`  ${passed} passed, ${failed} failed`);
module.exports = { passed, failed };
