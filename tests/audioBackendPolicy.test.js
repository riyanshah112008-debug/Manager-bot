'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { isLavalinkRequired, isLavalinkReady, allowNativeAudioFallback } = require('../src/utils/audioBackendPolicy');

test('Render production profile requires the dedicated Lavalink audio process', () => {
    const env = { STARRY_REQUIRE_LAVALINK: 'true' };
    assert.equal(isLavalinkRequired(env), true);
    assert.equal(allowNativeAudioFallback(env), false);
});

test('local development keeps the native fallback available by default', () => {
    assert.equal(isLavalinkRequired({}), false);
    assert.equal(allowNativeAudioFallback({}), true);
});

test('only the explicit true value disables the native fallback', () => {
    for (const value of ['false', '0', 'yes', '']) {
        const env = { STARRY_REQUIRE_LAVALINK: value };
        assert.equal(allowNativeAudioFallback(env), true);
    }
});


test('Lavalink readiness requires at least one connected Shoukaku node', () => {
    assert.equal(isLavalinkReady(null), false);
    assert.equal(isLavalinkReady({ shoukaku: { nodes: new Map([['offline', { state: 0 }]]) } }), false);
    assert.equal(isLavalinkReady({ shoukaku: { nodes: new Map([['online', { state: 1 }]]) } }), true);
});
