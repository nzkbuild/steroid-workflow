'use strict';

const fs = require('fs');
const path = require('path');

const { loadReviewReceipt, saveReviewReceipt } = require('../utils/receipt-loaders.cjs');
const { loadUiReviewReceipt } = require('../utils/frontend-receipt-loaders.cjs');
const { refreshUiReviewArtifacts } = require('../utils/frontend-review.cjs');

function canHandle(command) {
    return command === 'review';
}

function buildRuntimeContext(context = {}) {
    const targetDir = context.targetDir || process.cwd();
    return {
        targetDir,
        changesDir: path.join(targetDir, '.memory', 'changes'),
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

function buildReviewTemplate(feature, version) {
    return (
        `# Review Report: ${feature}\n\n` +
        `**Started:** ${new Date().toISOString()}\n\n` +
        `## Review Status\n\n` +
        `- Stage 1 (Spec): PENDING\n` +
        `- Stage 2 (Quality): PENDING\n\n` +
        `## Stage 1: Spec Compliance Review\n\n` +
        `_AI: Fill this section after reviewing code against spec.md criteria._\n\n` +
        `| # | Criterion | Status | Evidence |\n` +
        `|---|-----------|--------|----------|\n` +
        `| 1 | _from spec.md_ | _status_ | _file:line_ |\n\n` +
        `**Spec Score:** _/_ criteria verified\n` +
        `**Stage 1 Result:** PENDING\n\n` +
        `---\n\n` +
        `## Stage 2: Code Quality Review\n\n` +
        `_Blocked until Stage 1 passes._\n\n` +
        `---\n\n` +
        `_Reviewer: steroid-review v${version}_\n`
    );
}

function renderHelp() {
    return {
        handled: true,
        area: 'review',
        command: 'review',
        exitCode: 0,
        stdout:
            '\n[steroid-run] review — Two-stage review system for feature validation.\n\n' +
            'Usage:\n' +
            '  node steroid-run.cjs review spec <feature>       Stage 1: Spec compliance review\n' +
            '  node steroid-run.cjs review quality <feature>    Stage 2: Code quality review (requires Stage 1 PASS)\n' +
            '  node steroid-run.cjs review ui <feature>         Refresh frontend review receipts from current UI evidence\n' +
            '  node steroid-run.cjs review status <feature>     Show review status for a feature\n' +
            '  node steroid-run.cjs review reset <feature>      Reset review state (re-review)\n\n' +
            'Stages:\n' +
            '  Stage 1 (Spec Review)   — "Did the AI build what was requested?"\n' +
            '  Stage 2 (Quality Review) — "Is it well-built?"\n' +
            '                             Only runs after Stage 1 passes.\n' +
            '  UI Review                 — "Does the frontend evidence still look shippable?"\n\n' +
            'Output: .memory/changes/<feature>/review.md + review.json\n\n' +
            'Source: Steroid internal review flow\n',
    };
}

function getFeaturePaths(runtime, feature) {
    const featureDir = path.join(runtime.changesDir, feature);
    return {
        featureDir,
        reviewFile: path.join(featureDir, 'review.md'),
        reviewReceiptFile: path.join(featureDir, 'review.json'),
        specFile: path.join(featureDir, 'spec.md'),
        planFile: path.join(featureDir, 'plan.md'),
    };
}

function handleStatus(runtime, feature) {
    const paths = getFeaturePaths(runtime, feature);
    if (!fs.existsSync(paths.reviewFile) && !fs.existsSync(paths.reviewReceiptFile)) {
        return {
            handled: true,
            area: 'review',
            command: 'review',
            exitCode: 0,
            stdout:
                `[steroid-run] 📋 No review started for "${feature}".\n` +
                `  Run: node steroid-run.cjs review spec ${feature}\n`,
        };
    }

    const receipt = loadReviewReceipt(feature, paths.featureDir);
    const specStatus = receipt.stage1 || 'NOT RUN';
    const qualityStatus = receipt.stage2 || 'NOT RUN';
    const icons = { PASS: '✅', FAIL: '❌', PENDING: '⏳', 'NOT RUN': '○' };
    const lines = [
        `[steroid-run] 📋 Review Status for "${feature}":`,
        `  ${icons[specStatus] || '○'} Stage 1 (Spec Compliance): ${specStatus}`,
        `  ${icons[qualityStatus] || '○'} Stage 2 (Code Quality): ${qualityStatus}`,
    ];

    const uiReviewReceipt = loadUiReviewReceipt(feature, paths.featureDir);
    if (uiReviewReceipt?.status) {
        lines.push(`  ${icons[uiReviewReceipt.status] || '○'} UI Review: ${uiReviewReceipt.status}`);
    }
    if (receipt.updatedAt) {
        lines.push(`  🧾 Receipt updated: ${receipt.updatedAt}`);
    }

    if (specStatus === 'PASS' && qualityStatus === 'PASS') {
        lines.push('', '  ✅ Both stages passed. Ready for verification.');
    } else if (specStatus === 'FAIL') {
        lines.push('', `  ❌ Spec review failed. Fix issues and re-run: node steroid-run.cjs review spec ${feature}`);
    } else if (specStatus === 'PASS' && qualityStatus !== 'PASS') {
        lines.push('', `  ⏳ Spec passed. Run quality review: node steroid-run.cjs review quality ${feature}`);
    }

    return {
        handled: true,
        area: 'review',
        command: 'review',
        exitCode: 0,
        stdout: `${lines.join('\n')}\n`,
    };
}

function handleReset(runtime, feature) {
    const paths = getFeaturePaths(runtime, feature);
    const hadReviewFile = fs.existsSync(paths.reviewFile);
    const hadReviewReceipt = fs.existsSync(paths.reviewReceiptFile);

    if (hadReviewFile) {
        fs.unlinkSync(paths.reviewFile);
    }
    if (hadReviewReceipt) {
        fs.unlinkSync(paths.reviewReceiptFile);
    }

    return {
        handled: true,
        area: 'review',
        command: 'review',
        exitCode: 0,
        stdout: hadReviewFile || hadReviewReceipt
            ? `[steroid-run] 🔄 Review reset for "${feature}". Run: node steroid-run.cjs review spec ${feature}\n`
            : `[steroid-run] No review to reset for "${feature}".\n`,
    };
}

function handleSpec(runtime, feature) {
    const paths = getFeaturePaths(runtime, feature);

    if (!fs.existsSync(paths.specFile)) {
        return {
            handled: true,
            area: 'review',
            command: 'review',
            exitCode: 1,
            stderr: `[steroid-run] ❌ No spec.md found for "${feature}". Cannot run spec review without acceptance criteria.\n`,
        };
    }
    if (!fs.existsSync(paths.planFile)) {
        return {
            handled: true,
            area: 'review',
            command: 'review',
            exitCode: 1,
            stderr: `[steroid-run] ❌ No plan.md found for "${feature}". Cannot run spec review without task list.\n`,
        };
    }

    fs.mkdirSync(paths.featureDir, { recursive: true });
    fs.writeFileSync(paths.reviewFile, buildReviewTemplate(feature, runtime.version));
    saveReviewReceipt(paths.featureDir, {
        feature,
        stage1: 'PENDING',
        stage2: 'PENDING',
    });

    return {
        handled: true,
        area: 'review',
        command: 'review',
        exitCode: 0,
        stdout:
            `[steroid-run] 🔍 Stage 1: Spec Compliance Review for "${feature}"...\n\n` +
            '  The AI should now:\n' +
            `  1. Read .memory/changes/${feature}/spec.md — extract ALL acceptance criteria\n` +
            `  2. Read .memory/changes/${feature}/plan.md — extract ALL completed tasks\n` +
            '  3. For EACH criterion, grep/read the actual implementation code\n' +
            '  4. Determine status: ✅ IMPLEMENTED | ⚠️ PARTIAL | ❌ MISSING | 🔄 EXTRA\n' +
            `  5. Write findings to .memory/changes/${feature}/review.md\n\n` +
            '  Source: Steroid internal spec review rubric\n' +
            "  CRITICAL: Do NOT trust the implementer's report. Read the actual code.\n\n" +
            `[steroid-run] 📝 Review template written to .memory/changes/${feature}/review.md\n` +
            `[steroid-run] 🧾 Receipt written to .memory/changes/${feature}/review.json\n` +
            '  AI: Complete the spec review, then update Stage 1 Result to PASS or FAIL.\n',
    };
}

function handleQuality(runtime, feature) {
    const paths = getFeaturePaths(runtime, feature);

    if (!fs.existsSync(paths.reviewFile) && !fs.existsSync(paths.reviewReceiptFile)) {
        return {
            handled: true,
            area: 'review',
            command: 'review',
            exitCode: 1,
            stderr: `[steroid-run] ❌ No review started. Run Stage 1 first: node steroid-run.cjs review spec ${feature}\n`,
        };
    }

    const receipt = loadReviewReceipt(feature, paths.featureDir);
    if (receipt.stage1 !== 'PASS') {
        return {
            handled: true,
            area: 'review',
            command: 'review',
            exitCode: 1,
            stderr:
                '[steroid-run] 🚫 REVIEW GATE: Stage 1 (Spec) has not passed.\n' +
                '  Stage 2 (Quality) cannot run until Stage 1 passes.\n' +
                `  Fix spec issues and update review.md, then re-run: node steroid-run.cjs review status ${feature}\n`,
        };
    }

    return {
        handled: true,
        area: 'review',
        command: 'review',
        exitCode: 0,
        stdout:
            `[steroid-run] 🔍 Stage 2: Code Quality Review for "${feature}"...\n\n` +
            '  The AI should now:\n' +
            '  1. Review all files created/modified during this feature\n' +
            '  2. Check: Single responsibility, naming, error handling, no stubs\n' +
            '  3. Run anti-pattern scan: TODO/FIXME, empty returns, console.log-only handlers\n' +
            '  4. Categorize: 🛑 Critical | ⚠️ Important | ℹ️ Minor\n' +
            '  5. Update Stage 2 section in review.md\n\n' +
            '  Source: Steroid internal code quality rubric\n',
    };
}

function handleUi(runtime, feature) {
    const paths = getFeaturePaths(runtime, feature);
    const refreshed = refreshUiReviewArtifacts(feature, paths.featureDir, {
        refreshSource: 'review ui',
        refreshReason: 'Manual frontend review refresh requested.',
        version: runtime.version,
    });

    if (refreshed.skipped) {
        return {
            handled: true,
            area: 'review',
            command: 'review',
            exitCode: 0,
            stdout: `[steroid-run] 🎨 UI Review skipped for "${feature}".\n  Reason: ${refreshed.reason}\n`,
        };
    }

    if (!refreshed.ok) {
        return {
            handled: true,
            area: 'review',
            command: 'review',
            exitCode: 1,
            stderr: `[steroid-run] ❌ UI review failed for "${feature}".\n  Reason: ${refreshed.reason || 'Unknown UI review error.'}\n`,
        };
    }

    return {
        handled: true,
        area: 'review',
        command: 'review',
        exitCode: 0,
        stdout:
            `[steroid-run] 🎨 UI Review for "${feature}"\n` +
            `  Status: ${refreshed.status}\n` +
            `  Stack: ${refreshed.receipt?.stack || 'Unknown'}\n` +
            `  Wrapper: ${refreshed.receipt?.wrapperSkill || 'none'}\n` +
            `  Findings: ${Array.isArray(refreshed.receipt?.findings) ? refreshed.receipt.findings.length : 0}\n` +
            `  Report: .memory/changes/${feature}/ui-review.md\n` +
            `  Receipt: .memory/changes/${feature}/ui-review.json\n`,
    };
}

function run(argv = [], context = {}) {
    const sub = argv[1];
    const feature = argv[2];
    const runtime = buildRuntimeContext(context);

    if (!sub || sub === '--help') {
        return renderHelp();
    }

    if (!feature) {
        return {
            handled: true,
            area: 'review',
            command: 'review',
            exitCode: 1,
            stderr: '[steroid-run] Usage: node steroid-run.cjs review <spec|quality|status|reset> <feature>\n',
        };
    }

    if (sub === 'status') {
        return handleStatus(runtime, feature);
    }
    if (sub === 'reset') {
        return handleReset(runtime, feature);
    }
    if (sub === 'spec') {
        return handleSpec(runtime, feature);
    }
    if (sub === 'quality') {
        return handleQuality(runtime, feature);
    }
    if (sub === 'ui') {
        return handleUi(runtime, feature);
    }

    return {
        handled: true,
        area: 'review',
        command: 'review',
        exitCode: 1,
        stderr: `[steroid-run] ❌ Unknown review subcommand: "${sub}". Run: node steroid-run.cjs review --help\n`,
    };
}

module.exports = {
    buildReviewTemplate,
    canHandle,
    handleQuality,
    handleReset,
    handleSpec,
    handleStatus,
    handleUi,
    renderHelp,
    run,
};
