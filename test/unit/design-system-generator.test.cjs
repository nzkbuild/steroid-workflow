'use strict';

const { generateDesignSystemMarkdown } = require('../../src/services/design/design-system-generator.cjs');

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

console.log('[unit] design-system-generator.test.cjs');

test('generator produces a first-party markdown artifact for web UI prompts', () => {
    const markdown = generateDesignSystemMarkdown('Create a premium React dashboard redesign', {
        projectName: 'Dashboard Redesign',
    });

    if (!markdown.includes('# Design System: Dashboard Redesign')) throw new Error('Missing title');
    if (!markdown.includes('## Direction')) throw new Error('Missing direction section');
    if (!markdown.includes('- Stack: react')) throw new Error(`Unexpected stack: ${markdown}`);
    if (!markdown.includes('## Fixed Foundations')) throw new Error('Missing fixed foundations section');
    if (!markdown.includes('## Project-Specific Direction')) throw new Error('Missing project-specific direction section');
    if (!markdown.includes('## Motion Specification')) throw new Error('Missing motion specification section');
    if (!markdown.includes('## Validation Checklist')) throw new Error('Missing validation checklist section');
    if (!markdown.includes('## Stack Implementation Constraints')) {
        throw new Error('Missing stack implementation constraints section');
    }
    if (!markdown.includes('Bundle and delivery discipline (critical)')) {
        throw new Error(`Missing structured React pillar: ${markdown}`);
    }
    if (!markdown.includes('Avoid barrel imports')) throw new Error(`Missing React implementation guidance: ${markdown}`);
    if (!markdown.includes('Anti-patterns to block')) throw new Error(`Missing anti-pattern section: ${markdown}`);
    if (!markdown.includes('## Accessibility Guardrails')) throw new Error('Missing accessibility section');
    if (!markdown.includes('## Implementation Notes')) throw new Error('Missing implementation notes');
});

test('generator adapts to react native prompts', () => {
    const markdown = generateDesignSystemMarkdown('Refresh the Expo onboarding experience');
    if (!markdown.includes('- Stack: react-native')) throw new Error(`Unexpected stack: ${markdown}`);
    if (!markdown.includes('Touch targets remain comfortable')) {
        throw new Error(`Missing mobile validation guidance: ${markdown}`);
    }
    if (!markdown.includes('Use virtualized list primitives for collections')) {
        throw new Error(`Missing React Native implementation guidance: ${markdown}`);
    }
    if (!markdown.includes('List and rendering performance (critical)')) {
        throw new Error(`Missing RN structured pillar: ${markdown}`);
    }
});

console.log(`  ${passed} passed, ${failed} failed`);
module.exports = { passed, failed };
