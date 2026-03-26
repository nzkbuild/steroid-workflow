'use strict';

function buildReactImplementationRules(options = {}) {
    const reactVersion = String(options.reactVersion || '').trim();
    const isReact19 = /^19(\.|$)/.test(reactVersion);

    const pillars = [
        {
            name: 'Async and data flow',
            priority: 'critical',
            rules: [
                'Start independent async work in parallel and await it as late as possible.',
                'Keep server and client boundaries intentional; do not serialize large data into client components without need.',
                'Restructure fetches to avoid waterfalls before reaching for local caching tricks.',
            ],
        },
        {
            name: 'Bundle and delivery discipline',
            priority: 'critical',
            rules: [
                'Avoid barrel imports for hot paths; import directly from the module you need.',
                'Use dynamic imports for heavy or optional UI surfaces instead of front-loading them.',
                'Defer non-critical third-party code until after the primary route is interactive.',
            ],
        },
        {
            name: 'State and rendering discipline',
            priority: 'high',
            rules: [
                'Use startTransition for non-urgent UI updates rather than blocking urgent interaction work.',
                'Do not define components inside components when they can live at module scope.',
                'Prefer derived state in render over effect-driven synchronization when possible.',
            ],
        },
        {
            name: 'Component architecture',
            priority: 'high',
            rules: [
                'Avoid boolean-prop proliferation for component variants; use explicit subcomponents or composition instead.',
                'Complex shared state should live behind a provider or compound component interface, not be scattered across siblings.',
                'Favor explicit variant components over mode flags when component behavior diverges meaningfully.',
            ],
        },
    ];

    const antiPatterns = [
        'Large barrel imports in performance-sensitive surfaces.',
        'Boolean props that multiply component modes and hidden conditionals.',
        'Inline component declarations for reusable or stateful child trees.',
        'Client components receiving oversized server-fetched payloads only to re-slice them locally.',
    ];

    if (isReact19) {
        antiPatterns.push('Carrying forward legacy forwardRef-heavy APIs where React 19-native composition is cleaner.');
    } else {
        antiPatterns.push('Introducing React 19-only APIs into a stack that has not explicitly upgraded.');
    }

    return {
        stack: 'react',
        sourceInputIds: ['steroid-react-rules', 'steroid-composition-rules'],
        pillars,
        antiPatterns,
    };
}

module.exports = {
    buildReactImplementationRules,
};
