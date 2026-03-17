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
const designRoutingSource = fs.readFileSync(path.join(root, 'src', 'utils', 'design-routing.cjs'), 'utf-8');
const importedManifest = JSON.parse(fs.readFileSync(path.join(root, 'imported', 'imported-manifest.json'), 'utf-8'));
const readmeSource = fs.readFileSync(path.join(root, 'README.md'), 'utf-8');
const architectureSource = fs.readFileSync(path.join(root, 'ARCHITECTURE.md'), 'utf-8');
const researchSkillSource = fs.readFileSync(path.join(root, 'skills', 'steroid-research', 'SKILL.md'), 'utf-8');
const architectSkillSource = fs.readFileSync(path.join(root, 'skills', 'steroid-architect', 'SKILL.md'), 'utf-8');
const engineSkillSource = fs.readFileSync(path.join(root, 'skills', 'steroid-engine', 'SKILL.md'), 'utf-8');
const verifySkillSource = fs.readFileSync(path.join(root, 'skills', 'steroid-verify', 'SKILL.md'), 'utf-8');
const designOrchestratorSource = fs.readFileSync(
    path.join(root, 'skills', 'steroid-design-orchestrator', 'SKILL.md'),
    'utf-8',
);
const ciSource = fs.readFileSync(path.join(root, '.github', 'workflows', 'ci.yml'), 'utf-8');
const changelogSource = fs.readFileSync(path.join(root, 'CHANGELOG.md'), 'utf-8');

const failures = [];

function check(condition, message) {
    if (!condition) failures.push(message);
}

const SEMVER_PATTERN = '([0-9]+\\.[0-9]+\\.[0-9]+(?:-[0-9A-Za-z.-]+)?)';

const runtimeVersionMatch = runtimeSource.match(new RegExp(`\\*\\s+@version\\s+${SEMVER_PATTERN}`));
check(runtimeVersionMatch, 'Missing @version header in bin/steroid-run.cjs.');
if (runtimeVersionMatch) {
    check(
        runtimeVersionMatch[1] === pkg.version,
        `Runtime header version ${runtimeVersionMatch[1]} does not match package.json ${pkg.version}.`,
    );
}

const runtimeFallbackMatch = runtimeSource.match(new RegExp(`let SW_VERSION = '${SEMVER_PATTERN}';`));
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
check(Array.isArray(importedManifest.sources), 'imported/imported-manifest.json should define a sources array.');
check(importedManifest.sources.length === 9, 'imported/imported-manifest.json should track 9 imported sources.');
for (const source of importedManifest.sources || []) {
    check(source.id, 'Each imported source should define an id.');
    check(source.localPath, `Imported source ${source.id || '(missing id)'} should define localPath.`);
    if (source.localPath) {
        check(fs.existsSync(path.join(root, source.localPath)), `Imported source path missing: ${source.localPath}`);
    }
}

const latestChangelogMatch = changelogSource.match(new RegExp(`^## \\[${SEMVER_PATTERN}\\]`, 'm'));
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
    runtimeSource.includes('verify-feature <feature> [--deep] [--url <preview>]'),
    'bin/steroid-run.cjs help text should advertise verify-feature --url support.',
);
check(
    runtimeSource.includes('review ui <feature>'),
    'bin/steroid-run.cjs help text should mention review ui <feature>.',
);
check(
    runtimeSource.includes('normalize-prompt "<message>"'),
    'bin/steroid-run.cjs help text should advertise normalize-prompt.',
);
check(runtimeSource.includes('design-prep "<message>"'), 'bin/steroid-run.cjs help text should advertise design-prep.');
check(
    runtimeSource.includes('design-route "<message>"'),
    'bin/steroid-run.cjs help text should advertise design-route.',
);
check(
    runtimeSource.includes('design-system "<message>"'),
    'bin/steroid-run.cjs help text should advertise design-system.',
);
check(
    runtimeSource.includes('prompt-health "<message>"'),
    'bin/steroid-run.cjs help text should advertise prompt-health.',
);
check(runtimeSource.includes('session-detect'), 'bin/steroid-run.cjs help text should advertise session-detect.');
check(
    cliSource.includes('verify-feature <feature> [--deep]'),
    'bin/cli.js Maestro rules should advertise verify-feature [--deep].',
);
check(
    cliSource.includes('## Prompt Intelligence'),
    'bin/cli.js Maestro rules should include the Prompt Intelligence section.',
);
check(
    cliSource.includes('prompt.md'),
    'bin/cli.js Maestro rules should mention prompt.md when prompt receipts are written.',
);
check(
    cliSource.includes('design-system.md'),
    'bin/cli.js Maestro rules should mention design-system.md for UI-intensive work.',
);
check(cliSource.includes('design-prep "<message>"'), 'bin/cli.js Maestro rules should advertise design-prep.');
check(
    cliSource.includes('accessibility.json'),
    'bin/cli.js Maestro rules should mention accessibility.json for UI verification.',
);
check(
    cliSource.includes('ui-audit.json'),
    'bin/cli.js Maestro rules should mention ui-audit.json for deep UI verification.',
);
check(cliSource.includes('ui-review.md'), 'bin/cli.js Maestro rules should mention ui-review.md for UI verification.');
check(
    cliSource.includes('ui-review.json'),
    'bin/cli.js Maestro rules should mention ui-review.json for UI verification.',
);
check(cliSource.includes('review ui <feature>'), 'bin/cli.js Maestro rules should mention review ui <feature>.');
check(cliSource.includes('--url <preview>'), 'bin/cli.js Maestro rules should mention verify-feature --url <preview>.');
check(
    cliSource.includes('Imported frontend systems installed to imported/'),
    'bin/cli.js should copy imported frontend systems into user projects.',
);
check(
    cliSource.includes('ui-ux-pro-max'),
    'bin/cli.js Maestro rules should mention the ui-ux-pro-max frontend design pairing.',
);
check(
    architectureSource.includes('verify-feature <feature> [--deep]'),
    'ARCHITECTURE.md should document verify-feature [--deep].',
);
check(
    architectureSource.includes('--url <preview>'),
    'ARCHITECTURE.md should document verify-feature --url <preview>.',
);
check(architectureSource.includes('design-prep'), 'ARCHITECTURE.md should mention design-prep.');
check(architectureSource.includes('prompt.md'), 'ARCHITECTURE.md should mention prompt.md.');
check(architectureSource.includes('design-system.md'), 'ARCHITECTURE.md should mention design-system.md.');
check(architectureSource.includes('accessibility.json'), 'ARCHITECTURE.md should mention accessibility.json.');
check(architectureSource.includes('ui-audit.json'), 'ARCHITECTURE.md should mention ui-audit.json.');
check(architectureSource.includes('ui-review.md'), 'ARCHITECTURE.md should mention ui-review.md.');
check(architectureSource.includes('ui-review.json'), 'ARCHITECTURE.md should mention ui-review.json.');
check(architectureSource.includes('review ui <feature>'), 'ARCHITECTURE.md should mention review ui <feature>.');
check(
    architectureSource.includes('ui-review.json` FAIL'),
    'ARCHITECTURE.md should mention archive blocking on ui-review.json FAIL.',
);
check(readmeSource.includes('prompt.md'), 'README.md should mention prompt.md.');
check(readmeSource.includes('design-prep'), 'README.md should mention design-prep.');
check(readmeSource.includes('design-system.md'), 'README.md should mention design-system.md.');
check(readmeSource.includes('accessibility.json'), 'README.md should mention accessibility.json.');
check(readmeSource.includes('ui-audit.json'), 'README.md should mention ui-audit.json.');
check(readmeSource.includes('ui-review.md'), 'README.md should mention ui-review.md.');
check(readmeSource.includes('ui-review.json'), 'README.md should mention ui-review.json.');
check(readmeSource.includes('review ui <feature>'), 'README.md should mention review ui <feature>.');
check(
    readmeSource.includes('archive will stay blocked'),
    'README.md should mention archive blocking on ui-review.json FAIL.',
);
check(readmeSource.includes('--url <preview>'), 'README.md should mention verify-feature --url <preview>.');
check(readmeSource.includes('ui-ux-pro-max'), 'README.md should mention the ui-ux-pro-max frontend pairing.');
check(
    pkg.files.includes('imported/'),
    'package.json files array should include imported/ so internalized sources ship with Steroid.',
);
check(
    pkg.files.includes('integrations/'),
    'package.json files array should include integrations/ so internalized integrations ship with Steroid.',
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
check(readmeSource.includes('Prompt Intelligence'), 'README.md should document Prompt Intelligence.');
check(architectureSource.includes('review.json'), 'ARCHITECTURE.md should mention review.json.');
check(architectureSource.includes('verify.json'), 'ARCHITECTURE.md should mention verify.json.');
check(architectureSource.includes('Prompt Intelligence'), 'ARCHITECTURE.md should document Prompt Intelligence.');
check(
    researchSkillSource.includes('## Design Intelligence'),
    'skills/steroid-research/SKILL.md should define Design Intelligence guidance.',
);
check(
    researchSkillSource.includes('design-prep "<normalized prompt or user request>" --feature <feature> --write'),
    'skills/steroid-research/SKILL.md should instruct UI research to use design-prep.',
);
check(
    researchSkillSource.includes('design-system --feature <feature> --write'),
    'skills/steroid-research/SKILL.md should instruct UI research to generate design-system.md.',
);
check(
    researchSkillSource.includes('auto-bootstraps'),
    'skills/steroid-research/SKILL.md should document research gate auto-bootstrap behavior.',
);
check(
    architectSkillSource.includes('## Frontend Design Quality'),
    'skills/steroid-architect/SKILL.md should define Frontend Design Quality tasks.',
);
check(
    architectSkillSource.includes('design-system.md'),
    'skills/steroid-architect/SKILL.md should mention design-system.md.',
);
check(
    engineSkillSource.includes('## Frontend Design Discipline'),
    'skills/steroid-engine/SKILL.md should define Frontend Design Discipline.',
);
check(
    engineSkillSource.includes('design-system.md'),
    'skills/steroid-engine/SKILL.md should mention design-system.md.',
);
check(
    designOrchestratorSource.includes('imported/ui-ux-pro-max/'),
    'skills/steroid-design-orchestrator/SKILL.md should reference imported design sources.',
);
check(engineSkillSource.includes('verify.json'), 'skills/steroid-engine/SKILL.md should mention verify.json receipts.');
check(verifySkillSource.includes('verify.json'), 'skills/steroid-verify/SKILL.md should mention verify.json receipts.');
check(
    verifySkillSource.includes('accessibility.json'),
    'skills/steroid-verify/SKILL.md should mention accessibility.json receipts.',
);
check(
    verifySkillSource.includes('ui-audit.json'),
    'skills/steroid-verify/SKILL.md should mention ui-audit.json receipts.',
);
check(
    verifySkillSource.includes('ui-review.md'),
    'skills/steroid-verify/SKILL.md should mention ui-review.md receipts.',
);
check(
    verifySkillSource.includes('ui-review.json'),
    'skills/steroid-verify/SKILL.md should mention ui-review.json receipts.',
);
check(
    verifySkillSource.includes('review ui <feature>'),
    'skills/steroid-verify/SKILL.md should mention review ui <feature>.',
);
check(
    verifySkillSource.includes('preview-url.txt'),
    'skills/steroid-verify/SKILL.md should mention preview-url.txt receipts.',
);
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
    designRoutingSource.includes('steroid-design-orchestrator'),
    'src/utils/design-routing.cjs should route UI work through Steroid wrapper skills.',
);
check(
    designRoutingSource.includes('accesslint-core'),
    'src/utils/design-routing.cjs should include AccessLint for audit routes.',
);
check(
    runtimeSource.includes('Design Intelligence'),
    'bin/steroid-run.cjs pipeline-status should surface design intelligence details.',
);
check(runtimeSource.includes('Design Prep'), 'bin/steroid-run.cjs should expose the design-prep command.');
check(
    runtimeSource.includes('design-system.md'),
    'bin/steroid-run.cjs should recognize design-system.md as a pipeline artifact.',
);
check(
    runtimeSource.includes('Accessibility (AccessLint)'),
    'bin/steroid-run.cjs should include AccessLint verification output.',
);
check(
    runtimeSource.includes('accessibility.json'),
    'bin/steroid-run.cjs should recognize accessibility.json as an artifact.',
);
check(runtimeSource.includes('ui-audit.json'), 'bin/steroid-run.cjs should recognize ui-audit.json as an artifact.');
check(runtimeSource.includes('ui-review.md'), 'bin/steroid-run.cjs should recognize ui-review.md as an artifact.');
check(runtimeSource.includes('ui-review.json'), 'bin/steroid-run.cjs should recognize ui-review.json as an artifact.');
check(
    runtimeSource.includes('ARCHIVE BLOCKED: ui-review.json status is FAIL.'),
    'bin/steroid-run.cjs should block archive when ui-review.json status is FAIL.',
);
check(
    runtimeSource.includes('Deep scan: Playwright UI audit'),
    'bin/steroid-run.cjs should expose the Playwright UI audit deep scan.',
);
check(runtimeSource.includes('preview-url.txt'), 'bin/steroid-run.cjs should support preview-url receipts.');
check(
    runtimeSource.includes('resolvePreviewUrlFromEnvFiles'),
    'bin/steroid-run.cjs should attempt preview URL discovery from env files.',
);
check(runtimeSource.includes('DESIGN GATE BLOCKED'), 'bin/steroid-run.cjs should enforce the UI design gate.');
check(
    runtimeSource.includes('Research prep:'),
    'bin/steroid-run.cjs should auto-bootstrap UI design artifacts during research gate.',
);
check(
    fs.existsSync(path.join(root, 'integrations', 'accesslint', 'run-audit.cjs')),
    'integrations/accesslint/run-audit.cjs should exist.',
);
check(
    fs.existsSync(path.join(root, 'integrations', 'browser-audit', 'run-playwright-audit.cjs')),
    'integrations/browser-audit/run-playwright-audit.cjs should exist.',
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
