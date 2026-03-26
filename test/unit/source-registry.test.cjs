#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const {
    manifestPath,
    policyPath,
    readSourcesManifest,
    readSourcesPolicy,
    getSourceById,
    resolveSourcePath,
    getSourceSummary,
} = require('../../src/services/sources/registry.cjs');

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

console.log('[unit] source-registry.test.cjs');

test('sources manifest exists', () => {
    if (!fs.existsSync(manifestPath)) throw new Error('src/services/sources/catalog.json missing');
});

test('sources policy exists', () => {
    if (!fs.existsSync(policyPath)) throw new Error('src/services/sources/policy.json missing');
});

test('source manifest has classified entries', () => {
    const manifest = readSourcesManifest();
    if (!Array.isArray(manifest.sources) || manifest.sources.length === 0) {
        throw new Error('manifest.sources is empty');
    }
    const invalid = manifest.sources.find((entry) => !entry.id || !entry.publishPolicy);
    if (invalid) throw new Error(`Invalid entry found: ${JSON.stringify(invalid)}`);
});

test('source policy forbids raw upstream package shipping', () => {
    const policy = readSourcesPolicy();
    if (!policy.publicPackage || policy.publicPackage.allowRawUpstreamTrees !== false) {
        throw new Error('public package policy does not block raw upstream trees');
    }
});

test('registry exposes first-party design capabilities without leaking private paths', () => {
    const source = getSourceById('steroid-design-system');
    if (!source) throw new Error('steroid-design-system missing from manifest');
    const resolved = resolveSourcePath('steroid-design-system');
    if (resolved !== null) throw new Error('steroid-design-system should not resolve to a private path');
});

test('registry resolves first-party runtime service paths', () => {
    const resolved = resolveSourcePath('steroid-accessibility-audit');
    if (!resolved) throw new Error('steroid-accessibility-audit path did not resolve');
    if (!fs.existsSync(resolved)) throw new Error(`Resolved path does not exist: ${resolved}`);
});

test('registry summary reports existing paths', () => {
    const summary = getSourceSummary();
    const accesslint = summary.find((entry) => entry.id === 'steroid-accessibility-audit');
    if (!accesslint) throw new Error('steroid-accessibility-audit missing from summary');
    if (accesslint.exists !== true) throw new Error('steroid-accessibility-audit should exist during transition');
});

test('templates memory copies exist for the v7 install target', () => {
    const required = ['config.json', 'execution_state.json', 'progress.md'];
    for (const file of required) {
        const fullPath = path.join(__dirname, '..', '..', 'templates', 'memory', file);
        if (!fs.existsSync(fullPath)) throw new Error(`Missing templates/memory/${file}`);
    }
});

console.log(`  ${passed} passed, ${failed} failed`);
module.exports = { passed, failed };
