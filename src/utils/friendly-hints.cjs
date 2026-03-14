'use strict';

/**
 * Returns a friendly, plain-English hint message for common error scenarios.
 * Designed to help non-technical users understand what went wrong and what to do next.
 *
 * @param {string} key - The hint key. One of: 'gate-blocked', 'gate-incomplete',
 *   'circuit-tripped', 'git-failed', 'no-git', 'no-remote'
 * @returns {string} The friendly hint message, or empty string if key is unknown
 */
function friendlyHint(key) {
    const hints = {
        'gate-blocked':
            '\n  💡 This is normal — the AI needs to finish the previous step first.\n  Ask it to "continue with the steroid pipeline."',
        'gate-incomplete':
            '\n  💡 The previous step\'s output looks too short. Ask the AI to "redo the previous phase with more detail."',
        'circuit-tripped': '\n  💡 Too many errors. The AI is stuck. Try: "Use steroid recover to diagnose the issue."',
        'git-failed':
            '\n  💡 A save operation failed. This usually fixes itself. Ask the AI to "try the commit again."',
        'no-git': '\n  💡 No git repository found. Run: git init && git add -A && git commit -m "Initial commit"',
        'no-remote':
            '\n  💡 Your code is saved locally. To back it up to the cloud:\n  1. Go to github.com → New Repository\n  2. Copy the URL\n  3. Run: git remote add origin <your-url>\n  4. Run: git push -u origin main',
    };
    return hints[key] || '';
}

module.exports = { friendlyHint };
