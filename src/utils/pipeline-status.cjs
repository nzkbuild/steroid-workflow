'use strict';

const fs = require('fs');
const path = require('path');

const { loadRequestReceipt } = require('./receipt-loaders.cjs');
const { loadDesignRoutingReceipt, loadUiReviewReceipt } = require('./frontend-receipt-loaders.cjs');
const { ROUTE_PHASE_HINTS, summarizeRouteProgress } = require('./prompt-intelligence.cjs');
const { detectUiTask } = require('./design-routing.cjs');

function readJsonFile(filePath) {
    if (!fs.existsSync(filePath)) return null;
    try {
        return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    } catch {
        return null;
    }
}

function buildFeatureArtifactState(featureDir) {
    const feature = path.basename(featureDir);
    const requestReceipt = loadRequestReceipt(feature, featureDir);
    const designReceipt = loadDesignRoutingReceipt(featureDir);
    return {
        request: !!requestReceipt.requestedAt,
        context: fs.existsSync(path.join(featureDir, 'context.md')),
        prompt: fs.existsSync(path.join(featureDir, 'prompt.json')),
        designRoute: !!designReceipt,
        vibe: fs.existsSync(path.join(featureDir, 'vibe.md')),
        spec: fs.existsSync(path.join(featureDir, 'spec.md')),
        research: fs.existsSync(path.join(featureDir, 'research.md')),
        designSystem: fs.existsSync(path.join(featureDir, 'design-system.md')),
        plan: fs.existsSync(path.join(featureDir, 'plan.md')),
        diagnosis: fs.existsSync(path.join(featureDir, 'diagnosis.md')),
        accessibility: fs.existsSync(path.join(featureDir, 'accessibility.json')),
        uiAudit: fs.existsSync(path.join(featureDir, 'ui-audit.json')),
        uiReview: fs.existsSync(path.join(featureDir, 'ui-review.md')),
        uiReviewReceipt: fs.existsSync(path.join(featureDir, 'ui-review.json')),
        verify: fs.existsSync(path.join(featureDir, 'verify.md')) || fs.existsSync(path.join(featureDir, 'verify.json')),
    };
}

function getRouteDisplayPhases(route) {
    const phases = ROUTE_PHASE_HINTS[route] || ROUTE_PHASE_HINTS['standard-build'] || [];
    return phases.map((phase) => (phase === 'normalize-prompt' ? 'prompt' : phase));
}

function getPipelineStatusEntries(featureDir, promptReceipt) {
    const route = promptReceipt ? promptReceipt.recommendedPipeline || 'standard-build' : 'standard-build';
    const expectedPhases = new Set(getRouteDisplayPhases(route));
    const designReceipt = loadDesignRoutingReceipt(featureDir);
    const verifyReceipt = readJsonFile(path.join(featureDir, 'verify.json'));
    const designHint = `${promptReceipt?.normalizedSummary || ''} ${designReceipt?.prompt || ''}`.trim();
    const designRouteExpected = Boolean(designReceipt) || detectUiTask(designHint);
    const designSystemExpected = designRouteExpected && !Boolean(designReceipt?.auditOnly);
    const accessibilityExpected = designRouteExpected && designReceipt?.stack !== 'react-native';
    const uiAuditExpected = accessibilityExpected && Boolean(verifyReceipt?.deepRequested);
    const uiReviewExpected =
        designRouteExpected &&
        (fs.existsSync(path.join(featureDir, 'verify.md')) || fs.existsSync(path.join(featureDir, 'verify.json')));

    const entries = [
        ['scan', 'context.md', 'Codebase context'],
        ['prompt', 'prompt.json', 'Prompt interpretation'],
        ['design-route', 'design-routing.json', 'Design routing receipt'],
        ['vibe', 'vibe.md', 'Vibe capture'],
        ['specify', 'spec.md', 'Specification'],
        ['research', 'research.md', 'Tech research'],
        ['design-system', 'design-system.md', 'Design system artifact'],
        ['accessibility', 'accessibility.json', 'Accessibility audit receipt'],
        ['ui-audit', 'ui-audit.json', 'Browser UI audit receipt'],
        ['ui-review', 'ui-review.md', 'Frontend review summary'],
        ['ui-review-receipt', 'ui-review.json', 'Frontend review receipt'],
        ['architect', 'plan.md', 'Architecture plan'],
        ['diagnose', 'diagnosis.md', 'Diagnosis (fix path)'],
        ['engine', route === 'diagnose-first' ? 'diagnosis.md' : 'plan.md', route === 'diagnose-first' ? 'Engine execution (from diagnosis)' : 'Engine execution'],
        ['verify', 'verify.md', 'Verification evidence'],
    ].map(([name, file, label]) => ({
        name,
        file,
        label,
        present: fs.existsSync(path.join(featureDir, file)) || (name === 'verify' && fs.existsSync(path.join(featureDir, 'verify.json'))),
    }));

    return entries.map((entry) => {
        let expected = expectedPhases.has(entry.name);
        if (entry.name === 'design-route') expected = designRouteExpected;
        else if (entry.name === 'design-system') expected = designSystemExpected;
        else if (entry.name === 'accessibility') expected = accessibilityExpected;
        else if (entry.name === 'ui-audit') expected = uiAuditExpected;
        else if (entry.name === 'ui-review' || entry.name === 'ui-review-receipt') expected = uiReviewExpected;
        return { ...entry, expected };
    });
}

function getCurrentPhase(phases, routeSummary) {
    const expectedPhases = phases.filter((phase) => phase.expected);
    const latestCompleted = [...expectedPhases].reverse().find((phase) => phase.present);
    if (routeSummary?.next?.phase === 'complete') {
        return latestCompleted ? `${latestCompleted.name} complete` : 'complete';
    }
    if (!latestCompleted) {
        return 'not started';
    }
    return latestCompleted.name;
}

function getBlockingItems(phases, routeSummary) {
    if (!routeSummary || routeSummary.next.phase === 'complete') {
        return [];
    }

    const nextPhase = routeSummary.next.phase;
    return phases
        .filter((phase) => phase.expected && !phase.present)
        .filter((phase) => {
            if (nextPhase === 'prompt') return phase.name === 'prompt';
            return phase.name === nextPhase || phase.name.startsWith(nextPhase);
        })
        .map((phase) => `${phase.file} missing`);
}

function formatNextCommand(feature, routeSummary) {
    if (!routeSummary) {
        return `node steroid-run.cjs scan ${feature}`;
    }

    switch (routeSummary.next.phase) {
        case 'scan':
            return `node steroid-run.cjs scan ${feature}`;
        case 'normalize-prompt':
        case 'prompt':
            return `node steroid-run.cjs normalize-prompt "<user prompt>" --feature ${feature} --write`;
        case 'vibe':
            return `Use the steroid vibe step for "${feature}" to produce vibe.md`;
        case 'specify':
            return `Use the steroid specify step for "${feature}" to produce spec.md`;
        case 'research':
            return `node steroid-run.cjs gate research ${feature}`;
        case 'architect':
            return `node steroid-run.cjs gate architect ${feature}`;
        case 'diagnose':
            return `node steroid-run.cjs gate diagnose ${feature}`;
        case 'engine':
            return `node steroid-run.cjs gate engine ${feature}`;
        case 'verify':
            return `node steroid-run.cjs verify-feature ${feature}`;
        case 'complete':
            return `node steroid-run.cjs archive ${feature}`;
        default:
            return `node steroid-run.cjs pipeline-status ${feature}`;
    }
}

function buildWorkflowOverview(feature, featureDir, promptReceipt) {
    const phases = getPipelineStatusEntries(featureDir, promptReceipt);
    const artifactState = buildFeatureArtifactState(featureDir);
    const routeSummary = promptReceipt ? summarizeRouteProgress(promptReceipt, artifactState) : null;
    const currentPhase = getCurrentPhase(phases, routeSummary);
    const blockers = getBlockingItems(phases, routeSummary);
    const nextCommand = formatNextCommand(feature, routeSummary);
    const routeName = promptReceipt?.recommendedPipeline || 'standard-build';
    const completed = phases.filter((phase) => phase.present).length;

    return {
        phases,
        artifactState,
        routeSummary,
        currentPhase,
        blockers,
        nextCommand,
        routeName,
        completed,
        total: phases.length,
    };
}

function formatPipelineStatus(feature, featureDir, promptReceipt) {
    const overview = buildWorkflowOverview(feature, featureDir, promptReceipt);
    const { phases, artifactState, routeSummary, currentPhase, blockers, nextCommand, routeName, completed, total } =
        overview;
    const lines = [``, `[steroid-run] Pipeline status for: ${feature}`, ``];

    for (const phase of phases) {
        const artifactPath = path.join(featureDir, phase.file);
        if (phase.present && fs.existsSync(artifactPath)) {
            const lineCount = fs.readFileSync(artifactPath, 'utf-8').split('\n').length;
            const suffix = phase.expected ? `${lineCount} lines` : `${lineCount} lines, extra for route`;
            const icon = phase.expected ? '✅' : '⚠️';
            lines.push(`  ${icon} ${phase.name.padEnd(12)} → ${phase.file} (${suffix})`);
        } else if (!phase.expected) {
            lines.push(
                `  ⏭️ ${phase.name.padEnd(12)} → ${phase.file} (not used by ${promptReceipt?.recommendedPipeline || 'standard-build'})`,
            );
        } else {
            lines.push(`  ⬜ ${phase.name.padEnd(12)} → ${phase.file} (missing)`);
        }
    }

    const barFull = Math.round((completed / total) * 16);
    const bar = '█'.repeat(barFull) + '░'.repeat(16 - barFull);
    lines.push('  Workflow Overview');
    lines.push(`    - Route: ${routeName}`);
    lines.push(`    - Current phase: ${currentPhase}`);
    lines.push(`    - Progress: ${completed}/${total} tracked artifacts`);
    if (routeSummary) {
        lines.push(`    - Status: ${routeSummary.status}`);
    }
    if (blockers.length > 0) {
        lines.push(`    - Blockers: ${blockers.join('; ')}`);
    } else if (routeSummary?.next?.phase === 'complete') {
        lines.push('    - Blockers: none');
    } else {
        lines.push('    - Blockers: no hard blocker detected');
    }
    lines.push(`    - Next command: ${nextCommand}`);
    lines.push('');
    lines.push(`  Progress Bar: ${bar} ${completed}/${total} phases`);
    lines.push('');

    if (promptReceipt) {
        lines.push('  Prompt Intelligence');
        lines.push(`    - Intent: ${promptReceipt.primaryIntent || 'Unknown'}`);
        if (Array.isArray(promptReceipt.secondaryIntents) && promptReceipt.secondaryIntents.length > 0) {
            lines.push(`    - Secondary: ${promptReceipt.secondaryIntents.join(', ')}`);
        }
        lines.push(`    - Route: ${promptReceipt.recommendedPipeline || 'Unknown'}`);
        lines.push(`    - Continuation: ${promptReceipt.continuationState || 'Unknown'}`);
        lines.push(`    - Complexity/Risk: ${promptReceipt.complexity || 'Unknown'} / ${promptReceipt.risk || 'Unknown'}`);
        if (Array.isArray(promptReceipt.assumptions) && promptReceipt.assumptions.length > 0) {
            lines.push(`    - Assumptions: ${promptReceipt.assumptions.length}`);
        }
        lines.push('  Route Guidance');
        lines.push(`    - Status: ${routeSummary.status}`);
        lines.push(`    - Detail: ${routeSummary.detail}`);
        if (Array.isArray(routeSummary.expectedPhases)) {
            lines.push(`    - Expected phases: ${routeSummary.expectedPhases.join(' -> ')}`);
        }
        lines.push(`    - Next step: ${routeSummary.next.phase}`);
        lines.push(`    - Why next: ${routeSummary.next.reason}`);
        lines.push('');
    }

    const designReceipt = loadDesignRoutingReceipt(featureDir);
    const uiReviewReceipt = loadUiReviewReceipt(feature, featureDir);
    const designExpected =
        artifactState.designRoute || artifactState.designSystem || detectUiTask(promptReceipt?.normalizedSummary || '');
    if (designReceipt || designExpected) {
        lines.push('  Design Intelligence');
        lines.push(`    - Routing receipt: ${artifactState.designRoute ? 'present' : 'missing'}`);
        lines.push(`    - Design system: ${artifactState.designSystem ? 'present' : 'missing'}`);
        lines.push(`    - Accessibility receipt: ${artifactState.accessibility ? 'present' : 'missing'}`);
        lines.push(`    - Browser audit receipt: ${artifactState.uiAudit ? 'present' : 'missing'}`);
        lines.push(`    - UI review summary: ${artifactState.uiReview ? 'present' : 'missing'}`);
        lines.push(`    - UI review receipt: ${artifactState.uiReviewReceipt ? 'present' : 'missing'}`);
        if (uiReviewReceipt) {
            lines.push(`    - UI review status: ${uiReviewReceipt.status || 'Unknown'}`);
            lines.push(`    - UI review refreshed by: ${uiReviewReceipt.freshness?.source || 'unknown'}`);
            if (uiReviewReceipt.generatedAt) {
                lines.push(`    - UI review generated: ${uiReviewReceipt.generatedAt}`);
            }
            if (uiReviewReceipt.freshness?.evidenceUpdatedAt) {
                lines.push(`    - Latest frontend evidence: ${uiReviewReceipt.freshness.evidenceUpdatedAt}`);
            }
        }
        if (designReceipt) {
            lines.push(`    - Stack: ${designReceipt.stack || 'Unknown'}`);
            lines.push(`    - Audit only: ${designReceipt.auditOnly ? 'yes' : 'no'}`);
            lines.push(`    - Wrapper: ${designReceipt.wrapperSkill || 'none'}`);
            const sourceInputs = Array.isArray(designReceipt.sourceInputIds)
                ? designReceipt.sourceInputIds
                : Array.isArray(designReceipt.importedSourceIds)
                  ? designReceipt.importedSourceIds
                  : [];
            lines.push(`    - Source inputs: ${sourceInputs.length > 0 ? sourceInputs.join(', ') : 'none'}`);
        } else {
            lines.push('    - Routing hint: UI work appears likely, but design-routing.json is missing.');
        }
        lines.push('');
    }

    const auditTrail = path.join(path.dirname(featureDir), '..', 'audit-trail.md');
    if (fs.existsSync(auditTrail)) {
        const auditLines = fs.readFileSync(auditTrail, 'utf-8').split('\n');
        const featureEntries = auditLines.filter((line) => line.includes(feature));
        if (featureEntries.length > 0) {
            lines.push(`  📋 Audit trail: ${featureEntries.length} gate receipt(s) recorded`);
        }
    }

    return `${lines.join('\n')}\n`;
}

module.exports = {
    buildWorkflowOverview,
    buildFeatureArtifactState,
    formatPipelineStatus,
    getPipelineStatusEntries,
};
