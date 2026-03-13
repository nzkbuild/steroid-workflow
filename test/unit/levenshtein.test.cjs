#!/usr/bin/env node
'use strict';

/**
 * Unit tests for levenshtein() — edit distance for typo-tolerant command suggestions.
 */
const { levenshtein } = require('../../src/utils/levenshtein.cjs');

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

console.log('[unit] levenshtein.test.cjs');

// --- Exact matches ---
test('identical strings have distance 0', () => {
    if (levenshtein('status', 'status') !== 0) throw new Error('Expected 0');
});

test('empty strings have distance 0', () => {
    if (levenshtein('', '') !== 0) throw new Error('Expected 0');
});

// --- Single edits ---
test('single substitution = distance 1', () => {
    if (levenshtein('status', 'statuS') !== 1) throw new Error('Expected 1');
});

test('single insertion = distance 1', () => {
    if (levenshtein('staus', 'status') !== 1) throw new Error('Expected 1');
});

test('single deletion = distance 1', () => {
    if (levenshtein('statuss', 'status') !== 1) throw new Error('Expected 1');
});

// --- Common typos ---
test('stauts → status = distance 2', () => {
    const d = levenshtein('stauts', 'status');
    if (d !== 2) throw new Error(`Expected 2, got ${d}`);
});

test('rset → reset = distance 1 (single insertion)', () => {
    const d = levenshtein('rset', 'reset');
    if (d !== 1) throw new Error(`Expected 1, got ${d}`);
});

test('scna → scan = distance 2', () => {
    const d = levenshtein('scna', 'scan');
    if (d !== 2) throw new Error(`Expected 2, got ${d}`);
});

// --- Completely different strings ---
test('completely different strings have high distance', () => {
    const d = levenshtein('abc', 'xyz');
    if (d !== 3) throw new Error(`Expected 3, got ${d}`);
});

// --- One empty string ---
test('empty vs non-empty = length of non-empty', () => {
    if (levenshtein('', 'hello') !== 5) throw new Error('Expected 5');
    if (levenshtein('hello', '') !== 5) throw new Error('Expected 5');
});

module.exports = { passed, failed };
