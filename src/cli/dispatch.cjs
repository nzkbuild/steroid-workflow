'use strict';

const commandModules = {
    audit: require('../commands/audit.cjs'),
    dashboard: require('../commands/dashboard.cjs'),
    design: require('../commands/design.cjs'),
    memory: require('../commands/memory.cjs'),
    pipeline: require('../commands/pipeline.cjs'),
    report: require('../commands/report.cjs'),
    review: require('../commands/review.cjs'),
    verify: require('../commands/verify.cjs'),
    workspace: require('../commands/workspace.cjs'),
};

function dispatchCli(argv = [], context = {}) {
    const command = argv[0] || '';
    for (const mod of Object.values(commandModules)) {
        if (typeof mod.canHandle === 'function' && mod.canHandle(command, argv)) {
            return mod.run(argv, context);
        }
    }

    return {
        handled: false,
        command,
    };
}

module.exports = {
    dispatchCli,
};
