#!/usr/bin/env node
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');

const { run } = require('../../src/commands/pipeline.cjs');

let passed = 0;
let failed = 0;

function test(name, fn) {
    try {
        fn();
        passed++;
        console.log(`  ✅ ${name}`);
    } catch (error) {
        failed++;
        console.log(`  ❌ ${name}: ${error.message}`);
    }
}

console.log('[unit] pipeline-scan-command-modules.test.cjs');

const tmpBase = path.join(os.tmpdir(), `steroid-pipeline-scan-${Date.now()}`);
const memoryDir = path.join(tmpBase, '.memory');
const changesDir = path.join(memoryDir, 'changes');
const knowledgeDir = path.join(memoryDir, 'knowledge');
fs.mkdirSync(changesDir, { recursive: true });
fs.mkdirSync(knowledgeDir, { recursive: true });

test('scan writes context and tech-stack knowledge for an initialized feature', () => {
    const feature = 'scan-feature';
    const featureDir = path.join(changesDir, feature);
    fs.mkdirSync(featureDir, { recursive: true });
    fs.writeFileSync(
        path.join(tmpBase, 'package.json'),
        JSON.stringify(
            {
                name: 'scan-fixture',
                dependencies: { react: '^19.0.0' },
                devDependencies: { vitest: '^3.0.0' },
                scripts: { test: 'vitest run' },
            },
            null,
            2,
        ),
    );
    fs.writeFileSync(path.join(tmpBase, 'tsconfig.json'), '{}\n');
    fs.mkdirSync(path.join(tmpBase, 'src'), { recursive: true });
    fs.writeFileSync(path.join(tmpBase, 'src', 'app.test.ts'), 'test("x", () => {});\n');

    const result = run(['scan', feature], { targetDir: tmpBase });
    if (result.exitCode !== 0) throw new Error(`Unexpected exitCode: ${result.exitCode}`);
    if (!result.stdout.includes('Context captured: TypeScript/React')) throw new Error(`Unexpected stdout: ${result.stdout}`);

    const contextPath = path.join(featureDir, 'context.md');
    if (!fs.existsSync(contextPath)) throw new Error('context.md missing');
    const techStackPath = path.join(knowledgeDir, 'tech-stack.json');
    if (!fs.existsSync(techStackPath)) throw new Error('tech-stack.json missing');
    const techStack = JSON.parse(fs.readFileSync(techStackPath, 'utf-8'));
    if (techStack.language !== 'TypeScript') throw new Error(`Unexpected language: ${techStack.language}`);
    if (!String(techStack.framework).includes('React')) throw new Error(`Unexpected framework: ${techStack.framework}`);
});

test('scan skips fresh context unless --force is provided', () => {
    const feature = 'fresh-feature';
    const featureDir = path.join(changesDir, feature);
    fs.mkdirSync(featureDir, { recursive: true });
    fs.writeFileSync(path.join(featureDir, 'context.md'), '# Fresh context\n');

    const result = run(['scan', feature], { targetDir: tmpBase });
    if (result.exitCode !== 0) throw new Error(`Unexpected exitCode: ${result.exitCode}`);
    if (!result.stdout.includes('Context already captured')) throw new Error(`Unexpected stdout: ${result.stdout}`);
});

test('scan --force bypasses freshness and refreshes context', () => {
    const feature = 'force-feature';
    const featureDir = path.join(changesDir, feature);
    fs.mkdirSync(featureDir, { recursive: true });
    fs.writeFileSync(path.join(featureDir, 'context.md'), '# Old context\n');

    const result = run(['scan', feature, '--force'], { targetDir: tmpBase });
    if (result.exitCode !== 0) throw new Error(`Unexpected exitCode: ${result.exitCode}`);
    if (!result.stdout.includes('Force rescan requested')) throw new Error(`Unexpected stdout: ${result.stdout}`);
});

console.log(`  ${passed} passed, ${failed} failed`);
module.exports = { passed, failed };
