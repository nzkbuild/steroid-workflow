#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const targetDir = process.cwd();
const sourceDir = path.join(__dirname, '..');

// Helper to copy entire directories recursively
function copyDir(src, dest) {
  if (!fs.existsSync(dest)) {
    fs.mkdirSync(dest, { recursive: true });
  }
  const entries = fs.readdirSync(src, { withFileTypes: true });

  for (let entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    if (entry.isDirectory()) {
      copyDir(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

console.log('🧠 Initializing MemoryCore schema...');
copyDir(path.join(sourceDir, 'memory-template'), path.join(targetDir, '.memory'));

console.log('🚀 Injecting Steroid-Workflow skills...');
copyDir(path.join(sourceDir, 'skills'), path.join(targetDir, '.agents', 'skills'));

// Auto-inject IDE zero-friction triggers
console.log('🔌 Setting up Zero-Friction IDE Triggers...');
const geminiMdPath = path.join(targetDir, 'GEMINI.md');
const cursorRulesPath = path.join(targetDir, '.cursorrules');

const triggerContent = `
# Steroid-Workflow Auto-Trigger
If the user says words like "build", "create", "design", or "make" in the context of generating a new feature or project:
AUTOMATICALLY invoke the \`@steroid-vibe-capture\` skill to begin the workflow. 
Do not ask for permission, just start the Vibe Translation process.

If \`synapse-skills\` is detected in this environment, map "build ui" -> \`@frontend-design\` naturally, but default high-level vibe intents to \`@steroid-vibe-capture\`.
`;

if (!fs.existsSync(geminiMdPath)) {
  fs.writeFileSync(geminiMdPath, triggerContent);
} else {
  fs.appendFileSync(geminiMdPath, '\n' + triggerContent);
}

if (!fs.existsSync(cursorRulesPath)) {
  fs.writeFileSync(cursorRulesPath, triggerContent);
} else {
  fs.appendFileSync(cursorRulesPath, '\n' + triggerContent);
}

console.log('\n✅ Steroid-Workflow installed successfully!');
console.log('The environment is locked and loaded.');
console.log('No need to manually type skill names anymore. Just tell your AI:');
console.log('👉 "Build me a minimal to-do app that looks like Notion"');
