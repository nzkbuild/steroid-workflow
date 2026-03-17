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
    } catch (e) {
        failed++;
        console.log(`  ❌ ${name}: ${e.message}`);
    }
}

console.log('[unit] imported-sources.test.cjs');

const root = path.join(__dirname, '..', '..');
const manifestPath = path.join(root, 'imported', 'imported-manifest.json');

test('imported manifest exists', () => {
    if (!fs.existsSync(manifestPath)) throw new Error('imported-manifest.json missing');
});

const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));

test('manifest tracks the expected imported sources', () => {
    if (!Array.isArray(manifest.sources)) throw new Error('manifest.sources is not an array');
    if (manifest.sources.length !== 9) throw new Error(`Expected 9 sources, got ${manifest.sources.length}`);
});

test('every manifest localPath exists', () => {
    for (const source of manifest.sources) {
        const localPath = path.join(root, source.localPath);
        if (!fs.existsSync(localPath)) throw new Error(`Missing localPath: ${source.localPath}`);
    }
});

test('wrapper skills for imported sources exist', () => {
    const wrappers = [
        'skills/steroid-design-orchestrator/SKILL.md',
        'skills/steroid-web-design-review/SKILL.md',
        'skills/steroid-react-implementation/SKILL.md',
        'skills/steroid-rn-implementation/SKILL.md',
        'skills/steroid-accessibility-audit/SKILL.md',
    ];

    for (const relativePath of wrappers) {
        const fullPath = path.join(root, relativePath);
        if (!fs.existsSync(fullPath)) throw new Error(`Missing wrapper skill: ${relativePath}`);
    }
});

test('accesslint runner exists with bundled runtime packages', () => {
    const requiredPaths = [
        'integrations/accesslint/run-audit.cjs',
        'integrations/browser-audit/run-playwright-audit.cjs',
        'integrations/accesslint/node_modules/@accesslint/core',
        'integrations/accesslint/node_modules/happy-dom',
        'integrations/accesslint/node_modules/entities',
        'integrations/accesslint/node_modules/whatwg-mimetype',
        'integrations/accesslint/node_modules/ws',
    ];

    for (const relativePath of requiredPaths) {
        const fullPath = path.join(root, relativePath);
        if (!fs.existsSync(fullPath)) throw new Error(`Missing AccessLint runtime path: ${relativePath}`);
    }
});

console.log(`  ${passed} passed, ${failed} failed`);
module.exports = { passed, failed };
