'use strict';

const fs = require('fs');
const path = require('path');
const { Window } = require('happy-dom');
const { runAudit } = require('@accesslint/core');

function bindDomGlobals(window) {
    for (const key of Object.getOwnPropertyNames(window)) {
        if (!(key in globalThis)) {
            globalThis[key] = window[key];
        }
    }
    globalThis.window = window;
    globalThis.document = window.document;
}

function summarizeHighestImpact(violations) {
    const order = ['critical', 'serious', 'moderate', 'minor'];
    for (const impact of order) {
        if (violations.some((violation) => violation.impact === impact)) {
            return impact;
        }
    }
    return 'none';
}

function normalizeViolation(violation) {
    return {
        ruleId: violation.ruleId,
        selector: violation.selector,
        impact: violation.impact,
        message: violation.message,
        context: violation.context || null,
        html: violation.html || null,
    };
}

function auditFile(filePath, options = {}) {
    const cwd = options.cwd || process.cwd();
    const absolutePath = path.resolve(cwd, filePath);
    const html = fs.readFileSync(absolutePath, 'utf-8');
    const window = new Window({
        url: `file://${absolutePath.replace(/\\/g, '/')}`,
    });

    bindDomGlobals(window);
    window.document.write(html);
    window.document.close();

    const result = runAudit(window.document);
    const violations = (result.violations || []).map(normalizeViolation);

    return {
        file: absolutePath,
        relativeFile: path.relative(cwd, absolutePath),
        url: result.url,
        ruleCount: result.ruleCount,
        violationCount: violations.length,
        highestImpact: summarizeHighestImpact(violations),
        violations,
        skippedRules: (result.skippedRules || []).map((entry) => ({
            ruleId: entry.ruleId,
            error: entry.error,
        })),
    };
}

function auditFiles(files, options = {}) {
    const results = files.map((filePath) => auditFile(filePath, options));
    const allViolations = results.flatMap((entry) => entry.violations);
    return {
        generatedAt: new Date().toISOString(),
        fileCount: results.length,
        violationCount: allViolations.length,
        highestImpact: summarizeHighestImpact(allViolations),
        results,
    };
}

function parseCliArgs(argv) {
    const args = argv.slice(2);
    return {
        json: args.includes('--json'),
        files: args.filter((arg) => arg !== '--json'),
    };
}

function main(argv = process.argv) {
    const { json, files } = parseCliArgs(argv);

    if (files.length === 0) {
        console.error('[accesslint] Usage: node accesslint-audit.cjs <file...> [--json]');
        process.exit(1);
    }

    const output = auditFiles(files);

    if (json) {
        console.log(JSON.stringify(output, null, 2));
        return;
    }

    console.log(`[accesslint] Audited ${output.fileCount} file(s)`);
    console.log(`[accesslint] Violations: ${output.violationCount}`);
    console.log(`[accesslint] Highest impact: ${output.highestImpact}`);
    for (const result of output.results) {
        console.log(`- ${result.relativeFile}: ${result.violationCount} violation(s)`);
    }
}

if (require.main === module) {
    main();
}

module.exports = {
    auditFile,
    auditFiles,
    bindDomGlobals,
    main,
    normalizeViolation,
    summarizeHighestImpact,
};
