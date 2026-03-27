'use strict';

const fs = require('fs');
const path = require('path');

function resolveMemoryTemplateDir(sourceDir) {
    const candidate = path.join(sourceDir, 'templates', 'memory');
    if (fs.existsSync(candidate) && fs.statSync(candidate).isDirectory()) {
        return candidate;
    }
    throw new Error('No memory template directory found. Expected templates/memory.');
}

function resolveRuntimeAssetsDir(targetDir) {
    return path.join(targetDir, '.steroid', 'runtime');
}

function resolveRuntimeServicesDir(targetDir) {
    return path.join(resolveRuntimeAssetsDir(targetDir), 'src', 'services');
}

function resolveRuntimeSrcDir(targetDir) {
    return path.join(resolveRuntimeAssetsDir(targetDir), 'src');
}

module.exports = {
    resolveMemoryTemplateDir,
    resolveRuntimeAssetsDir,
    resolveRuntimeSrcDir,
    resolveRuntimeServicesDir,
};
