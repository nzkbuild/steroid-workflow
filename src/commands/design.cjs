'use strict';

const fs = require('fs');
const path = require('path');

const { resolveRepoRoot } = require('../utils/fork-sources.cjs');
const { routeDesignSystems } = require('../utils/design-routing.cjs');
const { loadDesignRoutingReceipt } = require('../utils/frontend-receipt-loaders.cjs');
const {
    analyzePrompt,
    buildPromptHealth,
} = require('../utils/prompt-intelligence.cjs');
const {
    bootstrapFeatureDesignArtifacts,
    generateDesignSystemArtifact,
    readJsonFile,
    resolveFeaturePromptForDesign,
    writeJsonFile,
} = require('../utils/design-workflow.cjs');
const { inspectPromptSessionState } = require('../utils/session-state.cjs');

const DESIGN_COMMANDS = new Set(['design-prep', 'design-route', 'design-system', 'prompt-health', 'session-detect']);

function canHandle(command) {
    return DESIGN_COMMANDS.has(command);
}

function buildRuntimeContext(context = {}) {
    const targetDir = context.targetDir || process.cwd();
    return {
        targetDir,
        changesDir: path.join(targetDir, '.memory', 'changes'),
        runtimeRoot: context.runtimeRoot || resolveRepoRoot(),
    };
}

function extractMessage(argv, options = {}) {
    const controlArgs = new Set(options.controlArgs || []);
    const controlValueIndexes = new Set(options.controlValueIndexes || []);
    return argv
        .slice(1)
        .filter((arg, index) => !controlArgs.has(arg) && !controlValueIndexes.has(index + 1))
        .join(' ');
}

function handleDesignRoute(argv = [], context = {}) {
    const runtime = buildRuntimeContext(context);
    const featureFlagIndex = argv.indexOf('--feature');
    const feature = featureFlagIndex !== -1 ? argv[featureFlagIndex + 1] : null;
    const stackFlagIndex = argv.indexOf('--stack');
    const stack = stackFlagIndex !== -1 ? argv[stackFlagIndex + 1] : '';
    const message = extractMessage(argv, {
        controlArgs: ['--json', '--write', '--audit-only', '--feature', '--stack'],
        controlValueIndexes: new Set([featureFlagIndex + 1, stackFlagIndex + 1]),
    });

    if (!message) {
        return {
            handled: true,
            area: 'design',
            command: 'design-route',
            exitCode: 1,
            stderr:
                '[steroid-run] Usage: npx steroid-run design-route "<user message>" [--json] [--audit-only] [--stack <stack>] [--feature <feature> --write]\n',
        };
    }

    const route = routeDesignSystems({
        prompt: message,
        stack,
        auditOnly: argv.includes('--audit-only'),
        rootDir: runtime.runtimeRoot,
    });

    if (argv.includes('--write')) {
        if (!feature) {
            return {
                handled: true,
                area: 'design',
                command: 'design-route',
                exitCode: 1,
                stderr: '[steroid-run] ❌ --write requires --feature <feature>.\n',
            };
        }
        const featureDir = path.join(runtime.changesDir, feature);
        if (!fs.existsSync(featureDir)) {
            return {
                handled: true,
                area: 'design',
                command: 'design-route',
                exitCode: 1,
                stderr: `[steroid-run] ❌ Feature "${feature}" not found. Run: npx steroid-run start ${feature}\n`,
            };
        }
        writeJsonFile(path.join(featureDir, 'design-routing.json'), {
            ...route,
            source: 'design-route',
            prompt: message,
            updatedAt: new Date().toISOString(),
        });
    }

    if (argv.includes('--json')) {
        return {
            handled: true,
            area: 'design',
            command: 'design-route',
            exitCode: 0,
            stdout: `${JSON.stringify(route, null, 2)}\n`,
        };
    }

    const lines = [
        '[steroid-run] 🎨 Design Route',
        `  Stack: ${route.stack}`,
        `  Audit only: ${route.auditOnly ? 'yes' : 'no'}`,
        `  Wrapper skill: ${route.wrapperSkill || 'none'}`,
        `  Source inputs: ${route.sourceInputIds.length > 0 ? route.sourceInputIds.join(', ') : 'none'}`,
    ];
    if (argv.includes('--write')) {
        lines.push(`  Receipt: .memory/changes/${feature}/design-routing.json`);
    }

    return {
        handled: true,
        area: 'design',
        command: 'design-route',
        exitCode: 0,
        stdout: `${lines.join('\n')}\n`,
    };
}

function handleDesignPrep(argv = [], context = {}) {
    const runtime = buildRuntimeContext(context);
    const featureFlagIndex = argv.indexOf('--feature');
    const feature = featureFlagIndex !== -1 ? argv[featureFlagIndex + 1] : null;
    const stackFlagIndex = argv.indexOf('--stack');
    const stack = stackFlagIndex !== -1 ? argv[stackFlagIndex + 1] : '';
    const projectNameFlagIndex = argv.indexOf('--project-name');
    const projectNameFlag = projectNameFlagIndex !== -1 ? argv[projectNameFlagIndex + 1] : '';

    let featureDir = null;
    if (feature) {
        featureDir = path.join(runtime.changesDir, feature);
        if (!fs.existsSync(featureDir)) {
            return {
                handled: true,
                area: 'design',
                command: 'design-prep',
                exitCode: 1,
                stderr: `[steroid-run] ❌ Feature "${feature}" not found. Run: npx steroid-run start ${feature}\n`,
            };
        }
    }

    let message = extractMessage(argv, {
        controlArgs: ['--json', '--write', '--feature', '--stack', '--project-name', '--force'],
        controlValueIndexes: new Set([featureFlagIndex + 1, stackFlagIndex + 1, projectNameFlagIndex + 1]),
    });

    if (!message && featureDir) {
        message = resolveFeaturePromptForDesign(featureDir, { rootDir: runtime.runtimeRoot });
    }

    if (argv.includes('--write') && !featureDir) {
        return {
            handled: true,
            area: 'design',
            command: 'design-prep',
            exitCode: 1,
            stderr: '[steroid-run] ❌ --write requires --feature <feature>.\n',
        };
    }

    if (!message) {
        return {
            handled: true,
            area: 'design',
            command: 'design-prep',
            exitCode: 1,
            stderr:
                '[steroid-run] Usage: npx steroid-run design-prep "<user message>" [--stack <stack>] [--project-name <name>] [--feature <feature> --write] [--force]\n' +
                '[steroid-run]        Or use: npx steroid-run design-prep --feature <feature> --write once prompt.json, spec.md, or vibe.md exists.\n',
        };
    }

    let bootstrap = null;
    let routeSummary = null;
    let previewContent = null;

    if (featureDir) {
        bootstrap = bootstrapFeatureDesignArtifacts(feature, featureDir, {
            prompt: message,
            stack,
            force: argv.includes('--force'),
            source: 'design-prep',
            projectName: projectNameFlag || feature || 'Steroid Design System',
            rootDir: runtime.runtimeRoot,
        });

        if (!bootstrap.ok) {
            return {
                handled: true,
                area: 'design',
                command: 'design-prep',
                exitCode: 1,
                stderr: `[steroid-run] ❌ ${bootstrap.reason}\n`,
            };
        }

        routeSummary = loadDesignRoutingReceipt(featureDir, { rootDir: runtime.runtimeRoot }) || bootstrap.route;
    } else {
        routeSummary = routeDesignSystems({ prompt: message, stack, rootDir: runtime.runtimeRoot });
        if (routeSummary.domain !== 'none' && !routeSummary.auditOnly) {
            const preview = generateDesignSystemArtifact(message, {
                projectName: projectNameFlag || 'Steroid Design System',
                stack: routeSummary.stack,
            });
            if (!preview.ok) {
                return {
                    handled: true,
                    area: 'design',
                    command: 'design-prep',
                    exitCode: 1,
                    stderr: `[steroid-run] ❌ ${preview.error}\n`,
                };
            }
            previewContent = preview.content;
        }
        bootstrap = {
            ok: true,
            skipped: routeSummary.domain === 'none',
            designRouteWritten: false,
            designSystemWritten: false,
            auditOnly: !!routeSummary.auditOnly,
            route: routeSummary,
            reason:
                routeSummary.domain === 'none'
                    ? 'Prompt does not appear UI-intensive, so no design artifacts would be generated.'
                    : null,
        };
    }

    const payload = {
        stack: routeSummary?.stack || 'web',
        auditOnly: !!routeSummary?.auditOnly,
        wrapperSkill: routeSummary?.wrapperSkill || null,
        sourceInputIds: routeSummary?.sourceInputIds || [],
        importedSourceIds: routeSummary?.importedSourceIds || [],
        designRouteWritten: !!bootstrap.designRouteWritten,
        designSystemWritten: !!bootstrap.designSystemWritten,
        skipped: !!bootstrap.skipped,
        outputPaths: featureDir
            ? {
                  designRoute: `.memory/changes/${feature}/design-routing.json`,
                  designSystem: routeSummary?.auditOnly ? null : `.memory/changes/${feature}/design-system.md`,
              }
            : null,
        content: previewContent,
    };

    if (argv.includes('--json')) {
        return {
            handled: true,
            area: 'design',
            command: 'design-prep',
            exitCode: 0,
            stdout: `${JSON.stringify(payload, null, 2)}\n`,
        };
    }

    const lines = [
        '[steroid-run] 🎨 Design Prep',
        `  Stack: ${payload.stack}`,
        `  Audit only: ${payload.auditOnly ? 'yes' : 'no'}`,
        `  Wrapper skill: ${payload.wrapperSkill || 'none'}`,
        `  Source inputs: ${payload.sourceInputIds.length > 0 ? payload.sourceInputIds.join(', ') : 'none'}`,
    ];

    if (payload.skipped) {
        lines.push(`  Result: ${bootstrap.reason}`);
    } else {
        lines.push(`  Design route: ${payload.designRouteWritten ? 'written/refreshed' : 'kept existing receipt'}`);
        lines.push(
            `  Design system: ${
                payload.auditOnly
                    ? 'not applicable (audit-only route)'
                    : payload.designSystemWritten
                      ? 'written/refreshed'
                      : 'kept existing artifact'
            }`,
        );
        if (featureDir) {
            lines.push(`  Receipt: .memory/changes/${feature}/design-routing.json`);
            if (!payload.auditOnly) {
                lines.push(`  Artifact: .memory/changes/${feature}/design-system.md`);
            }
        }
    }

    return {
        handled: true,
        area: 'design',
        command: 'design-prep',
        exitCode: 0,
        stdout: `${lines.join('\n')}\n`,
    };
}

function handleDesignSystem(argv = [], context = {}) {
    const runtime = buildRuntimeContext(context);
    const featureFlagIndex = argv.indexOf('--feature');
    const feature = featureFlagIndex !== -1 ? argv[featureFlagIndex + 1] : null;
    const stackFlagIndex = argv.indexOf('--stack');
    const stack = stackFlagIndex !== -1 ? argv[stackFlagIndex + 1] : '';
    const projectNameFlagIndex = argv.indexOf('--project-name');
    const projectNameFlag = projectNameFlagIndex !== -1 ? argv[projectNameFlagIndex + 1] : '';

    let featureDir = null;
    if (feature) {
        featureDir = path.join(runtime.changesDir, feature);
        if (!fs.existsSync(featureDir)) {
            return {
                handled: true,
                area: 'design',
                command: 'design-system',
                exitCode: 1,
                stderr: `[steroid-run] ❌ Feature "${feature}" not found. Run: npx steroid-run start ${feature}\n`,
            };
        }
    }

    let message = extractMessage(argv, {
        controlArgs: ['--json', '--write', '--feature', '--stack', '--project-name'],
        controlValueIndexes: new Set([featureFlagIndex + 1, stackFlagIndex + 1, projectNameFlagIndex + 1]),
    });

    if (!message && featureDir) {
        message = resolveFeaturePromptForDesign(featureDir, { rootDir: runtime.runtimeRoot });
    }

    if (!message) {
        return {
            handled: true,
            area: 'design',
            command: 'design-system',
            exitCode: 1,
            stderr:
                '[steroid-run] Usage: npx steroid-run design-system "<user message>" [--stack <stack>] [--project-name <name>] [--feature <feature> --write]\n' +
                '[steroid-run]        Or use: npx steroid-run design-system --feature <feature> --write once prompt.json or design-routing.json exists.\n',
        };
    }

    const routeReceiptPath = featureDir ? path.join(featureDir, 'design-routing.json') : null;
    const existingRoute = routeReceiptPath ? readJsonFile(routeReceiptPath) : null;
    const route =
        existingRoute ||
        routeDesignSystems({
            prompt: message,
            stack,
            rootDir: runtime.runtimeRoot,
        });

    if (route.domain === 'none') {
        return {
            handled: true,
            area: 'design',
            command: 'design-system',
            exitCode: 1,
            stderr: '[steroid-run] ❌ This prompt does not look like UI or UX work, so no design system was generated.\n',
        };
    }
    if (route.auditOnly) {
        return {
            handled: true,
            area: 'design',
            command: 'design-system',
            exitCode: 1,
            stderr: '[steroid-run] ❌ design-system is not used for audit-only routes. Run design-route or verify instead.\n',
        };
    }

    const projectName = projectNameFlag || feature || 'Steroid Design System';
    const generation = generateDesignSystemArtifact(message, { projectName, stack: route.stack });
    if (!generation.ok) {
        return {
            handled: true,
            area: 'design',
            command: 'design-system',
            exitCode: 1,
            stderr: `[steroid-run] ❌ ${generation.error}\n`,
        };
    }

    let artifactPath = null;
    if (argv.includes('--write')) {
        if (!featureDir) {
            return {
                handled: true,
                area: 'design',
                command: 'design-system',
                exitCode: 1,
                stderr: '[steroid-run] ❌ --write requires --feature <feature>.\n',
            };
        }
        artifactPath = path.join(featureDir, 'design-system.md');
        fs.writeFileSync(artifactPath, `${generation.content.trim()}\n`);
        if (!existingRoute) {
            writeJsonFile(routeReceiptPath, {
                ...route,
                source: 'design-system',
                prompt: message,
                updatedAt: new Date().toISOString(),
            });
        }
    }

    if (argv.includes('--json')) {
        return {
            handled: true,
            area: 'design',
            command: 'design-system',
            exitCode: 0,
            stdout: `${JSON.stringify(
                {
                    stack: route.stack,
                    wrapperSkill: route.wrapperSkill,
                    sourceInputIds: route.sourceInputIds,
                    importedSourceIds: route.importedSourceIds,
                    projectName,
                    outputPath: artifactPath ? `.memory/changes/${feature}/design-system.md` : null,
                    content: generation.content,
                },
                null,
                2,
            )}\n`,
        };
    }

    if (!artifactPath) {
        return {
            handled: true,
            area: 'design',
            command: 'design-system',
            exitCode: 0,
            stdout: `${generation.content}\n`,
        };
    }

    const lines = [
        '[steroid-run] 🎨 Design System',
        `  Project: ${projectName}`,
        `  Stack: ${route.stack}`,
        `  Wrapper skill: ${route.wrapperSkill || 'none'}`,
        `  Source inputs: ${route.sourceInputIds.length > 0 ? route.sourceInputIds.join(', ') : 'none'}`,
        `  Artifact: .memory/changes/${feature}/design-system.md`,
    ];
    return {
        handled: true,
        area: 'design',
        command: 'design-system',
        exitCode: 0,
        stdout: `${lines.join('\n')}\n`,
    };
}

function handlePromptHealth(argv = [], context = {}) {
    const message = argv.slice(1).join(' ');
    if (!message) {
        return {
            handled: true,
            area: 'design',
            command: 'prompt-health',
            exitCode: 1,
            stderr: '[steroid-run] Usage: npx steroid-run prompt-health "<user message>"\n',
        };
    }

    const runtime = buildRuntimeContext(context);
    const analysis = analyzePrompt(message, inspectPromptSessionState(runtime.targetDir));
    const health = buildPromptHealth(analysis);
    const lines = [
        '[steroid-run] 📋 Prompt Health',
        `  Clarity: ${health.clarity}/5`,
        `  Completeness: ${health.completeness}/5`,
        `  Ambiguity: ${health.ambiguity}`,
        `  Complexity: ${health.complexity}`,
        `  Risk: ${health.risk}`,
        `  Multi-intent: ${health.multiIntent}`,
        `  Model sensitivity: ${health.modelSensitivity}`,
        `  Recommended action: ${health.recommendedAction}`,
    ];

    return {
        handled: true,
        area: 'design',
        command: 'prompt-health',
        exitCode: 0,
        stdout: `${lines.join('\n')}\n`,
    };
}

function handleSessionDetect(context = {}) {
    const runtime = buildRuntimeContext(context);
    const sessionState = inspectPromptSessionState(runtime.targetDir);
    const lines = [
        '[steroid-run] 🧭 Session Detection',
        `  State: ${sessionState.defaultState}`,
        `  Active feature: ${sessionState.activeFeature || 'none'}`,
        `  Latest artifact: ${sessionState.latestArtifact || 'none'}`,
        `  Known features: ${sessionState.knownFeatures.length > 0 ? sessionState.knownFeatures.join(', ') : 'none'}`,
        `  Circuit state: ${sessionState.recoveryState} (${sessionState.errorCount} errors)`,
    ];

    return {
        handled: true,
        area: 'design',
        command: 'session-detect',
        exitCode: 0,
        stdout: `${lines.join('\n')}\n`,
    };
}

function run(argv = [], context = {}) {
    const command = argv[0] || '';

    if (command === 'design-route') return handleDesignRoute(argv, context);
    if (command === 'design-prep') return handleDesignPrep(argv, context);
    if (command === 'design-system') return handleDesignSystem(argv, context);
    if (command === 'prompt-health') return handlePromptHealth(argv, context);
    if (command === 'session-detect') return handleSessionDetect(context);

    return {
        handled: false,
        command,
    };
}

module.exports = {
    canHandle,
    run,
};
