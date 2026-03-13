#!/usr/bin/env node
'use strict';

/**
 * Unit test runner — executes all unit test files in this directory.
 * Exit code: 0 if all pass, 1 if any fail.
 */
const fs = require('fs');
const path = require('path');

const testDir = __dirname;
const testFiles = fs.readdirSync(testDir)
    .filter(f => f.endsWith('.test.cjs'))
    .sort();

let totalPassed = 0;
let totalFailed = 0;

console.log(`\n[unit] Running ${testFiles.length} unit test files...\n`);

for (const file of testFiles) {
    const filePath = path.join(testDir, file);
    const mod = require(filePath);
    if (typeof mod === 'object' && mod.passed !== undefined) {
        totalPassed += mod.passed;
        totalFailed += mod.failed;
    }
}

console.log(`\n[unit] Total: ${totalPassed} passed, ${totalFailed} failed\n`);
process.exit(totalFailed > 0 ? 1 : 0);
