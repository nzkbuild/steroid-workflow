#!/usr/bin/env node
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { parseRunInvocation, handleRun } = require('../../src/commands/pipeline.cjs');

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

console.log('[unit] pipeline-run-module.test.cjs');

const tmpBase = path.join(os.tmpdir(), `steroid-pipeline-run-${Date.now()}`);
fs.mkdirSync(path.join(tmpBase, '.memory'), { recursive: true });
fs.writeFileSync(
    path.join(tmpBase, '.memory', 'execution_state.json'),
    JSON.stringify({ error_count: 0, last_error: null, status: 'active' }, null, 2),
);
fs.mkdirSync(path.join(tmpBase, 'packages', 'web'), { recursive: true });

test('parseRunInvocation resolves in-project cwd and command args', () => {
    const result = parseRunInvocation(['run', '--cwd=packages/web', 'echo hi'], { targetDir: tmpBase });
    if (!result.ok) throw new Error(`Expected ok parse result: ${result.stderr}`);
    if (!result.executionCwd.endsWith(path.join('packages', 'web'))) {
        throw new Error(`Unexpected executionCwd: ${result.executionCwd}`);
    }
    if (result.commandStr !== 'echo hi') throw new Error(`Unexpected commandStr: ${result.commandStr}`);
});

test('handleRun blocks shell chaining syntax', () => {
    const result = handleRun(['run', '--cwd=packages/web', 'echo hi && echo bye'], { targetDir: tmpBase });
    if (result.exitCode !== 1) throw new Error(`Unexpected exitCode: ${result.exitCode}`);
    if (!result.stderr.includes('Shell control syntax')) throw new Error(`Unexpected stderr: ${result.stderr}`);
});

test('handleRun blocks direct rm usage through run', () => {
    const result = handleRun(['run', '--cwd=packages/web', 'rm target.txt'], { targetDir: tmpBase });
    if (result.exitCode !== 1) throw new Error(`Unexpected exitCode: ${result.exitCode}`);
    if (!result.stderr.includes('Direct rm usage is not allowed')) throw new Error(`Unexpected stderr: ${result.stderr}`);
});

test('handleRun blocks git path overrides outside the project root', () => {
    const result = handleRun(['run', '--cwd=packages/web', 'git -C .. status'], { targetDir: tmpBase });
    if (result.exitCode !== 1) throw new Error(`Unexpected exitCode: ${result.exitCode}`);
    if (!result.stderr.includes('git path overrides must stay inside')) {
        throw new Error(`Unexpected stderr: ${result.stderr}`);
    }
});

test('handleRun executes safe commands through the injected spawn function and resets error state on success', () => {
    const stateFile = path.join(tmpBase, '.memory', 'execution_state.json');
    fs.writeFileSync(
        stateFile,
        JSON.stringify({ error_count: 2, last_error: 'old error', status: 'active', recovery_actions: [] }, null, 2),
    );

    const result = handleRun(['run', '--cwd=packages/web', 'echo hello'], {
        targetDir: tmpBase,
        stateFile,
        spawnFn: (cmd, cmdArgs, options) => {
            if (cmd !== 'echo') throw new Error(`Unexpected command: ${cmd}`);
            if (JSON.stringify(cmdArgs) !== JSON.stringify(['hello'])) {
                throw new Error(`Unexpected args: ${JSON.stringify(cmdArgs)}`);
            }
            if (!options.cwd.endsWith(path.join('packages', 'web'))) {
                throw new Error(`Unexpected cwd: ${options.cwd}`);
            }
            return { status: 0, stdout: 'hello\r\n', stderr: '' };
        },
    });

    if (result.exitCode !== 0) throw new Error(`Unexpected exitCode: ${result.exitCode}`);
    if (!result.stdout.includes('Executing in packages')) throw new Error(`Missing execution prefix: ${result.stdout}`);
    if (!result.stdout.includes('hello')) throw new Error(`Missing child stdout: ${result.stdout}`);

    const state = JSON.parse(fs.readFileSync(stateFile, 'utf-8'));
    if (state.error_count !== 0) throw new Error(`Expected error_count reset, got ${state.error_count}`);
    if (state.last_error !== null) throw new Error(`Expected last_error reset, got ${state.last_error}`);
});

test('handleRun increments error state on failed execution', () => {
    const stateFile = path.join(tmpBase, '.memory', 'execution_state.json');
    fs.writeFileSync(
        stateFile,
        JSON.stringify({ error_count: 0, last_error: null, status: 'active', recovery_actions: [] }, null, 2),
    );

    const result = handleRun(['run', '--cwd=packages/web', 'echo fail'], {
        targetDir: tmpBase,
        stateFile,
        spawnFn: () => ({ status: 2, stdout: '', stderr: 'bad\n' }),
    });

    if (result.exitCode !== 2) throw new Error(`Unexpected exitCode: ${result.exitCode}`);
    if (!result.stderr.includes('ERROR 1/5')) throw new Error(`Missing recovery message: ${result.stderr}`);

    const state = JSON.parse(fs.readFileSync(stateFile, 'utf-8'));
    if (state.error_count !== 1) throw new Error(`Expected error_count=1, got ${state.error_count}`);
    if (!String(state.last_error || '').includes('exit code 2')) {
        throw new Error(`Unexpected last_error: ${state.last_error}`);
    }
});

console.log(`  ${passed} passed, ${failed} failed`);
module.exports = { passed, failed };
