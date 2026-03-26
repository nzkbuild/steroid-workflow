'use strict';

const fs = require('fs');
const path = require('path');

const { inspectSession } = require('./prompt-intelligence.cjs');
const { loadReviewReceipt, loadVerifyReceipt } = require('./receipt-loaders.cjs');

function readJsonFile(filePath) {
    if (!fs.existsSync(filePath)) return null;
    try {
        return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    } catch {
        return null;
    }
}

function inspectPromptSessionState(targetDir) {
    const changesDir = path.join(targetDir, '.memory', 'changes');
    const featureStates = [];

    if (fs.existsSync(changesDir)) {
        for (const entry of fs.readdirSync(changesDir, { withFileTypes: true })) {
            if (!entry.isDirectory()) continue;
            const featureDir = path.join(changesDir, entry.name);
            const artifactPriority = [
                'verify.json',
                'verify.md',
                'review.json',
                'review.md',
                'plan.md',
                'research.md',
                'spec.md',
                'vibe.md',
                'context.md',
                'diagnosis.md',
            ];

            let lastArtifact = null;
            for (const artifact of artifactPriority) {
                if (fs.existsSync(path.join(featureDir, artifact))) {
                    lastArtifact = artifact;
                    break;
                }
            }

            let updatedAt = null;
            try {
                updatedAt = fs.statSync(featureDir).mtime.toISOString();
            } catch {
                updatedAt = null;
            }

            const reviewReceipt = loadReviewReceipt(entry.name, featureDir);
            const verifyReceipt = loadVerifyReceipt(entry.name, featureDir);
            const incomplete =
                (!verifyReceipt || !['PASS', 'CONDITIONAL'].includes(verifyReceipt.status || '')) &&
                (!reviewReceipt || reviewReceipt.stage1 !== 'PASS' || reviewReceipt.stage2 !== 'PASS');

            featureStates.push({
                name: entry.name,
                updatedAt,
                incomplete,
                lastArtifact,
            });
        }
    }

    const runtimeState = readJsonFile(path.join(targetDir, '.memory', 'execution_state.json')) || {
        error_count: 0,
        status: 'active',
    };

    return inspectSession(featureStates, runtimeState);
}

module.exports = {
    inspectPromptSessionState,
};
