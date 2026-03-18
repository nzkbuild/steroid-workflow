'use strict';

const GOVERNED_COMPLETION_OPTIONS = [
    'merge_back_locally',
    'push_and_create_review',
    'keep_workspace',
    'discard_work',
];

const GOVERNED_COMPLETION_SOURCE_ARTIFACTS = ['verify.json', 'progress.md'];

/**
 * Removes fenced code blocks before markdown checklist parsing so examples
 * do not inflate task counts.
 *
 * @param {string} content
 * @returns {string}
 */
function stripFencedCodeBlocks(content) {
    return (content || '').replace(/```[\s\S]*?```/g, '');
}

/**
 * Parses markdown checklist statistics from a document.
 *
 * @param {string} content
 * @returns {{ total: number, done: number, remaining: number, percent: number, deferred: string[] }}
 */
function parseChecklistStats(content) {
    const sanitized = stripFencedCodeBlocks(content);
    const checklistLines = sanitized.match(/^- \[[ x]\].+$/gm) || [];
    const doneLines = sanitized.match(/^- \[x\].+$/gm) || [];
    const deferred = sanitized.match(/^- \[ \].+$/gm) || [];
    const total = checklistLines.length;
    const done = doneLines.length;
    const remaining = total - done;
    const percent = total > 0 ? Math.round((done / total) * 100) : 0;
    return { total, done, remaining, percent, deferred };
}

/**
 * Validates the minimum governed structure for durable phase artifacts.
 *
 * @param {string} fileName
 * @param {string} content
 * @returns {{ ok: boolean, reason: string|null }}
 */
function validateGovernedPhaseArtifact(fileName, content) {
    const text = String(content || '');

    if (fileName === 'spec.md') {
        const checks = [
            { ok: /^# Specification:/m.test(text), label: '# Specification:' },
            { ok: /^## User Stories$/m.test(text), label: '## User Stories' },
            { ok: /^## Success Criteria$/m.test(text), label: '## Success Criteria' },
            { ok: /^### Story /m.test(text), label: 'at least one story section' },
            { ok: /\*\*Acceptance Criteria:\*\*/m.test(text), label: '**Acceptance Criteria:**' },
        ];
        const missing = checks.filter((check) => !check.ok).map((check) => check.label);
        return {
            ok: missing.length === 0,
            reason: missing.length ? `Missing governed spec structure: ${missing.join(', ')}` : null,
        };
    }

    if (fileName === 'research.md') {
        const checks = [
            { ok: /^# Research:/m.test(text), label: '# Research:' },
            { ok: /^## Summary$/m.test(text), label: '## Summary' },
            { ok: /^## Standard Stack$/m.test(text), label: '## Standard Stack' },
            { ok: /^## Architecture Patterns$/m.test(text), label: '## Architecture Patterns' },
        ];
        const missing = checks.filter((check) => !check.ok).map((check) => check.label);
        return {
            ok: missing.length === 0,
            reason: missing.length ? `Missing governed research structure: ${missing.join(', ')}` : null,
        };
    }

    if (fileName === 'plan.md') {
        const checks = [
            { ok: /^# Implementation Plan:/m.test(text), label: '# Implementation Plan:' },
            { ok: /^## Tech Stack$/m.test(text), label: '## Tech Stack' },
            { ok: /^## Execution Checklist$/m.test(text), label: '## Execution Checklist' },
            { ok: /^- \[[ x]\] /m.test(text), label: 'at least one checklist item' },
        ];
        const missing = checks.filter((check) => !check.ok).map((check) => check.label);
        return {
            ok: missing.length === 0,
            reason: missing.length ? `Missing governed plan structure: ${missing.join(', ')}` : null,
        };
    }

    if (fileName === 'diagnosis.md') {
        const checks = [
            { ok: /^# Diagnosis:/m.test(text), label: '# Diagnosis:' },
            {
                ok: /^\*\*Status:\*\*\s*(ROOT_CAUSE_FOUND|NEEDS_MORE_DATA|ARCHITECTURAL_ISSUE)/m.test(text),
                label: '**Status:** <ROOT_CAUSE_FOUND|NEEDS_MORE_DATA|ARCHITECTURAL_ISSUE>',
            },
            { ok: /^## Problem Statement$/m.test(text), label: '## Problem Statement' },
            { ok: /^## Root Cause$/m.test(text), label: '## Root Cause' },
            { ok: /^## Evidence$/m.test(text), label: '## Evidence' },
            { ok: /^## Fix Plan$/m.test(text), label: '## Fix Plan' },
            { ok: /^## Regression Test$/m.test(text), label: '## Regression Test' },
            { ok: /^## Files Affected$/m.test(text), label: '## Files Affected' },
        ];
        const missing = checks.filter((check) => !check.ok).map((check) => check.label);
        return {
            ok: missing.length === 0,
            reason: missing.length ? `Missing governed diagnosis structure: ${missing.join(', ')}` : null,
        };
    }

    return { ok: true, reason: null };
}

module.exports = {
    GOVERNED_COMPLETION_OPTIONS,
    GOVERNED_COMPLETION_SOURCE_ARTIFACTS,
    parseChecklistStats,
    validateGovernedPhaseArtifact,
};
