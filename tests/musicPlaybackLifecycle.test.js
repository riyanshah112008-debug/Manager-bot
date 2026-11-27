'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { StarryAudioEngine, StarryGuildPlayer } = require('../src/utils/nativeAudioEngine');
const musicManager = require('../src/utils/musicManager');
const musicController = require('../src/modules/musicController');
const searchHelper = require('../src/utils/musicSearchHelper');
const musicCommands = require('../src/commands/bundles/musicCommands');

test('native audio player exposes connect and queue playback lifecycle methods', () => {
    assert.equal(typeof StarryAudioEngine.getOrCreatePlayer, 'function');
    assert.equal(typeof StarryAudioEngine.search, 'function');
    assert.equal(typeof StarryGuildPlayer.prototype.connect, 'function');
    assert.equal(typeof StarryGuildPlayer.prototype.playNext, 'function');
});

test('Lavalink manager exposes player construction and playback event integration', () => {
    assert.equal(typeof musicManager.createMusicManager, 'function');
    assert.equal(typeof musicManager.buildNowPlayingComponents, 'function');
    assert.equal(typeof musicManager.applyKazagumoFilter, 'function');
});

test('music command bundle registers one functional play command', () => {
    const play = musicCommands.find(command => command.name === 'play');
    assert.ok(play, 'play command is registered');
    assert.equal(typeof play.execute, 'function');
    assert.deepEqual(play.aliases, ['p', 'add']);
});

test('request-channel controller exposes request and persistent panel handlers', () => {
    assert.equal(typeof musicController.handleSongRequest, 'function');
    assert.equal(typeof musicController.update, 'function');
    assert.equal(typeof musicController.handleButtonInteraction, 'function');
});

test('music source selector builds interactive source choices', () => {
    const row = searchHelper.buildSearchSourceRow('codacy-regression');
    const ids = row.components.map(component => component.data.custom_id);
    assert.ok(ids.some(id => id.startsWith('search_src_sc:')));
    assert.ok(ids.some(id => id.startsWith('search_src_sp:')));
    assert.ok(ids.some(id => id.startsWith('search_src_ytm:')));
    assert.ok(ids.some(id => id.startsWith('search_src_am:')));
    assert.ok(ids.some(id => id.startsWith('search_src_dz:')));
});

test('duplicate prefix delivery is claimed once per Discord message ID', () => {
    const messageId = 'music-dedup-regression-' + Date.now();
    const ctx = { message: { id: messageId } };
    assert.equal(musicCommands.claimMusicRequest(ctx), true);
    assert.equal(musicCommands.claimMusicRequest(ctx), false);
});

test('music provider searches reject within the configured latency budget', async () => {
    await assert.rejects(
        musicCommands.searchWithTimeout(new Promise(() => {}), 15),
        /2\.6 second resolution budget/
    );
});
