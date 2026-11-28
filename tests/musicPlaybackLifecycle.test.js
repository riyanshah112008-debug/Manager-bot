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
test('Only the initiating user can cancel an interactive search', () => {
  const cancelBranch = search.indexOf("if (action === 'search_cancel')");
  const expiredGuard = search.indexOf('if (!session)', cancelBranch);
  const ownerGuard = search.indexOf('if (interaction.user.id !== session.userId)', cancelBranch);
  const deleteSession = search.indexOf('searchSessions.delete(searchId)', cancelBranch);
  const deleteMessage = search.indexOf('interaction.message.delete()', cancelBranch);
  assert.ok(cancelBranch >= 0);
  assert.ok(expiredGuard > cancelBranch && expiredGuard < ownerGuard);
  assert.ok(ownerGuard > expiredGuard && ownerGuard < deleteSession);
  assert.ok(deleteSession > ownerGuard && deleteSession < deleteMessage);
});
