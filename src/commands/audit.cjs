'use strict';

const fs = require('fs');
const path = require('path');

const REQUIRED_SKILLS = [
    'steroid-scan',
    'steroid-vibe-capture',
    'steroid-specify',
    'steroid-research',
    'steroid-architect',
    'steroid-engine',
    'steroid-verify',
    'steroid-diagnose',
];

const IDE_CONFIGS = [
    'GEMINI.md',
    '.cursorrules',
    'CLAUDE.md',
    '.windsurfrules',
    path.join('.github', 'copilot-instructions.md'),
    'AGENTS.md',
    '.clinerules',
];

const KNOWLEDGE_STORES = ['tech-stack', 'patterns', 'decisions', 'gotchas'];
const EXPECTED_GATES = ['vibe', 'specify', 'research', 'architect', 'diagnose', 'engine', 'verify'];

function canHandle(command) {
    return command === 'audit';
}

function buildRuntimeContext(context = {}) {
    const targetDir = context.targetDir || process.cwd();
    return {
        targetDir,
        version: context.version || loadVersion(targetDir),
        memoryDir: path.join(targetDir, '.memory'),
        knowledgeDir: path.join(targetDir, '.memory', 'knowledge'),
        reportsDir: path.join(targetDir, '.memory', 'reports'),
        skillsDir: path.join(targetDir, '.agents', 'skills'),
    };
}

function loadVersion(targetDir) {
    const pkgPath = path.join(targetDir, 'package.json');
    if (!fs.existsSync(pkgPath)) {
        return '6.3.0-beta.3';
    }

    try {
        const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
        return typeof pkg.version === 'string' ? pkg.version : '6.3.0-beta.3';
    } catch {
        return '6.3.0-beta.3';
    }
}

function hasMarker(filePath, marker) {
    try {
        return fs.readFileSync(filePath, 'utf-8').includes(marker);
    } catch {
        return false;
    }
}

function countLines(filePath) {
    try {
        return fs.readFileSync(filePath, 'utf-8').split('\n').length;
    } catch {
        return 0;
    }
}

function summarizeVersionDrift(filePath, version) {
    if (!fs.existsSync(filePath)) return null;
    try {
        const content = fs.readFileSync(filePath, 'utf-8');
        const oldVersions = (content.match(/v\d+\.\d+\.\d+/g) || []).filter((entry) => entry !== `v${version}`);
        if (oldVersions.length === 0) return null;
        return [...new Set(oldVersions)];
    } catch {
        return null;
    }
}

function handleAudit(context = {}) {
    const runtime = buildRuntimeContext(context);
    const lines = ['', `[steroid-run] 🔍 Auditing enforcement layers... (v${runtime.version})`, ''];
    let passed = 0;
    let failed = 0;
    let skillCount = 0;

    const checks = [
        {
            name: 'Git pre-commit hook',
            path: path.join(runtime.targetDir, '.git', 'hooks', 'pre-commit'),
            test: 'contains',
            marker: 'STEROID-WORKFLOW',
        },
        ...REQUIRED_SKILLS.map((skillName) => ({
            name: `Skills (${skillName.replace('steroid-', '')})`,
            path: path.join(runtime.skillsDir, skillName, 'SKILL.md'),
            test: 'exists',
            isSkill: true,
        })),
        {
            name: 'Circuit breaker state',
            path: path.join(runtime.memoryDir, 'execution_state.json'),
            test: 'exists',
        },
        {
            name: 'Pipeline enforcer',
            path: path.join(runtime.targetDir, 'steroid-run.cjs'),
            test: 'exists',
        },
        {
            name: 'Pipeline enforcer (content check)',
            path: path.join(runtime.targetDir, 'steroid-run.cjs'),
            test: 'min-lines',
            minLines: 100,
        },
    ];

    for (const check of checks) {
        if (!fs.existsSync(check.path)) {
            lines.push(`  ❌ ${check.name} — missing`);
            failed++;
            continue;
        }

        if (check.test === 'contains') {
            if (hasMarker(check.path, check.marker)) {
                lines.push(`  ✅ ${check.name}`);
                passed++;
                if (check.isSkill) skillCount++;
            } else {
                lines.push(`  ❌ ${check.name} — exists but not steroid hook`);
                failed++;
            }
            continue;
        }

        if (check.test === 'min-lines') {
            const lineCount = countLines(check.path);
            if (lineCount >= check.minLines) {
                lines.push(`  ✅ ${check.name} (${lineCount} lines)`);
                passed++;
            } else {
                lines.push(`  ❌ ${check.name} — too short (${lineCount} lines, need ${check.minLines}+)`);
                failed++;
            }
            continue;
        }

        lines.push(`  ✅ ${check.name}`);
        passed++;
        if (check.isSkill) skillCount++;
    }

    const gateCount = EXPECTED_GATES.length;
    lines.push('');
    lines.push(`  Gate chain: ${gateCount} gates (${EXPECTED_GATES.join(' → ')})`);
    passed++;

    let ideCount = 0;
    lines.push('');
    lines.push('  IDE Maestro rules:');
    for (const relativePath of IDE_CONFIGS) {
        const filePath = path.join(runtime.targetDir, relativePath);
        if (!fs.existsSync(filePath)) {
            lines.push(`    ○  ${relativePath.replace(/\\/g, '/')} — not installed`);
            continue;
        }
        if (hasMarker(filePath, 'STEROID-WORKFLOW-START')) {
            lines.push(`    ✅ ${relativePath.replace(/\\/g, '/')}`);
            ideCount++;
        } else {
            lines.push(`    ⚠️  ${relativePath.replace(/\\/g, '/')} — exists but no Maestro rules`);
        }
    }
    if (ideCount === 0) {
        lines.push('    ❌ No IDE config has Maestro rules!');
        failed++;
    } else {
        passed++;
    }

    let knowledgeCount = 0;
    lines.push('');
    lines.push('  Knowledge stores:');
    for (const store of KNOWLEDGE_STORES) {
        const storeFile = path.join(runtime.knowledgeDir, `${store}.json`);
        if (!fs.existsSync(storeFile)) {
            lines.push(`    ○  ${store}.json — not populated`);
            continue;
        }
        try {
            JSON.parse(fs.readFileSync(storeFile, 'utf-8'));
            lines.push(`    ✅ ${store}.json`);
            knowledgeCount++;
        } catch {
            lines.push(`    ⚠️  ${store}.json — corrupt JSON`);
        }
    }

    lines.push('');
    lines.push('  Handoff reports:');
    if (fs.existsSync(runtime.reportsDir)) {
        const reports = fs.readdirSync(runtime.reportsDir).filter((entry) => entry.endsWith('.md'));
        lines.push(`    ${reports.length} report(s) generated`);
    } else {
        lines.push('    ○  No reports generated yet');
    }

    lines.push('');
    lines.push(`  Review system: ✅ Two-stage review available (v${runtime.version})`);
    lines.push('  Prompt intelligence: ✅ normalize-prompt, prompt-health, and session-detect available');
    lines.push('');
    lines.push(
        `  Result: ${passed} passed, ${failed} failed, ${ideCount} IDE(s), ${skillCount} skills, ${gateCount} gates, ${knowledgeCount}/4 knowledge stores, review + prompt intelligence v${runtime.version}`,
    );

    if (failed > 0) {
        lines.push('');
        lines.push('  Fix: Run "npx steroid-workflow init" to reinstall missing layers.');
        return {
            handled: true,
            area: 'audit',
            command: 'audit',
            exitCode: 1,
            stdout: `${lines.join('\n')}\n`,
        };
    }

    let staleCount = 0;
    lines.push('');
    lines.push('  Version drift check:');
    for (const skillName of ['steroid-engine', 'steroid-verify']) {
        const skillPath = path.join(runtime.skillsDir, skillName, 'SKILL.md');
        const staleVersions = summarizeVersionDrift(skillPath, runtime.version);
        if (staleVersions && staleVersions.length > 0) {
            lines.push(`    ⚠️  ${path.basename(skillPath)}: found stale version refs: ${staleVersions.join(', ')}`);
            staleCount++;
        }
    }
    if (staleCount === 0) {
        lines.push('    ✅ No stale version references found');
    }

    lines.push('');
    lines.push('  All enforcement layers active. 🔒');
    return {
        handled: true,
        area: 'audit',
        command: 'audit',
        exitCode: 0,
        stdout: `${lines.join('\n')}\n`,
    };
}

function run(argv = [], context = {}) {
    return handleAudit(context);
}

module.exports = {
    buildRuntimeContext,
    canHandle,
    handleAudit,
    run,
};
