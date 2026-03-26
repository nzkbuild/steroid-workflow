'use strict';

const { dispatchCli } = require('./dispatch.cjs');

function runCli(argv = process.argv.slice(2), context = {}) {
    const result = dispatchCli(argv, context);
    if (result && result.handled && !context.returnOnly) {
        if (result.stdout) process.stdout.write(result.stdout);
        if (result.stderr) process.stderr.write(result.stderr);
        process.exit(result.exitCode || 0);
    }
    return result;
}

module.exports = {
    runCli,
};
