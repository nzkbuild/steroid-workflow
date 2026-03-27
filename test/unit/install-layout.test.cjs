#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const {
    resolveMemoryTemplateDir,
    resolveRuntimeAssetsDir,
    resolveRuntimeSrcDir,
    resolveRuntimeServicesDir,
} = require('../../src/install/runtime-layout.cjs');
const pkg = require('../../package.json');

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

console.log('[unit] install-layout.test.cjs');

const repoRoot = path.join(__dirname, '..', '..');

test('resolveMemoryTemplateDir prefers templates/memory', () => {
    const resolved = resolveMemoryTemplateDir(repoRoot);
    const expected = path.join(repoRoot, 'templates', 'memory');
    if (resolved !== expected) {
        throw new Error(`Expected ${expected}, got ${resolved}`);
    }
});

test('templates/memory contains the expected install files', () => {
    const templateDir = resolveMemoryTemplateDir(repoRoot);
    for (const file of ['config.json', 'execution_state.json', 'progress.md']) {
        const fullPath = path.join(templateDir, file);
        if (!fs.existsSync(fullPath)) throw new Error(`Missing ${file}`);
    }
});

test('public package files exclude legacy source trees and keep runtime assets', () => {
    const privateForkPrefix = ['sources', 'forks'].join('/');
    if (pkg.files.includes('imported/')) throw new Error('package.json should not publish imported/');
    if (pkg.files.includes(`${privateForkPrefix}/`)) throw new Error('package.json should not publish the private intake tree');
    if (pkg.files.includes('integrations/')) throw new Error('package.json should not publish integrations/');
    if (pkg.files.includes('sources/')) throw new Error('package.json should not publish sources/');
    if (!pkg.files.includes('src/')) throw new Error('package.json should publish src/');
});

test('runtime assets resolve to the dedicated .steroid/runtime install location', () => {
    const targetDir = path.join(repoRoot, 'tmp-runtime-layout-check');
    const runtimeDir = resolveRuntimeAssetsDir(targetDir);
    if (runtimeDir !== path.join(targetDir, '.steroid', 'runtime')) {
        throw new Error(`Unexpected runtime dir: ${runtimeDir}`);
    }
    if (resolveRuntimeSrcDir(targetDir) !== path.join(targetDir, '.steroid', 'runtime', 'src')) {
        throw new Error('Unexpected runtime src dir');
    }
    if (resolveRuntimeServicesDir(targetDir) !== path.join(targetDir, '.steroid', 'runtime', 'src', 'services')) {
        throw new Error('Unexpected runtime services dir');
    }
});

console.log(`  ${passed} passed, ${failed} failed`);
module.exports = { passed, failed };
