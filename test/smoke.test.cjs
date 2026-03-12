#!/usr/bin/env node
const { execSync } = require('child_process');
const path = require('path');

const cli = path.join(__dirname, '..', 'bin', 'steroid-run.cjs');
let passed = 0;
let failed = 0;

function test(name, fn) {
    try {
        fn();
        passed++;
        console.log(`  \u2705 ${name}`);
    } catch (e) {
        failed++;
        console.log(`  \u274c ${name}: ${e.message}`);
    }
}

function run(cmd, expectExit = 0) {
    try {
        const out = execSync(`node "${cli}" ${cmd}`, {
            encoding: 'utf-8',
            timeout: 5000,
            cwd: __dirname,
        });
        if (expectExit !== 0) throw new Error(`Expected exit ${expectExit}, got 0`);
        return out;
    } catch (e) {
        if (e.status === expectExit) return (e.stderr || '') + (e.stdout || '');
        throw new Error(`Exit ${e.status}, expected ${expectExit}`);
    }
}

console.log('\n[smoke] Running steroid-run.cjs smoke tests...\n');

// --- Help & Status ---
test('--help exits 0', () => run('--help'));
test('status exits 0', () => run('status'));

// --- Intent Detection ---
test('detect-intent "build a dashboard" returns build', () => {
    const out = run('detect-intent "build a dashboard"');
    if (!out.includes('build')) throw new Error(`Got: ${out.trim()}`);
});
test('detect-intent "fix the login bug" returns fix', () => {
    const out = run('detect-intent "fix the login bug"');
    if (!out.includes('fix')) throw new Error(`Got: ${out.trim()}`);
});
test('detect-intent "refactor the API layer" returns refactor', () => {
    const out = run('detect-intent "refactor the API layer"');
    if (!out.includes('refactor')) throw new Error(`Got: ${out.trim()}`);
});
test('detect-intent "migrate to PostgreSQL" returns migrate', () => {
    const out = run('detect-intent "migrate to PostgreSQL"');
    if (!out.includes('migrate')) throw new Error(`Got: ${out.trim()}`);
});
test('detect-intent "document the API" returns document', () => {
    const out = run('detect-intent "document the API"');
    if (!out.includes('document')) throw new Error(`Got: ${out.trim()}`);
});

// --- Input Validation ---
test('gate with no args exits 1', () => run('gate', 1));
test('gate with unknown phase exits 1', () => run('gate fakephase test', 1));
test('init-feature with bad name exits 1', () => run('init-feature BAD_NAME', 1));
test('init-feature with spaces exits 1', () => run('init-feature "has spaces"', 1));
test('commit with no message exits 1', () => run('commit', 1));
test('log with no args exits 1', () => run('log', 1));
test('check-plan with no args exits 1', () => run('check-plan', 1));
test('archive with no args exits 1', () => run('archive', 1));
test('detect-intent with no message exits 1', () => run('detect-intent', 1));

// --- v4.0: Memory Commands ---
test('memory --help exits 0', () => run('memory --help'));
test('memory show with bad store exits 1', () => run('memory show badstore', 1));
test('memory show-all exits 0', () => run('memory show-all'));
test('memory stats exits 0', () => run('memory stats'));
test('memory write with no json exits 1', () => run('memory write tech-stack', 1));
test('memory write with bad json exits 1', () => run('memory write tech-stack {bad', 1));

// --- v4.0: Recovery Commands ---
test('recover exits 0 when no errors', () => run('recover'));

// --- v4.0: Stories Commands ---
test('stories with no feature exits 1', () => run('stories', 1));

console.log(`\n[smoke] ${passed} passed, ${failed} failed\n`);
process.exit(failed > 0 ? 1 : 0);
