#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { Window } = require('./node_modules/happy-dom');
const { runAudit } = require('./node_modules/@accesslint/core');

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

function auditFile(filePath) {
    const absolutePath = path.resolve(filePath);
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
        relativeFile: path.relative(process.cwd(), absolutePath),
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

function main() {
    const args = process.argv.slice(2);
    const json = args.includes('--json');
    const files = args.filter((arg) => arg !== '--json');

    if (files.length === 0) {
        console.error('[accesslint] Usage: node integrations/accesslint/run-audit.cjs <file...> [--json]');
        process.exit(1);
    }

    const results = files.map(auditFile);
    const allViolations = results.flatMap((entry) => entry.violations);
    const output = {
        generatedAt: new Date().toISOString(),
        fileCount: results.length,
        violationCount: allViolations.length,
        highestImpact: summarizeHighestImpact(allViolations),
        results,
    };

    if (json) {
        console.log(JSON.stringify(output, null, 2));
    } else {
        console.log(`[accesslint] Audited ${output.fileCount} file(s)`);
        console.log(`[accesslint] Violations: ${output.violationCount}`);
        console.log(`[accesslint] Highest impact: ${output.highestImpact}`);
        for (const result of results) {
            console.log(`- ${result.relativeFile}: ${result.violationCount} violation(s)`);
        }
    }
}

main();
