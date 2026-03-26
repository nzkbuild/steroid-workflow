#!/usr/bin/env node
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');

const { auditFiles } = require('../../src/services/audit/accesslint-audit.cjs');
const { runBrowserAudit } = require('../../src/services/audit/browser-audit.cjs');

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

async function testAsync(name, fn) {
    try {
        await fn();
        passed++;
        console.log(`  ✅ ${name}`);
    } catch (error) {
        failed++;
        console.log(`  ❌ ${name}: ${error.message}`);
    }
}

console.log('[unit] audit-services.test.cjs');

const tmpBase = path.join(os.tmpdir(), `steroid-audit-services-${Date.now()}`);
fs.mkdirSync(tmpBase, { recursive: true });

test('accesslint audit service audits local HTML files', () => {
    const htmlPath = path.join(tmpBase, 'index.html');
    fs.writeFileSync(htmlPath, '<!doctype html><html><body><main><img src="demo.png"></main></body></html>');
    const result = auditFiles([htmlPath], { cwd: tmpBase });
    if (result.fileCount !== 1) throw new Error(`Unexpected fileCount: ${result.fileCount}`);
    if (!Array.isArray(result.results) || result.results.length !== 1) {
        throw new Error(`Unexpected results payload: ${JSON.stringify(result)}`);
    }
});

testAsync('browser audit service returns skipped payload when Playwright is unavailable', async () => {
    const previous = process.env.STEROID_PLAYWRIGHT_PATH;
    process.env.STEROID_PLAYWRIGHT_PATH = path.join(tmpBase, 'missing-playwright.js');
    try {
        const result = await runBrowserAudit({
            target: 'https://example.test/dashboard',
            json: true,
            cwd: tmpBase,
        });
        if (!result.skipped) throw new Error(`Expected skipped payload: ${JSON.stringify(result)}`);
    } finally {
        if (previous === undefined) {
            delete process.env.STEROID_PLAYWRIGHT_PATH;
        } else {
            process.env.STEROID_PLAYWRIGHT_PATH = previous;
        }
    }
});

console.log(`  ${passed} passed, ${failed} failed`);
module.exports = { passed, failed };
