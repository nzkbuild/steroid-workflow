#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const targetDir = process.cwd();
const stateFile = path.join(targetDir, '.memory', 'execution_state.json');

// --- Argument Parsing ---
const args = process.argv.slice(2);

if (args.length === 0 || args[0] === '--help' || args[0] === '-h') {
    console.log(`
steroid-run — The physical circuit breaker for AI-driven development.

Usage:
  npx steroid-run '<command>'                       Execute a command with error tracking
  npx steroid-run verify <file> --min-lines=<n>     Verify file meets minimum line count
  npx steroid-run reset                             Reset the error counter to 0
  npx steroid-run status                            Show current circuit breaker state

The circuit breaker tracks errors in .memory/execution_state.json.
After 3 consecutive errors, all execution is blocked until you run 'reset'.
`);
    process.exit(0);
}

// --- Ensure state file exists ---
if (!fs.existsSync(stateFile)) {
    if (!fs.existsSync(path.dirname(stateFile))) {
        fs.mkdirSync(path.dirname(stateFile), { recursive: true });
    }
    fs.writeFileSync(stateFile, JSON.stringify({ error_count: 0, last_error: null, status: 'active' }, null, 2));
}

let state;
try {
    state = JSON.parse(fs.readFileSync(stateFile, 'utf-8'));
} catch (e) {
    state = { error_count: 0, last_error: null, status: 'active' };
}

// --- Reset Command (P0 Fix B2) ---
if (args[0] === 'reset') {
    state.error_count = 0;
    state.last_error = null;
    state.status = 'active';
    fs.writeFileSync(stateFile, JSON.stringify(state, null, 2));
    console.log('[steroid-run] ✅ Circuit breaker reset. Error count is now 0/3. You may resume.');
    process.exit(0);
}

// --- Status Command ---
if (args[0] === 'status') {
    console.log(`[steroid-run] Circuit Breaker Status:`);
    console.log(`  Error Count: ${state.error_count}/3`);
    console.log(`  Status: ${state.error_count >= 3 ? '🔴 TRIPPED' : '🟢 ACTIVE'}`);
    if (state.last_error) console.log(`  Last Error: ${state.last_error}`);
    process.exit(0);
}

// --- Circuit Breaker Check ---
if (state.error_count >= 3) {
    console.error(`
========================================================================
[STEROID-CIRCUIT-BREAKER TRIPPED] 🛑
Maximum error tolerance reached (3/3).
AI Agent: YOU ARE ORDERED TO STOP TERMINAL EXECUTION IMMEDIATELY.
DO NOT RUN DESTRUCTIVE COMMANDS. DO NOT ATTEMPT TO SILENTLY FIX THIS.
Present the user with the exact error log and file context, and ask for
human validation to pivot the architecture or manually intervene.

To resume after fixing the issue, run:   npx steroid-run reset
========================================================================
`);
    process.exit(1);
}

// --- Verify Command (Anti-Summarization) ---
if (args[0] === 'verify') {
    const targetFile = args[1];
    const minLinesArg = args.find(a => a.startsWith('--min-lines='));

    if (!targetFile || !minLinesArg) {
        console.error("Usage: npx steroid-run verify <file> --min-lines=<number>");
        process.exit(1);
    }

    const minLines = parseInt(minLinesArg.split('=')[1], 10);
    const fullPath = path.resolve(targetDir, targetFile);

    if (!fs.existsSync(fullPath)) {
        console.error(`[STEROID-VERIFY ERROR]: File does not exist at ${fullPath}`);
        process.exit(1);
    }

    const content = fs.readFileSync(fullPath, 'utf-8');
    const lineCount = content.split('\n').length;

    if (lineCount < minLines) {
        console.error(`\n[STEROID-VERIFY ERROR] 🛑 AI SHORTCUT DETECTED 🛑`);
        console.error(`File ${targetFile} has ${lineCount} lines, but requires at least ${minLines} lines.`);
        console.error(`Do not summarize code. You MUST write the full implementation.`);
        process.exit(1);
    }

    console.log(`[STEROID-VERIFY SUCCESS] ✅ File passes validation (${lineCount} lines >= ${minLines} required).`);
    process.exit(0);
}

// --- Execution Mode ---
const commandStr = args.join(' ');
console.log(`[steroid-run] Executing: ${commandStr}`);

const child = spawnSync(commandStr, {
    shell: true,
    stdio: 'inherit'
});

// --- State Machine Update ---
if (child.status !== 0) {
    state.error_count += 1;
    state.last_error = `Command failed: "${commandStr}" (exit code ${child.status})`;
    state.status = state.error_count >= 3 ? 'tripped' : 'active';
    console.error(`\n[steroid-run] ❌ ERROR ${state.error_count}/3. ${state.error_count >= 3 ? 'CIRCUIT BREAKER TRIPPED. Run "npx steroid-run reset" to resume.' : 'Tracking error.'}`);
} else {
    state.error_count = 0;
    state.last_error = null;
    state.status = 'active';
}

fs.writeFileSync(stateFile, JSON.stringify(state, null, 2));
process.exit(child.status);
