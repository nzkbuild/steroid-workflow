'use strict';

const fs = require('fs');
const path = require('path');

const { GOVERNED_COMPLETION_OPTIONS } = require('./governed-artifacts.cjs');
const {
    normalizeAllowedStatus,
    normalizeCompletionReceipt,
    normalizeExecutionReceipt,
    normalizeVerifyReceipt,
} = require('./governed-receipts.cjs');
const { parseReviewMarkdown } = require('./trust-helpers.cjs');

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

function parseVerifyMarkdownStatus(content) {
    const match = String(content || '').match(/\*\*Status:\*\*\s*(PASS|FAIL|CONDITIONAL)/);
    return match ? match[1] : null;
}

function loadReviewReceipt(feature, featureDir) {
    const reviewJsonPath = path.join(featureDir, 'review.json');
    const reviewMdPath = path.join(featureDir, 'review.md');
    const existing = readJsonFile(reviewJsonPath);
    const reviewMdExists = fs.existsSync(reviewMdPath);

    if (reviewMdExists) {
        const parsed = parseReviewMarkdown(fs.readFileSync(reviewMdPath, 'utf-8'));
        const receipt = {
            feature,
            stage1: parsed.stage1,
            stage2: parsed.stage2,
            source: 'review.md-synced',
            updatedAt: new Date().toISOString(),
        };
        if (
            !existing ||
            existing.feature !== feature ||
            existing.stage1 !== receipt.stage1 ||
            existing.stage2 !== receipt.stage2
        ) {
            writeJsonFile(reviewJsonPath, receipt);
        }
        return receipt;
    }

    if (existing && existing.feature === feature) {
        const receipt = {
            feature,
            stage1: normalizeAllowedStatus(existing.stage1, ['PASS', 'FAIL', 'PENDING'], 'PENDING'),
            stage2: normalizeAllowedStatus(existing.stage2, ['PASS', 'FAIL', 'PENDING'], 'PENDING'),
            source: existing.source || 'review.json',
            updatedAt: existing.updatedAt || null,
        };
        if (
            existing.stage1 !== receipt.stage1 ||
            existing.stage2 !== receipt.stage2 ||
            existing.source !== receipt.source ||
            existing.updatedAt !== receipt.updatedAt
        ) {
            writeJsonFile(reviewJsonPath, receipt);
        }
        return receipt;
    }

    return {
        feature,
        stage1: 'PENDING',
        stage2: 'PENDING',
        source: 'none',
        updatedAt: null,
    };
}

function saveReviewReceipt(featureDir, receipt) {
    writeJsonFile(path.join(featureDir, 'review.json'), {
        feature: receipt.feature,
        stage1: receipt.stage1,
        stage2: receipt.stage2,
        source: receipt.source || 'review.json',
        updatedAt: receipt.updatedAt || new Date().toISOString(),
    });
}

function loadVerifyReceipt(feature, featureDir) {
    const verifyJsonPath = path.join(featureDir, 'verify.json');
    const verifyMdPath = path.join(featureDir, 'verify.md');
    const existing = readJsonFile(verifyJsonPath);

    if (existing && existing.feature === feature) {
        const receipt = normalizeVerifyReceipt(existing, feature);
        if (!receipt) {
            return {
                feature,
                status: null,
                reviewPassed: false,
                checks: {},
                deepRequested: false,
                deepCompleted: false,
                updatedAt: null,
                source: 'none',
            };
        }
        if (
            existing.status !== receipt.status ||
            existing.confidence !== receipt.confidence ||
            existing.reviewPassed !== receipt.reviewPassed ||
            existing.checks !== receipt.checks ||
            existing.source !== receipt.source ||
            existing.updatedAt !== receipt.updatedAt ||
            existing.deepRequested !== receipt.deepRequested ||
            existing.deepCompleted !== receipt.deepCompleted
        ) {
            writeJsonFile(verifyJsonPath, receipt);
        }
        return receipt;
    }

    if (fs.existsSync(verifyMdPath)) {
        const status = parseVerifyMarkdownStatus(fs.readFileSync(verifyMdPath, 'utf-8'));
        if (status) {
            const receipt = {
                feature,
                status,
                confidence: null,
                reviewPassed: false,
                checks: {},
                deepRequested: false,
                deepCompleted: false,
                updatedAt: new Date().toISOString(),
                source: 'verify.md',
            };
            writeJsonFile(verifyJsonPath, receipt);
            return receipt;
        }
    }

    return {
        feature,
        status: null,
        confidence: null,
        reviewPassed: false,
        checks: {},
        deepRequested: false,
        deepCompleted: false,
        updatedAt: null,
        source: 'none',
    };
}

function saveVerifyReceipt(featureDir, receipt) {
    writeJsonFile(path.join(featureDir, 'verify.json'), {
        feature: receipt.feature,
        status: receipt.status,
        confidence: typeof receipt.confidence === 'string' ? receipt.confidence : null,
        reviewPassed: !!receipt.reviewPassed,
        checks: receipt.checks || {},
        deepRequested: !!receipt.deepRequested,
        deepCompleted: !!receipt.deepCompleted,
        updatedAt: receipt.updatedAt || new Date().toISOString(),
        source: receipt.source || 'verify.json',
    });
}

function loadRequestReceipt(feature, featureDir) {
    const requestJsonPath = path.join(featureDir, 'request.json');
    const existing = readJsonFile(requestJsonPath);

    if (existing && existing.feature === feature) {
        const receipt = {
            feature,
            requestedAt: typeof existing.requestedAt === 'string' ? existing.requestedAt : null,
            source: typeof existing.source === 'string' ? existing.source : 'request.json',
            summary: typeof existing.summary === 'string' ? existing.summary : null,
        };
        if (
            receipt.requestedAt &&
            (existing.requestedAt !== receipt.requestedAt ||
                existing.source !== receipt.source ||
                existing.summary !== receipt.summary)
        ) {
            writeJsonFile(requestJsonPath, receipt);
        }
        return receipt;
    }

    return {
        feature,
        requestedAt: null,
        source: 'none',
        summary: null,
    };
}

function saveRequestReceipt(featureDir, receipt) {
    writeJsonFile(path.join(featureDir, 'request.json'), {
        feature: receipt.feature,
        requestedAt: receipt.requestedAt || new Date().toISOString(),
        source: receipt.source || 'scan',
        summary: receipt.summary || 'Feature initialized for governed scan context capture.',
    });
}

function loadCompletionReceipt(feature, featureDir) {
    const completionJsonPath = path.join(featureDir, 'completion.json');
    const existing = readJsonFile(completionJsonPath);

    if (existing && existing.feature === feature) {
        const receipt = normalizeCompletionReceipt(existing, feature);
        if (!receipt) {
            return {
                feature,
                status: null,
                sourceArtifacts: [],
                nextActions: [],
                options: [],
                updatedAt: null,
                source: 'none',
                summary: null,
            };
        }

        if (
            receipt.status &&
            (existing.status !== receipt.status ||
                existing.source !== receipt.source ||
                existing.updatedAt !== receipt.updatedAt ||
                existing.summary !== receipt.summary ||
                JSON.stringify(existing.sourceArtifacts || existing.source_artifacts || []) !==
                    JSON.stringify(receipt.sourceArtifacts) ||
                JSON.stringify(existing.nextActions || []) !== JSON.stringify(receipt.nextActions) ||
                JSON.stringify(existing.options || []) !== JSON.stringify(receipt.options))
        ) {
            writeJsonFile(completionJsonPath, {
                ...receipt,
                source_artifacts: receipt.sourceArtifacts,
            });
        }

        return receipt;
    }

    return {
        feature,
        status: null,
        sourceArtifacts: [],
        nextActions: [],
        options: [],
        updatedAt: null,
        source: 'none',
        summary: null,
    };
}

function saveCompletionReceipt(featureDir, receipt) {
    const sourceArtifacts = Array.isArray(receipt.sourceArtifacts) ? receipt.sourceArtifacts : [];
    writeJsonFile(path.join(featureDir, 'completion.json'), {
        feature: receipt.feature,
        status: receipt.status,
        sourceArtifacts,
        source_artifacts: sourceArtifacts,
        nextActions: Array.isArray(receipt.nextActions) ? receipt.nextActions : [],
        options: Array.isArray(receipt.options) ? receipt.options : [...GOVERNED_COMPLETION_OPTIONS],
        updatedAt: receipt.updatedAt || new Date().toISOString(),
        source: receipt.source || 'completion.json',
        summary: receipt.summary || 'Verification completed. Feature is ready for completion handling.',
    });
}

function loadExecutionReceipt(feature, featureDir) {
    const executionJsonPath = path.join(featureDir, 'execution.json');
    const existing = readJsonFile(executionJsonPath);

    if (existing && existing.feature === feature) {
        const receipt = normalizeExecutionReceipt(existing, feature);
        if (!receipt) {
            return {
                feature,
                status: null,
                consumedArtifacts: [],
                updatedAt: null,
                source: 'none',
                summary: null,
            };
        }
        if (
            receipt.status &&
            (existing.status !== receipt.status ||
                existing.source !== receipt.source ||
                existing.updatedAt !== receipt.updatedAt ||
                existing.summary !== receipt.summary ||
                JSON.stringify(existing.consumed_artifacts || existing.consumedArtifacts || []) !==
                    JSON.stringify(receipt.consumedArtifacts))
        ) {
            writeJsonFile(executionJsonPath, {
                feature: receipt.feature,
                status: receipt.status,
                consumed_artifacts: receipt.consumedArtifacts,
                updatedAt: receipt.updatedAt,
                source: receipt.source,
                summary: receipt.summary,
            });
        }
        return receipt;
    }

    return {
        feature,
        status: null,
        consumedArtifacts: [],
        updatedAt: null,
        source: 'none',
        summary: null,
    };
}

function saveExecutionReceipt(featureDir, receipt) {
    writeJsonFile(path.join(featureDir, 'execution.json'), {
        feature: receipt.feature,
        status: receipt.status,
        consumed_artifacts: Array.isArray(receipt.consumedArtifacts) ? receipt.consumedArtifacts : [],
        updatedAt: receipt.updatedAt || new Date().toISOString(),
        source: receipt.source || 'execution.json',
        summary: receipt.summary || 'Execution completed from governed plan and task artifacts.',
    });
}

module.exports = {
    loadCompletionReceipt,
    loadExecutionReceipt,
    loadRequestReceipt,
    loadReviewReceipt,
    loadVerifyReceipt,
    parseVerifyMarkdownStatus,
    saveCompletionReceipt,
    saveExecutionReceipt,
    saveRequestReceipt,
    saveReviewReceipt,
    saveVerifyReceipt,
};
