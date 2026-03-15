'use strict';

const INTENT_KEYWORDS = {
    fix: [
        'fix',
        'bug',
        'debug',
        'broken',
        'error',
        'crash',
        'issue',
        'wrong',
        'failing',
        'not working',
        'doesnt work',
        "doesn't work",
        'investigate',
        'repair',
        'regression',
    ],
    refactor: [
        'refactor',
        'restructure',
        'reorganize',
        'clean up',
        'cleanup',
        'improve',
        'optimize',
        'simplify',
        'extract',
        'decouple',
        'polish',
    ],
    migrate: ['migrate', 'migration', 'upgrade', 'switch to', 'move to', 'convert', 'port', 'transition'],
    document: ['document', 'docs', 'readme', 'jsdoc', 'comment', 'explain', 'annotate', 'api docs', 'documentation'],
    build: ['build', 'create', 'add', 'make', 'implement', 'feature', 'new', 'design', 'develop', 'setup', 'set up'],
};

const PIPELINE_LABELS = {
    build: 'scan → vibe → specify → research → architect → engine → verify',
    fix: 'scan → diagnose → engine (targeted) → verify',
    refactor: 'scan → specify (target state) → architect → engine → verify',
    migrate: 'scan → research (target tech) → architect → engine → verify',
    document: 'scan → specify (doc scope) → engine (docs) → verify',
};

const ROUTE_PHASE_HINTS = {
    'standard-build': ['scan', 'normalize-prompt', 'vibe', 'specify', 'research', 'architect', 'engine', 'verify'],
    'diagnose-first': ['scan', 'normalize-prompt', 'diagnose', 'engine', 'verify'],
    'resume-mode': ['scan', 'normalize-prompt', 'resume', 'engine', 'verify'],
    'lite-change': ['scan', 'normalize-prompt', 'vibe', 'specify', 'architect', 'engine', 'verify'],
    'research-heavy': ['scan', 'normalize-prompt', 'research', 'architect', 'engine', 'verify'],
    'split-work': ['scan', 'normalize-prompt', 'vibe', 'specify', 'architect', 'engine', 'verify'],
};

function normalizeWhitespace(value) {
    return (value || '').replace(/\s+/g, ' ').trim();
}

function toTitleSummary(message) {
    const normalized = normalizeWhitespace(message);
    if (!normalized) return '';
    return normalized[0].toUpperCase() + normalized.slice(1);
}

function scoreIntents(message) {
    const source = normalizeWhitespace(message).toLowerCase();
    const scores = {};
    for (const [intent, keywords] of Object.entries(INTENT_KEYWORDS)) {
        let score = 0;
        for (const keyword of keywords) {
            if (source.includes(keyword)) {
                score += keyword.length;
            }
        }
        scores[intent] = score;
    }
    return scores;
}

function detectContinuationState(message, sessionState = {}) {
    const source = normalizeWhitespace(message).toLowerCase();
    if (!source) return sessionState.defaultState || 'new-work';

    if (/(continue|resume|pick up|carry on|keep going|finish up|where we left off|yesterday)/.test(source)) {
        return sessionState.activeFeature ? 'resume' : 'continuation-requested';
    }
    if (/(last change|just broke|regression|after the last change|stopped working)/.test(source)) {
        return 'post-failure';
    }
    if (/(polish|clean up|cleanup|finish|wrap up|finalize|tighten)/.test(source)) {
        return 'polish';
    }
    return sessionState.defaultState || 'new-work';
}

function detectComplexity(message, primaryIntent, secondaryIntents) {
    const source = normalizeWhitespace(message).toLowerCase();
    if (
        /(rename|change text|button text|label|typo|copy change|small tweak|minor tweak|one line|one-line)/.test(source)
    ) {
        return 'trivial';
    }
    if (
        /(payment|billing|checkout|auth|authentication|database|schema|infra|security|permissions|role|migration)/.test(
            source,
        )
    ) {
        return 'high-risk';
    }
    if (
        secondaryIntents.length > 0 ||
        /(dashboard|onboarding|redesign|architecture|workflow|system|complex|full app|whole app|enterprise)/.test(
            source,
        )
    ) {
        return 'complex';
    }
    if (primaryIntent === 'migrate') return 'high-risk';
    return 'standard';
}

function detectAmbiguity(message, primaryIntent, secondaryIntents) {
    const source = normalizeWhitespace(message).toLowerCase();
    let score = 0;

    if (secondaryIntents.length > 0) score += 2;
    if (
        /(better|cleaner|premium|modern|nice|good|improve it|make it pop|more robust|enterprise-ready|clean this up)/.test(
            source,
        )
    ) {
        score += 2;
    }
    if (!primaryIntent || primaryIntent === 'build') score += 1;
    if (source.split(' ').length <= 4) score += 1;
    if (/(something|stuff|things|whatever|somehow|kinda|sort of|maybe)/.test(source)) score += 1;

    if (score >= 4) return 'high';
    if (score >= 2) return 'medium';
    return 'low';
}

function extractAssumptions(message, primaryIntent, complexity) {
    const source = normalizeWhitespace(message).toLowerCase();
    const assumptions = [];

    if (/(cleaner|premium|modern|confusing|better ux|feel better|look better)/.test(source)) {
        assumptions.push(
            'Interpret design language as UX and visual-hierarchy improvements unless the user says otherwise.',
        );
    }
    if (primaryIntent === 'build' && !/(mobile|responsive|desktop only)/.test(source)) {
        assumptions.push('Preserve responsive behavior by default.');
    }
    if (primaryIntent === 'fix') {
        assumptions.push('Prioritize preserving existing behavior outside the reported issue.');
    }
    if (complexity === 'high-risk') {
        assumptions.push(
            'Require conservative changes and stronger verification because the request touches risky areas.',
        );
    }

    return assumptions;
}

function extractNonGoals(message, secondaryIntents) {
    const source = normalizeWhitespace(message).toLowerCase();
    const nonGoals = [];

    if (!/(rewrite|from scratch|rebuild everything|whole app)/.test(source)) {
        nonGoals.push('Do not rewrite unrelated parts of the codebase.');
    }
    if (secondaryIntents.length > 0) {
        nonGoals.push('Do not silently merge unrelated requested tasks into one unscoped implementation.');
    }

    return nonGoals;
}

function extractUnresolvedQuestions(message, ambiguity, secondaryIntents) {
    const source = normalizeWhitespace(message).toLowerCase();
    const questions = [];

    if (ambiguity === 'high') {
        questions.push('What concrete outcome would tell us this task is successful?');
    }
    if (secondaryIntents.length > 0) {
        questions.push('Should this be split into multiple features or handled as one scoped effort?');
    }
    if (!/(react|vue|svelte|node|python|go|rust|next|express|django|rails|php|java|kotlin)/.test(source)) {
        questions.push('Should the current stack and architecture be preserved as-is?');
    }

    return questions;
}

function chooseRecommendedPipeline(analysis) {
    if (analysis.continuationState === 'resume') return 'resume-mode';
    if (analysis.splitRecommended) return 'split-work';
    if (analysis.primaryIntent === 'fix') return 'diagnose-first';
    if (analysis.complexity === 'trivial') return 'lite-change';
    if (analysis.primaryIntent === 'migrate' || analysis.complexity === 'high-risk') return 'research-heavy';
    return 'standard-build';
}

function analyzePrompt(message, sessionState = {}) {
    const rawPrompt = normalizeWhitespace(message);
    const scores = scoreIntents(rawPrompt);
    const ranked = Object.entries(scores).sort((a, b) => b[1] - a[1]);
    const primaryIntent = ranked[0] && ranked[0][1] > 0 ? ranked[0][0] : 'build';
    const secondaryIntents = ranked
        .filter(([intent, score]) => intent !== primaryIntent && score > 0)
        .map(([intent]) => intent);
    const continuationState = detectContinuationState(rawPrompt, sessionState);
    const complexity = detectComplexity(rawPrompt, primaryIntent, secondaryIntents);
    const ambiguity = detectAmbiguity(rawPrompt, primaryIntent, secondaryIntents);
    const risk = complexity === 'high-risk' ? 'high' : complexity === 'complex' ? 'medium' : 'low';
    const splitRecommended =
        secondaryIntents.length > 0 &&
        /( and | also | plus | then | plus also |,)/.test(` ${rawPrompt.toLowerCase()} `);
    const assumptions = extractAssumptions(rawPrompt, primaryIntent, complexity);
    const nonGoals = extractNonGoals(rawPrompt, secondaryIntents);
    const unresolvedQuestions = extractUnresolvedQuestions(rawPrompt, ambiguity, secondaryIntents);

    const analysis = {
        rawPrompt,
        normalizedSummary: toTitleSummary(rawPrompt),
        primaryIntent,
        secondaryIntents,
        confidence: Math.min(1, Math.max(0.2, (scores[primaryIntent] || 0) / 20)).toFixed(2),
        ambiguity,
        complexity,
        risk,
        continuationState,
        assumptions,
        nonGoals,
        unresolvedQuestions,
        splitRecommended,
        suggestedFeatures: splitRecommended
            ? rawPrompt
                  .split(/\band\b|\balso\b|,/i)
                  .map((part) => normalizeWhitespace(part))
                  .filter(Boolean)
            : [],
    };

    analysis.recommendedPipeline = chooseRecommendedPipeline(analysis);
    analysis.pipelineHint = PIPELINE_LABELS[primaryIntent];
    return analysis;
}

function suggestNextPhase(analysis, artifacts = {}) {
    if (!artifacts.context) {
        return {
            phase: 'scan',
            reason: 'context.md is missing',
        };
    }
    if (!artifacts.prompt) {
        return {
            phase: 'normalize-prompt',
            reason: 'prompt.json is missing',
        };
    }

    const route = analysis.recommendedPipeline || 'standard-build';
    if (route === 'diagnose-first') {
        if (!artifacts.diagnosis) {
            return { phase: 'diagnose', reason: 'diagnosis.md is missing for the targeted fix route' };
        }
        if (!artifacts.verify) {
            return { phase: 'engine', reason: 'Execute the targeted fix and generate verification evidence next' };
        }
        return { phase: 'complete', reason: 'Diagnosis and verification artifacts are already present' };
    }

    if (route === 'research-heavy') {
        if (!artifacts.research) {
            return { phase: 'research', reason: 'research.md is missing for the high-risk route' };
        }
        if (!artifacts.plan) {
            return { phase: 'architect', reason: 'plan.md is missing after research' };
        }
        if (!artifacts.verify) {
            return { phase: 'engine', reason: 'Implementation and verification are the next remaining steps' };
        }
        return { phase: 'complete', reason: 'Research-heavy route artifacts are present' };
    }

    if (route === 'resume-mode') {
        if (artifacts.diagnosis && !artifacts.verify) {
            return { phase: 'engine', reason: 'Resume from diagnosis.md and complete the targeted fix' };
        }
        if (artifacts.plan && !artifacts.verify) {
            return { phase: 'engine', reason: 'Resume from the existing plan.md and continue implementation' };
        }
        if (artifacts.research && !artifacts.plan) {
            return { phase: 'architect', reason: 'Resume by turning research into plan.md' };
        }
        if (artifacts.spec && !artifacts.research) {
            return { phase: 'research', reason: 'Resume by filling in research.md' };
        }
        if (artifacts.vibe && !artifacts.spec) {
            return { phase: 'specify', reason: 'Resume by turning vibe.md into spec.md' };
        }
        if (!artifacts.vibe && analysis.primaryIntent === 'fix') {
            return { phase: 'diagnose', reason: 'Resume through diagnosis because the prompt still reads like a fix' };
        }
        if (!artifacts.vibe) {
            return { phase: 'vibe', reason: 'Resume by locking the next structured brief in vibe.md' };
        }
        if (!artifacts.verify) {
            return { phase: 'engine', reason: 'Resume the remaining implementation work' };
        }
        return { phase: 'complete', reason: 'Resume route artifacts already look complete' };
    }

    if (route === 'split-work') {
        if (!artifacts.vibe) {
            return { phase: 'vibe', reason: 'Capture the split intent explicitly in vibe.md first' };
        }
        if (!artifacts.spec) {
            return { phase: 'specify', reason: 'Turn the split request into separate stories or scoped work' };
        }
        if (!artifacts.plan) {
            return { phase: 'architect', reason: 'Create a scoped implementation plan for the split work' };
        }
        if (!artifacts.verify) {
            return { phase: 'engine', reason: 'Implement one scoped slice at a time, then verify' };
        }
        return { phase: 'complete', reason: 'Split-work route artifacts are present' };
    }

    if (route === 'lite-change') {
        if (!artifacts.vibe) {
            return { phase: 'vibe', reason: 'Capture the small change in a minimal vibe.md' };
        }
        if (!artifacts.spec) {
            return { phase: 'specify', reason: 'Define the tiny acceptance boundary before implementation' };
        }
        if (!artifacts.plan) {
            return { phase: 'architect', reason: 'A short plan.md keeps the small change reviewable' };
        }
        if (!artifacts.verify) {
            return { phase: 'engine', reason: 'Implement and verify the small change' };
        }
        return { phase: 'complete', reason: 'Lite-change route artifacts are present' };
    }

    if (!artifacts.vibe) {
        return { phase: 'vibe', reason: 'vibe.md is missing' };
    }
    if (!artifacts.spec) {
        return { phase: 'specify', reason: 'spec.md is missing' };
    }
    if (!artifacts.research) {
        return { phase: 'research', reason: 'research.md is missing' };
    }
    if (!artifacts.plan) {
        return { phase: 'architect', reason: 'plan.md is missing' };
    }
    if (!artifacts.verify) {
        return { phase: 'engine', reason: 'Implementation should finish and write verification evidence next' };
    }
    return { phase: 'complete', reason: 'Standard route artifacts are present' };
}

function summarizeRouteProgress(analysis, artifacts = {}) {
    const route = analysis.recommendedPipeline || 'standard-build';
    let status = 'on-track';
    let detail = 'Artifacts match the recommended route so far.';

    if (route === 'diagnose-first' && artifacts.plan && !artifacts.diagnosis) {
        status = 'drifted';
        detail =
            'plan.md exists before diagnosis.md, which suggests the fix route may have skipped root-cause capture.';
    } else if (route === 'research-heavy' && artifacts.plan && !artifacts.research) {
        status = 'drifted';
        detail = 'plan.md exists before research.md, which weakens the high-risk route.';
    } else if (route === 'split-work' && artifacts.plan && !artifacts.spec) {
        status = 'drifted';
        detail = 'plan.md exists before spec.md, so the split work may not be scoped clearly yet.';
    } else if (route === 'resume-mode') {
        status = 'adaptive';
        detail = 'Resume mode follows the latest trustworthy artifact rather than a fixed early-phase sequence.';
    }

    return {
        expectedRoute: route,
        expectedPhases: ROUTE_PHASE_HINTS[route] || ROUTE_PHASE_HINTS['standard-build'],
        next: suggestNextPhase(analysis, artifacts),
        status,
        detail,
    };
}

function buildPromptHealth(analysis) {
    const clarity = analysis.ambiguity === 'low' ? 5 : analysis.ambiguity === 'medium' ? 3 : 2;
    const completeness =
        analysis.unresolvedQuestions.length === 0 ? 5 : analysis.unresolvedQuestions.length === 1 ? 4 : 2;
    const recommendedAction = analysis.splitRecommended
        ? 'split work'
        : analysis.ambiguity === 'high'
          ? 'proceed with assumptions'
          : analysis.complexity === 'high-risk'
            ? 'proceed carefully'
            : 'proceed';

    return {
        clarity,
        completeness,
        ambiguity: analysis.ambiguity,
        complexity: analysis.complexity,
        risk: analysis.risk,
        multiIntent: analysis.splitRecommended ? 'yes' : 'no',
        modelSensitivity:
            analysis.ambiguity === 'high' || analysis.complexity === 'high-risk'
                ? 'high'
                : analysis.complexity === 'complex'
                  ? 'medium'
                  : 'low',
        recommendedAction,
    };
}

function inspectSession(featureStates = [], runtimeState = {}) {
    const sorted = [...featureStates].sort((a, b) => new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0));
    const activeFeature = sorted[0] || null;
    let defaultState = 'new-work';

    if ((runtimeState.error_count || 0) > 0) {
        defaultState = 'post-failure';
    } else if (activeFeature && activeFeature.incomplete) {
        defaultState = 'resume';
    } else if (activeFeature && activeFeature.lastArtifact === 'verify.json') {
        defaultState = 'post-verify';
    }

    return {
        activeFeature: activeFeature ? activeFeature.name : null,
        latestArtifact: activeFeature ? activeFeature.lastArtifact : null,
        defaultState,
        knownFeatures: sorted.map((feature) => feature.name),
        errorCount: runtimeState.error_count || 0,
        recoveryState: runtimeState.status || 'active',
    };
}

module.exports = {
    PIPELINE_LABELS,
    ROUTE_PHASE_HINTS,
    analyzePrompt,
    buildPromptHealth,
    inspectSession,
    normalizeWhitespace,
    suggestNextPhase,
    summarizeRouteProgress,
    scoreIntents,
};
