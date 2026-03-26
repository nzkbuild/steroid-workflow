'use strict';

const fs = require('fs');
const path = require('path');

const { routeDesignSystems } = require('./design-routing.cjs');
const { loadDesignRoutingReceipt } = require('./frontend-receipt-loaders.cjs');
const { normalizeWhitespace } = require('./prompt-intelligence.cjs');
const { generateDesignSystemMarkdown } = require('../services/design/design-system-generator.cjs');

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

function hasText(value) {
    return typeof value === 'string' && value.trim().length > 0;
}

function resolveFeaturePromptForDesign(featureDir, options = {}) {
    const rootDir = options.rootDir;
    const designReceipt = loadDesignRoutingReceipt(featureDir, rootDir ? { rootDir } : {});
    if (hasText(designReceipt?.prompt)) {
        return designReceipt.prompt.trim();
    }

    const promptReceipt = readJsonFile(path.join(featureDir, 'prompt.json'));
    const candidates = [
        promptReceipt?.normalizedSummary,
        promptReceipt?.pipelineHint,
        readFeatureArtifactText(featureDir, 'vibe.md'),
        readFeatureArtifactText(featureDir, 'spec.md'),
    ]
        .filter(hasText)
        .map((value) => normalizeWhitespace(value))
        .filter(Boolean);

    if (candidates.length === 0) return '';
    return candidates.join(' | ').slice(0, 1200).trim();
}

function generateDesignSystemArtifact(query, options = {}) {
    try {
        const content = generateDesignSystemMarkdown(query, options).trim();
        if (!content) {
            return {
                ok: false,
                error: 'Steroid design-system generator returned empty output.',
            };
        }
        return {
            ok: true,
            content,
        };
    } catch (error) {
        return {
            ok: false,
            error: `Failed to run Steroid design-system generator: ${error.message}`,
        };
    }
}

function bootstrapFeatureDesignArtifacts(feature, featureDir, options = {}) {
    const prompt = normalizeWhitespace(options.prompt || resolveFeaturePromptForDesign(featureDir, options));
    if (!prompt) {
        return {
            ok: false,
            skipped: false,
            reason: 'No prompt/spec/vibe context was available to derive UI design artifacts.',
        };
    }

    const routeReceiptPath = path.join(featureDir, 'design-routing.json');
    const existingRoute = readJsonFile(routeReceiptPath);
    const route =
        existingRoute ||
        routeDesignSystems({
            prompt,
            stack: options.stack,
            auditOnly: options.auditOnly,
            rootDir: options.rootDir,
        });

    if (route.domain === 'none') {
        return {
            ok: true,
            skipped: true,
            route,
            reason: 'Feature does not appear UI-intensive, so no design artifacts were generated.',
        };
    }

    if (!existingRoute || options.force) {
        writeJsonFile(routeReceiptPath, {
            ...route,
            source: options.source || 'bootstrap-design',
            prompt,
            updatedAt: new Date().toISOString(),
        });
    }

    const designSystemPath = path.join(featureDir, 'design-system.md');
    let designSystemWritten = false;
    if (!route.auditOnly && (!fs.existsSync(designSystemPath) || options.force)) {
        const generation = generateDesignSystemArtifact(prompt, {
            projectName: options.projectName || feature || 'Steroid Design System',
            stack: route.stack,
        });
        if (!generation.ok) {
            return {
                ok: false,
                skipped: false,
                route,
                reason: generation.error,
            };
        }
        fs.writeFileSync(designSystemPath, `${generation.content.trim()}\n`);
        designSystemWritten = true;
    }

    return {
        ok: true,
        skipped: false,
        route,
        designRouteWritten: !existingRoute || !!options.force,
        designSystemWritten,
        auditOnly: !!route.auditOnly,
    };
}

module.exports = {
    bootstrapFeatureDesignArtifacts,
    generateDesignSystemArtifact,
    readJsonFile,
    resolveFeaturePromptForDesign,
    writeJsonFile,
};
