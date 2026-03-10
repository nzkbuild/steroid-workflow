#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const targetDir = process.cwd();
const sourceDir = path.join(__dirname, '..');

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

console.log('✅ Steroid-Workflow installed successfully!');
console.log('');
console.log('To start building, just ask your AI:');
console.log('👉 "Use @steroid-vibe-capture to help me build my idea"');
