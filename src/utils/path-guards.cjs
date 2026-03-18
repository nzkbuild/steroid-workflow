'use strict';

const fs = require('fs');
const path = require('path');

/**
 * Returns true when a resolved path stays within the provided root directory.
 *
 * @param {string} rootDir
 * @param {string} resolvedPath
 * @returns {boolean}
 */
function isWithinRoot(rootDir, resolvedPath) {
    const rel = path.relative(rootDir, resolvedPath);
    return rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel));
}

/**
 * Resolves a user-supplied path relative to the provided root and blocks paths
 * that escape that root, including through existing symlinked ancestors.
 *
 * @param {string} rootDir
 * @param {string} candidatePath
 * @param {{ mustExist?: boolean }} [options]
 * @returns {string|null}
 */
function resolvePathWithinRoot(rootDir, candidatePath, options = {}) {
    const resolved = path.resolve(rootDir, candidatePath);
    if (!isWithinRoot(rootDir, resolved)) return null;

    let probePath = resolved;
    while (!fs.existsSync(probePath)) {
        const parentPath = path.dirname(probePath);
        if (parentPath === probePath) break;
        probePath = parentPath;
    }

    try {
        const realProbePath = fs.realpathSync(probePath);
        if (!isWithinRoot(rootDir, realProbePath)) return null;
    } catch {
        return null;
    }

    if (options.mustExist && !fs.existsSync(resolved)) return null;
    return resolved;
}

module.exports = {
    isWithinRoot,
    resolvePathWithinRoot,
};
