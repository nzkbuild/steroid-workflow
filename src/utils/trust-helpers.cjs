'use strict';

const path = require('path');

/**
 * Removes a single matching pair of wrapping quotes from a string.
 *
 * @param {string} value
 * @returns {string}
 */
function stripWrappingQuotes(value) {
    if (!value || value.length < 2) return value;
    const first = value[0];
    const last = value[value.length - 1];
    if ((first === '"' || first === "'") && first === last) {
        return value.slice(1, -1);
    }
    return value;
}

/**
 * Detects blocked shell syntax that would allow command chaining, piping, or redirection.
 * Quote-wrapped text is ignored so safe arguments like `grep "a|b"` are not blocked.
 *
 * @param {string} input
 * @returns {string|null}
 */
function findBlockedShellSyntax(input) {
    const source = stripWrappingQuotes((input || '').trim());
    let quote = null;
    let escape = false;

    for (let i = 0; i < source.length; i++) {
        const char = source[i];
        const next = source[i + 1] || '';

        if (escape) {
            escape = false;
            continue;
        }

        if (char === '\\' && quote === '"') {
            escape = true;
            continue;
        }

        if (quote) {
            if (char === quote) {
                quote = null;
            }
            continue;
        }

        if (char === '"' || char === "'") {
            quote = char;
            continue;
        }

        if (char === '\r' || char === '\n') return 'newline';
        if (char === '&' && next === '&') return '&&';
        if (char === '|' && next === '|') return '||';
        if (char === '$' && next === '(') return '$(';
        if (char === '>' && next === '>') return '>>';
        if (char === '<' && next === '<') return '<<';
        if (char === ';') return ';';
        if (char === '&') return '&';
        if (char === '`') return '`';
        if (char === '|') return '|';
        if (char === '>') return '>';
        if (char === '<') return '<';
    }

    return null;
}

/**
 * Parses stage statuses from review.md when present.
 *
 * @param {string} content
 * @returns {{ stage1: string, stage2: string }}
 */
function parseReviewMarkdown(content) {
    const stage1Patterns = [
        /\*{0,2}Stage 1 \(Spec\)\*{0,2}:\s*(PASS|FAIL|PENDING)/,
        /\*{0,2}Stage 1 Result:\*{0,2}\s*(PASS|FAIL|PENDING)/,
    ];
    const stage2Patterns = [
        /\*{0,2}Stage 2 \(Quality\)\*{0,2}:\s*(PASS|FAIL|PENDING)/,
        /\*{0,2}Stage 2 Result:\*{0,2}\s*(PASS|FAIL|PENDING)/,
    ];

    let stage1 = 'PENDING';
    let stage2 = 'PENDING';

    for (const pattern of stage1Patterns) {
        const match = content.match(pattern);
        if (match) {
            stage1 = match[1];
            break;
        }
    }

    for (const pattern of stage2Patterns) {
        const match = content.match(pattern);
        if (match) {
            stage2 = match[1];
            break;
        }
    }

    return { stage1, stage2 };
}

/**
 * Creates a filesystem-safe archive timestamp.
 *
 * @param {Date} [date]
 * @returns {string}
 */
function createArchiveStamp(date = new Date()) {
    return date.toISOString().replace(/[:.]/g, '-');
}

/**
 * Returns a collision-safe archive destination path.
 *
 * @param {string} archiveDir
 * @param {string} archiveStamp
 * @param {string} fileName
 * @param {(path: string) => boolean} [existsFn]
 * @returns {string}
 */
function getArchiveDestinationPath(archiveDir, archiveStamp, fileName, existsFn = () => false) {
    let candidate = path.join(archiveDir, `${archiveStamp}-${fileName}`);
    if (!existsFn(candidate)) {
        return candidate;
    }

    let suffix = 2;
    do {
        candidate = path.join(archiveDir, `${archiveStamp}-${suffix}-${fileName}`);
        suffix += 1;
    } while (existsFn(candidate));

    return candidate;
}

module.exports = {
    createArchiveStamp,
    findBlockedShellSyntax,
    getArchiveDestinationPath,
    parseReviewMarkdown,
    stripWrappingQuotes,
};
