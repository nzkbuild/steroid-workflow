'use strict';

function summarizeUiReviewStatus(findings) {
    if (findings.some((finding) => finding.severity === 'critical')) return 'FAIL';
    if (findings.some((finding) => finding.severity === 'medium')) return 'CONDITIONAL';
    return 'PASS';
}

function buildUiArchivePolicy(uiReviewReceipt, options = {}) {
    if (!uiReviewReceipt?.status) {
        return {
            decision: 'PASS',
            recommendation: 'READY',
            summary: 'No UI review receipt is present, so no frontend archive policy applies.',
            blockReasons: [],
            warnReasons: [],
            overrideFlag: null,
        };
    }

    const findings = Array.isArray(uiReviewReceipt.findings) ? uiReviewReceipt.findings : [];
    const findingTitles = new Set(findings.map((finding) => finding.title));
    const blockReasons = [];
    const warnReasons = [];

    if (uiReviewReceipt.status === 'FAIL') {
        return {
            decision: 'BLOCK',
            recommendation: 'HOLD',
            summary: 'Frontend review is FAIL, so archive should stay blocked.',
            blockReasons: ['ui-review.json status is FAIL.'],
            warnReasons: [],
            overrideFlag: null,
        };
    }

    if (uiReviewReceipt.status !== 'CONDITIONAL') {
        return {
            decision: 'PASS',
            recommendation: 'READY',
            summary: 'Frontend review is PASS.',
            blockReasons,
            warnReasons,
            overrideFlag: null,
        };
    }

    if (findingTitles.has('Accessibility violations detected')) {
        blockReasons.push('Accessibility review still reports moderate/minor violations.');
    }
    if (options.deepRequested && findingTitles.has('Browser runtime evidence missing')) {
        blockReasons.push('Deep verification was requested, but browser runtime evidence is still missing.');
    }

    if (findingTitles.has('Browser audit found polish issues')) {
        warnReasons.push('Browser audit found polish issues that should be cleaned up before release.');
    }
    if (findingTitles.has('Accessibility evidence missing')) {
        warnReasons.push('Accessibility evidence is missing, so the frontend verdict is less trustworthy.');
    }
    if (findings.length === 0) {
        warnReasons.push('Frontend review is CONDITIONAL, but no structured findings were captured.');
    }

    if (blockReasons.length > 0) {
        return {
            decision: 'BLOCK_CONDITIONAL',
            recommendation: 'HOLD',
            summary: 'Frontend review is CONDITIONAL with issues serious enough to block archive unless explicitly overridden.',
            blockReasons,
            warnReasons,
            overrideFlag: '--force-ui',
        };
    }

    return {
        decision: 'WARN_CONDITIONAL',
        recommendation: 'CAUTION',
        summary: 'Frontend review is CONDITIONAL, but archive can proceed with an explicit warning.',
        blockReasons,
        warnReasons,
        overrideFlag: null,
    };
}

module.exports = {
    buildUiArchivePolicy,
    summarizeUiReviewStatus,
};
