'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
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

test('native engine uses automatic studio mastering and preserves 24/7 voice sessions', () => {
    const source = fs.readFileSync('src/utils/nativeAudioEngine.js', 'utf8');
    assert.match(source, /this\.filter = 'empowering'/);
    assert.match(source, /if \(!this\.is247\)\s*\{\s*this\.disconnectTimeout = setTimeout/);
    assert.match(source, /if \(!this\.is247\)\s*\{\s*this\.disconnectTimeout = setTimeout/);
    assert.match(source, /_reconnectPromise/);
});

test('Lavalink applies studio mastering by default and keeps an empty 24/7 queue connected', () => {
    const source = fs.readFileSync('src/utils/musicManager.js', 'utf8');
    assert.match(source, /player\.data\.get\('activeFilter'\) \|\| 'empowering'/);
    assert.match(source, /const stayConnected = isStayConnected\(player\)/);
    assert.match(source, /if \(stayConnected\)\s*\{[\s\S]*?return;\s*\}/);
    assert.match(source, /setCustomId\('ctrl_247'\)/);
});

test('Lavalink 24/7 sessions cleanly stop when the bot is manually disconnected', () => {
    const source = fs.readFileSync('src/utils/musicManager.js', 'utf8');
    assert.match(source, /_starryMusicVoiceExitListener/);
    assert.match(source, /newState\?\.id !== client\.user\?\.id/);
    assert.match(source, /active\.destroy\?\.\(\)/);
});

test('source resolver prefers 192 kbps audio when available and falls back to best audio', () => {
    const source = fs.readFileSync('src/utils/streamResolver.py', 'utf8');
    assert.match(source, /bestaudio\[abr>=320\]\/bestaudio\[abr>=256\]\/bestaudio\[abr>=192\]\/bestaudio\/best/);
});
