#!/usr/bin/env node
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');

const { isWithinRoot, resolvePathWithinRoot } = require('../../src/utils/path-guards.cjs');

let passed = 0;
let failed = 0;

function test(name, fn) {
    try {
        fn();
        passed++;
        console.log(`  ✅ ${name}`);
    } catch (e) {
        failed++;
        console.log(`  ❌ ${name}: ${e.message}`);
    }
}

console.log('[unit] path-guards.test.cjs');

const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'steroid-path-guards-'));
const rootDir = path.join(tempRoot, 'root');
const existingDir = path.join(rootDir, 'nested');
const existingFile = path.join(existingDir, 'file.txt');
fs.mkdirSync(existingDir, { recursive: true });
fs.writeFileSync(existingFile, 'ok');

test('detects paths inside root', () => {
    if (!isWithinRoot(rootDir, existingFile)) {
        throw new Error(`Expected ${existingFile} to be inside ${rootDir}`);
    }
});

test('detects paths outside root', () => {
    const outsideFile = path.join(tempRoot, 'outside.txt');
    if (isWithinRoot(rootDir, outsideFile)) {
        throw new Error(`Expected ${outsideFile} to be outside ${rootDir}`);
    }
});

test('resolves an existing path inside root', () => {
    const resolved = resolvePathWithinRoot(rootDir, 'nested/file.txt', { mustExist: true });
    if (resolved !== existingFile) {
        throw new Error(`Unexpected resolved path: ${resolved}`);
    }
});

test('resolves a future path inside root when existence is not required', () => {
    const expected = path.join(rootDir, 'nested', 'future.json');
    const resolved = resolvePathWithinRoot(rootDir, 'nested/future.json');
    if (resolved !== expected) {
        throw new Error(`Unexpected resolved path: ${resolved}`);
    }
});

test('blocks escape attempts outside root', () => {
    const resolved = resolvePathWithinRoot(rootDir, '..', { mustExist: true });
    if (resolved !== null) {
        throw new Error(`Expected null, got ${resolved}`);
    }
});

test('blocks missing paths when existence is required', () => {
    const resolved = resolvePathWithinRoot(rootDir, 'nested/missing.txt', { mustExist: true });
    if (resolved !== null) {
        throw new Error(`Expected null, got ${resolved}`);
    }
});

fs.rmSync(tempRoot, { recursive: true, force: true });

console.log(`  ${passed} passed, ${failed} failed`);
module.exports = { passed, failed };
