#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const targetDir = process.cwd();
const sourceDir = path.join(__dirname, '..');

// --- Helper Functions (adapted from antigravity-awesome-skills/tools/bin/install.js) ---

function copyRecursiveSync(src, dest, skipGit = true) {
  if (!fs.existsSync(dest)) {
    fs.mkdirSync(dest, { recursive: true });
  }
  const entries = fs.readdirSync(src, { withFileTypes: true });
  for (const entry of entries) {
    if (skipGit && entry.name === '.git') continue;
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyRecursiveSync(srcPath, destPath, skipGit);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

function safeInjectContent(filePath, content, markerStart, markerEnd) {
  // If file doesn't exist, create it with the content
  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, `${markerStart}\n${content}\n${markerEnd}\n`);
    return;
  }
  // If file exists, check if our content is already injected
  const existing = fs.readFileSync(filePath, 'utf-8');
  if (existing.includes(markerStart)) {
    // Replace existing injected block
    const regex = new RegExp(
      escapeRegExp(markerStart) + '[\\s\\S]*?' + escapeRegExp(markerEnd),
      'g'
    );
    const updated = existing.replace(regex, `${markerStart}\n${content}\n${markerEnd}`);
    fs.writeFileSync(filePath, updated);
  } else {
    // Append new block
    fs.appendFileSync(filePath, `\n\n${markerStart}\n${content}\n${markerEnd}\n`);
  }
}

function escapeRegExp(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// --- Installation Targets ---

const targets = [
  { dir: '.agents/skills', label: 'Antigravity / Claude Code' },
  { dir: '.cursor/skills', label: 'Cursor' },
];

// --- Main Installation ---

console.log('');
console.log('╔══════════════════════════════════════════════╗');
console.log('║     🧬 Steroid-Workflow Installer v1.0       ║');
console.log('╚══════════════════════════════════════════════╝');
console.log('');

// Step 1: Install Memory Templates
console.log('📦 [1/4] Installing MemoryCore schema...');
copyRecursiveSync(path.join(sourceDir, 'memory-template'), path.join(targetDir, '.memory'));
console.log('   ✅ .memory/ directory created with execution_state.json, user_vibe.md, project_state.md');

// Step 2: Install Skills into all detected IDE targets
console.log('🧠 [2/4] Installing Steroid skills...');
let installed = false;
for (const target of targets) {
  const destPath = path.join(targetDir, target.dir);
  // Always install to the first target. For others, only if the parent dir exists.
  if (target === targets[0] || fs.existsSync(path.dirname(destPath))) {
    copyRecursiveSync(path.join(sourceDir, 'skills'), destPath);
    console.log(`   ✅ Skills installed to ${target.dir}/ (${target.label})`);
    installed = true;
  }
}
// Also install the raw forks so the engine can reference them
copyRecursiveSync(path.join(sourceDir, 'src', 'forks'), path.join(targetDir, 'src', 'forks'));
console.log('   ✅ Raw ecosystem forks installed to src/forks/ (superpowers, memorycore)');

if (!installed) {
  console.error('   ❌ No valid skill target directory found.');
  process.exit(1);
}

// Step 3: Inject IDE Trigger Rules (The Maestro)
console.log('🔌 [3/4] Injecting Maestro IDE triggers...');

const MARKER_START = '<!-- STEROID-WORKFLOW-START -->';
const MARKER_END = '<!-- STEROID-WORKFLOW-END -->';

const maestroContent = `# Steroid-Workflow Maestro (Auto-Trigger Rules)

## Intent Routing
If the user says words like "build", "create", "design", or "make" in the context of generating a new feature or project:
- AUTOMATICALLY invoke the \`@steroid-vibe-capture\` skill to begin the workflow.
- Do not ask for permission. Just start the Vibe Translation process.

If \`synapse-skills\` is detected in this environment, map specific intents (e.g., "build ui") to specialized skills, but default high-level vibe intents to \`@steroid-vibe-capture\`.

## Circuit Breaker Enforcement
ALL terminal commands during development MUST be wrapped in:
\`npx steroid-run '<command>'\`
Direct terminal execution is strictly forbidden.

## Context Wipe Mandate
After completing each task in \`.memory/project_state.md\`, terminate the current sub-agent context and start a fresh one.
This prevents hallucination cascades from poisoning multiple tasks.
Each new task reads ONLY from \`.memory/project_state.md\` — no inherited context.

## Anti-Summarization Rule
NEVER summarize code. NEVER write "...rest of code here..." or "// existing code".
If a file needs modification, write the complete replacement or use precise edits.`;

const geminiMdPath = path.join(targetDir, 'GEMINI.md');
const cursorRulesPath = path.join(targetDir, '.cursorrules');

safeInjectContent(geminiMdPath, maestroContent, MARKER_START, MARKER_END);
console.log('   ✅ Maestro rules injected into GEMINI.md');

safeInjectContent(cursorRulesPath, maestroContent, MARKER_START, MARKER_END);
console.log('   ✅ Maestro rules injected into .cursorrules');

// Step 4: Done
console.log('');
console.log('╔══════════════════════════════════════════════╗');
console.log('║  ✅ Steroid-Workflow installed successfully!  ║');
console.log('╚══════════════════════════════════════════════╝');
console.log('');
console.log('The environment is locked and loaded.');
console.log('Just tell your AI what you want to build:');
console.log('');
console.log('  👉 "Build me a minimal to-do app that looks like Notion"');
console.log('  👉 "Create a dashboard for tracking my daily habits"');
console.log('');
