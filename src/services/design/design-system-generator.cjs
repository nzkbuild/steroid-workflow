'use strict';

const { buildReactImplementationRules } = require('../../domain/adapters/react/implementation-rules.cjs');
const { buildReactNativeImplementationRules } = require('../../domain/adapters/react-native/implementation-rules.cjs');

function detectStack(query) {
    const text = String(query || '').toLowerCase();
    if (/\breact native\b|\bexpo\b|\bmobile app\b|\bios\b|\bandroid\b/.test(text)) {
        return 'react-native';
    }
    if (/\breact\b|\bnext\b|\bdashboard\b|\bweb\b|\bsite\b|\blanding\b/.test(text)) {
        return 'react';
    }
    return 'web';
}

function detectTone(query) {
    const text = String(query || '').toLowerCase();
    if (/\bpremium\b|\bluxury\b|\belegant\b|\bpolished\b/.test(text)) return 'premium';
    if (/\bbold\b|\bplayful\b|\bexpressive\b/.test(text)) return 'bold';
    if (/\bminimal\b|\bclean\b|\bsimple\b/.test(text)) return 'minimal';
    return 'confident';
}

function detectLayout(query) {
    const text = String(query || '').toLowerCase();
    if (/\bdashboard\b|\badmin\b|\banalytics\b/.test(text)) return 'panel';
    if (/\blanding\b|\bmarketing\b|\bhomepage\b/.test(text)) return 'editorial';
    if (/\bonboarding\b|\bform\b|\bsettings\b/.test(text)) return 'guided';
    return 'structured';
}

function toneTokens(tone) {
    if (tone === 'premium') {
        return {
            palette: 'Deep graphite, warm white, muted brass accents',
            typography: 'High-contrast headings with restrained body copy',
            motion: 'Measured fades, panel slides, and deliberate emphasis',
            materials: 'Dense surfaces, subtle borders, and restrained highlight accents',
        };
    }
    if (tone === 'bold') {
        return {
            palette: 'Strong neutrals with one saturated accent color',
            typography: 'Large display moments balanced by dense support text',
            motion: 'Sharp transitions with staggered section reveals',
            materials: 'High-contrast blocks, assertive shapes, and visible emphasis zones',
        };
    }
    if (tone === 'minimal') {
        return {
            palette: 'Soft neutrals with subtle surface separation',
            typography: 'Quiet hierarchy with generous spacing',
            motion: 'Low-friction motion limited to orientation cues',
            materials: 'Low-noise surfaces, quiet dividers, and spacing-led structure',
        };
    }
    return {
        palette: 'Neutral foundation with one product accent',
        typography: 'Clear hierarchy with strong section labels',
        motion: 'Simple transitions that reinforce state changes',
        materials: 'Purposeful surfaces with visible action hierarchy',
    };
}

function layoutGuidance(layout, stack) {
    if (layout === 'panel') {
        return stack === 'react-native'
            ? 'Use stacked cards, sticky section headers, and compact metric summaries.'
            : 'Use a strong shell, asymmetric panels, and a visible information hierarchy.';
    }
    if (layout === 'editorial') {
        return 'Lead with a clear hero, use section rhythm aggressively, and avoid generic card grids.';
    }
    if (layout === 'guided') {
        return 'Make the next action unmistakable and keep supporting information secondary.';
    }
    return 'Prefer structured sections with one dominant focal point per screen.';
}

function implementationNotes(stack) {
    if (stack === 'react-native') {
        return [
            'Favor reusable screen sections over oversized one-off components.',
            'Use spacing and elevation intentionally; avoid web-like dense chrome.',
            'Keep touch targets generous and align motion with navigation context.',
        ];
    }

    return [
        'Favor composable layout primitives over deeply nested page-specific markup.',
        'Use CSS variables for palette, spacing, and typography tokens.',
        'Treat empty, loading, and error states as first-class UI surfaces.',
    ];
}

function fixedFoundations(stack, tone) {
    const foundations = [
        'Build one visual language and repeat it consistently across every core screen.',
        'Reserve decorative effects for emphasis moments; hierarchy must still read without them.',
        'Make primary actions obvious in every critical flow.',
    ];

    if (stack === 'react-native') {
        foundations.push('Use touch-safe spacing and keep interaction density lower than web equivalents.');
    } else {
        foundations.push('Use semantic page landmarks and preserve keyboard-visible focus through all major flows.');
    }

    if (tone === 'premium') {
        foundations.push('Favor restraint over novelty; premium should read as control, not ornament.');
    } else if (tone === 'bold') {
        foundations.push('Use contrast aggressively, but keep one dominant visual idea per screen.');
    }

    return foundations;
}

function projectSpecificDirection(layout, stack) {
    if (layout === 'panel') {
        return [
            'Treat information density as a hierarchy problem, not a card-count problem.',
            'Keep summary metrics visible while secondary detail recedes naturally.',
            stack === 'react-native'
                ? 'Use sectioned vertical flows instead of cramped desktop-style multicolumn layouts.'
                : 'Use panel contrast, width changes, and spacing rhythm to separate analysis zones.',
        ];
    }

    if (layout === 'editorial') {
        return [
            'Open with a memorable visual thesis, not a generic hero plus cards pattern.',
            'Use section rhythm and contrast shifts to create narrative momentum down the page.',
            'Treat social proof, benefits, and conversion sections as distinct visual scenes.',
        ];
    }

    if (layout === 'guided') {
        return [
            'Each step should make the next action obvious within one scan.',
            'Reduce support text until the task flow remains clear under stress.',
            'Show progress and state changes explicitly; do not rely on implied completion.',
        ];
    }

    return [
        'Each screen should have one dominant focal point and one clearly secondary support zone.',
        'Use spacing, heading contrast, and surface weight to make the reading order unambiguous.',
        'Prefer intentional composition over evenly weighted repeated blocks.',
    ];
}

function adaptableRules(stack) {
    const rules = [
        'Define tokens once and apply them through reusable primitives rather than page-local overrides.',
        'Handle loading, empty, success, and failure states with the same design discipline as primary states.',
        'Avoid introducing a new surface style when spacing and typography can solve the hierarchy issue.',
    ];

    if (stack === 'react-native') {
        rules.push('Align transitions with navigation context and device ergonomics rather than web-style page swaps.');
    } else {
        rules.push('Keep responsive layout shifts deliberate; avoid collapsing hierarchy into a single flat column too early.');
    }

    return rules;
}

function motionSpec(tone, stack) {
    if (tone === 'premium') {
        return {
            rhythm: 'Calm and deliberate. Motion should confirm hierarchy, not chase attention.',
            durations: 'Micro 120-160ms, standard 180-240ms, section shifts 260-320ms',
            easing: 'Ease-out for reveal, ease-in-out for context shifts',
        };
    }

    if (tone === 'bold') {
        return {
            rhythm: 'High confidence with visible staging between primary and secondary content.',
            durations: 'Micro 90-140ms, standard 160-220ms, section shifts 220-280ms',
            easing: 'Sharper ease-out curves with clear stop positions',
        };
    }

    if (stack === 'react-native') {
        return {
            rhythm: 'Contextual and navigation-led. Motion should reinforce where the user came from and where they landed.',
            durations: 'Micro 100-140ms, standard 180-220ms, screen transitions 220-300ms',
            easing: 'Use platform-consistent easing unless the product has a strong reason to differ',
        };
    }

    return {
        rhythm: 'Subtle and informative. Use motion to orient and acknowledge.',
        durations: 'Micro 100-140ms, standard 160-220ms, section shifts 220-280ms',
        easing: 'Smooth ease-out for entry and restrained ease-in-out for layout changes',
    };
}

function validationChecklist(stack) {
    const checks = [
        'Primary action is obvious within one scan on each critical screen.',
        'Hierarchy remains clear in loading, empty, and error states.',
        'Typography, spacing, and surface contrast are doing most of the structural work.',
        'Accessibility is preserved for contrast, focus visibility, and semantic structure.',
    ];

    if (stack === 'react-native') {
        checks.push('Touch targets remain comfortable and thumb reach is respected on key mobile flows.');
    } else {
        checks.push('Keyboard flow, hover states, and responsive collapse do not hide important affordances.');
    }

    return checks;
}

function buildStackImplementationRules(stack, options = {}) {
    if (stack === 'react-native') {
        return buildReactNativeImplementationRules(options);
    }

    if (stack === 'react') {
        return buildReactImplementationRules(options);
    }

    return {
        stack,
        rules: [
            'Keep layout primitives reusable and token-driven instead of page-specific.',
            'Defer non-critical assets and interactions until the primary task path is stable.',
            'Treat accessibility, empty states, and failure states as part of the main implementation scope.',
        ],
        sourceInputIds: [],
    };
}

function formatImplementationProfile(profile) {
    const lines = [];

    for (const pillar of profile.pillars || []) {
        lines.push(`- ${pillar.name} (${pillar.priority})`);
        for (const rule of pillar.rules || []) {
            lines.push(`  - ${rule}`);
        }
    }

    if (Array.isArray(profile.antiPatterns) && profile.antiPatterns.length > 0) {
        lines.push('- Anti-patterns to block');
        for (const item of profile.antiPatterns) {
            lines.push(`  - ${item}`);
        }
    }

    return lines;
}

function generateDesignSystemMarkdown(query, options = {}) {
    const prompt = String(query || '').trim();
    const projectName = String(options.projectName || 'Steroid Design System').trim();
    const stack = options.stack || detectStack(prompt);
    const tone = detectTone(prompt);
    const layout = detectLayout(prompt);
    const tokens = toneTokens(tone);
    const motion = motionSpec(tone, stack);
    const implementationRules = buildStackImplementationRules(stack, options);

    return [
        `# Design System: ${projectName}`,
        '',
        '## Direction',
        '',
        `- Stack: ${stack}`,
        `- Tone: ${tone}`,
        `- Layout mode: ${layout}`,
        `- Prompt focus: ${prompt || 'General product UI polish'}`,
        '',
        '## Visual Tokens',
        '',
        `- Palette: ${tokens.palette}`,
        `- Typography: ${tokens.typography}`,
        `- Motion: ${tokens.motion}`,
        `- Surface/material treatment: ${tokens.materials}`,
        '',
        '## Fixed Foundations',
        '',
        ...fixedFoundations(stack, tone).map((item) => `- ${item}`),
        '',
        '## Project-Specific Direction',
        '',
        ...projectSpecificDirection(layout, stack).map((item) => `- ${item}`),
        '',
        '## Layout Guidance',
        '',
        layoutGuidance(layout, stack),
        '',
        '## Component Discipline',
        '',
        '- Use one dominant surface style and one secondary support surface.',
        '- Avoid generic evenly weighted cards when hierarchy should be obvious.',
        '- Keep interaction affordances visible; do not hide key actions behind decoration.',
        '',
        '## Adaptable Implementation Rules',
        '',
        ...adaptableRules(stack).map((item) => `- ${item}`),
        '',
        '## Motion Specification',
        '',
        `- Rhythm: ${motion.rhythm}`,
        `- Recommended duration bands: ${motion.durations}`,
        `- Easing approach: ${motion.easing}`,
        '',
        '## Accessibility Guardrails',
        '',
        '- Preserve heading hierarchy and clear landmark structure.',
        '- Ensure contrast remains strong across primary and secondary surfaces.',
        '- Make hover-only meaning non-essential and preserve keyboard clarity.',
        '',
        '## Validation Checklist',
        '',
        ...validationChecklist(stack).map((item) => `- ${item}`),
        '',
        '## Stack Implementation Constraints',
        '',
        ...formatImplementationProfile(implementationRules),
        '',
        '## Implementation Notes',
        '',
        ...implementationNotes(stack).map((note) => `- ${note}`),
        '',
    ].join('\n');
}

module.exports = {
    detectLayout,
    detectStack,
    detectTone,
    generateDesignSystemMarkdown,
};
