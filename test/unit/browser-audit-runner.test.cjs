#!/usr/bin/env node
'use strict';

const { spawnSync } = require('child_process');
const fs = require('fs');
const os = require('os');
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

console.log('[unit] browser-audit-runner.test.cjs');

const runner = path.join(__dirname, '..', '..', 'integrations', 'browser-audit', 'run-playwright-audit.cjs');
const tmpBase = path.join(os.tmpdir(), `steroid-browser-audit-${Date.now()}`);
fs.mkdirSync(tmpBase, { recursive: true });

test('browser audit runner writes JSON and screenshot when Playwright is resolvable', () => {
    const playwrightDir = path.join(tmpBase, 'node_modules', 'playwright');
    const screenshotPath = path.join(tmpBase, 'audit-shot.png');
    fs.mkdirSync(playwrightDir, { recursive: true });
    fs.writeFileSync(
        path.join(playwrightDir, 'index.js'),
        [
            "const fs = require('fs');",
            '',
            'exports.chromium = {',
            '  async launch() {',
            '    return {',
            '      async newPage() {',
            '        return {',
            '          on() {},',
            '          async goto() {},',
            '          async waitForLoadState() {},',
            '          async evaluate() {',
            "            return { title: 'Audit Demo', landmarkCount: 1, headingCount: 1, buttonCount: 1, linkCount: 1, imageCount: 0, imageWithoutAltCount: 0 };",
            '          },',
            '          async screenshot(options) {',
            "            fs.writeFileSync(options.path, 'stub-image');",
            '          },',
            '          url() {',
            "            return 'https://example.test/dashboard';",
            '          },',
            '        };',
            '      },',
            '      async close() {},',
            '    };',
            '  },',
            '};',
            '',
        ].join('\n'),
    );

    const result = spawnSync(
        'node',
        [runner, 'https://example.test/dashboard', '--json', '--screenshot', screenshotPath],
        {
            cwd: tmpBase,
            stdio: 'pipe',
            encoding: 'utf-8',
            timeout: 15000,
            env: {
                ...process.env,
                STEROID_PLAYWRIGHT_PATH: path.join(playwrightDir, 'index.js'),
            },
        },
    );

    if (result.status !== 0) {
        throw new Error(`Expected exit 0, got ${result.status}: ${result.stderr || result.stdout}`);
    }

    const payload = JSON.parse(String(result.stdout || '{}'));
    if (payload.ok !== true) throw new Error(`Expected ok=true, got: ${result.stdout}`);
    if (payload.pageTitle !== 'Audit Demo') throw new Error(`Unexpected page title: ${payload.pageTitle}`);
    if (!payload.screenshotPath) throw new Error('Missing screenshotPath in payload');
    if (!fs.existsSync(payload.screenshotPath)) throw new Error('Screenshot file was not written');
});

console.log(`  ${passed} passed, ${failed} failed`);
module.exports = { passed, failed };
