'use strict';

const fs = require('fs');
const path = require('path');

function resolveRepoRoot(startDir = __dirname) {
    return path.join(startDir, '..', '..');
}

function manifestPath(rootDir = resolveRepoRoot()) {
    return path.join(rootDir, 'imported', 'imported-manifest.json');
}

function readImportedManifest(rootDir = resolveRepoRoot()) {
    return JSON.parse(fs.readFileSync(manifestPath(rootDir), 'utf-8'));
}

function listImportedSources(rootDir = resolveRepoRoot()) {
    const manifest = readImportedManifest(rootDir);
    return manifest.sources || [];
}

function getImportedSource(id, rootDir = resolveRepoRoot()) {
    return listImportedSources(rootDir).find((source) => source.id === id) || null;
}

function resolveImportedSourcePath(id, rootDir = resolveRepoRoot()) {
    const source = getImportedSource(id, rootDir);
    if (!source) return null;
    return path.join(rootDir, source.localPath);
}

module.exports = {
    resolveRepoRoot,
    manifestPath,
    readImportedManifest,
    listImportedSources,
    getImportedSource,
    resolveImportedSourcePath,
};
