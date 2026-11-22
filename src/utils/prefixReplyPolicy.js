'use strict';

/**
 * Prevent Discord from notifying the author of the message being replied to.
 * Explicit user, role, and everyone mention permissions are otherwise preserved.
 *
 * @param {string|object|null} payload Discord message payload.
 * @returns {object} A new payload with reply-author notifications disabled.
 */
function withPrefixReplyPolicy(payload) {
    const normalized = typeof payload === 'string'
        ? { content: payload }
        : (payload && typeof payload === 'object' ? { ...payload } : {});

    normalized.allowedMentions = {
        ...(normalized.allowedMentions || {}),
        repliedUser: false
    };

    return normalized;
}

module.exports = { withPrefixReplyPolicy };
