#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const targetDir = process.cwd();
const repoCliEntry = path.join(__dirname, '..', 'src', 'cli', 'index.cjs');
const installedCliEntry = path.join(targetDir, '.steroid', 'runtime', 'src', 'cli', 'index.cjs');
const repoCompatEntry = path.join(__dirname, '..', 'src', 'runtime', 'standalone-compat.cjs');
const installedCompatEntry = path.join(targetDir, '.steroid', 'runtime', 'src', 'runtime', 'standalone-compat.cjs');

function runCliEntry(entryPath) {
    if (!fs.existsSync(entryPath)) return false;
    const { runCli } = require(entryPath);
    const result = runCli(process.argv.slice(2), { targetDir, returnOnly: true });
    if (!result || !result.handled) return false;
    if (result.stdout) process.stdout.write(result.stdout);
    if (result.stderr) process.stderr.write(result.stderr);
    process.exit(result.exitCode || 0);
}

function runCompatEntry(entryPath) {
    if (!fs.existsSync(entryPath)) return false;
    require(entryPath);
    return true;
}

if (!runCliEntry(installedCliEntry) && !runCliEntry(repoCliEntry)) {
    if (!runCompatEntry(installedCompatEntry) && !runCompatEntry(repoCompatEntry)) {
        console.error('[steroid-run] ❌ Could not resolve the Steroid runtime entrypoint.');
        console.error('  Expected one of:');
        console.error(`  - ${installedCliEntry}`);
        console.error(`  - ${repoCliEntry}`);
        console.error(`  - ${installedCompatEntry}`);
        console.error(`  - ${repoCompatEntry}`);
        process.exit(1);
    }
}
