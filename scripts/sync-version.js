#!/usr/bin/env node
/**
 * sync-version.js — Patches the hardcoded SW_VERSION fallback in steroid-run.cjs
 * Runs automatically via prepublishOnly hook before every npm publish.
 */
const fs = require('fs');
const path = require('path');

const pkgPath = path.join(__dirname, '..', 'package.json');
const cjsPath = path.join(__dirname, '..', 'bin', 'steroid-run.cjs');

const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
const version = pkg.version;

let code = fs.readFileSync(cjsPath, 'utf-8');
const pattern = /let SW_VERSION = '[^']+';/;

if (!pattern.test(code)) {
    console.error('[sync-version] ❌ Could not find SW_VERSION line in steroid-run.cjs');
    process.exit(1);
}

const before = code.match(pattern)[0];
const after = `let SW_VERSION = '${version}';`;

if (before === after) {
    console.log(`[sync-version] ✅ SW_VERSION already matches package.json (${version})`);
    process.exit(0);
}

code = code.replace(pattern, after);
fs.writeFileSync(cjsPath, code);
console.log(`[sync-version] ✅ Patched SW_VERSION: ${before} → ${after}`);
