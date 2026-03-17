'use strict';

const { getImportedSource, resolveImportedSourcePath, resolveRepoRoot } = require('./imported-sources.cjs');

const UI_KEYWORDS = [
    'design',
    'redesign',
    'ui',
    'ux',
    'frontend',
    'landing page',
    'dashboard',
    'page',
    'screen',
    'component',
    'layout',
    'responsive',
    'styling',
    'theme',
    'onboarding',
    'navigation',
    'accessibility',
    'a11y',
    'refactor the ui',
];

const AUDIT_KEYWORDS = ['audit', 'review', 'check', 'inspect', 'accessibility', 'a11y', 'compliance'];
const RN_KEYWORDS = ['react native', 'expo', 'ios', 'android', 'mobile app', 'native app'];
const REACT_KEYWORDS = ['react', 'next.js', 'nextjs', 'server component', 'client component'];

function includesAny(haystack, needles) {
    return needles.some((needle) => haystack.includes(needle));
}

function detectUiTask(input = '') {
    const text = String(input || '').toLowerCase();
    return includesAny(text, UI_KEYWORDS);
}

function detectAuditMode(input = '') {
    const text = String(input || '').toLowerCase();
    return includesAny(text, AUDIT_KEYWORDS);
}

function detectStack(input = '') {
    const text = String(input || '').toLowerCase();
    if (includesAny(text, RN_KEYWORDS)) return 'react-native';
    if (includesAny(text, REACT_KEYWORDS)) return 'react';
    return 'web';
}

function routeDesignSystems(options = {}) {
    const prompt = options.prompt || '';
    const stackHint = options.stack || '';
    const explicitAudit = Boolean(options.auditOnly);
    const rootDir = options.rootDir || resolveRepoRoot();

    const combined = `${prompt} ${stackHint}`.trim().toLowerCase();
    const isUiTask = detectUiTask(combined);
    const isAudit = explicitAudit || detectAuditMode(combined);
    const stack = detectStack(combined);

    if (!isUiTask && !isAudit) {
        return {
            domain: 'none',
            wrapperSkill: null,
            importedSourceIds: [],
            importedSourcePaths: [],
            auditOnly: false,
            stack,
        };
    }

    const importedSourceIds = ['ui-ux-pro-max', 'bencium-ux-designer'];
    let wrapperSkill = 'steroid-design-orchestrator';

    if (stack === 'react-native') {
        importedSourceIds.push('vercel-react-native-skills');
        wrapperSkill = 'steroid-rn-implementation';
    } else {
        importedSourceIds.push('anthropic-frontend-design');
        importedSourceIds.push('vercel-web-design-guidelines');
        importedSourceIds.push('vercel-web-interface-guidelines');
        if (stack === 'react') {
            importedSourceIds.push('vercel-react-best-practices');
            importedSourceIds.push('vercel-composition-patterns');
            wrapperSkill = 'steroid-react-implementation';
        }
    }

    if (isAudit) {
        wrapperSkill = 'steroid-web-design-review';
        if (!importedSourceIds.includes('vercel-web-design-guidelines') && stack !== 'react-native') {
            importedSourceIds.push('vercel-web-design-guidelines');
        }
        if (!importedSourceIds.includes('vercel-web-interface-guidelines') && stack !== 'react-native') {
            importedSourceIds.push('vercel-web-interface-guidelines');
        }
        if (!importedSourceIds.includes('accesslint-core')) {
            importedSourceIds.push('accesslint-core');
        }
    }

    const uniqueSourceIds = importedSourceIds.filter(
        (id, index) => importedSourceIds.indexOf(id) === index && getImportedSource(id, rootDir),
    );

    return {
        domain: stack,
        wrapperSkill,
        importedSourceIds: uniqueSourceIds,
        importedSourcePaths: uniqueSourceIds.map((id) => resolveImportedSourcePath(id, rootDir)),
        auditOnly: isAudit,
        stack,
    };
}

module.exports = {
    detectUiTask,
    detectAuditMode,
    detectStack,
    routeDesignSystems,
};
