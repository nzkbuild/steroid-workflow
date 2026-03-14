'use strict';

/**
 * Deep-merges two knowledge store objects.
 * - Arrays: deduplicates via Set union
 * - Objects: recursively merges
 * - Primitives: incoming overwrites existing
 *
 * @param {Record<string, any>} existing - The current knowledge store contents
 * @param {Record<string, any>} incoming - The new data to merge in
 * @returns {Record<string, any>} The merged result (new object, inputs not mutated)
 */
function mergeKnowledge(existing, incoming) {
    const result = { ...existing };
    for (const [key, value] of Object.entries(incoming)) {
        if (Array.isArray(value) && Array.isArray(result[key])) {
            result[key] = [...new Set([...result[key], ...value])];
        } else if (
            value &&
            typeof value === 'object' &&
            !Array.isArray(value) &&
            result[key] &&
            typeof result[key] === 'object' &&
            !Array.isArray(result[key])
        ) {
            result[key] = mergeKnowledge(result[key], value);
        } else {
            result[key] = value;
        }
    }
    return result;
}

module.exports = { mergeKnowledge };
