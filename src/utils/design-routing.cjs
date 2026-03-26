'use strict';

const { getForkSource, resolveForkSourcePath, resolveRepoRoot } = require('./fork-sources.cjs');

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
            sourceInputIds: [],
            sourceInputPaths: [],
            importedSourceIds: [],
            importedSourcePaths: [],
            auditOnly: false,
            stack,
        };
    }

    const sourceInputIds = ['steroid-design-system', 'steroid-ux-discipline'];
    let wrapperSkill = 'steroid-design-orchestrator';

    if (stack === 'react-native') {
        sourceInputIds.push('steroid-native-rules');
        wrapperSkill = 'steroid-rn-implementation';
    } else {
        sourceInputIds.push('steroid-web-direction');
        sourceInputIds.push('steroid-web-review');
        sourceInputIds.push('steroid-interface-review');
        if (stack === 'react') {
            sourceInputIds.push('steroid-react-rules');
            sourceInputIds.push('steroid-composition-rules');
            wrapperSkill = 'steroid-react-implementation';
        }
    }

    if (isAudit) {
        wrapperSkill = 'steroid-web-design-review';
        if (!sourceInputIds.includes('steroid-web-review') && stack !== 'react-native') {
            sourceInputIds.push('steroid-web-review');
        }
        if (!sourceInputIds.includes('steroid-interface-review') && stack !== 'react-native') {
            sourceInputIds.push('steroid-interface-review');
        }
        if (!sourceInputIds.includes('steroid-accessibility-audit')) {
            sourceInputIds.push('steroid-accessibility-audit');
        }
    }

    const uniqueSourceIds = sourceInputIds.filter(
        (id, index) => sourceInputIds.indexOf(id) === index && getForkSource(id, rootDir),
    );
    const sourceInputPaths = uniqueSourceIds.map((id) => resolveForkSourcePath(id, rootDir)).filter(Boolean);

    return {
        domain: stack,
        wrapperSkill,
        sourceInputIds: uniqueSourceIds,
        sourceInputPaths,
        importedSourceIds: uniqueSourceIds,
        importedSourcePaths: sourceInputPaths,
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
