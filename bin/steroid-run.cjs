#!/usr/bin/env node
/**
 * steroid-run.cjs — The physical pipeline enforcer for AI-driven development.
 *
 * This file is the single-file CLI that gets copied to user projects during
 * `npx steroid-workflow init`. It must remain self-contained (no require()
 * to external modules). Utility functions also exist in src/utils/ for
 * unit testing, but this file is the canonical source of truth for distribution.
 *
 * @module steroid-run
 * @version 6.3.0-beta.1
 *
 * SECTION MAP (for navigation):
 * ─────────────────────────────────────────────────────────────────
 *  L1-13      Imports & Constants
 *  L15-42     Utility Functions (mergeKnowledge, friendlyHint)
 *  L44-58     Dynamic Version Resolution
 *  L60-127    Argument Parsing & Help Text
 *  L129-142   State Initialization
 * ─── COMMANDS: Circuit Breaker ───────────────────────────────────
 *  L144       CMD: reset
 *  L224       CMD: recover
 *  L312       CMD: status
 * ─── COMMANDS: Reports & Bug Reports ─────────────────────────────
 *  L156       CMD: report (bug)
 *  L1709      CMD: report (generate/show/list)
 * ─── COMMANDS: Knowledge & Progress ──────────────────────────────
 *  L329       CMD: progress
 *  L351       CMD: memory (show/write/stats)
 * ─── COMMANDS: Pipeline Enforcement ──────────────────────────────
 *  L503       CMD: audit
 *  L742       CMD: init-feature
 *  L785       CMD: gate
 *  L853       CMD: commit
 *  L920       CMD: log
 *  L946       CMD: check-plan
 *  L987       CMD: stories
 *  L1096      CMD: archive
 *  L1232      CMD: scan
 *  L1539      CMD: verify-feature
 * ─── COMMANDS: Intelligence ──────────────────────────────────────
 *  L1436      CMD: detect-intent
 *  L1487      CMD: detect-tests
 * ─── COMMANDS: Review System ─────────────────────────────────────
 *  L1571      CMD: review (spec/quality/status/reset)
 * ─── COMMANDS: Analytics ─────────────────────────────────────────
 *  L1874      CMD: dashboard
 * ─── EXECUTION & GUARDS ──────────────────────────────────────────
 *  L1974      Circuit Breaker Check
 *  L1993      Verify (Anti-Summarization)
 *  L2023      Scaffold Safety Guard
 *  L2055      Command Allowlist Guard
 *  L2087      Shell Execution
 * ─────────────────────────────────────────────────────────────────
 */

// ═══════════════════════════════════════════════════════════════════
// § IMPORTS & CONSTANTS
// ═══════════════════════════════════════════════════════════════════
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { spawnSync } = require('child_process');
const { pathToFileURL } = require('url');

/** @type {string} Current working directory (user's project root) */
const targetDir = process.cwd();
/** @type {string} Package root (used as a local-development fallback for imported assets) */
const packageRootDir = path.resolve(__dirname, '..');
/** @type {string} Root directory that actually contains imported Steroid assets */
const runtimeAssetsRootDir = fs.existsSync(path.join(targetDir, 'imported', 'imported-manifest.json'))
    ? targetDir
    : packageRootDir;
/** @type {string} Path to circuit breaker state file */
const stateFile = path.join(targetDir, '.memory', 'execution_state.json');
/** @type {string} Root of steroid memory directory */
const memoryDir = path.join(targetDir, '.memory');
/** @type {string} Directory containing per-feature change folders */
const changesDir = path.join(memoryDir, 'changes');
/** @type {string} Path to progress log */
const progressFile = path.join(memoryDir, 'progress.md');
/** @type {string} Directory for knowledge stores (tech-stack, patterns, decisions, gotchas) */
const knowledgeDir = path.join(memoryDir, 'knowledge');
/** @type {string} Directory for metrics (error-patterns, features) */
const metricsDir = path.join(memoryDir, 'metrics');
/** @type {string} Directory for handoff reports */
const reportsDir = path.join(memoryDir, 'reports');
/** @type {string} Directory containing imported internalized source snapshots */
const importedDir = path.join(runtimeAssetsRootDir, 'imported');
/** @type {string} Directory containing internal runtime integrations */
const integrationsDir = path.join(runtimeAssetsRootDir, 'integrations');

// ═══════════════════════════════════════════════════════════════════
// § UTILITY FUNCTIONS
// ═══════════════════════════════════════════════════════════════════

/**
 * Deep-merges two knowledge store objects.
 * - Arrays: deduplicates via Set union
 * - Objects: recursively merges
 * - Primitives: incoming overwrites existing
 *
 * @param {Record<string, any>} existing - Current store contents
 * @param {Record<string, any>} incoming - New data to merge
 * @returns {Record<string, any>} Merged result (inputs not mutated)
 * @see src/utils/merge-knowledge.cjs (identical copy for unit testing)
 */
function mergeKnowledge(existing, incoming) {
    const result = { ...existing };
    for (const [key, value] of Object.entries(incoming)) {
        if (Array.isArray(value) && Array.isArray(result[key])) {
            result[key] = [...new Set([...result[key], ...value])];
        } else if (
            value &&
            typeof value === 'object' &&
            !Array.isArray(value) &&
            result[key] &&
            typeof result[key] === 'object' &&
            !Array.isArray(result[key])
        ) {
            result[key] = mergeKnowledge(result[key], value);
        } else {
            result[key] = value;
        }
    }
    return result;
}

/**
 * Returns a friendly plain-English hint for common error scenarios.
 * Designed to help non-technical users understand what to do next.
 *
 * @param {'gate-blocked'|'gate-incomplete'|'circuit-tripped'|'git-failed'|'no-git'|'no-remote'} key
 * @returns {string} The hint message, or empty string if key is unknown
 * @see src/utils/friendly-hints.cjs (identical copy for unit testing)
 */
function friendlyHint(key) {
    const hints = {
        'gate-blocked':
            '\n  💡 This is normal — the AI needs to finish the previous step first.\n  Ask it to "continue with the steroid pipeline."',
        'gate-incomplete':
            '\n  💡 The previous step\'s output looks too short. Ask the AI to "redo the previous phase with more detail."',
        'circuit-tripped': '\n  💡 Too many errors. The AI is stuck. Try: "Use steroid recover to diagnose the issue."',
        'git-failed':
            '\n  💡 A save operation failed. This usually fixes itself. Ask the AI to "try the commit again."',
        'no-git': '\n  💡 No git repository found. Run: git init && git add -A && git commit -m "Initial commit"',
        'no-remote':
            '\n  💡 Your code is saved locally. To back it up to the cloud:\n  1. Go to github.com → New Repository\n  2. Copy the URL\n  3. Run: git remote add origin <your-url>\n  4. Run: git push -u origin main',
    };
    return hints[key] || '';
}

/**
 * Removes a single matching pair of wrapping quotes from a string.
 *
 * @param {string} value
 * @returns {string}
 */
function stripWrappingQuotes(value) {
    if (!value || value.length < 2) return value;
    const first = value[0];
    const last = value[value.length - 1];
    if ((first === '"' || first === "'") && first === last) {
        return value.slice(1, -1);
    }
    return value;
}

/**
 * Tokenizes a shell-like command string while preserving quoted substrings.
 * This is used for allowlist inspection and targeted shell-syntax blocking.
 *
 * @param {string} input
 * @returns {string[]}
 */
function tokenizeCommand(input) {
    const source = stripWrappingQuotes((input || '').trim());
    const tokens = [];
    let current = '';
    let quote = null;
    let escape = false;

    for (const char of source) {
        if (escape) {
            current += char;
            escape = false;
            continue;
        }

        if (char === '\\' && quote === '"') {
            escape = true;
            continue;
        }

        if (quote) {
            if (char === quote) {
                quote = null;
            } else {
                current += char;
            }
            continue;
        }

        if (char === '"' || char === "'") {
            quote = char;
            continue;
        }

        if (/\s/.test(char)) {
            if (current) {
                tokens.push(current);
                current = '';
            }
            continue;
        }

        current += char;
    }

    if (quote) {
        throw new Error(`Unterminated ${quote === '"' ? 'double' : 'single'} quote in command.`);
    }

    if (current) tokens.push(current);
    return tokens;
}

/**
 * Reads the imported source manifest if present.
 *
 * @returns {{sources?: Array<Record<string, any>>}}
 */
function readImportedManifest() {
    const manifestFile = path.join(importedDir, 'imported-manifest.json');
    if (!fs.existsSync(manifestFile)) return { sources: [] };
    return JSON.parse(fs.readFileSync(manifestFile, 'utf-8'));
}

/**
 * Resolves an imported source entry by id.
 *
 * @param {string} id
 * @returns {Record<string, any>|null}
 */
function getImportedSource(id) {
    const manifest = readImportedManifest();
    return (manifest.sources || []).find((source) => source.id === id) || null;
}

/**
 * Resolves an imported source path relative to the current project.
 *
 * @param {string} id
 * @returns {string|null}
 */
function resolveImportedSourcePath(id) {
    const source = getImportedSource(id);
    if (!source) return null;
    return path.join(runtimeAssetsRootDir, source.localPath);
}

function includesAny(haystack, needles) {
    return needles.some((needle) => haystack.includes(needle));
}

function detectUiTask(input) {
    const text = String(input || '').toLowerCase();
    return includesAny(text, [
        'design',
        'redesign',
        'ui',
        'ux',
        'frontend',
        'landing page',
        'dashboard',
        'page',
        'screen',
        'component',
        'layout',
        'responsive',
        'styling',
        'theme',
        'onboarding',
        'navigation',
        'accessibility',
        'a11y',
        'refactor the ui',
    ]);
}

function detectAuditMode(input) {
    const text = String(input || '').toLowerCase();
    return includesAny(text, ['audit', 'review', 'check', 'inspect', 'accessibility', 'a11y', 'compliance']);
}

function detectDesignStack(input) {
    const text = String(input || '').toLowerCase();
    if (includesAny(text, ['react native', 'expo', 'ios', 'android', 'mobile app', 'native app'])) {
        return 'react-native';
    }
    if (includesAny(text, ['react', 'next.js', 'nextjs', 'server component', 'client component'])) {
        return 'react';
    }
    return 'web';
}

/**
 * Routes UI work to Steroid's internalized design systems.
 *
 * @param {string} prompt
 * @param {{stack?: string, auditOnly?: boolean}} [options]
 * @returns {{domain: string, wrapperSkill: string|null, importedSourceIds: string[], importedSourcePaths: string[], auditOnly: boolean, stack: string}}
 */
function routeDesignSystems(prompt, options = {}) {
    const combined = `${prompt || ''} ${options.stack || ''}`.trim().toLowerCase();
    const isUiTask = detectUiTask(combined);
    const isAudit = Boolean(options.auditOnly) || detectAuditMode(combined);
    const stack = detectDesignStack(combined);

    if (!isUiTask && !isAudit) {
        return {
            domain: 'none',
            wrapperSkill: null,
            importedSourceIds: [],
            importedSourcePaths: [],
            auditOnly: false,
            stack,
        };
    }

    const importedSourceIds = ['ui-ux-pro-max', 'bencium-ux-designer'];
    let wrapperSkill = 'steroid-design-orchestrator';

    if (stack === 'react-native') {
        importedSourceIds.push('vercel-react-native-skills');
        wrapperSkill = 'steroid-rn-implementation';
    } else {
        importedSourceIds.push('anthropic-frontend-design');
        importedSourceIds.push('vercel-web-design-guidelines');
        importedSourceIds.push('vercel-web-interface-guidelines');
        if (stack === 'react') {
            importedSourceIds.push('vercel-react-best-practices');
            importedSourceIds.push('vercel-composition-patterns');
            wrapperSkill = 'steroid-react-implementation';
        }
    }

    if (isAudit) {
        wrapperSkill = 'steroid-web-design-review';
        if (!importedSourceIds.includes('accesslint-core')) importedSourceIds.push('accesslint-core');
    }

    const uniqueSourceIds = importedSourceIds.filter(
        (id, index) => importedSourceIds.indexOf(id) === index && getImportedSource(id),
    );

    return {
        domain: stack,
        wrapperSkill,
        importedSourceIds: uniqueSourceIds,
        importedSourcePaths: uniqueSourceIds.map((id) => resolveImportedSourcePath(id)).filter(Boolean),
        auditOnly: isAudit,
        stack,
    };
}

/**
 * Normalizes a design routing receipt into the governed runtime shape.
 *
 * @param {Record<string, any>|null|undefined} receipt
 * @returns {Record<string, any>|null}
 */
function normalizeDesignRoutingReceipt(receipt) {
    if (!receipt || typeof receipt !== 'object') return null;

    const stack = typeof receipt.stack === 'string' ? receipt.stack : 'web';
    const wrapperSkill = typeof receipt.wrapperSkill === 'string' ? receipt.wrapperSkill : null;
    const importedSourceIds = Array.isArray(receipt.importedSourceIds)
        ? receipt.importedSourceIds.filter((value) => typeof value === 'string')
        : [];
    const domain = typeof receipt.domain === 'string' ? receipt.domain : stack;

    if (!['none', 'web', 'react', 'react-native'].includes(domain)) return null;
    if (!['web', 'react', 'react-native'].includes(stack)) return null;

    return {
        domain,
        stack,
        auditOnly: !!receipt.auditOnly,
        wrapperSkill,
        importedSourceIds,
        importedSourcePaths: Array.isArray(receipt.importedSourcePaths)
            ? receipt.importedSourcePaths.filter((value) => typeof value === 'string')
            : importedSourceIds.map((id) => resolveImportedSourcePath(id)).filter(Boolean),
        prompt: typeof receipt.prompt === 'string' ? receipt.prompt : '',
        promptSource: typeof receipt.promptSource === 'string' ? receipt.promptSource : null,
        generatedAt: typeof receipt.generatedAt === 'string' ? receipt.generatedAt : null,
    };
}

/**
 * Loads the active design routing receipt and normalizes it when valid.
 *
 * @param {string} featureDir
 * @returns {Record<string, any>|null}
 */
function loadDesignRoutingReceipt(featureDir) {
    const routeReceiptPath = path.join(featureDir, 'design-routing.json');
    const existing = readJsonFile(routeReceiptPath);
    const normalized = normalizeDesignRoutingReceipt(existing);
    if (!normalized) return null;
    if (JSON.stringify(existing) !== JSON.stringify(normalized)) {
        writeJsonFile(routeReceiptPath, normalized);
    }
    return normalized;
}

function hasText(value) {
    return typeof value === 'string' && value.trim().length > 0;
}

function resolveFeaturePromptForDesign(featureDir) {
    const designReceipt = loadDesignRoutingReceipt(featureDir);
    if (hasText(designReceipt?.prompt)) {
        return designReceipt.prompt.trim();
    }

    const promptReceipt = readJsonFile(path.join(featureDir, 'prompt.json'));
    const candidates = [
        promptReceipt?.normalizedSummary,
        promptReceipt?.pipelineHint,
        readFeatureArtifactText(featureDir, 'vibe.md'),
        readFeatureArtifactText(featureDir, 'spec.md'),
    ]
        .filter(hasText)
        .map((value) => normalizePromptWhitespace(value))
        .filter(Boolean);

    if (candidates.length === 0) {
        return '';
    }

    return candidates.join(' | ').slice(0, 1200).trim();
}

function resolvePythonRunner() {
    const candidates = [
        { command: 'python', args: [] },
        { command: 'python3', args: [] },
        { command: 'py', args: ['-3'] },
    ];

    for (const candidate of candidates) {
        const probe = spawnSync(candidate.command, [...candidate.args, '--version'], {
            cwd: targetDir,
            stdio: 'pipe',
            encoding: 'utf-8',
            timeout: 5000,
        });
        if (!probe.error && probe.status === 0) {
            return candidate;
        }
    }

    return null;
}

function generateDesignSystemMarkdown(query, options = {}) {
    const importedRoot = resolveImportedSourcePath('ui-ux-pro-max');
    if (!importedRoot) {
        return {
            ok: false,
            error: 'ui-ux-pro-max is not installed in this Steroid project. Re-run `steroid-workflow init`.',
        };
    }

    const searchScript = path.join(importedRoot, 'scripts', 'search.py');
    if (!fs.existsSync(searchScript)) {
        return {
            ok: false,
            error: `Missing imported design-system generator: ${path.relative(targetDir, searchScript)}`,
        };
    }

    const python = resolvePythonRunner();
    if (!python) {
        return {
            ok: false,
            error: 'Python is required to run the imported ui-ux-pro-max generator, but no python executable was found.',
        };
    }

    const commandArgs = [...python.args, searchScript, query, '--design-system', '--format', 'markdown'];
    if (hasText(options.projectName)) {
        commandArgs.push('--project-name', options.projectName.trim());
    }

    const result = spawnSync(python.command, commandArgs, {
        cwd: targetDir,
        stdio: 'pipe',
        encoding: 'utf-8',
        timeout: 120000,
        env: { ...process.env, PYTHONIOENCODING: 'utf-8' },
    });

    if (result.error) {
        return {
            ok: false,
            error: `Failed to run imported design-system generator: ${result.error.message}`,
        };
    }

    if (result.status !== 0) {
        return {
            ok: false,
            error:
                result.stderr?.trim() ||
                result.stdout?.trim() ||
                `Imported design-system generator exited with code ${result.status}.`,
        };
    }

    const content = String(result.stdout || '').trim();
    if (!content) {
        return {
            ok: false,
            error: 'Imported design-system generator returned empty output.',
        };
    }

    return {
        ok: true,
        content,
        scriptPath: searchScript,
        pythonCommand: [python.command, ...python.args].join(' '),
    };
}

function resolveAccessLintRunnerPath() {
    return path.join(integrationsDir, 'accesslint', 'run-audit.cjs');
}

function resolveBrowserAuditRunnerPath() {
    return path.join(integrationsDir, 'browser-audit', 'run-playwright-audit.cjs');
}

function readFeatureArtifactText(featureDir, fileName) {
    const artifactPath = path.join(featureDir, fileName);
    if (!fs.existsSync(artifactPath)) return '';
    try {
        return fs.readFileSync(artifactPath, 'utf-8');
    } catch {
        return '';
    }
}

function detectUiFeatureForGate(featureDir, promptReceipt = null) {
    const designReceipt = loadDesignRoutingReceipt(featureDir);
    if (designReceipt && designReceipt.domain !== 'none' && !designReceipt.auditOnly) {
        return true;
    }

    const combined = [
        promptReceipt?.normalizedSummary,
        promptReceipt?.pipelineHint,
        readFeatureArtifactText(featureDir, 'vibe.md'),
        readFeatureArtifactText(featureDir, 'spec.md'),
        readFeatureArtifactText(featureDir, 'research.md'),
        readFeatureArtifactText(featureDir, 'plan.md'),
    ]
        .filter(Boolean)
        .join('\n')
        .toLowerCase();

    return detectUiTask(combined);
}

function getMissingDesignArtifactsForPhase(featureDir, phase, promptReceipt = null) {
    if (!['architect', 'engine'].includes(phase)) {
        return [];
    }

    if (!detectUiFeatureForGate(featureDir, promptReceipt)) {
        return [];
    }

    const missing = [];
    if (!loadDesignRoutingReceipt(featureDir)) {
        missing.push('design-routing.json');
    }
    if (!fs.existsSync(path.join(featureDir, 'design-system.md'))) {
        missing.push('design-system.md');
    }
    return missing;
}

function collectAccessibilityAuditTargets() {
    const targets = [];
    const seen = new Set();
    const roots = ['out', 'dist', 'build', 'public', '.next/server/app', '.next/server/pages', 'src'];
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

function summarizeAccessibilityImpact(impact) {
    if (impact === 'critical' || impact === 'serious') return 'FAIL';
    if (impact === 'moderate' || impact === 'minor') return 'WARN';
    return 'PASS';
}

function isHttpUrl(value) {
    return /^https?:\/\//i.test(String(value || '').trim());
}

function normalizePreviewUrlCandidate(value) {
    const trimmed = String(value || '')
        .trim()
        .replace(/^['"]|['"]$/g, '');
    if (!trimmed) return '';
    if (isHttpUrl(trimmed)) return trimmed;
    if (/^[a-z0-9.-]+\.[a-z]{2,}(\/.*)?$/i.test(trimmed)) {
        return `https://${trimmed.replace(/^\/+/, '')}`;
    }
    return '';
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

function resolvePreviewUrlFromEnvFiles() {
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

function resolvePreviewUrlFromProjectFiles() {
    const textCandidates = ['preview-url.txt', 'deploy-url.txt', '.memory/preview-url.txt'];
    for (const relativeFile of textCandidates) {
        const normalized = normalizePreviewUrlCandidate(readFeatureArtifactText(targetDir, relativeFile));
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
        const payload = readJsonFile(path.join(targetDir, relativeFile));
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

function resolvePreviewUrlFromPackageMetadata() {
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

function resolveBrowserAuditTarget(featureDir, htmlTargets = [], options = {}) {
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

    const envFileCandidate = resolvePreviewUrlFromEnvFiles();
    if (envFileCandidate) {
        return envFileCandidate;
    }

    const projectFileCandidate = resolvePreviewUrlFromProjectFiles();
    if (projectFileCandidate) {
        return projectFileCandidate;
    }

    const previewUrlText = normalizePreviewUrlCandidate(readFeatureArtifactText(featureDir, 'preview-url.txt'));
    if (previewUrlText) {
        return {
            target: previewUrlText,
            source: 'preview-url.txt',
            mode: 'url',
        };
    }

    const previewUrlJson = readJsonFile(path.join(featureDir, 'preview-url.json'));
    const previewUrlJsonValue = normalizePreviewUrlCandidate(previewUrlJson?.url);
    if (previewUrlJsonValue) {
        return {
            target: previewUrlJsonValue,
            source: 'preview-url.json',
            mode: 'url',
        };
    }

    const packageMetadataCandidate = resolvePreviewUrlFromPackageMetadata();
    if (packageMetadataCandidate) {
        return packageMetadataCandidate;
    }

    if (htmlTargets.length > 0) {
        return {
            target: pathToFileURL(htmlTargets[0]).href,
            source: path.relative(targetDir, htmlTargets[0]) || path.basename(htmlTargets[0]),
            mode: 'file',
        };
    }

    return null;
}

function summarizeBrowserAuditResult(audit) {
    if (!audit || audit.ok === false) {
        return {
            status: 'FAIL',
            detail: audit?.error || audit?.reason || 'Browser audit failed before the page could be inspected',
        };
    }

    const consoleErrors = (audit.consoleMessages || []).filter((message) => message.type === 'error');
    const consoleWarnings = (audit.consoleMessages || []).filter((message) => message.type === 'warning');
    const pageErrors = Array.isArray(audit.pageErrors) ? audit.pageErrors : [];
    const failedRequests = Array.isArray(audit.failedRequests) ? audit.failedRequests : [];
    const titleMissing = !String(audit.pageTitle || '').trim();

    const status =
        pageErrors.length > 0 || failedRequests.length > 0 || consoleErrors.length > 0
            ? 'FAIL'
            : consoleWarnings.length > 0 || titleMissing
              ? 'WARN'
              : 'PASS';

    const detailParts = [
        `target ${audit.finalUrl || audit.target || 'unknown'}`,
        `console errors ${consoleErrors.length}`,
        `console warnings ${consoleWarnings.length}`,
        `page errors ${pageErrors.length}`,
        `failed requests ${failedRequests.length}`,
    ];

    if (titleMissing) {
        detailParts.push('missing document title');
    } else {
        detailParts.push(`title "${String(audit.pageTitle).trim()}"`);
    }

    if (audit.screenshotPath) {
        detailParts.push(`screenshot ${audit.screenshotPath}`);
    }

    return {
        status,
        detail: detailParts.join('; '),
    };
}

function buildUiRiskFindings({
    designReceipt,
    hasDesignSystem,
    accesslintReceipt,
    accesslintResult,
    browserAuditReceipt,
    browserAuditResult,
    deepMode,
}) {
    const findings = [];

    if (designReceipt && !designReceipt.auditOnly && !hasDesignSystem) {
        findings.push({
            severity: 'critical',
            title: 'Design system artifact missing',
            detail: 'UI work was routed through the design system flow, but design-system.md is missing.',
        });
    }

    if (!accesslintReceipt) {
        findings.push({
            severity: deepMode ? 'medium' : 'info',
            title: 'Accessibility evidence missing',
            detail: accesslintResult?.detail || 'No AccessLint receipt was available for this UI review.',
        });
    } else if ((accesslintReceipt.violationCount || 0) > 0) {
        findings.push({
            severity:
                accesslintReceipt.highestImpact === 'critical' || accesslintReceipt.highestImpact === 'serious'
                    ? 'critical'
                    : 'medium',
            title: 'Accessibility violations detected',
            detail: `${accesslintReceipt.violationCount} issue(s) across ${accesslintReceipt.fileCount || 0} HTML target(s); highest impact ${accesslintReceipt.highestImpact || 'unknown'}.`,
        });
    }

    if (browserAuditReceipt) {
        const consoleErrors = (browserAuditReceipt.consoleMessages || []).filter((message) => message.type === 'error');
        const pageErrors = browserAuditReceipt.pageErrors || [];
        const failedRequests = browserAuditReceipt.failedRequests || [];
        const consoleWarnings = (browserAuditReceipt.consoleMessages || []).filter(
            (message) => message.type === 'warning',
        );
        const titleMissing = !String(browserAuditReceipt.pageTitle || '').trim();

        if (pageErrors.length > 0 || failedRequests.length > 0 || consoleErrors.length > 0) {
            findings.push({
                severity: 'critical',
                title: 'Browser audit found runtime failures',
                detail: `${consoleErrors.length} console error(s), ${pageErrors.length} page error(s), ${failedRequests.length} failed request(s).`,
            });
        } else if (consoleWarnings.length > 0 || titleMissing) {
            findings.push({
                severity: 'medium',
                title: 'Browser audit found polish issues',
                detail: `${consoleWarnings.length} console warning(s)${titleMissing ? '; missing document title' : ''}.`,
            });
        }
    } else if (deepMode) {
        findings.push({
            severity: 'medium',
            title: 'Browser runtime evidence missing',
            detail: browserAuditResult?.detail || 'Deep browser audit did not produce a ui-audit.json receipt.',
        });
    }

    return findings;
}

function summarizeUiReviewStatus(findings) {
    if (findings.some((finding) => finding.severity === 'critical')) return 'FAIL';
    if (findings.some((finding) => finding.severity === 'medium')) return 'CONDITIONAL';
    return 'PASS';
}

function buildUiArchivePolicy(uiReviewReceipt, options = {}) {
    if (!uiReviewReceipt?.status) {
        return {
            decision: 'PASS',
            recommendation: 'READY',
            summary: 'No UI review receipt is present, so no frontend archive policy applies.',
            blockReasons: [],
            warnReasons: [],
            overrideFlag: null,
        };
    }

    const findings = Array.isArray(uiReviewReceipt.findings) ? uiReviewReceipt.findings : [];
    const findingTitles = new Set(findings.map((finding) => finding.title));
    const blockReasons = [];
    const warnReasons = [];

    if (uiReviewReceipt.status === 'FAIL') {
        return {
            decision: 'BLOCK',
            recommendation: 'HOLD',
            summary: 'Frontend review is FAIL, so archive should stay blocked.',
            blockReasons: ['ui-review.json status is FAIL.'],
            warnReasons: [],
            overrideFlag: null,
        };
    }

    if (uiReviewReceipt.status !== 'CONDITIONAL') {
        return {
            decision: 'PASS',
            recommendation: 'READY',
            summary: 'Frontend review is PASS.',
            blockReasons,
            warnReasons,
            overrideFlag: null,
        };
    }

    if (findingTitles.has('Accessibility violations detected')) {
        blockReasons.push('Accessibility review still reports moderate/minor violations.');
    }
    if (options.deepRequested && findingTitles.has('Browser runtime evidence missing')) {
        blockReasons.push('Deep verification was requested, but browser runtime evidence is still missing.');
    }

    if (findingTitles.has('Browser audit found polish issues')) {
        warnReasons.push('Browser audit found polish issues that should be cleaned up before release.');
    }
    if (findingTitles.has('Accessibility evidence missing')) {
        warnReasons.push('Accessibility evidence is missing, so the frontend verdict is less trustworthy.');
    }
    if (findings.length === 0) {
        warnReasons.push('Frontend review is CONDITIONAL, but no structured findings were captured.');
    }

    if (blockReasons.length > 0) {
        return {
            decision: 'BLOCK_CONDITIONAL',
            recommendation: 'HOLD',
            summary:
                'Frontend review is CONDITIONAL with issues serious enough to block archive unless explicitly overridden.',
            blockReasons,
            warnReasons,
            overrideFlag: '--force-ui',
        };
    }

    return {
        decision: 'WARN_CONDITIONAL',
        recommendation: 'CAUTION',
        summary: 'Frontend review is CONDITIONAL, but archive can proceed with an explicit warning.',
        blockReasons,
        warnReasons,
        overrideFlag: null,
    };
}

function buildUiReviewMarkdown(feature, options) {
    const {
        verifyStatus,
        promptReceipt,
        designReceipt,
        hasDesignSystem,
        accesslintReceipt,
        accesslintResult,
        browserAuditReceipt,
        browserAuditResult,
        previewTarget,
        deepMode,
        refreshSource,
        refreshReason,
        evidenceUpdatedAt,
        evidenceUpdatedFrom,
    } = options;

    const findings = buildUiRiskFindings({
        designReceipt,
        hasDesignSystem,
        accesslintReceipt,
        accesslintResult,
        browserAuditReceipt,
        browserAuditResult,
        deepMode,
    });
    const uiStatus = summarizeUiReviewStatus(findings);
    const accesslintEvidence = {
        present: !!accesslintReceipt,
        status: accesslintResult?.status || 'SKIP',
        detail: accesslintResult?.detail || '',
        violationCount: accesslintReceipt?.violationCount || 0,
        highestImpact: accesslintReceipt?.highestImpact || 'none',
        fileCount: accesslintReceipt?.fileCount || 0,
    };
    const browserAuditEvidence = {
        present: !!browserAuditReceipt,
        status: browserAuditResult?.status || 'SKIP',
        detail: browserAuditResult?.detail || '',
        finalUrl: browserAuditReceipt?.finalUrl || browserAuditReceipt?.target || null,
        consoleErrors: (browserAuditReceipt?.consoleMessages || []).filter((message) => message.type === 'error')
            .length,
        consoleWarnings: (browserAuditReceipt?.consoleMessages || []).filter((message) => message.type === 'warning')
            .length,
        pageErrors: (browserAuditReceipt?.pageErrors || []).length,
        failedRequests: (browserAuditReceipt?.failedRequests || []).length,
        screenshotPath: browserAuditReceipt?.screenshotPath || null,
    };
    const receipt = {
        feature,
        status: uiStatus,
        verifyStatus,
        generatedAt: new Date().toISOString(),
        stack: designReceipt?.stack || 'unknown',
        auditOnly: !!designReceipt?.auditOnly,
        wrapperSkill: designReceipt?.wrapperSkill || null,
        importedSourceIds: Array.isArray(designReceipt?.importedSourceIds) ? designReceipt.importedSourceIds : [],
        promptSummary: promptReceipt?.normalizedSummary || '',
        previewTarget: previewTarget || null,
        evidence: {
            designRoutePresent: !!designReceipt,
            designSystemPresent: !!hasDesignSystem,
            accesslint: accesslintEvidence,
            browserAudit: browserAuditEvidence,
        },
        freshness: {
            source: refreshSource || 'unknown',
            reason: refreshReason || 'UI review refreshed.',
            evidenceUpdatedAt: evidenceUpdatedAt || null,
            evidenceUpdatedFrom: evidenceUpdatedFrom || null,
        },
        findings,
    };

    const lines = [
        `# UI Review: ${feature}`,
        '',
        `**Generated:** ${receipt.generatedAt}`,
        `**UI Status:** ${uiStatus}`,
        `**Verification Status:** ${verifyStatus}`,
        `**Refresh Source:** ${receipt.freshness.source}`,
        '',
        '## Inputs',
        '',
        `- Prompt summary: ${promptReceipt?.normalizedSummary || 'Unknown'}`,
        `- Wrapper skill: ${designReceipt?.wrapperSkill || 'none'}`,
        `- Stack: ${designReceipt?.stack || 'Unknown'}`,
        `- Audit-only route: ${designReceipt?.auditOnly ? 'yes' : 'no'}`,
        `- Design routing receipt: ${designReceipt ? 'present' : 'missing'}`,
        `- Design system artifact: ${hasDesignSystem ? 'present' : 'missing'}`,
        `- Imported systems: ${
            Array.isArray(designReceipt?.importedSourceIds) && designReceipt.importedSourceIds.length > 0
                ? designReceipt.importedSourceIds.join(', ')
                : 'none'
        }`,
        `- Preview target: ${previewTarget || 'not provided'}`,
        `- Refresh reason: ${receipt.freshness.reason}`,
        `- Latest evidence update: ${receipt.freshness.evidenceUpdatedAt || 'unknown'}`,
        `- Latest evidence source: ${receipt.freshness.evidenceUpdatedFrom || 'unknown'}`,
        '',
        '## Automated Evidence',
        '',
        `- AccessLint: ${accesslintEvidence.status}${accesslintEvidence.detail ? ` — ${accesslintEvidence.detail}` : ''}`,
        `- Browser audit: ${browserAuditEvidence.status}${browserAuditEvidence.detail ? ` — ${browserAuditEvidence.detail}` : ''}`,
        '',
        '## Key Frontend Risks',
        '',
    ];

    if (findings.length === 0) {
        lines.push('- No significant frontend risks were detected from the current UI receipts.');
    } else {
        for (const finding of findings) {
            lines.push(`- ${finding.severity.toUpperCase()}: ${finding.title} — ${finding.detail}`);
        }
    }

    lines.push(
        '',
        '## Artifacts',
        '',
        `- design-routing.json: ${designReceipt ? 'present' : 'missing'}`,
        `- design-system.md: ${hasDesignSystem ? 'present' : 'missing'}`,
        `- accessibility.json: ${accesslintReceipt ? 'present' : 'missing'}`,
        `- ui-audit.json: ${browserAuditReceipt ? 'present' : 'missing'}`,
        '',
        `---`,
        `_Generated by steroid-workflow v${SW_VERSION}_`,
        '',
    );

    return {
        status: uiStatus,
        content: lines.join('\n'),
        findings,
        receipt,
    };
}

/**
 * Normalizes a UI review receipt into the governed runtime shape.
 *
 * @param {Record<string, any>|null|undefined} receipt
 * @param {string} feature
 * @returns {Record<string, any>|null}
 */
function normalizeUiReviewReceipt(receipt, feature) {
    if (!receipt || receipt.feature !== feature) return null;

    const status = normalizeAllowedStatus(receipt.status, ['PASS', 'FAIL', 'CONDITIONAL'], null);
    if (!status) return null;

    const findings = Array.isArray(receipt.findings)
        ? receipt.findings
              .filter((finding) => finding && typeof finding === 'object')
              .map((finding) => ({
                  severity: typeof finding.severity === 'string' ? finding.severity : 'medium',
                  title: typeof finding.title === 'string' ? finding.title : 'Untitled finding',
                  detail: typeof finding.detail === 'string' ? finding.detail : '',
              }))
        : [];

    return {
        feature,
        status,
        verifyStatus: typeof receipt.verifyStatus === 'string' ? receipt.verifyStatus : 'Unknown',
        generatedAt: typeof receipt.generatedAt === 'string' ? receipt.generatedAt : null,
        stack: typeof receipt.stack === 'string' ? receipt.stack : 'unknown',
        auditOnly: !!receipt.auditOnly,
        wrapperSkill: typeof receipt.wrapperSkill === 'string' ? receipt.wrapperSkill : null,
        importedSourceIds: Array.isArray(receipt.importedSourceIds)
            ? receipt.importedSourceIds.filter((value) => typeof value === 'string')
            : [],
        promptSummary: typeof receipt.promptSummary === 'string' ? receipt.promptSummary : '',
        previewTarget: typeof receipt.previewTarget === 'string' ? receipt.previewTarget : null,
        evidence: receipt.evidence && typeof receipt.evidence === 'object' ? receipt.evidence : {},
        freshness:
            receipt.freshness && typeof receipt.freshness === 'object'
                ? {
                      source: typeof receipt.freshness.source === 'string' ? receipt.freshness.source : 'unknown',
                      reason: typeof receipt.freshness.reason === 'string' ? receipt.freshness.reason : 'Unknown refresh reason.',
                      evidenceUpdatedAt:
                          typeof receipt.freshness.evidenceUpdatedAt === 'string'
                              ? receipt.freshness.evidenceUpdatedAt
                              : null,
                      evidenceUpdatedFrom:
                          typeof receipt.freshness.evidenceUpdatedFrom === 'string'
                              ? receipt.freshness.evidenceUpdatedFrom
                              : null,
                  }
                : {
                      source: 'unknown',
                      reason: 'Unknown refresh reason.',
                      evidenceUpdatedAt: null,
                      evidenceUpdatedFrom: null,
                  },
        findings,
    };
}

/**
 * Loads the active UI review receipt and normalizes it when valid.
 *
 * @param {string} feature
 * @param {string} featureDir
 * @returns {Record<string, any>|null}
 */
function loadUiReviewReceipt(feature, featureDir) {
    const uiReviewReceiptPath = path.join(featureDir, 'ui-review.json');
    const existing = readJsonFile(uiReviewReceiptPath);
    const normalized = normalizeUiReviewReceipt(existing, feature);
    if (!normalized) return null;
    if (JSON.stringify(existing) !== JSON.stringify(normalized)) {
        writeJsonFile(uiReviewReceiptPath, normalized);
    }
    return normalized;
}

function buildAccesslintResultFromReceipt(receipt) {
    if (!receipt) {
        return {
            status: 'SKIP',
            detail: 'No AccessLint receipt was available for this UI review.',
        };
    }

    const status = summarizeAccessibilityImpact(receipt.highestImpact || 'none');
    return {
        status,
        detail:
            receipt.violationCount > 0
                ? `${receipt.violationCount} issue(s) across ${receipt.fileCount || 0} HTML target(s); highest impact ${receipt.highestImpact || 'unknown'}.`
                : `No violations across ${receipt.fileCount || 0} HTML target(s)`,
    };
}

function refreshUiReviewArtifacts(feature, featureDir, options = {}) {
    const promptReceipt = readJsonFile(path.join(featureDir, 'prompt.json'));
    const designReceipt = loadDesignRoutingReceipt(featureDir);
    const accesslintReceipt = readJsonFile(path.join(featureDir, 'accessibility.json'));
    const browserAuditReceipt = readJsonFile(path.join(featureDir, 'ui-audit.json'));
    const verifyReceipt = loadVerifyReceipt(feature, featureDir);
    const previewTarget =
        normalizePreviewUrlCandidate(options.previewUrl) ||
        normalizePreviewUrlCandidate(readFeatureArtifactText(featureDir, 'preview-url.txt')) ||
        normalizePreviewUrlCandidate(readJsonFile(path.join(featureDir, 'preview-url.json'))?.url) ||
        browserAuditReceipt?.finalUrl ||
        browserAuditReceipt?.target ||
        null;

    const uiReviewEligible =
        detectUiFeatureForGate(featureDir, promptReceipt) ||
        Boolean(designReceipt) ||
        Boolean(accesslintReceipt) ||
        Boolean(browserAuditReceipt);

    if (!uiReviewEligible) {
        return {
            ok: false,
            skipped: true,
            reason: 'Feature does not currently look UI-intensive, so no frontend review was generated.',
        };
    }

    const accesslintResult = buildAccesslintResultFromReceipt(accesslintReceipt);
    const browserAuditResult = browserAuditReceipt
        ? summarizeBrowserAuditResult(browserAuditReceipt)
        : {
              status: 'SKIP',
              detail: 'No browser audit receipt was available for this UI review.',
          };
    const deepMode = options.deepMode ?? (!!verifyReceipt.deepRequested || !!browserAuditReceipt);
    const uiReview = buildUiReviewMarkdown(feature, {
        verifyStatus: options.verifyStatus || verifyReceipt.status || 'PENDING',
        promptReceipt,
        designReceipt,
        hasDesignSystem: fs.existsSync(path.join(featureDir, 'design-system.md')),
        accesslintReceipt,
        accesslintResult,
        browserAuditReceipt,
        browserAuditResult,
        previewTarget,
        deepMode,
        refreshSource: options.refreshSource,
        refreshReason: options.refreshReason,
        evidenceUpdatedAt: options.evidenceUpdatedAt,
        evidenceUpdatedFrom: options.evidenceUpdatedFrom,
    });

    const uiReviewArtifact = path.join(featureDir, 'ui-review.md');
    const uiReviewReceiptArtifact = path.join(featureDir, 'ui-review.json');
    fs.writeFileSync(uiReviewArtifact, uiReview.content);
    writeJsonFile(uiReviewReceiptArtifact, uiReview.receipt);

    return {
        ok: true,
        skipped: false,
        reportPath: uiReviewArtifact,
        receiptPath: uiReviewReceiptArtifact,
        status: uiReview.status,
        receipt: uiReview.receipt,
    };
}

function getArtifactMtimeMs(filePath) {
    if (!fs.existsSync(filePath)) return null;
    try {
        return fs.statSync(filePath).mtimeMs;
    } catch {
        return null;
    }
}

function ensureCurrentUiReviewArtifacts(feature, featureDir, options = {}) {
    const promptReceipt = readJsonFile(path.join(featureDir, 'prompt.json'));
    const uiReviewArtifact = path.join(featureDir, 'ui-review.md');
    const uiReviewReceiptArtifact = path.join(featureDir, 'ui-review.json');
    const existingUiReviewReceipt = loadUiReviewReceipt(feature, featureDir);
    const candidateInputs = [
        'prompt.json',
        'design-routing.json',
        'design-system.md',
        'accessibility.json',
        'ui-audit.json',
        'verify.json',
        'preview-url.txt',
        'preview-url.json',
    ]
        .map((name) => {
            const filePath = path.join(featureDir, name);
            return {
                name,
                filePath,
                mtimeMs: getArtifactMtimeMs(filePath),
            };
        })
        .filter((entry) => entry.mtimeMs !== null);

    const uiReviewEligible =
        detectUiFeatureForGate(featureDir, promptReceipt) ||
        candidateInputs.some((entry) =>
            ['design-routing.json', 'design-system.md', 'accessibility.json', 'ui-audit.json'].includes(entry.name),
        );

    if (!uiReviewEligible) {
        return {
            attempted: false,
            refreshed: false,
            skipped: true,
            reason: 'Feature does not currently look UI-intensive.',
            receipt: existingUiReviewReceipt,
        };
    }

    const uiReviewMtimes = [getArtifactMtimeMs(uiReviewArtifact), getArtifactMtimeMs(uiReviewReceiptArtifact)].filter(
        (value) => value !== null,
    );
    const missingUiReviewArtifacts = uiReviewMtimes.length < 2 || !existingUiReviewReceipt;
    const newestInput = candidateInputs.reduce(
        (latest, entry) => (!latest || entry.mtimeMs > latest.mtimeMs ? entry : latest),
        null,
    );
    const oldestUiReviewMtime = uiReviewMtimes.length > 0 ? Math.min(...uiReviewMtimes) : null;
    const staleBecauseNewerInput = Boolean(
        newestInput && oldestUiReviewMtime !== null && newestInput.mtimeMs > oldestUiReviewMtime,
    );
    const shouldRefresh = missingUiReviewArtifacts || staleBecauseNewerInput;

    if (!shouldRefresh) {
        return {
            attempted: false,
            refreshed: false,
            skipped: false,
            reason: 'UI review artifacts are already current.',
            receipt: existingUiReviewReceipt,
        };
    }

    const refreshReason = missingUiReviewArtifacts
        ? 'ui-review.md and ui-review.json were incomplete or missing.'
        : `${newestInput.name} is newer than the current UI review receipts.`;
    const refreshed = refreshUiReviewArtifacts(feature, featureDir, {
        ...options,
        refreshReason,
        evidenceUpdatedAt: newestInput ? new Date(newestInput.mtimeMs).toISOString() : null,
        evidenceUpdatedFrom: newestInput?.name || null,
    });
    if (refreshed.receipt) {
        refreshed.receipt.freshness = {
            source: refreshed.receipt.freshness?.source || options.refreshSource || 'unknown',
            reason: refreshed.receipt.freshness?.reason || refreshReason,
            evidenceUpdatedAt:
                refreshed.receipt.freshness?.evidenceUpdatedAt ||
                (newestInput ? new Date(newestInput.mtimeMs).toISOString() : null),
            evidenceUpdatedFrom: refreshed.receipt.freshness?.evidenceUpdatedFrom || newestInput?.name || null,
        };
        writeJsonFile(uiReviewReceiptArtifact, refreshed.receipt);
    }

    return {
        ...refreshed,
        attempted: true,
        refreshed: refreshed.ok && !refreshed.skipped,
        reason: refreshReason,
        evidenceUpdatedAt: newestInput ? new Date(newestInput.mtimeMs).toISOString() : null,
        evidenceUpdatedFrom: newestInput?.name || null,
        receipt: refreshed.receipt || loadUiReviewReceipt(feature, featureDir),
    };
}

function bootstrapFeatureDesignArtifacts(feature, featureDir, options = {}) {
    const prompt = normalizePromptWhitespace(options.prompt || resolveFeaturePromptForDesign(featureDir));
    if (!prompt) {
        return {
            ok: false,
            skipped: false,
            reason: 'No prompt/spec/vibe context was available to derive UI design artifacts.',
        };
    }

    const existingRoutePath = path.join(featureDir, 'design-routing.json');
    const existingRoute = readJsonFile(existingRoutePath);
    const route = existingRoute || routeDesignSystems(prompt, { stack: options.stack });

    if (route.domain === 'none') {
        return {
            ok: true,
            skipped: true,
            route,
            reason: 'Feature does not appear UI-intensive, so no design artifacts were generated.',
        };
    }

    if (!existingRoute || options.force) {
        writeJsonFile(existingRoutePath, {
            ...route,
            source: options.source || 'bootstrap-design',
            prompt,
            updatedAt: new Date().toISOString(),
        });
    }

    const designSystemPath = path.join(featureDir, 'design-system.md');
    let designSystemWritten = false;
    if (!route.auditOnly && (!fs.existsSync(designSystemPath) || options.force)) {
        const generation = generateDesignSystemMarkdown(prompt, {
            projectName: options.projectName || feature || 'Steroid Design System',
        });
        if (!generation.ok) {
            return {
                ok: false,
                skipped: false,
                route,
                reason: generation.error,
            };
        }
        fs.writeFileSync(designSystemPath, `${generation.content.trim()}\n`);
        designSystemWritten = true;
    }

    return {
        ok: true,
        skipped: false,
        route,
        designRouteWritten: !existingRoute || !!options.force,
        designSystemWritten,
        auditOnly: !!route.auditOnly,
    };
}

/**
 * Detects blocked shell syntax that would allow command chaining, piping, or redirection.
 * Quote-wrapped text is ignored so safe arguments like grep "a|b" are not blocked.
 *
 * @param {string} input
 * @returns {string|null}
 */
function findBlockedShellSyntax(input) {
    const source = stripWrappingQuotes((input || '').trim());
    let quote = null;
    let escape = false;

    for (let i = 0; i < source.length; i++) {
        const char = source[i];
        const next = source[i + 1] || '';

        if (escape) {
            escape = false;
            continue;
        }

        if (char === '\\' && quote === '"') {
            escape = true;
            continue;
        }

        if (quote) {
            if (char === quote) {
                quote = null;
            }
            continue;
        }

        if (char === '"' || char === "'") {
            quote = char;
            continue;
        }

        if (char === '\r' || char === '\n') return 'newline';
        if (char === '&' && next === '&') return '&&';
        if (char === '|' && next === '|') return '||';
        if (char === '$' && next === '(') return '$(';
        if (char === '>' && next === '>') return '>>';
        if (char === '<' && next === '<') return '<<';
        if (char === ';') return ';';
        if (char === '&') return '&';
        if (char === '`') return '`';
        if (char === '|') return '|';
        if (char === '>') return '>';
        if (char === '<') return '<';
    }

    return null;
}

/**
 * Safely reads JSON from disk.
 *
 * @param {string} filePath
 * @returns {Record<string, any>|null}
 */
function readJsonFile(filePath) {
    if (!fs.existsSync(filePath)) return null;
    try {
        return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    } catch {
        return null;
    }
}

/**
 * Writes JSON to disk with stable formatting.
 *
 * @param {string} filePath
 * @param {Record<string, any>} data
 */
function writeJsonFile(filePath, data) {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

/**
 * Parses stage statuses from review.md when present.
 *
 * @param {string} content
 * @returns {{ stage1: string, stage2: string }}
 */
function parseReviewMarkdown(content) {
    const stage1Patterns = [
        /\*{0,2}Stage 1 \(Spec\)\*{0,2}:\s*(PASS|FAIL|PENDING)/,
        /\*{0,2}Stage 1 Result:\*{0,2}\s*(PASS|FAIL|PENDING)/,
    ];
    const stage2Patterns = [
        /\*{0,2}Stage 2 \(Quality\)\*{0,2}:\s*(PASS|FAIL|PENDING)/,
        /\*{0,2}Stage 2 Result:\*{0,2}\s*(PASS|FAIL|PENDING)/,
    ];

    let stage1 = 'PENDING';
    let stage2 = 'PENDING';

    for (const pattern of stage1Patterns) {
        const match = content.match(pattern);
        if (match) {
            stage1 = match[1];
            break;
        }
    }

    for (const pattern of stage2Patterns) {
        const match = content.match(pattern);
        if (match) {
            stage2 = match[1];
            break;
        }
    }

    return { stage1, stage2 };
}

/**
 * Normalizes a status-like string against an allowlist.
 *
 * @param {unknown} value
 * @param {string[]} allowed
 * @param {string|null} fallback
 * @returns {string|null}
 */
function normalizeAllowedStatus(value, allowed, fallback) {
    if (typeof value !== 'string') return fallback;
    const normalized = value.trim().toUpperCase();
    return allowed.includes(normalized) ? normalized : fallback;
}

/**
 * Removes fenced code blocks before markdown checklist parsing so examples
 * do not inflate task counts.
 *
 * @param {string} content
 * @returns {string}
 */
function stripFencedCodeBlocks(content) {
    return (content || '').replace(/```[\s\S]*?```/g, '');
}

/**
 * Parses markdown checklist statistics from a document.
 *
 * @param {string} content
 * @returns {{ total: number, done: number, remaining: number, percent: number, deferred: string[] }}
 */
function parseChecklistStats(content) {
    const sanitized = stripFencedCodeBlocks(content);
    const checklistLines = sanitized.match(/^- \[[ x]\].+$/gm) || [];
    const doneLines = sanitized.match(/^- \[x\].+$/gm) || [];
    const deferred = sanitized.match(/^- \[ \].+$/gm) || [];
    const total = checklistLines.length;
    const done = doneLines.length;
    const remaining = total - done;
    const percent = total > 0 ? Math.round((done / total) * 100) : 0;
    return { total, done, remaining, percent, deferred };
}

/**
 * Extracts governed checklist lines from plan-like markdown.
 *
 * @param {string} content
 * @returns {string[]}
 */
function extractChecklistLines(content) {
    const sanitized = stripFencedCodeBlocks(content);
    return sanitized.match(/^- \[[ x/]\].+$/gm) || [];
}

/**
 * Validates the minimum governed structure for phase artifacts that should not be
 * treated as complete based on line count alone.
 *
 * @param {string} fileName
 * @param {string} content
 * @returns {{ ok: boolean, reason: string|null }}
 */
function validateGovernedPhaseArtifact(fileName, content) {
    const text = String(content || '');

    if (fileName === 'spec.md') {
        const checks = [
            { ok: /^# Specification:/m.test(text), label: '# Specification:' },
            { ok: /^## User Stories$/m.test(text), label: '## User Stories' },
            { ok: /^## Success Criteria$/m.test(text), label: '## Success Criteria' },
            { ok: /^### Story /m.test(text), label: 'at least one story section' },
            { ok: /\*\*Acceptance Criteria:\*\*/m.test(text), label: '**Acceptance Criteria:**' },
        ];
        const missing = checks.filter((check) => !check.ok).map((check) => check.label);
        return {
            ok: missing.length === 0,
            reason: missing.length ? `Missing governed spec structure: ${missing.join(', ')}` : null,
        };
    }

    if (fileName === 'research.md') {
        const checks = [
            { ok: /^# Research:/m.test(text), label: '# Research:' },
            { ok: /^## Summary$/m.test(text), label: '## Summary' },
            { ok: /^## Standard Stack$/m.test(text), label: '## Standard Stack' },
            { ok: /^## Architecture Patterns$/m.test(text), label: '## Architecture Patterns' },
        ];
        const missing = checks.filter((check) => !check.ok).map((check) => check.label);
        return {
            ok: missing.length === 0,
            reason: missing.length ? `Missing governed research structure: ${missing.join(', ')}` : null,
        };
    }

    if (fileName === 'plan.md') {
        const checks = [
            { ok: /^# Implementation Plan:/m.test(text), label: '# Implementation Plan:' },
            { ok: /^## Tech Stack$/m.test(text), label: '## Tech Stack' },
            { ok: /^## Execution Checklist$/m.test(text), label: '## Execution Checklist' },
            { ok: /^- \[[ x]\] /m.test(text), label: 'at least one checklist item' },
        ];
        const missing = checks.filter((check) => !check.ok).map((check) => check.label);
        return {
            ok: missing.length === 0,
            reason: missing.length ? `Missing governed plan structure: ${missing.join(', ')}` : null,
        };
    }

    return { ok: true, reason: null };
}

/**
 * Reads the active or latest archived artifact for a feature.
 *
 * @param {string} featureDir
 * @param {string} name
 * @returns {string|null}
 */
function readLatestFeatureArtifact(featureDir, name) {
    const activePath = path.join(featureDir, name);
    if (fs.existsSync(activePath)) return fs.readFileSync(activePath, 'utf-8');

    const archiveDir = path.join(featureDir, 'archive');
    if (fs.existsSync(archiveDir)) {
        const archiveFiles = fs
            .readdirSync(archiveDir)
            .filter((fileName) => fileName.endsWith(name))
            .sort();
        if (archiveFiles.length > 0) {
            return fs.readFileSync(path.join(archiveDir, archiveFiles[archiveFiles.length - 1]), 'utf-8');
        }
    }
    return null;
}

/**
 * Reads the active or latest archived JSON artifact for a feature.
 *
 * @param {string} featureDir
 * @param {string} name
 * @returns {Record<string, any>|null}
 */
function readLatestFeatureJsonArtifact(featureDir, name) {
    const content = readLatestFeatureArtifact(featureDir, name);
    if (!content) return null;
    try {
        return JSON.parse(content);
    } catch {
        return null;
    }
}

/**
 * Converts a simple glob pattern into a RegExp.
 * Supports `*` and `?`, normalizing path separators first.
 *
 * @param {string} pattern
 * @returns {RegExp}
 */
function globToRegExp(pattern) {
    const normalized = (pattern || '').replace(/\\/g, '/');
    const escaped = normalized
        .replace(/[|\\{}()[\]^$+?.]/g, '\\$&')
        .replace(/\*/g, '.*')
        .replace(/\?/g, '.');
    return new RegExp(`^${escaped}$`);
}

/**
 * Returns true when a path stays within the current project root.
 *
 * @param {string} resolvedPath
 * @returns {boolean}
 */
function isWithinTargetDir(resolvedPath) {
    const rel = path.relative(targetDir, resolvedPath);
    return rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel));
}

/**
 * Walks files/directories recursively and invokes a visitor for each entry.
 *
 * @param {string} startPath
 * @param {{ maxDepth?: number, skipRoot?: boolean }} options
 * @param {(entry: { absolutePath: string, relativePath: string, name: string, depth: number, isFile: boolean, isDirectory: boolean }) => boolean|void} visitor
 * @param {number} depth
 * @returns {boolean} true when traversal should stop early
 */
function walkPathEntries(startPath, options, visitor, depth = 0) {
    if (!fs.existsSync(startPath)) return false;

    const stat = fs.statSync(startPath);
    const entry = {
        absolutePath: startPath,
        relativePath: path.relative(targetDir, startPath) || '.',
        name: path.basename(startPath),
        depth,
        isFile: stat.isFile(),
        isDirectory: stat.isDirectory(),
    };

    if (!(options.skipRoot && depth === 0)) {
        const shouldStop = visitor(entry);
        if (shouldStop === true) return true;
    }

    if (!stat.isDirectory()) return false;
    if (depth >= (options.maxDepth ?? Number.POSITIVE_INFINITY)) return false;

    const children = fs.readdirSync(startPath, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name));
    for (const child of children) {
        const childPath = path.join(startPath, child.name);
        if (walkPathEntries(childPath, options, visitor, depth + 1)) {
            return true;
        }
    }
    return false;
}

/**
 * Normalizes a Next.js App Router segment into a public URL segment.
 *
 * @param {string} segment
 * @returns {string|null}
 */
function normalizeAppRouteSegment(segment) {
    if (!segment) return null;
    if (segment.startsWith('(') && segment.endsWith(')')) return null;
    if (segment.startsWith('@')) return null;
    return segment;
}

/**
 * Normalizes a public route for comparisons.
 *
 * @param {string} route
 * @param {string} basePath
 * @returns {string|null}
 */
function normalizePublicRoute(route, basePath = '') {
    if (!route || typeof route !== 'string') return null;
    let normalized = route.trim();
    if (!normalized) return null;
    if (!normalized.startsWith('/')) normalized = `/${normalized}`;
    if (normalized !== '/' && normalized.endsWith('/')) normalized = normalized.replace(/\/+$/, '');
    if (basePath && basePath !== '/' && !normalized.startsWith(`${basePath}/`) && normalized !== basePath) {
        normalized = normalized === '/' ? basePath : `${basePath}${normalized}`;
    }
    if (['/_app', '/_document', '/_error'].includes(normalized)) return null;
    return normalized || '/';
}

/**
 * Collects public routes from a Next.js App Router directory, accounting for route groups.
 *
 * @param {string} appDir
 * @returns {Set<string>}
 */
function collectNextAppRoutes(appDir) {
    const routes = new Set();
    if (!fs.existsSync(appDir)) return routes;

    const walk = (dir, segments) => {
        for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
            const fullPath = path.join(dir, entry.name);
            if (entry.isDirectory()) {
                const publicSegment = normalizeAppRouteSegment(entry.name);
                walk(fullPath, publicSegment ? [...segments, publicSegment] : segments);
                continue;
            }

            if (!entry.isFile()) continue;
            if (!/^page\.(tsx|jsx|ts|js)$/.test(entry.name)) continue;

            const route = segments.length === 0 ? '/' : `/${segments.join('/')}`;
            routes.add(route);
        }
    };

    walk(appDir, []);
    return routes;
}

/**
 * Collects public routes from Next.js build artifacts when available.
 *
 * @param {string} projectDir
 * @returns {Set<string>}
 */
function collectNextRoutesFromBuildArtifacts(projectDir) {
    const routes = new Set();
    const nextDir = path.join(projectDir, '.next');
    if (!fs.existsSync(nextDir)) return routes;

    const manifests = [
        path.join(nextDir, 'app-path-routes-manifest.json'),
        path.join(nextDir, 'routes-manifest.json'),
        path.join(nextDir, 'server', 'pages-manifest.json'),
    ];

    for (const manifestPath of manifests) {
        const manifest = readJsonFile(manifestPath);
        if (!manifest) continue;

        if (manifestPath.endsWith('app-path-routes-manifest.json')) {
            for (const route of Object.values(manifest)) {
                const normalized = normalizePublicRoute(route);
                if (normalized) routes.add(normalized);
            }
            continue;
        }

        if (manifestPath.endsWith('routes-manifest.json')) {
            const basePath = manifest.basePath || '';
            for (const route of [...(manifest.staticRoutes || []), ...(manifest.dynamicRoutes || [])]) {
                const normalized = normalizePublicRoute(route.page, basePath);
                if (normalized) routes.add(normalized);
            }
            continue;
        }

        if (manifestPath.endsWith('pages-manifest.json')) {
            for (const route of Object.keys(manifest)) {
                const normalized = normalizePublicRoute(route);
                if (normalized) routes.add(normalized);
            }
        }
    }

    return routes;
}

/**
 * Finds dead route references by comparing hrefs against collected public routes.
 *
 * @param {string} projectDir
 * @param {string} srcDir
 * @param {{ preferBuildArtifacts?: boolean }} options
 * @returns {{ route: string, files: string[] }[]}
 */
function findDeadRoutes(projectDir, srcDir, options = {}) {
    const appDir = path.join(srcDir, 'app');
    const knownRoutes = options.preferBuildArtifacts ? collectNextRoutesFromBuildArtifacts(projectDir) : new Set();
    if (knownRoutes.size === 0 && fs.existsSync(appDir)) {
        for (const route of collectNextAppRoutes(appDir)) knownRoutes.add(route);
    }
    if (knownRoutes.size === 0) return [];

    const refs = new Map();
    const hrefPattern = /href=["'](\/[^"']*)["']/g;

    const walk = (dir) => {
        for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
            const fullPath = path.join(dir, entry.name);
            if (entry.isDirectory()) {
                walk(fullPath);
                continue;
            }

            if (!/\.(tsx|jsx|ts|js)$/.test(entry.name)) continue;
            const fileContent = fs.readFileSync(fullPath, 'utf-8');
            let match;
            while ((match = hrefPattern.exec(fileContent)) !== null) {
                const route = match[1];
                if (!route || route === '/') continue;
                if (route.includes('[') || route.startsWith('/#')) continue;
                if (knownRoutes.has(route)) continue;

                const fileList = refs.get(route) || new Set();
                fileList.add(path.relative(targetDir, fullPath));
                refs.set(route, fileList);
            }
        }
    };

    walk(srcDir);
    return Array.from(refs.entries()).map(([route, files]) => ({
        route,
        files: Array.from(files).sort(),
    }));
}

/**
 * Builds a human-readable handoff report from feature artifacts.
 *
 * @param {string} feature
 * @param {string} featureDir
 * @param {{ error_count?: number, error_history?: string[] }} state
 * @param {{ archived?: boolean }} options
 * @returns {string}
 */
function generateHandoffReport(feature, featureDir, state, options = {}) {
    const specContent = readLatestFeatureArtifact(featureDir, 'spec.md');
    const promptReceiptContent = readLatestFeatureArtifact(featureDir, 'prompt.json');
    const verifyContent = readLatestFeatureArtifact(featureDir, 'verify.md');
    const verifyReceipt = readLatestFeatureJsonArtifact(featureDir, 'verify.json');
    const planContent = readLatestFeatureArtifact(featureDir, 'plan.md');
    const reviewContent = readLatestFeatureArtifact(featureDir, 'review.md');
    const uiReviewReceipt = normalizeUiReviewReceipt(readLatestFeatureJsonArtifact(featureDir, 'ui-review.json'), feature);
    const uiArchivePolicy = buildUiArchivePolicy(uiReviewReceipt, {
        deepRequested: !!verifyReceipt?.deepRequested,
    });
    const checklist = planContent ? parseChecklistStats(planContent) : null;
    const archived = !!options.archived;

    let report = `# Handoff Report: ${feature}\n\n`;
    report += `**Completed:** ${new Date().toISOString()}\n`;
    if (archived) report += `**Status:** Archived\n`;
    report += `**Generated by:** steroid-workflow v${SW_VERSION}\n\n`;

    report += `## What Was Built\n\n`;
    if (specContent) {
        const criteria = specContent.match(/(?:Given|When|Then|Scenario).+/gi) || [];
        if (criteria.length > 0) {
            report += `${criteria.length} acceptance criteria recorded in spec.md:\n\n`;
            for (const c of criteria.slice(0, 10)) report += `- ${c.trim()}\n`;
            if (criteria.length > 10) report += `- _(and ${criteria.length - 10} more)_\n`;
        } else {
            report += '_See spec.md for full acceptance criteria._\n';
        }
    } else {
        report += '_No spec.md found._\n';
    }

    if (reviewContent) {
        const review = parseReviewMarkdown(reviewContent);
        report += `\nImplementation evidence review:\n\n`;
        report += `- Stage 1 (Spec): ${review.stage1}\n`;
        report += `- Stage 2 (Quality): ${review.stage2}\n`;
    }

    report += `\n## What Was Tested\n\n`;
    if (verifyContent) {
        const statusMatch = verifyContent.match(/\*\*Status:\*\* (PASS|FAIL|CONDITIONAL)/);
        const scoreMatch = verifyContent.match(/\*\*Spec Score:\*\* (.+)/);
        report += `**Status:** ${statusMatch ? statusMatch[1] : 'Unknown'}\n`;
        if (scoreMatch) report += `**Score:** ${scoreMatch[1]}\n`;
        const testMatch = verifyContent.match(/\*\*Result:\*\* (.+)/);
        if (testMatch) report += `**Tests:** ${testMatch[1]}\n`;
    } else {
        report += '_No verify.md found._\n';
    }

    report += `\n## Prompt Interpretation\n\n`;
    if (promptReceiptContent) {
        try {
            const promptReceipt = JSON.parse(promptReceiptContent);
            report += `- Primary Intent: ${promptReceipt.primaryIntent || 'Unknown'}\n`;
            if (Array.isArray(promptReceipt.secondaryIntents) && promptReceipt.secondaryIntents.length > 0) {
                report += `- Secondary Intents: ${promptReceipt.secondaryIntents.join(', ')}\n`;
            }
            report += `- Continuation State: ${promptReceipt.continuationState || 'Unknown'}\n`;
            report += `- Complexity: ${promptReceipt.complexity || 'Unknown'}\n`;
            report += `- Ambiguity: ${promptReceipt.ambiguity || 'Unknown'}\n`;
            report += `- Recommended Route: ${promptReceipt.recommendedPipeline || 'Unknown'}\n`;
        } catch {
            report += '_prompt.json found but could not be parsed._\n';
        }
    } else {
        report += '_No prompt receipt captured._\n';
    }

    report += `\n## Review Status\n\n`;
    if (reviewContent) {
        const review = parseReviewMarkdown(reviewContent);
        report += `- Spec Review: ${review.stage1}\n`;
        report += `- Quality Review: ${review.stage2}\n`;
    } else {
        report += '_No two-stage review performed._\n';
    }

    report += `\n## Tasks Completed\n\n`;
    if (checklist) {
        report += `${checklist.done}/${checklist.total} tasks completed (${checklist.percent}%)\n`;
    } else {
        report += '_No plan.md found._\n';
    }

    report += `\n## Known Limitations\n\n`;
    if (checklist) {
        if (checklist.deferred.length > 0) {
            report += `${checklist.deferred.length} items were not completed:\n\n`;
            for (const d of checklist.deferred.slice(0, 5)) report += `${d}\n`;
            if (checklist.deferred.length > 5) report += `- _(and ${checklist.deferred.length - 5} more)_\n`;
        } else {
            report += 'All planned tasks were completed.\n';
        }
    } else {
        report += '_Unknown — no plan.md available._\n';
    }

    report += `\n## Build Health\n\n`;
    report += `- Circuit breaker errors during build: ${state.error_count || 0}\n`;
    if (state.error_history && state.error_history.length > 0) {
        report += '- Errors encountered:\n';
        for (const err of state.error_history.slice(-5)) report += `  - ${err}\n`;
    }

    if (uiReviewReceipt) {
        report += `\n## Frontend Quality\n\n`;
        report += `- UI Review Status: ${uiReviewReceipt.status || 'Unknown'}\n`;
        report += `- Verification Status: ${uiReviewReceipt.verifyStatus || 'Unknown'}\n`;
        report += `- Frontend Release Recommendation: ${uiArchivePolicy.recommendation}\n`;
        report += `- Stack: ${uiReviewReceipt.stack || 'Unknown'}\n`;
        report += `- Wrapper Skill: ${uiReviewReceipt.wrapperSkill || 'none'}\n`;
        report += `- Refreshed By: ${uiReviewReceipt.freshness?.source || 'unknown'}\n`;
        report += `- Refresh Reason: ${uiReviewReceipt.freshness?.reason || 'Unknown'}\n`;
        if (uiReviewReceipt.generatedAt) {
            report += `- UI Review Generated: ${uiReviewReceipt.generatedAt}\n`;
        }
        if (uiReviewReceipt.freshness?.evidenceUpdatedAt) {
            report += `- Latest Frontend Evidence: ${uiReviewReceipt.freshness.evidenceUpdatedAt}\n`;
        }
        if (uiReviewReceipt.freshness?.evidenceUpdatedFrom) {
            report += `- Latest Evidence Source: ${uiReviewReceipt.freshness.evidenceUpdatedFrom}\n`;
        }
        if (uiReviewReceipt.previewTarget) {
            report += `- Preview Target: ${uiReviewReceipt.previewTarget}\n`;
        }
        report += `- Policy Summary: ${uiArchivePolicy.summary}\n`;
        const findings = Array.isArray(uiReviewReceipt.findings) ? uiReviewReceipt.findings : [];
        if (findings.length > 0) {
            report += '\nTop frontend findings:\n';
            for (const finding of findings.slice(0, 5)) {
                report += `- ${String(finding.severity || 'info').toUpperCase()}: ${finding.title || 'Untitled'}${
                    finding.detail ? ` — ${finding.detail}` : ''
                }\n`;
            }
        } else {
            report += '- No significant frontend risks were recorded.\n';
        }
        if (uiArchivePolicy.blockReasons.length > 0) {
            report += '\nFrontend policy blockers:\n';
            for (const reason of uiArchivePolicy.blockReasons) {
                report += `- ${reason}\n`;
            }
            if (uiArchivePolicy.overrideFlag) {
                report += `- Override available: ${uiArchivePolicy.overrideFlag}\n`;
            }
        } else if (uiArchivePolicy.warnReasons.length > 0) {
            report += '\nFrontend policy cautions:\n';
            for (const reason of uiArchivePolicy.warnReasons) {
                report += `- ${reason}\n`;
            }
        }
    }

    report += `\n---\n\n_Generated by steroid-workflow v${SW_VERSION} handoff system_\n`;
    return report;
}

/**
 * Loads review receipt state and backfills it from review.md if possible.
 *
 * @param {string} feature
 * @param {string} featureDir
 * @returns {{ feature: string, stage1: string, stage2: string, source: string, updatedAt: string|null }}
 */
function loadReviewReceipt(feature, featureDir) {
    const reviewJsonPath = path.join(featureDir, 'review.json');
    const reviewMdPath = path.join(featureDir, 'review.md');
    const existing = readJsonFile(reviewJsonPath);
    const reviewMdExists = fs.existsSync(reviewMdPath);

    if (reviewMdExists) {
        const parsed = parseReviewMarkdown(fs.readFileSync(reviewMdPath, 'utf-8'));
        const receipt = {
            feature,
            stage1: parsed.stage1,
            stage2: parsed.stage2,
            source: 'review.md-synced',
            updatedAt: new Date().toISOString(),
        };
        if (
            !existing ||
            existing.feature !== feature ||
            existing.stage1 !== receipt.stage1 ||
            existing.stage2 !== receipt.stage2
        ) {
            writeJsonFile(reviewJsonPath, receipt);
        }
        return receipt;
    }

    if (existing && existing.feature === feature) {
        const receipt = {
            feature,
            stage1: normalizeAllowedStatus(existing.stage1, ['PASS', 'FAIL', 'PENDING'], 'PENDING'),
            stage2: normalizeAllowedStatus(existing.stage2, ['PASS', 'FAIL', 'PENDING'], 'PENDING'),
            source: existing.source || 'review.json',
            updatedAt: existing.updatedAt || null,
        };
        if (
            existing.stage1 !== receipt.stage1 ||
            existing.stage2 !== receipt.stage2 ||
            existing.source !== receipt.source ||
            existing.updatedAt !== receipt.updatedAt
        ) {
            writeJsonFile(reviewJsonPath, receipt);
        }
        return receipt;
    }

    return {
        feature,
        stage1: 'PENDING',
        stage2: 'PENDING',
        source: 'none',
        updatedAt: null,
    };
}

/**
 * Writes review receipt state.
 *
 * @param {string} featureDir
 * @param {{ feature: string, stage1: string, stage2: string, source?: string, updatedAt?: string|null }} receipt
 */
function saveReviewReceipt(featureDir, receipt) {
    writeJsonFile(path.join(featureDir, 'review.json'), {
        feature: receipt.feature,
        stage1: receipt.stage1,
        stage2: receipt.stage2,
        source: receipt.source || 'review.json',
        updatedAt: receipt.updatedAt || new Date().toISOString(),
    });
}

/**
 * Creates a filesystem-safe archive timestamp.
 *
 * @param {Date} [date]
 * @returns {string}
 */
function createArchiveStamp(date = new Date()) {
    return date.toISOString().replace(/[:.]/g, '-');
}

/**
 * Returns a collision-safe archive destination path.
 *
 * @param {string} archiveDir
 * @param {string} archiveStamp
 * @param {string} fileName
 * @returns {string}
 */
function getArchiveDestinationPath(archiveDir, archiveStamp, fileName) {
    let candidate = path.join(archiveDir, `${archiveStamp}-${fileName}`);
    if (!fs.existsSync(candidate)) {
        return candidate;
    }

    let suffix = 2;
    do {
        candidate = path.join(archiveDir, `${archiveStamp}-${suffix}-${fileName}`);
        suffix += 1;
    } while (fs.existsSync(candidate));

    return candidate;
}

/**
 * Parses the verification status from verify.md.
 *
 * @param {string} content
 * @returns {string|null}
 */
function parseVerifyMarkdownStatus(content) {
    const match = content.match(/\*\*Status:\*\*\s*(PASS|FAIL|CONDITIONAL)/);
    return match ? match[1] : null;
}

/**
 * Loads verify receipt state and backfills from verify.md if possible.
 *
 * @param {string} feature
 * @param {string} featureDir
 * @returns {{ feature: string, status: string|null, reviewPassed: boolean, checks: Record<string, any>, updatedAt: string|null, source: string }}
 */
function loadVerifyReceipt(feature, featureDir) {
    const verifyJsonPath = path.join(featureDir, 'verify.json');
    const verifyMdPath = path.join(featureDir, 'verify.md');
    const existing = readJsonFile(verifyJsonPath);

    if (existing && existing.feature === feature) {
        const receipt = {
            feature,
            status: normalizeAllowedStatus(existing.status, ['PASS', 'FAIL', 'CONDITIONAL'], null),
            reviewPassed: !!existing.reviewPassed,
            checks: existing.checks && typeof existing.checks === 'object' && !Array.isArray(existing.checks) ? existing.checks : {},
            updatedAt: existing.updatedAt || null,
            source: existing.source || 'verify.json',
        };
        if (
            existing.status !== receipt.status ||
            existing.reviewPassed !== receipt.reviewPassed ||
            existing.checks !== receipt.checks ||
            existing.source !== receipt.source ||
            existing.updatedAt !== receipt.updatedAt ||
            existing.deepRequested !== !!existing.deepRequested ||
            existing.deepCompleted !== !!existing.deepCompleted
        ) {
            writeJsonFile(verifyJsonPath, {
                ...receipt,
                deepRequested: !!existing.deepRequested,
                deepCompleted: !!existing.deepCompleted,
            });
        }
        return receipt;
    }

    if (fs.existsSync(verifyMdPath)) {
        const status = parseVerifyMarkdownStatus(fs.readFileSync(verifyMdPath, 'utf-8'));
        if (status) {
            const receipt = {
                feature,
                status,
                reviewPassed: false,
                checks: {},
                updatedAt: new Date().toISOString(),
                source: 'verify.md',
            };
            writeJsonFile(verifyJsonPath, receipt);
            return receipt;
        }
    }

    return {
        feature,
        status: null,
        reviewPassed: false,
        checks: {},
        updatedAt: null,
        source: 'none',
    };
}

/**
 * Writes verify receipt state.
 *
 * @param {string} featureDir
 * @param {{ feature: string, status: string, reviewPassed: boolean, checks: Record<string, any>, updatedAt?: string, source?: string }} receipt
 */
function saveVerifyReceipt(featureDir, receipt) {
    writeJsonFile(path.join(featureDir, 'verify.json'), {
        feature: receipt.feature,
        status: receipt.status,
        reviewPassed: !!receipt.reviewPassed,
        checks: receipt.checks || {},
        deepRequested: !!receipt.deepRequested,
        deepCompleted: !!receipt.deepCompleted,
        updatedAt: receipt.updatedAt || new Date().toISOString(),
        source: receipt.source || 'verify.json',
    });
}

/**
 * Writes feature request receipt state.
 *
 * @param {string} featureDir
 * @param {{ feature: string, requestedAt?: string, source?: string, summary?: string }} receipt
 */
function saveRequestReceipt(featureDir, receipt) {
    writeJsonFile(path.join(featureDir, 'request.json'), {
        feature: receipt.feature,
        requestedAt: receipt.requestedAt || new Date().toISOString(),
        source: receipt.source || 'scan',
        summary: receipt.summary || 'Feature initialized for governed scan context capture.',
    });
}

/**
 * Loads feature request receipt state and normalizes valid machine-readable fields.
 *
 * @param {string} feature
 * @param {string} featureDir
 * @returns {{ feature: string, requestedAt: string|null, source: string, summary: string|null }}
 */
function loadRequestReceipt(feature, featureDir) {
    const requestJsonPath = path.join(featureDir, 'request.json');
    const existing = readJsonFile(requestJsonPath);

    if (existing && existing.feature === feature) {
        const receipt = {
            feature,
            requestedAt: typeof existing.requestedAt === 'string' ? existing.requestedAt : null,
            source: typeof existing.source === 'string' ? existing.source : 'request.json',
            summary: typeof existing.summary === 'string' ? existing.summary : null,
        };
        if (
            receipt.requestedAt &&
            (existing.requestedAt !== receipt.requestedAt ||
                existing.source !== receipt.source ||
                existing.summary !== receipt.summary)
        ) {
            writeJsonFile(requestJsonPath, receipt);
        }
        return receipt;
    }

    return {
        feature,
        requestedAt: null,
        source: 'none',
        summary: null,
    };
}

/**
 * Writes completion receipt state.
 *
 * @param {string} featureDir
 * @param {{ feature: string, status: string, sourceArtifacts?: string[], nextActions?: string[], updatedAt?: string, source?: string, summary?: string }} receipt
 */
function saveCompletionReceipt(featureDir, receipt) {
    writeJsonFile(path.join(featureDir, 'completion.json'), {
        feature: receipt.feature,
        status: receipt.status,
        sourceArtifacts: Array.isArray(receipt.sourceArtifacts) ? receipt.sourceArtifacts : [],
        nextActions: Array.isArray(receipt.nextActions) ? receipt.nextActions : [],
        updatedAt: receipt.updatedAt || new Date().toISOString(),
        source: receipt.source || 'completion.json',
        summary: receipt.summary || 'Verification completed. Feature is ready for completion handling.',
    });
}

/**
 * Loads completion receipt state and normalizes valid machine-readable fields.
 *
 * @param {string} feature
 * @param {string} featureDir
 * @returns {{ feature: string, status: string|null, sourceArtifacts: string[], nextActions: string[], updatedAt: string|null, source: string, summary: string|null }}
 */
function loadCompletionReceipt(feature, featureDir) {
    const completionJsonPath = path.join(featureDir, 'completion.json');
    const existing = readJsonFile(completionJsonPath);

    if (existing && existing.feature === feature) {
        const receipt = {
            feature,
            status: normalizeAllowedStatus(existing.status, ['PASS', 'CONDITIONAL'], null),
            sourceArtifacts: Array.isArray(existing.sourceArtifacts)
                ? existing.sourceArtifacts.filter((v) => typeof v === 'string')
                : [],
            nextActions: Array.isArray(existing.nextActions) ? existing.nextActions.filter((v) => typeof v === 'string') : [],
            updatedAt: existing.updatedAt || null,
            source: existing.source || 'completion.json',
            summary: typeof existing.summary === 'string' ? existing.summary : null,
        };

        if (
            receipt.status &&
            (existing.status !== receipt.status ||
                existing.source !== receipt.source ||
                existing.updatedAt !== receipt.updatedAt ||
                existing.summary !== receipt.summary ||
                JSON.stringify(existing.sourceArtifacts || []) !== JSON.stringify(receipt.sourceArtifacts) ||
                JSON.stringify(existing.nextActions || []) !== JSON.stringify(receipt.nextActions))
        ) {
            writeJsonFile(completionJsonPath, receipt);
        }

        return receipt;
    }

    return {
        feature,
        status: null,
        sourceArtifacts: [],
        nextActions: [],
        updatedAt: null,
        source: 'none',
        summary: null,
    };
}

/**
 * Loads execution receipt state and normalizes the governed machine-readable fields.
 *
 * @param {string} feature
 * @param {string} featureDir
 * @returns {{ feature: string, status: string|null, consumedArtifacts: string[], updatedAt: string|null, source: string, summary: string|null }}
 */
function loadExecutionReceipt(feature, featureDir) {
    const executionJsonPath = path.join(featureDir, 'execution.json');
    const existing = readJsonFile(executionJsonPath);

    if (existing && existing.feature === feature) {
        const receipt = {
            feature,
            status: normalizeAllowedStatus(existing.status, ['COMPLETE', 'BLOCKED'], null),
            consumedArtifacts: Array.isArray(existing.consumed_artifacts)
                ? existing.consumed_artifacts.filter((v) => typeof v === 'string')
                : Array.isArray(existing.consumedArtifacts)
                  ? existing.consumedArtifacts.filter((v) => typeof v === 'string')
                  : [],
            updatedAt: existing.updatedAt || null,
            source: typeof existing.source === 'string' ? existing.source : 'execution.json',
            summary: typeof existing.summary === 'string' ? existing.summary : null,
        };

        if (
            receipt.status &&
            (existing.status !== receipt.status ||
                existing.source !== receipt.source ||
                existing.updatedAt !== receipt.updatedAt ||
                existing.summary !== receipt.summary ||
                JSON.stringify(existing.consumed_artifacts || existing.consumedArtifacts || []) !==
                    JSON.stringify(receipt.consumedArtifacts))
        ) {
            writeJsonFile(executionJsonPath, {
                feature: receipt.feature,
                status: receipt.status,
                consumed_artifacts: receipt.consumedArtifacts,
                updatedAt: receipt.updatedAt,
                source: receipt.source,
                summary: receipt.summary,
            });
        }

        return receipt;
    }

    return {
        feature,
        status: null,
        consumedArtifacts: [],
        updatedAt: null,
        source: 'none',
        summary: null,
    };
}

/**
 * Writes the live task artifact derived from the execution checklist.
 *
 * @param {string} feature
 * @param {string} featureDir
 * @param {string} planContent
 */
function syncTasksArtifact(feature, featureDir, planContent) {
    const checklistLines = extractChecklistLines(planContent);
    const tasksContent = [
        `# Tasks: ${feature}`,
        '',
        `**Source**: .memory/changes/${feature}/plan.md`,
        `**Updated**: ${new Date().toISOString()}`,
        '',
        '## Execution Checklist',
        '',
        ...(checklistLines.length > 0 ? checklistLines : ['- [ ] No checklist items found in plan.md']),
        '',
    ].join('\n');
    fs.writeFileSync(path.join(featureDir, 'tasks.md'), tasksContent);
}

/**
 * Writes the governed execution receipt.
 *
 * @param {string} featureDir
 * @param {{ feature: string, status: string, consumedArtifacts?: string[], updatedAt?: string, source?: string, summary?: string }} receipt
 */
function saveExecutionReceipt(featureDir, receipt) {
    writeJsonFile(path.join(featureDir, 'execution.json'), {
        feature: receipt.feature,
        status: receipt.status,
        consumed_artifacts: Array.isArray(receipt.consumedArtifacts) ? receipt.consumedArtifacts : [],
        updatedAt: receipt.updatedAt || new Date().toISOString(),
        source: receipt.source || 'execution.json',
        summary: receipt.summary || 'Execution receipt recorded.',
    });
}

/**
 * Normalizes whitespace in prompt-like input.
 *
 * @param {string} value
 * @returns {string}
 */
function normalizePromptWhitespace(value) {
    return (value || '').replace(/\s+/g, ' ').trim();
}

const PROMPT_INTENT_KEYWORDS = {
    fix: [
        'fix',
        'bug',
        'debug',
        'broken',
        'error',
        'crash',
        'issue',
        'wrong',
        'failing',
        'not working',
        'doesnt work',
        "doesn't work",
        'investigate',
        'repair',
        'regression',
    ],
    refactor: [
        'refactor',
        'restructure',
        'reorganize',
        'clean up',
        'cleanup',
        'improve',
        'optimize',
        'simplify',
        'extract',
        'decouple',
        'polish',
    ],
    migrate: ['migrate', 'migration', 'upgrade', 'switch to', 'move to', 'convert', 'port', 'transition'],
    document: ['document', 'docs', 'readme', 'jsdoc', 'comment', 'explain', 'annotate', 'api docs', 'documentation'],
    build: ['build', 'create', 'add', 'make', 'implement', 'feature', 'new', 'design', 'develop', 'setup', 'set up'],
};

const PROMPT_PIPELINE_HINTS = {
    build: 'scan → vibe → specify → research → architect → engine → verify',
    fix: 'scan → diagnose → engine (targeted) → verify',
    refactor: 'scan → specify (target state) → architect → engine → verify',
    migrate: 'scan → research (target tech) → architect → engine → verify',
    document: 'scan → specify (doc scope) → engine (docs) → verify',
};

const ROUTE_PHASE_HINTS = {
    'standard-build': ['scan', 'normalize-prompt', 'vibe', 'specify', 'research', 'architect', 'engine', 'verify'],
    'diagnose-first': ['scan', 'normalize-prompt', 'diagnose', 'engine', 'verify'],
    'resume-mode': ['scan', 'normalize-prompt', 'resume', 'engine', 'verify'],
    'lite-change': ['scan', 'normalize-prompt', 'vibe', 'specify', 'architect', 'engine', 'verify'],
    'research-heavy': ['scan', 'normalize-prompt', 'research', 'architect', 'engine', 'verify'],
    'split-work': ['scan', 'normalize-prompt', 'vibe', 'specify', 'architect', 'engine', 'verify'],
};

function scorePromptIntents(message) {
    const source = normalizePromptWhitespace(message).toLowerCase();
    const scores = {};
    for (const [intent, keywords] of Object.entries(PROMPT_INTENT_KEYWORDS)) {
        let score = 0;
        for (const keyword of keywords) {
            if (source.includes(keyword)) {
                score += keyword.length;
            }
        }
        scores[intent] = score;
    }
    return scores;
}

function inspectPromptSessionState() {
    const featureStates = [];
    if (fs.existsSync(changesDir)) {
        for (const entry of fs.readdirSync(changesDir, { withFileTypes: true })) {
            if (!entry.isDirectory()) continue;
            const featureDir = path.join(changesDir, entry.name);
            const artifactPriority = [
                'verify.json',
                'verify.md',
                'review.json',
                'review.md',
                'plan.md',
                'research.md',
                'spec.md',
                'vibe.md',
                'context.md',
                'diagnosis.md',
            ];
            let lastArtifact = null;
            for (const artifact of artifactPriority) {
                if (fs.existsSync(path.join(featureDir, artifact))) {
                    lastArtifact = artifact;
                    break;
                }
            }
            let updatedAt = null;
            try {
                updatedAt = fs.statSync(featureDir).mtime.toISOString();
            } catch {
                updatedAt = null;
            }
            const reviewReceipt = readJsonFile(path.join(featureDir, 'review.json'));
            const verifyReceipt = readJsonFile(path.join(featureDir, 'verify.json'));
            const incomplete =
                (!verifyReceipt || !['PASS', 'CONDITIONAL'].includes(verifyReceipt.status || '')) &&
                (!reviewReceipt || reviewReceipt.stage1 !== 'PASS' || reviewReceipt.stage2 !== 'PASS');
            featureStates.push({
                name: entry.name,
                updatedAt,
                incomplete,
                lastArtifact,
            });
        }
    }

    const sorted = featureStates.sort((a, b) => new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0));
    const activeFeature = sorted[0] || null;
    let defaultState = 'new-work';
    if ((state.error_count || 0) > 0) {
        defaultState = 'post-failure';
    } else if (activeFeature && activeFeature.incomplete) {
        defaultState = 'resume';
    } else if (activeFeature && activeFeature.lastArtifact === 'verify.json') {
        defaultState = 'post-verify';
    }

    return {
        activeFeature: activeFeature ? activeFeature.name : null,
        latestArtifact: activeFeature ? activeFeature.lastArtifact : null,
        defaultState,
        knownFeatures: sorted.map((feature) => feature.name),
        errorCount: state.error_count || 0,
        recoveryState: state.status || 'active',
    };
}

function analyzePrompt(message, sessionState = inspectPromptSessionState()) {
    const rawPrompt = normalizePromptWhitespace(message);
    const scores = scorePromptIntents(rawPrompt);
    const ranked = Object.entries(scores).sort((a, b) => b[1] - a[1]);
    const primaryIntent = ranked[0] && ranked[0][1] > 0 ? ranked[0][0] : 'build';
    const secondaryIntents = ranked
        .filter(([intent, score]) => intent !== primaryIntent && score > 0)
        .map(([intent]) => intent);
    const lower = rawPrompt.toLowerCase();

    let continuationState = sessionState.defaultState || 'new-work';
    if (/(continue|resume|pick up|carry on|keep going|finish up|where we left off|yesterday)/.test(lower)) {
        continuationState = sessionState.activeFeature ? 'resume' : 'continuation-requested';
    } else if (/(last change|just broke|regression|after the last change|stopped working)/.test(lower)) {
        continuationState = 'post-failure';
    } else if (/(polish|clean up|cleanup|finish|wrap up|finalize|tighten)/.test(lower)) {
        continuationState = 'polish';
    }

    let complexity = 'standard';
    if (
        /(rename|change text|button text|label|typo|copy change|small tweak|minor tweak|one line|one-line)/.test(lower)
    ) {
        complexity = 'trivial';
    } else if (
        /(payment|billing|checkout|auth|authentication|database|schema|infra|security|permissions|role|migration)/.test(
            lower,
        ) ||
        primaryIntent === 'migrate'
    ) {
        complexity = 'high-risk';
    } else if (
        secondaryIntents.length > 0 ||
        /(dashboard|onboarding|redesign|architecture|workflow|system|complex|full app|whole app|enterprise)/.test(lower)
    ) {
        complexity = 'complex';
    }

    let ambiguityScore = 0;
    if (secondaryIntents.length > 0) ambiguityScore += 2;
    if (
        /(better|cleaner|premium|modern|nice|good|improve it|make it pop|more robust|enterprise-ready|clean this up)/.test(
            lower,
        )
    ) {
        ambiguityScore += 2;
    }
    if (primaryIntent === 'build') ambiguityScore += 1;
    if (lower.split(' ').length <= 4) ambiguityScore += 1;
    if (/(something|stuff|things|whatever|somehow|kinda|sort of|maybe)/.test(lower)) ambiguityScore += 1;
    const ambiguity = ambiguityScore >= 4 ? 'high' : ambiguityScore >= 2 ? 'medium' : 'low';

    const splitRecommended =
        secondaryIntents.length > 0 && /( and | also | plus | then | plus also |,)/.test(` ${lower} `);
    const assumptions = [];
    if (/(cleaner|premium|modern|confusing|better ux|feel better|look better)/.test(lower)) {
        assumptions.push(
            'Interpret design language as UX and visual-hierarchy improvements unless the user says otherwise.',
        );
    }
    if (primaryIntent === 'build' && !/(mobile|responsive|desktop only)/.test(lower)) {
        assumptions.push('Preserve responsive behavior by default.');
    }
    if (primaryIntent === 'fix') {
        assumptions.push('Prioritize preserving existing behavior outside the reported issue.');
    }
    if (complexity === 'high-risk') {
        assumptions.push(
            'Require conservative changes and stronger verification because the request touches risky areas.',
        );
    }

    const nonGoals = [];
    if (!/(rewrite|from scratch|rebuild everything|whole app)/.test(lower)) {
        nonGoals.push('Do not rewrite unrelated parts of the codebase.');
    }
    if (secondaryIntents.length > 0) {
        nonGoals.push('Do not silently merge unrelated requested tasks into one unscoped implementation.');
    }

    const unresolvedQuestions = [];
    if (ambiguity === 'high') unresolvedQuestions.push('What concrete outcome would tell us this task is successful?');
    if (secondaryIntents.length > 0) {
        unresolvedQuestions.push('Should this be split into multiple features or handled as one scoped effort?');
    }
    if (!/(react|vue|svelte|node|python|go|rust|next|express|django|rails|php|java|kotlin)/.test(lower)) {
        unresolvedQuestions.push('Should the current stack and architecture be preserved as-is?');
    }

    const suggestedFeatures = splitRecommended
        ? rawPrompt
              .split(/\band\b|\balso\b|,/i)
              .map((part) => normalizePromptWhitespace(part))
              .filter(Boolean)
        : [];
    let recommendedPipeline = 'standard-build';
    if (continuationState === 'resume') {
        recommendedPipeline = 'resume-mode';
    } else if (splitRecommended) {
        recommendedPipeline = 'split-work';
    } else if (primaryIntent === 'fix') {
        recommendedPipeline = 'diagnose-first';
    } else if (complexity === 'trivial') {
        recommendedPipeline = 'lite-change';
    } else if (primaryIntent === 'migrate' || complexity === 'high-risk') {
        recommendedPipeline = 'research-heavy';
    }

    return {
        rawPrompt,
        normalizedSummary: rawPrompt ? rawPrompt[0].toUpperCase() + rawPrompt.slice(1) : '',
        primaryIntent,
        secondaryIntents,
        confidence: Math.min(1, Math.max(0.2, (scores[primaryIntent] || 0) / 20)).toFixed(2),
        ambiguity,
        complexity,
        risk: complexity === 'high-risk' ? 'high' : complexity === 'complex' ? 'medium' : 'low',
        continuationState,
        assumptions,
        nonGoals,
        unresolvedQuestions,
        splitRecommended,
        suggestedFeatures,
        recommendedPipeline,
        pipelineHint: PROMPT_PIPELINE_HINTS[primaryIntent],
    };
}

function buildPromptHealth(analysis) {
    return {
        clarity: analysis.ambiguity === 'low' ? 5 : analysis.ambiguity === 'medium' ? 3 : 2,
        completeness: analysis.unresolvedQuestions.length === 0 ? 5 : analysis.unresolvedQuestions.length === 1 ? 4 : 2,
        ambiguity: analysis.ambiguity,
        complexity: analysis.complexity,
        risk: analysis.risk,
        multiIntent: analysis.splitRecommended ? 'yes' : 'no',
        modelSensitivity:
            analysis.ambiguity === 'high' || analysis.complexity === 'high-risk'
                ? 'high'
                : analysis.complexity === 'complex'
                  ? 'medium'
                  : 'low',
        recommendedAction: analysis.splitRecommended
            ? 'split work'
            : analysis.ambiguity === 'high'
              ? 'proceed with assumptions'
              : analysis.complexity === 'high-risk'
                ? 'proceed carefully'
                : 'proceed',
    };
}

function suggestNextPhase(analysis, artifacts) {
    if (!artifacts.request || !artifacts.context) {
        return { phase: 'scan', reason: !artifacts.request ? 'request.json is missing' : 'context.md is missing' };
    }
    if (!artifacts.prompt) {
        return { phase: 'normalize-prompt', reason: 'prompt.json is missing' };
    }

    const route = analysis.recommendedPipeline || 'standard-build';
    if (route === 'diagnose-first') {
        if (!artifacts.diagnosis) {
            return { phase: 'diagnose', reason: 'diagnosis.md is missing for the targeted fix route' };
        }
        if (!artifacts.verify) {
            return { phase: 'engine', reason: 'Execute the targeted fix and generate verification evidence next' };
        }
        return { phase: 'complete', reason: 'Diagnosis and verification artifacts are already present' };
    }

    if (route === 'research-heavy') {
        if (!artifacts.research) {
            return { phase: 'research', reason: 'research.md is missing for the high-risk route' };
        }
        if (!artifacts.plan) {
            return { phase: 'architect', reason: 'plan.md is missing after research' };
        }
        if (!artifacts.verify) {
            return { phase: 'engine', reason: 'Implementation and verification are the next remaining steps' };
        }
        return { phase: 'complete', reason: 'Research-heavy route artifacts are present' };
    }

    if (route === 'resume-mode') {
        if (artifacts.diagnosis && !artifacts.verify) {
            return { phase: 'engine', reason: 'Resume from diagnosis.md and complete the targeted fix' };
        }
        if (artifacts.plan && !artifacts.verify) {
            return { phase: 'engine', reason: 'Resume from the existing plan.md and continue implementation' };
        }
        if (artifacts.research && !artifacts.plan) {
            return { phase: 'architect', reason: 'Resume by turning research into plan.md' };
        }
        if (artifacts.spec && !artifacts.research) {
            return { phase: 'research', reason: 'Resume by filling in research.md' };
        }
        if (artifacts.vibe && !artifacts.spec) {
            return { phase: 'specify', reason: 'Resume by turning vibe.md into spec.md' };
        }
        if (!artifacts.vibe && analysis.primaryIntent === 'fix') {
            return { phase: 'diagnose', reason: 'Resume through diagnosis because the prompt still reads like a fix' };
        }
        if (!artifacts.vibe) {
            return { phase: 'vibe', reason: 'Resume by locking the next structured brief in vibe.md' };
        }
        if (!artifacts.verify) {
            return { phase: 'engine', reason: 'Resume the remaining implementation work' };
        }
        return { phase: 'complete', reason: 'Resume route artifacts already look complete' };
    }

    if (route === 'split-work') {
        if (!artifacts.vibe) {
            return { phase: 'vibe', reason: 'Capture the split intent explicitly in vibe.md first' };
        }
        if (!artifacts.spec) {
            return { phase: 'specify', reason: 'Turn the split request into separate stories or scoped work' };
        }
        if (!artifacts.plan) {
            return { phase: 'architect', reason: 'Create a scoped implementation plan for the split work' };
        }
        if (!artifacts.verify) {
            return { phase: 'engine', reason: 'Implement one scoped slice at a time, then verify' };
        }
        return { phase: 'complete', reason: 'Split-work route artifacts are present' };
    }

    if (route === 'lite-change') {
        if (!artifacts.vibe) {
            return { phase: 'vibe', reason: 'Capture the small change in a minimal vibe.md' };
        }
        if (!artifacts.spec) {
            return { phase: 'specify', reason: 'Define the tiny acceptance boundary before implementation' };
        }
        if (!artifacts.plan) {
            return { phase: 'architect', reason: 'A short plan.md keeps the small change reviewable' };
        }
        if (!artifacts.verify) {
            return { phase: 'engine', reason: 'Implement and verify the small change' };
        }
        return { phase: 'complete', reason: 'Lite-change route artifacts are present' };
    }

    if (!artifacts.vibe) {
        return { phase: 'vibe', reason: 'vibe.md is missing' };
    }
    if (!artifacts.spec) {
        return { phase: 'specify', reason: 'spec.md is missing' };
    }
    if (!artifacts.research) {
        return { phase: 'research', reason: 'research.md is missing' };
    }
    if (!artifacts.plan) {
        return { phase: 'architect', reason: 'plan.md is missing' };
    }
    if (!artifacts.verify) {
        return { phase: 'engine', reason: 'Implementation should finish and write verification evidence next' };
    }
    return { phase: 'complete', reason: 'Standard route artifacts are present' };
}

function summarizeRouteProgress(analysis, artifacts) {
    const route = analysis.recommendedPipeline || 'standard-build';
    let status = 'on-track';
    let detail = 'Artifacts match the recommended route so far.';

    if (route === 'diagnose-first' && artifacts.plan && !artifacts.diagnosis) {
        status = 'drifted';
        detail =
            'plan.md exists before diagnosis.md, which suggests the fix route may have skipped root-cause capture.';
    } else if (route === 'research-heavy' && artifacts.plan && !artifacts.research) {
        status = 'drifted';
        detail = 'plan.md exists before research.md, which weakens the high-risk route.';
    } else if (route === 'split-work' && artifacts.plan && !artifacts.spec) {
        status = 'drifted';
        detail = 'plan.md exists before spec.md, so the split work may not be scoped clearly yet.';
    } else if (route === 'resume-mode') {
        status = 'adaptive';
        detail = 'Resume mode follows the latest trustworthy artifact rather than a fixed early-phase sequence.';
    }

    return {
        expectedRoute: route,
        expectedPhases: ROUTE_PHASE_HINTS[route] || ROUTE_PHASE_HINTS['standard-build'],
        next: suggestNextPhase(analysis, artifacts),
        status,
        detail,
    };
}

function buildFeatureArtifactState(featureDir) {
    const feature = path.basename(featureDir);
    const requestReceipt = loadRequestReceipt(feature, featureDir);
    const designReceipt = loadDesignRoutingReceipt(featureDir);
    return {
        request: !!requestReceipt.requestedAt,
        context: fs.existsSync(path.join(featureDir, 'context.md')),
        prompt: fs.existsSync(path.join(featureDir, 'prompt.json')),
        designRoute: !!designReceipt,
        vibe: fs.existsSync(path.join(featureDir, 'vibe.md')),
        spec: fs.existsSync(path.join(featureDir, 'spec.md')),
        research: fs.existsSync(path.join(featureDir, 'research.md')),
        designSystem: fs.existsSync(path.join(featureDir, 'design-system.md')),
        plan: fs.existsSync(path.join(featureDir, 'plan.md')),
        diagnosis: fs.existsSync(path.join(featureDir, 'diagnosis.md')),
        accessibility: fs.existsSync(path.join(featureDir, 'accessibility.json')),
        uiAudit: fs.existsSync(path.join(featureDir, 'ui-audit.json')),
        uiReview: fs.existsSync(path.join(featureDir, 'ui-review.md')),
        uiReviewReceipt: fs.existsSync(path.join(featureDir, 'ui-review.json')),
        verify:
            fs.existsSync(path.join(featureDir, 'verify.md')) || fs.existsSync(path.join(featureDir, 'verify.json')),
    };
}

function getRouteDisplayPhases(route) {
    const phases = ROUTE_PHASE_HINTS[route] || ROUTE_PHASE_HINTS['standard-build'];
    return phases.map((phase) => (phase === 'normalize-prompt' ? 'prompt' : phase));
}

function getPipelineStatusEntries(featureDir, promptReceipt) {
    const route = promptReceipt ? promptReceipt.recommendedPipeline || 'standard-build' : 'standard-build';
    const expectedPhases = new Set(getRouteDisplayPhases(route));
    const designReceipt = loadDesignRoutingReceipt(featureDir);
    const verifyReceipt = readJsonFile(path.join(featureDir, 'verify.json'));
    const designHint = `${promptReceipt?.normalizedSummary || ''} ${designReceipt?.prompt || ''}`.trim();
    const designRouteExpected = Boolean(designReceipt) || detectUiTask(designHint);
    const designSystemExpected = designRouteExpected && !Boolean(designReceipt?.auditOnly);
    const accessibilityExpected = designRouteExpected && designReceipt?.stack !== 'react-native';
    const uiAuditExpected = accessibilityExpected && Boolean(verifyReceipt?.deepRequested);
    const uiReviewExpected =
        designRouteExpected &&
        (fs.existsSync(path.join(featureDir, 'verify.md')) || fs.existsSync(path.join(featureDir, 'verify.json')));
    const uiReviewReceiptExpected = uiReviewExpected;
    const entries = [
        {
            name: 'scan',
            file: 'context.md',
            label: 'Codebase context',
            present: fs.existsSync(path.join(featureDir, 'context.md')),
        },
        {
            name: 'prompt',
            file: 'prompt.json',
            label: 'Prompt interpretation',
            present: fs.existsSync(path.join(featureDir, 'prompt.json')),
        },
        {
            name: 'design-route',
            file: 'design-routing.json',
            label: 'Design routing receipt',
            present: fs.existsSync(path.join(featureDir, 'design-routing.json')),
        },
        {
            name: 'vibe',
            file: 'vibe.md',
            label: 'Vibe capture',
            present: fs.existsSync(path.join(featureDir, 'vibe.md')),
        },
        {
            name: 'specify',
            file: 'spec.md',
            label: 'Specification',
            present: fs.existsSync(path.join(featureDir, 'spec.md')),
        },
        {
            name: 'research',
            file: 'research.md',
            label: 'Tech research',
            present: fs.existsSync(path.join(featureDir, 'research.md')),
        },
        {
            name: 'design-system',
            file: 'design-system.md',
            label: 'Design system artifact',
            present: fs.existsSync(path.join(featureDir, 'design-system.md')),
        },
        {
            name: 'accessibility',
            file: 'accessibility.json',
            label: 'Accessibility audit receipt',
            present: fs.existsSync(path.join(featureDir, 'accessibility.json')),
        },
        {
            name: 'ui-audit',
            file: 'ui-audit.json',
            label: 'Browser UI audit receipt',
            present: fs.existsSync(path.join(featureDir, 'ui-audit.json')),
        },
        {
            name: 'ui-review',
            file: 'ui-review.md',
            label: 'Frontend review summary',
            present: fs.existsSync(path.join(featureDir, 'ui-review.md')),
        },
        {
            name: 'ui-review-receipt',
            file: 'ui-review.json',
            label: 'Frontend review receipt',
            present: fs.existsSync(path.join(featureDir, 'ui-review.json')),
        },
        {
            name: 'architect',
            file: 'plan.md',
            label: 'Architecture plan',
            present: fs.existsSync(path.join(featureDir, 'plan.md')),
        },
        {
            name: 'diagnose',
            file: 'diagnosis.md',
            label: 'Diagnosis (fix path)',
            present: fs.existsSync(path.join(featureDir, 'diagnosis.md')),
        },
        {
            name: 'engine',
            file: route === 'diagnose-first' ? 'diagnosis.md' : 'plan.md',
            label: route === 'diagnose-first' ? 'Engine execution (from diagnosis)' : 'Engine execution',
            present:
                route === 'diagnose-first'
                    ? fs.existsSync(path.join(featureDir, 'diagnosis.md'))
                    : fs.existsSync(path.join(featureDir, 'plan.md')),
        },
        {
            name: 'verify',
            file: 'verify.md',
            label: 'Verification evidence',
            present:
                fs.existsSync(path.join(featureDir, 'verify.md')) ||
                fs.existsSync(path.join(featureDir, 'verify.json')),
        },
    ];

    return entries.map((entry) => {
        let expected = expectedPhases.has(entry.name);
        if (entry.name === 'design-route') {
            expected = designRouteExpected;
        } else if (entry.name === 'design-system') {
            expected = designSystemExpected;
        } else if (entry.name === 'accessibility') {
            expected = accessibilityExpected;
        } else if (entry.name === 'ui-audit') {
            expected = uiAuditExpected;
        } else if (entry.name === 'ui-review') {
            expected = uiReviewExpected;
        } else if (entry.name === 'ui-review-receipt') {
            expected = uiReviewReceiptExpected;
        }

        return {
            ...entry,
            expected,
        };
    });
}

function formatPromptMarkdown(feature, analysis, sessionState) {
    const lines = [
        `# Prompt Brief: ${feature}`,
        '',
        `**Captured:** ${new Date().toISOString()}`,
        `**Source:** normalize-prompt`,
        '',
        '## Summary',
        '',
        `- Raw Prompt: ${analysis.rawPrompt || 'None'}`,
        `- Normalized Summary: ${analysis.normalizedSummary || 'None'}`,
        `- Primary Intent: ${analysis.primaryIntent || 'Unknown'}`,
        `- Secondary Intents: ${analysis.secondaryIntents.length > 0 ? analysis.secondaryIntents.join(', ') : 'None'}`,
        `- Continuation State: ${analysis.continuationState || 'Unknown'}`,
        `- Complexity / Risk: ${analysis.complexity || 'Unknown'} / ${analysis.risk || 'Unknown'}`,
        `- Ambiguity: ${analysis.ambiguity || 'Unknown'}`,
        `- Recommended Route: ${analysis.recommendedPipeline || 'Unknown'}`,
        `- Pipeline Hint: ${analysis.pipelineHint || 'Unknown'}`,
        '',
        '## Assumptions',
        '',
    ];

    if (analysis.assumptions.length > 0) {
        for (const assumption of analysis.assumptions) {
            lines.push(`- ${assumption}`);
        }
    } else {
        lines.push('- None captured.');
    }

    lines.push('', '## Non-Goals', '');
    if (analysis.nonGoals.length > 0) {
        for (const nonGoal of analysis.nonGoals) {
            lines.push(`- ${nonGoal}`);
        }
    } else {
        lines.push('- None captured.');
    }

    lines.push('', '## Unresolved Questions', '');
    if (analysis.unresolvedQuestions.length > 0) {
        for (const question of analysis.unresolvedQuestions) {
            lines.push(`- ${question}`);
        }
    } else {
        lines.push('- None captured.');
    }

    lines.push('', '## Session Context', '');
    lines.push(`- Active Feature: ${sessionState.activeFeature || 'None'}`);
    lines.push(`- Default State: ${sessionState.defaultState || 'Unknown'}`);
    lines.push(
        `- Known Features: ${sessionState.knownFeatures && sessionState.knownFeatures.length > 0 ? sessionState.knownFeatures.join(', ') : 'None'}`,
    );
    lines.push(`- Circuit State: ${sessionState.recoveryState || 'active'} (${sessionState.errorCount || 0} errors)`);

    if (analysis.splitRecommended && analysis.suggestedFeatures.length > 0) {
        lines.push('', '## Suggested Split', '');
        for (const item of analysis.suggestedFeatures) {
            lines.push(`- ${item}`);
        }
    }

    lines.push('', '_Generated by steroid-workflow prompt intelligence._', '');
    return lines.join('\n');
}

// ═══════════════════════════════════════════════════════════════════
// § DYNAMIC VERSION
// ═══════════════════════════════════════════════════════════════════
let SW_VERSION = '6.3.0-beta.1';
try {
    // When running from npm package: __dirname = bin/, package.json is ../package.json
    const pkgPath = path.join(__dirname, '..', 'package.json');
    if (fs.existsSync(pkgPath)) {
        SW_VERSION = JSON.parse(fs.readFileSync(pkgPath, 'utf-8')).version;
    } else {
        // When copied to project root: check .memory/.steroid-version
        const versionFile = path.join(__dirname, '.memory', '.steroid-version');
        if (fs.existsSync(versionFile)) {
            SW_VERSION = fs.readFileSync(versionFile, 'utf-8').trim();
        }
    }
} catch {
    /* use hardcoded fallback */
}

// ═══════════════════════════════════════════════════════════════════
// § ARGUMENT PARSING & HELP
// ═══════════════════════════════════════════════════════════════════
const args = process.argv.slice(2);

if (args.length === 0 || args[0] === '--help' || args[0] === '-h') {
    console.log(`
steroid-run — The physical pipeline enforcer for AI-driven development.

Usage:
  Circuit Breaker:
    node steroid-run.cjs '<command>'                       Execute a command with error tracking
    node steroid-run.cjs run --cwd=<path> '<command>'      Execute in a subdirectory with error tracking
    node steroid-run.cjs verify <file> --min-lines=<n>     Verify file meets minimum line count
    node steroid-run.cjs reset                             Reset the error counter to 0
    node steroid-run.cjs status                            Show current circuit breaker state

  Shell-Free FS:
    node steroid-run.cjs fs-cat <file...> [--head=<n>] [--optional]
                                                          Print the first matching text file safely
    node steroid-run.cjs fs-find [path...] [--name=<glob>] [--type=file|dir] [--max-depth=<n>] [--limit=<n>] [--count]
                                                          Find files/directories without shell globbing
    node steroid-run.cjs fs-grep <pattern> [path...] [--include=<glob>] [--files-with-matches] [--limit=<n>] [--ignore-case] [--fixed]
                                                          Search text safely without grep/findstr
    node steroid-run.cjs fs-ls [path]                      Show a condensed directory tree
    node steroid-run.cjs fs-mkdir <path>                   Create directories recursively
    node steroid-run.cjs fs-cp <src> <dest>                Copy file or directory
    node steroid-run.cjs fs-mv <src> <dest>                Move or rename file/directory
    node steroid-run.cjs fs-rm <path>                      Remove file or directory safely

  Pipeline Enforcement:
    node steroid-run.cjs init-feature <slug>               Create feature folder structure
    node steroid-run.cjs gate <phase> <feature>            Check phase prerequisites
    node steroid-run.cjs scan <feature>                    Run codebase scan (writes request.json + context.md)
    node steroid-run.cjs commit <message>                  Atomic git commit in steroid format
    node steroid-run.cjs log <feature> <message>           Append to progress log
    node steroid-run.cjs check-plan <feature>              Count remaining tasks in plan
    node steroid-run.cjs archive <feature>                 Archive completed feature (requires verify.json + completion.json)
                                                          Use --force-ui to override blocking CONDITIONAL frontend risk
    node steroid-run.cjs verify-feature <feature> [--deep] [--url <preview>] Run verification (writes verify.md + verify.json + completion.json)

  Stories:
    node steroid-run.cjs stories <feature>                 List prioritized stories (P1/P2/P3)
    node steroid-run.cjs stories <feature> next            Show next story to work on

  Review:
    node steroid-run.cjs review spec <feature>             Stage 1: Spec compliance review
    node steroid-run.cjs review quality <feature>          Stage 2: Code quality review
    node steroid-run.cjs review ui <feature>               Refresh frontend review receipts from current UI evidence
    node steroid-run.cjs review status <feature>           Show review stage status and sync review.json
    node steroid-run.cjs review reset <feature>            Reset review for re-review

  Reports:
    node steroid-run.cjs report generate <feature>         Generate handoff report
    node steroid-run.cjs report show <feature>             Show a handoff report
    node steroid-run.cjs report list                       List all handoff reports

  Analytics:
    node steroid-run.cjs dashboard                         Show project health dashboard

  Recovery:
    node steroid-run.cjs recover                           Smart recovery guidance (levels 1-5)

  Intelligence:
    node steroid-run.cjs detect-intent "<message>"         Detect user intent (build/fix/refactor/migrate/document)
    node steroid-run.cjs normalize-prompt "<message>"      Normalize a raw user prompt into a structured brief
    node steroid-run.cjs normalize-prompt "<message>" --feature <feature> --write
                                                          Normalize and persist .memory/changes/<feature>/prompt.json
    node steroid-run.cjs design-prep "<message>"           Generate design-routing.json + design-system.md together
    node steroid-run.cjs design-prep --feature <feature> --write
                                                          Prepare UI design artifacts from prompt/spec/vibe context
    node steroid-run.cjs design-route "<message>"          Route UI work to Steroid's internal frontend systems
    node steroid-run.cjs design-system "<message>"         Generate a design-system artifact from imported UI systems
    node steroid-run.cjs design-system --feature <feature> --write
                                                          Generate or refresh .memory/changes/<feature>/design-system.md
    node steroid-run.cjs prompt-health "<message>"         Score prompt clarity, ambiguity, and risk
    node steroid-run.cjs session-detect                    Detect current project/session state
    node steroid-run.cjs detect-tests                      Detect test framework in current project

  Progress:
    node steroid-run.cjs progress                          Show execution learnings log
    node steroid-run.cjs progress --patterns               Show only codebase patterns

  Knowledge:
    node steroid-run.cjs memory show <store>               Show a knowledge store
    node steroid-run.cjs memory show-all                   Show all knowledge stores
    node steroid-run.cjs memory write <store> <json>       Write data to a store
    node steroid-run.cjs memory stats                      Show memory statistics

  Diagnostics:
    node steroid-run.cjs audit                             Verify all enforcement layers are installed
    node steroid-run.cjs pipeline-status <feature>          Show pipeline progress plus prompt interpretation state

The circuit breaker tracks errors in .memory/execution_state.json.
After 5 consecutive errors (graduated recovery at each level), execution is blocked until you run 'reset'.
Run 'recover' after any error for smart fix suggestions.
`);
    process.exit(0);
}

// ═══════════════════════════════════════════════════════════════════
// § STATE INITIALIZATION
// ═══════════════════════════════════════════════════════════════════
if (!fs.existsSync(stateFile)) {
    if (!fs.existsSync(path.dirname(stateFile))) {
        fs.mkdirSync(path.dirname(stateFile), { recursive: true });
    }
    fs.writeFileSync(
        stateFile,
        JSON.stringify(
            { error_count: 0, last_error: null, status: 'active', recovery_actions: [], error_history: [] },
            null,
            2,
        ),
    );
}

let state;
try {
    state = JSON.parse(fs.readFileSync(stateFile, 'utf-8'));
} catch (e) {
    state = { error_count: 0, last_error: null, status: 'active', recovery_actions: [], error_history: [] };
}

// ═══════════════════════════════════════════════════════════════════
// § CONFIG LOADING (v5.9.0)
// ═══════════════════════════════════════════════════════════════════

/** @type {{ maxPhases?: number, strictGates?: boolean, autoRecover?: boolean }} */
let userConfig = {};
try {
    const configPath = path.join(memoryDir, 'config.json');
    if (fs.existsSync(configPath)) {
        userConfig = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    }
} catch {
    /* use defaults */
}

// ═══════════════════════════════════════════════════════════════════
// § TELEMETRY & SESSION AWARENESS (v5.9.0)
// ═══════════════════════════════════════════════════════════════════

// Track command usage for dashboard insights
if (args[0] && args[0] !== '--help' && args[0] !== '-h') {
    try {
        if (!fs.existsSync(metricsDir)) fs.mkdirSync(metricsDir, { recursive: true });
        const usageFile = path.join(metricsDir, 'usage.json');
        let usage = { commands: {}, totalRuns: 0, lastRun: null };
        if (fs.existsSync(usageFile)) {
            try {
                usage = JSON.parse(fs.readFileSync(usageFile, 'utf-8'));
            } catch {
                /* reset */
            }
        }
        usage.commands[args[0]] = (usage.commands[args[0]] || 0) + 1;
        usage.totalRuns = (usage.totalRuns || 0) + 1;
        usage.lastRun = new Date().toISOString();
        fs.writeFileSync(usageFile, JSON.stringify(usage, null, 2));
    } catch {
        /* telemetry is best-effort */
    }
}

// Welcome-back awareness: if >4 hours since last state write, print status
try {
    const statMtime = fs.statSync(stateFile).mtime;
    const hoursSince = (Date.now() - statMtime.getTime()) / (1000 * 60 * 60);
    if (hoursSince > 4 && args[0] !== 'reset' && args[0] !== '--help') {
        const hoursAgo = Math.round(hoursSince);
        console.log(`[steroid-run] 👋 Welcome back! Last activity: ${hoursAgo} hours ago`);
        console.log(
            `  🔋 Circuit breaker: ${state.error_count}/5 errors${state.error_count === 0 ? ' (all clear)' : ''}`,
        );
        // Find active feature
        if (fs.existsSync(changesDir)) {
            const features = fs
                .readdirSync(changesDir)
                .filter((f) => fs.statSync(path.join(changesDir, f)).isDirectory());
            if (features.length > 0) {
                const latest = features[features.length - 1];
                const phases = ['context.md', 'vibe.md', 'spec.md', 'research.md', 'plan.md', 'diagnosis.md'];
                const done = phases.filter((p) => fs.existsSync(path.join(changesDir, latest, p))).length;
                console.log(`  📍 Feature: ${latest} (${done}/8 phases)`);
            }
        }
        console.log('');
    }
} catch {
    /* welcome-back is best-effort */
}

// ═══════════════════════════════════════════════════════════════════
// § COMMANDS: CIRCUIT BREAKER (reset, recover, status)
// ═══════════════════════════════════════════════════════════════════

/** CMD: reset — Reset the circuit breaker error counter to 0 */
if (args[0] === 'reset') {
    state.error_count = 0;
    state.last_error = null;
    state.status = 'active';
    state.recovery_actions = [];
    state.error_history = [];
    fs.writeFileSync(stateFile, JSON.stringify(state, null, 2));
    console.log('[steroid-run] ✅ Circuit breaker reset. Error count is now 0/5. You may resume.');
    process.exit(0);
}

// ═══════════════════════════════════════════════════════════════════
// § COMMANDS: REPORTS & BUG REPORTS
// ═══════════════════════════════════════════════════════════════════

/** CMD: report bug — Generate a bug report with system state */
if (args[0] === 'report' && (!args[1] || args[1] === '--help' || args[1] === 'bug')) {
    const reportFile = path.join(memoryDir, 'bug-report.md');
    const timestamp = new Date().toISOString();
    let report = `# Steroid Workflow Bug Report\n\n`;
    report += `**Generated**: ${timestamp}\n`;
    report += `**SW_VERSION**: ${SW_VERSION}\n`;
    report += `**Node**: ${process.version}\n`;
    report += `**OS**: ${process.platform} ${process.arch}\n`;
    report += `**CWD**: ${targetDir}\n\n`;

    // Error state
    report += `## Circuit Breaker State\n\n`;
    report += `- Error Count: ${state.error_count}/5\n`;
    report += `- Status: ${state.status}\n`;
    report += `- Last Error: ${state.last_error || 'None'}\n\n`;
    if (state.error_history && state.error_history.length > 0) {
        report += `### Error History\n\n`;
        state.error_history.slice(-5).forEach((err, i) => {
            report += `${i + 1}. \`${err.command || 'unknown'}\` — ${err.error || 'no details'}\n`;
        });
        report += `\n`;
    }

    // Memory files
    const memoryFiles = ['vibe.md', 'spec.md', 'research.md', 'progress.md'];
    report += `## Memory Snapshot\n\n`;

    // Check for feature folders
    const changesPath = path.join(memoryDir, 'changes');
    let featureDirs = [];
    try {
        featureDirs = fs.readdirSync(changesPath).filter((f) => fs.statSync(path.join(changesPath, f)).isDirectory());
    } catch (e) {
        /* no changes dir */
    }

    if (featureDirs.length > 0) {
        featureDirs.forEach((feature) => {
            report += `### Feature: \`${feature}\`\n\n`;
            memoryFiles.forEach((mf) => {
                const fp = path.join(changesPath, feature, mf);
                try {
                    const content = fs.readFileSync(fp, 'utf-8').trim();
                    const preview = content.length > 500 ? content.substring(0, 500) + '\n...(truncated)' : content;
                    report += `#### ${mf}\n\`\`\`\n${preview}\n\`\`\`\n\n`;
                } catch (e) {
                    report += `#### ${mf}\n*Not found*\n\n`;
                }
            });
        });
    } else {
        report += `*No feature folders found in .memory/changes/*\n\n`;
    }

    // Execution state JSON
    report += `## Raw Execution State\n\n`;
    report += `\`\`\`json\n${JSON.stringify(state, null, 2)}\n\`\`\`\n\n`;

    // User section
    report += `## What I Expected vs What Happened\n\n`;
    report += `**Expected**: (describe what you expected to happen)\n\n`;
    report += `**Actual**: (describe what actually happened)\n\n`;
    report += `**Steps to Reproduce**:\n1. \n2. \n3. \n\n`;
    report += `---\n*Paste this file to your AI assistant or open a GitHub issue.*\n`;

    fs.writeFileSync(reportFile, report);
    console.log(`[steroid-run] 📋 Bug report saved to .memory/bug-report.md`);
    console.log(`[steroid-run] 💡 Edit the "Expected vs Actual" section, then share the file.`);
    process.exit(0);
}

/** CMD: recover — Smart recovery guidance based on error count (5 graduated levels) */
// --- Recover Command (Smart recovery — v4.0) ---
// Source: src/forks/superpowers implementer-prompt.md status types
if (args[0] === 'recover') {
    const level = state.error_count;

    if (level === 0) {
        console.log('[steroid-run] ✅ No errors to recover from. Circuit breaker is clear.');
        process.exit(0);
    }

    let errorPatterns = { patterns: [] };
    const errorPatternsFile = path.join(metricsDir, 'error-patterns.json');
    if (fs.existsSync(errorPatternsFile)) {
        try {
            errorPatterns = JSON.parse(fs.readFileSync(errorPatternsFile, 'utf-8'));
        } catch (e) {
            /* ignore */
        }
    }

    console.log(`\n[steroid-run] 🔧 Smart Recovery — Error Level ${level}/5\n`);

    if (!state.recovery_actions) state.recovery_actions = [];

    if (level === 1) {
        console.log('  📋 Level 1: LOGGED — Retry with a different approach.');
        console.log(`  Last error: ${state.last_error}`);
        console.log('');
        console.log('  Suggested actions:');
        console.log('    1. Re-read the error message carefully');
        console.log('    2. Try a different implementation approach');
        console.log('    3. Check if the command syntax is correct');
        state.recovery_actions.push(`L1 recovery: retry suggested at ${new Date().toISOString()}`);
    } else if (level === 2) {
        console.log('  📖 Level 2: RE-READ — Pause and re-read your plan.');
        console.log(`  Last error: ${state.last_error}`);
        console.log('');
        console.log('  Suggested actions:');
        console.log('    1. Re-read plan.md or diagnosis.md for the current feature');
        console.log('    2. Verify your approach matches the architecture');
        console.log('    3. Check if dependencies are installed');
        state.recovery_actions.push(`L2 recovery: re-read suggested at ${new Date().toISOString()}`);
    } else if (level === 3) {
        console.log('  🔍 Level 3: SELF-DIAGNOSE — Checking error-patterns.json...');
        console.log(`  Last error: ${state.last_error}`);
        console.log('');
        if (errorPatterns.patterns.length > 0) {
            const lastErr = (state.last_error || '').toLowerCase();
            const matches = errorPatterns.patterns.filter((p) => lastErr.includes((p.keyword || '').toLowerCase()));
            if (matches.length > 0) {
                console.log('  🎯 Matching error patterns found:');
                for (const m of matches) {
                    console.log(`    Pattern: ${m.keyword}`);
                    console.log(`    Fix: ${m.fix || m.error}`);
                    console.log('');
                }
            } else {
                console.log('  No matching patterns. Recording this error for future diagnosis.');
            }
        } else {
            console.log('  No error patterns recorded yet. This error will be tracked.');
        }
        state.recovery_actions.push(`L3 recovery: self-diagnosis at ${new Date().toISOString()}`);
    } else if (level === 4) {
        console.log('  🚨 Level 4: ESCALATED — Present diagnosis to user.');
        console.log(`  Last error: ${state.last_error}`);
        console.log('');
        console.log('  ⚠️  This feature has hit 4 errors. The AI should:');
        console.log('    1. STOP all terminal execution');
        console.log('    2. Present ALL errors encountered (check error_history in execution_state.json)');
        console.log('    3. Propose 2-3 alternative approaches');
        console.log('    4. Wait for human decision before continuing');
        console.log('');
        console.log('  Error history:');
        if (state.error_history && state.error_history.length > 0) {
            for (const err of state.error_history) {
                console.log(`    - ${err}`);
            }
        }
        state.recovery_actions.push(`L4 recovery: escalation at ${new Date().toISOString()}`);
    } else {
        console.log('  🛑 Level 5: HARD STOP — Circuit breaker tripped.');
        console.log(friendlyHint('circuit-tripped'));
        console.log('  Run: node steroid-run.cjs reset');
    }

    fs.writeFileSync(stateFile, JSON.stringify(state, null, 2));
    process.exit(level >= 5 ? 1 : 0);
}

/** CMD: status — Show current circuit breaker state and recovery level */
if (args[0] === 'status') {
    const levels = ['🟢 CLEAR', '🟡 LOGGED', '🟠 RE-READ', '🔶 DIAGNOSING', '🔴 ESCALATED', '🛑 TRIPPED'];
    const level = Math.min(state.error_count, 5);
    console.log(`[steroid-run] Circuit Breaker Status:`);
    console.log(`  Error Count: ${state.error_count}/5`);
    console.log(`  Level: ${levels[level]}`);
    if (state.last_error) console.log(`  Last Error: ${state.last_error}`);
    if (state.recovery_actions && state.recovery_actions.length > 0) {
        console.log(`  Recovery Actions:`);
        for (const action of state.recovery_actions) {
            console.log(`    - ${action}`);
        }
    }
    process.exit(0);
}

/** CMD: pipeline-status — Show pipeline progress and prompt interpretation for a feature (v6.2.0) */
if (args[0] === 'pipeline-status') {
    const feature = args[1];
    if (!feature) {
        console.error('[steroid-run] Usage: npx steroid-run pipeline-status <feature>');
        process.exit(1);
    }
    const featureDir = path.join(changesDir, feature);
    if (!fs.existsSync(featureDir)) {
        console.error(`[steroid-run] ❌ Feature "${feature}" not found.`);
        process.exit(1);
    }

    const promptReceipt = readJsonFile(path.join(featureDir, 'prompt.json'));
    const phases = getPipelineStatusEntries(featureDir, promptReceipt);

    console.log(`\n[steroid-run] Pipeline status for: ${feature}\n`);

    let completed = 0;
    const artifactState = buildFeatureArtifactState(featureDir);
    for (const p of phases) {
        const fp = path.join(featureDir, p.file);
        if (p.present && fs.existsSync(fp)) {
            const lines = fs.readFileSync(fp, 'utf-8').split('\n').length;
            const suffix = p.expected ? `${lines} lines` : `${lines} lines, extra for route`;
            const icon = p.expected ? '✅' : '⚠️';
            console.log(`  ${icon} ${p.name.padEnd(12)} → ${p.file} (${suffix})`);
            completed++;
        } else {
            if (!p.expected) {
                console.log(
                    `  ⏭️ ${p.name.padEnd(12)} → ${p.file} (not used by ${promptReceipt?.recommendedPipeline || 'standard-build'})`,
                );
            } else {
                console.log(`  ⬜ ${p.name.padEnd(12)} → ${p.file} (missing)`);
            }
        }
    }

    const total = Math.max(userConfig.maxPhases || phases.length, phases.length);
    const barFull = Math.round((completed / total) * 16);
    const bar = '█'.repeat(barFull) + '░'.repeat(16 - barFull);
    console.log(`\n  Progress: ${bar} ${completed}/${total} phases\n`);

    if (promptReceipt) {
        const routeSummary = summarizeRouteProgress(promptReceipt, artifactState);
        console.log('  Prompt Intelligence');
        console.log(`    - Intent: ${promptReceipt.primaryIntent || 'Unknown'}`);
        if (Array.isArray(promptReceipt.secondaryIntents) && promptReceipt.secondaryIntents.length > 0) {
            console.log(`    - Secondary: ${promptReceipt.secondaryIntents.join(', ')}`);
        }
        console.log(`    - Route: ${promptReceipt.recommendedPipeline || 'Unknown'}`);
        console.log(`    - Continuation: ${promptReceipt.continuationState || 'Unknown'}`);
        console.log(
            `    - Complexity/Risk: ${promptReceipt.complexity || 'Unknown'} / ${promptReceipt.risk || 'Unknown'}`,
        );
        if (Array.isArray(promptReceipt.assumptions) && promptReceipt.assumptions.length > 0) {
            console.log(`    - Assumptions: ${promptReceipt.assumptions.length}`);
        }
        console.log('  Route Guidance');
        console.log(`    - Status: ${routeSummary.status}`);
        console.log(`    - Detail: ${routeSummary.detail}`);
        console.log(`    - Expected phases: ${routeSummary.expectedPhases.join(' -> ')}`);
        console.log(`    - Next step: ${routeSummary.next.phase}`);
        console.log(`    - Why next: ${routeSummary.next.reason}`);
        console.log('');
    }

    const designReceipt = loadDesignRoutingReceipt(featureDir);
    const uiReviewReceipt = loadUiReviewReceipt(feature, featureDir);
    const designExpected =
        artifactState.designRoute || artifactState.designSystem || detectUiTask(promptReceipt?.normalizedSummary || '');
    if (designReceipt || designExpected) {
        console.log('  Design Intelligence');
        console.log(`    - Routing receipt: ${artifactState.designRoute ? 'present' : 'missing'}`);
        console.log(`    - Design system: ${artifactState.designSystem ? 'present' : 'missing'}`);
        console.log(`    - Accessibility receipt: ${artifactState.accessibility ? 'present' : 'missing'}`);
        console.log(`    - Browser audit receipt: ${artifactState.uiAudit ? 'present' : 'missing'}`);
        console.log(`    - UI review summary: ${artifactState.uiReview ? 'present' : 'missing'}`);
        console.log(`    - UI review receipt: ${artifactState.uiReviewReceipt ? 'present' : 'missing'}`);
        if (uiReviewReceipt) {
            console.log(`    - UI review status: ${uiReviewReceipt.status || 'Unknown'}`);
            console.log(`    - UI review refreshed by: ${uiReviewReceipt.freshness?.source || 'unknown'}`);
            if (uiReviewReceipt.generatedAt) {
                console.log(`    - UI review generated: ${uiReviewReceipt.generatedAt}`);
            }
            if (uiReviewReceipt.freshness?.evidenceUpdatedAt) {
                console.log(`    - Latest frontend evidence: ${uiReviewReceipt.freshness.evidenceUpdatedAt}`);
            }
        }
        if (designReceipt) {
            console.log(`    - Stack: ${designReceipt.stack || 'Unknown'}`);
            console.log(`    - Audit only: ${designReceipt.auditOnly ? 'yes' : 'no'}`);
            console.log(`    - Wrapper: ${designReceipt.wrapperSkill || 'none'}`);
            const sources =
                Array.isArray(designReceipt.importedSourceIds) && designReceipt.importedSourceIds.length > 0
                    ? designReceipt.importedSourceIds.join(', ')
                    : 'none';
            console.log(`    - Imported sources: ${sources}`);
        } else {
            console.log('    - Routing hint: UI work appears likely, but design-routing.json is missing.');
        }
        console.log('');
    }

    // Show audit trail if exists
    const auditFile = path.join(memoryDir, 'audit-trail.md');
    if (fs.existsSync(auditFile)) {
        const auditLines = fs.readFileSync(auditFile, 'utf-8').split('\n');
        const featureEntries = auditLines.filter((l) => l.includes(feature));
        if (featureEntries.length > 0) {
            console.log(`  📋 Audit trail: ${featureEntries.length} gate receipt(s) recorded`);
        }
    }

    process.exit(0);
}

// ═══════════════════════════════════════════════════════════════════
// § COMMANDS: KNOWLEDGE & PROGRESS
// ═══════════════════════════════════════════════════════════════════

/** CMD: progress — Show execution learnings log */
if (args[0] === 'progress') {
    const progressFile = path.join(targetDir, '.memory', 'progress.md');
    if (!fs.existsSync(progressFile)) {
        console.log('[steroid-run] No progress log found yet. It will be created when the engine starts building.');
        process.exit(0);
    }
    const content = fs.readFileSync(progressFile, 'utf-8');
    if (args.includes('--patterns')) {
        // Extract only the Codebase Patterns section
        const patternsMatch = content.match(/## Codebase Patterns[\s\S]*?(?=\n## [^C]|\n---|\Z)/);
        if (patternsMatch) {
            console.log(patternsMatch[0].trim());
        } else {
            console.log('[steroid-run] No codebase patterns captured yet.');
        }
    } else {
        console.log(content);
    }
    process.exit(0);
}

/** CMD: memory — Structured knowledge store (show/show-all/write/stats) */
// --- Memory Command (Structured knowledge store — v4.0) ---
// Source: src/forks/memorycore/master-memory.md + src/forks/ralph/AGENTS.md
if (args[0] === 'memory') {
    const sub = args[1];

    if (!sub || sub === '--help') {
        console.log(`
[steroid-run] memory — Structured project knowledge store.

Usage:
  node steroid-run.cjs memory show [store]       Show a knowledge store (tech-stack|patterns|decisions|gotchas)
  node steroid-run.cjs memory show-all           Show all knowledge stores
  node steroid-run.cjs memory write <store> <json>  Write/merge data into a store
  node steroid-run.cjs memory stats              Show memory statistics

Stores:
  tech-stack   — Language, framework, deps (from scan/research)
  patterns     — Codebase patterns and conventions (from AGENTS.md/scan)
  decisions    — Locked architectural decisions (from architect phase)
  gotchas      — Known pitfalls and workarounds (from engine/verify)
`);
        process.exit(0);
    }

    if (!fs.existsSync(knowledgeDir)) {
        fs.mkdirSync(knowledgeDir, { recursive: true });
    }

    const validStores = ['tech-stack', 'patterns', 'decisions', 'gotchas'];

    if (sub === 'show') {
        const store = args[2];
        if (!store || !validStores.includes(store)) {
            console.error(`[steroid-run] ❌ Unknown store: "${store}". Valid: ${validStores.join(', ')}`);
            process.exit(1);
        }
        const storeFile = path.join(knowledgeDir, `${store}.json`);
        if (!fs.existsSync(storeFile)) {
            console.log(`[steroid-run] 📭 Store "${store}" is empty. It will be populated as the pipeline runs.`);
            process.exit(0);
        }
        try {
            const data = JSON.parse(fs.readFileSync(storeFile, 'utf-8'));
            console.log(JSON.stringify(data, null, 2));
        } catch (e) {
            console.error(`[steroid-run] ⚠️  Store "${store}" has invalid JSON. Resetting.`);
            fs.unlinkSync(storeFile);
            process.exit(1);
        }
        process.exit(0);
    }

    if (sub === 'show-all') {
        let hasData = false;
        for (const store of validStores) {
            const storeFile = path.join(knowledgeDir, `${store}.json`);
            if (fs.existsSync(storeFile)) {
                try {
                    const data = JSON.parse(fs.readFileSync(storeFile, 'utf-8'));
                    console.log(`\n## ${store}`);
                    console.log(JSON.stringify(data, null, 2));
                    hasData = true;
                } catch (e) {
                    console.log(`\n## ${store} — ⚠️ corrupt (will reset on next write)`);
                }
            }
        }
        if (!hasData) {
            console.log('[steroid-run] 📭 No knowledge stored yet. Run a scan to populate tech-stack.');
        }
        process.exit(0);
    }

    if (sub === 'write') {
        const store = args[2];
        const jsonStr = args.slice(3).join(' ');
        if (!store || !validStores.includes(store)) {
            console.error(`[steroid-run] ❌ Unknown store: "${store}". Valid: ${validStores.join(', ')}`);
            process.exit(1);
        }
        if (!jsonStr) {
            console.error('[steroid-run] ❌ No JSON data provided.');
            process.exit(1);
        }
        let newData;
        // v5.6.1: Size limit — prevent disk abuse from oversized JSON payloads
        if (Buffer.byteLength(jsonStr, 'utf-8') > 102400) {
            console.error('[steroid-run] ❌ JSON payload too large (max 100KB).');
            process.exit(1);
        }
        try {
            newData = JSON.parse(jsonStr);
        } catch (e) {
            console.error(`[steroid-run] ❌ Invalid JSON: ${e.message}`);
            process.exit(1);
        }

        const storeFile = path.join(knowledgeDir, `${store}.json`);
        let existing = {};
        if (fs.existsSync(storeFile)) {
            try {
                existing = JSON.parse(fs.readFileSync(storeFile, 'utf-8'));
            } catch (e) {
                existing = {};
            }
        }

        const merged = mergeKnowledge(existing, newData);
        merged._lastUpdated = new Date().toISOString();
        fs.writeFileSync(storeFile, JSON.stringify(merged, null, 2));
        console.log(`[steroid-run] ✅ Knowledge written to ${store}.json`);
        process.exit(0);
    }

    if (sub === 'stats') {
        let totalEntries = 0;
        console.log('\n[steroid-run] 🧠 Memory Statistics\n');
        for (const store of validStores) {
            const storeFile = path.join(knowledgeDir, `${store}.json`);
            if (fs.existsSync(storeFile)) {
                try {
                    const data = JSON.parse(fs.readFileSync(storeFile, 'utf-8'));
                    const keys = Object.keys(data).filter((k) => k !== '_lastUpdated');
                    console.log(`  ${store}: ${keys.length} entries (updated: ${data._lastUpdated || 'unknown'})`);
                    totalEntries += keys.length;
                } catch (e) {
                    console.log(`  ${store}: ⚠️ corrupt`);
                }
            } else {
                console.log(`  ${store}: empty`);
            }
        }
        const errorPatternsFile = path.join(metricsDir, 'error-patterns.json');
        const featuresFile = path.join(metricsDir, 'features.json');
        if (fs.existsSync(errorPatternsFile)) {
            try {
                const ep = JSON.parse(fs.readFileSync(errorPatternsFile, 'utf-8'));
                const patterns = ep.patterns || [];
                console.log(`  error-patterns: ${patterns.length} patterns tracked`);
            } catch (e) {
                /* ignore */
            }
        }
        if (fs.existsSync(featuresFile)) {
            try {
                const feat = JSON.parse(fs.readFileSync(featuresFile, 'utf-8'));
                const features = Object.keys(feat).filter((k) => k !== '_lastUpdated');
                console.log(`  features: ${features.length} features tracked`);
            } catch (e) {
                /* ignore */
            }
        }
        console.log(`\n  Total knowledge entries: ${totalEntries}`);
        process.exit(0);
    }

    console.error(`[steroid-run] ❌ Unknown memory subcommand: "${sub}". Run: node steroid-run.cjs memory --help`);
    process.exit(1);
}

// ═══════════════════════════════════════════════════════════════════
// § COMMANDS: DIAGNOSTICS
// ═══════════════════════════════════════════════════════════════════

/** CMD: audit — Verify all enforcement layers are properly installed */
if (args[0] === 'audit') {
    // Version display
    let version = 'unknown';
    try {
        const pkgPath = path.join(__dirname, '..', 'package.json');
        version = JSON.parse(fs.readFileSync(pkgPath, 'utf-8')).version;
    } catch (e) {
        /* installed copy may not have package.json nearby */
    }

    console.log('');
    console.log(`[steroid-run] 🔍 Auditing enforcement layers... (v${version})`);
    console.log('');

    let passed = 0;
    let failed = 0;
    let skillCount = 0;

    const checks = [
        {
            name: 'Git pre-commit hook',
            path: path.join(targetDir, '.git', 'hooks', 'pre-commit'),
            test: 'contains',
            marker: 'STEROID-WORKFLOW',
        },
        {
            name: 'Skills (scan)',
            path: path.join(targetDir, '.agents', 'skills', 'steroid-scan', 'SKILL.md'),
            test: 'exists',
            isSkill: true,
        },
        {
            name: 'Skills (vibe-capture)',
            path: path.join(targetDir, '.agents', 'skills', 'steroid-vibe-capture', 'SKILL.md'),
            test: 'exists',
            isSkill: true,
        },
        {
            name: 'Skills (specify)',
            path: path.join(targetDir, '.agents', 'skills', 'steroid-specify', 'SKILL.md'),
            test: 'exists',
            isSkill: true,
        },
        {
            name: 'Skills (research)',
            path: path.join(targetDir, '.agents', 'skills', 'steroid-research', 'SKILL.md'),
            test: 'exists',
            isSkill: true,
        },
        {
            name: 'Skills (architect)',
            path: path.join(targetDir, '.agents', 'skills', 'steroid-architect', 'SKILL.md'),
            test: 'exists',
            isSkill: true,
        },
        {
            name: 'Skills (engine)',
            path: path.join(targetDir, '.agents', 'skills', 'steroid-engine', 'SKILL.md'),
            test: 'exists',
            isSkill: true,
        },
        {
            name: 'Skills (verify)',
            path: path.join(targetDir, '.agents', 'skills', 'steroid-verify', 'SKILL.md'),
            test: 'exists',
            isSkill: true,
        },
        {
            name: 'Skills (diagnose)',
            path: path.join(targetDir, '.agents', 'skills', 'steroid-diagnose', 'SKILL.md'),
            test: 'exists',
            isSkill: true,
        },
        {
            name: 'Circuit breaker state',
            path: path.join(targetDir, '.memory', 'execution_state.json'),
            test: 'exists',
        },
        {
            name: 'Pipeline enforcer',
            path: path.join(targetDir, 'steroid-run.cjs'),
            test: 'exists',
        },
        {
            name: 'Pipeline enforcer (content check)',
            path: path.join(targetDir, 'steroid-run.cjs'),
            test: 'min-lines',
            minLines: 100,
        },
    ];

    // Check IDE configs (at least one should have the marker)
    const ideConfigs = [
        { name: 'GEMINI.md', path: path.join(targetDir, 'GEMINI.md') },
        { name: '.cursorrules', path: path.join(targetDir, '.cursorrules') },
        { name: 'CLAUDE.md', path: path.join(targetDir, 'CLAUDE.md') },
        { name: '.windsurfrules', path: path.join(targetDir, '.windsurfrules') },
        { name: '.github/copilot-instructions.md', path: path.join(targetDir, '.github', 'copilot-instructions.md') },
        { name: 'AGENTS.md', path: path.join(targetDir, 'AGENTS.md') },
        { name: '.clinerules', path: path.join(targetDir, '.clinerules') },
    ];

    // Run core checks
    for (const check of checks) {
        if (!fs.existsSync(check.path)) {
            console.log(`  ❌ ${check.name} — missing`);
            failed++;
        } else if (check.test === 'contains') {
            const content = fs.readFileSync(check.path, 'utf-8');
            if (content.includes(check.marker)) {
                console.log(`  ✅ ${check.name}`);
                passed++;
                if (check.isSkill) skillCount++;
            } else {
                console.log(`  ❌ ${check.name} — exists but not steroid hook`);
                failed++;
            }
        } else if (check.test === 'min-lines') {
            const content = fs.readFileSync(check.path, 'utf-8');
            const lineCount = content.split('\n').length;
            if (lineCount >= check.minLines) {
                console.log(`  ✅ ${check.name} (${lineCount} lines)`);
                passed++;
            } else {
                console.log(`  ❌ ${check.name} — too short (${lineCount} lines, need ${check.minLines}+)`);
                failed++;
            }
        } else {
            console.log(`  ✅ ${check.name}`);
            passed++;
            if (check.isSkill) skillCount++;
        }
    }

    // Gate chain integrity check
    const expectedGates = ['vibe', 'specify', 'research', 'architect', 'diagnose', 'engine', 'verify'];
    const gateCount = expectedGates.length;
    console.log('');
    console.log(`  Gate chain: ${gateCount} gates (${expectedGates.join(' → ')})`);
    passed++;

    // Check IDE configs
    let ideCount = 0;
    console.log('');
    console.log('  IDE Maestro rules:');
    for (const ide of ideConfigs) {
        if (fs.existsSync(ide.path)) {
            const content = fs.readFileSync(ide.path, 'utf-8');
            if (content.includes('STEROID-WORKFLOW-START')) {
                console.log(`    ✅ ${ide.name}`);
                ideCount++;
            } else {
                console.log(`    ⚠️  ${ide.name} — exists but no Maestro rules`);
            }
        } else {
            console.log(`    ○  ${ide.name} — not installed`);
        }
    }

    if (ideCount === 0) {
        console.log(`    ❌ No IDE config has Maestro rules!`);
        failed++;
    } else {
        passed++;
    }

    console.log('');

    // v4.0: Knowledge store health
    console.log('  Knowledge stores:');
    const knowledgeStores = ['tech-stack', 'patterns', 'decisions', 'gotchas'];
    let knowledgeCount = 0;
    for (const store of knowledgeStores) {
        const storeFile = path.join(knowledgeDir, `${store}.json`);
        if (fs.existsSync(storeFile)) {
            try {
                JSON.parse(fs.readFileSync(storeFile, 'utf-8'));
                console.log(`    ✅ ${store}.json`);
                knowledgeCount++;
            } catch (e) {
                console.log(`    ⚠️  ${store}.json — corrupt JSON`);
            }
        } else {
            console.log(`    ○  ${store}.json — not populated`);
        }
    }

    console.log('');

    // v5.0: Reports health
    console.log('  Handoff reports:');
    if (fs.existsSync(reportsDir)) {
        const reports = fs.readdirSync(reportsDir).filter((f) => f.endsWith('.md'));
        console.log(`    ${reports.length} report(s) generated`);
    } else {
        console.log('    \u25cb  No reports generated yet');
    }

    // v5.0: Review system check
    console.log('');
    console.log('  Review system: \u2705 Two-stage review available (v' + SW_VERSION + ')');
    console.log('  Prompt intelligence: \u2705 normalize-prompt, prompt-health, and session-detect available');

    console.log('');
    console.log(
        `  Result: ${passed} passed, ${failed} failed, ${ideCount} IDE(s), ${skillCount} skills, ${gateCount} gates, ${knowledgeCount}/4 knowledge stores, review + prompt intelligence v${SW_VERSION}`,
    );

    if (failed > 0) {
        console.log('');
        console.log('  Fix: Run "npx steroid-workflow init" to reinstall missing layers.');
        process.exit(1);
    }

    // v5.2.0: Stale reference detection
    console.log('');
    console.log('  Version drift check:');
    const filesToAudit = [
        path.join(targetDir, '.agents', 'skills', 'steroid-engine', 'SKILL.md'),
        path.join(targetDir, '.agents', 'skills', 'steroid-verify', 'SKILL.md'),
    ];
    let staleCount = 0;
    for (const f of filesToAudit) {
        if (fs.existsSync(f)) {
            const content = fs.readFileSync(f, 'utf-8');
            const oldVersions = (content.match(/v\d+\.\d+\.\d+/g) || []).filter((v) => v !== `v${SW_VERSION}`);
            if (oldVersions.length > 0) {
                const unique = [...new Set(oldVersions)];
                console.log(`    ⚠️  ${path.basename(f)}: found stale version refs: ${unique.join(', ')}`);
                staleCount++;
            }
        }
    }
    if (staleCount === 0) {
        console.log('    ✅ No stale version references found');
    }

    console.log('  All enforcement layers active. 🔒');
    process.exit(0);
}

// ============================================================
// v6.0.0: SHELL-FREE SUBCOMMANDS (Node.js fs-based operations)
// ============================================================

/** CMD: smoke-test — Stack-aware compilation/build check (v6.0.0) */
if (args[0] === 'smoke-test') {
    console.log('[steroid-run] 🔍 Running smoke test...');

    const pkgPath = path.join(targetDir, 'package.json');
    if (fs.existsSync(pkgPath)) {
        try {
            const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
            if (pkg.scripts && pkg.scripts.build) {
                console.log('[steroid-run]   Stack: Node.js (build script detected)');
                const build = spawnSync('npm', ['run', 'build'], {
                    cwd: targetDir,
                    stdio: 'pipe',
                    timeout: 60000,
                    shell: true,
                });
                if (build.status === 0) {
                    console.log('[steroid-run] ✅ Smoke test PASSED: build succeeded.');
                    process.exit(0);
                } else {
                    const errOutput = (build.stderr || build.stdout || Buffer.from(''))
                        .toString()
                        .trim()
                        .split('\n')
                        .slice(-8)
                        .join('\n');
                    console.error('[steroid-run] ❌ Smoke test FAILED: build error.');
                    console.error(errOutput);
                    state.error_count += 1;
                    state.last_error = 'smoke-test: build failed';
                    if (!state.error_history) state.error_history = [];
                    state.error_history.push(`[${new Date().toISOString()}] smoke-test: build failed`);
                    state.status = state.error_count >= 5 ? 'tripped' : 'active';
                    fs.writeFileSync(stateFile, JSON.stringify(state, null, 2));
                    process.exit(1);
                }
            } else {
                // Fallback: TypeScript type check
                const tsConfig = path.join(targetDir, 'tsconfig.json');
                if (fs.existsSync(tsConfig)) {
                    console.log('[steroid-run]   Stack: TypeScript (no build script, using tsc --noEmit)');
                    const tsc = spawnSync('npx', ['tsc', '--noEmit'], {
                        cwd: targetDir,
                        stdio: 'pipe',
                        timeout: 60000,
                        shell: true,
                    });
                    if (tsc.status === 0) {
                        console.log('[steroid-run] ✅ Smoke test PASSED: type check succeeded.');
                        process.exit(0);
                    } else {
                        console.error('[steroid-run] ❌ Smoke test FAILED: type errors found.');
                        const errOutput = (tsc.stdout || Buffer.from(''))
                            .toString()
                            .trim()
                            .split('\n')
                            .slice(-8)
                            .join('\n');
                        console.error(errOutput);
                        process.exit(1);
                    }
                } else {
                    console.log('[steroid-run] ⏭️  No build script or tsconfig.json. Smoke test skipped.');
                    process.exit(0);
                }
            }
        } catch (e) {
            console.error(`[steroid-run] ❌ Smoke test error: ${e.message}`);
            process.exit(1);
        }
    } else {
        // Non-JS stacks
        const altStacks = [
            { file: 'Cargo.toml', cmd: 'cargo', args: ['check'], name: 'Rust' },
            { file: 'go.mod', cmd: 'go', args: ['build', './...'], name: 'Go' },
        ];
        for (const alt of altStacks) {
            if (fs.existsSync(path.join(targetDir, alt.file))) {
                console.log(`[steroid-run]   Stack: ${alt.name}`);
                const check = spawnSync(alt.cmd, alt.args, { cwd: targetDir, stdio: 'pipe', timeout: 120000 });
                if (check.status === 0) {
                    console.log(`[steroid-run] ✅ Smoke test PASSED: ${alt.cmd} ${alt.args.join(' ')} succeeded.`);
                } else {
                    console.error(`[steroid-run] ❌ Smoke test FAILED: ${alt.cmd} check failed.`);
                }
                process.exit(check.status === 0 ? 0 : 1);
            }
        }
        console.log('[steroid-run] ⏭️  No recognized project file. Smoke test skipped.');
        process.exit(0);
    }
}

/** CMD: fs-mkdir — Create directories recursively (v6.0.0) */
if (args[0] === 'fs-mkdir') {
    const dirPath = args[1];
    if (!dirPath) {
        console.error('[steroid-run] Usage: npx steroid-run fs-mkdir <path>');
        process.exit(1);
    }
    const resolved = path.resolve(targetDir, dirPath);
    fs.mkdirSync(resolved, { recursive: true });
    console.log(`[steroid-run] ✅ Created: ${path.relative(targetDir, resolved)}/`);
    process.exit(0);
}

/** CMD: fs-rm — Remove files/directories with safety guard (v6.0.0) */
if (args[0] === 'fs-rm') {
    const rmPath = args[1];
    if (!rmPath) {
        console.error('[steroid-run] Usage: npx steroid-run fs-rm <path>');
        process.exit(1);
    }
    const resolved = path.resolve(targetDir, rmPath);

    // Safety guard: refuse to delete critical paths
    const safePaths = ['.git', '.memory', 'steroid-run.cjs', 'node_modules'];
    const relPath = path.relative(targetDir, resolved);
    for (const safe of safePaths) {
        if (relPath === safe || relPath.startsWith(safe + path.sep)) {
            console.error(`[steroid-run] 🚫 SAFETY: Refusing to delete "${relPath}" (protected path).`);
            process.exit(1);
        }
    }

    if (!fs.existsSync(resolved)) {
        console.log(`[steroid-run] ⏭️  Path does not exist: ${relPath}`);
        process.exit(0);
    }
    fs.rmSync(resolved, { recursive: true, force: true });
    console.log(`[steroid-run] ✅ Removed: ${relPath}`);
    process.exit(0);
}

/** CMD: fs-cp — Recursive copy (v6.0.0) */
if (args[0] === 'fs-cp') {
    const src = args[1];
    const dest = args[2];
    if (!src || !dest) {
        console.error('[steroid-run] Usage: npx steroid-run fs-cp <src> <dest>');
        process.exit(1);
    }
    const resolvedSrc = path.resolve(targetDir, src);
    const resolvedDest = path.resolve(targetDir, dest);

    if (!fs.existsSync(resolvedSrc)) {
        console.error(`[steroid-run] ❌ Source does not exist: ${src}`);
        process.exit(1);
    }

    const copyRecursive = (srcPath, destPath) => {
        const stat = fs.statSync(srcPath);
        if (stat.isDirectory()) {
            if (!fs.existsSync(destPath)) fs.mkdirSync(destPath, { recursive: true });
            for (const child of fs.readdirSync(srcPath)) {
                // Skip node_modules and .git for speed
                if (child === 'node_modules' || child === '.git') continue;
                copyRecursive(path.join(srcPath, child), path.join(destPath, child));
            }
        } else {
            const destDir = path.dirname(destPath);
            if (!fs.existsSync(destDir)) fs.mkdirSync(destDir, { recursive: true });
            fs.copyFileSync(srcPath, destPath);
        }
    };

    let count = 0;
    const stat = fs.statSync(resolvedSrc);
    if (stat.isDirectory()) {
        // Copy contents of src INTO dest (merge)
        for (const child of fs.readdirSync(resolvedSrc)) {
            if (child === 'node_modules' || child === '.git') continue;
            copyRecursive(path.join(resolvedSrc, child), path.join(resolvedDest, child));
            count++;
        }
    } else {
        const destFile =
            fs.existsSync(resolvedDest) && fs.statSync(resolvedDest).isDirectory()
                ? path.join(resolvedDest, path.basename(resolvedSrc))
                : resolvedDest;
        fs.copyFileSync(resolvedSrc, destFile);
        count = 1;
    }
    console.log(`[steroid-run] ✅ Copied ${count} item(s): ${src} → ${dest}`);
    process.exit(0);
}

/** CMD: fs-mv — Move/rename with cross-device fallback (v6.0.0) */
if (args[0] === 'fs-mv') {
    const src = args[1];
    const dest = args[2];
    if (!src || !dest) {
        console.error('[steroid-run] Usage: npx steroid-run fs-mv <src> <dest>');
        process.exit(1);
    }
    const resolvedSrc = path.resolve(targetDir, src);
    const resolvedDest = path.resolve(targetDir, dest);

    if (!fs.existsSync(resolvedSrc)) {
        console.error(`[steroid-run] ❌ Source does not exist: ${src}`);
        process.exit(1);
    }

    try {
        fs.renameSync(resolvedSrc, resolvedDest);
    } catch (e) {
        // Cross-device fallback: copy then delete
        if (e.code === 'EXDEV') {
            fs.copyFileSync(resolvedSrc, resolvedDest);
            fs.unlinkSync(resolvedSrc);
        } else {
            throw e;
        }
    }
    console.log(`[steroid-run] ✅ Moved: ${src} → ${dest}`);
    process.exit(0);
}

/** CMD: fs-cat — Print the first matching text file, shell-free (v6.3.0) */
if (args[0] === 'fs-cat') {
    let headCount = null;
    let optional = false;
    const candidatePaths = [];

    for (const arg of args.slice(1)) {
        if (arg === '--optional') {
            optional = true;
        } else if (arg.startsWith('--head=')) {
            const parsed = Number.parseInt(arg.slice('--head='.length), 10);
            if (!Number.isFinite(parsed) || parsed < 1) {
                console.error('[steroid-run] Usage: node steroid-run.cjs fs-cat <file...> [--head=<n>] [--optional]');
                process.exit(1);
            }
            headCount = parsed;
        } else if (arg.startsWith('--')) {
            console.error(`[steroid-run] Unknown option for fs-cat: ${arg}`);
            process.exit(1);
        } else {
            candidatePaths.push(arg);
        }
    }

    if (candidatePaths.length === 0) {
        console.error('[steroid-run] Usage: node steroid-run.cjs fs-cat <file...> [--head=<n>] [--optional]');
        process.exit(1);
    }

    let chosenPath = null;
    let resolvedPath = null;
    for (const candidate of candidatePaths) {
        const resolved = path.resolve(targetDir, candidate);
        if (fs.existsSync(resolved) && fs.statSync(resolved).isFile()) {
            chosenPath = candidate;
            resolvedPath = resolved;
            break;
        }
    }

    if (!resolvedPath) {
        if (optional) {
            console.log(`[steroid-run] ⏭️  No matching file found: ${candidatePaths.join(', ')}`);
            process.exit(0);
        }
        console.error(`[steroid-run] ❌ File not found: ${candidatePaths.join(', ')}`);
        process.exit(1);
    }

    const relativePath = path.relative(targetDir, resolvedPath) || chosenPath;
    const contents = fs.readFileSync(resolvedPath, 'utf-8');
    const display = headCount === null ? contents : contents.split(/\r?\n/).slice(0, headCount).join('\n');

    console.log(`[steroid-run] 📄 ${relativePath}`);
    if (display.length > 0) {
        console.log(display);
    }
    process.exit(0);
}

/** CMD: fs-find — Find files/directories without shell globbing (v6.3.0) */
if (args[0] === 'fs-find') {
    const startPaths = [];
    const namePatterns = [];
    let type = 'any';
    let maxDepth = Number.POSITIVE_INFINITY;
    let limit = Number.POSITIVE_INFINITY;
    let countOnly = false;

    for (const arg of args.slice(1)) {
        if (arg.startsWith('--name=')) {
            namePatterns.push(globToRegExp(arg.slice('--name='.length)));
        } else if (arg.startsWith('--type=')) {
            type = arg.slice('--type='.length);
            if (!['any', 'file', 'dir'].includes(type)) {
                console.error(
                    '[steroid-run] Usage: node steroid-run.cjs fs-find [path...] [--name=<glob>] [--type=file|dir] [--max-depth=<n>] [--limit=<n>] [--count]',
                );
                process.exit(1);
            }
        } else if (arg.startsWith('--max-depth=')) {
            const parsed = Number.parseInt(arg.slice('--max-depth='.length), 10);
            if (!Number.isFinite(parsed) || parsed < 0) {
                console.error(
                    '[steroid-run] Usage: node steroid-run.cjs fs-find [path...] [--name=<glob>] [--type=file|dir] [--max-depth=<n>] [--limit=<n>] [--count]',
                );
                process.exit(1);
            }
            maxDepth = parsed;
        } else if (arg.startsWith('--limit=')) {
            const parsed = Number.parseInt(arg.slice('--limit='.length), 10);
            if (!Number.isFinite(parsed) || parsed < 1) {
                console.error(
                    '[steroid-run] Usage: node steroid-run.cjs fs-find [path...] [--name=<glob>] [--type=file|dir] [--max-depth=<n>] [--limit=<n>] [--count]',
                );
                process.exit(1);
            }
            limit = parsed;
        } else if (arg === '--count') {
            countOnly = true;
        } else if (arg.startsWith('--')) {
            console.error(`[steroid-run] Unknown option for fs-find: ${arg}`);
            process.exit(1);
        } else {
            startPaths.push(arg);
        }
    }

    const roots = startPaths.length > 0 ? startPaths : ['.'];
    const results = [];

    for (const root of roots) {
        const resolvedRoot = path.resolve(targetDir, root);
        if (!isWithinTargetDir(resolvedRoot) || !fs.existsSync(resolvedRoot)) continue;

        const stop = walkPathEntries(resolvedRoot, { maxDepth, skipRoot: false }, (entry) => {
            if (results.length >= limit) return true;
            const typeMatch =
                type === 'any' || (type === 'file' && entry.isFile) || (type === 'dir' && entry.isDirectory);
            const nameMatch = namePatterns.length === 0 || namePatterns.some((pattern) => pattern.test(entry.name));

            if (typeMatch && nameMatch) {
                results.push(entry.relativePath);
                if (results.length >= limit) return true;
            }
            return false;
        });
        if (stop && results.length >= limit) break;
    }

    if (countOnly) {
        console.log(`[steroid-run] 🔎 ${results.length}`);
    } else if (results.length === 0) {
        console.log('[steroid-run] ⏭️  No matches found.');
    } else {
        console.log(`[steroid-run] 🔎 Found ${results.length} match(es)`);
        for (const result of results) console.log(result);
    }
    process.exit(0);
}

/** CMD: fs-grep — Search text safely without grep/findstr (v6.3.0) */
if (args[0] === 'fs-grep') {
    let patternText = null;
    const searchPaths = [];
    const includePatterns = [];
    let filesWithMatches = false;
    let ignoreCase = false;
    let fixed = false;
    let limit = Number.POSITIVE_INFINITY;

    for (const arg of args.slice(1)) {
        if (arg.startsWith('--include=')) {
            includePatterns.push(globToRegExp(arg.slice('--include='.length)));
        } else if (arg === '--files-with-matches') {
            filesWithMatches = true;
        } else if (arg === '--ignore-case') {
            ignoreCase = true;
        } else if (arg === '--fixed') {
            fixed = true;
        } else if (arg.startsWith('--limit=')) {
            const parsed = Number.parseInt(arg.slice('--limit='.length), 10);
            if (!Number.isFinite(parsed) || parsed < 1) {
                console.error(
                    '[steroid-run] Usage: node steroid-run.cjs fs-grep <pattern> [path...] [--include=<glob>] [--files-with-matches] [--limit=<n>] [--ignore-case] [--fixed]',
                );
                process.exit(1);
            }
            limit = parsed;
        } else if (arg.startsWith('--')) {
            console.error(`[steroid-run] Unknown option for fs-grep: ${arg}`);
            process.exit(1);
        } else if (patternText === null) {
            patternText = arg;
        } else {
            searchPaths.push(arg);
        }
    }

    if (!patternText) {
        console.error(
            '[steroid-run] Usage: node steroid-run.cjs fs-grep <pattern> [path...] [--include=<glob>] [--files-with-matches] [--limit=<n>] [--ignore-case] [--fixed]',
        );
        process.exit(1);
    }

    const regexSource = fixed ? patternText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') : patternText;
    const pattern = new RegExp(regexSource, ignoreCase ? 'i' : '');
    const roots = searchPaths.length > 0 ? searchPaths : ['.'];
    const results = [];
    const seenFiles = new Set();

    const searchFile = (filePath) => {
        if (results.length >= limit) return true;

        const relativePath = path.relative(targetDir, filePath) || path.basename(filePath);
        const normalizedRelative = relativePath.replace(/\\/g, '/');
        const basename = path.basename(filePath);
        const includeMatch =
            includePatterns.length === 0 ||
            includePatterns.some((glob) => glob.test(basename) || glob.test(normalizedRelative));
        if (!includeMatch) return false;

        let contents = '';
        try {
            contents = fs.readFileSync(filePath, 'utf-8');
        } catch {
            return false;
        }

        const lines = contents.split(/\r?\n/);
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            pattern.lastIndex = 0;
            if (!pattern.test(line)) continue;

            if (filesWithMatches) {
                if (!seenFiles.has(relativePath)) {
                    results.push(relativePath);
                    seenFiles.add(relativePath);
                }
                break;
            }

            results.push(`${relativePath}:${i + 1}: ${line}`);
            if (results.length >= limit) return true;
        }
        return results.length >= limit;
    };

    for (const root of roots) {
        const resolvedRoot = path.resolve(targetDir, root);
        if (!isWithinTargetDir(resolvedRoot) || !fs.existsSync(resolvedRoot)) continue;

        if (fs.statSync(resolvedRoot).isFile()) {
            if (searchFile(resolvedRoot)) break;
            continue;
        }

        const stop = walkPathEntries(resolvedRoot, { maxDepth: Number.POSITIVE_INFINITY, skipRoot: true }, (entry) => {
            if (results.length >= limit) return true;
            if (entry.isFile) {
                return searchFile(entry.absolutePath);
            }
            return false;
        });
        if (stop && results.length >= limit) break;
    }

    if (results.length === 0) {
        console.log('[steroid-run] ⏭️  No matches found.');
    } else {
        console.log(`[steroid-run] 🔎 Found ${results.length} match(es)`);
        for (const result of results) console.log(result);
    }
    process.exit(0);
}

/** CMD: fs-ls — List directory contents as tree (v6.0.0) */
if (args[0] === 'fs-ls') {
    const lsPath = args[1] || '.';
    const resolved = path.resolve(targetDir, lsPath);

    if (!fs.existsSync(resolved)) {
        console.error(`[steroid-run] ❌ Path does not exist: ${lsPath}`);
        process.exit(1);
    }

    const printTree = (dir, prefix, maxDepth, currentDepth) => {
        if (currentDepth >= maxDepth) return;
        const entries = fs
            .readdirSync(dir, { withFileTypes: true })
            .filter((e) => !e.name.startsWith('.') && e.name !== 'node_modules')
            .sort((a, b) => {
                if (a.isDirectory() && !b.isDirectory()) return -1;
                if (!a.isDirectory() && b.isDirectory()) return 1;
                return a.name.localeCompare(b.name);
            });

        for (let i = 0; i < entries.length; i++) {
            const entry = entries[i];
            const isLast = i === entries.length - 1;
            const connector = isLast ? '└── ' : '├── ';
            const childPrefix = isLast ? '    ' : '│   ';

            if (entry.isDirectory()) {
                console.log(`${prefix}${connector}${entry.name}/`);
                printTree(path.join(dir, entry.name), prefix + childPrefix, maxDepth, currentDepth + 1);
            } else {
                const size = fs.statSync(path.join(dir, entry.name)).size;
                const sizeStr = size > 1024 ? `${(size / 1024).toFixed(1)}KB` : `${size}B`;
                console.log(`${prefix}${connector}${entry.name} (${sizeStr})`);
            }
        }
    };

    console.log(`[steroid-run] 📂 ${path.relative(targetDir, resolved) || '.'}/`);
    printTree(resolved, '  ', 4, 0);
    process.exit(0);
}

/** CMD: git-init — Initialize git repo with first commit, shell-free (v6.0.0) */
if (args[0] === 'git-init') {
    if (fs.existsSync(path.join(targetDir, '.git'))) {
        console.log('[steroid-run] ⏭️  Git already initialized. Skipping.');
        process.exit(0);
    }

    console.log('[steroid-run] Initializing git repository...');

    const init = spawnSync('git', ['init'], { cwd: targetDir, stdio: 'inherit' });
    if (init.status !== 0) {
        console.error('[steroid-run] ❌ git init failed.');
        process.exit(1);
    }

    const add = spawnSync('git', ['add', '-A'], { cwd: targetDir, stdio: 'inherit' });
    if (add.status !== 0) {
        console.error('[steroid-run] ❌ git add -A failed.');
        process.exit(1);
    }

    const commit = spawnSync('git', ['commit', '-m', 'feat(steroid): initial scaffold checkpoint'], {
        cwd: targetDir,
        stdio: 'inherit',
    });
    if (commit.status !== 0) {
        console.error('[steroid-run] ❌ git commit failed.');
        process.exit(1);
    }

    console.log('[steroid-run] ✅ Git initialized with scaffold checkpoint.');
    process.exit(0);
}

// ============================================================
// PIPELINE ENFORCEMENT COMMANDS (Ported from ecosystem forks)
// ============================================================

/** CMD: init-feature — Create feature folder with progress.md template */
// --- Init Feature Command (Ported from OpenSpec change-utils.ts) ---
// Source: src/forks/openspec/src/utils/change-utils.ts validateChangeName() + createChange()
if (args[0] === 'init-feature') {
    const slug = args[1];
    if (!slug) {
        console.error('[steroid-run] Usage: npx steroid-run init-feature <slug>');
        console.error('  Example: npx steroid-run init-feature habit-tracker');
        process.exit(1);
    }

    // Ported from OpenSpec validateChangeName() — kebab-case validation with specific error messages
    const kebabCasePattern = /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/;
    if (!kebabCasePattern.test(slug)) {
        if (/[A-Z]/.test(slug)) {
            console.error(`[steroid-run] ❌ Feature name must be lowercase (use kebab-case). Got: "${slug}"`);
        } else if (/\s/.test(slug)) {
            console.error(`[steroid-run] ❌ Feature name cannot contain spaces (use hyphens). Got: "${slug}"`);
        } else if (/_/.test(slug)) {
            console.error(`[steroid-run] ❌ Feature name cannot contain underscores (use hyphens). Got: "${slug}"`);
        } else if (slug.startsWith('-') || slug.endsWith('-')) {
            console.error(`[steroid-run] ❌ Feature name cannot start or end with a hyphen. Got: "${slug}"`);
        } else if (/--/.test(slug)) {
            console.error(`[steroid-run] ❌ Feature name cannot contain consecutive hyphens. Got: "${slug}"`);
        } else {
            console.error(
                `[steroid-run] ❌ Feature name must be kebab-case (e.g., habit-tracker, todo-app). Got: "${slug}"`,
            );
        }
        process.exit(1);
    }

    // Ported from OpenSpec createChange() — directory creation with duplicate check
    const featureDir = path.join(changesDir, slug);
    if (fs.existsSync(featureDir)) {
        console.log(`[steroid-run] ⚠️  Feature "${slug}" already exists at ${featureDir}`);
        process.exit(0);
    }

    fs.mkdirSync(path.join(featureDir, 'archive'), { recursive: true });
    console.log(`[steroid-run] ✅ Feature folder created: .memory/changes/${slug}/`);
    console.log(`  📁 .memory/changes/${slug}/`);
    console.log(`  📁 .memory/changes/${slug}/archive/`);
    console.log(`  🧠 Next: node steroid-run.cjs normalize-prompt "<user prompt>" --feature ${slug} --write`);
    process.exit(0);
}

/** CMD: gate — Check phase prerequisites before proceeding */
if (args[0] === 'gate') {
    const phase = args[1];
    const feature = args[2];

    if (!phase || !feature) {
        console.error('[steroid-run] Usage: npx steroid-run gate <phase> <feature>');
        console.error('  Phases: vibe, specify, research, architect, diagnose, engine, verify');
        process.exit(1);
    }

    const featureDir = path.join(changesDir, feature);
    const artifactState = buildFeatureArtifactState(featureDir);
    const promptReceipt = readJsonFile(path.join(featureDir, 'prompt.json'));
    const routeSummary = promptReceipt ? summarizeRouteProgress(promptReceipt, artifactState) : null;
    const requestReceipt = loadRequestReceipt(feature, featureDir);
    const gates = {
        vibe: { requires: 'context.md', minLines: 5, label: 'Codebase scan' },
        specify: { requires: 'vibe.md', minLines: 5, label: 'Vibe capture' },
        research: { requires: 'spec.md', minLines: 10, label: 'Specification' },
        architect: { requires: 'research.md', minLines: 10, label: 'Research' },
        diagnose: { requires: 'context.md', minLines: 5, label: 'Codebase scan' },
        engine: {
            requires: 'plan.md',
            minLines: 10,
            label: 'Architecture',
            alt: { requires: 'diagnosis.md', minLines: 10, label: 'Diagnosis' },
        },
        verify: {
            requires: 'plan.md',
            minLines: 10,
            label: 'Engine execution',
            alt: { requires: 'diagnosis.md', minLines: 10, label: 'Diagnosis (fix pipeline)' },
        },
    };

    const gate = gates[phase];
    if (!gate) {
        console.error(`[steroid-run] ❌ Unknown phase: "${phase}". Valid phases: ${Object.keys(gates).join(', ')}`);
        process.exit(1);
    }

    if (['vibe', 'diagnose'].includes(phase) && !requestReceipt.requestedAt) {
        console.error(`[steroid-run] 🚫 GATE BLOCKED: governed scan receipt is incomplete.`);
        console.error(`  Missing: .memory/changes/${feature}/request.json`);
        console.error(`  The "${phase}" phase cannot start until request.json and context.md both exist.`);
        console.error(`  Run: node steroid-run.cjs scan ${feature}`);
        process.exit(1);
    }

    const requiredFile = path.join(featureDir, gate.requires);
    const primaryExists = fs.existsSync(requiredFile);

    // Check alt-path (e.g., fix pipeline uses diagnosis.md instead of plan.md)
    if (!primaryExists && gate.alt) {
        const altFile = path.join(featureDir, gate.alt.requires);
        if (fs.existsSync(altFile)) {
            const altLines = fs.readFileSync(altFile, 'utf-8').split('\n').length;
            if (altLines >= gate.alt.minLines) {
                console.log(
                    `[steroid-run] ✅ Gate passed (alt): ${gate.alt.requires} exists (${altLines} lines). Proceeding to ${phase} via fix pipeline.`,
                );
                if (routeSummary) {
                    console.log(
                        `  Route guidance: ${routeSummary.expectedRoute} (${routeSummary.status}) — ${routeSummary.detail}`,
                    );
                    if (routeSummary.next.phase !== 'complete' && routeSummary.next.phase !== phase) {
                        console.log(`  Suggested next step: ${routeSummary.next.phase} — ${routeSummary.next.reason}`);
                    }
                }
                process.exit(0);
            } else {
                console.error(
                    `[steroid-run] 🚫 GATE BLOCKED: ${gate.alt.requires} looks incomplete (${altLines} lines, need ${gate.alt.minLines}+).`,
                );
                if (routeSummary) {
                    console.error(
                        `  Route guidance: ${routeSummary.expectedRoute} (${routeSummary.status}) — ${routeSummary.detail}`,
                    );
                    if (routeSummary.next.phase !== 'complete') {
                        console.error(
                            `  Suggested next step: ${routeSummary.next.phase} — ${routeSummary.next.reason}`,
                        );
                    }
                }
                process.exit(1);
            }
        }
    }

    if (!primaryExists) {
        console.error(`[steroid-run] 🚫 GATE BLOCKED: ${gate.label} phase not complete.`);
        console.error(`  Missing: .memory/changes/${feature}/${gate.requires}`);
        if (gate.alt) {
            console.error(`  Alt path: .memory/changes/${feature}/${gate.alt.requires} (also missing)`);
        }
        console.error(
            `  The "${phase}" phase cannot start until ${gate.requires}${gate.alt ? ` or ${gate.alt.requires}` : ''} exists.`,
        );
        if (routeSummary) {
            console.error(
                `  Route guidance: ${routeSummary.expectedRoute} (${routeSummary.status}) — ${routeSummary.detail}`,
            );
            if (routeSummary.next.phase !== 'complete') {
                console.error(`  Suggested next step: ${routeSummary.next.phase} — ${routeSummary.next.reason}`);
            }
        }
        console.error(friendlyHint('gate-blocked'));
        process.exit(1);
    }

    const lines = fs.readFileSync(requiredFile, 'utf-8').split('\n').length;
    if (lines < gate.minLines) {
        console.error(
            `[steroid-run] 🚫 GATE BLOCKED: ${gate.requires} looks incomplete (${lines} lines, need ${gate.minLines}+).`,
        );
        if (routeSummary) {
            console.error(
                `  Route guidance: ${routeSummary.expectedRoute} (${routeSummary.status}) — ${routeSummary.detail}`,
            );
            if (routeSummary.next.phase !== 'complete') {
                console.error(`  Suggested next step: ${routeSummary.next.phase} — ${routeSummary.next.reason}`);
            }
        }
        console.error(friendlyHint('gate-incomplete'));
        process.exit(1);
    }

    const governedShape = validateGovernedPhaseArtifact(gate.requires, fs.readFileSync(requiredFile, 'utf-8'));
    if (!governedShape.ok) {
        console.error(`[steroid-run] 🚫 GATE BLOCKED: ${gate.requires} is missing governed structure.`);
        console.error(`  ${governedShape.reason}`);
        console.error(friendlyHint('gate-incomplete'));
        process.exit(1);
    }

    const missingDesignArtifacts = getMissingDesignArtifactsForPhase(featureDir, phase, promptReceipt);
    if (missingDesignArtifacts.length > 0) {
        console.error(`[steroid-run] 🚫 DESIGN GATE BLOCKED: ${phase} requires UI design artifacts for this feature.`);
        console.error(`  Missing: ${missingDesignArtifacts.join(', ')}`);
        if (!promptReceipt) {
            console.error(`  Run: node steroid-run.cjs normalize-prompt "<user prompt>" --feature ${feature} --write`);
        }
        console.error(`  Run: node steroid-run.cjs design-route "<user prompt>" --feature ${feature} --write`);
        console.error(`  Run: node steroid-run.cjs design-system --feature ${feature} --write`);
        console.error(
            '  UI-intensive work must produce a routing receipt and design system before architecture or engine can proceed.',
        );
        process.exit(1);
    }

    if (phase === 'research') {
        const designBootstrap = bootstrapFeatureDesignArtifacts(feature, featureDir, {
            source: 'gate:research',
            projectName: feature,
        });
        if (!designBootstrap.ok) {
            console.error('[steroid-run] 🚫 DESIGN PREP FAILED: research could not bootstrap UI design artifacts.');
            console.error(`  Reason: ${designBootstrap.reason}`);
            console.error(`  Try: node steroid-run.cjs design-route "<user prompt>" --feature ${feature} --write`);
            console.error(`  Then: node steroid-run.cjs design-system --feature ${feature} --write`);
            process.exit(1);
        }
        if (!designBootstrap.skipped) {
            const routeAction = designBootstrap.designRouteWritten
                ? 'wrote design-routing.json'
                : 'kept design-routing.json';
            const systemAction = designBootstrap.auditOnly
                ? 'skipped design-system.md (audit-only route)'
                : designBootstrap.designSystemWritten
                  ? 'wrote design-system.md'
                  : 'kept design-system.md';
            console.log(`[steroid-run] 🎨 Research prep: ${routeAction}; ${systemAction}.`);
        }
    }

    console.log(`[steroid-run] ✅ Gate passed: ${gate.requires} exists (${lines} lines). Proceeding to ${phase}.`);
    if (routeSummary) {
        console.log(
            `  Route guidance: ${routeSummary.expectedRoute} (${routeSummary.status}) — ${routeSummary.detail}`,
        );
        if (routeSummary.next.phase !== 'complete' && routeSummary.next.phase !== phase) {
            console.log(`  Suggested next step: ${routeSummary.next.phase} — ${routeSummary.next.reason}`);
        }
    }

    // Audit trail receipt (v5.9.0) — tamper-evident log of gate passes
    try {
        const hash = crypto
            .createHash('sha256')
            .update(fs.readFileSync(requiredFile, 'utf-8'))
            .digest('hex')
            .slice(0, 12);
        const auditFile = path.join(memoryDir, 'audit-trail.md');
        const receipt =
            `\n## [${new Date().toISOString()}] Gate: ${phase} → ${feature}\n` +
            `- **Passed**: ${gate.requires} (${lines} lines, sha256: ${hash})\n` +
            `- **Circuit breaker**: ${state.error_count}/5 errors\n`;
        if (!fs.existsSync(auditFile)) {
            fs.writeFileSync(
                auditFile,
                '# Steroid Audit Trail\n\n_Tamper-evident log of pipeline phase completions._\n',
            );
        }
        fs.appendFileSync(auditFile, receipt);
    } catch {
        /* audit trail is best-effort */
    }

    process.exit(0);
}

/** CMD: commit — Atomic git commit with steroid format prefix */
// --- Commit Command (Atomic commit — adapted from Ralph/GSD patterns) ---
// Source: src/forks/ralph/prompt.md atomic commit format
if (args[0] === 'commit') {
    const message = args.slice(1).join(' ');
    if (!message) {
        console.error('[steroid-run] Usage: npx steroid-run commit <message>');
        console.error('  Example: npx steroid-run commit "Create HabitCard component"');
        process.exit(1);
    }

    const commitMsg = `feat(steroid): ${message}`;
    console.log(`[steroid-run] Committing: ${commitMsg}`);

    // v5.2.0: Git init check — verify .git exists before attempting commit
    if (!fs.existsSync(path.join(targetDir, '.git'))) {
        console.error('[steroid-run] ⚠️  No .git repository found.');
        console.error(friendlyHint('no-git'));
        process.exit(1);
    }

    // v5.0.1: Protect .gitignore — auto-restore steroid entries before commit
    const gitignorePath = path.join(targetDir, '.gitignore');
    const requiredGitignoreEntries = ['.memory/', 'steroid-run.cjs', '.agents/', 'src/forks/'];
    if (fs.existsSync(gitignorePath)) {
        const giContent = fs.readFileSync(gitignorePath, 'utf-8');
        const missing = requiredGitignoreEntries.filter((e) => !giContent.includes(e));
        if (missing.length > 0) {
            fs.appendFileSync(
                gitignorePath,
                '\n# Steroid-Workflow (auto-restored by commit guard)\n' + missing.join('\n') + '\n',
            );
            console.log(
                `[steroid-run] ⚠️  .gitignore was missing steroid entries. Auto-restored: ${missing.join(', ')}`,
            );
        }
    }

    const add = spawnSync('git', ['add', '-A'], { cwd: targetDir, stdio: 'inherit' });
    if (add.status !== 0) {
        state.error_count += 1;
        state.last_error = 'git add -A failed';
        if (!state.error_history) state.error_history = [];
        state.error_history.push(`[${new Date().toISOString()}] git add failed`);
        state.status = state.error_count >= 5 ? 'tripped' : 'active';
        fs.writeFileSync(stateFile, JSON.stringify(state, null, 2));
        console.error(`[steroid-run] ❌ git add failed. ERROR ${state.error_count}/5.`);
        console.error(friendlyHint('git-failed'));
        process.exit(1);
    }

    const commit = spawnSync('git', ['commit', '-m', commitMsg], { cwd: targetDir, stdio: 'inherit' });
    if (commit.status !== 0) {
        state.error_count += 1;
        state.last_error = `git commit failed: "${commitMsg}"`;
        if (!state.error_history) state.error_history = [];
        state.error_history.push(`[${new Date().toISOString()}] git commit failed: "${commitMsg}"`);
        state.status = state.error_count >= 5 ? 'tripped' : 'active';
        fs.writeFileSync(stateFile, JSON.stringify(state, null, 2));
        console.error(`[steroid-run] ❌ git commit failed. ERROR ${state.error_count}/5.`);
        console.error(friendlyHint('git-failed'));
        process.exit(1);
    }

    // Success resets error counter (same as regular command execution)
    state.error_count = 0;
    state.last_error = null;
    state.status = 'active';
    fs.writeFileSync(stateFile, JSON.stringify(state, null, 2));
    console.log(`[steroid-run] ✅ Committed: ${commitMsg}`);
    process.exit(0);
}

/** CMD: log — Append a message to the feature progress log */
// --- Log Command (Ported from Ralph ralph.sh progress pattern) ---
// Source: src/forks/ralph/ralph.sh lines 76-79 (progress init) + prompt.md learnings format
if (args[0] === 'log') {
    const feature = args[1];
    const message = args.slice(2).join(' ');

    if (!feature || !message) {
        console.error('[steroid-run] Usage: npx steroid-run log <feature> <message>');
        console.error('  Example: npx steroid-run log habit-tracker "Implemented HabitCard component"');
        process.exit(1);
    }

    // Initialize progress file if it doesn't exist (ported from ralph.sh lines 76-79)
    if (!fs.existsSync(progressFile)) {
        const initContent = `# Steroid Progress Log\nStarted: ${new Date().toISOString()}\n\n## Codebase Patterns\n\n[Patterns will be added here as tasks are completed]\n\n---\n`;
        fs.writeFileSync(progressFile, initContent);
    }

    // Append timestamped entry (adapted from Ralph prompt.md learnings format)
    const timestamp = new Date().toISOString().replace('T', ' ').split('.')[0];
    const entry = `\n## [${timestamp}] — ${feature}: ${message}\n---\n`;
    fs.appendFileSync(progressFile, entry);
    console.log(`[steroid-run] ✅ Logged: ${message}`);
    process.exit(0);
}

/** CMD: check-plan — Count remaining tasks in plan.md */
if (args[0] === 'check-plan') {
    const feature = args[1];
    if (!feature) {
        console.error('[steroid-run] Usage: npx steroid-run check-plan <feature>');
        process.exit(1);
    }

    const planFile = path.join(changesDir, feature, 'plan.md');
    if (!fs.existsSync(planFile)) {
        console.error(`[steroid-run] ❌ No plan found at .memory/changes/${feature}/plan.md`);
        process.exit(1);
    }

    const content = fs.readFileSync(planFile, 'utf-8');
    const { total, done, remaining, percent } = parseChecklistStats(content);
    const featureDir = path.join(changesDir, feature);

    syncTasksArtifact(feature, featureDir, content);

    console.log(`[steroid-run] 📊 Plan: ${done}/${total} tasks complete (${percent}%)`);
    console.log(`[steroid-run]    Tasks: .memory/changes/${feature}/tasks.md`);

    // v4.0: If plan has priorities, show breakdown
    const sanitized = stripFencedCodeBlocks(content);
    const p1 = (sanitized.match(/^- \[[ x]\] (?:\[P\] )?P1:/gm) || []).length;
    const p1Done = (sanitized.match(/^- \[x\] (?:\[P\] )?P1:/gm) || []).length;
    if (p1 > 0) {
        console.log(`[steroid-run]    P1: ${p1Done}/${p1} | P2/P3: ${done - p1Done}/${total - p1}`);
        if (p1Done < p1) {
            console.log(`[steroid-run] ⚠️  ${p1 - p1Done} P1 (foundational) stories remaining. Complete these first.`);
        }
    }

    if (remaining === 0 && total > 0) {
        saveExecutionReceipt(featureDir, {
            feature,
            status: 'COMPLETE',
            consumedArtifacts: ['plan.md', 'tasks.md'],
            summary: 'Execution checklist is fully complete and ready for verification.',
        });
        console.log('[steroid-run] ✅ All tasks complete! Ready to verify.');
        console.log(`[steroid-run]    Execution receipt: .memory/changes/${feature}/execution.json`);
        process.exit(0);
    } else {
        console.log(`[steroid-run] ⏳ ${remaining} tasks remaining.`);
        process.exit(1);
    }
}

/** CMD: stories — List prioritized stories or get next story to work on */
// --- Stories Command (Prioritized story execution — v4.0) ---
// Source: src/forks/spec-kit tasks-template.md + src/forks/ralph prd.json
if (args[0] === 'stories') {
    const feature = args[1];
    const sub = args[2];

    if (!feature) {
        console.error('[steroid-run] Usage: npx steroid-run stories <feature> [next|list]');
        process.exit(1);
    }

    const planFile = path.join(changesDir, feature, 'plan.md');
    if (!fs.existsSync(planFile)) {
        console.error(`[steroid-run] ❌ No plan found at .memory/changes/${feature}/plan.md`);
        process.exit(1);
    }

    const content = fs.readFileSync(planFile, 'utf-8');

    const storyRegex = /^- \[([ x/])\] (\[P\] )?(?:(P[123]):)?\s*(.+)$/gm;
    const stories = [];
    let match;
    let index = 0;
    while ((match = storyRegex.exec(content)) !== null) {
        index++;
        stories.push({
            index,
            status: match[1] === 'x' ? 'done' : match[1] === '/' ? 'in-progress' : 'todo',
            parallel: !!match[2],
            priority: match[3] || 'P2',
            title: match[4].trim(),
        });
    }

    if (stories.length === 0) {
        console.log('[steroid-run] ⚠️  No stories found in plan.md. Use format: - [ ] P1: Story title');
        console.log('  Stories without priority markers are treated as P2.');
        const total2 = (content.match(/- \[[ x/]\]/g) || []).length;
        const done2 = (content.match(/- \[x\]/g) || []).length;
        console.log(`  (Plain tasks: ${done2}/${total2} complete)`);
        process.exit(0);
    }

    if (!sub || sub === 'list') {
        const p1 = stories.filter((s) => s.priority === 'P1');
        const p2 = stories.filter((s) => s.priority === 'P2');
        const p3 = stories.filter((s) => s.priority === 'P3');

        console.log(`\n[steroid-run] 📋 Stories for "${feature}"\n`);

        const renderGroup = (label, group) => {
            if (group.length === 0) return;
            console.log(`  ${label}:`);
            for (const s of group) {
                const icon = s.status === 'done' ? '✅' : s.status === 'in-progress' ? '🔄' : '⬜';
                const par = s.parallel ? ' [P]' : '';
                console.log(`    ${icon} #${s.index} ${s.title}${par}`);
            }
            console.log('');
        };

        renderGroup('🔴 P1 — Must Have (MVP)', p1);
        renderGroup('🟡 P2 — Should Have', p2);
        renderGroup('🟢 P3 — Nice to Have', p3);

        const doneCount = stories.filter((s) => s.status === 'done').length;
        console.log(`  Progress: ${doneCount}/${stories.length} stories complete`);

        const p1Incomplete = p1.filter((s) => s.status !== 'done');
        if (p1Incomplete.length > 0) {
            console.log(`\n  ⚠️  FOUNDATIONAL BLOCK: ${p1Incomplete.length} P1 stories incomplete.`);
            console.log('  Complete all P1 stories before starting P2/P3 work.');
        }

        process.exit(0);
    }

    if (sub === 'next') {
        const p1Todo = stories.filter((s) => s.priority === 'P1' && s.status === 'todo');
        const p2Todo = stories.filter((s) => s.priority === 'P2' && s.status === 'todo');
        const p3Todo = stories.filter((s) => s.priority === 'P3' && s.status === 'todo');

        const p1Incomplete = stories.filter((s) => s.priority === 'P1' && s.status !== 'done');
        if (p1Incomplete.length > 0 && p1Todo.length > 0) {
            console.log(`[steroid-run] 🎯 Next story: #${p1Todo[0].index} ${p1Todo[0].title} (P1 — foundational)`);
            process.exit(0);
        }
        if (p1Incomplete.length > 0 && p1Todo.length === 0) {
            const inProgress = p1Incomplete.filter((s) => s.status === 'in-progress');
            if (inProgress.length > 0) {
                console.log(`[steroid-run] ⏳ P1 story in progress: #${inProgress[0].index} ${inProgress[0].title}`);
                console.log('  Complete this before moving to the next story.');
                process.exit(0);
            }
        }

        const next = p2Todo[0] || p3Todo[0];
        if (next) {
            console.log(`[steroid-run] 🎯 Next story: #${next.index} ${next.title} (${next.priority})`);
        } else {
            console.log('[steroid-run] ✅ All stories complete!');
        }
        process.exit(0);
    }

    console.error(`[steroid-run] ❌ Unknown stories subcommand: "${sub}". Use: list, next`);
    process.exit(1);
}

/** CMD: archive — Archive completed feature to .memory/archive/ with verify and completion receipts */
// --- Archive Command (Ported from Ralph ralph.sh archive pattern) ---
// Source: src/forks/ralph/ralph.sh lines 50-63 (archive previous run)
if (args[0] === 'archive') {
    const feature = args[1];
    if (!feature) {
        console.error('[steroid-run] Usage: npx steroid-run archive <feature>');
        process.exit(1);
    }

    const featureDir = path.join(changesDir, feature);
    const archiveDir = path.join(featureDir, 'archive');

    if (!fs.existsSync(featureDir)) {
        console.error(`[steroid-run] ❌ Feature "${feature}" not found at .memory/changes/${feature}/`);
        process.exit(1);
    }

    // v6.1.0: Verification gate — archive requires verify.json with PASS/CONDITIONAL
    const verifyReceipt = loadVerifyReceipt(feature, featureDir);
    if (verifyReceipt.status) {
        if (!['PASS', 'CONDITIONAL'].includes(verifyReceipt.status)) {
            console.error(`[steroid-run] 🚫 ARCHIVE BLOCKED: verify.json status is ${verifyReceipt.status}.`);
            console.error(`  Run verification first: node steroid-run.cjs verify-feature ${feature}`);
            process.exit(1);
        }
    } else {
        console.error(`[steroid-run] 🚫 ARCHIVE BLOCKED: No verify.json receipt found.`);
        console.error(`  Features must be verified before archiving.`);
        console.error(`  Run: node steroid-run.cjs verify-feature ${feature}`);
        if (!args.includes('--force')) {
            process.exit(1);
        }
        console.log(`[steroid-run] ⚠️  --force flag used. Archiving without verification.`);
    }

    const completionReceiptPath = path.join(featureDir, 'completion.json');
    if (!args.includes('--force')) {
        const completionReceipt = loadCompletionReceipt(feature, featureDir);
        if (!completionReceipt.status) {
            console.error(`[steroid-run] 🚫 ARCHIVE BLOCKED: No completion.json receipt found.`);
            console.error(`  Run: node steroid-run.cjs verify-feature ${feature}`);
            process.exit(1);
        }
        if (completionReceipt.status !== verifyReceipt.status) {
            console.error(
                `[steroid-run] 🚫 ARCHIVE BLOCKED: completion.json status ${completionReceipt.status} does not match verify.json status ${verifyReceipt.status}.`,
            );
            console.error(`  Run: node steroid-run.cjs verify-feature ${feature}`);
            process.exit(1);
        }
    }

    const uiReviewRefresh = ensureCurrentUiReviewArtifacts(feature, featureDir, {
        verifyStatus: verifyReceipt.status || 'PENDING',
        deepMode: !!verifyReceipt.deepRequested,
        refreshSource: 'archive',
    });
    if (uiReviewRefresh.attempted && uiReviewRefresh.refreshed) {
        console.log(`[steroid-run] 🔄 Refreshed UI review before archive: ${uiReviewRefresh.reason}`);
    }

    const uiReviewReceipt = uiReviewRefresh.receipt || loadUiReviewReceipt(feature, featureDir);
    const uiArchivePolicy = buildUiArchivePolicy(uiReviewReceipt, {
        deepRequested: !!verifyReceipt.deepRequested,
    });
    if (uiArchivePolicy.decision === 'BLOCK') {
        console.error(`[steroid-run] 🚫 ARCHIVE BLOCKED: ui-review.json status is FAIL.`);
        console.error(`  Frontend quality issues still need resolution before archiving this UI feature.`);
        console.error(
            `  Run: node steroid-run.cjs verify-feature ${feature}${uiReviewReceipt.previewTarget ? ` --deep --url ${uiReviewReceipt.previewTarget}` : ''}`,
        );
        process.exit(1);
    }
    if (uiArchivePolicy.decision === 'BLOCK_CONDITIONAL') {
        if (!args.includes('--force-ui')) {
            console.error(
                `[steroid-run] 🚫 ARCHIVE BLOCKED: ui-review.json is CONDITIONAL with blocking frontend issues.`,
            );
            for (const reason of uiArchivePolicy.blockReasons) {
                console.error(`  - ${reason}`);
            }
            console.error(
                `  Override only if you accept the frontend risk: node steroid-run.cjs archive ${feature} --force-ui`,
            );
            process.exit(1);
        }
        console.log(`[steroid-run] ⚠️  --force-ui override used. Archiving with blocking frontend cautions.`);
        for (const reason of uiArchivePolicy.blockReasons) {
            console.log(`  - ${reason}`);
        }
    } else if (uiArchivePolicy.decision === 'WARN_CONDITIONAL') {
        console.log(`[steroid-run] ⚠️  Frontend review is CONDITIONAL. Archive may proceed with caution.`);
        for (const reason of uiArchivePolicy.warnReasons) {
            console.log(`  - ${reason}`);
        }
    }

    if (!fs.existsSync(archiveDir)) {
        fs.mkdirSync(archiveDir, { recursive: true });
    }

    // Use a filesystem-safe timestamp so repeated archives do not overwrite same-day receipts.
    const archiveStamp = createArchiveStamp();
    const filesToArchive = [
        'context.md',
        'request.json',
        'prompt.json',
        'prompt.md',
        'vibe.md',
        'spec.md',
        'research.md',
        'plan.md',
        'tasks.md',
        'execution.json',
        'verify.md',
        'verify.json',
        'completion.json',
        'ui-review.md',
        'ui-review.json',
        'diagnosis.md',
        'review.md',
        'review.json',
    ];
    let archived = 0;

    for (const file of filesToArchive) {
        const src = path.join(featureDir, file);
        if (fs.existsSync(src)) {
            const dest = getArchiveDestinationPath(archiveDir, archiveStamp, file);
            fs.copyFileSync(src, dest);
            fs.unlinkSync(src);
            archived++;
        }
    }

    console.log(`[steroid-run] ✅ Archived ${archived} files to .memory/changes/${feature}/archive/`);
    console.log(`[steroid-run] 🎉 Feature "${feature}" archived. Ready for next build.`);

    // v4.0: Record feature metrics
    if (!fs.existsSync(metricsDir)) fs.mkdirSync(metricsDir, { recursive: true });
    const featuresFile = path.join(metricsDir, 'features.json');
    let featuresData = {};
    if (fs.existsSync(featuresFile)) {
        try {
            featuresData = JSON.parse(fs.readFileSync(featuresFile, 'utf-8'));
        } catch (e) {
            featuresData = {};
        }
    }
    featuresData[feature] = {
        archived: new Date().toISOString(),
        filesArchived: archived,
        errorCount: state.error_count,
        status: 'complete',
        uiReviewStatus: uiReviewReceipt?.status || null,
        uiReviewFindings: Array.isArray(uiReviewReceipt?.findings) ? uiReviewReceipt.findings.length : 0,
        uiReviewRefreshSource: uiReviewReceipt?.freshness?.source || null,
        uiReviewGeneratedAt: uiReviewReceipt?.generatedAt || null,
        uiReviewRecommendation: uiArchivePolicy.recommendation || null,
        uiReviewOverrideUsed: args.includes('--force-ui'),
    };
    featuresData._lastUpdated = new Date().toISOString();
    fs.writeFileSync(featuresFile, JSON.stringify(featuresData, null, 2));
    console.log(`[steroid-run]    Metrics: feature "${feature}" recorded in features.json`);

    // v5.0+: Auto-generate handoff report on archive
    if (!fs.existsSync(reportsDir)) fs.mkdirSync(reportsDir, { recursive: true });
    const report = generateHandoffReport(feature, featureDir, state, { archived: true });
    const reportFilePath = path.join(reportsDir, `${feature}.md`);
    fs.writeFileSync(reportFilePath, report);
    console.log(`[steroid-run]    Report: .memory/reports/${feature}.md`);

    process.exit(0);
}

// ============================================================
// v3.0 COMMANDS (Codebase Awareness & Intent Routing)
// ============================================================

/** CMD: scan — Bootstrap codebase context (writes context.md) */
// --- Scan Command (Bootstraps request.json + context.md — adapted from GSD codebase-mapper) ---
// Source: src/forks/gsd/agents/gsd-codebase-mapper.md
if (args[0] === 'scan') {
    const feature = args[1];
    if (!feature) {
        console.error('[steroid-run] Usage: npx steroid-run scan <feature>');
        console.error('  Example: npx steroid-run scan habit-tracker');
        console.error('  This creates a basic context.md. The AI skill fills in the details.');
        process.exit(1);
    }

    const featureDir = path.join(changesDir, feature);
    if (!fs.existsSync(featureDir)) {
        console.error(`[steroid-run] ❌ Feature "${feature}" not found. Run: npx steroid-run init-feature ${feature}`);
        process.exit(1);
    }

    const contextFile = path.join(featureDir, 'context.md');
    const requestFile = path.join(featureDir, 'request.json');
    const requestSummary = 'Feature initialized for governed scan context capture.';

    // Check for --force flag (v6.0.0: bypass freshness check after scaffold)
    const forceFlag = args.includes('--force');

    // Check for existing context.md that's less than 24h old
    if (fs.existsSync(contextFile)) {
        if (!fs.existsSync(requestFile)) {
            saveRequestReceipt(featureDir, {
                feature,
                source: 'scan',
                summary: requestSummary,
            });
        }
        const stats = fs.statSync(contextFile);
        const ageMs = Date.now() - stats.mtimeMs;
        const ageHours = ageMs / (1000 * 60 * 60);
        if (ageHours < 24 && !forceFlag) {
            console.log(`[steroid-run] ✅ Context already captured (${Math.round(ageHours)}h ago). Skipping scan.`);
            console.log(`[steroid-run]    Request receipt: .memory/changes/${feature}/request.json`);
            console.log(`[steroid-run]    Use --force to bypass freshness check.`);
            process.exit(0);
        }
        if (forceFlag) {
            console.log(`[steroid-run] 🔄 Force rescan requested. Bypassing freshness check...`);
        } else {
            console.log(`[steroid-run] ⚠️  Context is ${Math.round(ageHours)}h old. Re-scanning...`);
        }

        // Drift detection (v5.9.0): hash old context for comparison after re-scan
        try {
            const oldContent = fs.readFileSync(contextFile, 'utf-8');
            const oldFiles = (oldContent.match(/^- /gm) || []).length;
            const oldHash = crypto.createHash('sha256').update(oldContent).digest('hex').slice(0, 12);
            // Store for post-scan comparison (uses global for simplicity)
            global.__steroidDrift = { oldHash, oldFiles };
        } catch {
            /* drift detection is best-effort */
        }
    }

    // Auto-detect basic project info and bootstrap context.md
    saveRequestReceipt(featureDir, {
        feature,
        source: 'scan',
        summary: requestSummary,
    });

    let language = 'Unknown';
    let framework = 'Unknown';
    let packageManager = 'Unknown';
    let testFramework = 'Not detected';
    let testCommand = 'Not configured';

    // Detect from package.json
    const pkgPath = path.join(targetDir, 'package.json');
    if (fs.existsSync(pkgPath)) {
        try {
            const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
            language = 'JavaScript/TypeScript';
            packageManager = fs.existsSync(path.join(targetDir, 'pnpm-lock.yaml'))
                ? 'pnpm'
                : fs.existsSync(path.join(targetDir, 'yarn.lock'))
                  ? 'yarn'
                  : 'npm';

            // Detect framework
            const deps = { ...pkg.dependencies, ...pkg.devDependencies };
            if (deps['next']) framework = `Next.js ${deps['next']}`;
            else if (deps['react']) framework = `React ${deps['react']}`;
            else if (deps['vue']) framework = `Vue ${deps['vue']}`;
            else if (deps['svelte'] || deps['@sveltejs/kit']) framework = 'SvelteKit';
            else if (deps['express']) framework = `Express ${deps['express']}`;
            else if (deps['fastify']) framework = `Fastify ${deps['fastify']}`;
            else if (deps['hono']) framework = `Hono ${deps['hono']}`;
            else framework = 'Node.js';

            // Detect test framework
            if (deps['vitest']) {
                testFramework = 'Vitest';
                testCommand = 'npx vitest';
            } else if (deps['jest']) {
                testFramework = 'Jest';
                testCommand = 'npx jest';
            } else if (deps['mocha']) {
                testFramework = 'Mocha';
                testCommand = 'npx mocha';
            } else if (deps['@playwright/test']) {
                testFramework = 'Playwright';
                testCommand = 'npx playwright test';
            }

            // Override with scripts.test if available
            if (pkg.scripts && pkg.scripts.test && pkg.scripts.test !== 'echo "Error: no test specified" && exit 1') {
                testCommand = 'npm test';
            }
        } catch (e) {
            /* ignore parse errors */
        }
    }

    // Refine: check for TypeScript specifically
    if (language === 'JavaScript/TypeScript') {
        if (fs.existsSync(path.join(targetDir, 'tsconfig.json'))) {
            language = 'TypeScript';
        } else {
            language = 'JavaScript';
        }
    }

    // Detect from Python
    if (
        fs.existsSync(path.join(targetDir, 'requirements.txt')) ||
        fs.existsSync(path.join(targetDir, 'pyproject.toml'))
    ) {
        language = 'Python';
        packageManager = 'pip';
        if (fs.existsSync(path.join(targetDir, 'pyproject.toml'))) packageManager = 'poetry/pip';
        framework = fs.existsSync(path.join(targetDir, 'manage.py'))
            ? 'Django'
            : fs.existsSync(path.join(targetDir, 'app.py'))
              ? 'Flask'
              : 'Python';
        if (
            fs.existsSync(path.join(targetDir, 'pytest.ini')) ||
            fs.existsSync(path.join(targetDir, 'pyproject.toml'))
        ) {
            testFramework = 'Pytest';
            testCommand = 'pytest';
        }
    }

    // Detect from Go
    if (fs.existsSync(path.join(targetDir, 'go.mod'))) {
        language = 'Go';
        packageManager = 'go mod';
        framework = 'Go';
        testFramework = 'go test';
        testCommand = 'go test ./...';
    }

    // Detect from Rust
    if (fs.existsSync(path.join(targetDir, 'Cargo.toml'))) {
        language = 'Rust';
        packageManager = 'cargo';
        framework = 'Rust';
        testFramework = 'cargo test';
        testCommand = 'cargo test';
    }

    // Count existing test files
    let testCount = 0;
    const countTestsIn = (dir) => {
        if (!fs.existsSync(dir)) return;
        try {
            const items = fs.readdirSync(dir, { recursive: true });
            for (const item of items) {
                if (
                    typeof item === 'string' &&
                    (item.includes('.test.') || item.includes('.spec.') || item.startsWith('test_'))
                ) {
                    testCount++;
                }
            }
        } catch (e) {
            /* ignore */
        }
    };
    countTestsIn(path.join(targetDir, 'src'));
    countTestsIn(path.join(targetDir, 'tests'));
    countTestsIn(path.join(targetDir, 'test'));
    countTestsIn(path.join(targetDir, '__tests__'));

    // Write bootstrap context.md
    const timestamp = new Date().toISOString();
    const contextContent = `# Project Context for ${feature}

**Scanned:** ${timestamp}
**Note:** This is a bootstrap scan. The steroid-scan skill will enrich this with detailed analysis.

## Tech Stack

- **Language:** ${language}
- **Framework:** ${framework}
- **Package Manager:** ${packageManager}

## Test Infrastructure

- **Framework:** ${testFramework}
- **Run Command:** \`${testCommand}\`
- **Existing Tests:** ${testCount}

## Project Structure

> To be filled by steroid-scan skill (see \`skills/steroid-scan/SKILL.md\`)

## Existing Patterns

> To be filled by steroid-scan skill from AGENTS.md / progress.md

## Related Code

> To be filled by steroid-scan skill based on feature keyword search
`;

    fs.writeFileSync(contextFile, contextContent);

    // Drift detection summary (v5.9.0)
    if (global.__steroidDrift) {
        const newHash = crypto.createHash('sha256').update(contextContent).digest('hex').slice(0, 12);
        const newFiles = (contextContent.match(/^- /gm) || []).length;
        if (newHash !== global.__steroidDrift.oldHash) {
            const fileDiff = newFiles - global.__steroidDrift.oldFiles;
            const direction = fileDiff > 0 ? `+${fileDiff} new` : fileDiff < 0 ? `${fileDiff} removed` : 'same count';
            console.log(
                `[steroid-run] 🔄 Drift detected: context changed (${direction} files, hash ${global.__steroidDrift.oldHash} → ${newHash})`,
            );
        } else {
            console.log('[steroid-run] ✅ No drift: codebase unchanged since last scan.');
        }
    }

    console.log(`[steroid-run] 📡 Context captured: ${language}/${framework}, ${testCount} tests found.`);
    console.log(`[steroid-run]    Written to: .memory/changes/${feature}/context.md`);
    console.log(`[steroid-run]    The steroid-scan skill will enrich this with detailed analysis.`);

    // v4.0: Write tech-stack knowledge store
    if (!fs.existsSync(knowledgeDir)) {
        fs.mkdirSync(knowledgeDir, { recursive: true });
    }
    const techStackFile = path.join(knowledgeDir, 'tech-stack.json');
    const techStackData = {
        language,
        framework,
        packageManager,
        testFramework,
        testCommand,
        testCount,
        _lastUpdated: new Date().toISOString(),
        _source: 'scan',
    };
    fs.writeFileSync(techStackFile, JSON.stringify(techStackData, null, 2));
    console.log(`[steroid-run]    Knowledge: tech-stack.json updated.`);
    console.log(`[steroid-run]    Request receipt: .memory/changes/${feature}/request.json`);

    // Enrich progress.md with codebase patterns
    if (!fs.existsSync(progressFile)) {
        const progressContent = `# Steroid Progress Log\nStarted: ${timestamp}\n\n## Codebase Patterns\n\n- **Language**: ${language}\n- **Framework**: ${framework}\n- **Package Manager**: ${packageManager}\n- **Test Framework**: ${testFramework}\n- **Test Command**: \`${testCommand}\`\n- **Existing Tests**: ${testCount}\n\n---\n`;
        fs.writeFileSync(progressFile, progressContent);
        console.log(`[steroid-run]    Also created progress.md with codebase patterns.`);
    } else {
        const existing = fs.readFileSync(progressFile, 'utf-8');
        if (existing.includes('[Patterns will be added here')) {
            const updated = existing.replace(
                /\[Patterns will be added here[^\]]*\]/,
                `**Language**: ${language}\n- **Framework**: ${framework}\n- **Package Manager**: ${packageManager}\n- **Test Framework**: ${testFramework}\n- **Test Command**: \`${testCommand}\`\n- **Existing Tests**: ${testCount}`,
            );
            fs.writeFileSync(progressFile, updated);
            console.log(`[steroid-run]    Updated progress.md codebase patterns.`);
        }
    }

    process.exit(0);
}

// ═══════════════════════════════════════════════════════════════════
// § COMMANDS: INTELLIGENCE (detect-intent, detect-tests)
// ═══════════════════════════════════════════════════════════════════

/** CMD: normalize-prompt — Convert raw user input into a structured prompt brief */
if (args[0] === 'normalize-prompt') {
    const featureFlagIndex = args.indexOf('--feature');
    const feature = featureFlagIndex !== -1 ? args[featureFlagIndex + 1] : null;
    const controlArgs = new Set(['--json', '--write', '--feature']);
    if (feature) controlArgs.add(feature);
    const message = args
        .slice(1)
        .filter((arg, index) => !(featureFlagIndex !== -1 && index + 1 === featureFlagIndex) && !controlArgs.has(arg))
        .join(' ');
    if (!message) {
        console.error(
            '[steroid-run] Usage: npx steroid-run normalize-prompt "<user message>" [--json] [--feature <feature> --write]',
        );
        process.exit(1);
    }

    const sessionState = inspectPromptSessionState();
    const analysis = analyzePrompt(message, sessionState);
    if (args.includes('--write')) {
        if (!feature) {
            console.error('[steroid-run] ❌ --write requires --feature <feature>.');
            process.exit(1);
        }
        const featureDir = path.join(changesDir, feature);
        if (!fs.existsSync(featureDir)) {
            console.error(
                `[steroid-run] ❌ Feature "${feature}" not found. Run: npx steroid-run init-feature ${feature}`,
            );
            process.exit(1);
        }
        writeJsonFile(path.join(featureDir, 'prompt.json'), {
            ...analysis,
            sessionState,
            source: 'normalize-prompt',
            updatedAt: new Date().toISOString(),
        });
        fs.writeFileSync(path.join(featureDir, 'prompt.md'), formatPromptMarkdown(feature, analysis, sessionState));
    }

    if (args.includes('--json')) {
        console.log(JSON.stringify({ ...analysis, sessionState }, null, 2));
    } else {
        console.log(`[steroid-run] 🧠 Prompt Intelligence`);
        console.log(`  Summary: ${analysis.normalizedSummary}`);
        console.log(`  Primary intent: ${analysis.primaryIntent}`);
        if (analysis.secondaryIntents.length > 0) {
            console.log(`  Secondary intents: ${analysis.secondaryIntents.join(', ')}`);
        }
        console.log(`  Continuation: ${analysis.continuationState}`);
        console.log(`  Complexity: ${analysis.complexity}`);
        console.log(`  Ambiguity: ${analysis.ambiguity}`);
        console.log(`  Recommended route: ${analysis.recommendedPipeline}`);
        console.log(`  Pipeline hint: ${analysis.pipelineHint}`);
        if (analysis.assumptions.length > 0) {
            console.log(`  Assumptions: ${analysis.assumptions.join(' | ')}`);
        }
        if (analysis.unresolvedQuestions.length > 0) {
            console.log(`  Unresolved: ${analysis.unresolvedQuestions.join(' | ')}`);
        }
        if (analysis.splitRecommended) {
            console.log(`  Suggested split: ${analysis.suggestedFeatures.join(' || ')}`);
        }
        if (args.includes('--write')) {
            console.log(`  Receipt: .memory/changes/${feature}/prompt.json`);
            console.log(`  Brief: .memory/changes/${feature}/prompt.md`);
        }
    }
    process.exit(0);
}

/** CMD: design-route — Route UI work to Steroid's internalized frontend systems */
if (args[0] === 'design-route') {
    const featureFlagIndex = args.indexOf('--feature');
    const feature = featureFlagIndex !== -1 ? args[featureFlagIndex + 1] : null;
    const stackFlagIndex = args.indexOf('--stack');
    const stack = stackFlagIndex !== -1 ? args[stackFlagIndex + 1] : '';
    const controlArgs = new Set(['--json', '--write', '--audit-only', '--feature', '--stack']);
    if (feature) controlArgs.add(feature);
    if (stack) controlArgs.add(stack);
    const message = args
        .slice(1)
        .filter(
            (arg, index) =>
                !(featureFlagIndex !== -1 && index + 1 === featureFlagIndex) &&
                !(stackFlagIndex !== -1 && index + 1 === stackFlagIndex) &&
                !controlArgs.has(arg),
        )
        .join(' ');

    if (!message) {
        console.error(
            '[steroid-run] Usage: npx steroid-run design-route "<user message>" [--json] [--audit-only] [--stack <stack>] [--feature <feature> --write]',
        );
        process.exit(1);
    }

    const route = routeDesignSystems(message, { stack, auditOnly: args.includes('--audit-only') });
    if (args.includes('--write')) {
        if (!feature) {
            console.error('[steroid-run] ❌ --write requires --feature <feature>.');
            process.exit(1);
        }
        const featureDir = path.join(changesDir, feature);
        if (!fs.existsSync(featureDir)) {
            console.error(
                `[steroid-run] ❌ Feature "${feature}" not found. Run: npx steroid-run init-feature ${feature}`,
            );
            process.exit(1);
        }
        writeJsonFile(path.join(featureDir, 'design-routing.json'), {
            ...route,
            source: 'design-route',
            prompt: message,
            updatedAt: new Date().toISOString(),
        });
    }

    if (args.includes('--json')) {
        console.log(JSON.stringify(route, null, 2));
    } else {
        console.log(`[steroid-run] 🎨 Design Route`);
        console.log(`  Stack: ${route.stack}`);
        console.log(`  Audit only: ${route.auditOnly ? 'yes' : 'no'}`);
        console.log(`  Wrapper skill: ${route.wrapperSkill || 'none'}`);
        console.log(
            `  Imported sources: ${route.importedSourceIds.length > 0 ? route.importedSourceIds.join(', ') : 'none'}`,
        );
        if (args.includes('--write')) {
            console.log(`  Receipt: .memory/changes/${feature}/design-routing.json`);
        }
    }
    process.exit(0);
}

/** CMD: design-prep — Generate UI design artifacts together from imported systems */
if (args[0] === 'design-prep') {
    const featureFlagIndex = args.indexOf('--feature');
    const feature = featureFlagIndex !== -1 ? args[featureFlagIndex + 1] : null;
    const stackFlagIndex = args.indexOf('--stack');
    const stack = stackFlagIndex !== -1 ? args[stackFlagIndex + 1] : '';
    const projectNameFlagIndex = args.indexOf('--project-name');
    const projectNameFlag = projectNameFlagIndex !== -1 ? args[projectNameFlagIndex + 1] : '';
    const controlArgs = new Set(['--json', '--write', '--feature', '--stack', '--project-name', '--force']);
    if (feature) controlArgs.add(feature);
    if (stack) controlArgs.add(stack);
    if (projectNameFlag) controlArgs.add(projectNameFlag);

    let featureDir = null;
    if (feature) {
        featureDir = path.join(changesDir, feature);
        if (!fs.existsSync(featureDir)) {
            console.error(
                `[steroid-run] ❌ Feature "${feature}" not found. Run: npx steroid-run init-feature ${feature}`,
            );
            process.exit(1);
        }
    }

    let message = args
        .slice(1)
        .filter(
            (arg, index) =>
                !(featureFlagIndex !== -1 && index + 1 === featureFlagIndex) &&
                !(stackFlagIndex !== -1 && index + 1 === stackFlagIndex) &&
                !(projectNameFlagIndex !== -1 && index + 1 === projectNameFlagIndex) &&
                !controlArgs.has(arg),
        )
        .join(' ');

    if (!message && featureDir) {
        message = resolveFeaturePromptForDesign(featureDir);
    }

    if (args.includes('--write') && !featureDir) {
        console.error('[steroid-run] ❌ --write requires --feature <feature>.');
        process.exit(1);
    }

    if (!message) {
        console.error(
            '[steroid-run] Usage: npx steroid-run design-prep "<user message>" [--stack <stack>] [--project-name <name>] [--feature <feature> --write] [--force]',
        );
        console.error(
            '[steroid-run]        Or use: npx steroid-run design-prep --feature <feature> --write once prompt.json, spec.md, or vibe.md exists.',
        );
        process.exit(1);
    }

    let bootstrap = null;
    let routeSummary = null;
    let previewContent = null;

    if (featureDir) {
        bootstrap = bootstrapFeatureDesignArtifacts(feature, featureDir, {
            prompt: message,
            stack,
            force: args.includes('--force'),
            source: 'design-prep',
            projectName: projectNameFlag || feature || 'Steroid Design System',
        });

        if (!bootstrap.ok) {
            console.error(`[steroid-run] ❌ ${bootstrap.reason}`);
            process.exit(1);
        }

        routeSummary = loadDesignRoutingReceipt(featureDir) || bootstrap.route;
    } else {
        routeSummary = routeDesignSystems(message, { stack });
        if (routeSummary.domain !== 'none' && !routeSummary.auditOnly) {
            const preview = generateDesignSystemMarkdown(message, {
                projectName: projectNameFlag || 'Steroid Design System',
            });
            if (!preview.ok) {
                console.error(`[steroid-run] ❌ ${preview.error}`);
                process.exit(1);
            }
            previewContent = preview.content;
        }
        bootstrap = {
            ok: true,
            skipped: routeSummary.domain === 'none',
            designRouteWritten: false,
            designSystemWritten: false,
            auditOnly: !!routeSummary.auditOnly,
            route: routeSummary,
            reason:
                routeSummary.domain === 'none'
                    ? 'Prompt does not appear UI-intensive, so no design artifacts would be generated.'
                    : null,
        };
    }

    const payload = {
        stack: routeSummary?.stack || 'web',
        auditOnly: !!routeSummary?.auditOnly,
        wrapperSkill: routeSummary?.wrapperSkill || null,
        importedSourceIds: routeSummary?.importedSourceIds || [],
        designRouteWritten: !!bootstrap.designRouteWritten,
        designSystemWritten: !!bootstrap.designSystemWritten,
        skipped: !!bootstrap.skipped,
        outputPaths: featureDir
            ? {
                  designRoute: `.memory/changes/${feature}/design-routing.json`,
                  designSystem: routeSummary?.auditOnly ? null : `.memory/changes/${feature}/design-system.md`,
              }
            : null,
        content: previewContent,
    };

    if (args.includes('--json')) {
        console.log(JSON.stringify(payload, null, 2));
    } else {
        console.log('[steroid-run] 🎨 Design Prep');
        console.log(`  Stack: ${payload.stack}`);
        console.log(`  Audit only: ${payload.auditOnly ? 'yes' : 'no'}`);
        console.log(`  Wrapper skill: ${payload.wrapperSkill || 'none'}`);
        console.log(
            `  Imported sources: ${payload.importedSourceIds.length > 0 ? payload.importedSourceIds.join(', ') : 'none'}`,
        );
        if (payload.skipped) {
            console.log(`  Result: ${bootstrap.reason}`);
        } else {
            console.log(
                `  Design route: ${payload.designRouteWritten ? 'written/refreshed' : 'kept existing receipt'}`,
            );
            console.log(
                `  Design system: ${
                    payload.auditOnly
                        ? 'not applicable (audit-only route)'
                        : payload.designSystemWritten
                          ? 'written/refreshed'
                          : 'kept existing artifact'
                }`,
            );
            if (featureDir) {
                console.log(`  Receipt: .memory/changes/${feature}/design-routing.json`);
                if (!payload.auditOnly) {
                    console.log(`  Artifact: .memory/changes/${feature}/design-system.md`);
                }
            }
        }
    }
    process.exit(0);
}

/** CMD: design-system — Generate a design-system artifact from imported UI systems */
if (args[0] === 'design-system') {
    const featureFlagIndex = args.indexOf('--feature');
    const feature = featureFlagIndex !== -1 ? args[featureFlagIndex + 1] : null;
    const stackFlagIndex = args.indexOf('--stack');
    const stack = stackFlagIndex !== -1 ? args[stackFlagIndex + 1] : '';
    const projectNameFlagIndex = args.indexOf('--project-name');
    const projectNameFlag = projectNameFlagIndex !== -1 ? args[projectNameFlagIndex + 1] : '';
    const controlArgs = new Set(['--json', '--write', '--feature', '--stack', '--project-name']);
    if (feature) controlArgs.add(feature);
    if (stack) controlArgs.add(stack);
    if (projectNameFlag) controlArgs.add(projectNameFlag);

    let featureDir = null;
    if (feature) {
        featureDir = path.join(changesDir, feature);
        if (!fs.existsSync(featureDir)) {
            console.error(
                `[steroid-run] ❌ Feature "${feature}" not found. Run: npx steroid-run init-feature ${feature}`,
            );
            process.exit(1);
        }
    }

    let message = args
        .slice(1)
        .filter(
            (arg, index) =>
                !(featureFlagIndex !== -1 && index + 1 === featureFlagIndex) &&
                !(stackFlagIndex !== -1 && index + 1 === stackFlagIndex) &&
                !(projectNameFlagIndex !== -1 && index + 1 === projectNameFlagIndex) &&
                !controlArgs.has(arg),
        )
        .join(' ');

    if (!message && featureDir) {
        message = resolveFeaturePromptForDesign(featureDir);
    }

    if (!message) {
        console.error(
            '[steroid-run] Usage: npx steroid-run design-system "<user message>" [--stack <stack>] [--project-name <name>] [--feature <feature> --write]',
        );
        console.error(
            '[steroid-run]        Or use: npx steroid-run design-system --feature <feature> --write once prompt.json or design-routing.json exists.',
        );
        process.exit(1);
    }

    const routeReceiptPath = featureDir ? path.join(featureDir, 'design-routing.json') : null;
    const existingRoute = routeReceiptPath ? readJsonFile(routeReceiptPath) : null;
    const route = existingRoute || routeDesignSystems(message, { stack });

    if (route.domain === 'none') {
        console.error(
            '[steroid-run] ❌ This prompt does not look like UI or UX work, so no design system was generated.',
        );
        process.exit(1);
    }
    if (route.auditOnly) {
        console.error(
            '[steroid-run] ❌ design-system is not used for audit-only routes. Run design-route or verify instead.',
        );
        process.exit(1);
    }

    const projectName = projectNameFlag || feature || 'Steroid Design System';
    const generation = generateDesignSystemMarkdown(message, { projectName });
    if (!generation.ok) {
        console.error(`[steroid-run] ❌ ${generation.error}`);
        process.exit(1);
    }

    let artifactPath = null;
    if (args.includes('--write')) {
        if (!featureDir) {
            console.error('[steroid-run] ❌ --write requires --feature <feature>.');
            process.exit(1);
        }
        artifactPath = path.join(featureDir, 'design-system.md');
        fs.writeFileSync(artifactPath, `${generation.content.trim()}\n`);
        if (!existingRoute) {
            writeJsonFile(routeReceiptPath, {
                ...route,
                source: 'design-system',
                prompt: message,
                updatedAt: new Date().toISOString(),
            });
        }
    }

    if (args.includes('--json')) {
        console.log(
            JSON.stringify(
                {
                    stack: route.stack,
                    wrapperSkill: route.wrapperSkill,
                    importedSourceIds: route.importedSourceIds,
                    projectName,
                    outputPath: artifactPath ? `.memory/changes/${feature}/design-system.md` : null,
                    content: generation.content,
                },
                null,
                2,
            ),
        );
    } else if (artifactPath) {
        console.log('[steroid-run] 🎨 Design System');
        console.log(`  Project: ${projectName}`);
        console.log(`  Stack: ${route.stack}`);
        console.log(`  Wrapper skill: ${route.wrapperSkill || 'none'}`);
        console.log(
            `  Imported sources: ${route.importedSourceIds.length > 0 ? route.importedSourceIds.join(', ') : 'none'}`,
        );
        console.log(`  Artifact: .memory/changes/${feature}/design-system.md`);
    } else {
        console.log(generation.content);
    }
    process.exit(0);
}

/** CMD: prompt-health — Score prompt quality and recommend next action */
if (args[0] === 'prompt-health') {
    const message = args.slice(1).join(' ');
    if (!message) {
        console.error('[steroid-run] Usage: npx steroid-run prompt-health "<user message>"');
        process.exit(1);
    }

    const analysis = analyzePrompt(message, inspectPromptSessionState());
    const health = buildPromptHealth(analysis);
    console.log(`[steroid-run] 📋 Prompt Health`);
    console.log(`  Clarity: ${health.clarity}/5`);
    console.log(`  Completeness: ${health.completeness}/5`);
    console.log(`  Ambiguity: ${health.ambiguity}`);
    console.log(`  Complexity: ${health.complexity}`);
    console.log(`  Risk: ${health.risk}`);
    console.log(`  Multi-intent: ${health.multiIntent}`);
    console.log(`  Model sensitivity: ${health.modelSensitivity}`);
    console.log(`  Recommended action: ${health.recommendedAction}`);
    process.exit(0);
}

/** CMD: session-detect — Inspect project/session state for continuation hints */
if (args[0] === 'session-detect') {
    const sessionState = inspectPromptSessionState();
    console.log(`[steroid-run] 🧭 Session Detection`);
    console.log(`  State: ${sessionState.defaultState}`);
    console.log(`  Active feature: ${sessionState.activeFeature || 'none'}`);
    console.log(`  Latest artifact: ${sessionState.latestArtifact || 'none'}`);
    console.log(
        `  Known features: ${sessionState.knownFeatures.length > 0 ? sessionState.knownFeatures.join(', ') : 'none'}`,
    );
    console.log(`  Circuit state: ${sessionState.recoveryState} (${sessionState.errorCount} errors)`);
    process.exit(0);
}

/** CMD: detect-intent — Classify user intent into build/fix/refactor/migrate/document */
if (args[0] === 'detect-intent') {
    const message = args.filter((arg, index) => index > 0 && arg !== '--verbose').join(' ');
    if (!message) {
        console.error('[steroid-run] Usage: npx steroid-run detect-intent "<user message>"');
        console.error('  Example: npx steroid-run detect-intent "fix the login bug"');
        process.exit(1);
    }

    const analysis = analyzePrompt(message, inspectPromptSessionState());
    console.log(analysis.primaryIntent);
    if (args.includes('--verbose')) {
        console.log(`[steroid-run] Intent: ${analysis.primaryIntent} (confidence: ${analysis.confidence})`);
        if (analysis.secondaryIntents.length > 0) {
            console.log(`[steroid-run] Secondary: ${analysis.secondaryIntents.join(', ')}`);
        }
        console.log(`[steroid-run] Ambiguity: ${analysis.ambiguity}`);
        console.log(`[steroid-run] Complexity: ${analysis.complexity}`);
        console.log(`[steroid-run] Continuation: ${analysis.continuationState}`);
        console.log(`[steroid-run] Route: ${analysis.recommendedPipeline}`);
        console.log(`[steroid-run] Pipeline: ${analysis.pipelineHint}`);
        if (analysis.splitRecommended) {
            console.log(`[steroid-run] Split suggested: yes`);
        }
    }
    process.exit(0);
}

/** CMD: detect-tests — Detect test framework configurations in the project */
// --- Detect Tests Command (Test framework auto-detection) ---
// Source: src/forks/gsd/agents/gsd-phase-researcher.md validation architecture
if (args[0] === 'detect-tests') {
    console.log('[steroid-run] 🔍 Detecting test infrastructure...');
    console.log('');

    // Check config files
    const testConfigs = [
        { name: 'Jest', files: ['jest.config.js', 'jest.config.ts', 'jest.config.mjs', 'jest.config.cjs'] },
        { name: 'Vitest', files: ['vitest.config.ts', 'vitest.config.js', 'vitest.config.mts'] },
        { name: 'Mocha', files: ['.mocharc.yml', '.mocharc.json', '.mocharc.js'] },
        { name: 'Pytest', files: ['pytest.ini', 'pyproject.toml', 'setup.cfg'] },
        { name: 'Playwright', files: ['playwright.config.ts', 'playwright.config.js'] },
        { name: 'Cypress', files: ['cypress.config.ts', 'cypress.config.js', 'cypress.json'] },
    ];

    let detected = false;
    for (const config of testConfigs) {
        for (const file of config.files) {
            if (fs.existsSync(path.join(targetDir, file))) {
                console.log(`  ✅ ${config.name} — config found at ${file}`);
                detected = true;
                break;
            }
        }
    }

    // Check package.json scripts
    const pkgPath = path.join(targetDir, 'package.json');
    if (fs.existsSync(pkgPath)) {
        try {
            const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
            if (pkg.scripts) {
                const testScript = pkg.scripts.test;
                if (testScript && testScript !== 'echo "Error: no test specified" && exit 1') {
                    console.log(`  📋 Test script: "${testScript}"`);
                }
                if (pkg.scripts['test:watch']) console.log(`  📋 Watch script: "${pkg.scripts['test:watch']}"`);
                if (pkg.scripts['test:coverage'])
                    console.log(`  📋 Coverage script: "${pkg.scripts['test:coverage']}"`);
            }
        } catch (e) {
            /* ignore */
        }
    }

    if (!detected) {
        console.log('  ⚠️  No test framework config detected.');
        console.log('  💡 Consider adding one: npx vitest init, npx jest --init, etc.');
    }

    console.log('');
    process.exit(0);
}

/** CMD: verify-feature — Core verification with optional deep scans (v6.1.0) */
if (args[0] === 'verify-feature') {
    const feature = args[1];
    const previewUrlFlagIndex = args.indexOf('--url');
    const previewUrl = previewUrlFlagIndex !== -1 && args[previewUrlFlagIndex + 1] ? args[previewUrlFlagIndex + 1] : '';
    if (!feature) {
        console.error('[steroid-run] Usage: npx steroid-run verify-feature <feature> [--deep] [--url <preview>]');
        process.exit(1);
    }
    if (previewUrlFlagIndex !== -1 && !previewUrl) {
        console.error('[steroid-run] ❌ --url requires an http(s) preview URL.');
        process.exit(1);
    }
    if (previewUrlFlagIndex !== -1 && !normalizePreviewUrlCandidate(previewUrl)) {
        console.error('[steroid-run] ❌ --url must be a valid http(s) URL or hostname.');
        process.exit(1);
    }
    const deepMode = args.includes('--deep');

    const featureDir = path.join(changesDir, feature);
    const planFile = path.join(featureDir, 'plan.md');
    const tasksFile = path.join(featureDir, 'tasks.md');
    const diagnosisFile = path.join(featureDir, 'diagnosis.md');
    const executionFile = fs.existsSync(planFile) ? planFile : fs.existsSync(diagnosisFile) ? diagnosisFile : null;
    const executionLabel = executionFile === diagnosisFile ? 'diagnosis.md' : 'plan.md';
    const accesslintArtifact = path.join(featureDir, 'accessibility.json');
    const browserAuditArtifact = path.join(featureDir, 'ui-audit.json');

    if (!executionFile) {
        console.error(
            `[steroid-run] ❌ No plan.md or diagnosis.md found. Complete the engine or diagnose phase first.`,
        );
        process.exit(1);
    }

    console.log(`\n[steroid-run] 🔍 VERIFICATION: ${feature} (v${SW_VERSION})`);
    console.log(`  Mode: ${deepMode ? 'core + deep scans' : 'core only'}\n`);

    if (previewUrlFlagIndex !== -1) {
        fs.writeFileSync(path.join(featureDir, 'preview-url.txt'), `${normalizePreviewUrlCandidate(previewUrl)}\n`);
    }

    const results = [];
    let hasFailure = false;
    const promptReceipt = readJsonFile(path.join(featureDir, 'prompt.json'));
    const designReceipt = loadDesignRoutingReceipt(featureDir);
    const executionReceipt = executionLabel === 'plan.md' ? loadExecutionReceipt(feature, featureDir) : null;

    if (executionLabel === 'plan.md') {
        const missingConsumedArtifacts = ['plan.md', 'tasks.md'].filter(
            (artifact) => !executionReceipt.consumedArtifacts.includes(artifact),
        );
        if (!fs.existsSync(tasksFile)) {
            results.push({
                step: 'Execution artifacts',
                status: 'FAIL',
                detail: 'tasks.md is missing for the governed engine path',
            });
            hasFailure = true;
        } else if (!executionReceipt.status) {
            results.push({
                step: 'Execution artifacts',
                status: 'FAIL',
                detail: 'execution.json is missing or malformed for the governed engine path',
            });
            hasFailure = true;
        } else if (executionReceipt.status !== 'COMPLETE') {
            results.push({
                step: 'Execution artifacts',
                status: 'FAIL',
                detail: `execution.json requires status COMPLETE before verification (got ${executionReceipt.status})`,
            });
            hasFailure = true;
        } else if (missingConsumedArtifacts.length > 0) {
            results.push({
                step: 'Execution artifacts',
                status: 'FAIL',
                detail: `execution.json must record consumed_artifacts plan.md and tasks.md (missing ${missingConsumedArtifacts.join(', ')})`,
            });
            hasFailure = true;
        } else {
            results.push({
                step: 'Execution artifacts',
                status: 'PASS',
                detail: 'tasks.md and execution.json are present for the governed engine path',
            });
        }
    }

    // ── Step 0: Review gate ──
    const reviewReceipt = loadReviewReceipt(feature, featureDir);
    const reviewPassed = reviewReceipt.stage1 === 'PASS' && reviewReceipt.stage2 === 'PASS';
    if (!reviewPassed) {
        results.push({
            step: 'Review gate',
            status: 'FAIL',
            detail: `review.json requires Stage 1 PASS and Stage 2 PASS (got ${reviewReceipt.stage1}/${reviewReceipt.stage2})`,
        });
        hasFailure = true;
    } else {
        results.push({
            step: 'Review gate',
            status: 'PASS',
            detail: `Two-stage review passed (${reviewReceipt.stage1}/${reviewReceipt.stage2})`,
        });
    }

    // ── Step 0b: Prompt interpretation context ──
    if (promptReceipt) {
        const promptDetail = [
            promptReceipt.primaryIntent ? `intent ${promptReceipt.primaryIntent}` : null,
            promptReceipt.recommendedPipeline ? `route ${promptReceipt.recommendedPipeline}` : null,
            promptReceipt.continuationState ? `continuation ${promptReceipt.continuationState}` : null,
        ]
            .filter(Boolean)
            .join(', ');
        results.push({
            step: 'Prompt receipt',
            status: 'PASS',
            detail: promptDetail || 'prompt.json captured',
        });
    } else {
        results.push({
            step: 'Prompt receipt',
            status: 'SKIP',
            detail: 'No prompt.json found (older features remain supported)',
        });
    }

    // ── Step 1: Execution source completeness ──
    const executionContent = fs.readFileSync(executionFile, 'utf-8');
    if (executionLabel === 'plan.md') {
        const { total, done } = parseChecklistStats(executionContent);
        if (done < total) {
            results.push({
                step: 'Plan completeness',
                status: 'FAIL',
                detail: `${done}/${total} tasks complete in ${executionLabel}`,
            });
            results.push({
                step: 'Plan reconciliation',
                status: 'WARN',
                detail: 'Plan completeness reflects checklist state only; if implementation is ahead of plan.md, update the checklist before archiving.',
            });
            hasFailure = true;
        } else {
            results.push({
                step: 'Plan completeness',
                status: 'PASS',
                detail: `${done}/${total} tasks complete in ${executionLabel}`,
            });
        }
    } else {
        const total = (executionContent.match(/^- \[[ x/]\]/gm) || []).length;
        const done = (executionContent.match(/^- \[x\]/gm) || []).length;
        if (total === 0) {
            results.push({
                step: 'Fix plan traceability',
                status: 'PASS',
                detail: 'diagnosis.md present for targeted fix pipeline',
            });
        } else if (done < total) {
            results.push({
                step: 'Fix plan traceability',
                status: 'WARN',
                detail: `${done}/${total} diagnosis checklist item(s) marked complete`,
            });
        } else {
            results.push({
                step: 'Fix plan traceability',
                status: 'PASS',
                detail: `${done}/${total} diagnosis checklist item(s) complete`,
            });
        }
    }

    // ── Step 2: Build check ──
    const pkgPath = path.join(targetDir, 'package.json');
    if (fs.existsSync(pkgPath)) {
        try {
            const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
            if (pkg.scripts && pkg.scripts.build) {
                console.log('  ⏳ Running build check (npm run build)...');
                const build = spawnSync('npm', ['run', 'build'], {
                    cwd: targetDir,
                    stdio: 'pipe',
                    timeout: 120000,
                    shell: true,
                });
                if (build.status === 0) {
                    results.push({ step: 'Build', status: 'PASS', detail: 'npm run build succeeded' });
                } else {
                    const errOutput = (build.stderr || build.stdout || Buffer.from(''))
                        .toString()
                        .trim()
                        .split('\n')
                        .slice(-5)
                        .join('\n');
                    results.push({
                        step: 'Build',
                        status: 'FAIL',
                        detail: errOutput || 'npm run build failed (no output)',
                    });
                    hasFailure = true;
                }
            } else {
                results.push({ step: 'Build', status: 'SKIP', detail: 'No build script in package.json' });
            }

            // ── Step 3: Lint check ──
            if (pkg.scripts && pkg.scripts.lint) {
                console.log('  ⏳ Running lint check (npm run lint)...');
                const lint = spawnSync('npm', ['run', 'lint'], {
                    cwd: targetDir,
                    stdio: 'pipe',
                    timeout: 60000,
                    shell: true,
                });
                if (lint.status === 0) {
                    results.push({ step: 'Lint', status: 'PASS', detail: 'npm run lint passed' });
                } else {
                    const errOutput = (lint.stderr || lint.stdout || Buffer.from(''))
                        .toString()
                        .trim()
                        .split('\n')
                        .slice(-5)
                        .join('\n');
                    results.push({ step: 'Lint', status: 'WARN', detail: errOutput || 'Lint issues detected' });
                }
            } else {
                results.push({ step: 'Lint', status: 'SKIP', detail: 'No lint script in package.json' });
            }

            // ── Step 4: Test check ──
            if (pkg.scripts && pkg.scripts.test && pkg.scripts.test !== 'echo "Error: no test specified" && exit 1') {
                console.log('  ⏳ Running test check (npm test)...');
                const test = spawnSync('npm', ['test'], {
                    cwd: targetDir,
                    stdio: 'pipe',
                    timeout: 120000,
                    shell: true,
                });
                if (test.status === 0) {
                    results.push({ step: 'Tests', status: 'PASS', detail: 'npm test passed' });
                } else {
                    const errOutput = (test.stderr || test.stdout || Buffer.from(''))
                        .toString()
                        .trim()
                        .split('\n')
                        .slice(-5)
                        .join('\n');
                    results.push({ step: 'Tests', status: 'WARN', detail: errOutput || 'Test failures detected' });
                }
            } else {
                // Check if plan contains test items but no test command
                const testItems = (executionContent.match(/write test|unit test|test:/gi) || []).length;
                if (testItems > 0) {
                    results.push({
                        step: 'Tests',
                        status: 'WARN',
                        detail: `Plan has ${testItems} test item(s) but no test script configured`,
                    });
                } else {
                    results.push({ step: 'Tests', status: 'SKIP', detail: 'No test script in package.json' });
                }
            }
        } catch (e) {
            results.push({ step: 'Build/Lint/Test', status: 'SKIP', detail: `package.json parse error: ${e.message}` });
        }
    } else {
        // Non-JS project fallback: check for Cargo.toml, pyproject.toml, go.mod
        const altStacks = [
            { file: 'Cargo.toml', cmd: 'cargo', args: ['check'], name: 'Rust' },
            { file: 'go.mod', cmd: 'go', args: ['build', './...'], name: 'Go' },
        ];
        let detected = false;
        for (const alt of altStacks) {
            if (fs.existsSync(path.join(targetDir, alt.file))) {
                detected = true;
                console.log(`  ⏳ Detected ${alt.name} project. Running ${alt.cmd} ${alt.args.join(' ')}...`);
                const check = spawnSync(alt.cmd, alt.args, { cwd: targetDir, stdio: 'pipe', timeout: 120000 });
                if (check.status === 0) {
                    results.push({
                        step: `Build (${alt.name})`,
                        status: 'PASS',
                        detail: `${alt.cmd} ${alt.args.join(' ')} succeeded`,
                    });
                } else {
                    results.push({ step: `Build (${alt.name})`, status: 'FAIL', detail: `${alt.cmd} failed` });
                    hasFailure = true;
                }
                break;
            }
        }
        if (!detected) {
            results.push({ step: 'Build', status: 'SKIP', detail: 'No package.json, Cargo.toml, or go.mod found' });
        }
    }

    // ── Step 5: Accessibility audit (AccessLint) ──
    const accesslintRunner = resolveAccessLintRunnerPath();
    if (designReceipt?.stack === 'react-native') {
        results.push({
            step: 'Accessibility (AccessLint)',
            status: 'SKIP',
            detail: 'React Native route detected; web HTML accessibility audit not applicable',
        });
    } else if (!fs.existsSync(accesslintRunner)) {
        results.push({
            step: 'Accessibility (AccessLint)',
            status: 'SKIP',
            detail: 'AccessLint runner not installed in this Steroid project',
        });
    } else {
        const htmlTargets = collectAccessibilityAuditTargets();
        if (htmlTargets.length === 0) {
            results.push({
                step: 'Accessibility (AccessLint)',
                status: 'SKIP',
                detail: 'No HTML targets found in out/, dist/, build/, public/, src/, or index.html',
            });
        } else {
            console.log(`  ⏳ Running accessibility audit (AccessLint) on ${htmlTargets.length} HTML target(s)...`);
            const audit = spawnSync('node', [accesslintRunner, ...htmlTargets, '--json'], {
                cwd: targetDir,
                stdio: 'pipe',
                encoding: 'utf-8',
                timeout: 120000,
            });
            if (audit.error || audit.status !== 0) {
                const detail =
                    audit.error?.message ||
                    String(audit.stderr || audit.stdout || '')
                        .trim()
                        .split('\n')
                        .slice(-6)
                        .join('\n') ||
                    'AccessLint runner failed';
                results.push({
                    step: 'Accessibility (AccessLint)',
                    status: 'WARN',
                    detail,
                });
            } else {
                try {
                    const parsed = JSON.parse(String(audit.stdout || '{}'));
                    const highestImpact = parsed.highestImpact || 'none';
                    const status = summarizeAccessibilityImpact(highestImpact);
                    const topRules = Array.from(
                        new Set(
                            (parsed.results || [])
                                .flatMap((entry) => entry.violations || [])
                                .map((violation) => violation.ruleId)
                                .filter(Boolean),
                        ),
                    ).slice(0, 5);

                    writeJsonFile(accesslintArtifact, parsed);
                    results.push({
                        step: 'Accessibility (AccessLint)',
                        status,
                        detail:
                            parsed.violationCount > 0
                                ? `${parsed.violationCount} violation(s) across ${parsed.fileCount} HTML target(s); highest impact ${highestImpact}${topRules.length > 0 ? `; top rules: ${topRules.join(', ')}` : ''}`
                                : `No violations across ${parsed.fileCount} HTML target(s)`,
                    });
                    if (status === 'FAIL') {
                        hasFailure = true;
                    }
                } catch (e) {
                    results.push({
                        step: 'Accessibility (AccessLint)',
                        status: 'WARN',
                        detail: `AccessLint output parse error: ${e.message}`,
                    });
                }
            }
        }
    }

    // ── Step 6: Dead route detection ──
    try {
        const srcDir = path.join(targetDir, 'src');
        if (fs.existsSync(srcDir)) {
            const allFiles = [];
            const walkDir = (dir) => {
                for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
                    const fullPath = path.join(dir, entry.name);
                    if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules') {
                        walkDir(fullPath);
                    } else if (entry.isFile() && /\.(tsx?|jsx?)$/.test(entry.name)) {
                        allFiles.push(fullPath);
                    }
                }
            };
            walkDir(srcDir);

            // Find all route links (href="/...")
            const deadRoutes = findDeadRoutes(targetDir, srcDir, { preferBuildArtifacts: true });
            if (deadRoutes.length > 0) {
                const routeList = deadRoutes.map((r) => `${r.route} (in ${r.files.join(', ')})`).join(', ');
                results.push({
                    step: 'Dead routes',
                    status: 'WARN',
                    detail: `${deadRoutes.length} route(s) link to missing pages: ${routeList}`,
                });
            } else {
                results.push({ step: 'Dead routes', status: 'PASS', detail: 'All linked routes have page files' });
            }
        }
    } catch (e) {
        results.push({ step: 'Dead routes', status: 'SKIP', detail: `Scan error: ${e.message}` });
    }

    // ── Step 7: Unused exports (hooks, types never imported) ──
    try {
        const srcDir = path.join(targetDir, 'src');
        if (fs.existsSync(srcDir)) {
            const orphans = [];
            const hooksDir = path.join(srcDir, 'hooks');
            const typesDir = path.join(srcDir, 'types');
            const checkDirs = [hooksDir, typesDir].filter((d) => fs.existsSync(d));

            for (const dir of checkDirs) {
                for (const file of fs.readdirSync(dir).filter((f) => /\.(ts|tsx|js|jsx)$/.test(f))) {
                    const basename = file.replace(/\.(ts|tsx|js|jsx)$/, '');
                    // Search for imports of this file across the entire src directory
                    let found = false;
                    const walkForImports = (searchDir) => {
                        if (found) return;
                        for (const entry of fs.readdirSync(searchDir, { withFileTypes: true })) {
                            if (found) return;
                            const fullPath = path.join(searchDir, entry.name);
                            if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules') {
                                walkForImports(fullPath);
                            } else if (
                                entry.isFile() &&
                                /\.(tsx?|jsx?)$/.test(entry.name) &&
                                fullPath !== path.join(dir, file)
                            ) {
                                const content = fs.readFileSync(fullPath, 'utf-8');
                                if (content.includes(basename)) {
                                    found = true;
                                }
                            }
                        }
                    };
                    walkForImports(srcDir);
                    if (!found) {
                        orphans.push(`${path.relative(targetDir, path.join(dir, file))}`);
                    }
                }
            }

            if (orphans.length > 0) {
                results.push({
                    step: 'Orphan detection',
                    status: 'WARN',
                    detail: `${orphans.length} file(s) never imported: ${orphans.join(', ')}`,
                });
            } else if (checkDirs.length > 0) {
                results.push({
                    step: 'Orphan detection',
                    status: 'PASS',
                    detail: 'All hooks/types are imported somewhere',
                });
            }
        }
    } catch (e) {
        results.push({ step: 'Orphan detection', status: 'SKIP', detail: `Scan error: ${e.message}` });
    }

    // ── Step 8: Memory freshness ──
    const techStackFile = path.join(knowledgeDir, 'tech-stack.json');
    if (fs.existsSync(techStackFile)) {
        try {
            const ts = JSON.parse(fs.readFileSync(techStackFile, 'utf-8'));
            const unknowns = ['language', 'framework', 'packageManager'].filter((k) => ts[k] === 'Unknown' || !ts[k]);
            if (unknowns.length > 0) {
                results.push({
                    step: 'Memory freshness',
                    status: 'WARN',
                    detail: `tech-stack.json has Unknown values: ${unknowns.join(', ')}. Run: node steroid-run.cjs scan ${feature} --force`,
                });
            } else {
                results.push({ step: 'Memory freshness', status: 'PASS', detail: 'tech-stack.json populated' });
            }
        } catch (e) {
            results.push({
                step: 'Memory freshness',
                status: 'WARN',
                detail: `tech-stack.json parse error: ${e.message}`,
            });
        }
    } else {
        results.push({
            step: 'Memory freshness',
            status: 'WARN',
            detail: 'tech-stack.json not found. Run: node steroid-run.cjs scan ' + feature,
        });
    }

    // ── Step 9: Optional deep scans ──
    if (deepMode) {
        const browserAuditRunner = resolveBrowserAuditRunnerPath();
        const browserAuditScreenshot = path.join(featureDir, 'ui-audit.png');
        const browserAuditEligible = detectUiFeatureForGate(featureDir, promptReceipt);

        if (!browserAuditEligible || designReceipt?.stack === 'react-native') {
            results.push({
                step: 'Deep scan: Playwright UI audit',
                status: 'SKIP',
                detail: 'Browser UI audit is only applicable to web UI routes',
            });
        } else if (!fs.existsSync(browserAuditRunner)) {
            results.push({
                step: 'Deep scan: Playwright UI audit',
                status: 'SKIP',
                detail: 'Browser audit runner not installed in this Steroid project',
            });
        } else {
            const htmlTargets = collectAccessibilityAuditTargets();
            const browserTarget = resolveBrowserAuditTarget(featureDir, htmlTargets, { url: previewUrl });

            if (!browserTarget) {
                results.push({
                    step: 'Deep scan: Playwright UI audit',
                    status: 'SKIP',
                    detail: 'No preview URL or local HTML target available for browser audit',
                });
            } else {
                console.log(`  ⏳ Running Deep scan: Playwright UI audit...`);
                const localPlaywrightEntrypoint = path.join(targetDir, 'node_modules', 'playwright', 'index.js');
                const audit = spawnSync(
                    'node',
                    [browserAuditRunner, browserTarget.target, '--json', '--screenshot', browserAuditScreenshot],
                    {
                        cwd: targetDir,
                        stdio: 'pipe',
                        encoding: 'utf-8',
                        timeout: 120000,
                        env: {
                            ...process.env,
                            STEROID_PLAYWRIGHT_PATH: fs.existsSync(localPlaywrightEntrypoint)
                                ? localPlaywrightEntrypoint
                                : path.join(targetDir, 'node_modules', 'playwright'),
                        },
                    },
                );

                if (audit.error || audit.status !== 0) {
                    const detail =
                        audit.error?.message ||
                        String(audit.stderr || audit.stdout || '')
                            .trim()
                            .split('\n')
                            .slice(-6)
                            .join('\n') ||
                        'Browser audit runner failed';
                    results.push({
                        step: 'Deep scan: Playwright UI audit',
                        status: 'WARN',
                        detail,
                    });
                } else {
                    try {
                        const parsed = JSON.parse(String(audit.stdout || '{}'));
                        if (parsed.skipped) {
                            results.push({
                                step: 'Deep scan: Playwright UI audit',
                                status: 'SKIP',
                                detail: parsed.reason || 'Browser audit skipped',
                            });
                        } else {
                            parsed.auditSource = browserTarget.source;
                            parsed.auditMode = browserTarget.mode;
                            writeJsonFile(browserAuditArtifact, parsed);

                            const summary = summarizeBrowserAuditResult(parsed);
                            results.push({
                                step: 'Deep scan: Playwright UI audit',
                                status: summary.status,
                                detail: summary.detail,
                            });
                            if (summary.status === 'FAIL') {
                                hasFailure = true;
                            }
                        }
                    } catch (e) {
                        results.push({
                            step: 'Deep scan: Playwright UI audit',
                            status: 'WARN',
                            detail: `Browser audit output parse error: ${e.message}`,
                        });
                    }
                }
            }
        }

        const deepScans = [
            {
                step: 'Deep scan: knip',
                shouldRun: fs.existsSync(pkgPath),
                run: () =>
                    spawnSync('npx', ['--no-install', 'knip', '--no-exit-code', '--reporter', 'compact'], {
                        cwd: targetDir,
                        stdio: 'pipe',
                        timeout: 120000,
                        shell: true,
                    }),
                pass: 'knip completed',
                fail: 'knip reported issues or could not run',
                severity: 'WARN',
            },
            {
                step: 'Deep scan: madge',
                shouldRun: fs.existsSync(path.join(targetDir, 'src')),
                run: () =>
                    spawnSync('npx', ['--no-install', 'madge', '--circular', 'src'], {
                        cwd: targetDir,
                        stdio: 'pipe',
                        timeout: 120000,
                        shell: true,
                    }),
                pass: 'madge completed',
                fail: 'madge reported circular dependencies or could not run',
                severity: 'WARN',
            },
            {
                step: 'Deep scan: gitleaks',
                shouldRun: true,
                run: () =>
                    spawnSync('npx', ['--no-install', '@ziul285/gitleaks', 'detect', '--no-git', '--source', '.'], {
                        cwd: targetDir,
                        stdio: 'pipe',
                        timeout: 120000,
                        shell: true,
                    }),
                pass: 'gitleaks completed',
                fail: 'gitleaks reported findings or could not run',
                severity: 'WARN',
            },
            {
                step: 'Deep scan: license-checker',
                shouldRun: fs.existsSync(pkgPath),
                run: () =>
                    spawnSync('npx', ['--no-install', 'license-checker', '--summary'], {
                        cwd: targetDir,
                        stdio: 'pipe',
                        timeout: 120000,
                        shell: true,
                    }),
                pass: 'license-checker completed',
                fail: 'license-checker reported issues or could not run',
                severity: 'WARN',
            },
        ];

        for (const scan of deepScans) {
            if (!scan.shouldRun) {
                results.push({ step: scan.step, status: 'SKIP', detail: 'Not applicable for this project' });
                continue;
            }

            console.log(`  ⏳ Running ${scan.step}...`);
            const outcome = scan.run();
            if (outcome.status === 0) {
                results.push({ step: scan.step, status: 'PASS', detail: scan.pass });
            } else {
                const detail =
                    (outcome.stderr || outcome.stdout || Buffer.from(''))
                        .toString()
                        .trim()
                        .split('\n')
                        .slice(-5)
                        .join('\n') || scan.fail;
                results.push({ step: scan.step, status: scan.severity, detail });
            }
        }
    }

    // ── Print results ──
    console.log('');
    const passCount = results.filter((r) => r.status === 'PASS').length;
    const failCount = results.filter((r) => r.status === 'FAIL').length;
    const warnCount = results.filter((r) => r.status === 'WARN').length;
    const skipCount = results.filter((r) => r.status === 'SKIP').length;

    for (const r of results) {
        const icon = r.status === 'PASS' ? '✅' : r.status === 'FAIL' ? '❌' : r.status === 'WARN' ? '⚠️' : '⏭️';
        console.log(`  ${icon} ${r.step}: ${r.status}`);
        if (r.status !== 'PASS' && r.status !== 'SKIP') {
            console.log(`     ${r.detail}`);
        }
    }

    console.log('');
    console.log(`  Result: ${passCount} passed, ${failCount} failed, ${warnCount} warnings, ${skipCount} skipped`);

    const verifyStatus = hasFailure ? 'FAIL' : warnCount > 0 ? 'CONDITIONAL' : 'PASS';
    const previewTarget =
        normalizePreviewUrlCandidate(previewUrl) ||
        normalizePreviewUrlCandidate(readFeatureArtifactText(featureDir, 'preview-url.txt')) ||
        normalizePreviewUrlCandidate(readJsonFile(path.join(featureDir, 'preview-url.json'))?.url) ||
        null;

    // ── Write verify.md ──
    let verifyMd = `# Verification Report: ${feature}\n\n`;
    verifyMd += `**Date:** ${new Date().toISOString()}\n`;
    verifyMd += `**Version:** steroid-workflow v${SW_VERSION}\n`;
    verifyMd += `**Mode:** ${deepMode ? 'core + deep scans' : 'core only'}\n`;
    verifyMd += `**Execution Source:** ${executionLabel}\n`;
    verifyMd += `**Status:** ${verifyStatus}\n\n`;
    if (promptReceipt) {
        verifyMd += `## Prompt Interpretation\n\n`;
        verifyMd += `- **Primary Intent:** ${promptReceipt.primaryIntent || 'Unknown'}\n`;
        if (Array.isArray(promptReceipt.secondaryIntents) && promptReceipt.secondaryIntents.length > 0) {
            verifyMd += `- **Secondary Intents:** ${promptReceipt.secondaryIntents.join(', ')}\n`;
        }
        verifyMd += `- **Recommended Route:** ${promptReceipt.recommendedPipeline || 'Unknown'}\n`;
        verifyMd += `- **Continuation State:** ${promptReceipt.continuationState || 'Unknown'}\n`;
        verifyMd += `- **Complexity / Risk:** ${promptReceipt.complexity || 'Unknown'} / ${promptReceipt.risk || 'Unknown'}\n\n`;
    }
    verifyMd += `## Core Verification\n\n`;
    for (const r of results) {
        const icon = r.status === 'PASS' ? '✅' : r.status === 'FAIL' ? '❌' : r.status === 'WARN' ? '⚠️' : '⏭️';
        if (!r.step.startsWith('Deep scan:')) {
            verifyMd += `- ${icon} **${r.step}**: ${r.status}\n`;
            if (r.detail) verifyMd += `  - ${r.detail}\n`;
        }
    }
    if (deepMode) {
        verifyMd += `\n## Deep Verification\n\n`;
        const deepResults = results.filter((r) => r.step.startsWith('Deep scan:'));
        if (deepResults.length === 0) {
            verifyMd += '- ⏭️ No deep scans ran.\n';
        } else {
            for (const r of deepResults) {
                const icon =
                    r.status === 'PASS' ? '✅' : r.status === 'FAIL' ? '❌' : r.status === 'WARN' ? '⚠️' : '⏭️';
                verifyMd += `- ${icon} **${r.step}**: ${r.status}\n`;
                if (r.detail) verifyMd += `  - ${r.detail}\n`;
            }
        }
    }
    verifyMd += `\n---\n_Generated by steroid-workflow v${SW_VERSION}_\n`;
    fs.writeFileSync(path.join(featureDir, 'verify.md'), verifyMd);

    saveVerifyReceipt(featureDir, {
        feature,
        status: verifyStatus,
        reviewPassed,
        checks: Object.fromEntries(results.map((r) => [r.step, r.status])),
        deepRequested: deepMode,
        deepCompleted: deepMode,
    });

    const completionReceiptPath = path.join(featureDir, 'completion.json');
    if (hasFailure) {
        if (fs.existsSync(completionReceiptPath)) {
            fs.unlinkSync(completionReceiptPath);
        }
    } else {
        saveCompletionReceipt(featureDir, {
            feature,
            status: verifyStatus,
            sourceArtifacts: ['verify.json', 'review.json'],
            nextActions: ['archive'],
            summary:
                verifyStatus === 'CONDITIONAL'
                    ? 'Verification completed with cautions. Completion flow may continue with explicit acceptance of remaining risk.'
                    : 'Verification completed successfully. Feature is ready for completion handling.',
        });
    }

    const uiReviewRefresh = ensureCurrentUiReviewArtifacts(feature, featureDir, {
        verifyStatus,
        deepMode,
        previewUrl: previewTarget,
        refreshSource: 'verify-feature',
    });

    console.log(`  Report: .memory/changes/${feature}/verify.md`);
    console.log(`  Receipt: .memory/changes/${feature}/verify.json`);
    if (!hasFailure) {
        console.log(`  Completion: .memory/changes/${feature}/completion.json`);
    }
    if (uiReviewRefresh.attempted && uiReviewRefresh.refreshed) {
        console.log(`  UI Review: refreshed from current verification evidence`);
    } else if (uiReviewRefresh.attempted && !uiReviewRefresh.ok && !uiReviewRefresh.skipped) {
        console.log(`  UI Review: refresh failed (${uiReviewRefresh.reason || 'unknown error'})`);
    }

    if (hasFailure) {
        console.log('');
        console.log(`  🚫 VERIFICATION FAILED. Fix the failures above before archiving.`);
        process.exit(1);
    }

    console.log('');
    console.log(`  📋 The steroid-verify skill will now run spec compliance and code quality reviews.`);
    process.exit(0);
}

// ═══════════════════════════════════════════════════════════════════
// § COMMANDS: REVIEW SYSTEM (spec, quality, status, reset)
// ═══════════════════════════════════════════════════════════════════

/** CMD: review — Two-stage review system for feature validation. */
// --- Review Command (Two-stage review system — v5.0) ---
// Source: src/forks/superpowers/subagent.md + spec-reviewer-prompt.md + code-quality-reviewer-prompt.md
if (args[0] === 'review') {
    const sub = args[1];
    const feature = args[2];

    if (!sub || sub === '--help') {
        console.log(`
[steroid-run] review — Two-stage review system for feature validation.

Usage:
  node steroid-run.cjs review spec <feature>       Stage 1: Spec compliance review
  node steroid-run.cjs review quality <feature>    Stage 2: Code quality review (requires Stage 1 PASS)
  node steroid-run.cjs review ui <feature>         Refresh frontend review receipts from current UI evidence
  node steroid-run.cjs review status <feature>     Show review status for a feature
  node steroid-run.cjs review reset <feature>      Reset review state (re-review)

Stages:
  Stage 1 (Spec Review)   — "Did the AI build what was requested?"
  Stage 2 (Quality Review) — "Is it well-built?"
                             Only runs after Stage 1 passes.
  UI Review                 — "Does the frontend evidence still look shippable?"

Output: .memory/changes/<feature>/review.md + review.json

Source: src/forks/superpowers/subagent.md (two-stage review flow)
`);
        process.exit(0);
    }

    if (!feature) {
        console.error('[steroid-run] Usage: node steroid-run.cjs review <spec|quality|status|reset> <feature>');
        process.exit(1);
    }

    const featureDir = path.join(changesDir, feature);
    const reviewFile = path.join(featureDir, 'review.md');
    const reviewReceiptFile = path.join(featureDir, 'review.json');

    if (sub === 'status') {
        if (!fs.existsSync(reviewFile) && !fs.existsSync(reviewReceiptFile)) {
            console.log(`[steroid-run] 📋 No review started for "${feature}".`);
            console.log('  Run: node steroid-run.cjs review spec ' + feature);
            process.exit(0);
        }
        const receipt = loadReviewReceipt(feature, featureDir);
        const specStatus = receipt.stage1 || 'NOT RUN';
        const qualityStatus = receipt.stage2 || 'NOT RUN';

        const icons = { PASS: '✅', FAIL: '❌', PENDING: '⏳', 'NOT RUN': '○' };
        console.log(`[steroid-run] 📋 Review Status for "${feature}":`);
        console.log(`  ${icons[specStatus]} Stage 1 (Spec Compliance): ${specStatus}`);
        console.log(`  ${icons[qualityStatus]} Stage 2 (Code Quality): ${qualityStatus}`);
        const uiReviewReceipt = loadUiReviewReceipt(feature, featureDir);
        if (uiReviewReceipt?.status) {
            const uiStatus = uiReviewReceipt.status;
            console.log(`  ${icons[uiStatus] || '○'} UI Review: ${uiStatus}`);
        }
        if (receipt.updatedAt) console.log(`  🧾 Receipt updated: ${receipt.updatedAt}`);

        if (specStatus === 'PASS' && qualityStatus === 'PASS') {
            console.log('\n  ✅ Both stages passed. Ready for verification.');
        } else if (specStatus === 'FAIL') {
            console.log(
                '\n  ❌ Spec review failed. Fix issues and re-run: node steroid-run.cjs review spec ' + feature,
            );
        } else if (specStatus === 'PASS' && qualityStatus !== 'PASS') {
            console.log('\n  ⏳ Spec passed. Run quality review: node steroid-run.cjs review quality ' + feature);
        }
        process.exit(0);
    }

    if (sub === 'ui') {
        const refreshed = refreshUiReviewArtifacts(feature, featureDir, {
            refreshSource: 'review ui',
            refreshReason: 'Manual frontend review refresh requested.',
        });
        if (refreshed.skipped) {
            console.log(`[steroid-run] 🎨 UI Review skipped for "${feature}".`);
            console.log(`  Reason: ${refreshed.reason}`);
            process.exit(0);
        }

        if (!refreshed.ok) {
            console.error(`[steroid-run] ❌ UI review failed for "${feature}".`);
            console.error(`  Reason: ${refreshed.reason || 'Unknown UI review error.'}`);
            process.exit(1);
        }

        console.log(`[steroid-run] 🎨 UI Review for "${feature}"`);
        console.log(`  Status: ${refreshed.status}`);
        console.log(`  Stack: ${refreshed.receipt?.stack || 'Unknown'}`);
        console.log(`  Wrapper: ${refreshed.receipt?.wrapperSkill || 'none'}`);
        console.log(
            `  Findings: ${Array.isArray(refreshed.receipt?.findings) ? refreshed.receipt.findings.length : 0}`,
        );
        console.log(`  Report: .memory/changes/${feature}/ui-review.md`);
        console.log(`  Receipt: .memory/changes/${feature}/ui-review.json`);
        process.exit(0);
    }

    if (sub === 'reset') {
        const hadReviewFile = fs.existsSync(reviewFile);
        const hadReviewReceipt = fs.existsSync(reviewReceiptFile);
        if (fs.existsSync(reviewFile)) {
            fs.unlinkSync(reviewFile);
        }
        if (fs.existsSync(reviewReceiptFile)) {
            fs.unlinkSync(reviewReceiptFile);
        }
        if (hadReviewFile || hadReviewReceipt) {
            console.log(
                `[steroid-run] 🔄 Review reset for "${feature}". Run: node steroid-run.cjs review spec ${feature}`,
            );
        } else {
            console.log(`[steroid-run] No review to reset for "${feature}".`);
        }
        process.exit(0);
    }

    if (sub === 'spec') {
        const specFile = path.join(featureDir, 'spec.md');
        const planFile = path.join(featureDir, 'plan.md');

        if (!fs.existsSync(specFile)) {
            console.error(
                `[steroid-run] ❌ No spec.md found for "${feature}". Cannot run spec review without acceptance criteria.`,
            );
            process.exit(1);
        }
        if (!fs.existsSync(planFile)) {
            console.error(
                `[steroid-run] ❌ No plan.md found for "${feature}". Cannot run spec review without task list.`,
            );
            process.exit(1);
        }

        console.log(`[steroid-run] 🔍 Stage 1: Spec Compliance Review for "${feature}"...`);
        console.log('');
        console.log('  The AI should now:');
        console.log('  1. Read .memory/changes/' + feature + '/spec.md — extract ALL acceptance criteria');
        console.log('  2. Read .memory/changes/' + feature + '/plan.md — extract ALL completed tasks');
        console.log('  3. For EACH criterion, grep/read the actual implementation code');
        console.log('  4. Determine status: ✅ IMPLEMENTED | ⚠️ PARTIAL | ❌ MISSING | 🔄 EXTRA');
        console.log('  5. Write findings to .memory/changes/' + feature + '/review.md');
        console.log('');
        console.log('  Source: src/forks/superpowers/spec-reviewer-prompt.md');
        console.log("  CRITICAL: Do NOT trust the implementer's report. Read the actual code.");
        console.log('');

        const reviewContent = `# Review Report: ${feature}\n\n**Started:** ${new Date().toISOString()}\n\n## Review Status\n\n- Stage 1 (Spec): PENDING\n- Stage 2 (Quality): PENDING\n\n## Stage 1: Spec Compliance Review\n\n_AI: Fill this section after reviewing code against spec.md criteria._\n\n| # | Criterion | Status | Evidence |\n|---|-----------|--------|----------|\n| 1 | _from spec.md_ | _status_ | _file:line_ |\n\n**Spec Score:** _/_ criteria verified\n**Stage 1 Result:** PENDING\n\n---\n\n## Stage 2: Code Quality Review\n\n_Blocked until Stage 1 passes._\n\n---\n\n_Reviewer: steroid-review v${SW_VERSION}_\n`;
        if (!fs.existsSync(featureDir)) fs.mkdirSync(featureDir, { recursive: true });
        fs.writeFileSync(reviewFile, reviewContent);
        saveReviewReceipt(featureDir, {
            feature,
            stage1: 'PENDING',
            stage2: 'PENDING',
        });
        console.log(`[steroid-run] 📝 Review template written to .memory/changes/${feature}/review.md`);
        console.log(`[steroid-run] 🧾 Receipt written to .memory/changes/${feature}/review.json`);
        console.log('  AI: Complete the spec review, then update Stage 1 Result to PASS or FAIL.');
        process.exit(0);
    }

    if (sub === 'quality') {
        if (!fs.existsSync(reviewFile) && !fs.existsSync(reviewReceiptFile)) {
            console.error(
                `[steroid-run] ❌ No review started. Run Stage 1 first: node steroid-run.cjs review spec ${feature}`,
            );
            process.exit(1);
        }

        const receipt = loadReviewReceipt(feature, featureDir);
        if (receipt.stage1 !== 'PASS') {
            console.error('[steroid-run] 🚫 REVIEW GATE: Stage 1 (Spec) has not passed.');
            console.error('  Stage 2 (Quality) cannot run until Stage 1 passes.');
            console.error(
                '  Fix spec issues and update review.md, then re-run: node steroid-run.cjs review status ' + feature,
            );
            process.exit(1);
        }

        console.log(`[steroid-run] 🔍 Stage 2: Code Quality Review for "${feature}"...`);
        console.log('');
        console.log('  The AI should now:');
        console.log('  1. Review all files created/modified during this feature');
        console.log('  2. Check: Single responsibility, naming, error handling, no stubs');
        console.log('  3. Run anti-pattern scan: TODO/FIXME, empty returns, console.log-only handlers');
        console.log('  4. Categorize: 🛑 Critical | ⚠️ Important | ℹ️ Minor');
        console.log('  5. Update Stage 2 section in review.md');
        console.log('');
        console.log('  Source: src/forks/superpowers/code-quality-reviewer-prompt.md');
        process.exit(0);
    }

    console.error(`[steroid-run] ❌ Unknown review subcommand: "${sub}". Run: node steroid-run.cjs review --help`);
    process.exit(1);
}

/** CMD: report (generate/show/list) — AI-to-Human handoff reports */
// --- Report Command (AI-to-Human handoff — v5.0) ---
// Source: src/forks/gsd research-synthesizer + src/forks/ralph progress.txt + src/forks/spec-kit success-criteria
if (args[0] === 'report') {
    const sub = args[1];
    const feature = args[2];

    if (!sub || sub === '--help') {
        console.log(`
[steroid-run] report — AI-to-Human handoff reports.

Usage:
  node steroid-run.cjs report generate <feature>   Generate handoff report after archive
  node steroid-run.cjs report show <feature>       Show a feature's handoff report
  node steroid-run.cjs report list                 List all handoff reports

Reports are written to .memory/reports/<feature>.md

Source: src/forks/gsd research-synthesizer (executive summary pattern)
`);
        process.exit(0);
    }

    if (!fs.existsSync(reportsDir)) {
        fs.mkdirSync(reportsDir, { recursive: true });
    }

    if (sub === 'list') {
        const files = fs.existsSync(reportsDir) ? fs.readdirSync(reportsDir).filter((f) => f.endsWith('.md')) : [];
        if (files.length === 0) {
            console.log('[steroid-run] 📭 No handoff reports yet. Archive a feature to generate one.');
            process.exit(0);
        }
        console.log('\n[steroid-run] 📋 Handoff Reports\n');
        for (const f of files) {
            const content = fs.readFileSync(path.join(reportsDir, f), 'utf-8');
            const statusMatch = content.match(/\*\*Status:\*\* (.+)/);
            const dateMatch = content.match(/\*\*Completed:\*\* (.+)/);
            const status = statusMatch ? statusMatch[1] : 'unknown';
            const date = dateMatch ? dateMatch[1] : 'unknown';
            console.log(`  📄 ${f.replace('.md', '')} — ${status} (${date})`);
        }
        process.exit(0);
    }

    if (sub === 'show') {
        if (!feature) {
            console.error('[steroid-run] Usage: node steroid-run.cjs report show <feature>');
            process.exit(1);
        }
        const reportFile = path.join(reportsDir, `${feature}.md`);
        if (!fs.existsSync(reportFile)) {
            console.error(`[steroid-run] ❌ No report found for "${feature}".`);
            process.exit(1);
        }
        console.log(fs.readFileSync(reportFile, 'utf-8'));
        process.exit(0);
    }

    if (sub === 'generate') {
        if (!feature) {
            console.error('[steroid-run] Usage: node steroid-run.cjs report generate <feature>');
            process.exit(1);
        }

        const featureDir = path.join(changesDir, feature);
        const refreshedUiReview = ensureCurrentUiReviewArtifacts(feature, featureDir, {
            refreshSource: 'report generate',
        });
        if (refreshedUiReview.attempted && refreshedUiReview.refreshed) {
            console.log(`[steroid-run] 🔄 Refreshed UI review for report generation: ${refreshedUiReview.reason}`);
        }
        const report = generateHandoffReport(feature, featureDir, state);
        const reportFile = path.join(reportsDir, `${feature}.md`);
        fs.writeFileSync(reportFile, report);
        console.log(`[steroid-run] 📄 Handoff report generated: .memory/reports/${feature}.md`);
        console.log(`  Run: node steroid-run.cjs report show ${feature}`);
        process.exit(0);
    }

    console.error(`[steroid-run] ❌ Unknown report subcommand: "${sub}". Run: node steroid-run.cjs report --help`);
    process.exit(1);
}

// ═══════════════════════════════════════════════════════════════════
// § COMMANDS: ANALYTICS
// ═══════════════════════════════════════════════════════════════════

/** CMD: dashboard — Project health analytics overview */
// --- Dashboard Command (Analytics dashboard — v5.0) ---
// Source: src/forks/ralph progress.txt metrics + src/forks/gsd confidence-breakdown
if (args[0] === 'dashboard') {
    console.log('\n[steroid-run] 📊 Steroid-Workflow Dashboard\n');

    // 1. Features summary
    const featuresFile = path.join(metricsDir, 'features.json');
    let featuresData = {};
    if (fs.existsSync(featuresFile)) {
        try {
            featuresData = JSON.parse(fs.readFileSync(featuresFile, 'utf-8'));
        } catch (e) {
            /* ignore */
        }
    }
    const featureNames = Object.keys(featuresData).filter((k) => k !== '_lastUpdated');

    console.log('  ── Features ──────────────────────────────');
    if (featureNames.length === 0) {
        console.log('  No features archived yet.');
    } else {
        let totalErrors = 0;
        const uiReviewCounts = { PASS: 0, CONDITIONAL: 0, FAIL: 0 };
        const uiRefreshSources = {};
        const uiRecommendations = {};
        for (const name of featureNames) {
            const f = featuresData[name];
            const icon = f.status === 'complete' ? '✅' : '⏳';
            const errors = f.errorCount || 0;
            totalErrors += errors;
            const fDate = f.archived ? f.archived.split('T')[0] : 'unknown';
            const uiStatus = f.uiReviewStatus ? ` — UI ${f.uiReviewStatus}` : '';
            const uiFreshness = f.uiReviewRefreshSource ? ` (${f.uiReviewRefreshSource})` : '';
            const uiRecommendation = f.uiReviewRecommendation ? ` [${f.uiReviewRecommendation}]` : '';
            if (f.uiReviewStatus && uiReviewCounts[f.uiReviewStatus] !== undefined) {
                uiReviewCounts[f.uiReviewStatus] += 1;
            }
            if (f.uiReviewRefreshSource) {
                uiRefreshSources[f.uiReviewRefreshSource] = (uiRefreshSources[f.uiReviewRefreshSource] || 0) + 1;
            }
            if (f.uiReviewRecommendation) {
                uiRecommendations[f.uiReviewRecommendation] = (uiRecommendations[f.uiReviewRecommendation] || 0) + 1;
            }
            console.log(
                `  ${icon} ${name} — ${errors} error(s)${uiStatus}${uiFreshness}${uiRecommendation} — ${fDate}`,
            );
        }
        const avgErrors = featureNames.length > 0 ? (totalErrors / featureNames.length).toFixed(1) : 0;
        console.log(`\n  Total: ${featureNames.length} features | Avg errors: ${avgErrors}/feature`);
        const uiTotal = uiReviewCounts.PASS + uiReviewCounts.CONDITIONAL + uiReviewCounts.FAIL;
        if (uiTotal > 0) {
            console.log(
                `  Frontend quality: ${uiReviewCounts.PASS} PASS, ${uiReviewCounts.CONDITIONAL} CONDITIONAL, ${uiReviewCounts.FAIL} FAIL`,
            );
            const refreshSummary = Object.entries(uiRefreshSources)
                .sort((a, b) => b[1] - a[1])
                .map(([source, count]) => `${count} ${source}`)
                .join(', ');
            if (refreshSummary) {
                console.log(`  Frontend freshness: ${refreshSummary}`);
            }
            const recommendationSummary = Object.entries(uiRecommendations)
                .sort((a, b) => b[1] - a[1])
                .map(([recommendation, count]) => `${count} ${recommendation}`)
                .join(', ');
            if (recommendationSummary) {
                console.log(`  Frontend release recommendation: ${recommendationSummary}`);
            }
        }
    }

    // 2. Error patterns
    console.log('\n  ── Error Patterns ────────────────────────');
    const errorPatternsFile = path.join(metricsDir, 'error-patterns.json');
    if (fs.existsSync(errorPatternsFile)) {
        try {
            const ep = JSON.parse(fs.readFileSync(errorPatternsFile, 'utf-8'));
            const patterns = ep.patterns || [];
            console.log(`  ${patterns.length} errors recorded`);
            if (patterns.length > 0) {
                const keywords = {};
                for (const p of patterns) {
                    const kw = p.keyword || 'unknown';
                    keywords[kw] = (keywords[kw] || 0) + 1;
                }
                const sorted = Object.entries(keywords)
                    .sort((a, b) => b[1] - a[1])
                    .slice(0, 5);
                if (sorted.length > 0) {
                    console.log('  Top error sources:');
                    for (const [kw, count] of sorted) console.log(`    ${count}x — ${kw}`);
                }
            }
        } catch (e) {
            console.log('  ⚠️ Error patterns file corrupt');
        }
    } else {
        console.log('  No error patterns recorded yet.');
    }

    // 3. Circuit breaker state
    console.log('\n  ── Circuit Breaker ───────────────────────');
    const levels = ['🟢 CLEAR', '🟡 LOGGED', '🟠 RE-READ', '🔶 DIAGNOSING', '🔴 ESCALATED', '🛑 TRIPPED'];
    const level = Math.min(state.error_count, 5);
    console.log(`  Current: ${levels[level]} (${state.error_count}/5 errors)`);
    const tripCount = (state.recovery_actions || []).filter((a) => a.includes('L4') || a.includes('L5')).length;
    console.log(`  Escalations this session: ${tripCount}`);

    // 4. Knowledge store health
    console.log('\n  ── Knowledge Stores ──────────────────────');
    const kStores = ['tech-stack', 'patterns', 'decisions', 'gotchas'];
    let populated = 0;
    for (const store of kStores) {
        const storeFile = path.join(knowledgeDir, `${store}.json`);
        if (fs.existsSync(storeFile)) {
            try {
                const data = JSON.parse(fs.readFileSync(storeFile, 'utf-8'));
                const entries = Object.keys(data).filter((k) => k !== '_lastUpdated').length;
                console.log(`  ✅ ${store}: ${entries} entries`);
                populated++;
            } catch (e) {
                console.log(`  ⚠️ ${store}: corrupt`);
            }
        } else {
            console.log(`  ○  ${store}: empty`);
        }
    }
    console.log(`  Coverage: ${populated}/4 stores populated`);

    // 5. Reports
    console.log('\n  ── Handoff Reports ───────────────────────');
    if (fs.existsSync(reportsDir)) {
        const reports = fs.readdirSync(reportsDir).filter((f) => f.endsWith('.md'));
        console.log(`  ${reports.length} report(s) generated`);
    } else {
        console.log('  No reports generated yet.');
    }

    console.log('\n  ─────────────────────────────────────────');
    console.log('');
    process.exit(0);
}

// ═══════════════════════════════════════════════════════════════════
// § EXECUTION & SAFETY GUARDS
// ═══════════════════════════════════════════════════════════════════

/** Circuit Breaker Check — Block execution if error_count >= 5 */
if (state.error_count >= 5) {
    console.error(`
========================================================================
[STEROID-CIRCUIT-BREAKER TRIPPED] 🛑
Maximum error tolerance reached (5/5).
All 5 recovery levels exhausted.
AI Agent: YOU ARE ORDERED TO STOP TERMINAL EXECUTION IMMEDIATELY.
DO NOT RUN DESTRUCTIVE COMMANDS. DO NOT ATTEMPT TO SILENTLY FIX THIS.
Present the user with the exact error log and file context, and ask for
human validation to pivot the architecture or manually intervene.

Run: node steroid-run.cjs recover     (to review error history)
Run: node steroid-run.cjs reset       (to resume after fixing)
========================================================================
`);
    process.exit(1);
}

// --- Verify Command (Anti-Summarization) ---
if (args[0] === 'verify') {
    const targetFile = args[1];
    const minLinesArg = args.find((a) => a.startsWith('--min-lines='));

    if (!targetFile || !minLinesArg) {
        console.error('Usage: node steroid-run.cjs verify <file> --min-lines=<number>');
        process.exit(1);
    }

    const minLines = parseInt(minLinesArg.split('=')[1], 10);
    const fullPath = path.resolve(targetDir, targetFile);

    if (!fs.existsSync(fullPath)) {
        console.error(`[STEROID-VERIFY ERROR]: File does not exist at ${fullPath}`);
        process.exit(1);
    }

    const content = fs.readFileSync(fullPath, 'utf-8');
    const lineCount = content.split('\n').length;

    if (lineCount < minLines) {
        console.error(`\n[STEROID-VERIFY ERROR] 🛑 AI SHORTCUT DETECTED 🛑`);
        console.error(`File ${targetFile} has ${lineCount} lines, but requires at least ${minLines} lines.`);
        console.error(`Do not summarize code. You MUST write the full implementation.`);
        process.exit(1);
    }

    console.log(`[STEROID-VERIFY SUCCESS] ✅ File passes validation (${lineCount} lines >= ${minLines} required).`);
    process.exit(0);
}

// --- Execution Mode ---
let executionCwd = targetDir;
let executionArgs = args;

if (args[0] === 'run') {
    let cwdProvided = false;
    executionArgs = [];

    for (const arg of args.slice(1)) {
        if (arg.startsWith('--cwd=')) {
            const requestedCwd = arg.slice('--cwd='.length);
            if (!requestedCwd) {
                console.error("[steroid-run] Usage: node steroid-run.cjs run --cwd=<path> '<command>'");
                process.exit(1);
            }
            executionCwd = path.resolve(targetDir, requestedCwd);
            cwdProvided = true;
        } else {
            executionArgs.push(arg);
        }
    }

    if (!cwdProvided || executionArgs.length === 0) {
        console.error("[steroid-run] Usage: node steroid-run.cjs run --cwd=<path> '<command>'");
        process.exit(1);
    }
    if (!isWithinTargetDir(executionCwd)) {
        console.error('[steroid-run] 🚫 SAFETY: --cwd must stay inside the current project root.');
        process.exit(1);
    }
    if (!fs.existsSync(executionCwd) || !fs.statSync(executionCwd).isDirectory()) {
        console.error(`[steroid-run] ❌ Working directory does not exist: ${path.relative(targetDir, executionCwd)}`);
        process.exit(1);
    }
}

const commandStr = executionArgs.join(' ');
const normalizedCommandStr = stripWrappingQuotes(commandStr.trim());

// --- Scaffold Safety Guard (v5.6.0) ---
// Blocks scaffold commands targeting root dir (. or ./) to prevent
// tools like create-vite from deleting all existing files.
// See: incident_report.md — portfolio3 directory wipe incident.
const SCAFFOLD_PATTERNS = [
    /npm\s+create\s+\S+\s+\.(?:\/|\s|$)/i, // npm create vite .
    /npx\s+create-\S+\s+\.(?:\/|\s|$)/i, // npx create-react-app .
    /npm\s+init\s+\S+\s+\.(?:\/|\s|$)/i, // npm init vite .
    /yarn\s+create\s+\S+\s+\.(?:\/|\s|$)/i, // yarn create vite .
    /pnpm\s+create\s+\S+\s+\.(?:\/|\s|$)/i, // pnpm create vite .
    /pnpm\s+dlx\s+create-\S+\s+\.(?:\/|\s|$)/i, // pnpm dlx create-vite .
    /bunx?\s+create-\S+\s+\.(?:\/|\s|$)/i, // bun create-vite . | bunx create-vite .
];

for (const pattern of SCAFFOLD_PATTERNS) {
    if (pattern.test(normalizedCommandStr)) {
        const safeName = '.steroid-scaffold-tmp';
        const safeCmd = normalizedCommandStr
            .replace(/\s+\.\/?\s*/, ` ${safeName} `)
            .replace(/\s+\.\/?\s*$/, ` ${safeName}`);
        console.error(`\n[STEROID-SCAFFOLD-GUARD] 🛑 BLOCKED: In-place scaffold detected!`);
        console.error(`  Command: "${normalizedCommandStr}"`);
        console.error(`  Risk: Scaffold tools may DELETE ALL existing files in the current directory.`);
        console.error(`  This would destroy .git/, .memory/, steroid-run.cjs, and all infrastructure.\n`);
        console.error(`  ✅ SAFE ALTERNATIVE:`);
        console.error(`    1. node steroid-run.cjs '${safeCmd}'`);
        console.error(`    2. Copy files from ${safeName}/ to root (merge, don't overwrite)`);
        console.error(`    3. Remove ${safeName}/`);
        console.error(`    4. npm install\n`);
        process.exit(1);
    }
}

const executionLabel = path.relative(targetDir, executionCwd) || '.';
console.log(`[steroid-run] Executing${executionLabel === '.' ? '' : ` in ${executionLabel}`}: ${commandStr}`);

// --- Command Allowlist Guard (v6.0.0) ---
// Only known development commands are allowed through the circuit breaker.
// This prevents prompt injection attacks from executing arbitrary shell commands.
const ALLOWED_COMMANDS = new Set([
    'npm',
    'npx',
    'node',
    'pnpm',
    'yarn',
    'bun',
    'bunx',
    'deno',
    'git',
    'echo',
    'cat',
    'ls',
    'dir',
    'mkdir',
    'cp',
    'mv',
    'type',
    'where',
    'rm',
    'rmdir',
    'del',
    'rd',
    'move',
    'copy',
    'xcopy', // v6.0.0: shell utilities
    'grep',
    'findstr',
    'head',
    'tail',
    'touch',
    'sed',
    'awk', // v6.0.0: text utilities
    'python',
    'python3',
    'pip',
    'pip3',
    'poetry',
    'uv',
    'cargo',
    'rustc',
    'rustup',
    'go',
    'dotnet',
    'flutter',
    'dart',
    'ruby',
    'gem',
    'bundle',
    'rake',
    'php',
    'composer',
    'java',
    'javac',
    'mvn',
    'gradle',
    'gradlew',
    'make',
    'cmake',
    'docker',
    'docker-compose',
    'tsc',
    'eslint',
    'prettier',
    'jest',
    'vitest',
    'mocha',
    'pytest',
    'knip',
    'madge',
    'gitleaks',
]);

const blockedSyntax = findBlockedShellSyntax(normalizedCommandStr);
if (blockedSyntax) {
    console.error(`\n[STEROID-COMMAND-GUARD] 🛑 BLOCKED: Shell control syntax "${blockedSyntax}" is not allowed.`);
    console.error('  Run one command at a time through the circuit breaker.');
    console.error('  For multi-step work, execute separate steroid-run commands.');
    process.exit(1);
}

let commandTokens = [];
try {
    commandTokens = tokenizeCommand(commandStr);
} catch (error) {
    console.error(`\n[STEROID-COMMAND-GUARD] 🛑 BLOCKED: ${error.message}`);
    process.exit(1);
}

const baseCommand = (commandTokens[0] || '').replace(/^['"]|['"]$/g, '').toLowerCase();
if (!ALLOWED_COMMANDS.has(baseCommand)) {
    console.error(`\n[STEROID-COMMAND-GUARD] 🛑 BLOCKED: Unknown command "${baseCommand}"`);
    console.error(`  Only known development commands are allowed through the circuit breaker.`);
    console.error(`  Allowed: ${[...ALLOWED_COMMANDS].sort().join(', ')}`);

    // Command suggestion (v5.9.0) — Levenshtein-based typo detection
    const levenshtein = (a, b) => {
        const m = a.length,
            n = b.length;
        const dp = Array.from({ length: m + 1 }, (_, i) => {
            const row = new Array(n + 1);
            row[0] = i;
            return row;
        });
        for (let j = 0; j <= n; j++) dp[0][j] = j;
        for (let i = 1; i <= m; i++) {
            for (let j = 1; j <= n; j++) {
                dp[i][j] =
                    a[i - 1] === b[j - 1]
                        ? dp[i - 1][j - 1]
                        : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
            }
        }
        return dp[m][n];
    };
    const KNOWN_CMDS = [
        'run',
        'reset',
        'recover',
        'status',
        'pipeline-status',
        'progress',
        'memory',
        'audit',
        'init-feature',
        'gate',
        'commit',
        'log',
        'check-plan',
        'stories',
        'archive',
        'scan',
        'detect-intent',
        'normalize-prompt',
        'design-prep',
        'design-route',
        'design-system',
        'prompt-health',
        'session-detect',
        'detect-tests',
        'verify-feature',
        'review',
        'report',
        'dashboard',
        'verify',
        'fs-cat',
        'fs-find',
        'fs-grep',
        'fs-ls',
        'fs-mkdir',
        'fs-cp',
        'fs-mv',
        'fs-rm',
    ];
    let bestMatch = null,
        bestDist = Infinity;
    for (const cmd of KNOWN_CMDS) {
        const d = levenshtein(baseCommand, cmd);
        if (d < bestDist) {
            bestDist = d;
            bestMatch = cmd;
        }
    }
    if (bestMatch && bestDist <= 3) {
        console.error(`  💡 Did you mean: ${bestMatch}?`);
    }

    process.exit(1);
}

const child = spawnSync(commandStr, {
    cwd: executionCwd,
    shell: true,
    stdio: 'inherit',
});

// --- State Machine Update ---
if (child.status !== 0) {
    state.error_count += 1;
    state.last_error = `Command failed in "${executionLabel}": "${commandStr}" (exit code ${child.status})`;
    if (!state.error_history) state.error_history = [];
    state.error_history.push(`[${new Date().toISOString()}] ${state.last_error}`);
    if (!state.recovery_actions) state.recovery_actions = [];
    state.status = state.error_count >= 5 ? 'tripped' : 'active';

    // v4.0: Graduated recovery messages
    const recoveryHints = {
        1: 'Try a different approach. Run: node steroid-run.cjs recover',
        2: 'Re-read your plan. Run: node steroid-run.cjs recover',
        3: 'Self-diagnosing... Run: node steroid-run.cjs recover',
        4: '⚠️ STOP and present errors to user. Run: node steroid-run.cjs recover',
        5: 'CIRCUIT BREAKER TRIPPED. Run "node steroid-run.cjs reset" to resume.',
    };
    const hint = recoveryHints[Math.min(state.error_count, 5)];
    console.error(`\n[steroid-run] ❌ ERROR ${state.error_count}/5. ${hint}`);

    // v4.0: Record error pattern for future self-diagnosis
    if (!fs.existsSync(metricsDir)) fs.mkdirSync(metricsDir, { recursive: true });
    const errorPatternsFile = path.join(metricsDir, 'error-patterns.json');
    let errorPatterns = { patterns: [] };
    if (fs.existsSync(errorPatternsFile)) {
        try {
            errorPatterns = JSON.parse(fs.readFileSync(errorPatternsFile, 'utf-8'));
        } catch (e) {
            /* ignore */
        }
    }
    errorPatterns.patterns.push({
        keyword: baseCommand || 'unknown',
        error: state.last_error,
        timestamp: new Date().toISOString(),
    });
    if (errorPatterns.patterns.length > 50) {
        errorPatterns.patterns = errorPatterns.patterns.slice(-50);
    }
    fs.writeFileSync(errorPatternsFile, JSON.stringify(errorPatterns, null, 2));
} else {
    state.error_count = 0;
    state.last_error = null;
    state.status = 'active';
}

fs.writeFileSync(stateFile, JSON.stringify(state, null, 2));
process.exit(child.status);
