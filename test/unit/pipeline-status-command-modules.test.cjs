#!/usr/bin/env node
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');

const { handleNext, handlePipelineStatus } = require('../../src/commands/pipeline.cjs');

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

function writeJson(filePath, data) {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

console.log('[unit] pipeline-status-command-modules.test.cjs');

const tmpBase = path.join(os.tmpdir(), `steroid-pipeline-status-${Date.now()}`);
const feature = 'ui-dashboard';
const featureDir = path.join(tmpBase, '.memory', 'changes', feature);
fs.mkdirSync(featureDir, { recursive: true });

test('handlePipelineStatus reports pipeline and frontend evidence state', () => {
    writeJson(path.join(featureDir, 'request.json'), {
        feature,
        requestedAt: new Date().toISOString(),
        source: 'scan',
        summary: 'Initial request',
    });
    fs.writeFileSync(path.join(featureDir, 'context.md'), '# Context\n');
    fs.writeFileSync(path.join(featureDir, 'vibe.md'), '# Vibe\n');
    fs.writeFileSync(path.join(featureDir, 'spec.md'), '# Spec\n');
    fs.writeFileSync(path.join(featureDir, 'design-system.md'), '# Design System\n');
    fs.writeFileSync(path.join(featureDir, 'verify.md'), '# Verify\n\n**Status:** PASS\n');
    writeJson(path.join(featureDir, 'prompt.json'), {
        normalizedSummary: 'Refresh the dashboard UI hierarchy',
        primaryIntent: 'build',
        secondaryIntents: ['design'],
        recommendedPipeline: 'standard-build',
        continuationState: 'fresh-start',
        complexity: 'complex',
        risk: 'medium',
        assumptions: ['Work from the current layout'],
    });
    writeJson(path.join(featureDir, 'design-routing.json'), {
        stack: 'react',
        auditOnly: false,
        wrapperSkill: 'steroid-react-implementation',
        sourceInputIds: ['steroid-design-system', 'steroid-web-direction'],
    });
    writeJson(path.join(featureDir, 'ui-review.json'), {
        feature,
        status: 'PASS',
        freshness: {
            source: 'verify-feature',
            evidenceUpdatedAt: new Date().toISOString(),
        },
        generatedAt: new Date().toISOString(),
    });
    fs.writeFileSync(path.join(featureDir, 'ui-review.md'), '# UI Review\n');
    fs.writeFileSync(path.join(tmpBase, '.memory', 'audit-trail.md'), `${feature}: architect gate passed\n`);

    const result = handlePipelineStatus(['pipeline-status', feature], { targetDir: tmpBase });
    if (result.exitCode !== 0) throw new Error(`Unexpected exitCode: ${result.exitCode}`);
    if (!result.stdout.includes(`Pipeline status for: ${feature}`)) {
        throw new Error(`Missing header: ${result.stdout}`);
    }
    if (!result.stdout.includes('Workflow Overview')) {
        throw new Error(`Missing workflow overview: ${result.stdout}`);
    }
    if (!result.stdout.includes('Current phase: verify')) {
        throw new Error(`Missing current phase summary: ${result.stdout}`);
    }
    if (!result.stdout.includes(`Next command: node steroid-run.cjs gate research ${feature}`)) {
        throw new Error(`Missing next-command guidance: ${result.stdout}`);
    }
    if (!result.stdout.includes('Prompt Intelligence')) {
        throw new Error(`Missing prompt section: ${result.stdout}`);
    }
    if (!result.stdout.includes('Design Intelligence')) {
        throw new Error(`Missing design section: ${result.stdout}`);
    }
    if (!result.stdout.includes('Source inputs: steroid-design-system, steroid-web-direction')) {
        throw new Error(`Missing source-input summary: ${result.stdout}`);
    }
    if (!result.stdout.includes('Audit trail: 1 gate receipt(s) recorded')) {
        throw new Error(`Missing audit trail summary: ${result.stdout}`);
    }
});

test('handlePipelineStatus validates feature input', () => {
    const missingArg = handlePipelineStatus(['pipeline-status'], { targetDir: tmpBase });
    if (missingArg.exitCode !== 1) throw new Error(`Unexpected exitCode: ${missingArg.exitCode}`);
    if (!missingArg.stderr.includes('Usage: npx steroid-run pipeline-status <feature>')) {
        throw new Error(`Unexpected stderr: ${missingArg.stderr}`);
    }

    const missingFeature = handlePipelineStatus(['pipeline-status', 'unknown'], { targetDir: tmpBase });
    if (missingFeature.exitCode !== 1) throw new Error(`Unexpected exitCode: ${missingFeature.exitCode}`);
    if (!missingFeature.stderr.includes('Feature "unknown" not found.')) {
        throw new Error(`Unexpected stderr: ${missingFeature.stderr}`);
    }
});

test('handleNext provides a concise workflow answer', () => {
    const result = handleNext(['next', feature], { targetDir: tmpBase });
    if (result.exitCode !== 0) throw new Error(`Unexpected exitCode: ${result.exitCode}`);
    if (!result.stdout.includes(`Next step for: ${feature}`)) {
        throw new Error(`Missing next header: ${result.stdout}`);
    }
    if (!result.stdout.includes('Why now:')) {
        throw new Error(`Missing why-now guidance: ${result.stdout}`);
    }
    if (!result.stdout.includes(`Next command: node steroid-run.cjs gate research ${feature}`)) {
        throw new Error(`Missing next command: ${result.stdout}`);
    }
    if (!result.stdout.includes('Tip: Run pipeline-status for the full workflow view.')) {
        throw new Error(`Missing pipeline-status tip: ${result.stdout}`);
    }
});

console.log(`  ${passed} passed, ${failed} failed`);
module.exports = { passed, failed };
