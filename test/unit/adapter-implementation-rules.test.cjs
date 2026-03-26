'use strict';

const { buildReactImplementationRules } = require('../../src/domain/adapters/react/implementation-rules.cjs');
const {
    buildReactNativeImplementationRules,
} = require('../../src/domain/adapters/react-native/implementation-rules.cjs');

let passed = 0;
let failed = 0;

function test(name, fn) {
    try {
        fn();
        passed++;
        console.log(`  ✅ ${name}`);
    } catch (error) {
        failed++;
        console.log(`  ❌ ${name}: ${error.message}`);
    }
}

console.log('[unit] adapter-implementation-rules.test.cjs');

test('react implementation profile exposes structured pillars and anti-patterns', () => {
    const profile = buildReactImplementationRules({ reactVersion: '19.0.0' });
    if (profile.stack !== 'react') throw new Error(`Unexpected stack: ${profile.stack}`);
    if (!Array.isArray(profile.pillars) || profile.pillars.length < 3) {
        throw new Error(`Missing pillars: ${JSON.stringify(profile)}`);
    }
    if (!profile.pillars.some((pillar) => pillar.name === 'Bundle and delivery discipline')) {
        throw new Error(`Missing bundle pillar: ${JSON.stringify(profile.pillars)}`);
    }
    if (!profile.antiPatterns.some((item) => item.includes('barrel imports'))) {
        throw new Error(`Missing anti-pattern coverage: ${JSON.stringify(profile.antiPatterns)}`);
    }
});

test('react native implementation profile exposes mobile-specific pillars', () => {
    const profile = buildReactNativeImplementationRules();
    if (profile.stack !== 'react-native') throw new Error(`Unexpected stack: ${profile.stack}`);
    if (!profile.pillars.some((pillar) => pillar.name === 'List and rendering performance')) {
        throw new Error(`Missing list-performance pillar: ${JSON.stringify(profile.pillars)}`);
    }
    if (!profile.antiPatterns.some((item) => item.includes('TouchableOpacity'))) {
        throw new Error(`Missing RN anti-pattern coverage: ${JSON.stringify(profile.antiPatterns)}`);
    }
});

console.log(`  ${passed} passed, ${failed} failed`);
module.exports = { passed, failed };
