#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const {
    readForkManifest,
    readUnifiedSourcesManifest,
    getUnifiedSource,
} = require('../../src/utils/fork-sources.cjs');

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

console.log('[unit] fork-sources.test.cjs');

const root = path.join(__dirname, '..', '..');
const privateForkRoot = path.join(root, 'sources', 'forks');
const manifestPath = path.join(privateForkRoot, 'manifest.json');
const forkDirNames = fs
    .readdirSync(privateForkRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();

test('fork manifest exists', () => {
    if (!fs.existsSync(manifestPath)) throw new Error('Private source manifest missing');
});

const manifest = readForkManifest(root);
const unifiedManifest = readUnifiedSourcesManifest(root);

test('manifest tracks the expected forked source entries', () => {
    if (!Array.isArray(manifest.sources)) throw new Error('manifest.sources is not an array');
    if (manifest.sources.length !== forkDirNames.length) {
        throw new Error(`Expected ${forkDirNames.length} sources, got ${manifest.sources.length}`);
    }
});

test('every fork source directory is registered in the manifest', () => {
    const manifestDirs = manifest.sources
        .map((source) => path.basename(source.localPath))
        .sort();
    if (JSON.stringify(manifestDirs) !== JSON.stringify(forkDirNames)) {
        throw new Error(`Manifest directories do not match the private intake contents: ${JSON.stringify(manifestDirs)} vs ${JSON.stringify(forkDirNames)}`);
    }
});

test('every manifest localPath exists', () => {
    for (const source of manifest.sources) {
        const localPath = path.join(root, source.localPath);
        if (!fs.existsSync(localPath)) throw new Error(`Missing localPath: ${source.localPath}`);
    }
});

test('unified source manifest exists for shipped runtime capabilities', () => {
    if (!Array.isArray(unifiedManifest.sources)) throw new Error('unifiedManifest.sources is not an array');
    const requiredPublicIds = [
        'steroid-design-system',
        'steroid-web-direction',
        'steroid-ux-discipline',
        'steroid-web-review',
        'steroid-interface-review',
        'steroid-react-rules',
        'steroid-composition-rules',
        'steroid-native-rules',
        'steroid-accessibility-audit',
        'browser-audit',
    ];
    for (const id of requiredPublicIds) {
        const unified = getUnifiedSource(id, root);
        if (!unified) throw new Error(`Unified source manifest missing ${id}`);
    }
});

test('unified source manifest classifies first-party runtime audit capabilities', () => {
    const accesslint = getUnifiedSource('steroid-accessibility-audit', root);
    const browserAudit = getUnifiedSource('browser-audit', root);
    if (!accesslint) throw new Error('Unified source manifest missing steroid-accessibility-audit');
    if (!browserAudit) throw new Error('Unified source manifest missing browser-audit');
    if (accesslint.publishPolicy !== 'first-party-runtime') {
        throw new Error(`Unexpected accesslint policy: ${accesslint.publishPolicy}`);
    }
    if (browserAudit.publishPolicy !== 'first-party-runtime') {
        throw new Error(`Unexpected browser-audit policy: ${browserAudit.publishPolicy}`);
    }
});

test('wrapper skills for source-library inputs exist', () => {
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

test('first-party audit services exist', () => {
    const requiredPaths = [
        'src/services/audit/accesslint-audit.cjs',
        'src/services/audit/browser-audit.cjs',
    ];

    for (const relativePath of requiredPaths) {
        const fullPath = path.join(root, relativePath);
        if (!fs.existsSync(fullPath)) throw new Error(`Missing first-party audit service path: ${relativePath}`);
    }
});

console.log(`  ${passed} passed, ${failed} failed`);
module.exports = { passed, failed };
