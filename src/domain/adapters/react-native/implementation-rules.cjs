'use strict';

function buildReactNativeImplementationRules() {
    return {
        stack: 'react-native',
        sourceInputIds: ['steroid-native-rules'],
        pillars: [
            {
                name: 'List and rendering performance',
                priority: 'critical',
                rules: [
                    'Use virtualized list primitives for collections; do not render long feeds with naive ScrollView mapping.',
                    'Memoize item rows and keep inline objects/functions out of hot list paths.',
                    'Move expensive derivation and media work outside list item render paths.',
                ],
            },
            {
                name: 'Interaction and navigation',
                priority: 'high',
                rules: [
                    'Prefer Pressable and native interaction primitives over older touch abstractions.',
                    'Align motion and screen transitions with navigation context rather than web-style page swaps.',
                    'Treat primary actions, back flows, and gesture coordination as native-first interaction concerns.',
                ],
            },
            {
                name: 'Layout and safe areas',
                priority: 'high',
                rules: [
                    'Handle safe areas and scroll insets intentionally on every full-screen mobile layout.',
                    'Use onLayout or layout callbacks instead of imperative view measurement for ordinary layout decisions.',
                    'Keep full-screen content resilient to keyboard, inset, and device-size changes.',
                ],
            },
            {
                name: 'Platform and dependency discipline',
                priority: 'medium',
                rules: [
                    'Keep native dependencies and platform-specific configuration isolated to the app boundary.',
                    'Treat loading, empty, and offline states as first-class mobile screens, not afterthought overlays.',
                    'Prefer platform-native affordances when a web pattern would feel bolted on.',
                ],
            },
        ],
        antiPatterns: [
            'ScrollView-mapped feeds that render the full collection upfront.',
            'TouchableOpacity or TouchableHighlight for new interaction work.',
            'Manual safe-area padding where native inset handling should own the behavior.',
            'Imperative measurement for layout problems that should be solved declaratively.',
        ],
    };
}

module.exports = {
    buildReactNativeImplementationRules,
};
