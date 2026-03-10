#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const targetDir = process.cwd();
const stateFile = path.join(targetDir, '.memory', 'execution_state.json');

// Ensure the memory file exists, if not, create a default
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

// 1. The Circuit Breaker Check
if (state.error_count >= 3) {
    console.error(`
========================================================================
[STEROID-CIRCUIT-BREAKER TRIPPED]
Maximum error tolerance reached (3/3). 
AI Agent: YOU ARE ORDERED TO STOP TERMINAL EXECUTION IMMEDIATELY.
DO NOT RUN DESTRUCTIVE COMMANDS. DO NOT ATTEMPT TO SILENTLY FIX THIS.
Present the user with the exact error log and file context, and ask for 
human validation to pivot the architecture or manually intervene.
========================================================================
`);
    process.exit(1);
}

// Extract the command to run
const args = process.argv.slice(2);
if (args.length === 0) {
    console.error("Usage: npx steroid-run <command> OR npx steroid-run verify <file> --min-lines=<number>");
    process.exit(1);
}

// 2. Verification Mode (Anti-Summarization)
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

    console.log(`[STEROID-VERIFY SUCCESS] File passes length validation (${lineCount} lines).`);
    process.exit(0);
}

// 3. Execution Mode
const commandStr = args.join(' ');
console.log(`[steroid-run] Executing: ${commandStr}`);

// Execute the command in a shell
const child = spawnSync(commandStr, {
    shell: true,
    stdio: 'inherit'
});

// 4. State Machine Update
if (child.status !== 0) {
    state.error_count += 1;
    state.last_error = `Command failed with exit code ${child.status}`;
    console.error(`\n[steroid-run] ERROR: Command failed. Updating error_count to ${state.error_count}/3.`);
} else {
    // Reset on success
    state.error_count = 0;
    state.last_error = null;
    console.log(`\n[steroid-run] SUCCESS: State reset to healthy.`);
}

fs.writeFileSync(stateFile, JSON.stringify(state, null, 2));
process.exit(child.status);
