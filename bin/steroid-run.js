#!/usr/bin/env node
'use strict';

const { runCli } = require('../src/cli/index.cjs');

const result = runCli(process.argv.slice(2), { targetDir: process.cwd(), returnOnly: true });

if (result && result.handled && typeof result.exitCode === 'number') {
    if (result.stdout) process.stdout.write(result.stdout);
    if (result.stderr) process.stderr.write(result.stderr);
    process.exit(result.exitCode);
}

require('./steroid-run.cjs');
