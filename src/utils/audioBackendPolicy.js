'use strict';

function isLavalinkRequired(env = process.env) {
    return String(env.STARRY_REQUIRE_LAVALINK || '').trim().toLowerCase() === 'true';
}

function allowNativeAudioFallback(env = process.env) {
    return !isLavalinkRequired(env);
}

module.exports = { isLavalinkRequired, allowNativeAudioFallback };
