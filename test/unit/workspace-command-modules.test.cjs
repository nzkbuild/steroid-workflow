#!/usr/bin/env node
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const {
    handleFsMkdir,
    handleFsRm,
    handleFsCat,
    handleFsCp,
    handleFsMv,
    handleFsFind,
    handleFsGrep,
    handleFsLs,
} = require('../../src/commands/workspace.cjs');

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

console.log('[unit] workspace-command-modules.test.cjs');

const tmpBase = path.join(os.tmpdir(), `steroid-workspace-modules-${Date.now()}`);
fs.mkdirSync(tmpBase, { recursive: true });
fs.mkdirSync(path.join(tmpBase, '.memory'), { recursive: true });

test('handleFsMkdir creates nested directories', () => {
    const result = handleFsMkdir(['fs-mkdir', 'deep/nested/dir'], { targetDir: tmpBase });
    if (result.exitCode !== 0) throw new Error(`Unexpected exitCode: ${result.exitCode}`);
    if (!fs.existsSync(path.join(tmpBase, 'deep', 'nested', 'dir'))) throw new Error('Directory not created');
});

test('handleFsRm deletes ordinary directories', () => {
    fs.mkdirSync(path.join(tmpBase, 'remove-me'), { recursive: true });
    fs.writeFileSync(path.join(tmpBase, 'remove-me', 'file.txt'), 'test');
    const result = handleFsRm(['fs-rm', 'remove-me'], { targetDir: tmpBase });
    if (result.exitCode !== 0) throw new Error(`Unexpected exitCode: ${result.exitCode}`);
    if (fs.existsSync(path.join(tmpBase, 'remove-me'))) throw new Error('Directory still exists');
});

test('handleFsRm protects .memory', () => {
    const result = handleFsRm(['fs-rm', '.memory'], { targetDir: tmpBase });
    if (result.exitCode !== 1) throw new Error(`Unexpected exitCode: ${result.exitCode}`);
    if (!result.stderr.includes('protected path')) throw new Error(`Unexpected stderr: ${result.stderr}`);
});

test('handleFsCat supports --head and emits file contents', () => {
    fs.writeFileSync(path.join(tmpBase, 'head.txt'), 'a\nb\nc\nd\n');
    const result = handleFsCat(['fs-cat', 'head.txt', '--head=2'], { targetDir: tmpBase });
    if (result.exitCode !== 0) throw new Error(`Unexpected exitCode: ${result.exitCode}`);
    if (!result.stdout.includes('a') || !result.stdout.includes('b')) throw new Error(`Missing expected lines: ${result.stdout}`);
    if (result.stdout.includes('\nc\n')) throw new Error(`Printed too many lines: ${result.stdout}`);
});

test('handleFsCat supports optional fallback behavior', () => {
    const result = handleFsCat(['fs-cat', 'missing-a.txt', 'missing-b.txt', '--optional'], { targetDir: tmpBase });
    if (result.exitCode !== 0) throw new Error(`Unexpected exitCode: ${result.exitCode}`);
    if (!result.stdout.includes('No matching file found')) throw new Error(`Unexpected stdout: ${result.stdout}`);
});

test('handleFsCp copies files and directories', () => {
    fs.writeFileSync(path.join(tmpBase, 'copy-source.txt'), 'hello');
    let result = handleFsCp(['fs-cp', 'copy-source.txt', 'copy-dest.txt'], { targetDir: tmpBase });
    if (result.exitCode !== 0) throw new Error(`Unexpected exitCode for file copy: ${result.exitCode}`);
    if (fs.readFileSync(path.join(tmpBase, 'copy-dest.txt'), 'utf-8') !== 'hello') {
        throw new Error('Copied file content mismatch');
    }

    const srcDir = path.join(tmpBase, 'copy-dir-src');
    fs.mkdirSync(path.join(srcDir, 'sub'), { recursive: true });
    fs.writeFileSync(path.join(srcDir, 'sub', 'nested.txt'), 'nested');
    result = handleFsCp(['fs-cp', 'copy-dir-src', 'copy-dir-dest'], { targetDir: tmpBase });
    if (result.exitCode !== 0) throw new Error(`Unexpected exitCode for dir copy: ${result.exitCode}`);
    if (!fs.existsSync(path.join(tmpBase, 'copy-dir-dest', 'sub', 'nested.txt'))) {
        throw new Error('Copied directory content missing');
    }
});

test('handleFsMv moves files', () => {
    fs.writeFileSync(path.join(tmpBase, 'move-source.txt'), 'move');
    const result = handleFsMv(['fs-mv', 'move-source.txt', 'move-dest.txt'], { targetDir: tmpBase });
    if (result.exitCode !== 0) throw new Error(`Unexpected exitCode: ${result.exitCode}`);
    if (fs.existsSync(path.join(tmpBase, 'move-source.txt'))) throw new Error('Source file still exists');
    if (fs.readFileSync(path.join(tmpBase, 'move-dest.txt'), 'utf-8') !== 'move') {
        throw new Error('Moved file content mismatch');
    }
});

test('handleFsFind locates files by glob and supports count mode', () => {
    fs.mkdirSync(path.join(tmpBase, 'find-src'), { recursive: true });
    fs.writeFileSync(path.join(tmpBase, 'find-src', 'alpha.test.ts'), 'test');
    fs.writeFileSync(path.join(tmpBase, 'find-src', 'beta.js'), 'test');

    let result = handleFsFind(['fs-find', 'find-src', '--name=*.test.*', '--type=file'], { targetDir: tmpBase });
    if (result.exitCode !== 0) throw new Error(`Unexpected exitCode: ${result.exitCode}`);
    if (!result.stdout.includes('alpha.test.ts')) throw new Error(`Missing find result: ${result.stdout}`);

    result = handleFsFind(['fs-find', 'find-src', '--name=*.test.*', '--type=file', '--count'], {
        targetDir: tmpBase,
    });
    if (result.exitCode !== 0) throw new Error(`Unexpected count exitCode: ${result.exitCode}`);
    if (!result.stdout.includes('1')) throw new Error(`Unexpected count output: ${result.stdout}`);
});

test('handleFsGrep prints matching lines and supports files-with-matches', () => {
    fs.mkdirSync(path.join(tmpBase, 'grep-src'), { recursive: true });
    fs.writeFileSync(path.join(tmpBase, 'grep-src', 'file.ts'), 'const a = 1;\n// TODO: fix\n');
    let result = handleFsGrep(['fs-grep', 'TODO|FIXME', 'grep-src', '--include=*.ts'], { targetDir: tmpBase });
    if (result.exitCode !== 0) throw new Error(`Unexpected exitCode: ${result.exitCode}`);
    if (!result.stdout.includes('file.ts:2:')) throw new Error(`Missing grep line output: ${result.stdout}`);

    result = handleFsGrep(['fs-grep', 'TODO|FIXME', 'grep-src', '--include=*.ts', '--files-with-matches'], {
        targetDir: tmpBase,
    });
    if (result.exitCode !== 0) throw new Error(`Unexpected files-with-matches exitCode: ${result.exitCode}`);
    if (!result.stdout.includes('file.ts')) throw new Error(`Missing grep file output: ${result.stdout}`);
});

test('handleFsLs renders a tree header', () => {
    fs.mkdirSync(path.join(tmpBase, 'tree-dir'), { recursive: true });
    fs.writeFileSync(path.join(tmpBase, 'tree-dir', 'file.txt'), 'tree');
    const result = handleFsLs(['fs-ls', 'tree-dir'], { targetDir: tmpBase });
    if (result.exitCode !== 0) throw new Error(`Unexpected exitCode: ${result.exitCode}`);
    if (!result.stdout.includes('📂 tree-dir/')) throw new Error(`Missing header: ${result.stdout}`);
    if (!result.stdout.includes('file.txt')) throw new Error(`Missing file entry: ${result.stdout}`);
});

console.log(`  ${passed} passed, ${failed} failed`);
module.exports = { passed, failed };
