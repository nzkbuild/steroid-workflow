'use strict';

const fs = require('fs');
const path = require('path');

const { loadDesignRoutingReceipt } = require('./frontend-receipt-loaders.cjs');
const { loadVerifyReceipt } = require('./receipt-loaders.cjs');
const { detectUiTask } = require('./design-routing.cjs');
const { summarizeUiReviewStatus } = require('./ui-archive-policy.cjs');

function readJsonFile(filePath) {
    if (!fs.existsSync(filePath)) return null;
    try {
        return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    } catch {
        return null;
    }
}

function writeJsonFile(filePath, data) {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

function readFeatureArtifactText(featureDir, fileName) {
    const artifactPath = path.join(featureDir, fileName);
    if (!fs.existsSync(artifactPath)) return '';
    try {
        return fs.readFileSync(artifactPath, 'utf-8');
    } catch {
        return '';
    }
}

function isHttpUrl(value) {
    return /^https?:\/\//i.test(String(value || '').trim());
}

function normalizePreviewUrlCandidate(value) {
    const trimmed = String(value || '')
        .trim()
        .replace(/^['"]|['"]$/g, '');
    if (!trimmed) return '';
    if (isHttpUrl(trimmed)) return trimmed;
    if (/^[a-z0-9.-]+\.[a-z]{2,}(\/.*)?$/i.test(trimmed)) {
        return `https://${trimmed.replace(/^\/+/, '')}`;
    }
    return '';
}

function detectUiFeatureForGate(featureDir, promptReceipt = null) {
    const designReceipt = loadDesignRoutingReceipt(featureDir);
    if (designReceipt && designReceipt.domain !== 'none' && !designReceipt.auditOnly) {
        return true;
    }

    const combined = [
        promptReceipt?.normalizedSummary,
        promptReceipt?.pipelineHint,
        readFeatureArtifactText(featureDir, 'vibe.md'),
        readFeatureArtifactText(featureDir, 'spec.md'),
        readFeatureArtifactText(featureDir, 'research.md'),
        readFeatureArtifactText(featureDir, 'plan.md'),
    ]
        .filter(Boolean)
        .join('\n')
        .toLowerCase();

    return detectUiTask(combined);
}

function summarizeAccessibilityImpact(impact) {
    if (impact === 'critical' || impact === 'serious') return 'FAIL';
    if (impact === 'moderate' || impact === 'minor') return 'WARN';
    return 'PASS';
}

function buildAccesslintResultFromReceipt(receipt) {
    if (!receipt) {
        return {
            status: 'SKIP',
            detail: 'No AccessLint receipt was available for this UI review.',
        };
    }

    const status = summarizeAccessibilityImpact(receipt.highestImpact || 'none');
    return {
        status,
        detail:
            receipt.violationCount > 0
                ? `${receipt.violationCount} issue(s) across ${receipt.fileCount || 0} HTML target(s); highest impact ${receipt.highestImpact || 'unknown'}.`
                : `No violations across ${receipt.fileCount || 0} HTML target(s)`,
    };
}

function summarizeBrowserAuditResult(audit) {
    if (!audit || audit.ok === false) {
        return {
            status: 'FAIL',
            detail: audit?.error || audit?.reason || 'Browser audit failed before the page could be inspected',
        };
    }

    const consoleErrors = (audit.consoleMessages || []).filter((message) => message.type === 'error');
    const consoleWarnings = (audit.consoleMessages || []).filter((message) => message.type === 'warning');
    const pageErrors = Array.isArray(audit.pageErrors) ? audit.pageErrors : [];
    const failedRequests = Array.isArray(audit.failedRequests) ? audit.failedRequests : [];
    const titleMissing = !String(audit.pageTitle || '').trim();

    const status =
        pageErrors.length > 0 || failedRequests.length > 0 || consoleErrors.length > 0
            ? 'FAIL'
            : consoleWarnings.length > 0 || titleMissing
              ? 'WARN'
              : 'PASS';

    const detailParts = [
        `target ${audit.finalUrl || audit.target || 'unknown'}`,
        `console errors ${consoleErrors.length}`,
        `console warnings ${consoleWarnings.length}`,
        `page errors ${pageErrors.length}`,
        `failed requests ${failedRequests.length}`,
    ];

    if (titleMissing) {
        detailParts.push('missing document title');
    } else {
        detailParts.push(`title "${String(audit.pageTitle).trim()}"`);
    }

    if (audit.screenshotPath) {
        detailParts.push(`screenshot ${audit.screenshotPath}`);
    }

    return {
        status,
        detail: detailParts.join('; '),
    };
}

function buildUiRiskFindings({
    designReceipt,
    hasDesignSystem,
    accesslintReceipt,
    accesslintResult,
    browserAuditReceipt,
    browserAuditResult,
    deepMode,
}) {
    const findings = [];

    if (designReceipt && !designReceipt.auditOnly && !hasDesignSystem) {
        findings.push({
            severity: 'critical',
            title: 'Design system artifact missing',
            detail: 'UI work was routed through the design system flow, but design-system.md is missing.',
        });
    }

    if (!accesslintReceipt) {
        findings.push({
            severity: deepMode ? 'medium' : 'info',
            title: 'Accessibility evidence missing',
            detail: accesslintResult?.detail || 'No AccessLint receipt was available for this UI review.',
        });
    } else if ((accesslintReceipt.violationCount || 0) > 0) {
        findings.push({
            severity:
                accesslintReceipt.highestImpact === 'critical' || accesslintReceipt.highestImpact === 'serious'
                    ? 'critical'
                    : 'medium',
            title: 'Accessibility violations detected',
            detail: `${accesslintReceipt.violationCount} issue(s) across ${accesslintReceipt.fileCount || 0} HTML target(s); highest impact ${accesslintReceipt.highestImpact || 'unknown'}.`,
        });
    }

    if (browserAuditReceipt) {
        const consoleErrors = (browserAuditReceipt.consoleMessages || []).filter((message) => message.type === 'error');
        const pageErrors = browserAuditReceipt.pageErrors || [];
        const failedRequests = browserAuditReceipt.failedRequests || [];
        const consoleWarnings = (browserAuditReceipt.consoleMessages || []).filter(
            (message) => message.type === 'warning',
        );
        const titleMissing = !String(browserAuditReceipt.pageTitle || '').trim();

        if (pageErrors.length > 0 || failedRequests.length > 0 || consoleErrors.length > 0) {
            findings.push({
                severity: 'critical',
                title: 'Browser audit found runtime failures',
                detail: `${consoleErrors.length} console error(s), ${pageErrors.length} page error(s), ${failedRequests.length} failed request(s).`,
            });
        } else if (consoleWarnings.length > 0 || titleMissing) {
            findings.push({
                severity: 'medium',
                title: 'Browser audit found polish issues',
                detail: `${consoleWarnings.length} console warning(s)${titleMissing ? '; missing document title' : ''}.`,
            });
        }
    } else if (deepMode) {
        findings.push({
            severity: 'medium',
            title: 'Browser runtime evidence missing',
            detail: browserAuditResult?.detail || 'Deep browser audit did not produce a ui-audit.json receipt.',
        });
    }

    return findings;
}

function buildUiReviewChecklist(stack, previewTarget, deepMode) {
    if (stack === 'react-native') {
        return [
            'Press targets and primary controls are comfortable for touch and use native-friendly interaction primitives.',
            'Safe areas, scroll insets, and full-screen layouts are handled intentionally on mobile devices.',
            'Lists and media-heavy surfaces are virtualized or otherwise optimized for mobile rendering.',
            'Motion uses transform/opacity and stays coherent with navigation context.',
            'Empty, loading, offline, and error states are explicit mobile-ready screens.',
        ];
    }

    const checklist = [
        'Interactive controls should stay semantic, labeled, and keyboard-operable.',
        'Focus visibility, hover feedback, and reduced-motion handling should be explicit rather than implied.',
        'Long content, truncation, empty states, and responsive overflow should degrade cleanly.',
        'Primary actions, inline errors, and async state changes should remain obvious in the UI.',
        'Images, media, and large lists should avoid obvious CLS or rendering-cost regressions.',
    ];

    if (previewTarget || deepMode) {
        checklist.push('Deep-linked UI state, runtime warnings, and browser evidence should stay aligned with the shipped route.');
    }

    return checklist;
}

function buildUiReviewMarkdown(feature, options) {
    const {
        verifyStatus,
        promptReceipt,
        designReceipt,
        hasDesignSystem,
        accesslintReceipt,
        accesslintResult,
        browserAuditReceipt,
        browserAuditResult,
        previewTarget,
        deepMode,
        refreshSource,
        refreshReason,
        evidenceUpdatedAt,
        evidenceUpdatedFrom,
        version = '7.0.0-beta.1',
    } = options;

    const findings = buildUiRiskFindings({
        designReceipt,
        hasDesignSystem,
        accesslintReceipt,
        accesslintResult,
        browserAuditReceipt,
        browserAuditResult,
        deepMode,
    });
    const uiStatus = summarizeUiReviewStatus(findings);
    const accesslintEvidence = {
        present: !!accesslintReceipt,
        status: accesslintResult?.status || 'SKIP',
        detail: accesslintResult?.detail || '',
        violationCount: accesslintReceipt?.violationCount || 0,
        highestImpact: accesslintReceipt?.highestImpact || 'none',
        fileCount: accesslintReceipt?.fileCount || 0,
    };
    const browserAuditEvidence = {
        present: !!browserAuditReceipt,
        status: browserAuditResult?.status || 'SKIP',
        detail: browserAuditResult?.detail || '',
        finalUrl: browserAuditReceipt?.finalUrl || browserAuditReceipt?.target || null,
        consoleErrors: (browserAuditReceipt?.consoleMessages || []).filter((message) => message.type === 'error').length,
        consoleWarnings: (browserAuditReceipt?.consoleMessages || []).filter((message) => message.type === 'warning')
            .length,
        pageErrors: (browserAuditReceipt?.pageErrors || []).length,
        failedRequests: (browserAuditReceipt?.failedRequests || []).length,
        screenshotPath: browserAuditReceipt?.screenshotPath || null,
    };
    const checklist = buildUiReviewChecklist(designReceipt?.stack || 'unknown', previewTarget, deepMode);
    const receipt = {
        feature,
        status: uiStatus,
        verifyStatus,
        generatedAt: new Date().toISOString(),
        stack: designReceipt?.stack || 'unknown',
        auditOnly: !!designReceipt?.auditOnly,
        wrapperSkill: designReceipt?.wrapperSkill || null,
        sourceInputIds: Array.isArray(designReceipt?.sourceInputIds)
            ? designReceipt.sourceInputIds
            : Array.isArray(designReceipt?.importedSourceIds)
              ? designReceipt.importedSourceIds
              : [],
        importedSourceIds: Array.isArray(designReceipt?.importedSourceIds) ? designReceipt.importedSourceIds : [],
        promptSummary: promptReceipt?.normalizedSummary || '',
        previewTarget: previewTarget || null,
        evidence: {
            designRoutePresent: !!designReceipt,
            designSystemPresent: !!hasDesignSystem,
            accesslint: accesslintEvidence,
            browserAudit: browserAuditEvidence,
        },
        freshness: {
            source: refreshSource || 'unknown',
            reason: refreshReason || 'UI review refreshed.',
            evidenceUpdatedAt: evidenceUpdatedAt || null,
            evidenceUpdatedFrom: evidenceUpdatedFrom || null,
        },
        checklist,
        findings,
    };

    const lines = [
        `# UI Review: ${feature}`,
        '',
        `**Generated:** ${receipt.generatedAt}`,
        `**UI Status:** ${uiStatus}`,
        `**Verification Status:** ${verifyStatus}`,
        `**Refresh Source:** ${receipt.freshness.source}`,
        '',
        '## Inputs',
        '',
        `- Prompt summary: ${promptReceipt?.normalizedSummary || 'Unknown'}`,
        `- Wrapper skill: ${designReceipt?.wrapperSkill || 'none'}`,
        `- Stack: ${designReceipt?.stack || 'Unknown'}`,
        `- Audit-only route: ${designReceipt?.auditOnly ? 'yes' : 'no'}`,
        `- Design routing receipt: ${designReceipt ? 'present' : 'missing'}`,
        `- Design system artifact: ${hasDesignSystem ? 'present' : 'missing'}`,
        `- Source inputs: ${
            Array.isArray(designReceipt?.sourceInputIds) && designReceipt.sourceInputIds.length > 0
                ? designReceipt.sourceInputIds.join(', ')
                : Array.isArray(designReceipt?.importedSourceIds) && designReceipt.importedSourceIds.length > 0
                  ? designReceipt.importedSourceIds.join(', ')
                : 'none'
        }`,
        `- Preview target: ${previewTarget || 'not provided'}`,
        `- Refresh reason: ${receipt.freshness.reason}`,
        `- Latest evidence update: ${receipt.freshness.evidenceUpdatedAt || 'unknown'}`,
        `- Latest evidence source: ${receipt.freshness.evidenceUpdatedFrom || 'unknown'}`,
        '',
        '## Automated Evidence',
        '',
        `- AccessLint: ${accesslintEvidence.status}${accesslintEvidence.detail ? ` — ${accesslintEvidence.detail}` : ''}`,
        `- Browser audit: ${browserAuditEvidence.status}${browserAuditEvidence.detail ? ` — ${browserAuditEvidence.detail}` : ''}`,
        '',
        '## Key Frontend Risks',
        '',
    ];

    if (findings.length === 0) {
        lines.push('- No significant frontend risks were detected from the current UI receipts.');
    } else {
        for (const finding of findings) {
            lines.push(`- ${finding.severity.toUpperCase()}: ${finding.title} — ${finding.detail}`);
        }
    }

    lines.push(
        '',
        '## Review Checklist',
        '',
        ...checklist.map((item) => `- ${item}`),
    );

    lines.push(
        '',
        '## Artifacts',
        '',
        `- design-routing.json: ${designReceipt ? 'present' : 'missing'}`,
        `- design-system.md: ${hasDesignSystem ? 'present' : 'missing'}`,
        `- accessibility.json: ${accesslintReceipt ? 'present' : 'missing'}`,
        `- ui-audit.json: ${browserAuditReceipt ? 'present' : 'missing'}`,
        '',
        '---',
        `_Generated by steroid-workflow v${version}_`,
        '',
    );

    return {
        status: uiStatus,
        content: lines.join('\n'),
        findings,
        receipt,
    };
}

function refreshUiReviewArtifacts(feature, featureDir, options = {}) {
    const promptReceipt = readJsonFile(path.join(featureDir, 'prompt.json'));
    const designReceipt = loadDesignRoutingReceipt(featureDir);
    const accesslintReceipt = readJsonFile(path.join(featureDir, 'accessibility.json'));
    const browserAuditReceipt = readJsonFile(path.join(featureDir, 'ui-audit.json'));
    const verifyReceipt = loadVerifyReceipt(feature, featureDir);
    const previewTarget =
        normalizePreviewUrlCandidate(options.previewUrl) ||
        normalizePreviewUrlCandidate(readFeatureArtifactText(featureDir, 'preview-url.txt')) ||
        normalizePreviewUrlCandidate(readJsonFile(path.join(featureDir, 'preview-url.json'))?.url) ||
        browserAuditReceipt?.finalUrl ||
        browserAuditReceipt?.target ||
        null;

    const uiReviewEligible =
        detectUiFeatureForGate(featureDir, promptReceipt) ||
        Boolean(designReceipt) ||
        Boolean(accesslintReceipt) ||
        Boolean(browserAuditReceipt);

    if (!uiReviewEligible) {
        return {
            ok: false,
            skipped: true,
            reason: 'Feature does not currently look UI-intensive, so no frontend review was generated.',
        };
    }

    const accesslintResult = buildAccesslintResultFromReceipt(accesslintReceipt);
    const browserAuditResult = browserAuditReceipt
        ? summarizeBrowserAuditResult(browserAuditReceipt)
        : {
              status: 'SKIP',
              detail: 'No browser audit receipt was available for this UI review.',
          };
    const deepMode = options.deepMode ?? (!!verifyReceipt.deepRequested || !!browserAuditReceipt);
    const uiReview = buildUiReviewMarkdown(feature, {
        verifyStatus: options.verifyStatus || verifyReceipt.status || 'PENDING',
        promptReceipt,
        designReceipt,
        hasDesignSystem: fs.existsSync(path.join(featureDir, 'design-system.md')),
        accesslintReceipt,
        accesslintResult,
        browserAuditReceipt,
        browserAuditResult,
        previewTarget,
        deepMode,
        refreshSource: options.refreshSource,
        refreshReason: options.refreshReason,
        evidenceUpdatedAt: options.evidenceUpdatedAt,
        evidenceUpdatedFrom: options.evidenceUpdatedFrom,
        version: options.version,
    });

    const uiReviewArtifact = path.join(featureDir, 'ui-review.md');
    const uiReviewReceiptArtifact = path.join(featureDir, 'ui-review.json');
    fs.writeFileSync(uiReviewArtifact, uiReview.content);
    writeJsonFile(uiReviewReceiptArtifact, uiReview.receipt);

    return {
        ok: true,
        skipped: false,
        reportPath: uiReviewArtifact,
        receiptPath: uiReviewReceiptArtifact,
        status: uiReview.status,
        receipt: uiReview.receipt,
    };
}

module.exports = {
    buildAccesslintResultFromReceipt,
    buildUiReviewMarkdown,
    detectUiFeatureForGate,
    normalizePreviewUrlCandidate,
    refreshUiReviewArtifacts,
    summarizeBrowserAuditResult,
};
