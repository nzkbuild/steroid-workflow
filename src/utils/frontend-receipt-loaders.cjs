'use strict';

const fs = require('fs');
const path = require('path');

const { normalizeDesignRoutingReceipt, normalizeUiReviewReceipt } = require('./governed-receipts.cjs');

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

/**
 * Loads the active design routing receipt and rewrites it into governed shape when possible.
 *
 * @param {string} featureDir
 * @param {{ rootDir?: string }} [options]
 * @returns {Record<string, any>|null}
 */
function loadDesignRoutingReceipt(featureDir, options = {}) {
    const routeReceiptPath = path.join(featureDir, 'design-routing.json');
    const existing = readJsonFile(routeReceiptPath);
    const normalized = normalizeDesignRoutingReceipt(existing, options);
    if (!normalized) return null;
    if (JSON.stringify(existing) !== JSON.stringify(normalized)) {
        writeJsonFile(routeReceiptPath, normalized);
    }
    return normalized;
}

/**
 * Loads the active UI review receipt and rewrites it into governed shape when possible.
 *
 * @param {string} feature
 * @param {string} featureDir
 * @returns {Record<string, any>|null}
 */
function loadUiReviewReceipt(feature, featureDir) {
    const uiReviewReceiptPath = path.join(featureDir, 'ui-review.json');
    const existing = readJsonFile(uiReviewReceiptPath);
    const normalized = normalizeUiReviewReceipt(existing, feature);
    if (!normalized) return null;
    if (JSON.stringify(existing) !== JSON.stringify(normalized)) {
        writeJsonFile(uiReviewReceiptPath, normalized);
    }
    return normalized;
}

module.exports = {
    loadDesignRoutingReceipt,
    loadUiReviewReceipt,
};
