'use strict';

/**
 * Disable automatic notifications to the replied-to author while preserving
 * any explicit mention configuration supplied by the command.
 * @param {object} payload Discord message payload.
 * @returns {object} A payload with repliedUser disabled.
 */
function withPrefixReplyPolicy(payload) {
    return {
        ...payload,
        allowedMentions: {
            ...payload.allowedMentions,
            repliedUser: false
        }
    };
}

module.exports = { withPrefixReplyPolicy };
