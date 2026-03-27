'use strict';

const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');

const { normalizePreviewUrlCandidate } = require('./frontend-review.cjs');

function collectHtmlAuditTargets(targetDir) {
    const targets = [];
    const seen = new Set();
    const roots = ['out', 'dist', 'build'];
    const exactFiles = ['index.html'];

    const pushFile = (filePath) => {
        const absolutePath = path.resolve(filePath);
        if (!fs.existsSync(absolutePath)) return;
        if (!/\.html?$/i.test(absolutePath)) return;
        if (seen.has(absolutePath)) return;
        seen.add(absolutePath);
        targets.push(absolutePath);
    };

    const walkDir = (dirPath) => {
        for (const entry of fs.readdirSync(dirPath, { withFileTypes: true })) {
            if (entry.name.startsWith('.git') || entry.name === 'node_modules') continue;
            const fullPath = path.join(dirPath, entry.name);
            if (entry.isDirectory()) {
                walkDir(fullPath);
            } else if (entry.isFile()) {
                pushFile(fullPath);
            }
        }
    };

    for (const relativeRoot of roots) {
        const rootPath = path.join(targetDir, relativeRoot);
        if (fs.existsSync(rootPath) && fs.statSync(rootPath).isDirectory()) {
            walkDir(rootPath);
        }
    }

    for (const relativeFile of exactFiles) {
        pushFile(path.join(targetDir, relativeFile));
    }

    return targets.slice(0, 25);
}

function readOptionalText(filePath) {
    if (!fs.existsSync(filePath)) return '';
    try {
        return fs.readFileSync(filePath, 'utf-8');
    } catch {
        return '';
    }
}

function readOptionalJson(filePath) {
    if (!fs.existsSync(filePath)) return null;
    try {
        return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    } catch {
        return null;
    }
}

function getPreviewUrlEnvKeys() {
    return [
        'STEROID_VERIFY_URL',
        'PLAYWRIGHT_BASE_URL',
        'SITE_URL',
        'APP_URL',
        'NEXT_PUBLIC_SITE_URL',
        'NEXT_PUBLIC_APP_URL',
        'NEXT_PUBLIC_VERCEL_URL',
        'VITE_SITE_URL',
        'VITE_APP_URL',
        'PUBLIC_SITE_URL',
        'PUBLIC_APP_URL',
        'VERCEL_URL',
        'VERCEL_BRANCH_URL',
        'URL',
        'DEPLOY_PRIME_URL',
        'CF_PAGES_URL',
        'RENDER_EXTERNAL_URL',
        'RAILWAY_PUBLIC_DOMAIN',
    ];
}

function resolvePreviewUrlFromEnvFiles(targetDir) {
    const candidateFiles = [
        '.env.local',
        '.env',
        '.env.development.local',
        '.env.development',
        '.env.preview.local',
        '.env.preview',
        '.env.production.local',
        '.env.production',
    ];
    const candidateKeys = getPreviewUrlEnvKeys();

    for (const relativeFile of candidateFiles) {
        const filePath = path.join(targetDir, relativeFile);
        if (!fs.existsSync(filePath)) continue;

        const content = fs.readFileSync(filePath, 'utf-8');
        for (const rawLine of content.split(/\r?\n/)) {
            const line = rawLine.trim();
            if (!line || line.startsWith('#') || !line.includes('=')) continue;
            const eqIndex = line.indexOf('=');
            const key = line.slice(0, eqIndex).trim();
            if (!candidateKeys.includes(key)) continue;

            const value = normalizePreviewUrlCandidate(line.slice(eqIndex + 1));
            if (value) {
                return {
                    target: value,
                    source: `${relativeFile}:${key}`,
                    mode: 'url',
                };
            }
        }
    }

    return null;
}

function resolvePreviewUrlFromProjectFiles(targetDir) {
    const textCandidates = ['preview-url.txt', 'deploy-url.txt', '.memory/preview-url.txt'];
    for (const relativeFile of textCandidates) {
        const normalized = normalizePreviewUrlCandidate(readOptionalText(path.join(targetDir, relativeFile)));
        if (normalized) {
            return {
                target: normalized,
                source: relativeFile,
                mode: 'url',
            };
        }
    }

    const jsonCandidates = ['preview-url.json', 'deploy-url.json', '.memory/preview-url.json'];
    const candidateKeys = ['url', 'previewUrl', 'preview_url', 'deployUrl', 'deploy_url'];
    for (const relativeFile of jsonCandidates) {
        const payload = readOptionalJson(path.join(targetDir, relativeFile));
        if (!payload || typeof payload !== 'object') continue;
        for (const key of candidateKeys) {
            const normalized = normalizePreviewUrlCandidate(payload[key]);
            if (normalized) {
                return {
                    target: normalized,
                    source: `${relativeFile}:${key}`,
                    mode: 'url',
                };
            }
        }
    }

    return null;
}

function resolvePreviewUrlFromPackageMetadata(targetDir) {
    const pkgPath = path.join(targetDir, 'package.json');
    if (!fs.existsSync(pkgPath)) return null;

    try {
        const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
        const candidates = [
            ['homepage', pkg.homepage],
            ['url', pkg.url],
            ['siteUrl', pkg.siteUrl],
            ['previewUrl', pkg.previewUrl],
            ['config.previewUrl', pkg.config?.previewUrl],
            ['appConfig.previewUrl', pkg.appConfig?.previewUrl],
        ];

        for (const [key, value] of candidates) {
            const normalized = normalizePreviewUrlCandidate(value);
            if (normalized) {
                return {
                    target: normalized,
                    source: `package.json:${key}`,
                    mode: 'url',
                };
            }
        }
    } catch {
        return null;
    }

    return null;
}

function resolveBrowserAuditTarget(targetDir, featureDir, htmlTargets = [], options = {}) {
    const explicitUrl = normalizePreviewUrlCandidate(options.url);
    if (explicitUrl) {
        return {
            target: explicitUrl,
            source: 'verify-feature --url',
            mode: 'url',
        };
    }

    const envCandidates = getPreviewUrlEnvKeys().map((key) => [key, process.env[key]]);
    for (const [source, value] of envCandidates) {
        const normalized = normalizePreviewUrlCandidate(value);
        if (normalized) {
            return {
                target: normalized,
                source,
                mode: 'url',
            };
        }
    }

    const envFileCandidate = resolvePreviewUrlFromEnvFiles(targetDir);
    if (envFileCandidate) return envFileCandidate;

    const projectFileCandidate = resolvePreviewUrlFromProjectFiles(targetDir);
    if (projectFileCandidate) return projectFileCandidate;

    const previewUrlText = normalizePreviewUrlCandidate(readOptionalText(path.join(featureDir, 'preview-url.txt')));
    if (previewUrlText) {
        return {
            target: previewUrlText,
            source: 'preview-url.txt',
            mode: 'url',
        };
    }

    const previewUrlJson = readOptionalJson(path.join(featureDir, 'preview-url.json'));
    const previewUrlJsonValue = normalizePreviewUrlCandidate(previewUrlJson?.url);
    if (previewUrlJsonValue) {
        return {
            target: previewUrlJsonValue,
            source: 'preview-url.json',
            mode: 'url',
        };
    }

    const packageMetadataCandidate = resolvePreviewUrlFromPackageMetadata(targetDir);
    if (packageMetadataCandidate) return packageMetadataCandidate;

    if (htmlTargets.length > 0) {
        return {
            target: pathToFileURL(htmlTargets[0]).href,
            source: path.relative(targetDir, htmlTargets[0]) || path.basename(htmlTargets[0]),
            mode: 'file',
        };
    }

    return null;
}

module.exports = {
    collectHtmlAuditTargets,
    resolveBrowserAuditTarget,
};
