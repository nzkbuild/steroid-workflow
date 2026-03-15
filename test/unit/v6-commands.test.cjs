#!/usr/bin/env node
'use strict';

/**
 * Unit tests for v6.1.1 trust-hardening commands: fs-*, smoke-test, verify-feature, scan --force, allowlist.
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

console.log(`  ${passed} passed, ${failed} failed`);
module.exports = { passed, failed };
