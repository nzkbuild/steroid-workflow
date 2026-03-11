#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const targetDir = process.cwd();
const sourceDir = path.join(__dirname, '..');
const pkg = require(path.join(sourceDir, 'package.json'));

// --- Argument Parsing ---
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

// Step 1: Install Memory Templates
const memoryDir = path.join(targetDir, '.memory');
if (fs.existsSync(memoryDir) && !forceMode) {
  console.log('📦 [1/5] MemoryCore schema...');
  console.log('   ⚠️  .memory/ already exists. Skipping to preserve your project state.');
  console.log('   (Use --force to overwrite)');
} else {
  console.log('📦 [1/5] Installing MemoryCore schema...');
  // Copy base templates
  copyRecursiveSync(path.join(sourceDir, 'memory-template'), memoryDir);
  // Create per-change folder structure
  const changesDir = path.join(memoryDir, 'changes');
  if (!fs.existsSync(changesDir)) {
    fs.mkdirSync(changesDir, { recursive: true });
  }
  console.log('   ✅ .memory/ created with execution_state.json, progress.md, and changes/ folder');
}

// Step 2: Install Skills into all detected IDE targets
console.log('🧠 [2/5] Installing Steroid skills (5-skill pipeline)...');
let installed = false;
for (const target of targets) {
  const destPath = path.join(targetDir, target.dir);
  if (target === targets[0] || fs.existsSync(path.dirname(destPath))) {
    copyRecursiveSync(path.join(sourceDir, 'skills'), destPath);
    console.log(`   ✅ Skills installed to ${target.dir}/ (${target.label})`);
    console.log(`      → steroid-vibe-capture → steroid-specify → steroid-research → steroid-architect → steroid-engine`);
    installed = true;
  }
}

// Step 3: Install raw forks (including new ecosystem forks)
copyRecursiveSync(path.join(sourceDir, 'src', 'forks'), path.join(targetDir, 'src', 'forks'));
console.log('   ✅ Raw ecosystem forks installed to src/forks/');
console.log('      → superpowers, memorycore, ralph, gsd, openspec, spec-kit, cc-sdd, bmad-method');

// Step 3b: Copy steroid-run.js into project root (so `node steroid-run.js` always works)
fs.copyFileSync(path.join(sourceDir, 'bin', 'steroid-run.js'), path.join(targetDir, 'steroid-run.js'));
console.log('   ✅ steroid-run.js copied to project root (pipeline enforcer)');

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
- The pipeline will automatically flow: vibe-capture → specify → research → architect → engine

## The 5-Skill Pipeline

| # | Skill | Input | Output |
|---|-------|-------|--------|
| 1 | steroid-vibe-capture | User's natural language | .memory/changes/<feature>/vibe.md |
| 2 | steroid-specify | vibe.md | .memory/changes/<feature>/spec.md |
| 3 | steroid-research | spec.md | .memory/changes/<feature>/research.md |
| 4 | steroid-architect | spec.md + research.md | .memory/changes/<feature>/plan.md |
| 5 | steroid-engine | plan.md | Working code (TDD, loop until done) |

Each skill automatically hands off to the next. No manual invocation needed.

## Circuit Breaker Enforcement (CRITICAL — REPEATED IN EVERY SKILL)
ALL terminal commands during development MUST be wrapped in:
\`node steroid-run.js '<command>'\`
Direct terminal execution (\`npm install\`, \`npx jest\`, \`node script.js\`, etc.) is STRICTLY FORBIDDEN.
If you need to run \`npm install\`, you must run: \`node steroid-run.js 'npm install'\`
This is a non-negotiable physical constraint. The wrapper tracks errors and will hard-stop at 3.

## Pipeline Enforcement Commands (MUST USE)
The AI MUST use these physical commands — they cannot be skipped:
- \`node steroid-run.js init-feature <slug>\` — Create feature folder (validates kebab-case)
- \`node steroid-run.js gate <phase> <feature>\` — Check phase prerequisites before proceeding
- \`node steroid-run.js commit "<message>"\` — Atomic git commit in steroid format
- \`node steroid-run.js log <feature> "<message>"\` — Append to progress log
- \`node steroid-run.js check-plan <feature>\` — Check if all tasks are done
- \`node steroid-run.js archive <feature>\` — Archive completed feature

## Context Wipe Mandate
After completing each task in the plan.md, terminate the current sub-agent context and start a fresh one.
This prevents hallucination cascades from poisoning multiple tasks.
Each new task reads ONLY from plan.md and progress.md — no inherited context.

## Progress Tracking
The engine captures learnings in \`.memory/progress.md\` after each task.
Read the Codebase Patterns section at the top before starting any new task.

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
const gitignoreEntries = ['.memory/', 'src/forks/', 'steroid-run.js'];
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
console.log('╔══════════════════════════════════════════════════════════════╗');
console.log('║  ✅ Steroid-Workflow v2 installed successfully!              ║');
console.log('║                                                              ║');
console.log('║  Pipeline: vibe → spec → research → architect → engine      ║');
console.log('╚══════════════════════════════════════════════════════════════╝');
console.log('');
console.log('Just tell your AI what you want to build:');
console.log('  👉 "Build me a minimal to-do app that looks like Notion"');
console.log('  👉 "Create a dashboard for tracking my daily habits"');
console.log('');
console.log('Helpful commands:');
console.log('  node steroid-run.js status              — Check circuit breaker state');
console.log('  node steroid-run.js reset               — Reset error counter after fixing');
console.log('  node steroid-run.js progress             — View execution learnings log');
console.log('  node steroid-run.js init-feature <slug>  — Create feature folder');
console.log('  node steroid-run.js gate <phase> <feat>  — Check phase prerequisites');
console.log('');
