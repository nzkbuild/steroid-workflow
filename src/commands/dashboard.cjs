'use strict';

const fs = require('fs');
const path = require('path');

const CIRCUIT_LEVELS = ['🟢 CLEAR', '🟡 LOGGED', '🟠 RE-READ', '🔶 DIAGNOSING', '🔴 ESCALATED', '🛑 TRIPPED'];
const KNOWLEDGE_STORES = ['tech-stack', 'patterns', 'decisions', 'gotchas'];

function canHandle(command) {
    return command === 'dashboard';
}

function buildRuntimeContext(context = {}) {
    const targetDir = context.targetDir || process.cwd();
    return {
        targetDir,
        memoryDir: path.join(targetDir, '.memory'),
        metricsDir: path.join(targetDir, '.memory', 'metrics'),
        knowledgeDir: path.join(targetDir, '.memory', 'knowledge'),
        reportsDir: path.join(targetDir, '.memory', 'reports'),
        stateFile: context.stateFile || path.join(targetDir, '.memory', 'execution_state.json'),
    };
}

function readJsonFile(filePath, fallback = null) {
    if (!fs.existsSync(filePath)) return fallback;
    try {
        return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    } catch {
        return fallback;
    }
}

function readStateFile(stateFile) {
    return readJsonFile(stateFile, {
        error_count: 0,
        last_error: null,
        status: 'active',
        recovery_actions: [],
        error_history: [],
    });
}

function formatFeatureSection(runtime) {
    const lines = ['  ── Features ──────────────────────────────'];
    const featuresData = readJsonFile(path.join(runtime.metricsDir, 'features.json'), {}) || {};
    const featureNames = Object.keys(featuresData).filter((key) => key !== '_lastUpdated');

    if (featureNames.length === 0) {
        lines.push('  No features archived yet.');
        return lines;
    }

    let totalErrors = 0;
    const uiReviewCounts = { PASS: 0, CONDITIONAL: 0, FAIL: 0 };
    const uiRefreshSources = {};
    const uiRecommendations = {};

    for (const name of featureNames) {
        const feature = featuresData[name] || {};
        const icon = feature.status === 'complete' ? '✅' : '⏳';
        const errors = feature.errorCount || 0;
        totalErrors += errors;
        const archivedDate = feature.archived ? String(feature.archived).split('T')[0] : 'unknown';
        const uiStatus = feature.uiReviewStatus ? ` — UI ${feature.uiReviewStatus}` : '';
        const uiFreshness = feature.uiReviewRefreshSource ? ` (${feature.uiReviewRefreshSource})` : '';
        const uiRecommendation = feature.uiReviewRecommendation ? ` [${feature.uiReviewRecommendation}]` : '';

        if (feature.uiReviewStatus && Object.prototype.hasOwnProperty.call(uiReviewCounts, feature.uiReviewStatus)) {
            uiReviewCounts[feature.uiReviewStatus] += 1;
        }
        if (feature.uiReviewRefreshSource) {
            uiRefreshSources[feature.uiReviewRefreshSource] = (uiRefreshSources[feature.uiReviewRefreshSource] || 0) + 1;
        }
        if (feature.uiReviewRecommendation) {
            uiRecommendations[feature.uiReviewRecommendation] = (uiRecommendations[feature.uiReviewRecommendation] || 0) + 1;
        }

        lines.push(`  ${icon} ${name} — ${errors} error(s)${uiStatus}${uiFreshness}${uiRecommendation} — ${archivedDate}`);
    }

    const avgErrors = featureNames.length > 0 ? (totalErrors / featureNames.length).toFixed(1) : '0.0';
    lines.push('');
    lines.push(`  Total: ${featureNames.length} features | Avg errors: ${avgErrors}/feature`);

    const uiTotal = uiReviewCounts.PASS + uiReviewCounts.CONDITIONAL + uiReviewCounts.FAIL;
    if (uiTotal > 0) {
        lines.push(
            `  Frontend quality: ${uiReviewCounts.PASS} PASS, ${uiReviewCounts.CONDITIONAL} CONDITIONAL, ${uiReviewCounts.FAIL} FAIL`,
        );
        const refreshSummary = Object.entries(uiRefreshSources)
            .sort((a, b) => b[1] - a[1])
            .map(([source, count]) => `${count} ${source}`)
            .join(', ');
        if (refreshSummary) {
            lines.push(`  Frontend freshness: ${refreshSummary}`);
        }
        const recommendationSummary = Object.entries(uiRecommendations)
            .sort((a, b) => b[1] - a[1])
            .map(([recommendation, count]) => `${count} ${recommendation}`)
            .join(', ');
        if (recommendationSummary) {
            lines.push(`  Frontend release recommendation: ${recommendationSummary}`);
        }
    }

    return lines;
}

function formatErrorPatternSection(runtime) {
    const lines = ['', '  ── Error Patterns ────────────────────────'];
    const errorPatternData = readJsonFile(path.join(runtime.metricsDir, 'error-patterns.json'), null);

    if (!errorPatternData) {
        lines.push('  No error patterns recorded yet.');
        return lines;
    }

    const patterns = Array.isArray(errorPatternData.patterns) ? errorPatternData.patterns : [];
    lines.push(`  ${patterns.length} errors recorded`);
    if (patterns.length > 0) {
        const keywords = {};
        for (const pattern of patterns) {
            const keyword = pattern.keyword || 'unknown';
            keywords[keyword] = (keywords[keyword] || 0) + 1;
        }
        const sorted = Object.entries(keywords)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5);
        if (sorted.length > 0) {
            lines.push('  Top error sources:');
            for (const [keyword, count] of sorted) {
                lines.push(`    ${count}x — ${keyword}`);
            }
        }
    }
    return lines;
}

function formatCircuitSection(runtime) {
    const state = readStateFile(runtime.stateFile);
    const level = Math.min(state.error_count || 0, 5);
    const tripCount = (Array.isArray(state.recovery_actions) ? state.recovery_actions : []).filter(
        (entry) => String(entry).includes('L4') || String(entry).includes('L5'),
    ).length;
    return [
        '',
        '  ── Circuit Breaker ───────────────────────',
        `  Current: ${CIRCUIT_LEVELS[level]} (${state.error_count || 0}/5 errors)`,
        `  Escalations this session: ${tripCount}`,
    ];
}

function formatKnowledgeSection(runtime) {
    const lines = ['', '  ── Knowledge Stores ──────────────────────'];
    let populated = 0;

    for (const store of KNOWLEDGE_STORES) {
        const storeFile = path.join(runtime.knowledgeDir, `${store}.json`);
        if (!fs.existsSync(storeFile)) {
            lines.push(`  ○  ${store}: empty`);
            continue;
        }
        try {
            const data = JSON.parse(fs.readFileSync(storeFile, 'utf-8'));
            const entries = Object.keys(data).filter((key) => !key.startsWith('_')).length;
            lines.push(`  ✅ ${store}: ${entries} entries`);
            populated++;
        } catch {
            lines.push(`  ⚠️ ${store}: corrupt`);
        }
    }

    lines.push(`  Coverage: ${populated}/4 stores populated`);
    return lines;
}

function formatReportsSection(runtime) {
    const lines = ['', '  ── Handoff Reports ───────────────────────'];
    if (fs.existsSync(runtime.reportsDir)) {
        const reports = fs.readdirSync(runtime.reportsDir).filter((entry) => entry.endsWith('.md'));
        lines.push(`  ${reports.length} report(s) generated`);
    } else {
        lines.push('  No reports generated yet.');
    }
    return lines;
}

function handleDashboard(context = {}) {
    const runtime = buildRuntimeContext(context);
    const lines = ['', '[steroid-run] 📊 Steroid-Workflow Dashboard', ''];
    lines.push(...formatFeatureSection(runtime));
    lines.push(...formatErrorPatternSection(runtime));
    lines.push(...formatCircuitSection(runtime));
    lines.push(...formatKnowledgeSection(runtime));
    lines.push(...formatReportsSection(runtime));
    lines.push('', '  ─────────────────────────────────────────', '');

    return {
        handled: true,
        area: 'dashboard',
        command: 'dashboard',
        exitCode: 0,
        stdout: `${lines.join('\n')}\n`,
    };
}

function run(argv = [], context = {}) {
    return handleDashboard(context);
}

module.exports = {
    buildRuntimeContext,
    canHandle,
    handleDashboard,
    run,
};
