'use strict';

const fs = require('fs');
const path = require('path');
const { resolvePathWithinRoot } = require('../utils/path-guards.cjs');

const WORKSPACE_COMMANDS = new Set(['fs-cat', 'fs-find', 'fs-grep', 'fs-ls', 'fs-mkdir', 'fs-cp', 'fs-mv', 'fs-rm']);
const PROTECTED_REMOVE_PATHS = ['.git', '.memory', 'steroid-run.cjs', 'node_modules'];

function canHandle(command) {
    return WORKSPACE_COMMANDS.has(command);
}

function buildRuntimeContext(context = {}) {
    return {
        targetDir: context.targetDir || process.cwd(),
    };
}

function formatRelativePath(rootDir, resolvedPath, fallback = '.') {
    return path.relative(rootDir, resolvedPath) || fallback;
}

function printTreeLines(rootDir, dir, prefix, maxDepth, currentDepth, lines) {
    if (currentDepth >= maxDepth) return;
    const entries = fs
        .readdirSync(dir, { withFileTypes: true })
        .filter((entry) => !entry.name.startsWith('.') && entry.name !== 'node_modules')
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
            lines.push(`${prefix}${connector}${entry.name}/`);
            printTreeLines(rootDir, path.join(dir, entry.name), prefix + childPrefix, maxDepth, currentDepth + 1, lines);
        } else {
            const size = fs.statSync(path.join(dir, entry.name)).size;
            const sizeStr = size > 1024 ? `${(size / 1024).toFixed(1)}KB` : `${size}B`;
            lines.push(`${prefix}${connector}${entry.name} (${sizeStr})`);
        }
    }
}

function copyRecursive(srcPath, destPath) {
    const stat = fs.statSync(srcPath);
    if (stat.isDirectory()) {
        if (!fs.existsSync(destPath)) fs.mkdirSync(destPath, { recursive: true });
        for (const child of fs.readdirSync(srcPath)) {
            if (child === 'node_modules' || child === '.git') continue;
            copyRecursive(path.join(srcPath, child), path.join(destPath, child));
        }
        return;
    }

    const destDir = path.dirname(destPath);
    if (!fs.existsSync(destDir)) fs.mkdirSync(destDir, { recursive: true });
    fs.copyFileSync(srcPath, destPath);
}

function globToRegExp(pattern) {
    const normalized = (pattern || '').replace(/\\/g, '/');
    const escaped = normalized
        .replace(/[|\\{}()[\]^$+?.]/g, '\\$&')
        .replace(/\*/g, '.*')
        .replace(/\?/g, '.');
    return new RegExp(`^${escaped}$`);
}

function walkPathEntries(rootDir, startPath, options, visitor, depth = 0) {
    if (!fs.existsSync(startPath)) return false;

    const stat = fs.statSync(startPath);
    const entry = {
        absolutePath: startPath,
        relativePath: path.relative(rootDir, startPath) || '.',
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
        if (walkPathEntries(rootDir, childPath, options, visitor, depth + 1)) {
            return true;
        }
    }
    return false;
}

function handleFsMkdir(argv = [], context = {}) {
    const runtime = buildRuntimeContext(context);
    const dirPath = argv[1];
    if (!dirPath) {
        return {
            handled: true,
            area: 'workspace',
            command: 'fs-mkdir',
            exitCode: 1,
            stderr: '[steroid-run] Usage: npx steroid-run fs-mkdir <path>\n',
        };
    }

    const resolved = resolvePathWithinRoot(runtime.targetDir, dirPath);
    if (!resolved) {
        return {
            handled: true,
            area: 'workspace',
            command: 'fs-mkdir',
            exitCode: 1,
            stderr: '[steroid-run] 🚫 SAFETY: fs-mkdir path must stay inside the current project root.\n',
        };
    }

    fs.mkdirSync(resolved, { recursive: true });
    return {
        handled: true,
        area: 'workspace',
        command: 'fs-mkdir',
        exitCode: 0,
        stdout: `[steroid-run] ✅ Created: ${formatRelativePath(runtime.targetDir, resolved, dirPath)}/\n`,
    };
}

function handleFsRm(argv = [], context = {}) {
    const runtime = buildRuntimeContext(context);
    const rmPath = argv[1];
    if (!rmPath) {
        return {
            handled: true,
            area: 'workspace',
            command: 'fs-rm',
            exitCode: 1,
            stderr: '[steroid-run] Usage: npx steroid-run fs-rm <path>\n',
        };
    }

    const resolved = resolvePathWithinRoot(runtime.targetDir, rmPath);
    if (!resolved) {
        return {
            handled: true,
            area: 'workspace',
            command: 'fs-rm',
            exitCode: 1,
            stderr: '[steroid-run] 🚫 SAFETY: fs-rm path must stay inside the current project root.\n',
        };
    }

    const relPath = formatRelativePath(runtime.targetDir, resolved, rmPath);
    for (const safe of PROTECTED_REMOVE_PATHS) {
        if (relPath === safe || relPath.startsWith(safe + path.sep)) {
            return {
                handled: true,
                area: 'workspace',
                command: 'fs-rm',
                exitCode: 1,
                stderr: `[steroid-run] 🚫 SAFETY: Refusing to delete "${relPath}" (protected path).\n`,
            };
        }
    }

    if (!fs.existsSync(resolved)) {
        return {
            handled: true,
            area: 'workspace',
            command: 'fs-rm',
            exitCode: 0,
            stdout: `[steroid-run] ⏭️  Path does not exist: ${relPath}\n`,
        };
    }

    fs.rmSync(resolved, { recursive: true, force: true });
    return {
        handled: true,
        area: 'workspace',
        command: 'fs-rm',
        exitCode: 0,
        stdout: `[steroid-run] ✅ Removed: ${relPath}\n`,
    };
}

function handleFsCat(argv = [], context = {}) {
    const runtime = buildRuntimeContext(context);
    let headCount = null;
    let optional = false;
    const candidatePaths = [];

    for (const arg of argv.slice(1)) {
        if (arg === '--optional') {
            optional = true;
        } else if (arg.startsWith('--head=')) {
            const parsed = Number.parseInt(arg.slice('--head='.length), 10);
            if (!Number.isFinite(parsed) || parsed < 1) {
                return {
                    handled: true,
                    area: 'workspace',
                    command: 'fs-cat',
                    exitCode: 1,
                    stderr: '[steroid-run] Usage: node steroid-run.cjs fs-cat <file...> [--head=<n>] [--optional]\n',
                };
            }
            headCount = parsed;
        } else if (arg.startsWith('--')) {
            return {
                handled: true,
                area: 'workspace',
                command: 'fs-cat',
                exitCode: 1,
                stderr: `[steroid-run] Unknown option for fs-cat: ${arg}\n`,
            };
        } else {
            candidatePaths.push(arg);
        }
    }

    if (candidatePaths.length === 0) {
        return {
            handled: true,
            area: 'workspace',
            command: 'fs-cat',
            exitCode: 1,
            stderr: '[steroid-run] Usage: node steroid-run.cjs fs-cat <file...> [--head=<n>] [--optional]\n',
        };
    }

    let chosenPath = null;
    let resolvedPath = null;
    for (const candidate of candidatePaths) {
        const resolved = resolvePathWithinRoot(runtime.targetDir, candidate, { mustExist: true });
        if (!resolved) continue;
        if (fs.existsSync(resolved) && fs.statSync(resolved).isFile()) {
            chosenPath = candidate;
            resolvedPath = resolved;
            break;
        }
    }

    if (!resolvedPath) {
        if (optional) {
            return {
                handled: true,
                area: 'workspace',
                command: 'fs-cat',
                exitCode: 0,
                stdout: `[steroid-run] ⏭️  No matching file found: ${candidatePaths.join(', ')}\n`,
            };
        }
        return {
            handled: true,
            area: 'workspace',
            command: 'fs-cat',
            exitCode: 1,
            stderr: `[steroid-run] ❌ File not found: ${candidatePaths.join(', ')}\n`,
        };
    }

    const relativePath = formatRelativePath(runtime.targetDir, resolvedPath, chosenPath);
    const contents = fs.readFileSync(resolvedPath, 'utf-8');
    const display = headCount === null ? contents : contents.split(/\r?\n/).slice(0, headCount).join('\n');
    const lines = [`[steroid-run] 📄 ${relativePath}`];
    if (display.length > 0) lines.push(display);

    return {
        handled: true,
        area: 'workspace',
        command: 'fs-cat',
        exitCode: 0,
        stdout: `${lines.join('\n')}\n`,
    };
}

function handleFsCp(argv = [], context = {}) {
    const runtime = buildRuntimeContext(context);
    const src = argv[1];
    const dest = argv[2];
    if (!src || !dest) {
        return {
            handled: true,
            area: 'workspace',
            command: 'fs-cp',
            exitCode: 1,
            stderr: '[steroid-run] Usage: npx steroid-run fs-cp <src> <dest>\n',
        };
    }

    const resolvedSrc = resolvePathWithinRoot(runtime.targetDir, src, { mustExist: true });
    const resolvedDest = resolvePathWithinRoot(runtime.targetDir, dest);
    if (!resolvedSrc || !resolvedDest) {
        return {
            handled: true,
            area: 'workspace',
            command: 'fs-cp',
            exitCode: 1,
            stderr: '[steroid-run] 🚫 SAFETY: fs-cp paths must stay inside the current project root.\n',
        };
    }

    if (!fs.existsSync(resolvedSrc)) {
        return {
            handled: true,
            area: 'workspace',
            command: 'fs-cp',
            exitCode: 1,
            stderr: `[steroid-run] ❌ Source does not exist: ${src}\n`,
        };
    }

    let count = 0;
    const stat = fs.statSync(resolvedSrc);
    if (stat.isDirectory()) {
        if (!fs.existsSync(resolvedDest)) fs.mkdirSync(resolvedDest, { recursive: true });
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
        const destDir = path.dirname(destFile);
        if (!fs.existsSync(destDir)) fs.mkdirSync(destDir, { recursive: true });
        fs.copyFileSync(resolvedSrc, destFile);
        count = 1;
    }

    return {
        handled: true,
        area: 'workspace',
        command: 'fs-cp',
        exitCode: 0,
        stdout: `[steroid-run] ✅ Copied ${count} item(s): ${src} → ${dest}\n`,
    };
}

function handleFsMv(argv = [], context = {}) {
    const runtime = buildRuntimeContext(context);
    const src = argv[1];
    const dest = argv[2];
    if (!src || !dest) {
        return {
            handled: true,
            area: 'workspace',
            command: 'fs-mv',
            exitCode: 1,
            stderr: '[steroid-run] Usage: npx steroid-run fs-mv <src> <dest>\n',
        };
    }

    const resolvedSrc = resolvePathWithinRoot(runtime.targetDir, src, { mustExist: true });
    const resolvedDest = resolvePathWithinRoot(runtime.targetDir, dest);
    if (!resolvedSrc || !resolvedDest) {
        return {
            handled: true,
            area: 'workspace',
            command: 'fs-mv',
            exitCode: 1,
            stderr: '[steroid-run] 🚫 SAFETY: fs-mv paths must stay inside the current project root.\n',
        };
    }

    if (!fs.existsSync(resolvedSrc)) {
        return {
            handled: true,
            area: 'workspace',
            command: 'fs-mv',
            exitCode: 1,
            stderr: `[steroid-run] ❌ Source does not exist: ${src}\n`,
        };
    }

    try {
        fs.renameSync(resolvedSrc, resolvedDest);
    } catch (error) {
        if (error && error.code === 'EXDEV') {
            copyRecursive(resolvedSrc, resolvedDest);
            fs.rmSync(resolvedSrc, { recursive: true, force: true });
        } else {
            throw error;
        }
    }

    return {
        handled: true,
        area: 'workspace',
        command: 'fs-mv',
        exitCode: 0,
        stdout: `[steroid-run] ✅ Moved: ${src} → ${dest}\n`,
    };
}

function handleFsLs(argv = [], context = {}) {
    const runtime = buildRuntimeContext(context);
    const lsPath = argv[1] || '.';
    const resolved = resolvePathWithinRoot(runtime.targetDir, lsPath, { mustExist: true });
    if (!resolved) {
        return {
            handled: true,
            area: 'workspace',
            command: 'fs-ls',
            exitCode: 1,
            stderr: '[steroid-run] 🚫 SAFETY: fs-ls path must stay inside the current project root.\n',
        };
    }

    if (!fs.existsSync(resolved)) {
        return {
            handled: true,
            area: 'workspace',
            command: 'fs-ls',
            exitCode: 1,
            stderr: `[steroid-run] ❌ Path does not exist: ${lsPath}\n`,
        };
    }

    const lines = [`[steroid-run] 📂 ${formatRelativePath(runtime.targetDir, resolved, '.')}/`];
    printTreeLines(runtime.targetDir, resolved, '  ', 4, 0, lines);
    return {
        handled: true,
        area: 'workspace',
        command: 'fs-ls',
        exitCode: 0,
        stdout: `${lines.join('\n')}\n`,
    };
}

function handleFsFind(argv = [], context = {}) {
    const runtime = buildRuntimeContext(context);
    const startPaths = [];
    const namePatterns = [];
    let type = 'any';
    let maxDepth = Number.POSITIVE_INFINITY;
    let limit = Number.POSITIVE_INFINITY;
    let countOnly = false;

    for (const arg of argv.slice(1)) {
        if (arg.startsWith('--name=')) {
            namePatterns.push(globToRegExp(arg.slice('--name='.length)));
        } else if (arg.startsWith('--type=')) {
            type = arg.slice('--type='.length);
            if (!['any', 'file', 'dir'].includes(type)) {
                return {
                    handled: true,
                    area: 'workspace',
                    command: 'fs-find',
                    exitCode: 1,
                    stderr:
                        '[steroid-run] Usage: node steroid-run.cjs fs-find [path...] [--name=<glob>] [--type=file|dir] [--max-depth=<n>] [--limit=<n>] [--count]\n',
                };
            }
        } else if (arg.startsWith('--max-depth=')) {
            const parsed = Number.parseInt(arg.slice('--max-depth='.length), 10);
            if (!Number.isFinite(parsed) || parsed < 0) {
                return {
                    handled: true,
                    area: 'workspace',
                    command: 'fs-find',
                    exitCode: 1,
                    stderr:
                        '[steroid-run] Usage: node steroid-run.cjs fs-find [path...] [--name=<glob>] [--type=file|dir] [--max-depth=<n>] [--limit=<n>] [--count]\n',
                };
            }
            maxDepth = parsed;
        } else if (arg.startsWith('--limit=')) {
            const parsed = Number.parseInt(arg.slice('--limit='.length), 10);
            if (!Number.isFinite(parsed) || parsed < 1) {
                return {
                    handled: true,
                    area: 'workspace',
                    command: 'fs-find',
                    exitCode: 1,
                    stderr:
                        '[steroid-run] Usage: node steroid-run.cjs fs-find [path...] [--name=<glob>] [--type=file|dir] [--max-depth=<n>] [--limit=<n>] [--count]\n',
                };
            }
            limit = parsed;
        } else if (arg === '--count') {
            countOnly = true;
        } else if (arg.startsWith('--')) {
            return {
                handled: true,
                area: 'workspace',
                command: 'fs-find',
                exitCode: 1,
                stderr: `[steroid-run] Unknown option for fs-find: ${arg}\n`,
            };
        } else {
            startPaths.push(arg);
        }
    }

    const roots = startPaths.length > 0 ? startPaths : ['.'];
    const results = [];

    for (const root of roots) {
        const resolvedRoot = resolvePathWithinRoot(runtime.targetDir, root, { mustExist: true });
        if (!resolvedRoot || !fs.existsSync(resolvedRoot)) continue;

        const stop = walkPathEntries(runtime.targetDir, resolvedRoot, { maxDepth, skipRoot: false }, (entry) => {
            if (results.length >= limit) return true;
            const typeMatch = type === 'any' || (type === 'file' && entry.isFile) || (type === 'dir' && entry.isDirectory);
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
        return {
            handled: true,
            area: 'workspace',
            command: 'fs-find',
            exitCode: 0,
            stdout: `[steroid-run] 🔎 ${results.length}\n`,
        };
    }
    if (results.length === 0) {
        return {
            handled: true,
            area: 'workspace',
            command: 'fs-find',
            exitCode: 0,
            stdout: '[steroid-run] ⏭️  No matches found.\n',
        };
    }

    return {
        handled: true,
        area: 'workspace',
        command: 'fs-find',
        exitCode: 0,
        stdout: `[steroid-run] 🔎 Found ${results.length} match(es)\n${results.join('\n')}\n`,
    };
}

function handleFsGrep(argv = [], context = {}) {
    const runtime = buildRuntimeContext(context);
    let patternText = null;
    const searchPaths = [];
    const includePatterns = [];
    let filesWithMatches = false;
    let ignoreCase = false;
    let fixed = false;
    let limit = Number.POSITIVE_INFINITY;

    for (const arg of argv.slice(1)) {
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
                return {
                    handled: true,
                    area: 'workspace',
                    command: 'fs-grep',
                    exitCode: 1,
                    stderr:
                        '[steroid-run] Usage: node steroid-run.cjs fs-grep <pattern> [path...] [--include=<glob>] [--files-with-matches] [--limit=<n>] [--ignore-case] [--fixed]\n',
                };
            }
            limit = parsed;
        } else if (arg.startsWith('--')) {
            return {
                handled: true,
                area: 'workspace',
                command: 'fs-grep',
                exitCode: 1,
                stderr: `[steroid-run] Unknown option for fs-grep: ${arg}\n`,
            };
        } else if (patternText === null) {
            patternText = arg;
        } else {
            searchPaths.push(arg);
        }
    }

    if (!patternText) {
        return {
            handled: true,
            area: 'workspace',
            command: 'fs-grep',
            exitCode: 1,
            stderr:
                '[steroid-run] Usage: node steroid-run.cjs fs-grep <pattern> [path...] [--include=<glob>] [--files-with-matches] [--limit=<n>] [--ignore-case] [--fixed]\n',
        };
    }

    const regexSource = fixed ? patternText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') : patternText;
    const pattern = new RegExp(regexSource, ignoreCase ? 'i' : '');
    const roots = searchPaths.length > 0 ? searchPaths : ['.'];
    const results = [];
    const seenFiles = new Set();

    const searchFile = (filePath) => {
        if (results.length >= limit) return true;

        const relativePath = path.relative(runtime.targetDir, filePath) || path.basename(filePath);
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
        const resolvedRoot = resolvePathWithinRoot(runtime.targetDir, root, { mustExist: true });
        if (!resolvedRoot || !fs.existsSync(resolvedRoot)) continue;

        if (fs.statSync(resolvedRoot).isFile()) {
            if (searchFile(resolvedRoot)) break;
            continue;
        }

        const stop = walkPathEntries(
            runtime.targetDir,
            resolvedRoot,
            { maxDepth: Number.POSITIVE_INFINITY, skipRoot: true },
            (entry) => {
                if (results.length >= limit) return true;
                if (entry.isFile) {
                    return searchFile(entry.absolutePath);
                }
                return false;
            },
        );
        if (stop && results.length >= limit) break;
    }

    if (results.length === 0) {
        return {
            handled: true,
            area: 'workspace',
            command: 'fs-grep',
            exitCode: 0,
            stdout: '[steroid-run] ⏭️  No matches found.\n',
        };
    }

    return {
        handled: true,
        area: 'workspace',
        command: 'fs-grep',
        exitCode: 0,
        stdout: `[steroid-run] 🔎 Found ${results.length} match(es)\n${results.join('\n')}\n`,
    };
}

function run(argv = [], context = {}) {
    const command = argv[0] || '';
    if (command === 'fs-mkdir') return handleFsMkdir(argv, context);
    if (command === 'fs-rm') return handleFsRm(argv, context);
    if (command === 'fs-cat') return handleFsCat(argv, context);
    if (command === 'fs-cp') return handleFsCp(argv, context);
    if (command === 'fs-mv') return handleFsMv(argv, context);
    if (command === 'fs-find') return handleFsFind(argv, context);
    if (command === 'fs-grep') return handleFsGrep(argv, context);
    if (command === 'fs-ls') return handleFsLs(argv, context);

    return {
        handled: false,
        area: 'workspace',
        command,
    };
}

module.exports = {
    canHandle,
    handleFsMkdir,
    handleFsRm,
    handleFsCat,
    handleFsCp,
    handleFsMv,
    handleFsFind,
    handleFsGrep,
    handleFsLs,
    run,
};
