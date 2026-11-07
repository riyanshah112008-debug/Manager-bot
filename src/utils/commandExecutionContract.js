'use strict';

/**
 * Slash-command handlers use CommandContext by default.
 * Only handlers explicitly marked nativeInteraction own the raw Discord
 * ChatInputCommandInteraction response lifecycle.
 */
function usesNativeInteraction(command) {
    return command?.nativeInteraction === true;
}

module.exports = { usesNativeInteraction };
