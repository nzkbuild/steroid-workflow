#!/usr/bin/env node
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');

const { handleAudit } = require('../../src/commands/audit.cjs');

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

function ensureFile(filePath, content) {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, content);
}

function makeProjectRoot(suffix) {
    const root = path.join(os.tmpdir(), `steroid-audit-command-${suffix}-${Date.now()}`);
    fs.mkdirSync(root, { recursive: true });
    return root;
}

function populateHappyPathProject(root) {
    ensureFile(path.join(root, '.git', 'hooks', 'pre-commit'), '# STEROID-WORKFLOW\n');
    for (const skillName of [
        'steroid-scan',
        'steroid-vibe-capture',
        'steroid-specify',
        'steroid-research',
        'steroid-architect',
        'steroid-engine',
        'steroid-verify',
        'steroid-diagnose',
    ]) {
        ensureFile(path.join(root, '.agents', 'skills', skillName, 'SKILL.md'), `# ${skillName}\nVersion 7.0.0-beta.1\n`);
    }
    ensureFile(path.join(root, '.memory', 'execution_state.json'), JSON.stringify({ error_count: 0 }, null, 2));
    ensureFile(path.join(root, 'steroid-run.cjs'), `${new Array(120).fill('line').join('\n')}\n`);
    ensureFile(path.join(root, 'AGENTS.md'), '# STEROID-WORKFLOW-START\n');

    for (const store of ['tech-stack', 'patterns', 'decisions', 'gotchas']) {
        ensureFile(path.join(root, '.memory', 'knowledge', `${store}.json`), JSON.stringify({ ok: true }, null, 2));
    }
    ensureFile(path.join(root, '.memory', 'reports', 'handoff.md'), '# Report\n');
}

console.log('[unit] audit-command-modules.test.cjs');

test('handleAudit reports a healthy installed project', () => {
    const root = makeProjectRoot('healthy');
    populateHappyPathProject(root);

    const result = handleAudit({ targetDir: root, version: '7.0.0-beta.1' });
    if (result.exitCode !== 0) throw new Error(`Unexpected exitCode: ${result.exitCode}`);
    if (!result.stdout.includes('All enforcement layers active.')) {
        throw new Error(`Missing success footer: ${result.stdout}`);
    }
    if (!result.stdout.includes('8 skills')) {
        throw new Error(`Missing skill count summary: ${result.stdout}`);
    }
    if (!result.stdout.includes('No stale version references found')) {
        throw new Error(`Missing version drift summary: ${result.stdout}`);
    }
});

test('handleAudit fails when required layers are missing', () => {
    const root = makeProjectRoot('missing');
    ensureFile(path.join(root, 'steroid-run.cjs'), 'short\n');

    const result = handleAudit({ targetDir: root, version: '7.0.0-beta.1' });
    if (result.exitCode !== 1) throw new Error(`Unexpected exitCode: ${result.exitCode}`);
    if (!result.stdout.includes('Git pre-commit hook — missing')) {
        throw new Error(`Missing hook failure: ${result.stdout}`);
    }
    if (!result.stdout.includes('Fix: Run "npx steroid-workflow init"')) {
        throw new Error(`Missing remediation message: ${result.stdout}`);
    }
});

console.log(`  ${passed} passed, ${failed} failed`);
module.exports = { passed, failed };
