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

test('monolith includes repo-only modular delegation for migrated commands', () => {
    if (!source.includes('const MODULAR_OWNED_COMMAND_NAMES = [')) {
        throw new Error('Missing modular-owned command registry');
    }
    if (!source.includes('const MODULAR_OWNED_COMMANDS = new Set(MODULAR_OWNED_COMMAND_NAMES);')) {
        throw new Error('Missing modular-owned command allowlist');
    }
    if (!source.includes('const KNOWN_COMMANDS = [...new Set([...MODULAR_OWNED_COMMAND_NAMES, ...MONOLITH_ONLY_COMMAND_NAMES])]')) {
        throw new Error('Missing unified known-command registry');
    }
    if (!source.includes("const dispatchPath = path.join(packageRootDir, 'src', 'cli', 'dispatch.cjs');")) {
        throw new Error('Missing repo-local dispatch path');
    }
    if (!source.includes('tryRunModularCommand(args);')) {
        throw new Error('Missing early modular delegation hook');
    }
});

test('modular-owned command registry includes recently migrated workflow commands', () => {
    for (const command of ['archive', 'smoke-test', 'git-init', 'pipeline-status']) {
        if (!source.includes(`'${command}'`)) {
            throw new Error(`Missing migrated command in modular registry: ${command}`);
        }
    }
});

test('monolith includes repo-local utility delegation for canonical helper modules', () => {
    if (!source.includes('function loadRepoLocalUtilityModule(relativePath) {')) {
        throw new Error('Missing repo-local utility module loader');
    }
    for (const utilityPath of [
        "path.join('src', 'utils', 'receipt-loaders.cjs')",
        "path.join('src', 'utils', 'frontend-receipt-loaders.cjs')",
        "path.join('src', 'utils', 'trust-helpers.cjs')",
        "path.join('src', 'utils', 'frontend-review.cjs')",
        "path.join('src', 'utils', 'ui-archive-policy.cjs')",
        "path.join('src', 'utils', 'pipeline-status.cjs')",
    ]) {
        if (!source.includes(utilityPath)) {
            throw new Error(`Missing utility delegation path: ${utilityPath}`);
        }
    }
});

console.log(`  ${passed} passed, ${failed} failed`);
module.exports = { passed, failed };
