#!/usr/bin/env node
'use strict';

const {
    GOVERNED_COMPLETION_OPTIONS,
    GOVERNED_COMPLETION_SOURCE_ARTIFACTS,
    validateGovernedPhaseArtifact,
} = require('../../src/utils/governed-artifacts.cjs');

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

console.log('[unit] governed-artifacts.test.cjs');

test('exports governed completion constants', () => {
    if (GOVERNED_COMPLETION_OPTIONS.length !== 4) {
        throw new Error(`Unexpected completion options: ${JSON.stringify(GOVERNED_COMPLETION_OPTIONS)}`);
    }
    if (JSON.stringify(GOVERNED_COMPLETION_SOURCE_ARTIFACTS) !== JSON.stringify(['verify.json', 'progress.md'])) {
        throw new Error(
            `Unexpected completion source artifacts: ${JSON.stringify(GOVERNED_COMPLETION_SOURCE_ARTIFACTS)}`,
        );
    }
});

test('validates governed spec artifacts', () => {
    const result = validateGovernedPhaseArtifact(
        'spec.md',
        [
            '# Specification: Sample',
            '',
            '## User Stories',
            '',
            '### Story 1',
            '**Acceptance Criteria:**',
            '- Given X, when Y, then Z',
            '',
            '## Success Criteria',
            '',
            '- Flow completes',
            '',
        ].join('\n'),
    );
    if (!result.ok) throw new Error(`Expected governed spec to pass: ${result.reason}`);
});

test('rejects malformed governed plan artifacts', () => {
    const result = validateGovernedPhaseArtifact('plan.md', '# Plan\n\n- [x] done\n');
    if (result.ok) throw new Error('Expected malformed plan to fail');
    if (!String(result.reason).includes('Missing governed plan structure')) {
        throw new Error(`Unexpected reason: ${result.reason}`);
    }
});

test('validates governed diagnosis artifacts', () => {
    const result = validateGovernedPhaseArtifact(
        'diagnosis.md',
        [
            '# Diagnosis: sample-fix',
            '',
            '**Status:** ROOT_CAUSE_FOUND',
            '',
            '## Problem Statement',
            'The feature breaks on load.',
            '',
            '## Root Cause',
            'A stale null check in src/app.tsx.',
            '',
            '## Evidence',
            '- Observed crash on startup',
            '',
            '## Fix Plan',
            '- [ ] Patch the null check',
            '',
            '## Regression Test',
            'Open the feature and confirm startup succeeds.',
            '',
            '## Files Affected',
            '- `src/app.tsx` — patch the guard',
            '',
        ].join('\n'),
    );
    if (!result.ok) throw new Error(`Expected governed diagnosis to pass: ${result.reason}`);
});

console.log(`  ${passed} passed, ${failed} failed`);
module.exports = { passed, failed };
