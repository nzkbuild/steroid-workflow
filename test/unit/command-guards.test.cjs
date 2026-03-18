#!/usr/bin/env node
'use strict';

const {
    DISALLOWED_DIRECT_COMMANDS,
    tokenizeCommand,
    validateExecutionCommandTokens,
} = require('../../src/utils/command-guards.cjs');

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

console.log('[unit] command-guards.test.cjs');

test('exports the direct-command blocklist', () => {
    if (!DISALLOWED_DIRECT_COMMANDS.has('rm')) {
        throw new Error('Expected rm to be blocked');
    }
});

test('tokenizes quoted arguments correctly', () => {
    const tokens = tokenizeCommand('node script.js --flag "hello world"');
    const expected = ['node', 'script.js', '--flag', 'hello world'];
    if (JSON.stringify(tokens) !== JSON.stringify(expected)) {
        throw new Error(`Unexpected tokens: ${JSON.stringify(tokens)}`);
    }
});

test('rejects direct filesystem commands', () => {
    const result = validateExecutionCommandTokens(['rm', '-rf', 'tmp']);
    if (result.ok) throw new Error('Expected rm to be blocked');
    if (!result.message.includes('fs-rm')) throw new Error(`Unexpected message: ${result.message}`);
});

test('rejects node inline evaluation', () => {
    const result = validateExecutionCommandTokens(['node', '-e', 'console.log(1)']);
    if (result.ok) throw new Error('Expected node -e to be blocked');
});

test('rejects python inline or module execution', () => {
    const result = validateExecutionCommandTokens(['python', '-m', 'pytest']);
    if (result.ok) throw new Error('Expected python -m to be blocked');
});

test('rejects git path overrides outside the project root', () => {
    const result = validateExecutionCommandTokens(['git', '-C', '..', 'status'], {
        resolvePath: () => null,
    });
    if (result.ok) throw new Error('Expected git -C .. to be blocked');
});

test('allows safe project commands', () => {
    const result = validateExecutionCommandTokens(['npm', 'run', 'build']);
    if (!result.ok) throw new Error(`Expected npm run build to pass: ${result.message}`);
});

console.log(`  ${passed} passed, ${failed} failed`);
module.exports = { passed, failed };
