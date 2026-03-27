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
const runtimeCompatSource = fs.readFileSync(path.join(root, 'src', 'runtime', 'standalone-compat.cjs'), 'utf-8');
const smokeSource = fs.readFileSync(path.join(root, 'test', 'smoke.test.cjs'), 'utf-8');
const unitSource = fs.readFileSync(path.join(root, 'test', 'unit', 'v6-commands.test.cjs'), 'utf-8');
const designRoutingSource = fs.readFileSync(path.join(root, 'src', 'utils', 'design-routing.cjs'), 'utf-8');
const forkManifest = JSON.parse(fs.readFileSync(path.join(root, 'sources', 'forks', 'manifest.json'), 'utf-8'));
const forkDirectories = fs
    .readdirSync(path.join(root, 'sources', 'forks'), { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
const publicSourcesCatalog = JSON.parse(
    fs.readFileSync(path.join(root, 'src', 'services', 'sources', 'catalog.json'), 'utf-8'),
);
const publicSourcesPolicy = JSON.parse(
    fs.readFileSync(path.join(root, 'src', 'services', 'sources', 'policy.json'), 'utf-8'),
);
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

const runtimeVersionMatch = runtimeCompatSource.match(new RegExp(`\\*\\s+@version\\s+${SEMVER_PATTERN}`));
check(runtimeVersionMatch, 'Missing @version header in src/runtime/standalone-compat.cjs.');
if (runtimeVersionMatch) {
    check(
        runtimeVersionMatch[1] === pkg.version,
        `Runtime header version ${runtimeVersionMatch[1]} does not match package.json ${pkg.version}.`,
    );
}

const runtimeFallbackMatch = runtimeCompatSource.match(new RegExp(`let SW_VERSION = '${SEMVER_PATTERN}';`));
check(runtimeFallbackMatch, 'Missing SW_VERSION fallback in src/runtime/standalone-compat.cjs.');
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
check(Array.isArray(forkManifest.sources), 'The private source manifest should define a sources array.');
check(
    forkManifest.sources.length === forkDirectories.length,
    `The private source manifest should track every private intake directory (${forkDirectories.length} expected, got ${forkManifest.sources.length}).`,
);
check(Array.isArray(publicSourcesCatalog.sources), 'src/services/sources/catalog.json should define a sources array.');
check(
    publicSourcesPolicy.publicPackage && publicSourcesPolicy.publicPackage.allowRawUpstreamTrees === false,
    'src/services/sources/policy.json should forbid raw upstream tree shipping.',
);
for (const source of forkManifest.sources || []) {
    check(source.id, 'Each fork source should define an id.');
    check(source.localPath, `Fork source ${source.id || '(missing id)'} should define localPath.`);
    if (source.localPath) {
        check(fs.existsSync(path.join(root, source.localPath)), `Fork source path missing: ${source.localPath}`);
    }
}
const manifestForkDirectories = (forkManifest.sources || [])
    .map((source) => path.basename(source.localPath))
    .sort();
const privateForkPrefix = ['sources', 'forks'].join('/');
check(
    JSON.stringify(manifestForkDirectories) === JSON.stringify(forkDirectories),
    'The private source manifest should register every private intake directory.',
);
check(
    (publicSourcesCatalog.sources || []).some((source) => source.id === 'browser-audit'),
    'src/services/sources/catalog.json should classify the browser-audit source.',
);
check(
    (publicSourcesCatalog.sources || []).some((source) => source.id === 'steroid-design-system'),
    'src/services/sources/catalog.json should classify the Steroid design system capability.',
);
const accesslintSource = (publicSourcesCatalog.sources || []).find((source) => source.id === 'steroid-accessibility-audit');
check(accesslintSource?.localPath === 'src/services/audit/accesslint-audit.cjs', 'src/services/sources/catalog.json should point steroid-accessibility-audit at the first-party audit service.');
const browserAuditSource = (publicSourcesCatalog.sources || []).find((source) => source.id === 'browser-audit');
check(browserAuditSource?.localPath === 'src/services/audit/browser-audit.cjs', 'src/services/sources/catalog.json should point browser-audit at the first-party audit service.');

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
    runtimeCompatSource.includes('verify-feature <feature> [--deep]'),
    'bin/steroid-run.cjs help text should advertise verify-feature [--deep].',
);
check(
    runtimeCompatSource.includes('verify-feature <feature> [--deep] [--url <preview>]'),
    'bin/steroid-run.cjs help text should advertise verify-feature --url support.',
);
check(
    runtimeCompatSource.includes('review ui <feature>'),
    'bin/steroid-run.cjs help text should mention review ui <feature>.',
);
check(
    runtimeCompatSource.includes('normalize-prompt "<message>"'),
    'bin/steroid-run.cjs help text should advertise normalize-prompt.',
);
check(runtimeCompatSource.includes('design-prep "<message>"'), 'bin/steroid-run.cjs help text should advertise design-prep.');
check(
    runtimeCompatSource.includes('design-route "<message>"'),
    'bin/steroid-run.cjs help text should advertise design-route.',
);
check(
    runtimeCompatSource.includes('design-system "<message>"'),
    'bin/steroid-run.cjs help text should advertise design-system.',
);
check(
    runtimeCompatSource.includes('prompt-health "<message>"'),
    'bin/steroid-run.cjs help text should advertise prompt-health.',
);
check(runtimeCompatSource.includes('session-detect'), 'bin/steroid-run.cjs help text should advertise session-detect.');
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
    !cliSource.includes("copyRecursiveSync(path.join(sourceDir, 'imported')"),
    'bin/cli.js should no longer copy removed top-level imported trees into user projects.',
);
check(
    !cliSource.includes('.steroid/runtime/integrations/'),
    'bin/cli.js should no longer install runtime integrations under .steroid/runtime/integrations/.',
);
check(
    cliSource.includes('.steroid/runtime/src/'),
    'bin/cli.js should install runtime source under .steroid/runtime/src/.',
);
check(
    !cliSource.includes('.steroid/runtime/sources/'),
    'bin/cli.js should not install private source manifests under .steroid/runtime/sources/.',
);
check(
    cliSource.includes("const gitignoreEntries = ['.memory/', '.steroid/', 'steroid-run.cjs', '.agents/'];"),
    'bin/cli.js should gitignore the .steroid runtime asset directory.',
);
check(
    cliSource.includes('Steroid frontend intelligence'),
    'bin/cli.js Maestro rules should describe the Steroid frontend intelligence layer.',
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
check(readmeSource.includes('Frontend Intelligence'), 'README.md should present the frontend system as Steroid-owned frontend intelligence.');
check(
    readmeSource.includes('archive will stay blocked'),
    'README.md should mention archive blocking on ui-review.json FAIL.',
);
check(readmeSource.includes('--url <preview>'), 'README.md should mention verify-feature --url <preview>.');
check(
    !pkg.files.includes('imported/'),
    'package.json files array should not include removed top-level imported trees.',
);
check(
    !pkg.files.includes('integrations/'),
    'package.json files array should not include removed integrations trees now that audit logic lives in first-party services.',
);
check(
    pkg.files.includes('src/'),
    'package.json files array should include src/ for first-party runtime modules.',
);
check(
    !pkg.files.includes(`${privateForkPrefix}/`),
    'package.json files array should not include the private intake tree.',
);
check(
    !pkg.files.includes('sources/'),
    'package.json files array should not include private sources/ metadata.',
);
check(
    pkg.files.includes('src/'),
    'package.json files array should include src/ so public runtime modules ship with the package.',
);
check(!pkg.files.includes('contracts/'), 'package.json files array should not include contracts/.');
check(!pkg.files.includes('ARCHITECTURE.md'), 'package.json files array should not include ARCHITECTURE.md.');
check(
    runtimeCompatSource.includes('archive <feature>                 Archive completed feature (requires verify.json + completion.json)'),
    'bin/steroid-run.cjs help text should mention archive requires verify.json + completion.json.',
);
check(
    runtimeCompatSource.includes('scan <feature>                    Run codebase scan (writes request.json + context.md)'),
    'bin/steroid-run.cjs help text should mention scan writes request.json + context.md.',
);
check(
    runtimeCompatSource.includes(
        'verify-feature <feature> [--deep] [--url <preview>] Run verification (writes verify.md + verify.json + completion.json)',
    ),
    'bin/steroid-run.cjs help text should mention verify-feature writes completion.json.',
);
check(
    runtimeCompatSource.includes('review status <feature>           Show review stage status and sync review.json'),
    'bin/steroid-run.cjs help text should mention review status syncs review.json.',
);
check(
    runtimeCompatSource.includes('review.json requires Stage 1 PASS and Stage 2 PASS'),
    'bin/steroid-run.cjs should enforce the review receipt gate before verification.',
);
check(
    runtimeCompatSource.includes('ARCHIVE BLOCKED: No verify.json receipt found.'),
    'bin/steroid-run.cjs should block archive when verify.json is missing.',
);

check(
    !smokeSource.includes('command guard blocks: rm (unknown command)'),
    'Smoke tests still describe rm as an unknown blocked command.',
);
check(unitSource.includes('run blocks direct rm command'), 'Unit tests should assert direct rm is blocked in favor of fs-rm.');

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
    designOrchestratorSource.includes('steroid-design-system'),
    'skills/steroid-design-orchestrator/SKILL.md should reference the Steroid design source inputs.',
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
    designRoutingSource.includes('steroid-accessibility-audit'),
    'src/utils/design-routing.cjs should include the Steroid accessibility audit capability for audit routes.',
);
check(
    runtimeCompatSource.includes('Design Intelligence'),
    'bin/steroid-run.cjs pipeline-status should surface design intelligence details.',
);
check(runtimeCompatSource.includes('Design Prep'), 'bin/steroid-run.cjs should expose the design-prep command.');
check(
    runtimeCompatSource.includes('design-system.md'),
    'bin/steroid-run.cjs should recognize design-system.md as a pipeline artifact.',
);
check(
    runtimeCompatSource.includes('Accessibility (AccessLint)'),
    'bin/steroid-run.cjs should include AccessLint verification output.',
);
check(
    runtimeCompatSource.includes('accessibility.json'),
    'bin/steroid-run.cjs should recognize accessibility.json as an artifact.',
);
check(runtimeCompatSource.includes('ui-audit.json'), 'bin/steroid-run.cjs should recognize ui-audit.json as an artifact.');
check(runtimeCompatSource.includes('ui-review.md'), 'bin/steroid-run.cjs should recognize ui-review.md as an artifact.');
check(runtimeCompatSource.includes('ui-review.json'), 'bin/steroid-run.cjs should recognize ui-review.json as an artifact.');
check(
    runtimeCompatSource.includes('ARCHIVE BLOCKED: ui-review.json status is FAIL.'),
    'bin/steroid-run.cjs should block archive when ui-review.json status is FAIL.',
);
check(
    runtimeCompatSource.includes('Deep scan: Playwright UI audit'),
    'bin/steroid-run.cjs should expose the Playwright UI audit deep scan.',
);
check(runtimeCompatSource.includes('preview-url.txt'), 'bin/steroid-run.cjs should support preview-url receipts.');
check(
    runtimeCompatSource.includes("../utils/browser-audit-target.cjs") &&
        runtimeCompatSource.includes('resolveCanonicalBrowserAuditTarget'),
    'bin/steroid-run.cjs should delegate preview target discovery to the canonical browser-audit target helper.',
);
check(runtimeCompatSource.includes('DESIGN GATE BLOCKED'), 'bin/steroid-run.cjs should enforce the UI design gate.');
check(
    runtimeCompatSource.includes('Research prep:'),
    'bin/steroid-run.cjs should auto-bootstrap UI design artifacts during research gate.',
);
check(
    fs.existsSync(path.join(root, 'src', 'services', 'audit', 'accesslint-audit.cjs')),
    'src/services/audit/accesslint-audit.cjs should exist.',
);
check(
    fs.existsSync(path.join(root, 'src', 'services', 'audit', 'browser-audit.cjs')),
    'src/services/audit/browser-audit.cjs should exist.',
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
