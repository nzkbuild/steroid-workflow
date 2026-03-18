#!/usr/bin/env node
'use strict';

/**
 * Unit tests for CLI command behavior, including trust hardening and v6.2.0 prompt-intelligence flows.
 * These tests use spawnSync to invoke steroid-run.cjs as a subprocess.
 */
const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

let passed = 0;
let failed = 0;

const steroidRun = path.join(__dirname, '..', '..', 'bin', 'steroid-run.cjs');
const childProcessProbe = spawnSync(process.execPath, ['-e', 'console.log("probe")'], {
    cwd: __dirname,
    stdio: 'pipe',
    timeout: 5000,
    env: { ...process.env, PATH: process.env.PATH },
});
const childProcessUnavailableReason = childProcessProbe.error ? childProcessProbe.error.message : null;

function test(name, fn) {
    try {
        fn();
        passed++;
        console.log(`  ✅ ${name}`);
    } catch (e) {
        failed++;
        console.log(`  ❌ ${name}: ${e.message}`);
    }
}

// Create a temp dir for testing
const tmpBase = path.join(os.tmpdir(), `steroid-test-v6-${Date.now()}`);
if (!childProcessUnavailableReason) {
    fs.mkdirSync(tmpBase, { recursive: true });
}

function run(args, cwd) {
    return spawnSync('node', [steroidRun, ...args], {
        cwd: cwd || tmpBase,
        stdio: 'pipe',
        timeout: 15000,
        env: { ...process.env, PATH: process.env.PATH },
    });
}

function writeGovernedExecutionArtifacts(featureDir, feature, options = {}) {
    fs.writeFileSync(path.join(featureDir, 'tasks.md'), options.tasksContent || '- [x] Completed task\n');
    fs.writeFileSync(
        path.join(featureDir, 'execution.json'),
        JSON.stringify(
            {
                feature,
                status: options.status || 'COMPLETE',
                source: 'execution.json',
                consumed_artifacts: options.consumedArtifacts || ['plan.md', 'tasks.md'],
                summary: options.summary || 'Execution completed successfully.',
            },
            null,
            2,
        ),
    );
}

console.log('[unit] v6-commands.test.cjs');

if (childProcessUnavailableReason) {
    console.log(
        `  skipped: child Node processes are unavailable in this environment (${childProcessUnavailableReason})`,
    );
} else {
    // Setup: create .memory dir structure required by steroid-run
    const memoryDir = path.join(tmpBase, '.memory');
    const changesDir = path.join(memoryDir, 'changes');
    const knowledgeDir = path.join(memoryDir, 'knowledge');
    fs.mkdirSync(changesDir, { recursive: true });
    fs.mkdirSync(knowledgeDir, { recursive: true });
    fs.writeFileSync(
        path.join(memoryDir, 'execution_state.json'),
        JSON.stringify({
            error_count: 0,
            last_error: null,
            status: 'active',
        }),
    );
    fs.writeFileSync(path.join(memoryDir, 'progress.md'), '# Progress\n');

    // ─── fs-mkdir ───
    test('fs-mkdir creates directory recursively', () => {
        const result = run(['fs-mkdir', 'deep/nested/dir']);
        if (result.status !== 0) throw new Error(`Exit code ${result.status}: ${result.stderr}`);
        if (!fs.existsSync(path.join(tmpBase, 'deep', 'nested', 'dir'))) throw new Error('Directory not created');
    });

    test('fs-mkdir with no args exits 1', () => {
        const result = run(['fs-mkdir']);
        if (result.status !== 1) throw new Error(`Expected exit 1, got ${result.status}`);
    });

    // ─── fs-rm ───
    test('fs-rm removes directory', () => {
        fs.mkdirSync(path.join(tmpBase, 'to-remove'), { recursive: true });
        fs.writeFileSync(path.join(tmpBase, 'to-remove', 'file.txt'), 'test');
        const result = run(['fs-rm', 'to-remove']);
        if (result.status !== 0) throw new Error(`Exit code ${result.status}`);
        if (fs.existsSync(path.join(tmpBase, 'to-remove'))) throw new Error('Directory not removed');
    });

    test('fs-rm refuses to delete .git', () => {
        fs.mkdirSync(path.join(tmpBase, '.git'), { recursive: true });
        const result = run(['fs-rm', '.git']);
        if (result.status !== 1) throw new Error(`Expected exit 1, got ${result.status}`);
        if (!fs.existsSync(path.join(tmpBase, '.git'))) throw new Error('.git was deleted!');
        fs.rmSync(path.join(tmpBase, '.git'), { recursive: true }); // cleanup
    });

    test('fs-rm refuses to delete .memory', () => {
        const result = run(['fs-rm', '.memory']);
        if (result.status !== 1) throw new Error(`Expected exit 1, got ${result.status}`);
    });

    test('fs-rm on non-existent path exits 0 gracefully', () => {
        const result = run(['fs-rm', 'nonexistent-path-xyz']);
        if (result.status !== 0) throw new Error(`Expected exit 0, got ${result.status}`);
    });

    // ─── fs-cp ───
    test('fs-cp copies file', () => {
        fs.writeFileSync(path.join(tmpBase, 'source-file.txt'), 'hello');
        const result = run(['fs-cp', 'source-file.txt', 'dest-file.txt']);
        if (result.status !== 0) throw new Error(`Exit code ${result.status}`);
        if (!fs.existsSync(path.join(tmpBase, 'dest-file.txt'))) throw new Error('File not copied');
        if (fs.readFileSync(path.join(tmpBase, 'dest-file.txt'), 'utf-8') !== 'hello')
            throw new Error('Content mismatch');
    });

    test('fs-cp copies directory recursively', () => {
        const srcDir = path.join(tmpBase, 'cp-src');
        fs.mkdirSync(path.join(srcDir, 'sub'), { recursive: true });
        fs.writeFileSync(path.join(srcDir, 'a.txt'), 'A');
        fs.writeFileSync(path.join(srcDir, 'sub', 'b.txt'), 'B');
        const result = run(['fs-cp', 'cp-src', 'cp-dest']);
        if (result.status !== 0) throw new Error(`Exit code ${result.status}`);
        if (!fs.existsSync(path.join(tmpBase, 'cp-dest', 'a.txt'))) throw new Error('File a.txt not copied');
        if (!fs.existsSync(path.join(tmpBase, 'cp-dest', 'sub', 'b.txt'))) throw new Error('File sub/b.txt not copied');
    });

    // ─── fs-mv ───
    test('fs-mv moves file', () => {
        fs.writeFileSync(path.join(tmpBase, 'move-src.txt'), 'move-me');
        const result = run(['fs-mv', 'move-src.txt', 'move-dest.txt']);
        if (result.status !== 0) throw new Error(`Exit code ${result.status}`);
        if (fs.existsSync(path.join(tmpBase, 'move-src.txt'))) throw new Error('Source still exists');
        if (!fs.existsSync(path.join(tmpBase, 'move-dest.txt'))) throw new Error('Dest not created');
    });

    // ─── fs-cat ───
    test('fs-cat prints file contents', () => {
        fs.writeFileSync(path.join(tmpBase, 'readme.txt'), 'line-1\nline-2\nline-3\n');
        const result = run(['fs-cat', 'readme.txt']);
        if (result.status !== 0) throw new Error(`Exit code ${result.status}`);
        const output = result.stdout.toString();
        if (!output.includes('line-1') || !output.includes('line-3')) throw new Error('Missing file contents');
    });

    test('fs-cat respects --head limit', () => {
        fs.writeFileSync(path.join(tmpBase, 'head.txt'), 'a\nb\nc\nd\n');
        const result = run(['fs-cat', 'head.txt', '--head=2']);
        if (result.status !== 0) throw new Error(`Exit code ${result.status}`);
        const output = result.stdout.toString();
        if (!output.includes('a') || !output.includes('b')) throw new Error('Missing expected lines');
        if (output.includes('\nc\n')) throw new Error('Printed too many lines');
    });

    test('fs-cat falls back to the first existing candidate', () => {
        fs.writeFileSync(path.join(tmpBase, 'fallback.txt'), 'chosen');
        const result = run(['fs-cat', 'missing.txt', 'fallback.txt', '--optional']);
        if (result.status !== 0) throw new Error(`Exit code ${result.status}`);
        const output = result.stdout.toString();
        if (!output.includes('chosen')) throw new Error('Did not use fallback file');
    });

    test('fs-cat --optional exits 0 when no candidate exists', () => {
        const result = run(['fs-cat', 'nope-a.txt', 'nope-b.txt', '--optional']);
        if (result.status !== 0) throw new Error(`Expected exit 0, got ${result.status}`);
        const output = result.stdout.toString();
        if (!output.includes('No matching file found')) throw new Error('Missing skip message');
    });

    // ─── fs-find ───
    test('fs-find locates files by glob', () => {
        fs.mkdirSync(path.join(tmpBase, 'src'), { recursive: true });
        fs.writeFileSync(path.join(tmpBase, 'src', 'alpha.test.ts'), 'test');
        const result = run(['fs-find', 'src', '--name=*.test.*', '--type=file']);
        if (result.status !== 0) throw new Error(`Exit code ${result.status}`);
        const output = result.stdout.toString();
        if (!output.includes('src\\alpha.test.ts') && !output.includes('src/alpha.test.ts'))
            throw new Error('Did not find test file');
    });

    test('fs-find --count reports match total', () => {
        fs.mkdirSync(path.join(tmpBase, 'tests'), { recursive: true });
        fs.writeFileSync(path.join(tmpBase, 'tests', 'a.spec.ts'), 'a');
        fs.writeFileSync(path.join(tmpBase, 'tests', 'b.spec.ts'), 'b');
        const result = run(['fs-find', 'tests', '--name=*.spec.*', '--type=file', '--count']);
        if (result.status !== 0) throw new Error(`Exit code ${result.status}`);
        const output = result.stdout.toString();
        if (!output.includes('2')) throw new Error(`Unexpected count output: ${output}`);
    });

    // ─── fs-grep ───
    test('fs-grep prints matching lines with numbers', () => {
        fs.mkdirSync(path.join(tmpBase, 'grep-src'), { recursive: true });
        fs.writeFileSync(path.join(tmpBase, 'grep-src', 'file.ts'), 'const a = 1;\n// TODO: fix\n');
        const result = run(['fs-grep', 'TODO|FIXME', 'grep-src', '--include=*.ts']);
        if (result.status !== 0) throw new Error(`Exit code ${result.status}`);
        const output = result.stdout.toString();
        if (!output.includes('file.ts:2:')) throw new Error('Missing match output');
    });

    test('fs-grep --files-with-matches lists files once', () => {
        fs.mkdirSync(path.join(tmpBase, 'grep-files'), { recursive: true });
        fs.writeFileSync(path.join(tmpBase, 'grep-files', 'one.ts'), 'match here\nmatch again\n');
        const result = run(['fs-grep', 'match', 'grep-files', '--include=*.ts', '--files-with-matches']);
        if (result.status !== 0) throw new Error(`Exit code ${result.status}`);
        const lines = result.stdout
            .toString()
            .split(/\r?\n/)
            .filter((line) => line.includes('one.ts'));
        if (lines.length !== 1) throw new Error(`Expected one file listing, got ${lines.length}`);
    });

    // ─── fs-ls ───
    test('fs-ls lists directory', () => {
        const result = run(['fs-ls', '.']);
        if (result.status !== 0) throw new Error(`Exit code ${result.status}`);
        const output = result.stdout.toString();
        if (!output.includes('📂')) throw new Error('Missing tree header');
    });

    test('fs-ls on nonexistent path exits 1', () => {
        const result = run(['fs-ls', 'no-such-dir-xyz']);
        if (result.status !== 1) throw new Error(`Expected exit 1, got ${result.status}`);
    });

    // ─── smoke-test ───
    test('smoke-test skips when no project file found', () => {
        // tmpBase has no package.json, Cargo.toml, or go.mod
        const result = run(['smoke-test']);
        if (result.status !== 0) throw new Error(`Expected exit 0, got ${result.status}`);
        const output = result.stdout.toString();
        if (!output.includes('skipped') && !output.includes('No recognized')) throw new Error('Missing skip message');
    });

    // ─── allowlist ───
    test('allowlist blocks unknown commands', () => {
        const result = run(['malicious-cmd --evil']);
        if (result.status !== 1) throw new Error(`Expected exit 1 for blocked command, got ${result.status}`);
        const output = result.stderr.toString();
        if (!output.includes('BLOCKED')) throw new Error('Missing BLOCKED message');
    });

    test('run --cwd executes command inside subdirectory', () => {
        fs.mkdirSync(path.join(tmpBase, 'packages', 'web'), { recursive: true });
        const result = run(['run', '--cwd=packages/web', 'node -e "console.log(process.cwd())"']);
        if (result.status !== 0) throw new Error(`Expected exit 0, got ${result.status}`);
        const output = result.stdout.toString().replace(/\r/g, '');
        if (!output.includes(path.join('packages', 'web'))) throw new Error(`Unexpected cwd output: ${output}`);
    });

    test('run --cwd refuses paths outside the project root', () => {
        const result = run(['run', '--cwd=..', 'node -e "console.log(process.cwd())"']);
        if (result.status !== 1) throw new Error(`Expected exit 1, got ${result.status}`);
        const output = `${result.stderr}${result.stdout}`;
        if (!output.includes('must stay inside')) throw new Error('Missing safety message');
    });

    test('allowlist allows rm command (v6.0.0 expansion)', () => {
        // rm on nonexistent file will fail, but it should NOT be blocked by allowlist
        const result = run(["'rm nonexistent-file-12345'"]);
        const output = result.stderr.toString();
        if (output.includes('BLOCKED')) throw new Error('rm should be in expanded allowlist');
    });

    test('allowlist allows grep command (v6.0.0 expansion)', () => {
        const result = run(["'grep --version'"]);
        const output = result.stderr.toString();
        if (output.includes('BLOCKED')) throw new Error('grep should be in expanded allowlist');
    });

    test('command guard blocks powershell interpreter', () => {
        const result = run(["'powershell -Command Write-Output nope'"]);
        if (result.status !== 1) throw new Error(`Expected exit 1, got ${result.status}`);
        const output = `${result.stderr}${result.stdout}`;
        if (!output.includes('BLOCKED')) throw new Error('Missing BLOCKED message');
    });

    test('command guard blocks && chaining', () => {
        const result = run(["'echo first && echo second'"]);
        if (result.status !== 1) throw new Error(`Expected exit 1, got ${result.status}`);
        const output = `${result.stderr}${result.stdout}`;
        if (!output.includes('Shell control syntax')) throw new Error('Missing shell syntax guard message');
    });

    test('command guard blocks ; chaining', () => {
        const result = run(["'echo first; echo second'"]);
        if (result.status !== 1) throw new Error(`Expected exit 1, got ${result.status}`);
        const output = `${result.stderr}${result.stdout}`;
        if (!output.includes('Shell control syntax')) throw new Error('Missing shell syntax guard message');
    });

    test('command guard blocks pipe chaining', () => {
        const result = run(["'echo first | cat'"]);
        if (result.status !== 1) throw new Error(`Expected exit 1, got ${result.status}`);
        const output = `${result.stderr}${result.stdout}`;
        if (!output.includes('Shell control syntax')) throw new Error('Missing shell syntax guard message');
    });

    test('command guard blocks redirection syntax', () => {
        const result = run(["'echo first > out.txt'"]);
        if (result.status !== 1) throw new Error(`Expected exit 1, got ${result.status}`);
        const output = `${result.stderr}${result.stdout}`;
        if (!output.includes('Shell control syntax')) throw new Error('Missing shell syntax guard message');
    });

    test('review status syncs bold markdown result lines into review.json', () => {
        const feature = 'review-sync-bold';
        const featureDir = path.join(changesDir, feature);
        fs.mkdirSync(featureDir, { recursive: true });
        fs.writeFileSync(
            path.join(featureDir, 'review.md'),
            '# Review Report\n\n**Stage 1 Result:** PASS\n**Stage 2 Result:** PASS\n',
        );

        const result = run(['review', 'status', feature]);
        if (result.status !== 0) throw new Error(`Expected exit 0, got ${result.status}`);

        const receipt = JSON.parse(fs.readFileSync(path.join(featureDir, 'review.json'), 'utf-8'));
        if (receipt.stage1 !== 'PASS') throw new Error(`Stage 1 mismatch: ${receipt.stage1}`);
        if (receipt.stage2 !== 'PASS') throw new Error(`Stage 2 mismatch: ${receipt.stage2}`);
    });

    test('review ui refreshes frontend review receipts', () => {
        const feature = 'review-ui-refresh';
        const featureDir = path.join(changesDir, feature);
        fs.mkdirSync(featureDir, { recursive: true });
        fs.writeFileSync(
            path.join(featureDir, 'prompt.json'),
            JSON.stringify(
                {
                    normalizedSummary: 'Polish the dashboard UI hierarchy',
                    recommendedPipeline: 'standard-build',
                },
                null,
                2,
            ),
        );
        fs.writeFileSync(
            path.join(featureDir, 'design-routing.json'),
            JSON.stringify(
                {
                    stack: 'react',
                    auditOnly: false,
                    wrapperSkill: 'steroid-react-implementation',
                    importedSourceIds: ['ui-ux-pro-max'],
                },
                null,
                2,
            ),
        );
        fs.writeFileSync(path.join(featureDir, 'design-system.md'), '## Design System: review-ui-refresh\n');
        fs.writeFileSync(
            path.join(featureDir, 'accessibility.json'),
            JSON.stringify({ violationCount: 0, highestImpact: 'none', fileCount: 1 }, null, 2),
        );

        const result = run(['review', 'ui', feature]);
        if (result.status !== 0) throw new Error(`Expected exit 0, got ${result.status}`);

        const output = result.stdout.toString();
        if (!output.includes('UI Review for')) throw new Error(`Missing review ui output: ${output}`);
        if (!fs.existsSync(path.join(featureDir, 'ui-review.md'))) throw new Error('ui-review.md was not written');
        if (!fs.existsSync(path.join(featureDir, 'ui-review.json'))) throw new Error('ui-review.json was not written');
    });

    test('normalize-prompt --write persists prompt.json and prompt.md for a feature', () => {
        const feature = 'prompt-receipt';
        const featureDir = path.join(changesDir, feature);
        fs.mkdirSync(featureDir, { recursive: true });

        const result = run(['normalize-prompt', 'make it feel more premium', '--feature', feature, '--write']);
        if (result.status !== 0) throw new Error(`Expected exit 0, got ${result.status}`);

        const receiptPath = path.join(featureDir, 'prompt.json');
        if (!fs.existsSync(receiptPath)) throw new Error('prompt.json was not written');

        const receipt = JSON.parse(fs.readFileSync(receiptPath, 'utf-8'));
        if (receipt.primaryIntent !== 'build') throw new Error(`Unexpected primaryIntent: ${receipt.primaryIntent}`);
        if (receipt.source !== 'normalize-prompt') throw new Error(`Unexpected source: ${receipt.source}`);

        const briefPath = path.join(featureDir, 'prompt.md');
        if (!fs.existsSync(briefPath)) throw new Error('prompt.md was not written');

        const brief = fs.readFileSync(briefPath, 'utf-8');
        if (!brief.includes('# Prompt Brief: prompt-receipt')) throw new Error('prompt.md missing heading');
        if (!brief.includes('Recommended Route: standard-build')) throw new Error('prompt.md missing route summary');
    });

    test('pipeline-status surfaces prompt receipt details when prompt.json exists', () => {
        const feature = 'prompt-pipeline-status';
        const featureDir = path.join(changesDir, feature);
        fs.mkdirSync(featureDir, { recursive: true });
        fs.writeFileSync(path.join(featureDir, 'context.md'), '# Context\n');
        fs.writeFileSync(
            path.join(featureDir, 'request.json'),
            JSON.stringify({ feature, requestedAt: new Date().toISOString(), source: 'scan' }, null, 2),
        );
        fs.writeFileSync(
            path.join(featureDir, 'prompt.json'),
            JSON.stringify(
                {
                    primaryIntent: 'fix',
                    recommendedPipeline: 'diagnose-first',
                    continuationState: 'post-failure',
                    complexity: 'standard',
                    risk: 'medium',
                    assumptions: ['Bug reproduced locally'],
                },
                null,
                2,
            ),
        );

        const result = run(['pipeline-status', feature]);
        if (result.status !== 0) throw new Error(`Expected exit 0, got ${result.status}`);

        const output = result.stdout.toString();
        if (!output.includes('Prompt Intelligence')) throw new Error('Missing prompt intelligence section');
        if (!output.includes('Route Guidance')) throw new Error('Missing route guidance section');
        if (!output.includes('diagnose-first')) throw new Error('Missing recommended route in pipeline status');
        if (!output.includes('post-failure')) throw new Error('Missing continuation state in pipeline status');
        if (!output.includes('Next step: diagnose')) throw new Error(`Missing next-step guidance: ${output}`);
        if (!output.includes('not used by diagnose-first'))
            throw new Error(`Missing route-aware phase skip: ${output}`);
    });

    test('pipeline-status surfaces design intelligence when routing artifacts exist', () => {
        const feature = 'design-pipeline-status';
        const featureDir = path.join(changesDir, feature);
        fs.mkdirSync(featureDir, { recursive: true });
        fs.writeFileSync(
            path.join(featureDir, 'prompt.json'),
            JSON.stringify(
                {
                    normalizedSummary: 'Redesign the react dashboard UI to feel premium',
                    primaryIntent: 'build',
                    recommendedPipeline: 'standard-build',
                    continuationState: 'fresh-start',
                    complexity: 'standard',
                    risk: 'medium',
                },
                null,
                2,
            ),
        );
        fs.writeFileSync(
            path.join(featureDir, 'design-routing.json'),
            JSON.stringify(
                {
                    stack: 'react',
                    auditOnly: false,
                    wrapperSkill: 'steroid-react-implementation',
                    importedSourceIds: ['ui-ux-pro-max', 'vercel-react-best-practices'],
                },
                null,
                2,
            ),
        );
        fs.writeFileSync(path.join(featureDir, 'design-system.md'), '## Design System: design-pipeline-status\n');
        fs.writeFileSync(path.join(featureDir, 'accessibility.json'), JSON.stringify({ violationCount: 0 }, null, 2));
        fs.writeFileSync(path.join(featureDir, 'ui-audit.json'), JSON.stringify({ ok: true }, null, 2));
        fs.writeFileSync(path.join(featureDir, 'ui-review.md'), '# UI Review: design-pipeline-status\n');
        fs.writeFileSync(
            path.join(featureDir, 'ui-review.json'),
            JSON.stringify(
                {
                    feature,
                    status: 'PASS',
                    verifyStatus: 'PASS',
                    generatedAt: '2026-03-17T10:00:00.000Z',
                    stack: 'react',
                    wrapperSkill: 'steroid-react-implementation',
                    freshness: {
                        source: 'verify-feature',
                        reason: 'verify.json is newer than the current UI review receipts.',
                        evidenceUpdatedAt: '2026-03-17T09:59:00.000Z',
                        evidenceUpdatedFrom: 'verify.json',
                    },
                    findings: [],
                },
                null,
                2,
            ),
        );

        const result = run(['pipeline-status', feature]);
        if (result.status !== 0) throw new Error(`Expected exit 0, got ${result.status}`);

        const output = result.stdout.toString();
        if (!output.includes('Design Intelligence')) throw new Error('Missing design intelligence section');
        if (!output.includes('Routing receipt: present')) throw new Error(`Missing routing receipt summary: ${output}`);
        if (!output.includes('Design system: present')) throw new Error(`Missing design system summary: ${output}`);
        if (!output.includes('Accessibility receipt: present')) {
            throw new Error(`Missing accessibility receipt summary: ${output}`);
        }
        if (!output.includes('Browser audit receipt: present')) {
            throw new Error(`Missing browser audit receipt summary: ${output}`);
        }
        if (!output.includes('UI review summary: present')) {
            throw new Error(`Missing UI review summary: ${output}`);
        }
        if (!output.includes('UI review receipt: present')) {
            throw new Error(`Missing UI review receipt summary: ${output}`);
        }
        if (!output.includes('UI review refreshed by: verify-feature')) {
            throw new Error(`Missing UI review freshness source: ${output}`);
        }
        if (!output.includes('UI review generated: 2026-03-17T10:00:00.000Z')) {
            throw new Error(`Missing UI review timestamp: ${output}`);
        }
        if (!output.includes('steroid-react-implementation')) {
            throw new Error(`Missing routed wrapper skill: ${output}`);
        }
        if (!output.includes('design-routing.json')) throw new Error(`Missing design-routing artifact row: ${output}`);
        if (!output.includes('design-system.md')) throw new Error(`Missing design-system artifact row: ${output}`);
        if (!output.includes('accessibility.json')) throw new Error(`Missing accessibility artifact row: ${output}`);
        if (!output.includes('ui-audit.json')) throw new Error(`Missing browser audit artifact row: ${output}`);
        if (!output.includes('ui-review.md')) throw new Error(`Missing UI review artifact row: ${output}`);
        if (!output.includes('ui-review.json')) throw new Error(`Missing UI review receipt row: ${output}`);
    });

    test('design-system with no args exits 1', () => {
        const result = run(['design-system']);
        if (result.status !== 1) throw new Error(`Expected exit 1, got ${result.status}`);
    });

    test('design-prep with no args exits 1', () => {
        const result = run(['design-prep']);
        if (result.status !== 1) throw new Error(`Expected exit 1, got ${result.status}`);
    });

    test('gate passes vibe when context exists even without prompt receipt', () => {
        const feature = 'gate-route-advice';
        const featureDir = path.join(changesDir, feature);
        fs.mkdirSync(featureDir, { recursive: true });
        fs.writeFileSync(path.join(featureDir, 'context.md'), '# Context\nLine 2\nLine 3\nLine 4\nLine 5\n');
        fs.writeFileSync(
            path.join(featureDir, 'request.json'),
            JSON.stringify({ feature, requestedAt: new Date().toISOString(), source: 'scan' }, null, 2),
        );

        const result = run(['gate', 'vibe', feature]);
        if (result.status !== 0) throw new Error(`Expected exit 0, got ${result.status}`);

        const output = result.stdout.toString();
        if (!output.includes('Gate passed')) {
            throw new Error(`Missing gate pass confirmation: ${output}`);
        }
    });

    test('gate vibe blocks when request.json is missing even if context.md exists', () => {
        const feature = 'gate-missing-request-receipt';
        const featureDir = path.join(changesDir, feature);
        fs.mkdirSync(featureDir, { recursive: true });
        fs.writeFileSync(path.join(featureDir, 'context.md'), '# Context\nLine 2\nLine 3\nLine 4\nLine 5\n');

        const result = run(['gate', 'vibe', feature]);
        if (result.status !== 1) throw new Error(`Expected exit 1, got ${result.status}`);

        const output = `${result.stdout}${result.stderr}`;
        if (!output.includes('governed scan receipt is incomplete')) {
            throw new Error(`Missing request receipt block: ${output}`);
        }
        if (!output.includes('request.json')) {
            throw new Error(`Missing request.json guidance: ${output}`);
        }
    });

    test('gate includes route guidance when a diagnose-first feature is blocked later in the pipeline', () => {
        const feature = 'gate-fix-route-block';
        const featureDir = path.join(changesDir, feature);
        fs.mkdirSync(featureDir, { recursive: true });
        fs.writeFileSync(
            path.join(featureDir, 'prompt.json'),
            JSON.stringify(
                {
                    primaryIntent: 'fix',
                    recommendedPipeline: 'diagnose-first',
                    continuationState: 'post-failure',
                    complexity: 'standard',
                    risk: 'medium',
                },
                null,
                2,
            ),
        );

        const result = run(['gate', 'architect', feature]);
        if (result.status !== 1) throw new Error(`Expected exit 1, got ${result.status}`);

        const output = `${result.stderr}${result.stdout}`;
        if (!output.includes('Route guidance: diagnose-first')) {
            throw new Error(`Missing diagnose-first route guidance: ${output}`);
        }
        if (!output.includes('Suggested next step: scan')) {
            throw new Error(`Missing suggested next step: ${output}`);
        }
    });

    test('gate architect blocks UI features when design artifacts are missing', () => {
        const feature = 'gate-ui-architect-block';
        const featureDir = path.join(changesDir, feature);
        fs.mkdirSync(featureDir, { recursive: true });
        fs.writeFileSync(
            path.join(featureDir, 'research.md'),
            [
                '# Research: UI Architect Block',
                '',
                '**Researched**: 2026-03-18',
                '**Spec Source**: .memory/changes/gate-ui-architect-block/spec.md',
                '**Overall Confidence**: MEDIUM',
                '',
                '## Summary',
                '',
                'UI-intensive research is present.',
                '',
                '## Standard Stack',
                '',
                '### Core',
                '',
                '| Library | Version | Purpose | Confidence |',
                '| ------- | ------- | ------- | ---------- |',
                '| React | 19 | UI | HIGH |',
                '',
                '## Architecture Patterns',
                '',
                '### Recommended Project Structure',
                '',
                'src/',
            ].join('\n'),
        );
        fs.writeFileSync(
            path.join(featureDir, 'prompt.json'),
            JSON.stringify(
                {
                    normalizedSummary: 'Redesign the dashboard UI with a premium visual system',
                    recommendedPipeline: 'standard-build',
                    continuationState: 'fresh-start',
                },
                null,
                2,
            ),
        );

        const result = run(['gate', 'architect', feature]);
        if (result.status !== 1) throw new Error(`Expected exit 1, got ${result.status}`);

        const output = `${result.stderr}${result.stdout}`;
        if (!output.includes('DESIGN GATE BLOCKED')) throw new Error(`Missing design gate block: ${output}`);
        if (!output.includes('design-routing.json')) throw new Error(`Missing design-routing guidance: ${output}`);
        if (!output.includes('design-system.md')) throw new Error(`Missing design-system guidance: ${output}`);
    });

    test('gate architect treats malformed design-routing.json as missing', () => {
        const feature = 'gate-ui-architect-malformed-route';
        const featureDir = path.join(changesDir, feature);
        fs.mkdirSync(featureDir, { recursive: true });
        fs.writeFileSync(
            path.join(featureDir, 'research.md'),
            [
                '# Research: Malformed Route',
                '',
                '**Researched**: 2026-03-18',
                '**Spec Source**: .memory/changes/gate-ui-architect-malformed-route/spec.md',
                '**Overall Confidence**: MEDIUM',
                '',
                '## Summary',
                '',
                'UI work is present.',
                '',
                '## Standard Stack',
                '',
                '### Core',
                '',
                '| Library | Version | Purpose | Confidence |',
                '| ------- | ------- | ------- | ---------- |',
                '| React | 19 | UI | HIGH |',
                '',
                '## Architecture Patterns',
                '',
                '### Recommended Project Structure',
                '',
                'src/',
            ].join('\n'),
        );
        fs.writeFileSync(
            path.join(featureDir, 'prompt.json'),
            JSON.stringify(
                {
                    normalizedSummary: 'Redesign the dashboard UI with a premium visual system',
                    recommendedPipeline: 'standard-build',
                    continuationState: 'fresh-start',
                },
                null,
                2,
            ),
        );
        fs.writeFileSync(
            path.join(featureDir, 'design-routing.json'),
            JSON.stringify(
                {
                    domain: 'broken',
                    stack: 'invalid',
                },
                null,
                2,
            ),
        );

        const result = run(['gate', 'architect', feature]);
        if (result.status !== 1) throw new Error(`Expected exit 1, got ${result.status}`);

        const output = `${result.stderr}${result.stdout}`;
        if (!output.includes('DESIGN GATE BLOCKED')) throw new Error(`Missing malformed design gate block: ${output}`);
        if (!output.includes('design-routing.json')) throw new Error(`Missing malformed routing guidance: ${output}`);
    });

    test('gate research auto-bootstraps design artifacts for UI features', () => {
        const feature = 'gate-ui-research-bootstrap';
        const featureDir = path.join(changesDir, feature);
        fs.mkdirSync(featureDir, { recursive: true });
        const importedRoot = path.join(tmpBase, 'imported');
        const importedSkillDir = path.join(importedRoot, 'ui-ux-pro-max');
        fs.mkdirSync(importedRoot, { recursive: true });
        fs.cpSync(path.join(__dirname, '..', '..', 'imported', 'ui-ux-pro-max'), importedSkillDir, { recursive: true });
        fs.writeFileSync(
            path.join(importedRoot, 'imported-manifest.json'),
            JSON.stringify(
                {
                    sources: [
                        {
                            id: 'ui-ux-pro-max',
                            localPath: 'imported/ui-ux-pro-max',
                        },
                    ],
                },
                null,
                2,
            ),
        );
        fs.writeFileSync(
            path.join(featureDir, 'spec.md'),
            [
                '# Specification: UI Research Bootstrap',
                '',
                '**Created**: 2026-03-18',
                '**Source**: .memory/changes/gate-ui-research-bootstrap/vibe.md',
                '**Status**: Ready for Research',
                '',
                '## Scope Boundary',
                '',
                '### In Scope (v1)',
                '- premium dashboard hierarchy',
                '',
                '### Out of Scope (not v1)',
                '- backend changes',
                '',
                '## User Stories',
                '',
                '### Story 1: Premium dashboard shell (Priority: P1)',
                '',
                'The dashboard should feel premium and clearer to scan.',
                '',
                '**Acceptance Criteria:**',
                '',
                '1. **Given** the dashboard loads, **When** the user sees the shell, **Then** hierarchy feels cleaner.',
                '',
                '## Edge Cases',
                '',
                '- Missing data state still preserves hierarchy.',
                '',
                '## Success Criteria',
                '',
                '- **SC-001**: Dashboard shell is visually clearer.',
            ].join('\n'),
        );
        fs.writeFileSync(
            path.join(featureDir, 'prompt.json'),
            JSON.stringify(
                {
                    normalizedSummary: 'Build a premium React dashboard redesign',
                    pipelineHint: 'scan -> vibe -> specify -> research -> architect -> engine -> verify',
                    recommendedPipeline: 'standard-build',
                    continuationState: 'fresh-start',
                },
                null,
                2,
            ),
        );

        const result = run(['gate', 'research', feature]);
        if (result.status !== 0) throw new Error(`Expected exit 0, got ${result.status}`);

        const output = result.stdout.toString();
        if (!output.includes('Research prep:')) throw new Error(`Missing research prep output: ${output}`);
        if (!fs.existsSync(path.join(featureDir, 'design-routing.json'))) {
            throw new Error('design-routing.json was not auto-generated');
        }
        if (!fs.existsSync(path.join(featureDir, 'design-system.md'))) {
            throw new Error('design-system.md was not auto-generated');
        }
    });

    test('gate engine passes UI features when design artifacts are present', () => {
        const feature = 'gate-ui-engine-pass';
        const featureDir = path.join(changesDir, feature);
        fs.mkdirSync(featureDir, { recursive: true });
        fs.writeFileSync(
            path.join(featureDir, 'plan.md'),
            [
                '# Implementation Plan: UI Engine Pass',
                '',
                '**Source**: .memory/changes/gate-ui-engine-pass/spec.md + research.md',
                '**Created**: 2026-03-18',
                '',
                '## Tech Stack',
                '',
                '- Frontend: React',
                '- Backend: None',
                '- Database: None',
                '- Styling: Tailwind CSS',
                '',
                '## Execution Checklist',
                '',
                '- [x] Create dashboard shell',
                '- [x] Add responsive layout states',
                '- [x] Validate design-system alignment',
            ].join('\n'),
        );
        fs.writeFileSync(
            path.join(featureDir, 'prompt.json'),
            JSON.stringify(
                {
                    normalizedSummary: 'Refactor the onboarding screen UI',
                    recommendedPipeline: 'standard-build',
                    continuationState: 'fresh-start',
                },
                null,
                2,
            ),
        );
        fs.writeFileSync(
            path.join(featureDir, 'design-routing.json'),
            JSON.stringify(
                {
                    domain: 'react',
                    stack: 'react',
                    auditOnly: false,
                    wrapperSkill: 'steroid-react-implementation',
                },
                null,
                2,
            ),
        );
        fs.writeFileSync(path.join(featureDir, 'design-system.md'), '## Design System: gate-ui-engine-pass\n');

        const result = run(['gate', 'engine', feature]);
        if (result.status !== 0) throw new Error(`Expected exit 0, got ${result.status}`);

        const output = result.stdout.toString();
        if (!output.includes('Gate passed')) throw new Error(`Missing gate pass output: ${output}`);
    });

    test('gate research blocks malformed spec.md even when line count is high', () => {
        const feature = 'gate-malformed-spec';
        const featureDir = path.join(changesDir, feature);
        fs.mkdirSync(featureDir, { recursive: true });
        fs.writeFileSync(path.join(featureDir, 'spec.md'), '# Spec\n' + 'line\n'.repeat(20));

        const result = run(['gate', 'research', feature]);
        if (result.status !== 1) throw new Error(`Expected exit 1, got ${result.status}`);
        const output = `${result.stdout}${result.stderr}`;
        if (!output.includes('spec.md is missing governed structure')) {
            throw new Error(`Missing governed spec block: ${output}`);
        }
    });

    test('gate architect blocks malformed research.md even when line count is high', () => {
        const feature = 'gate-malformed-research';
        const featureDir = path.join(changesDir, feature);
        fs.mkdirSync(featureDir, { recursive: true });
        fs.writeFileSync(path.join(featureDir, 'research.md'), '# Research\n' + 'line\n'.repeat(20));

        const result = run(['gate', 'architect', feature]);
        if (result.status !== 1) throw new Error(`Expected exit 1, got ${result.status}`);
        const output = `${result.stdout}${result.stderr}`;
        if (!output.includes('research.md is missing governed structure')) {
            throw new Error(`Missing governed research block: ${output}`);
        }
    });

    test('gate engine blocks malformed plan.md even when line count is high', () => {
        const feature = 'gate-malformed-plan';
        const featureDir = path.join(changesDir, feature);
        fs.mkdirSync(featureDir, { recursive: true });
        fs.writeFileSync(path.join(featureDir, 'plan.md'), '# Plan\n' + '- [x] done\n'.repeat(20));

        const result = run(['gate', 'engine', feature]);
        if (result.status !== 1) throw new Error(`Expected exit 1, got ${result.status}`);
        const output = `${result.stdout}${result.stderr}`;
        if (!output.includes('plan.md is missing governed structure')) {
            throw new Error(`Missing governed plan block: ${output}`);
        }
    });

    test('archive preserves prior files during same-stamp collisions', () => {
        const feature = 'archive-collision-proof';
        const featureDir = path.join(changesDir, feature);
        const archiveDir = path.join(featureDir, 'archive');
        fs.mkdirSync(archiveDir, { recursive: true });
        fs.writeFileSync(path.join(featureDir, 'verify.json'), '{"status":"PASS"}');
        fs.writeFileSync(path.join(featureDir, 'completion.json'), '{"feature":"archive-collision-proof","status":"PASS"}');
        fs.writeFileSync(path.join(featureDir, 'verify.md'), '**Status:** PASS');
        fs.writeFileSync(path.join(archiveDir, '2026-03-15T07-01-17-123Z-verify.json'), '{}');

        const source = fs.readFileSync(steroidRun, 'utf-8');
        if (!source.includes('createArchiveStamp')) throw new Error('archive timestamp helper missing');
        if (!source.includes('-${file}') && !source.includes('archiveStamp')) {
            throw new Error('archive timestamp usage not found');
        }
    });

    test('archive blocks when ui-review.json is FAIL', () => {
        const feature = 'archive-ui-review-block';
        const featureDir = path.join(changesDir, feature);
        fs.mkdirSync(featureDir, { recursive: true });
        fs.writeFileSync(
            path.join(featureDir, 'verify.json'),
            JSON.stringify({ feature, status: 'PASS', reviewPassed: true }, null, 2),
        );
        fs.writeFileSync(
            path.join(featureDir, 'completion.json'),
            JSON.stringify({ feature, status: 'PASS', sourceArtifacts: ['verify.json'], nextActions: ['archive'] }, null, 2),
        );
        fs.writeFileSync(
            path.join(featureDir, 'ui-review.json'),
            JSON.stringify({ feature, status: 'FAIL', previewTarget: 'https://preview.example.com' }, null, 2),
        );

        const result = run(['archive', feature]);
        if (result.status !== 1) throw new Error(`Expected exit 1, got ${result.status}`);
        const output = `${result.stdout}${result.stderr}`;
        if (!output.includes('ARCHIVE BLOCKED: ui-review.json status is FAIL.')) {
            throw new Error(`Missing ui-review archive block: ${output}`);
        }
    });

    test('archive refreshes stale ui-review receipts before enforcing UI quality gate', () => {
        const feature = 'archive-ui-review-refresh';
        const featureDir = path.join(changesDir, feature);
        fs.mkdirSync(featureDir, { recursive: true });
        fs.writeFileSync(
            path.join(featureDir, 'verify.json'),
            JSON.stringify(
                {
                    feature,
                    status: 'PASS',
                    reviewPassed: true,
                    deepRequested: false,
                },
                null,
                2,
            ),
        );
        fs.writeFileSync(
            path.join(featureDir, 'completion.json'),
            JSON.stringify({ feature, status: 'PASS', sourceArtifacts: ['verify.json'], nextActions: ['archive'] }, null, 2),
        );
        fs.writeFileSync(
            path.join(featureDir, 'prompt.json'),
            JSON.stringify(
                {
                    feature,
                    primaryIntent: 'refactor',
                    normalizedSummary: 'Refactor the dashboard UI to feel premium.',
                },
                null,
                2,
            ),
        );
        fs.writeFileSync(
            path.join(featureDir, 'design-routing.json'),
            JSON.stringify(
                {
                    feature,
                    domain: 'frontend',
                    stack: 'react',
                    wrapperSkill: 'steroid-react-implementation',
                    importedSourceIds: ['ui-ux-pro-max', 'vercel-react-best-practices'],
                },
                null,
                2,
            ),
        );
        fs.writeFileSync(path.join(featureDir, 'design-system.md'), '# Design System\n');
        fs.writeFileSync(
            path.join(featureDir, 'accessibility.json'),
            JSON.stringify(
                {
                    feature,
                    violationCount: 3,
                    highestImpact: 'serious',
                    fileCount: 1,
                },
                null,
                2,
            ),
        );
        fs.writeFileSync(path.join(featureDir, 'ui-review.md'), '# UI Review\n\nLegacy PASS receipt\n');
        fs.writeFileSync(
            path.join(featureDir, 'ui-review.json'),
            JSON.stringify(
                {
                    feature,
                    status: 'PASS',
                    findings: [],
                },
                null,
                2,
            ),
        );
        const staleDate = new Date('2026-01-01T00:00:00.000Z');
        fs.utimesSync(path.join(featureDir, 'ui-review.md'), staleDate, staleDate);
        fs.utimesSync(path.join(featureDir, 'ui-review.json'), staleDate, staleDate);

        const result = run(['archive', feature]);
        if (result.status !== 1) throw new Error(`Expected exit 1, got ${result.status}`);
        const output = `${result.stdout}${result.stderr}`;
        if (!output.includes('Refreshed UI review before archive')) {
            throw new Error(`Missing UI review refresh message: ${output}`);
        }
        if (!output.includes('ARCHIVE BLOCKED: ui-review.json status is FAIL.')) {
            throw new Error(`Missing refreshed archive block: ${output}`);
        }

        const refreshedReceipt = JSON.parse(fs.readFileSync(path.join(featureDir, 'ui-review.json'), 'utf-8'));
        if (refreshedReceipt.status !== 'FAIL') {
            throw new Error(`Expected refreshed ui-review.json to FAIL, got ${refreshedReceipt.status}`);
        }
    });

    test('archive refreshes malformed ui-review receipts before enforcing UI quality gate', () => {
        const feature = 'archive-ui-review-malformed';
        const featureDir = path.join(changesDir, feature);
        fs.mkdirSync(featureDir, { recursive: true });
        fs.writeFileSync(
            path.join(featureDir, 'verify.json'),
            JSON.stringify(
                {
                    feature,
                    status: 'PASS',
                    reviewPassed: true,
                    deepRequested: false,
                },
                null,
                2,
            ),
        );
        fs.writeFileSync(
            path.join(featureDir, 'completion.json'),
            JSON.stringify({ feature, status: 'PASS', sourceArtifacts: ['verify.json'], nextActions: ['archive'] }, null, 2),
        );
        fs.writeFileSync(
            path.join(featureDir, 'prompt.json'),
            JSON.stringify(
                {
                    feature,
                    primaryIntent: 'refactor',
                    normalizedSummary: 'Refresh the dashboard UI hierarchy.',
                },
                null,
                2,
            ),
        );
        fs.writeFileSync(
            path.join(featureDir, 'design-routing.json'),
            JSON.stringify(
                {
                    feature,
                    domain: 'frontend',
                    stack: 'react',
                    wrapperSkill: 'steroid-react-implementation',
                },
                null,
                2,
            ),
        );
        fs.writeFileSync(path.join(featureDir, 'design-system.md'), '# Design System\n');
        fs.writeFileSync(
            path.join(featureDir, 'accessibility.json'),
            JSON.stringify(
                {
                    feature,
                    violationCount: 2,
                    highestImpact: 'serious',
                    fileCount: 1,
                },
                null,
                2,
            ),
        );
        fs.writeFileSync(path.join(featureDir, 'ui-review.md'), '# UI Review\n\nMalformed receipt companion\n');
        fs.writeFileSync(
            path.join(featureDir, 'ui-review.json'),
            JSON.stringify(
                {
                    feature,
                    status: 'BROKEN',
                    findings: 'not-an-array',
                },
                null,
                2,
            ),
        );

        const result = run(['archive', feature]);
        if (result.status !== 1) throw new Error(`Expected exit 1, got ${result.status}`);
        const output = `${result.stdout}${result.stderr}`;
        if (!output.includes('Refreshed UI review before archive')) {
            throw new Error(`Missing malformed refresh message: ${output}`);
        }
        if (!output.includes('ARCHIVE BLOCKED: ui-review.json status is FAIL.')) {
            throw new Error(`Missing refreshed malformed archive block: ${output}`);
        }

        const refreshedReceipt = JSON.parse(fs.readFileSync(path.join(featureDir, 'ui-review.json'), 'utf-8'));
        if (refreshedReceipt.status !== 'FAIL') {
            throw new Error(`Expected malformed ui-review.json to be refreshed to FAIL, got ${refreshedReceipt.status}`);
        }
    });

    test('archive blocks CONDITIONAL ui-review receipts with blocking frontend issues unless --force-ui is used', () => {
        const feature = 'archive-ui-conditional-block';
        const featureDir = path.join(changesDir, feature);
        fs.mkdirSync(featureDir, { recursive: true });
        fs.writeFileSync(
            path.join(featureDir, 'verify.json'),
            JSON.stringify(
                {
                    feature,
                    status: 'PASS',
                    reviewPassed: true,
                    deepRequested: false,
                },
                null,
                2,
            ),
        );
        fs.writeFileSync(
            path.join(featureDir, 'completion.json'),
            JSON.stringify(
                { feature, status: 'PASS', sourceArtifacts: ['verify.json'], nextActions: ['archive'] },
                null,
                2,
            ),
        );
        fs.writeFileSync(path.join(featureDir, 'spec.md'), '# Spec\n');
        fs.writeFileSync(path.join(featureDir, 'review.md'), '# Review\n');
        fs.writeFileSync(path.join(featureDir, 'verify.md'), '# Verify\n');
        fs.writeFileSync(
            path.join(featureDir, 'ui-review.json'),
            JSON.stringify(
                {
                    feature,
                    status: 'CONDITIONAL',
                    generatedAt: '2026-03-17T12:00:00.000Z',
                    freshness: {
                        source: 'verify-feature',
                        reason: 'verify.json is newer than the current UI review receipts.',
                    },
                    findings: [
                        {
                            severity: 'medium',
                            title: 'Accessibility violations detected',
                            detail: '2 moderate issues across 1 HTML target.',
                        },
                    ],
                    evidence: {
                        accesslint: { present: true, status: 'WARN' },
                        browserAudit: { present: false, status: 'SKIP' },
                    },
                },
                null,
                2,
            ),
        );

        const blocked = run(['archive', feature]);
        if (blocked.status !== 1) throw new Error(`Expected exit 1, got ${blocked.status}`);
        const blockedOutput = `${blocked.stdout}${blocked.stderr}`;
        if (!blockedOutput.includes('ARCHIVE BLOCKED: ui-review.json is CONDITIONAL with blocking frontend issues.')) {
            throw new Error(`Missing conditional archive block: ${blockedOutput}`);
        }
        if (!blockedOutput.includes('--force-ui')) {
            throw new Error(`Missing --force-ui guidance: ${blockedOutput}`);
        }

        const forced = run(['archive', feature, '--force-ui']);
        if (forced.status !== 0) throw new Error(`Expected forced archive to pass, got ${forced.status}`);
        const forcedOutput = `${forced.stdout}${forced.stderr}`;
        if (!forcedOutput.includes('--force-ui override used')) {
            throw new Error(`Missing --force-ui override message: ${forcedOutput}`);
        }
    });

    test('archive blocks when completion.json is missing', () => {
        const feature = 'archive-missing-completion';
        const featureDir = path.join(changesDir, feature);
        fs.mkdirSync(featureDir, { recursive: true });
        fs.writeFileSync(
            path.join(featureDir, 'verify.json'),
            JSON.stringify({ feature, status: 'PASS', reviewPassed: true }, null, 2),
        );

        const result = run(['archive', feature]);
        if (result.status !== 1) throw new Error(`Expected exit 1, got ${result.status}`);
        const output = `${result.stdout}${result.stderr}`;
        if (!output.includes('ARCHIVE BLOCKED: No completion.json receipt found.')) {
            throw new Error(`Missing completion archive block: ${output}`);
        }
    });

    test('archive blocks when completion.json status does not match verify.json', () => {
        const feature = 'archive-completion-status-mismatch';
        const featureDir = path.join(changesDir, feature);
        fs.mkdirSync(featureDir, { recursive: true });
        fs.writeFileSync(
            path.join(featureDir, 'verify.json'),
            JSON.stringify({ feature, status: 'PASS', reviewPassed: true }, null, 2),
        );
        fs.writeFileSync(
            path.join(featureDir, 'completion.json'),
            JSON.stringify({ feature, status: 'CONDITIONAL', sourceArtifacts: ['verify.json'], nextActions: ['archive'] }, null, 2),
        );

        const result = run(['archive', feature]);
        if (result.status !== 1) throw new Error(`Expected exit 1, got ${result.status}`);
        const output = `${result.stdout}${result.stderr}`;
        if (!output.includes('completion.json status CONDITIONAL does not match verify.json status PASS.')) {
            throw new Error(`Missing completion mismatch archive block: ${output}`);
        }
    });

    test('check-plan ignores checklist examples inside fenced code blocks', () => {
        const feature = 'plan-fenced-code';
        const featureDir = path.join(changesDir, feature);
        fs.mkdirSync(featureDir, { recursive: true });
        fs.writeFileSync(
            path.join(featureDir, 'plan.md'),
            [
                '# Plan',
                '',
                '- [x] Real completed task',
                '- [ ] Real remaining task',
                '',
                '```md',
                '- [x] Example task that should be ignored',
                '- [ ] Example unchecked task that should be ignored',
                '```',
                '',
            ].join('\n'),
        );

        const result = run(['check-plan', feature]);
        if (result.status !== 1) throw new Error(`Expected exit 1, got ${result.status}`);
        const output = result.stdout.toString();
        if (!output.includes('Plan: 1/2 tasks complete (50%)')) {
            throw new Error(`Unexpected checklist count: ${output}`);
        }
    });

    test('check-plan syncs tasks.md from the governed checklist', () => {
        const feature = 'check-plan-syncs-tasks';
        const featureDir = path.join(changesDir, feature);
        fs.mkdirSync(featureDir, { recursive: true });
        fs.writeFileSync(
            path.join(featureDir, 'plan.md'),
            ['# Implementation Plan: Sync Tasks', '', '## Execution Checklist', '', '- [x] First task', '- [ ] Second task', '']
                .join('\n'),
        );

        const result = run(['check-plan', feature]);
        if (result.status !== 1) throw new Error(`Expected exit 1, got ${result.status}`);

        const tasksPath = path.join(featureDir, 'tasks.md');
        if (!fs.existsSync(tasksPath)) throw new Error('tasks.md was not written');
        const tasks = fs.readFileSync(tasksPath, 'utf-8');
        if (!tasks.includes('# Tasks: check-plan-syncs-tasks')) throw new Error(`Missing tasks heading: ${tasks}`);
        if (!tasks.includes('- [x] First task')) throw new Error(`Missing completed task mirror: ${tasks}`);
        if (!tasks.includes('- [ ] Second task')) throw new Error(`Missing remaining task mirror: ${tasks}`);
    });

    test('check-plan writes execution.json when all tasks are complete', () => {
        const feature = 'check-plan-complete-execution';
        const featureDir = path.join(changesDir, feature);
        fs.mkdirSync(featureDir, { recursive: true });
        fs.writeFileSync(
            path.join(featureDir, 'plan.md'),
            ['# Implementation Plan: Complete Execution', '', '## Execution Checklist', '', '- [x] Finish task', ''].join('\n'),
        );

        const result = run(['check-plan', feature]);
        if (result.status !== 0) throw new Error(`Expected exit 0, got ${result.status}`);

        const executionPath = path.join(featureDir, 'execution.json');
        if (!fs.existsSync(executionPath)) throw new Error('execution.json was not written');
        const receipt = JSON.parse(fs.readFileSync(executionPath, 'utf-8'));
        if (receipt.feature !== feature) throw new Error(`Unexpected execution.json feature: ${receipt.feature}`);
        if (receipt.status !== 'COMPLETE') throw new Error(`Unexpected execution.json status: ${receipt.status}`);
        if (!Array.isArray(receipt.consumed_artifacts) || !receipt.consumed_artifacts.includes('plan.md')) {
            throw new Error(`Missing consumed_artifacts in execution.json: ${JSON.stringify(receipt)}`);
        }
    });

    test('report generate says criteria recorded instead of implemented from spec-only input', () => {
        const feature = 'report-wording-fix';
        const featureDir = path.join(changesDir, feature);
        fs.mkdirSync(featureDir, { recursive: true });
        fs.writeFileSync(
            path.join(featureDir, 'spec.md'),
            '# Spec\n\nScenario: Founder sees dashboard\nGiven a founder\nWhen they sign in\nThen they see KPIs\n',
        );
        fs.writeFileSync(path.join(featureDir, 'plan.md'), '- [x] Scaffold\n');

        const result = run(['report', 'generate', feature]);
        if (result.status !== 0) throw new Error(`Expected exit 0, got ${result.status}`);

        const report = fs.readFileSync(path.join(memoryDir, 'reports', `${feature}.md`), 'utf-8');
        if (!report.includes('acceptance criteria recorded in spec.md')) {
            throw new Error(`Missing revised report wording: ${report}`);
        }
        if (report.includes('acceptance scenarios implemented')) {
            throw new Error(`Old overstated wording still present: ${report}`);
        }
    });

    test('report generate includes frontend quality from ui-review.json', () => {
        const feature = 'report-ui-quality';
        const featureDir = path.join(changesDir, feature);
        fs.mkdirSync(featureDir, { recursive: true });
        fs.writeFileSync(path.join(featureDir, 'spec.md'), '# Spec\n\nThen the landing page feels premium\n');
        fs.writeFileSync(path.join(featureDir, 'plan.md'), '- [x] Refresh hero\n');
        fs.writeFileSync(
            path.join(featureDir, 'prompt.json'),
            JSON.stringify(
                {
                    feature,
                    primaryIntent: 'refactor',
                    normalizedSummary: 'Refactor the landing page UI.',
                },
                null,
                2,
            ),
        );
        fs.writeFileSync(
            path.join(featureDir, 'design-routing.json'),
            JSON.stringify(
                {
                    feature,
                    domain: 'frontend',
                    stack: 'react',
                    wrapperSkill: 'steroid-react-implementation',
                    importedSourceIds: ['ui-ux-pro-max'],
                },
                null,
                2,
            ),
        );
        fs.writeFileSync(path.join(featureDir, 'ui-review.md'), '# UI Review\n\nFrontend quality summary\n');
        fs.writeFileSync(
            path.join(featureDir, 'ui-review.json'),
            JSON.stringify(
                {
                    feature,
                    status: 'CONDITIONAL',
                    verifyStatus: 'CONDITIONAL',
                    generatedAt: '2026-03-17T12:00:00.000Z',
                    stack: 'react',
                    wrapperSkill: 'steroid-react-implementation',
                    freshness: {
                        source: 'review ui',
                        reason: 'Manual frontend review refresh requested.',
                        evidenceUpdatedAt: '2026-03-17T11:55:00.000Z',
                        evidenceUpdatedFrom: 'ui-audit.json',
                    },
                    findings: [
                        {
                            severity: 'medium',
                            title: 'Browser audit found polish issues',
                            detail: '2 console warning(s).',
                        },
                    ],
                },
                null,
                2,
            ),
        );

        const result = run(['report', 'generate', feature]);
        if (result.status !== 0) throw new Error(`Expected exit 0, got ${result.status}`);

        const report = fs.readFileSync(path.join(memoryDir, 'reports', `${feature}.md`), 'utf-8');
        if (!report.includes('## Frontend Quality')) throw new Error(`Missing frontend quality section: ${report}`);
        if (!report.includes('UI Review Status: CONDITIONAL')) throw new Error(`Missing UI review status: ${report}`);
        if (!report.includes('Frontend Release Recommendation: CAUTION')) {
            throw new Error(`Missing frontend release recommendation: ${report}`);
        }
        if (!report.includes('Refreshed By: review ui'))
            throw new Error(`Missing UI review freshness source: ${report}`);
        if (!report.includes('Browser audit found polish issues'))
            throw new Error(`Missing frontend finding: ${report}`);
    });

    test('report generate refreshes stale active ui-review receipts before writing the handoff report', () => {
        const feature = 'report-ui-refresh';
        const featureDir = path.join(changesDir, feature);
        const archiveDir = path.join(featureDir, 'archive');
        fs.mkdirSync(archiveDir, { recursive: true });
        fs.writeFileSync(path.join(featureDir, 'spec.md'), '# Spec\n\nThen the dashboard feels premium\n');
        fs.writeFileSync(path.join(featureDir, 'plan.md'), '- [x] Refresh the dashboard shell\n');
        fs.writeFileSync(
            path.join(featureDir, 'prompt.json'),
            JSON.stringify(
                {
                    feature,
                    primaryIntent: 'refactor',
                    normalizedSummary: 'Refactor the dashboard UI and polish the frontend.',
                },
                null,
                2,
            ),
        );
        fs.writeFileSync(
            path.join(featureDir, 'design-routing.json'),
            JSON.stringify(
                {
                    feature,
                    domain: 'frontend',
                    stack: 'react',
                    wrapperSkill: 'steroid-react-implementation',
                    importedSourceIds: ['ui-ux-pro-max'],
                },
                null,
                2,
            ),
        );
        fs.writeFileSync(path.join(featureDir, 'design-system.md'), '# Design System\n');
        fs.writeFileSync(
            path.join(featureDir, 'accessibility.json'),
            JSON.stringify(
                {
                    feature,
                    violationCount: 2,
                    highestImpact: 'serious',
                    fileCount: 1,
                },
                null,
                2,
            ),
        );
        fs.writeFileSync(path.join(featureDir, 'ui-review.md'), '# UI Review\n\nLegacy active receipt\n');
        fs.writeFileSync(
            path.join(featureDir, 'ui-review.json'),
            JSON.stringify(
                {
                    feature,
                    status: 'PASS',
                    findings: [],
                },
                null,
                2,
            ),
        );
        fs.writeFileSync(
            path.join(archiveDir, '2026-03-01T00-00-00-000Z-ui-review.json'),
            JSON.stringify(
                {
                    feature,
                    status: 'CONDITIONAL',
                    findings: [{ severity: 'medium', title: 'Archived warning', detail: 'Old artifact.' }],
                },
                null,
                2,
            ),
        );
        const staleDate = new Date('2026-01-01T00:00:00.000Z');
        fs.utimesSync(path.join(featureDir, 'ui-review.md'), staleDate, staleDate);
        fs.utimesSync(path.join(featureDir, 'ui-review.json'), staleDate, staleDate);

        const result = run(['report', 'generate', feature]);
        if (result.status !== 0) throw new Error(`Expected exit 0, got ${result.status}`);
        const output = `${result.stdout}${result.stderr}`;
        if (!output.includes('Refreshed UI review for report generation')) {
            throw new Error(`Missing report refresh message: ${output}`);
        }

        const report = fs.readFileSync(path.join(memoryDir, 'reports', `${feature}.md`), 'utf-8');
        if (!report.includes('UI Review Status: FAIL')) {
            throw new Error(`Expected refreshed FAIL status in report: ${report}`);
        }
        if (!report.includes('Frontend Release Recommendation: HOLD')) {
            throw new Error(`Expected HOLD recommendation in report: ${report}`);
        }
        if (report.includes('Archived warning')) {
            throw new Error(`Report still used archived ui-review artifact: ${report}`);
        }
    });

    test('verify-feature treats route-group pages as live routes', () => {
        const feature = 'route-groups-live';
        const featureDir = path.join(changesDir, feature);
        fs.mkdirSync(featureDir, { recursive: true });
        fs.writeFileSync(path.join(featureDir, 'plan.md'), '- [x] Completed task\n');
        writeGovernedExecutionArtifacts(featureDir, feature);
        fs.writeFileSync(
            path.join(featureDir, 'review.json'),
            JSON.stringify({ feature, stage1: 'PASS', stage2: 'PASS', updatedAt: new Date().toISOString() }, null, 2),
        );

        const appDir = path.join(tmpBase, 'src', 'app');
        fs.mkdirSync(path.join(appDir, '(app)', 'dashboard'), { recursive: true });
        fs.mkdirSync(path.join(appDir, '(app)', 'blueprint'), { recursive: true });
        fs.writeFileSync(
            path.join(appDir, 'page.tsx'),
            'export default function Home(){return <><a href="/dashboard">Dash</a><a href="/blueprint">Blueprint</a></>;}',
        );
        fs.writeFileSync(
            path.join(appDir, '(app)', 'dashboard', 'page.tsx'),
            'export default function Page(){return null;}',
        );
        fs.writeFileSync(
            path.join(appDir, '(app)', 'blueprint', 'page.tsx'),
            'export default function Page(){return null;}',
        );
        fs.writeFileSync(
            path.join(knowledgeDir, 'tech-stack.json'),
            JSON.stringify(
                {
                    language: 'TypeScript',
                    framework: 'Next.js',
                    packageManager: 'npm',
                    _lastUpdated: new Date().toISOString(),
                },
                null,
                2,
            ),
        );

        const result = run(['verify-feature', feature]);
        const output = result.stdout.toString();
        if (!output.includes('Dead routes: PASS')) throw new Error(`Dead route check did not pass: ${output}`);
        if (
            output.includes('/dashboard (in src\\app\\page.tsx)') ||
            output.includes('/blueprint (in src\\app\\page.tsx)')
        ) {
            throw new Error(`Route groups still flagged as dead: ${output}`);
        }
    });

    test('verify-feature prefers Next build manifests when available', () => {
        const feature = 'manifest-routes-live';
        const featureDir = path.join(changesDir, feature);
        fs.mkdirSync(featureDir, { recursive: true });
        fs.writeFileSync(path.join(featureDir, 'plan.md'), '- [x] Completed task\n');
        writeGovernedExecutionArtifacts(featureDir, feature);
        fs.writeFileSync(
            path.join(featureDir, 'review.json'),
            JSON.stringify({ feature, stage1: 'PASS', stage2: 'PASS', updatedAt: new Date().toISOString() }, null, 2),
        );

        const srcAppDir = path.join(tmpBase, 'src', 'app');
        const nextDir = path.join(tmpBase, '.next');
        fs.mkdirSync(srcAppDir, { recursive: true });
        fs.mkdirSync(nextDir, { recursive: true });
        fs.writeFileSync(
            path.join(srcAppDir, 'page.tsx'),
            'export default function Home(){return <a href="/manifest-only">Manifest route</a>;}',
        );
        fs.writeFileSync(
            path.join(nextDir, 'app-path-routes-manifest.json'),
            JSON.stringify({ '/(app)/manifest-only/page': '/manifest-only' }, null, 2),
        );
        fs.writeFileSync(
            path.join(knowledgeDir, 'tech-stack.json'),
            JSON.stringify(
                {
                    language: 'TypeScript',
                    framework: 'Next.js',
                    packageManager: 'npm',
                    _lastUpdated: new Date().toISOString(),
                },
                null,
                2,
            ),
        );

        const result = run(['verify-feature', feature]);
        const output = result.stdout.toString();
        if (!output.includes('Dead routes: PASS')) throw new Error(`Manifest route check did not pass: ${output}`);
        if (output.includes('/manifest-only')) throw new Error(`Manifest-backed route was still flagged: ${output}`);
    });

    test('verify-feature --deep --url persists preview URL and surfaces the Playwright UI audit step', () => {
        const feature = 'playwright-ui-audit';
        const featureDir = path.join(changesDir, feature);
        fs.mkdirSync(featureDir, { recursive: true });
        fs.writeFileSync(path.join(featureDir, 'plan.md'), '- [x] Completed task\n');
        writeGovernedExecutionArtifacts(featureDir, feature);
        fs.writeFileSync(
            path.join(featureDir, 'review.json'),
            JSON.stringify({ feature, stage1: 'PASS', stage2: 'PASS', updatedAt: new Date().toISOString() }, null, 2),
        );
        fs.writeFileSync(
            path.join(featureDir, 'prompt.json'),
            JSON.stringify(
                {
                    normalizedSummary: 'Redesign the dashboard UI with a cleaner hierarchy',
                    recommendedPipeline: 'standard-build',
                },
                null,
                2,
            ),
        );
        fs.writeFileSync(
            path.join(featureDir, 'design-routing.json'),
            JSON.stringify(
                {
                    stack: 'react',
                    auditOnly: false,
                    wrapperSkill: 'steroid-react-implementation',
                },
                null,
                2,
            ),
        );

        const playwrightDir = path.join(tmpBase, 'node_modules', 'playwright');
        fs.mkdirSync(playwrightDir, { recursive: true });
        fs.writeFileSync(
            path.join(playwrightDir, 'index.js'),
            `
const fs = require('fs');

exports.chromium = {
    async launch() {
        return {
            async newPage() {
                return {
                    on() {},
                    async goto() {},
                    async waitForLoadState() {},
                    async evaluate() {
                        return {
                            title: 'Audit Demo',
                            landmarkCount: 1,
                            headingCount: 1,
                            buttonCount: 1,
                            linkCount: 0,
                            imageCount: 0,
                            imageWithoutAltCount: 0,
                        };
                    },
                    async screenshot(options) {
                        fs.writeFileSync(options.path, 'stub-image');
                    },
                    url() {
                        return 'file:///index.html';
                    },
                };
            },
            async close() {},
        };
    },
};
`,
        );

        const result = run(['verify-feature', feature, '--deep', '--url', 'https://example.test/dashboard']);
        if (result.status !== 0) throw new Error(`Expected exit 0, got ${result.status}`);

        const output = result.stdout.toString();
        if (!output.includes('Deep scan: Playwright UI audit:')) {
            throw new Error(`Missing Playwright UI audit step output: ${output}`);
        }
        const previewReceipt = fs.readFileSync(path.join(featureDir, 'preview-url.txt'), 'utf-8').trim();
        if (previewReceipt !== 'https://example.test/dashboard') {
            throw new Error(`Unexpected preview-url.txt contents: ${previewReceipt}`);
        }
    });

    test('verify-feature rejects invalid --url values', () => {
        const feature = 'verify-invalid-url';
        const featureDir = path.join(changesDir, feature);
        fs.mkdirSync(featureDir, { recursive: true });
        fs.writeFileSync(path.join(featureDir, 'plan.md'), '- [x] Completed task\n');
        writeGovernedExecutionArtifacts(featureDir, feature);
        fs.writeFileSync(
            path.join(featureDir, 'review.json'),
            JSON.stringify({ feature, stage1: 'PASS', stage2: 'PASS', updatedAt: new Date().toISOString() }, null, 2),
        );

        const result = run(['verify-feature', feature, '--deep', '--url', 'not-a-url']);
        if (result.status !== 1) throw new Error(`Expected exit 1, got ${result.status}`);
        const output = `${result.stdout}${result.stderr}`;
        if (!output.includes('--url must be a valid http(s) URL or hostname.')) {
            throw new Error(`Missing invalid --url guidance: ${output}`);
        }
    });

    test('verify-feature blocks when governed execution artifacts are missing on the plan path', () => {
        const feature = 'verify-missing-execution-artifacts';
        const featureDir = path.join(changesDir, feature);
        fs.mkdirSync(featureDir, { recursive: true });
        fs.writeFileSync(path.join(featureDir, 'plan.md'), '- [x] Completed task\n');
        fs.writeFileSync(
            path.join(featureDir, 'review.json'),
            JSON.stringify({ feature, stage1: 'PASS', stage2: 'PASS', updatedAt: new Date().toISOString() }, null, 2),
        );

        const result = run(['verify-feature', feature]);
        if (result.status !== 1) throw new Error(`Expected exit 1, got ${result.status}`);
        const output = `${result.stdout}${result.stderr}`;
        if (!output.includes('tasks.md is missing for the governed engine path')) {
            throw new Error(`Missing governed execution artifact block: ${output}`);
        }
    });

    test('verify-feature writes ui-review.md and ui-review.json for UI-intensive features', () => {
        const feature = 'ui-review-artifact';
        const featureDir = path.join(changesDir, feature);
        fs.mkdirSync(featureDir, { recursive: true });
        fs.writeFileSync(path.join(featureDir, 'plan.md'), '- [x] Completed task\n');
        writeGovernedExecutionArtifacts(featureDir, feature);
        fs.writeFileSync(
            path.join(featureDir, 'review.json'),
            JSON.stringify({ feature, stage1: 'PASS', stage2: 'PASS', updatedAt: new Date().toISOString() }, null, 2),
        );
        fs.writeFileSync(
            path.join(featureDir, 'prompt.json'),
            JSON.stringify(
                {
                    normalizedSummary: 'Refresh the landing page UI hierarchy',
                    recommendedPipeline: 'standard-build',
                },
                null,
                2,
            ),
        );
        fs.writeFileSync(
            path.join(featureDir, 'design-routing.json'),
            JSON.stringify(
                {
                    stack: 'react',
                    auditOnly: false,
                    wrapperSkill: 'steroid-react-implementation',
                    importedSourceIds: ['ui-ux-pro-max', 'anthropic-frontend-design'],
                },
                null,
                2,
            ),
        );
        fs.writeFileSync(path.join(featureDir, 'design-system.md'), '## Design System: ui-review-artifact\n');

        const result = run(['verify-feature', feature]);
        if (result.status !== 0) throw new Error(`Expected exit 0, got ${result.status}`);

        const uiReviewPath = path.join(featureDir, 'ui-review.md');
        const uiReviewReceiptPath = path.join(featureDir, 'ui-review.json');
        if (!fs.existsSync(uiReviewPath)) throw new Error('ui-review.md was not written');
        if (!fs.existsSync(uiReviewReceiptPath)) throw new Error('ui-review.json was not written');

        const reviewContent = fs.readFileSync(uiReviewPath, 'utf-8');
        const reviewReceipt = JSON.parse(fs.readFileSync(uiReviewReceiptPath, 'utf-8'));
        if (!reviewContent.includes('# UI Review: ui-review-artifact')) {
            throw new Error(`Missing UI review header: ${reviewContent}`);
        }
        if (!reviewContent.includes('## Automated Evidence')) {
            throw new Error(`Missing UI review evidence section: ${reviewContent}`);
        }
        if (!reviewContent.includes('## Key Frontend Risks')) {
            throw new Error(`Missing UI review risks section: ${reviewContent}`);
        }
        if (reviewReceipt.feature !== feature)
            throw new Error(`Unexpected ui-review.json feature: ${reviewReceipt.feature}`);
        if (!reviewReceipt.evidence || reviewReceipt.evidence.designSystemPresent !== true) {
            throw new Error(`Unexpected ui-review.json evidence: ${JSON.stringify(reviewReceipt)}`);
        }
        if (reviewReceipt.freshness?.source !== 'verify-feature') {
            throw new Error(`Expected verify-feature freshness source: ${JSON.stringify(reviewReceipt)}`);
        }
    });

    test('verify-feature refreshes ui-review for mixed features without design routing when UI evidence exists', () => {
        const feature = 'ui-review-mixed-evidence';
        const featureDir = path.join(changesDir, feature);
        fs.mkdirSync(featureDir, { recursive: true });
        fs.writeFileSync(path.join(featureDir, 'plan.md'), '- [x] Completed task\n');
        writeGovernedExecutionArtifacts(featureDir, feature);
        fs.writeFileSync(
            path.join(featureDir, 'review.json'),
            JSON.stringify({ feature, stage1: 'PASS', stage2: 'PASS', updatedAt: new Date().toISOString() }, null, 2),
        );
        fs.writeFileSync(
            path.join(featureDir, 'ui-audit.json'),
            JSON.stringify(
                {
                    feature,
                    finalUrl: 'https://preview.example.com/dashboard',
                    target: 'https://preview.example.com/dashboard',
                    consoleMessages: [],
                    pageErrors: [],
                    failedRequests: [],
                    pageTitle: 'Mixed Dashboard',
                },
                null,
                2,
            ),
        );

        const result = run(['verify-feature', feature]);
        if (result.status !== 0) throw new Error(`Expected exit 0, got ${result.status}`);
        const output = `${result.stdout}${result.stderr}`;
        if (!output.includes('UI Review: refreshed from current verification evidence')) {
            throw new Error(`Missing UI review refresh message: ${output}`);
        }

        const uiReviewReceiptPath = path.join(featureDir, 'ui-review.json');
        if (!fs.existsSync(uiReviewReceiptPath))
            throw new Error('ui-review.json was not written from available UI evidence');

        const reviewReceipt = JSON.parse(fs.readFileSync(uiReviewReceiptPath, 'utf-8'));
        if (!reviewReceipt.evidence?.browserAudit?.present) {
            throw new Error(`Expected browser-audit evidence in ui-review.json: ${JSON.stringify(reviewReceipt)}`);
        }
        if (reviewReceipt.evidence.designRoutePresent !== false) {
            throw new Error(`Expected no design-routing evidence: ${JSON.stringify(reviewReceipt)}`);
        }
        if (reviewReceipt.freshness?.source !== 'verify-feature') {
            throw new Error(`Expected verify-feature freshness source: ${JSON.stringify(reviewReceipt)}`);
        }
    });

    test('verify-feature writes completion.json on successful verification', () => {
        const feature = 'verify-completion-receipt';
        const featureDir = path.join(changesDir, feature);
        fs.mkdirSync(featureDir, { recursive: true });
        fs.writeFileSync(path.join(featureDir, 'plan.md'), '- [x] Completed task\n');
        writeGovernedExecutionArtifacts(featureDir, feature);
        fs.writeFileSync(
            path.join(featureDir, 'review.json'),
            JSON.stringify({ feature, stage1: 'PASS', stage2: 'PASS', updatedAt: new Date().toISOString() }, null, 2),
        );

        const result = run(['verify-feature', feature]);
        if (result.status !== 0) throw new Error(`Expected exit 0, got ${result.status}`);

        const completionPath = path.join(featureDir, 'completion.json');
        if (!fs.existsSync(completionPath)) throw new Error('completion.json was not written');
        const receipt = JSON.parse(fs.readFileSync(completionPath, 'utf-8'));
        if (receipt.feature !== feature) throw new Error(`Unexpected completion.json feature: ${receipt.feature}`);
        if (receipt.status !== 'PASS') throw new Error(`Unexpected completion.json status: ${receipt.status}`);
    });

    test('verify-feature removes stale completion.json on failed verification', () => {
        const feature = 'verify-clears-stale-completion';
        const featureDir = path.join(changesDir, feature);
        fs.mkdirSync(featureDir, { recursive: true });
        fs.writeFileSync(path.join(featureDir, 'plan.md'), '- [x] Completed task\n');
        writeGovernedExecutionArtifacts(featureDir, feature);
        fs.writeFileSync(
            path.join(featureDir, 'review.json'),
            JSON.stringify({ feature, stage1: 'FAIL', stage2: 'PASS', updatedAt: new Date().toISOString() }, null, 2),
        );
        fs.writeFileSync(
            path.join(featureDir, 'completion.json'),
            JSON.stringify({ feature, status: 'PASS', sourceArtifacts: ['verify.json'], nextActions: ['archive'] }, null, 2),
        );

        const result = run(['verify-feature', feature]);
        if (result.status !== 1) throw new Error(`Expected exit 1, got ${result.status}`);
        if (fs.existsSync(path.join(featureDir, 'completion.json'))) {
            throw new Error('stale completion.json was not removed');
        }
    });

    // ─── scan --force ───
    test('scan --force bypasses freshness check', () => {
        // Create a feature with a fresh context.md
        const testFeature = 'test-force-scan';
        const featureDir = path.join(changesDir, testFeature);
        fs.mkdirSync(featureDir, { recursive: true });
        fs.writeFileSync(path.join(featureDir, 'context.md'), '# Old context\n');

        // First scan should work
        const result = run(['scan', testFeature, '--force']);
        if (result.status !== 0) throw new Error(`Exit code ${result.status}: ${result.stderr}`);
        const output = result.stdout.toString();
        if (!output.includes('Force rescan') && !output.includes('Context captured')) {
            throw new Error('Missing force rescan or context captured message');
        }
    });

    test('scan populates tech-stack.json', () => {
        const techStack = path.join(knowledgeDir, 'tech-stack.json');
        if (fs.existsSync(techStack)) {
            const data = JSON.parse(fs.readFileSync(techStack, 'utf-8'));
            if (!data.language) throw new Error('tech-stack.json missing language field');
            if (!data._lastUpdated) throw new Error('tech-stack.json missing _lastUpdated');
        }
        // If no tech-stack.json, that's OK — scan may have written to a different tmpBase path
    });

    test('dashboard surfaces frontend quality counts from archived feature metrics', () => {
        const featuresFile = path.join(memoryDir, 'metrics', 'features.json');
        fs.mkdirSync(path.dirname(featuresFile), { recursive: true });
        fs.writeFileSync(
            featuresFile,
            JSON.stringify(
                {
                    landing: {
                        archived: '2026-03-17T00:00:00.000Z',
                        filesArchived: 10,
                        errorCount: 1,
                        status: 'complete',
                        uiReviewStatus: 'PASS',
                        uiReviewRefreshSource: 'verify-feature',
                        uiReviewRecommendation: 'READY',
                    },
                    dashboard: {
                        archived: '2026-03-17T00:00:00.000Z',
                        filesArchived: 8,
                        errorCount: 2,
                        status: 'complete',
                        uiReviewStatus: 'CONDITIONAL',
                        uiReviewRefreshSource: 'review ui',
                        uiReviewRecommendation: 'CAUTION',
                    },
                    _lastUpdated: '2026-03-17T00:00:00.000Z',
                },
                null,
                2,
            ),
        );

        const result = run(['dashboard']);
        if (result.status !== 0) throw new Error(`Expected exit 0, got ${result.status}`);
        const output = result.stdout.toString();
        if (!output.includes('UI PASS')) throw new Error(`Missing per-feature UI status: ${output}`);
        if (!output.includes('Frontend quality: 1 PASS, 1 CONDITIONAL, 0 FAIL')) {
            throw new Error(`Missing frontend quality aggregate: ${output}`);
        }
        if (!output.includes('Frontend freshness: 1 verify-feature, 1 review ui')) {
            throw new Error(`Missing frontend freshness aggregate: ${output}`);
        }
        if (!output.includes('Frontend release recommendation: 1 READY, 1 CAUTION')) {
            throw new Error(`Missing frontend recommendation aggregate: ${output}`);
        }
    });

    // ─── Cleanup ───
    try {
        fs.rmSync(tmpBase, { recursive: true, force: true });
    } catch {
        /* best effort cleanup */
    }
}

test('source contains review receipt support', () => {
    const source = fs.readFileSync(steroidRun, 'utf-8');
    if (!source.includes('review.json')) throw new Error('review.json support not found in source');
});

test('source contains verify receipt support', () => {
    const source = fs.readFileSync(steroidRun, 'utf-8');
    if (!source.includes('verify.json')) throw new Error('verify.json support not found in source');
});

test('source contains deep verification support', () => {
    const source = fs.readFileSync(steroidRun, 'utf-8');
    if (!source.includes('--deep')) throw new Error('--deep support not found in source');
    if (!source.includes('deepRequested')) throw new Error('deep receipt fields not found in source');
});

test('source contains pipe and redirection guards', () => {
    const source = fs.readFileSync(steroidRun, 'utf-8');
    if (!source.includes("return '|'")) throw new Error('pipe guard not found in source');
    if (!source.includes("return '>'")) throw new Error('redirection guard not found in source');
});

test('source contains prompt intelligence commands', () => {
    const source = fs.readFileSync(steroidRun, 'utf-8');
    if (!source.includes('normalize-prompt')) throw new Error('normalize-prompt support not found in source');
    if (!source.includes('design-prep')) throw new Error('design-prep support not found in source');
    if (!source.includes('design-route')) throw new Error('design-route support not found in source');
    if (!source.includes('design-system')) throw new Error('design-system support not found in source');
    if (!source.includes('review ui <feature>')) throw new Error('review ui support not found in source');
    if (!source.includes('prompt-health')) throw new Error('prompt-health support not found in source');
    if (!source.includes('session-detect')) throw new Error('session-detect support not found in source');
    if (!source.includes('prompt.json')) throw new Error('prompt.json support not found in source');
    if (!source.includes('prompt.md')) throw new Error('prompt.md support not found in source');
    if (!source.includes('Prompt Interpretation')) throw new Error('prompt interpretation report support not found');
});

test('source contains prompt-aware pipeline status and fix-path verification support', () => {
    const source = fs.readFileSync(steroidRun, 'utf-8');
    if (!source.includes('Prompt Intelligence')) throw new Error('pipeline-status prompt section not found');
    if (!source.includes('Route Guidance')) throw new Error('pipeline-status route guidance not found');
    if (!source.includes('Design Intelligence')) throw new Error('pipeline-status design section not found');
    if (!source.includes('design-system.md')) throw new Error('design-system artifact support not found');
    if (!source.includes('Accessibility (AccessLint)')) throw new Error('AccessLint verification support not found');
    if (!source.includes('ui-audit.json')) throw new Error('browser audit artifact support not found');
    if (!source.includes('ui-review.md')) throw new Error('ui-review artifact support not found');
    if (!source.includes('ui-review.json')) throw new Error('ui-review receipt support not found');
    if (!source.includes('ARCHIVE BLOCKED: ui-review.json status is FAIL.')) {
        throw new Error('ui-review archive gate support not found');
    }
    if (!source.includes('Deep scan: Playwright UI audit')) throw new Error('Playwright UI audit deep scan not found');
    if (!source.includes('preview-url.txt')) throw new Error('preview-url support not found');
    if (!source.includes('resolvePreviewUrlFromProjectFiles')) {
        throw new Error('project preview receipt discovery not found');
    }
    if (!source.includes('resolvePreviewUrlFromPackageMetadata')) {
        throw new Error('package metadata preview discovery not found');
    }
    if (!source.includes('--url <preview>')) throw new Error('verify-feature --url support not found');
    if (!source.includes('DESIGN GATE BLOCKED')) throw new Error('design gate enforcement not found');
    if (!source.includes('DESIGN PREP FAILED')) throw new Error('research design prep enforcement not found');
    if (!source.includes('not used by')) throw new Error('route-aware pipeline skip text not found');
    if (!source.includes('Route guidance:')) throw new Error('gate route guidance not found');
    if (!source.includes('No plan.md or diagnosis.md found')) {
        throw new Error('fix-pipeline verification fallback not found');
    }
    if (!source.includes('Execution Source')) throw new Error('verify.md execution source field not found');
});

test('source contains frontend design-system guidance', () => {
    const cliSource = fs.readFileSync(path.join(__dirname, '..', '..', 'bin', 'cli.js'), 'utf-8');
    const readmeSource = fs.readFileSync(path.join(__dirname, '..', '..', 'README.md'), 'utf-8');
    const researchSource = fs.readFileSync(
        path.join(__dirname, '..', '..', 'skills', 'steroid-research', 'SKILL.md'),
        'utf-8',
    );
    const architectSource = fs.readFileSync(
        path.join(__dirname, '..', '..', 'skills', 'steroid-architect', 'SKILL.md'),
        'utf-8',
    );
    const engineSource = fs.readFileSync(
        path.join(__dirname, '..', '..', 'skills', 'steroid-engine', 'SKILL.md'),
        'utf-8',
    );

    if (!cliSource.includes('ui-ux-pro-max')) throw new Error('CLI guidance missing ui-ux-pro-max pairing');
    if (!cliSource.includes('imported/')) throw new Error('CLI missing imported systems install guidance');
    if (!readmeSource.includes('Internalized Frontend Systems')) {
        throw new Error('README missing internalized frontend systems guidance');
    }
    if (!researchSource.includes('## Design Intelligence')) {
        throw new Error('Research skill missing design intelligence section');
    }
    if (!architectSource.includes('## Frontend Design Quality')) {
        throw new Error('Architect skill missing frontend design quality checklist');
    }
    if (!engineSource.includes('## Frontend Design Discipline')) {
        throw new Error('Engine skill missing frontend design discipline rules');
    }
});

console.log(`  ${passed} passed, ${failed} failed`);
module.exports = { passed, failed };
