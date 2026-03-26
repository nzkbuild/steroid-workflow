'use strict';

const fs = require('fs');
const path = require('path');

const { validateGovernedPhaseArtifact } = require('../utils/governed-artifacts.cjs');
const { loadVerifyReceipt } = require('../utils/receipt-loaders.cjs');
const { loadUiReviewReceipt } = require('../utils/frontend-receipt-loaders.cjs');
const { generateHandoffReportContent } = require('../utils/handoff-report.cjs');

function canHandle(command) {
    return command === 'report';
}

function buildRuntimeContext(context = {}) {
    const targetDir = context.targetDir || process.cwd();
    const memoryDir = path.join(targetDir, '.memory');
    return {
        targetDir,
        memoryDir,
        changesDir: path.join(memoryDir, 'changes'),
        reportsDir: path.join(memoryDir, 'reports'),
        stateFile: path.join(memoryDir, 'execution_state.json'),
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

function ensureDir(dirPath) {
    fs.mkdirSync(dirPath, { recursive: true });
}

function readStateFile(stateFile) {
    if (!fs.existsSync(stateFile)) {
        return {
            error_count: 0,
            status: 'clear',
            last_error: null,
            error_history: [],
        };
    }

    try {
        return JSON.parse(fs.readFileSync(stateFile, 'utf-8'));
    } catch {
        return {
            error_count: 0,
            status: 'clear',
            last_error: null,
            error_history: [],
        };
    }
}

function readLatestFeatureArtifact(featureDir, name) {
    const activePath = path.join(featureDir, name);
    if (fs.existsSync(activePath)) {
        return fs.readFileSync(activePath, 'utf-8');
    }

    const archiveDir = path.join(featureDir, 'archive');
    if (!fs.existsSync(archiveDir)) return null;

    const archiveFiles = fs
        .readdirSync(archiveDir)
        .filter((fileName) => fileName.endsWith(name))
        .sort();

    if (archiveFiles.length === 0) return null;
    return fs.readFileSync(path.join(archiveDir, archiveFiles[archiveFiles.length - 1]), 'utf-8');
}

function createBugReport(runtime) {
    ensureDir(runtime.memoryDir);

    const reportFile = path.join(runtime.memoryDir, 'bug-report.md');
    const timestamp = new Date().toISOString();
    const state = readStateFile(runtime.stateFile);

    let report = '# Steroid Workflow Bug Report\n\n';
    report += `**Generated**: ${timestamp}\n`;
    report += `**SW_VERSION**: ${runtime.version}\n`;
    report += `**Node**: ${process.version}\n`;
    report += `**OS**: ${process.platform} ${process.arch}\n`;
    report += `**CWD**: ${runtime.targetDir}\n\n`;

    report += '## Circuit Breaker State\n\n';
    report += `- Error Count: ${state.error_count || 0}/5\n`;
    report += `- Status: ${state.status || 'clear'}\n`;
    report += `- Last Error: ${state.last_error || 'None'}\n\n`;

    if (Array.isArray(state.error_history) && state.error_history.length > 0) {
        report += '### Error History\n\n';
        state.error_history.slice(-5).forEach((entry, index) => {
            if (entry && typeof entry === 'object') {
                report += `${index + 1}. \`${entry.command || 'unknown'}\` — ${entry.error || 'no details'}\n`;
            } else {
                report += `${index + 1}. \`${String(entry)}\`\n`;
            }
        });
        report += '\n';
    }

    report += '## Memory Snapshot\n\n';

    const memoryFiles = ['vibe.md', 'spec.md', 'research.md', 'progress.md'];
    const changesPath = runtime.changesDir;
    let featureDirs = [];

    try {
        featureDirs = fs.readdirSync(changesPath).filter((entry) => fs.statSync(path.join(changesPath, entry)).isDirectory());
    } catch {
        featureDirs = [];
    }

    if (featureDirs.length > 0) {
        featureDirs.forEach((feature) => {
            report += `### Feature: \`${feature}\`\n\n`;
            memoryFiles.forEach((fileName) => {
                const filePath = path.join(changesPath, feature, fileName);
                try {
                    const content = fs.readFileSync(filePath, 'utf-8').trim();
                    const preview = content.length > 500 ? `${content.slice(0, 500)}\n...(truncated)` : content;
                    report += `#### ${fileName}\n\`\`\`\n${preview}\n\`\`\`\n\n`;
                } catch {
                    report += `#### ${fileName}\n*Not found*\n\n`;
                }
            });
        });
    } else {
        report += '*No feature folders found in .memory/changes/*\n\n';
    }

    report += '## Raw Execution State\n\n';
    report += `\`\`\`json\n${JSON.stringify(state, null, 2)}\n\`\`\`\n\n`;
    report += '## What I Expected vs What Happened\n\n';
    report += '**Expected**: (describe what you expected to happen)\n\n';
    report += '**Actual**: (describe what actually happened)\n\n';
    report += '**Steps to Reproduce**:\n1. \n2. \n3. \n\n';
    report += '---\n*Paste this file to your AI assistant or open a GitHub issue.*\n';

    fs.writeFileSync(reportFile, report);

    return {
        handled: true,
        area: 'report',
        command: 'report',
        exitCode: 0,
        stdout:
            '[steroid-run] 📋 Bug report saved to .memory/bug-report.md\n' +
            '[steroid-run] 💡 Edit the "Expected vs Actual" section, then share the file.\n',
    };
}

function handleList(runtime) {
    ensureDir(runtime.reportsDir);

    const files = fs.readdirSync(runtime.reportsDir).filter((fileName) => fileName.endsWith('.md'));
    if (files.length === 0) {
        return {
            handled: true,
            area: 'report',
            command: 'report',
            exitCode: 0,
            stdout: '[steroid-run] 📭 No handoff reports yet. Archive a feature to generate one.\n',
        };
    }

    const lines = ['', '[steroid-run] 📋 Handoff Reports', ''];
    files.forEach((fileName) => {
        const content = fs.readFileSync(path.join(runtime.reportsDir, fileName), 'utf-8');
        const statusMatch = content.match(/\*\*Status:\*\* (.+)/);
        const dateMatch = content.match(/\*\*Completed:\*\* (.+)/);
        lines.push(
            `  📄 ${fileName.replace('.md', '')} — ${statusMatch ? statusMatch[1] : 'unknown'} (${dateMatch ? dateMatch[1] : 'unknown'})`,
        );
    });

    return {
        handled: true,
        area: 'report',
        command: 'report',
        exitCode: 0,
        stdout: `${lines.join('\n')}\n`,
    };
}

function handleShow(argv, runtime) {
    const feature = argv[2];
    if (!feature) {
        return {
            handled: true,
            area: 'report',
            command: 'report',
            exitCode: 1,
            stderr: '[steroid-run] Usage: node steroid-run.cjs report show <feature>\n',
        };
    }

    const reportFile = path.join(runtime.reportsDir, `${feature}.md`);
    if (!fs.existsSync(reportFile)) {
        return {
            handled: true,
            area: 'report',
            command: 'report',
            exitCode: 1,
            stderr: `[steroid-run] ❌ No report found for "${feature}".\n`,
        };
    }

    const content = fs.readFileSync(reportFile, 'utf-8');
    return {
        handled: true,
        area: 'report',
        command: 'report',
        exitCode: 0,
        stdout: content.endsWith('\n') ? content : `${content}\n`,
    };
}

function handleGenerate(argv, runtime) {
    const feature = argv[2];
    if (!feature) {
        return {
            handled: true,
            area: 'report',
            command: 'report',
            exitCode: 1,
            stderr: '[steroid-run] Usage: node steroid-run.cjs report generate <feature>\n',
        };
    }

    const featureDir = path.join(runtime.changesDir, feature);
    if (!fs.existsSync(featureDir)) {
        return {
            handled: true,
            area: 'report',
            command: 'report',
            exitCode: 1,
            stderr: `[steroid-run] ❌ Feature "${feature}" not found at .memory/changes/${feature}/\n`,
        };
    }

    for (const governedArtifact of ['spec.md', 'plan.md']) {
        const artifactContent = readLatestFeatureArtifact(featureDir, governedArtifact);
        if (!artifactContent) continue;
        const governedShape = validateGovernedPhaseArtifact(governedArtifact, artifactContent);
        if (!governedShape.ok) {
            return {
                handled: true,
                area: 'report',
                command: 'report',
                exitCode: 1,
                stderr:
                    `[steroid-run] 🚫 REPORT BLOCKED: ${governedArtifact} is missing governed structure.\n` +
                    `  ${governedShape.reason}\n`,
            };
        }
    }

    ensureDir(runtime.reportsDir);

    const state = readStateFile(runtime.stateFile);
    const report = generateHandoffReportContent({
        feature,
        version: runtime.version,
        specContent: readLatestFeatureArtifact(featureDir, 'spec.md'),
        promptReceiptContent: readLatestFeatureArtifact(featureDir, 'prompt.json'),
        verifyContent: readLatestFeatureArtifact(featureDir, 'verify.md'),
        verifyReceipt: loadVerifyReceipt(feature, featureDir),
        planContent: readLatestFeatureArtifact(featureDir, 'plan.md'),
        reviewContent: readLatestFeatureArtifact(featureDir, 'review.md'),
        uiReviewReceipt: loadUiReviewReceipt(feature, featureDir),
        state,
    });

    fs.writeFileSync(path.join(runtime.reportsDir, `${feature}.md`), report);

    return {
        handled: true,
        area: 'report',
        command: 'report',
        exitCode: 0,
        stdout:
            `[steroid-run] 📄 Handoff report generated: .memory/reports/${feature}.md\n` +
            `  Run: node steroid-run.cjs report show ${feature}\n`,
    };
}

function run(argv = [], context = {}) {
    const runtime = buildRuntimeContext(context);
    const sub = argv[1];

    if (!sub || sub === '--help' || sub === 'bug') {
        return createBugReport(runtime);
    }

    if (sub === 'list') {
        return handleList(runtime);
    }

    if (sub === 'show') {
        return handleShow(argv, runtime);
    }

    if (sub === 'generate') {
        return handleGenerate(argv, runtime);
    }

    return {
        handled: true,
        area: 'report',
        command: 'report',
        exitCode: 1,
        stderr: `[steroid-run] ❌ Unknown report subcommand: "${sub}". Run: node steroid-run.cjs report --help\n`,
    };
}

module.exports = {
    buildRuntimeContext,
    canHandle,
    createBugReport,
    handleGenerate,
    handleList,
    handleShow,
    readLatestFeatureArtifact,
    readStateFile,
    run,
};
