#!/usr/bin/env node
'use strict';

const {
    analyzePrompt,
    buildPromptHealth,
    inspectSession,
    suggestNextPhase,
    summarizeRouteProgress,
} = require('../../src/utils/prompt-intelligence.cjs');

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

console.log('[unit] prompt-intelligence.test.cjs');

test('detects fix intent from symptom language', () => {
    const analysis = analyzePrompt('fix the weird login bug');
    if (analysis.primaryIntent !== 'fix') throw new Error(`Expected fix, got ${analysis.primaryIntent}`);
});

test('detects document intent from docs language', () => {
    const analysis = analyzePrompt('document the API and improve the readme');
    if (analysis.primaryIntent !== 'document') throw new Error(`Expected document, got ${analysis.primaryIntent}`);
});

test('detects mixed-intent prompts and recommends split work', () => {
    const analysis = analyzePrompt('fix login and redesign the landing page and improve mobile');
    if (!analysis.splitRecommended) throw new Error('Expected split recommendation');
    if (analysis.recommendedPipeline !== 'split-work') {
        throw new Error(`Expected split-work, got ${analysis.recommendedPipeline}`);
    }
});

test('detects continuation prompts when session has an active feature', () => {
    const analysis = analyzePrompt('continue what we were doing yesterday', { activeFeature: 'notifications' });
    if (analysis.continuationState !== 'resume') throw new Error(`Expected resume, got ${analysis.continuationState}`);
});

test('classifies simple copy changes as trivial', () => {
    const analysis = analyzePrompt('rename Save to Publish on the button');
    if (analysis.complexity !== 'trivial') throw new Error(`Expected trivial, got ${analysis.complexity}`);
    if (analysis.recommendedPipeline !== 'lite-change') {
        throw new Error(`Expected lite-change, got ${analysis.recommendedPipeline}`);
    }
});

test('classifies migrations as high-risk', () => {
    const analysis = analyzePrompt('upgrade everything to React 19 and latest Next');
    if (analysis.primaryIntent !== 'migrate') throw new Error(`Expected migrate, got ${analysis.primaryIntent}`);
    if (analysis.complexity !== 'high-risk') throw new Error(`Expected high-risk, got ${analysis.complexity}`);
});

test('adds assumptions for vague design prompts', () => {
    const analysis = analyzePrompt('make it feel more premium');
    if (analysis.assumptions.length === 0) throw new Error('Expected design assumptions');
    if (analysis.ambiguity === 'low') throw new Error('Expected vague prompt to stay ambiguous');
});

test('builds prompt health recommendations', () => {
    const analysis = analyzePrompt('make it cleaner');
    const health = buildPromptHealth(analysis);
    if (!health.recommendedAction) throw new Error('Missing recommended action');
    if (health.clarity > 5 || health.clarity < 1) throw new Error(`Invalid clarity score: ${health.clarity}`);
});

test('inspects session state for resumable work', () => {
    const session = inspectSession(
        [
            {
                name: 'old-feature',
                updatedAt: '2026-03-10T10:00:00.000Z',
                incomplete: false,
                lastArtifact: 'verify.json',
            },
            {
                name: 'active-feature',
                updatedAt: '2026-03-15T10:00:00.000Z',
                incomplete: true,
                lastArtifact: 'plan.md',
            },
        ],
        { error_count: 0, status: 'active' },
    );
    if (session.activeFeature !== 'active-feature')
        throw new Error(`Unexpected active feature: ${session.activeFeature}`);
    if (session.defaultState !== 'resume') throw new Error(`Expected resume, got ${session.defaultState}`);
});

test('suggests diagnose as the next phase for fix routes without diagnosis', () => {
    const analysis = analyzePrompt('fix checkout regression');
    const next = suggestNextPhase(analysis, {
        context: true,
        prompt: true,
        diagnosis: false,
        verify: false,
    });
    if (next.phase !== 'diagnose') throw new Error(`Expected diagnose, got ${next.phase}`);
});

test('summarizes route drift when diagnose-first has plan.md before diagnosis.md', () => {
    const analysis = analyzePrompt('fix the checkout bug');
    const summary = summarizeRouteProgress(analysis, {
        context: true,
        prompt: true,
        plan: true,
        diagnosis: false,
        verify: false,
    });
    if (summary.status !== 'drifted') throw new Error(`Expected drifted, got ${summary.status}`);
    if (!summary.detail.includes('diagnosis.md')) throw new Error(`Unexpected detail: ${summary.detail}`);
});

test('summarizes resume-mode as adaptive and recommends engine from existing plan', () => {
    const analysis = analyzePrompt('continue what we were doing yesterday', { activeFeature: 'notif' });
    const summary = summarizeRouteProgress(analysis, {
        context: true,
        prompt: true,
        plan: true,
        verify: false,
    });
    if (summary.status !== 'adaptive') throw new Error(`Expected adaptive, got ${summary.status}`);
    if (summary.next.phase !== 'engine') throw new Error(`Expected engine, got ${summary.next.phase}`);
});

module.exports = { passed, failed };
