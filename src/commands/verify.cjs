'use strict';

const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');
const { spawnSync } = require('child_process');

const {
    GOVERNED_COMPLETION_OPTIONS,
    GOVERNED_COMPLETION_SOURCE_ARTIFACTS,
    parseChecklistStats,
    validateGovernedPhaseArtifact,
} = require('../utils/governed-artifacts.cjs');
const {
    loadExecutionReceipt,
    loadReviewReceipt,
    saveCompletionReceipt,
    saveVerifyReceipt,
} = require('../utils/receipt-loaders.cjs');
const {
    buildAccesslintResultFromReceipt,
    detectUiFeatureForGate,
    normalizePreviewUrlCandidate,
    refreshUiReviewArtifacts,
    summarizeBrowserAuditResult,
} = require('../utils/frontend-review.cjs');
const { auditFiles } = require('../services/audit/accesslint-audit.cjs');

function canHandle(command) {
    return command === 'verify-feature';
}

function buildRuntimeContext(context = {}) {
    const targetDir = context.targetDir || process.cwd();
    return {
        targetDir,
        changesDir: path.join(targetDir, '.memory', 'changes'),
        spawn: context.spawn || spawnSync,
        browserAudit: context.browserAudit || null,
        accesslintAudit: context.accesslintAudit || null,
        version: context.version || loadPackageVersion(targetDir),
    };
}

function loadPackageVersion(targetDir) {
    const pkgPath = path.join(targetDir, 'package.json');
    if (!fs.existsSync(pkgPath)) {
        return '7.0.0-beta.1';
    }

    try {
        const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
        return typeof pkg.version === 'string' ? pkg.version : '7.0.0-beta.1';
    } catch {
        return '7.0.0-beta.1';
    }
}

function buildFeaturePaths(runtime, feature) {
    const featureDir = path.join(runtime.changesDir, feature);
    const planFile = path.join(featureDir, 'plan.md');
    const tasksFile = path.join(featureDir, 'tasks.md');
    const diagnosisFile = path.join(featureDir, 'diagnosis.md');
    const executionFile = fs.existsSync(planFile) ? planFile : fs.existsSync(diagnosisFile) ? diagnosisFile : null;
    return {
        featureDir,
        planFile,
        tasksFile,
        diagnosisFile,
        executionFile,
        executionLabel: executionFile === diagnosisFile ? 'diagnosis.md' : 'plan.md',
        verifyMarkdown: path.join(featureDir, 'verify.md'),
        completionReceipt: path.join(featureDir, 'completion.json'),
    };
}

function formatStep(step) {
    return `- ${step.status}: ${step.step} — ${step.detail}`;
}

function writeVerifyArtifacts(paths, feature, reviewPassed, deepRequested, deepCompleted, results, hasFailure) {
    const warnCount = results.filter((entry) => entry.status === 'WARN').length;
    const status = hasFailure ? 'FAIL' : warnCount > 0 ? 'CONDITIONAL' : 'PASS';
    const verifyMd = [
        `# Verify Report: ${feature}`,
        '',
        `**Status:** ${status}`,
        `**Spec Score:** ${results.filter((entry) => entry.status === 'PASS').length}/${results.length}`,
        `**Result:** ${hasFailure ? 'Verification blocked' : 'Verification passed'}`,
        '',
        '## Checks',
        '',
        ...results.map(formatStep),
        '',
    ].join('\n');

    fs.writeFileSync(paths.verifyMarkdown, `${verifyMd}\n`);
    saveVerifyReceipt(paths.featureDir, {
        feature,
        status,
        reviewPassed,
        checks: Object.fromEntries(results.map((entry) => [entry.step, entry.status])),
        deepRequested,
        deepCompleted,
        source: 'verify.json',
    });

    return status;
}

function removeCompletionReceiptIfPresent(paths) {
    if (fs.existsSync(paths.completionReceipt)) {
        fs.unlinkSync(paths.completionReceipt);
    }
}

function runPackageScript(runtime, scriptName, timeoutMs) {
    const pkgPath = path.join(runtime.targetDir, 'package.json');
    if (!fs.existsSync(pkgPath)) return { status: 'SKIP', detail: 'No package.json found' };

    try {
        const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
        if (!pkg.scripts || !pkg.scripts[scriptName]) {
            return { status: 'SKIP', detail: `No ${scriptName} script in package.json` };
        }
        if (scriptName === 'test' && pkg.scripts.test === 'echo "Error: no test specified" && exit 1') {
            return { status: 'SKIP', detail: 'No test script in package.json' };
        }

        const result = runtime.spawn('npm', ['run', scriptName], {
            cwd: runtime.targetDir,
            stdio: 'pipe',
            timeout: timeoutMs,
            shell: true,
        });

        if (result.status === 0) {
            return { status: 'PASS', detail: `npm run ${scriptName} succeeded` };
        }

        const output = String(result.stderr || result.stdout || '')
            .trim()
            .split('\n')
            .slice(-5)
            .join('\n');

        return {
            status: scriptName === 'build' ? 'FAIL' : 'WARN',
            detail: output || `npm run ${scriptName} failed`,
        };
    } catch (error) {
        return { status: 'SKIP', detail: `package.json parse error: ${error.message}` };
    }
}

function collectAccessibilityAuditTargets(targetDir) {
    const targets = [];
    const seen = new Set();
    const roots = ['out', 'dist', 'build', 'public', '.next/server/app', '.next/server/pages', 'src'];
    const exactFiles = ['index.html'];

    const pushFile = (filePath) => {
        const absolutePath = path.resolve(filePath);
        if (!fs.existsSync(absolutePath)) return;
        if (!/\.html?$/i.test(absolutePath)) return;
        if (seen.has(absolutePath)) return;
        seen.add(absolutePath);
        targets.push(absolutePath);
    };

    const walkDir = (dirPath) => {
        for (const entry of fs.readdirSync(dirPath, { withFileTypes: true })) {
            if (entry.name.startsWith('.git') || entry.name === 'node_modules') continue;
            const fullPath = path.join(dirPath, entry.name);
            if (entry.isDirectory()) {
                walkDir(fullPath);
            } else if (entry.isFile()) {
                pushFile(fullPath);
            }
        }
    };

    for (const relativeRoot of roots) {
        const rootPath = path.join(targetDir, relativeRoot);
        if (fs.existsSync(rootPath) && fs.statSync(rootPath).isDirectory()) {
            walkDir(rootPath);
        }
    }

    for (const relativeFile of exactFiles) {
        pushFile(path.join(targetDir, relativeFile));
    }

    return targets.slice(0, 25);
}

function resolveBrowserAuditTarget(targetDir, featureDir, htmlTargets = [], options = {}) {
    const explicitUrl = normalizePreviewUrlCandidate(options.url);
    if (explicitUrl) {
        return {
            target: explicitUrl,
            source: 'verify-feature --url',
            mode: 'url',
        };
    }

    const previewUrlText = normalizePreviewUrlCandidate(readOptionalText(path.join(featureDir, 'preview-url.txt')));
    if (previewUrlText) {
        return {
            target: previewUrlText,
            source: 'preview-url.txt',
            mode: 'url',
        };
    }

    const previewUrlJson = readOptionalJson(path.join(featureDir, 'preview-url.json'));
    const previewUrlJsonValue = normalizePreviewUrlCandidate(previewUrlJson?.url);
    if (previewUrlJsonValue) {
        return {
            target: previewUrlJsonValue,
            source: 'preview-url.json',
            mode: 'url',
        };
    }

    if (htmlTargets.length > 0) {
        return {
            target: pathToFileURL(htmlTargets[0]).href,
            source: path.relative(targetDir, htmlTargets[0]) || path.basename(htmlTargets[0]),
            mode: 'file',
        };
    }

    return null;
}

function readOptionalText(filePath) {
    if (!fs.existsSync(filePath)) return '';
    try {
        return fs.readFileSync(filePath, 'utf-8');
    } catch {
        return '';
    }
}

function readOptionalJson(filePath) {
    if (!fs.existsSync(filePath)) return null;
    try {
        return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    } catch {
        return null;
    }
}

function runAccesslintStep(runtime, featureDir, designReceipt) {
    if (designReceipt?.stack === 'react-native') {
        return {
            result: {
                step: 'Accessibility (AccessLint)',
                status: 'SKIP',
                detail: 'React Native route detected; web HTML accessibility audit not applicable',
            },
            receipt: null,
            failed: false,
        };
    }

    const htmlTargets = collectAccessibilityAuditTargets(runtime.targetDir);
    if (htmlTargets.length === 0) {
        return {
            result: {
                step: 'Accessibility (AccessLint)',
                status: 'SKIP',
                detail: 'No HTML targets found in out/, dist/, build/, public/, src/, or index.html',
            },
            receipt: null,
            failed: false,
        };
    }

    try {
        const parsed = runtime.accesslintAudit
            ? runtime.accesslintAudit({ files: htmlTargets, cwd: runtime.targetDir })
            : auditFiles(htmlTargets, { cwd: runtime.targetDir });
        fs.writeFileSync(path.join(featureDir, 'accessibility.json'), JSON.stringify(parsed, null, 2));
        const summary = buildAccesslintResultFromReceipt(parsed);
        return {
            result: {
                step: 'Accessibility (AccessLint)',
                status: summary.status,
                detail: summary.detail,
            },
            receipt: parsed,
            failed: summary.status === 'FAIL',
        };
    } catch (error) {
        return {
            result: {
                step: 'Accessibility (AccessLint)',
                status: 'WARN',
                detail: error.message || 'AccessLint runner failed',
            },
            receipt: null,
            failed: false,
        };
    }
}

function runBrowserAuditStep(runtime, featureDir, promptReceipt, designReceipt, previewUrl) {
    const step = 'Deep scan: Playwright UI audit';
    const browserAuditArtifact = path.join(featureDir, 'ui-audit.json');
    const browserAuditScreenshot = path.join(featureDir, 'ui-audit.png');
    const browserAuditEligible = detectUiFeatureForGate(featureDir, promptReceipt);

    if (!browserAuditEligible || designReceipt?.stack === 'react-native') {
        return {
            result: {
                step,
                status: 'SKIP',
                detail: 'Browser UI audit is only applicable to web UI routes',
            },
            failed: false,
        };
    }

    const htmlTargets = collectAccessibilityAuditTargets(runtime.targetDir);
    const browserTarget = resolveBrowserAuditTarget(runtime.targetDir, featureDir, htmlTargets, { url: previewUrl });
    if (!browserTarget) {
        return {
            result: {
                step,
                status: 'SKIP',
                detail: 'No preview URL or local HTML target available for browser audit',
            },
            failed: false,
        };
    }

    try {
        const parsed = runtime.browserAudit
            ? runtime.browserAudit({
                  target: browserTarget.target,
                  cwd: runtime.targetDir,
                  screenshotPath: browserAuditScreenshot,
              })
            : runBrowserAuditViaService(runtime, browserTarget.target, browserAuditScreenshot);

        if (parsed.skipped) {
            return {
                result: {
                    step,
                    status: 'SKIP',
                    detail: parsed.reason || 'Browser audit skipped',
                },
                failed: false,
            };
        }

        parsed.auditSource = browserTarget.source;
        parsed.auditMode = browserTarget.mode;
        fs.writeFileSync(browserAuditArtifact, JSON.stringify(parsed, null, 2));
        const summary = summarizeBrowserAuditResult(parsed);
        return {
            result: {
                step,
                status: summary.status,
                detail: summary.detail,
            },
            failed: summary.status === 'FAIL',
        };
    } catch (error) {
        return {
            result: {
                step,
                status: 'WARN',
                detail: error.message || 'Browser audit runner failed',
            },
            failed: false,
        };
    }
}

function runBrowserAuditViaService(runtime, target, screenshotPath) {
    const servicePath = path.join(__dirname, '..', 'services', 'audit', 'browser-audit.cjs');
    const localPlaywrightEntrypoint = path.join(runtime.targetDir, 'node_modules', 'playwright', 'index.js');
    const outcome = runtime.spawn(
        process.execPath,
        [servicePath, target, '--json', '--screenshot', screenshotPath],
        {
            cwd: runtime.targetDir,
            stdio: 'pipe',
            encoding: 'utf-8',
            timeout: 120000,
            env: {
                ...process.env,
                STEROID_PLAYWRIGHT_PATH: fs.existsSync(localPlaywrightEntrypoint)
                    ? localPlaywrightEntrypoint
                    : path.join(runtime.targetDir, 'node_modules', 'playwright'),
            },
        },
    );

    if (outcome.error) {
        throw outcome.error;
    }

    const stdout = String(outcome.stdout || '{}').trim();
    if (!stdout) {
        throw new Error('Browser audit returned no output');
    }

    return JSON.parse(stdout);
}

function runOptionalDeepScans(runtime) {
    const pkgPath = path.join(runtime.targetDir, 'package.json');
    const scans = [
        {
            step: 'Deep scan: knip',
            shouldRun: fs.existsSync(pkgPath),
            args: ['--no-install', 'knip', '--no-exit-code', '--reporter', 'compact'],
            pass: 'knip completed',
            fail: 'knip reported issues or could not run',
        },
        {
            step: 'Deep scan: madge',
            shouldRun: fs.existsSync(path.join(runtime.targetDir, 'src')),
            args: ['--no-install', 'madge', '--circular', 'src'],
            pass: 'madge completed',
            fail: 'madge reported circular dependencies or could not run',
        },
        {
            step: 'Deep scan: gitleaks',
            shouldRun: true,
            args: ['--no-install', '@ziul285/gitleaks', 'detect', '--no-git', '--source', '.'],
            pass: 'gitleaks completed',
            fail: 'gitleaks reported findings or could not run',
        },
        {
            step: 'Deep scan: license-checker',
            shouldRun: fs.existsSync(pkgPath),
            args: ['--no-install', 'license-checker', '--summary'],
            pass: 'license-checker completed',
            fail: 'license-checker reported issues or could not run',
        },
    ];

    return scans.map((scan) => {
        if (!scan.shouldRun) {
            return {
                step: scan.step,
                status: 'SKIP',
                detail: 'Not applicable for this project',
            };
        }

        const outcome = runtime.spawn('npx', scan.args, {
            cwd: runtime.targetDir,
            stdio: 'pipe',
            timeout: 120000,
            shell: true,
        });

        if (outcome.status === 0) {
            return {
                step: scan.step,
                status: 'PASS',
                detail: scan.pass,
            };
        }

        const detail =
            String(outcome.stderr || outcome.stdout || '')
                .trim()
                .split('\n')
                .slice(-5)
                .join('\n') || scan.fail;
        return {
            step: scan.step,
            status: 'WARN',
            detail,
        };
    });
}

function runMemoryFreshnessStep(runtime, feature) {
    const techStackFile = path.join(runtime.targetDir, '.memory', 'knowledge', 'tech-stack.json');
    if (!fs.existsSync(techStackFile)) {
        return {
            step: 'Memory freshness',
            status: 'WARN',
            detail: `tech-stack.json not found. Run: node steroid-run.cjs scan ${feature}`,
        };
    }

    try {
        const techStack = JSON.parse(fs.readFileSync(techStackFile, 'utf-8'));
        const unknowns = ['language', 'framework', 'packageManager'].filter(
            (key) => techStack[key] === 'Unknown' || !techStack[key],
        );
        if (unknowns.length > 0) {
            return {
                step: 'Memory freshness',
                status: 'WARN',
                detail: `tech-stack.json has Unknown values: ${unknowns.join(', ')}. Run: node steroid-run.cjs scan ${feature} --force`,
            };
        }
        return {
            step: 'Memory freshness',
            status: 'PASS',
            detail: 'tech-stack.json populated',
        };
    } catch (error) {
        return {
            step: 'Memory freshness',
            status: 'WARN',
            detail: `tech-stack.json parse error: ${error.message}`,
        };
    }
}

function run(argv = [], context = {}) {
    const feature = argv[1];
    if (!feature) {
        return {
            handled: true,
            area: 'verify',
            command: 'verify-feature',
            exitCode: 1,
            stderr: '[steroid-run] Usage: npx steroid-run verify-feature <feature> [--deep] [--url <preview>]\n',
        };
    }

    const previewUrlFlagIndex = argv.indexOf('--url');
    const previewUrl = previewUrlFlagIndex !== -1 && argv[previewUrlFlagIndex + 1] ? argv[previewUrlFlagIndex + 1] : '';
    if (previewUrlFlagIndex !== -1 && !previewUrl) {
        return {
            handled: true,
            area: 'verify',
            command: 'verify-feature',
            exitCode: 1,
            stderr: '[steroid-run] ❌ --url requires an http(s) preview URL.\n',
        };
    }
    if (previewUrlFlagIndex !== -1 && !normalizePreviewUrlCandidate(previewUrl)) {
        return {
            handled: true,
            area: 'verify',
            command: 'verify-feature',
            exitCode: 1,
            stderr: '[steroid-run] ❌ --url must be a valid http(s) URL or hostname.\n',
        };
    }

    const runtime = buildRuntimeContext(context);
    const paths = buildFeaturePaths(runtime, feature);
    const deepMode = argv.includes('--deep');

    if (!paths.executionFile) {
        return {
            handled: true,
            area: 'verify',
            command: 'verify-feature',
            exitCode: 1,
            stderr: '[steroid-run] ❌ No plan.md or diagnosis.md found. Complete the engine or diagnose phase first.\n',
        };
    }

    const normalizedPreviewUrl = normalizePreviewUrlCandidate(previewUrl);
    if (normalizedPreviewUrl) {
        fs.writeFileSync(path.join(paths.featureDir, 'preview-url.txt'), `${normalizedPreviewUrl}\n`);
    }

    const results = [];
    let hasFailure = false;
    const reviewReceipt = loadReviewReceipt(feature, paths.featureDir);
    const reviewPassed = reviewReceipt.stage1 === 'PASS' && reviewReceipt.stage2 === 'PASS';
    const promptReceipt = readOptionalJson(path.join(paths.featureDir, 'prompt.json'));
    const designReceipt = readOptionalJson(path.join(paths.featureDir, 'design-routing.json'));

    if (!reviewPassed) {
        results.push({
            step: 'Review gate',
            status: 'FAIL',
            detail: `review.json requires Stage 1 PASS and Stage 2 PASS (got ${reviewReceipt.stage1}/${reviewReceipt.stage2})`,
        });
        hasFailure = true;
    } else {
        results.push({
            step: 'Review gate',
            status: 'PASS',
            detail: `Two-stage review passed (${reviewReceipt.stage1}/${reviewReceipt.stage2})`,
        });
    }

    const executionContent = fs.readFileSync(paths.executionFile, 'utf-8');
    if (paths.executionLabel === 'plan.md') {
        const executionReceipt = loadExecutionReceipt(feature, paths.featureDir);
        const missingConsumedArtifacts = ['plan.md', 'tasks.md'].filter(
            (artifact) => !executionReceipt.consumedArtifacts.includes(artifact),
        );

        if (!fs.existsSync(paths.tasksFile)) {
            results.push({
                step: 'Execution artifacts',
                status: 'FAIL',
                detail: 'tasks.md is missing for the governed engine path',
            });
            hasFailure = true;
        } else if (!executionReceipt.status) {
            results.push({
                step: 'Execution artifacts',
                status: 'FAIL',
                detail: 'execution.json is missing or malformed for the governed engine path',
            });
            hasFailure = true;
        } else if (executionReceipt.status !== 'COMPLETE') {
            results.push({
                step: 'Execution artifacts',
                status: 'FAIL',
                detail: `execution.json requires status COMPLETE before verification (got ${executionReceipt.status})`,
            });
            hasFailure = true;
        } else if (missingConsumedArtifacts.length > 0) {
            results.push({
                step: 'Execution artifacts',
                status: 'FAIL',
                detail: `execution.json must record consumed_artifacts plan.md and tasks.md (missing ${missingConsumedArtifacts.join(', ')})`,
            });
            hasFailure = true;
        } else {
            results.push({
                step: 'Execution artifacts',
                status: 'PASS',
                detail: 'tasks.md and execution.json are present for the governed engine path',
            });
        }

        const governedPlanShape = validateGovernedPhaseArtifact('plan.md', executionContent);
        if (!governedPlanShape.ok) {
            results.push({
                step: 'Plan structure',
                status: 'FAIL',
                detail: `plan.md is missing governed structure. ${governedPlanShape.reason}`,
            });
            hasFailure = true;
        } else {
            results.push({
                step: 'Plan structure',
                status: 'PASS',
                detail: 'plan.md preserves the governed implementation plan structure',
            });
        }

        const { total, done } = parseChecklistStats(executionContent);
        if (done < total) {
            results.push({
                step: 'Plan completeness',
                status: 'FAIL',
                detail: `${done}/${total} tasks complete in plan.md`,
            });
            hasFailure = true;
        } else {
            results.push({
                step: 'Plan completeness',
                status: 'PASS',
                detail: `${done}/${total} tasks complete in plan.md`,
            });
        }
    } else {
        const governedDiagnosisShape = validateGovernedPhaseArtifact('diagnosis.md', executionContent);
        if (!governedDiagnosisShape.ok) {
            results.push({
                step: 'Diagnosis structure',
                status: 'FAIL',
                detail: `diagnosis.md is missing governed structure. ${governedDiagnosisShape.reason}`,
            });
            hasFailure = true;
        } else {
            results.push({
                step: 'Diagnosis structure',
                status: 'PASS',
                detail: 'diagnosis.md preserves the governed targeted-fix structure',
            });
        }
    }

    const build = runPackageScript(runtime, 'build', 120000);
    results.push({ step: 'Build', ...build });
    if (build.status === 'FAIL') hasFailure = true;

    const lint = runPackageScript(runtime, 'lint', 60000);
    results.push({ step: 'Lint', ...lint });

    const test = runPackageScript(runtime, 'test', 120000);
    results.push({ step: 'Tests', ...test });

    const accesslint = runAccesslintStep(runtime, paths.featureDir, designReceipt);
    results.push(accesslint.result);
    if (accesslint.failed) hasFailure = true;

    results.push(runMemoryFreshnessStep(runtime, feature));

    if (deepMode) {
        const browserAudit = runBrowserAuditStep(
            runtime,
            paths.featureDir,
            promptReceipt,
            designReceipt,
            normalizedPreviewUrl,
        );
        results.push(browserAudit.result);
        if (browserAudit.failed) hasFailure = true;

        for (const scanResult of runOptionalDeepScans(runtime)) {
            results.push(scanResult);
        }
    }

    const verifyStatus = writeVerifyArtifacts(paths, feature, reviewPassed, deepMode, deepMode, results, hasFailure);

    const uiReviewRefresh = refreshUiReviewArtifacts(feature, paths.featureDir, {
        verifyStatus,
        deepMode,
        previewUrl: normalizedPreviewUrl || undefined,
        refreshSource: 'verify-feature',
        version: runtime.version,
    });

    if (hasFailure) {
        removeCompletionReceiptIfPresent(paths);
        return {
            handled: true,
            area: 'verify',
            command: 'verify-feature',
            exitCode: 1,
            stderr: `${results.filter((entry) => entry.status === 'FAIL').map(formatStep).join('\n')}\n`,
        };
    }

    saveCompletionReceipt(paths.featureDir, {
        feature,
        status: verifyStatus,
        sourceArtifacts: [...GOVERNED_COMPLETION_SOURCE_ARTIFACTS],
        nextActions: ['archive'],
        options: [...GOVERNED_COMPLETION_OPTIONS],
        source: 'completion.json',
        summary:
            verifyStatus === 'CONDITIONAL'
                ? 'Verification completed with cautions. Completion flow may continue with explicit acceptance of remaining risk.'
                : 'Verification completed successfully. Feature is ready for archive.',
    });

    const lines = [...results.map(formatStep)];
    if (uiReviewRefresh.ok && !uiReviewRefresh.skipped) {
        lines.push('- PASS: UI Review — refreshed from current verification evidence');
    } else if (uiReviewRefresh.skipped) {
        lines.push(`- SKIP: UI Review — ${uiReviewRefresh.reason}`);
    }

    return {
        handled: true,
        area: 'verify',
        command: 'verify-feature',
        exitCode: 0,
        stdout: `${lines.join('\n')}\n`,
    };
}

module.exports = {
    buildRuntimeContext,
    canHandle,
    collectAccessibilityAuditTargets,
    resolveBrowserAuditTarget,
    run,
};
