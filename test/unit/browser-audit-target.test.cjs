#!/usr/bin/env node
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');

const { collectHtmlAuditTargets } = require('../../src/utils/browser-audit-target.cjs');

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

console.log('[unit] browser-audit-target.test.cjs');

const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'steroid-browser-audit-target-'));

test('collectHtmlAuditTargets prefers shipped build output and ignores src/public/next internals', () => {
    fs.mkdirSync(path.join(tempRoot, 'src'), { recursive: true });
    fs.mkdirSync(path.join(tempRoot, 'public'), { recursive: true });
    fs.mkdirSync(path.join(tempRoot, '.next', 'server', 'app'), { recursive: true });
    fs.mkdirSync(path.join(tempRoot, 'dist'), { recursive: true });

    fs.writeFileSync(path.join(tempRoot, 'src', 'preview.html'), '<html></html>');
    fs.writeFileSync(path.join(tempRoot, 'public', 'marketing.html'), '<html></html>');
    fs.writeFileSync(path.join(tempRoot, '.next', 'server', 'app', 'route.html'), '<html></html>');
    fs.writeFileSync(path.join(tempRoot, 'dist', 'index.html'), '<html></html>');

    const targets = collectHtmlAuditTargets(tempRoot);
    if (targets.length !== 1) {
        throw new Error(`Expected only built output HTML, got ${JSON.stringify(targets)}`);
    }
    if (!targets[0].endsWith(path.join('dist', 'index.html'))) {
        throw new Error(`Unexpected target list: ${JSON.stringify(targets)}`);
    }
});

test('collectHtmlAuditTargets falls back to project root index.html when no build directory exists', () => {
    const rootOnly = path.join(tempRoot, 'root-only');
    fs.mkdirSync(rootOnly, { recursive: true });
    fs.writeFileSync(path.join(rootOnly, 'index.html'), '<html></html>');

    const targets = collectHtmlAuditTargets(rootOnly);
    if (targets.length !== 1 || !targets[0].endsWith(path.join('root-only', 'index.html'))) {
        throw new Error(`Unexpected root target list: ${JSON.stringify(targets)}`);
    }
});

fs.rmSync(tempRoot, { recursive: true, force: true });

console.log(`  ${passed} passed, ${failed} failed`);
module.exports = { passed, failed };
