#!/usr/bin/env node
'use strict';

/**
 * check-consistency.js — catches repo drift across version strings, banner text,
 * and key behavioral assertions in docs/tests.
 */
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf-8'));
const lock = JSON.parse(fs.readFileSync(path.join(root, 'package-lock.json'), 'utf-8'));
const cliSource = fs.readFileSync(path.join(root, 'bin', 'cli.js'), 'utf-8');
const runtimeSource = fs.readFileSync(path.join(root, 'bin', 'steroid-run.cjs'), 'utf-8');
const smokeSource = fs.readFileSync(path.join(root, 'test', 'smoke.test.cjs'), 'utf-8');
const unitSource = fs.readFileSync(path.join(root, 'test', 'unit', 'v6-commands.test.cjs'), 'utf-8');
const readmeSource = fs.readFileSync(path.join(root, 'README.md'), 'utf-8');
const architectureSource = fs.readFileSync(path.join(root, 'ARCHITECTURE.md'), 'utf-8');
const engineSkillSource = fs.readFileSync(path.join(root, 'skills', 'steroid-engine', 'SKILL.md'), 'utf-8');
const verifySkillSource = fs.readFileSync(path.join(root, 'skills', 'steroid-verify', 'SKILL.md'), 'utf-8');
const ciSource = fs.readFileSync(path.join(root, '.github', 'workflows', 'ci.yml'), 'utf-8');
const changelogSource = fs.readFileSync(path.join(root, 'CHANGELOG.md'), 'utf-8');

const failures = [];

function check(condition, message) {
    if (!condition) failures.push(message);
}

const runtimeVersionMatch = runtimeSource.match(/\*\s+@version\s+([0-9]+\.[0-9]+\.[0-9]+)/);
check(runtimeVersionMatch, 'Missing @version header in bin/steroid-run.cjs.');
if (runtimeVersionMatch) {
    check(
        runtimeVersionMatch[1] === pkg.version,
        `Runtime header version ${runtimeVersionMatch[1]} does not match package.json ${pkg.version}.`,
    );
}

const runtimeFallbackMatch = runtimeSource.match(/let SW_VERSION = '([0-9]+\.[0-9]+\.[0-9]+)';/);
check(runtimeFallbackMatch, 'Missing SW_VERSION fallback in bin/steroid-run.cjs.');
if (runtimeFallbackMatch) {
    check(
        runtimeFallbackMatch[1] === pkg.version,
        `Runtime SW_VERSION ${runtimeFallbackMatch[1]} does not match package.json ${pkg.version}.`,
    );
}

check(
    lock.version === pkg.version,
    `package-lock.json version ${lock.version} does not match package.json ${pkg.version}.`,
);
check(
    lock.packages && lock.packages[''] && lock.packages[''].version === pkg.version,
    `package-lock.json root package version ${lock.packages?.['']?.version} does not match package.json ${pkg.version}.`,
);

const latestChangelogMatch = changelogSource.match(/^## \[([0-9]+\.[0-9]+\.[0-9]+)\]/m);
check(latestChangelogMatch, 'CHANGELOG.md should contain a semver release heading.');
if (latestChangelogMatch) {
    check(
        latestChangelogMatch[1] === pkg.version,
        `Latest CHANGELOG.md release ${latestChangelogMatch[1]} does not match package.json ${pkg.version}.`,
    );
}

const ideConfigsBlockMatch = cliSource.match(/const ideConfigs = \[(.*?)\n\];/s);
check(ideConfigsBlockMatch, 'Could not find ideConfigs array in bin/cli.js.');
if (ideConfigsBlockMatch) {
    const ideCount = (ideConfigsBlockMatch[1].match(/label:/g) || []).length;
    check(
        cliSource.includes('const ideConfigCount = ideConfigs.length;'),
        'bin/cli.js should derive ideConfigCount from ideConfigs.length.',
    );
    check(
        !cliSource.includes('5 IDE configs injected'),
        'bin/cli.js still contains hardcoded "5 IDE configs injected" text.',
    );
    check(ideCount >= 1, 'ideConfigs array appears to be empty.');
}

check(
    runtimeSource.includes('verify-feature <feature> [--deep]'),
    'bin/steroid-run.cjs help text should advertise verify-feature [--deep].',
);
check(
    cliSource.includes('verify-feature <feature> [--deep]'),
    'bin/cli.js Maestro rules should advertise verify-feature [--deep].',
);
check(
    architectureSource.includes('verify-feature <feature> [--deep]'),
    'ARCHITECTURE.md should document verify-feature [--deep].',
);
check(
    runtimeSource.includes('archive <feature>                 Archive completed feature (requires verify.json)'),
    'bin/steroid-run.cjs help text should mention archive requires verify.json.',
);
check(
    runtimeSource.includes('review status <feature>           Show review stage status and sync review.json'),
    'bin/steroid-run.cjs help text should mention review status syncs review.json.',
);
check(
    runtimeSource.includes('review.json requires Stage 1 PASS and Stage 2 PASS'),
    'bin/steroid-run.cjs should enforce the review receipt gate before verification.',
);
check(
    runtimeSource.includes('ARCHIVE BLOCKED: No verify.json receipt found.'),
    'bin/steroid-run.cjs should block archive when verify.json is missing.',
);

check(
    !smokeSource.includes('command guard blocks: rm (unknown command)'),
    'Smoke tests still describe rm as an unknown blocked command.',
);
check(unitSource.includes('allowlist allows rm command'), 'Unit tests should assert rm remains allowlisted.');

check(readmeSource.includes('Optional Deep Verification'), 'README.md should describe optional deep verification.');
check(readmeSource.includes('verify.json'), 'README.md should mention machine-readable verification receipts.');
check(architectureSource.includes('review.json'), 'ARCHITECTURE.md should mention review.json.');
check(architectureSource.includes('verify.json'), 'ARCHITECTURE.md should mention verify.json.');
check(engineSkillSource.includes('verify.json'), 'skills/steroid-engine/SKILL.md should mention verify.json receipts.');
check(verifySkillSource.includes('verify.json'), 'skills/steroid-verify/SKILL.md should mention verify.json receipts.');
check(
    verifySkillSource.includes('optional deep scans'),
    'skills/steroid-verify/SKILL.md should mention optional deep scans.',
);

check(
    pkg.scripts && pkg.scripts['check:consistency'] === 'node scripts/check-consistency.js',
    'package.json should expose npm run check:consistency.',
);
check(
    typeof pkg.scripts?.lint === 'string' && pkg.scripts.lint.includes('eslint'),
    'package.json should expose an eslint-based lint script.',
);
check(
    typeof pkg.scripts?.['format:check'] === 'string' && pkg.scripts['format:check'].includes('prettier --check'),
    'package.json should expose a prettier-based format:check script.',
);
check(ciSource.includes('windows-latest'), 'CI should run on windows-latest.');
check(ciSource.includes('ubuntu-latest'), 'CI should run on ubuntu-latest.');
check(ciSource.includes('npm ci'), 'CI should install dependencies with npm ci.');
check(ciSource.includes('npm run check:consistency'), 'CI should run the consistency check before tests.');
check(ciSource.includes('npm run lint'), 'CI should run npm run lint.');
check(ciSource.includes('npm run format:check'), 'CI should run npm run format:check.');

if (failures.length > 0) {
    console.error('\n[consistency] FAIL\n');
    for (const failure of failures) {
        console.error(`- ${failure}`);
    }
    process.exit(1);
}

console.log('[consistency] PASS');
