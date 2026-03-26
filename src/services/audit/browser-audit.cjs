'use strict';

const fs = require('fs');
const path = require('path');

function parseArgs(argv) {
    const args = argv.slice(2);
    const target = args.find((arg) => !arg.startsWith('--')) || '';
    const screenshotIndex = args.indexOf('--screenshot');
    return {
        target,
        json: args.includes('--json'),
        screenshotPath: screenshotIndex !== -1 ? args[screenshotIndex + 1] : '',
    };
}

function resolvePlaywright(cwd = process.cwd()) {
    const candidates = [
        process.env.STEROID_PLAYWRIGHT_PATH,
        process.env.STEROID_PLAYWRIGHT_PATH ? path.join(process.env.STEROID_PLAYWRIGHT_PATH, 'index.js') : '',
        path.join(cwd, 'node_modules', 'playwright'),
        path.join(cwd, 'node_modules', 'playwright', 'index.js'),
        path.join(__dirname, '..', '..', '..', 'node_modules', 'playwright'),
        path.join(__dirname, '..', '..', '..', 'node_modules', 'playwright', 'index.js'),
        'playwright',
    ];

    for (const candidate of candidates) {
        if (!candidate) continue;
        try {
            return require(candidate);
        } catch {
            // Try the next location.
        }
    }

    return null;
}

async function runBrowserAudit(options = {}) {
    const target = options.target || '';
    const json = !!options.json;
    const screenshotPath = options.screenshotPath || '';
    const cwd = options.cwd || process.cwd();

    if (!target) {
        throw new Error('Usage: node browser-audit.cjs <url-or-file> [--json] [--screenshot <path>]');
    }

    const playwright = resolvePlaywright(cwd);
    if (!playwright || !playwright.chromium) {
        return {
            ok: false,
            skipped: true,
            reason: 'Playwright is not installed in this project, so browser UI audit was skipped.',
            target,
            json,
        };
    }

    const browser = await playwright.chromium.launch({ headless: true });
    const page = await browser.newPage({ viewport: { width: 1440, height: 960 } });
    const consoleMessages = [];
    const pageErrors = [];
    const failedRequests = [];

    page.on('console', (message) => {
        consoleMessages.push({
            type: typeof message.type === 'function' ? message.type() : 'log',
            text: typeof message.text === 'function' ? message.text() : '',
        });
    });
    page.on('pageerror', (error) => {
        pageErrors.push(String(error && error.message ? error.message : error));
    });
    page.on('requestfailed', (request) => {
        const failure = typeof request.failure === 'function' ? request.failure() : null;
        failedRequests.push({
            url: typeof request.url === 'function' ? request.url() : '',
            method: typeof request.method === 'function' ? request.method() : '',
            errorText: failure && failure.errorText ? failure.errorText : '',
        });
    });

    try {
        await page.goto(target, { waitUntil: 'domcontentloaded', timeout: 30000 });
        if (typeof page.waitForLoadState === 'function') {
            await page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => {});
        }

        let screenshotResult = '';
        if (screenshotPath && typeof page.screenshot === 'function') {
            fs.mkdirSync(path.dirname(path.resolve(cwd, screenshotPath)), { recursive: true });
            await page.screenshot({ path: path.resolve(cwd, screenshotPath), fullPage: true });
            screenshotResult = path.resolve(cwd, screenshotPath);
        }

        const metrics =
            (typeof page.evaluate === 'function'
                ? await page.evaluate(() => ({
                      title: document.title || '',
                      landmarkCount: document.querySelectorAll(
                          'main, nav, header, footer, aside, [role="main"], [role="navigation"], [role="banner"], [role="contentinfo"], [role="complementary"]',
                      ).length,
                      headingCount: document.querySelectorAll('h1, h2, h3, h4, h5, h6, [role="heading"]').length,
                      buttonCount: document.querySelectorAll('button, [role="button"]').length,
                      linkCount: document.querySelectorAll('a[href], [role="link"]').length,
                      imageCount: document.querySelectorAll('img').length,
                      imageWithoutAltCount: Array.from(document.querySelectorAll('img')).filter(
                          (img) => !img.hasAttribute('alt'),
                      ).length,
                  }))
                : null) || {};

        return {
            ok: true,
            skipped: false,
            target,
            finalUrl: typeof page.url === 'function' ? page.url() : target,
            pageTitle: metrics.title || '',
            consoleMessages: consoleMessages.slice(0, 20),
            pageErrors: pageErrors.slice(0, 20),
            failedRequests: failedRequests.slice(0, 20),
            metrics: {
                landmarkCount: metrics.landmarkCount || 0,
                headingCount: metrics.headingCount || 0,
                buttonCount: metrics.buttonCount || 0,
                linkCount: metrics.linkCount || 0,
                imageCount: metrics.imageCount || 0,
                imageWithoutAltCount: metrics.imageWithoutAltCount || 0,
            },
            screenshotPath: screenshotResult,
            auditedAt: new Date().toISOString(),
            json,
        };
    } catch (error) {
        return {
            ok: false,
            skipped: false,
            target,
            error: String(error && error.message ? error.message : error),
            consoleMessages: consoleMessages.slice(0, 20),
            pageErrors: pageErrors.slice(0, 20),
            failedRequests: failedRequests.slice(0, 20),
            auditedAt: new Date().toISOString(),
            json,
        };
    } finally {
        await browser.close().catch(() => {});
    }
}

async function main(argv = process.argv) {
    const { target, json, screenshotPath } = parseArgs(argv);
    try {
        const payload = await runBrowserAudit({ target, json, screenshotPath });
        if (!target) {
            process.exit(1);
        }
        console.log(json ? JSON.stringify(payload, null, 2) : payload.skipped ? payload.reason : `Playwright UI audit completed for ${payload.finalUrl}`);
        if (!payload.skipped && payload.ok === false) {
            process.exit(0);
        }
    } catch (error) {
        console.error(error && error.stack ? error.stack : String(error));
        process.exit(1);
    }
}

if (require.main === module) {
    main();
}

module.exports = {
    main,
    parseArgs,
    resolvePlaywright,
    runBrowserAudit,
};
