'use strict';

const { resolveForkSourcePath, resolveRepoRoot } = require('./fork-sources.cjs');
const { GOVERNED_COMPLETION_OPTIONS } = require('./governed-artifacts.cjs');

/**
 * Normalizes a status-like string against an allowlist.
 *
 * @param {any} value
 * @param {string[]} allowed
 * @param {string|null} fallback
 * @returns {string|null}
 */
function normalizeAllowedStatus(value, allowed, fallback) {
    if (typeof value !== 'string') return fallback;
    const normalized = value.trim().toUpperCase();
    return allowed.includes(normalized) ? normalized : fallback;
}

/**
 * Normalizes a design routing receipt into the governed runtime shape.
 *
 * @param {Record<string, any>|null|undefined} receipt
 * @param {{ rootDir?: string }} [options]
 * @returns {Record<string, any>|null}
 */
function normalizeDesignRoutingReceipt(receipt, options = {}) {
    if (!receipt || typeof receipt !== 'object') return null;

    const stack = typeof receipt.stack === 'string' ? receipt.stack : 'web';
    const wrapperSkill = typeof receipt.wrapperSkill === 'string' ? receipt.wrapperSkill : null;
    const sourceInputIds = Array.isArray(receipt.sourceInputIds)
        ? receipt.sourceInputIds.filter((value) => typeof value === 'string')
        : Array.isArray(receipt.importedSourceIds)
        ? receipt.importedSourceIds.filter((value) => typeof value === 'string')
        : [];
    const sourceInputPaths = Array.isArray(receipt.sourceInputPaths)
        ? receipt.sourceInputPaths.filter((value) => typeof value === 'string')
        : Array.isArray(receipt.importedSourcePaths)
          ? receipt.importedSourcePaths.filter((value) => typeof value === 'string')
          : [];
    const domain = typeof receipt.domain === 'string' ? receipt.domain : stack;
    const rootDir = options.rootDir || resolveRepoRoot();

    if (!['none', 'web', 'react', 'react-native'].includes(domain)) return null;
    if (!['web', 'react', 'react-native'].includes(stack)) return null;

    return {
        domain,
        stack,
        auditOnly: !!receipt.auditOnly,
        wrapperSkill,
        sourceInputIds,
        sourceInputPaths:
            sourceInputPaths.length > 0
                ? sourceInputPaths
                : sourceInputIds.map((id) => resolveForkSourcePath(id, rootDir)).filter(Boolean),
        importedSourceIds: sourceInputIds,
        importedSourcePaths:
            sourceInputPaths.length > 0
                ? sourceInputPaths
                : sourceInputIds.map((id) => resolveForkSourcePath(id, rootDir)).filter(Boolean),
        prompt: typeof receipt.prompt === 'string' ? receipt.prompt : '',
        promptSource:
            typeof receipt.promptSource === 'string'
                ? receipt.promptSource
                : typeof receipt.source === 'string'
                  ? receipt.source
                  : null,
        generatedAt:
            typeof receipt.generatedAt === 'string'
                ? receipt.generatedAt
                : typeof receipt.updatedAt === 'string'
                  ? receipt.updatedAt
                  : null,
        source:
            typeof receipt.source === 'string'
                ? receipt.source
                : typeof receipt.promptSource === 'string'
                  ? receipt.promptSource
                  : null,
        updatedAt:
            typeof receipt.updatedAt === 'string'
                ? receipt.updatedAt
                : typeof receipt.generatedAt === 'string'
                  ? receipt.generatedAt
                  : null,
    };
}

/**
 * Normalizes a UI review receipt into the governed runtime shape.
 *
 * @param {Record<string, any>|null|undefined} receipt
 * @param {string} feature
 * @returns {Record<string, any>|null}
 */
function normalizeUiReviewReceipt(receipt, feature) {
    if (!receipt || receipt.feature !== feature) return null;

    const status = normalizeAllowedStatus(receipt.status, ['PASS', 'FAIL', 'CONDITIONAL'], null);
    if (!status) return null;
    const sourceInputIds = Array.isArray(receipt.sourceInputIds)
        ? receipt.sourceInputIds.filter((value) => typeof value === 'string')
        : Array.isArray(receipt.importedSourceIds)
          ? receipt.importedSourceIds.filter((value) => typeof value === 'string')
          : [];
    const sourceInputPaths = Array.isArray(receipt.sourceInputPaths)
        ? receipt.sourceInputPaths.filter((value) => typeof value === 'string')
        : Array.isArray(receipt.importedSourcePaths)
          ? receipt.importedSourcePaths.filter((value) => typeof value === 'string')
          : [];

    const findings = Array.isArray(receipt.findings)
        ? receipt.findings
              .filter((finding) => finding && typeof finding === 'object')
              .map((finding) => ({
                  severity: typeof finding.severity === 'string' ? finding.severity : 'medium',
                  title: typeof finding.title === 'string' ? finding.title : 'Untitled finding',
                  detail: typeof finding.detail === 'string' ? finding.detail : '',
              }))
        : [];

    return {
        feature,
        status,
        verifyStatus: typeof receipt.verifyStatus === 'string' ? receipt.verifyStatus : 'Unknown',
        generatedAt: typeof receipt.generatedAt === 'string' ? receipt.generatedAt : null,
        stack: typeof receipt.stack === 'string' ? receipt.stack : 'unknown',
        auditOnly: !!receipt.auditOnly,
        wrapperSkill: typeof receipt.wrapperSkill === 'string' ? receipt.wrapperSkill : null,
        sourceInputIds,
        sourceInputPaths,
        importedSourceIds: sourceInputIds,
        importedSourcePaths: sourceInputPaths,
        promptSummary: typeof receipt.promptSummary === 'string' ? receipt.promptSummary : '',
        previewTarget: typeof receipt.previewTarget === 'string' ? receipt.previewTarget : null,
        evidence: receipt.evidence && typeof receipt.evidence === 'object' ? receipt.evidence : {},
        freshness:
            receipt.freshness && typeof receipt.freshness === 'object'
                ? {
                      source: typeof receipt.freshness.source === 'string' ? receipt.freshness.source : 'unknown',
                      reason:
                          typeof receipt.freshness.reason === 'string'
                              ? receipt.freshness.reason
                              : 'Unknown refresh reason.',
                      evidenceUpdatedAt:
                          typeof receipt.freshness.evidenceUpdatedAt === 'string'
                              ? receipt.freshness.evidenceUpdatedAt
                              : null,
                      evidenceUpdatedFrom:
                          typeof receipt.freshness.evidenceUpdatedFrom === 'string'
                              ? receipt.freshness.evidenceUpdatedFrom
                              : null,
                  }
                : {
                      source: 'unknown',
                      reason: 'Unknown refresh reason.',
                      evidenceUpdatedAt: null,
                      evidenceUpdatedFrom: null,
                  },
        findings,
    };
}

function normalizeVerifyReceipt(receipt, feature) {
    if (!receipt || receipt.feature !== feature) return null;
    return {
        feature,
        status: normalizeAllowedStatus(receipt.status, ['PASS', 'FAIL', 'CONDITIONAL'], null),
        reviewPassed: !!receipt.reviewPassed,
        checks: receipt.checks && typeof receipt.checks === 'object' && !Array.isArray(receipt.checks) ? receipt.checks : {},
        deepRequested: !!receipt.deepRequested,
        deepCompleted: !!receipt.deepCompleted,
        updatedAt: typeof receipt.updatedAt === 'string' ? receipt.updatedAt : null,
        source: typeof receipt.source === 'string' ? receipt.source : 'verify.json',
    };
}

function normalizeCompletionReceipt(receipt, feature) {
    if (!receipt || receipt.feature !== feature) return null;
    return {
        feature,
        status: normalizeAllowedStatus(receipt.status, ['PASS', 'CONDITIONAL'], null),
        sourceArtifacts: Array.isArray(receipt.sourceArtifacts)
            ? receipt.sourceArtifacts.filter((value) => typeof value === 'string')
            : Array.isArray(receipt.source_artifacts)
              ? receipt.source_artifacts.filter((value) => typeof value === 'string')
              : [],
        nextActions: Array.isArray(receipt.nextActions)
            ? receipt.nextActions.filter((value) => typeof value === 'string')
            : [],
        options: Array.isArray(receipt.options)
            ? receipt.options.filter((value) => typeof value === 'string')
            : [...GOVERNED_COMPLETION_OPTIONS],
        updatedAt: typeof receipt.updatedAt === 'string' ? receipt.updatedAt : null,
        source: typeof receipt.source === 'string' ? receipt.source : 'completion.json',
        summary: typeof receipt.summary === 'string' ? receipt.summary : null,
    };
}

function normalizeExecutionReceipt(receipt, feature) {
    if (!receipt || receipt.feature !== feature) return null;
    return {
        feature,
        status: normalizeAllowedStatus(receipt.status, ['COMPLETE', 'BLOCKED'], null),
        consumedArtifacts: Array.isArray(receipt.consumed_artifacts)
            ? receipt.consumed_artifacts.filter((value) => typeof value === 'string')
            : Array.isArray(receipt.consumedArtifacts)
              ? receipt.consumedArtifacts.filter((value) => typeof value === 'string')
              : [],
        updatedAt: typeof receipt.updatedAt === 'string' ? receipt.updatedAt : null,
        source: typeof receipt.source === 'string' ? receipt.source : 'execution.json',
        summary: typeof receipt.summary === 'string' ? receipt.summary : null,
    };
}

module.exports = {
    normalizeAllowedStatus,
    normalizeCompletionReceipt,
    normalizeDesignRoutingReceipt,
    normalizeExecutionReceipt,
    normalizeUiReviewReceipt,
    normalizeVerifyReceipt,
};
