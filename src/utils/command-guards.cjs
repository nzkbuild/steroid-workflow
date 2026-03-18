'use strict';

const { stripWrappingQuotes } = require('./trust-helpers.cjs');

const DISALLOWED_DIRECT_COMMANDS = new Map([
    ['rm', 'Use node steroid-run.cjs fs-rm <path> instead.'],
    ['rmdir', 'Use node steroid-run.cjs fs-rm <path> instead.'],
    ['del', 'Use node steroid-run.cjs fs-rm <path> instead.'],
    ['rd', 'Use node steroid-run.cjs fs-rm <path> instead.'],
    ['cp', 'Use node steroid-run.cjs fs-cp <src> <dest> instead.'],
    ['copy', 'Use node steroid-run.cjs fs-cp <src> <dest> instead.'],
    ['xcopy', 'Use node steroid-run.cjs fs-cp <src> <dest> instead.'],
    ['mv', 'Use node steroid-run.cjs fs-mv <src> <dest> instead.'],
    ['move', 'Use node steroid-run.cjs fs-mv <src> <dest> instead.'],
    ['mkdir', 'Use node steroid-run.cjs fs-mkdir <path> instead.'],
    ['cat', 'Use node steroid-run.cjs fs-cat <file> instead.'],
    ['type', 'Use node steroid-run.cjs fs-cat <file> instead.'],
    ['ls', 'Use node steroid-run.cjs fs-ls [path] instead.'],
    ['dir', 'Use node steroid-run.cjs fs-ls [path] instead.'],
    ['grep', 'Use node steroid-run.cjs fs-grep <pattern> [path] instead.'],
    ['findstr', 'Use node steroid-run.cjs fs-grep <pattern> [path] instead.'],
]);

/**
 * Tokenizes a shell-like command string while preserving quoted substrings.
 *
 * @param {string} input
 * @returns {string[]}
 */
function tokenizeCommand(input) {
    const source = stripWrappingQuotes((input || '').trim());
    const tokens = [];
    let current = '';
    let quote = null;
    let escape = false;

    for (const char of source) {
        if (escape) {
            current += char;
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
            } else {
                current += char;
            }
            continue;
        }

        if (char === '"' || char === "'") {
            quote = char;
            continue;
        }

        if (/\s/.test(char)) {
            if (current) {
                tokens.push(current);
                current = '';
            }
            continue;
        }

        current += char;
    }

    if (quote) {
        throw new Error(`Unterminated ${quote === '"' ? 'double' : 'single'} quote in command.`);
    }

    if (current) tokens.push(current);
    return tokens;
}

/**
 * Validates tokenized execution commands before process spawning.
 *
 * @param {string[]} commandTokens
 * @param {{ resolvePath?: (candidate: string, options?: { mustExist?: boolean }) => string|null }} [options]
 * @returns {{ ok: boolean, message?: string }}
 */
function validateExecutionCommandTokens(commandTokens, options = {}) {
    const baseCommand = (commandTokens[0] || '').replace(/^['"]|['"]$/g, '').toLowerCase();
    const directCommandHint = DISALLOWED_DIRECT_COMMANDS.get(baseCommand);
    if (directCommandHint) {
        return {
            ok: false,
            message: `[STEROID-COMMAND-GUARD] 🛑 BLOCKED: Direct ${baseCommand} usage is not allowed through run.\n  ${directCommandHint}`,
        };
    }

    if (baseCommand === 'node') {
        const hasInlineEval = commandTokens.some((token) => ['-e', '--eval', '-p', '--print', '-'].includes(token));
        if (hasInlineEval) {
            return {
                ok: false,
                message:
                    '[STEROID-COMMAND-GUARD] 🛑 BLOCKED: node inline evaluation is not allowed through run.\n  Run a script file inside the project instead.',
            };
        }
    }

    if (baseCommand === 'python' || baseCommand === 'python3') {
        const hasInlineEval = commandTokens.some((token) => ['-c', '-m', '-'].includes(token));
        if (hasInlineEval) {
            return {
                ok: false,
                message:
                    '[STEROID-COMMAND-GUARD] 🛑 BLOCKED: python inline/module execution is not allowed through run.\n  Run a concrete project script file instead.',
            };
        }
    }

    if (baseCommand === 'git') {
        const resolvePath = typeof options.resolvePath === 'function' ? options.resolvePath : null;
        for (let i = 1; i < commandTokens.length; i++) {
            const token = commandTokens[i];
            if (token === '-C' || token === '--git-dir' || token === '--work-tree') {
                const candidate = commandTokens[i + 1];
                const resolved = candidate && resolvePath ? resolvePath(candidate, { mustExist: true }) : null;
                if (!resolved) {
                    return {
                        ok: false,
                        message:
                            '[STEROID-COMMAND-GUARD] 🛑 BLOCKED: git path overrides must stay inside the current project root.',
                    };
                }
            }
        }
    }

    return { ok: true };
}

module.exports = {
    DISALLOWED_DIRECT_COMMANDS,
    tokenizeCommand,
    validateExecutionCommandTokens,
};
