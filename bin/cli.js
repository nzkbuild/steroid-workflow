#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const targetDir = process.cwd();
const sourceDir = path.join(__dirname, '..');
const pkg = require(path.join(sourceDir, 'package.json'));

// --- Argument Parsing (P0 Fix A4) ---
const args = process.argv.slice(2);

if (args.includes('--help') || args.includes('-h')) {
  console.log(`
steroid-workflow v${pkg.version}
${pkg.description}

Usage:
  npx steroid-workflow init          Install Steroid-Workflow into the current project
  npx steroid-workflow init --force  Overwrite existing .memory/ state
  npx steroid-workflow --help        Show this help
  npx steroid-workflow --version     Show version
`);
  process.exit(0);
}

if (args.includes('--version') || args.includes('-v')) {
  console.log(`steroid-workflow v${pkg.version}`);
  process.exit(0);
}

// Default action is 'init'
const forceMode = args.includes('--force');

// --- Helper Functions ---

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
  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, `${markerStart}\n${content}\n${markerEnd}\n`);
    return;
  }
  const existing = fs.readFileSync(filePath, 'utf-8');
  if (existing.includes(markerStart)) {
    const regex = new RegExp(
      escapeRegExp(markerStart) + '[\\s\\S]*?' + escapeRegExp(markerEnd),
      'g'
    );
    const updated = existing.replace(regex, `${markerStart}\n${content}\n${markerEnd}`);
    fs.writeFileSync(filePath, updated);
  } else {
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
console.log(`║     🧬 Steroid-Workflow Installer v${pkg.version}      ║`);
console.log('╚══════════════════════════════════════════════╝');
console.log('');

// Step 1: Install Memory Templates (P0 Fix A2: overwrite protection)
const memoryDir = path.join(targetDir, '.memory');
if (fs.existsSync(memoryDir) && !forceMode) {
  console.log('📦 [1/5] MemoryCore schema...');
  console.log('   ⚠️  .memory/ already exists. Skipping to preserve your project state.');
  console.log('   (Use --force to overwrite)');
} else {
  console.log('📦 [1/5] Installing MemoryCore schema...');
  copyRecursiveSync(path.join(sourceDir, 'memory-template'), memoryDir);
  console.log('   ✅ .memory/ created with execution_state.json, user_vibe.md, project_state.md');
}

// Step 2: Install Skills into all detected IDE targets
console.log('🧠 [2/5] Installing Steroid skills...');
let installed = false;
for (const target of targets) {
  const destPath = path.join(targetDir, target.dir);
  if (target === targets[0] || fs.existsSync(path.dirname(destPath))) {
    copyRecursiveSync(path.join(sourceDir, 'skills'), destPath);
    console.log(`   ✅ Skills installed to ${target.dir}/ (${target.label})`);
    installed = true;
  }
}

// Step 3: Install raw forks
copyRecursiveSync(path.join(sourceDir, 'src', 'forks'), path.join(targetDir, 'src', 'forks'));
console.log('   ✅ Raw ecosystem forks installed to src/forks/');

if (!installed) {
  console.error('   ❌ No valid skill target directory found.');
  process.exit(1);
}

// Step 4: Inject IDE Trigger Rules (The Maestro)
console.log('🔌 [3/5] Injecting Maestro IDE triggers...');

const MARKER_START = '<!-- STEROID-WORKFLOW-START -->';
const MARKER_END = '<!-- STEROID-WORKFLOW-END -->';

const maestroContent = `# Steroid-Workflow Maestro (Auto-Trigger Rules)

## Intent Routing
If the user says words like "build", "create", "design", or "make" in the context of generating a new feature or project:
- Read the file at \`.agents/skills/steroid-vibe-capture/SKILL.md\` and follow its instructions immediately.
- Do not ask for permission. Just start the Vibe Translation process.

## Circuit Breaker Enforcement (CRITICAL — REPEATED IN EVERY SKILL)
ALL terminal commands during development MUST be wrapped in:
\`npx steroid-run '<command>'\`
Direct terminal execution (\`npm install\`, \`npx jest\`, \`node script.js\`, etc.) is STRICTLY FORBIDDEN.
If you need to run \`npm install\`, you must run: \`npx steroid-run 'npm install'\`
This is a non-negotiable physical constraint. The wrapper tracks errors and will hard-stop at 3.

## Context Wipe Mandate
After completing each task in \`.memory/project_state.md\`, terminate the current sub-agent context and start a fresh one.
This prevents hallucination cascades from poisoning multiple tasks.
Each new task reads ONLY from \`.memory/project_state.md\` — no inherited context.

## Anti-Summarization Rule
NEVER summarize code. NEVER write "...rest of code here..." or "// existing code".
NEVER truncate file contents. Write complete replacements or precise edits.`;

const geminiMdPath = path.join(targetDir, 'GEMINI.md');
const cursorRulesPath = path.join(targetDir, '.cursorrules');

safeInjectContent(geminiMdPath, maestroContent, MARKER_START, MARKER_END);
console.log('   ✅ Maestro rules injected into GEMINI.md');

safeInjectContent(cursorRulesPath, maestroContent, MARKER_START, MARKER_END);
console.log('   ✅ Maestro rules injected into .cursorrules');

// Step 5: Inject .gitignore for user project
console.log('📋 [4/5] Setting up .gitignore...');
const userGitignore = path.join(targetDir, '.gitignore');
const gitignoreEntries = ['.memory/', 'src/forks/'];
if (fs.existsSync(userGitignore)) {
  const existing = fs.readFileSync(userGitignore, 'utf-8');
  const toAdd = gitignoreEntries.filter(e => !existing.includes(e));
  if (toAdd.length > 0) {
    fs.appendFileSync(userGitignore, '\n# Steroid-Workflow (auto-added)\n' + toAdd.join('\n') + '\n');
    console.log(`   ✅ Added ${toAdd.join(', ')} to .gitignore`);
  } else {
    console.log('   ✅ .gitignore already has steroid entries');
  }
} else {
  fs.writeFileSync(userGitignore, '# Steroid-Workflow\n.memory/\nsrc/forks/\nnode_modules/\n');
  console.log('   ✅ Created .gitignore with .memory/ and src/forks/ excluded');
}

// Done
console.log('');
console.log('╔══════════════════════════════════════════════╗');
console.log('║  ✅ Steroid-Workflow installed successfully!  ║');
console.log('╚══════════════════════════════════════════════╝');
console.log('');
console.log('Just tell your AI what you want to build:');
console.log('  👉 "Build me a minimal to-do app that looks like Notion"');
console.log('  👉 "Create a dashboard for tracking my daily habits"');
console.log('');
console.log('Helpful commands:');
console.log('  npx steroid-run status    — Check circuit breaker state');
console.log('  npx steroid-run reset     — Reset error counter after fixing issues');
console.log('');
