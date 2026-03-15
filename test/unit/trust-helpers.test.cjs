#!/usr/bin/env node
'use strict';

const {
    createArchiveStamp,
    findBlockedShellSyntax,
    getArchiveDestinationPath,
    parseReviewMarkdown,
} = require('../../src/utils/trust-helpers.cjs');

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

console.log('[unit] trust-helpers.test.cjs');

test('blocks pipe syntax outside quotes', () => {
    const blocked = findBlockedShellSyntax('echo hi | cat');
    if (blocked !== '|') throw new Error(`Expected "|", got ${blocked}`);
});

test('blocks redirection syntax outside quotes', () => {
    const blocked = findBlockedShellSyntax('echo hi > out.txt');
    if (blocked !== '>') throw new Error(`Expected ">", got ${blocked}`);
});

test('does not block pipe-like text inside quotes', () => {
    const blocked = findBlockedShellSyntax(`grep "a|b" file.txt`);
    if (blocked !== null) throw new Error(`Expected null, got ${blocked}`);
});

test('parses plain review status lines', () => {
    const parsed = parseReviewMarkdown('- Stage 1 (Spec): PASS\n- Stage 2 (Quality): FAIL\n');
    if (parsed.stage1 !== 'PASS') throw new Error(`Stage 1 mismatch: ${parsed.stage1}`);
    if (parsed.stage2 !== 'FAIL') throw new Error(`Stage 2 mismatch: ${parsed.stage2}`);
});

test('parses bold review result lines from the generated template', () => {
    const parsed = parseReviewMarkdown('**Stage 1 Result:** PASS\n**Stage 2 Result:** PASS\n');
    if (parsed.stage1 !== 'PASS') throw new Error(`Stage 1 mismatch: ${parsed.stage1}`);
    if (parsed.stage2 !== 'PASS') throw new Error(`Stage 2 mismatch: ${parsed.stage2}`);
});

test('creates filesystem-safe archive stamps', () => {
    const stamp = createArchiveStamp(new Date('2026-03-15T07:01:17.123Z'));
    if (stamp !== '2026-03-15T07-01-17-123Z') {
        throw new Error(`Unexpected stamp: ${stamp}`);
    }
});

test('generates collision-safe archive paths', () => {
    const seen = new Set([
        'archive\\2026-03-15T07-01-17-123Z-verify.json',
        'archive\\2026-03-15T07-01-17-123Z-2-verify.json',
    ]);
    const dest = getArchiveDestinationPath('archive', '2026-03-15T07-01-17-123Z', 'verify.json', (candidate) =>
        seen.has(candidate),
    );
    if (dest !== 'archive\\2026-03-15T07-01-17-123Z-3-verify.json') {
        throw new Error(`Unexpected destination: ${dest}`);
    }
});

module.exports = { passed, failed };
