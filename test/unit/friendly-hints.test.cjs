#!/usr/bin/env node
'use strict';

/**
 * Unit tests for friendlyHint() — user-facing error hint messages.
 */
const { friendlyHint } = require('../../src/utils/friendly-hints.cjs');

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

console.log('[unit] friendly-hints.test.cjs');

// --- Known Keys ---
test('gate-blocked returns a hint', () => {
    const hint = friendlyHint('gate-blocked');
    if (!hint.includes('💡')) throw new Error('Missing lightbulb emoji');
    if (!hint.includes('previous step')) throw new Error('Missing helpful text');
});

test('gate-incomplete returns a hint', () => {
    const hint = friendlyHint('gate-incomplete');
    if (!hint.includes('too short')) throw new Error('Missing descriptive text');
});

test('circuit-tripped returns a hint', () => {
    const hint = friendlyHint('circuit-tripped');
    if (!hint.includes('recover')) throw new Error('Missing recover suggestion');
});

test('git-failed returns a hint', () => {
    const hint = friendlyHint('git-failed');
    if (!hint.includes('commit again')) throw new Error('Missing retry suggestion');
});

test('no-git returns a hint', () => {
    const hint = friendlyHint('no-git');
    if (!hint.includes('git init')) throw new Error('Missing git init instruction');
});

test('no-remote returns a multi-step hint', () => {
    const hint = friendlyHint('no-remote');
    if (!hint.includes('github.com')) throw new Error('Missing GitHub reference');
    if (!hint.includes('git push')) throw new Error('Missing push instruction');
});

// --- Unknown Keys ---
test('unknown key returns empty string', () => {
    const hint = friendlyHint('nonexistent');
    if (hint !== '') throw new Error(`Expected empty string, got: "${hint}"`);
});

test('empty string key returns empty string', () => {
    const hint = friendlyHint('');
    if (hint !== '') throw new Error(`Expected empty string, got: "${hint}"`);
});

test('undefined key returns empty string', () => {
    const hint = friendlyHint(undefined);
    if (hint !== '') throw new Error(`Expected empty string, got: "${hint}"`);
});

module.exports = { passed, failed };
