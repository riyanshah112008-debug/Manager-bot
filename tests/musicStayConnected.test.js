'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { isStayConnected, setStayConnected } = require('../src/utils/musicStayConnected');

test('native player 24/7 mode enables continuous autoplay and can be disabled', () => {
    const player = { is247: false, autoplay: false };
    assert.equal(setStayConnected(player, true), true);
    assert.equal(isStayConnected(player), true);
    assert.equal(player.is247, true);
    assert.equal(player.autoplay, true);
    assert.equal(setStayConnected(player, false), false);
    assert.equal(isStayConnected(player), false);
    assert.equal(player.autoplay, false);
});

test('Lavalink player 24/7 mode persists in player data and enables autoplay', () => {
    const data = new Map();
    const player = { data, autoplay: false };
    assert.equal(setStayConnected(player, true), true);
    assert.equal(isStayConnected(player), true);
    assert.equal(data.get('stayConnected'), true);
    assert.equal(data.get('autoplay'), true);
    assert.equal(setStayConnected(player, false), false);
    assert.equal(data.get('stayConnected'), false);
    assert.equal(data.get('autoplay'), false);
    assert.equal(data.get('isBufferingAutoplay'), false);
});

test('24/7 helpers safely reject missing or unsupported player objects', () => {
    assert.equal(isStayConnected(null), false);
    assert.equal(isStayConnected(undefined), false);
    assert.equal(setStayConnected(null, true), false);
    assert.equal(setStayConnected({}, true), false);
});
