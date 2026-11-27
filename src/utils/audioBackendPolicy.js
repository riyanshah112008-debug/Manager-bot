'use strict';

function isLavalinkRequired(env = process.env) {
    return String(env.STARRY_REQUIRE_LAVALINK || '').trim().toLowerCase() === 'true';
}

function isLavalinkReady(manager) {
    const nodes = manager?.shoukaku?.nodes;
    if (!nodes || typeof nodes.values !== 'function') return false;
    for (const node of nodes.values()) {
        if (node?.state === 1) return true;
    }
    return false;
}

function allowNativeAudioFallback(env = process.env) {
    return !isLavalinkRequired(env);
}

module.exports = { isLavalinkRequired, isLavalinkReady, allowNativeAudioFallback };
