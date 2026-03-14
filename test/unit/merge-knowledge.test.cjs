#!/usr/bin/env node
'use strict';

/**
 * Unit tests for mergeKnowledge() — deep merge utility for knowledge stores.
 */
const { mergeKnowledge } = require('../../src/utils/merge-knowledge.cjs');

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

function deepEqual(a, b) {
    return JSON.stringify(a) === JSON.stringify(b);
}

console.log('[unit] merge-knowledge.test.cjs');

// --- Flat Object Merge ---
test('merges flat objects', () => {
    const result = mergeKnowledge({ a: 1 }, { b: 2 });
    if (!deepEqual(result, { a: 1, b: 2 })) throw new Error(`Got: ${JSON.stringify(result)}`);
});

test('incoming overwrites existing primitives', () => {
    const result = mergeKnowledge({ a: 1 }, { a: 2 });
    if (result.a !== 2) throw new Error(`Expected 2, got ${result.a}`);
});

// --- Array Deduplication ---
test('deduplicates arrays', () => {
    const result = mergeKnowledge({ tags: ['a', 'b'] }, { tags: ['b', 'c'] });
    if (!deepEqual(result.tags, ['a', 'b', 'c'])) throw new Error(`Got: ${JSON.stringify(result.tags)}`);
});

test('merges arrays when both are arrays', () => {
    const result = mergeKnowledge({ items: [1, 2] }, { items: [3] });
    if (!deepEqual(result.items, [1, 2, 3])) throw new Error(`Got: ${JSON.stringify(result.items)}`);
});

test('handles empty arrays', () => {
    const result = mergeKnowledge({ items: [] }, { items: ['a'] });
    if (!deepEqual(result.items, ['a'])) throw new Error(`Got: ${JSON.stringify(result.items)}`);
});

// --- Deep Object Merge ---
test('deep-merges nested objects', () => {
    const result = mergeKnowledge({ config: { a: 1, b: 2 } }, { config: { b: 3, c: 4 } });
    if (!deepEqual(result.config, { a: 1, b: 3, c: 4 })) throw new Error(`Got: ${JSON.stringify(result.config)}`);
});

test('handles mixed types (incoming overwrites)', () => {
    const result = mergeKnowledge({ a: [1, 2] }, { a: 'string' });
    if (result.a !== 'string') throw new Error(`Expected string, got ${typeof result.a}`);
});

// --- Edge Cases ---
test('preserves existing keys not in incoming', () => {
    const result = mergeKnowledge({ a: 1, b: 2 }, { c: 3 });
    if (!deepEqual(result, { a: 1, b: 2, c: 3 })) throw new Error(`Got: ${JSON.stringify(result)}`);
});

test('handles empty incoming object', () => {
    const result = mergeKnowledge({ a: 1 }, {});
    if (!deepEqual(result, { a: 1 })) throw new Error(`Got: ${JSON.stringify(result)}`);
});

test('handles empty existing object', () => {
    const result = mergeKnowledge({}, { a: 1 });
    if (!deepEqual(result, { a: 1 })) throw new Error(`Got: ${JSON.stringify(result)}`);
});

test('does not mutate input objects', () => {
    const existing = { a: 1 };
    const incoming = { b: 2 };
    mergeKnowledge(existing, incoming);
    if (existing.b !== undefined) throw new Error('existing was mutated');
    if (incoming.a !== undefined) throw new Error('incoming was mutated');
});

module.exports = { passed, failed };
