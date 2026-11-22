'use strict';

function isExecutableCommand(command) {
    return Boolean(command && typeof command.execute === 'function');
}

module.exports = { isExecutableCommand };
