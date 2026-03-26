'use strict';

const fs = require('fs');
const path = require('path');

function copyRecursiveSync(src, dest, options = {}) {
    const skipNames = new Set(options.skipNames || ['.git']);

    if (!fs.existsSync(dest)) {
        fs.mkdirSync(dest, { recursive: true });
    }

    const entries = fs.readdirSync(src, { withFileTypes: true });
    for (const entry of entries) {
        if (skipNames.has(entry.name)) continue;
        const srcPath = path.join(src, entry.name);
        const destPath = path.join(dest, entry.name);
        if (entry.isDirectory()) {
            copyRecursiveSync(srcPath, destPath, options);
        } else {
            fs.copyFileSync(srcPath, destPath);
        }
    }
}

module.exports = {
    copyRecursiveSync,
};
