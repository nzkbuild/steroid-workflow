#!/usr/bin/env node
'use strict';

const path = require('path');
const {
    detectUiTask,
    detectAuditMode,
    detectStack,
    routeDesignSystems,
} = require('../../src/utils/design-routing.cjs');

let passed = 0;
let failed = 0;

function test(name, fn) {
    try {
        fn();
        passed++;
        console.log(`  ✅ ${name}`);
    } catch (e) {
        failed++;
        console.log(`  ❌ ${name}: ${e.message}`);
    }
}

console.log('[unit] design-routing.test.cjs');

const rootDir = path.join(__dirname, '..', '..');

test('detects UI tasks from redesign language', () => {
    if (!detectUiTask('redesign the dashboard and improve the landing page')) {
        throw new Error('Expected redesign prompt to count as UI work');
    }
});

test('detects audit mode from review language', () => {
    if (!detectAuditMode('audit the accessibility of this page')) {
        throw new Error('Expected audit prompt to count as review work');
    }
});

test('detects react native stack from Expo prompt', () => {
    const stack = detectStack('improve the Expo onboarding screen for ios and android');
    if (stack !== 'react-native') throw new Error(`Expected react-native, got ${stack}`);
});

test('routes React dashboard work to the React implementation wrapper', () => {
    const route = routeDesignSystems({
        prompt: 'refactor the React dashboard UI and clean up component composition',
        rootDir,
    });
    if (route.wrapperSkill !== 'steroid-react-implementation') {
        throw new Error(`Unexpected wrapper: ${route.wrapperSkill}`);
    }
    if (!route.importedSourceIds.includes('steroid-react-rules')) {
        throw new Error('Missing Vercel React Best Practices');
    }
    if (!route.importedSourceIds.includes('steroid-composition-rules')) {
        throw new Error('Missing Vercel Composition Patterns');
    }
});

test('routes React Native redesign work to the RN wrapper', () => {
    const route = routeDesignSystems({
        prompt: 'redesign the Expo mobile onboarding flow',
        rootDir,
    });
    if (route.wrapperSkill !== 'steroid-rn-implementation') {
        throw new Error(`Unexpected wrapper: ${route.wrapperSkill}`);
    }
    if (!route.importedSourceIds.includes('steroid-native-rules')) {
        throw new Error('Missing Vercel React Native Skills');
    }
});

test('routes audit prompts to web design review and accesslint', () => {
    const route = routeDesignSystems({
        prompt: 'review this website for accessibility and design issues',
        rootDir,
    });
    if (route.wrapperSkill !== 'steroid-web-design-review') {
        throw new Error(`Unexpected wrapper: ${route.wrapperSkill}`);
    }
    if (!route.importedSourceIds.includes('steroid-accessibility-audit')) {
        throw new Error('Missing AccessLint integration');
    }
});

test('returns no route for non-UI work', () => {
    const route = routeDesignSystems({
        prompt: 'fix the SQL migration race condition in the background worker',
        rootDir,
    });
    if (route.wrapperSkill !== null) throw new Error('Expected null wrapper for non-UI work');
    if (route.importedSourceIds.length !== 0) throw new Error('Expected no source inputs');
});

console.log(`  ${passed} passed, ${failed} failed`);
module.exports = { passed, failed };
