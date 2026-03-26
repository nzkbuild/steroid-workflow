'use strict';

const fs = require('fs');
const path = require('path');

function resolveRepoRoot(startDir = __dirname) {
    return path.join(startDir, '..', '..');
}

function manifestPath(rootDir = resolveRepoRoot()) {
    return path.join(rootDir, 'sources', 'forks', 'manifest.json');
}

function privateForkPrefix() {
    return ['sources', 'forks'].join('/');
}

function unifiedManifestPath(rootDir = resolveRepoRoot()) {
    return path.join(rootDir, 'src', 'services', 'sources', 'catalog.json');
}

function readForkManifest(rootDir = resolveRepoRoot()) {
    const legacyPath = manifestPath(rootDir);
    if (fs.existsSync(legacyPath)) {
        return JSON.parse(fs.readFileSync(legacyPath, 'utf-8'));
    }

    const unifiedPath = unifiedManifestPath(rootDir);
    if (fs.existsSync(unifiedPath)) {
        const unified = JSON.parse(fs.readFileSync(unifiedPath, 'utf-8'));
        return {
            sources: (unified.sources || []).filter(
                (source) =>
                    typeof source.localPath === 'string' &&
                    source.localPath.replace(/\\/g, '/').startsWith(`${privateForkPrefix()}/`),
            ),
        };
    }

    return { sources: [] };
}

function readUnifiedSourcesManifest(rootDir = resolveRepoRoot()) {
    const filePath = unifiedManifestPath(rootDir);
    if (!fs.existsSync(filePath)) {
        return { sources: [] };
    }
    return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
}

function listForkSources(rootDir = resolveRepoRoot()) {
    const manifest = readForkManifest(rootDir);
    return manifest.sources || [];
}

function listUnifiedSources(rootDir = resolveRepoRoot()) {
    const manifest = readUnifiedSourcesManifest(rootDir);
    return manifest.sources || [];
}

function getForkSource(id, rootDir = resolveRepoRoot()) {
    return (
        listForkSources(rootDir).find((source) => source.id === id) ||
        listUnifiedSources(rootDir).find((source) => source.id === id) ||
        null
    );
}

function getUnifiedSource(id, rootDir = resolveRepoRoot()) {
    return listUnifiedSources(rootDir).find((source) => source.id === id) || null;
}

function resolveForkSourcePath(id, rootDir = resolveRepoRoot()) {
    const source = getForkSource(id, rootDir);
    if (!source) return null;
    if (!source.localPath || typeof source.localPath !== 'string') return null;
    const resolved = path.join(rootDir, source.localPath);
    return fs.existsSync(resolved) ? resolved : null;
}

module.exports = {
    resolveRepoRoot,
    manifestPath,
    unifiedManifestPath,
    readForkManifest,
    readUnifiedSourcesManifest,
    listForkSources,
    listUnifiedSources,
    getForkSource,
    getUnifiedSource,
    resolveForkSourcePath,
    // Compatibility aliases during the v7 cleanup transition.
    readImportedManifest: readForkManifest,
    listImportedSources: listForkSources,
    getImportedSource: getForkSource,
    resolveImportedSourcePath: resolveForkSourcePath,
};
