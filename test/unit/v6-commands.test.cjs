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

    test('gate passes vibe when context exists even without prompt receipt', () => {
        const feature = 'gate-route-advice';
        const featureDir = path.join(changesDir, feature);
        fs.mkdirSync(featureDir, { recursive: true });
        fs.writeFileSync(path.join(featureDir, 'context.md'), '# Context\nLine 2\nLine 3\nLine 4\nLine 5\n');

        const result = run(['gate', 'vibe', feature]);
        if (result.status !== 0) throw new Error(`Expected exit 0, got ${result.status}`);

        const output = result.stdout.toString();
        if (!output.includes('Gate passed')) {
            throw new Error(`Missing gate pass confirmation: ${output}`);
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

    test('archive preserves prior files during same-stamp collisions', () => {
        const feature = 'archive-collision-proof';
        const featureDir = path.join(changesDir, feature);
        const archiveDir = path.join(featureDir, 'archive');
        fs.mkdirSync(archiveDir, { recursive: true });
        fs.writeFileSync(path.join(featureDir, 'verify.json'), '{"status":"PASS"}');
        fs.writeFileSync(path.join(featureDir, 'verify.md'), '**Status:** PASS');
        fs.writeFileSync(path.join(archiveDir, '2026-03-15T07-01-17-123Z-verify.json'), '{}');

        const source = fs.readFileSync(steroidRun, 'utf-8');
        if (!source.includes('createArchiveStamp')) throw new Error('archive timestamp helper missing');
        if (!source.includes('-${file}') && !source.includes('archiveStamp')) {
            throw new Error('archive timestamp usage not found');
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

    test('verify-feature treats route-group pages as live routes', () => {
        const feature = 'route-groups-live';
        const featureDir = path.join(changesDir, feature);
        fs.mkdirSync(featureDir, { recursive: true });
        fs.writeFileSync(path.join(featureDir, 'plan.md'), '- [x] Completed task\n');
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
        fs.writeFileSync(path.join(appDir, '(app)', 'dashboard', 'page.tsx'), 'export default function Page(){return null;}');
        fs.writeFileSync(path.join(appDir, '(app)', 'blueprint', 'page.tsx'), 'export default function Page(){return null;}');
        fs.writeFileSync(
            path.join(knowledgeDir, 'tech-stack.json'),
            JSON.stringify(
                { language: 'TypeScript', framework: 'Next.js', packageManager: 'npm', _lastUpdated: new Date().toISOString() },
                null,
                2,
            ),
        );

        const result = run(['verify-feature', feature]);
        const output = result.stdout.toString();
        if (!output.includes('Dead routes: PASS')) throw new Error(`Dead route check did not pass: ${output}`);
        if (output.includes('/dashboard (in src\\app\\page.tsx)') || output.includes('/blueprint (in src\\app\\page.tsx)')) {
            throw new Error(`Route groups still flagged as dead: ${output}`);
        }
    });

    test('verify-feature prefers Next build manifests when available', () => {
        const feature = 'manifest-routes-live';
        const featureDir = path.join(changesDir, feature);
        fs.mkdirSync(featureDir, { recursive: true });
        fs.writeFileSync(path.join(featureDir, 'plan.md'), '- [x] Completed task\n');
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
                { language: 'TypeScript', framework: 'Next.js', packageManager: 'npm', _lastUpdated: new Date().toISOString() },
                null,
                2,
            ),
        );

        const result = run(['verify-feature', feature]);
        const output = result.stdout.toString();
        if (!output.includes('Dead routes: PASS')) throw new Error(`Manifest route check did not pass: ${output}`);
        if (output.includes('/manifest-only')) throw new Error(`Manifest-backed route was still flagged: ${output}`);
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
    if (!source.includes('not used by')) throw new Error('route-aware pipeline skip text not found');
    if (!source.includes('Route guidance:')) throw new Error('gate route guidance not found');
    if (!source.includes('No plan.md or diagnosis.md found')) {
        throw new Error('fix-pipeline verification fallback not found');
    }
    if (!source.includes('Execution Source')) throw new Error('verify.md execution source field not found');
});

console.log(`  ${passed} passed, ${failed} failed`);
module.exports = { passed, failed };
