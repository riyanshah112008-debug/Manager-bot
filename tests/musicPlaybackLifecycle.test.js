const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const native = fs.readFileSync(require.resolve('../src/utils/nativeAudioEngine'), 'utf8');
const commands = fs.readFileSync(require.resolve('../src/commands/bundles/musicCommands'), 'utf8');
const search = fs.readFileSync(require.resolve('../src/utils/musicSearchHelper'), 'utf8');
const controller = fs.readFileSync(require.resolve('../src/modules/musicController'), 'utf8');
const musicManager = fs.readFileSync(require.resolve('../src/utils/musicManager'), 'utf8');

test('Starry announces Now Playing only after Discord confirms audio is Playing', () => {
  const play = native.indexOf('this.player.play(this.audioResource)');
  const playing = native.indexOf('await entersState(this.player, AudioPlayerStatus.Playing, 15000)');
  const panel = native.indexOf('await this.sendNowPlayingPanel(track, true)');
  assert.ok(play >= 0 && playing > play && panel > playing);
});

test('Starry advances each failed track only once', () => {
  assert.match(native, /this\._endedTrack === expectedTrack/);
  assert.match(native, /handleTrackEnd\(expectedTrack = this\.currentTrack\)/);
});

test('multi-source search does not wait for SoundCloud token refresh and bounds provider fan-out', () => {
 assert.match(native, /refreshSoundCloudToken\(\)\.catch\(\(\) => \{\}\)/);
 assert.match(native, /timeoutMs = 2600/);
 assert.match(native, /Promise\.all\(\[/);
});
test('multi-source text search caches successful results for repeat queries', () => {
 assert.match(native, /MUSIC_SEARCH_CACHE_TTL_MS = 45_000/);
 assert.match(native, /getCachedMusicSearch\(query\)/);
 assert.match(native, /setCachedMusicSearch\(query,/);
 assert.match(native, /tracks: cachedSearch\.tracks\.map\(track => \(\{ \.\.\.track, requester \}\)\)/);
});

test('Starry searches Spotify, YouTube, SoundCloud, Deezer and Apple Music', () => {
  for (const marker of [
    'spotifyEngine.searchTracks(query, 5)',
    'play.search(query, { limit: 5 })',
    "play.search(query, { source: { soundcloud: 'tracks' }, limit: 5 })",
    'api.deezer.com/search',
    'itunes.apple.com/search'
  ]) assert.ok(native.includes(marker), marker);
});

test('Starry native play does not publish a premature Now Playing panel', () => {
  assert.ok(!commands.includes('Deliver Now Playing embed immediately'));
  assert.ok(!commands.includes('const payload = player.buildNowPlayingPayload(track);'));
  assert.ok(commands.includes('player.loadingMessage = loadingMsg'));
});

test('Starry source selector exposes five services and a separate cancel row', () => {
  for (const marker of ['search_src_sc:', 'search_src_sp:', 'search_src_ytm:', 'search_src_am:', 'search_src_dz:', 'buildSearchCancelRow']) {
    assert.ok(search.includes(marker), marker);
  }
  assert.ok(search.includes("wantedSource = sourceKey === 'am' ? 'Apple Music' : 'Deezer'"));
});

test('Starry keeps Cancel Search available when a provider has no playable results', () => {
  assert.ok(search.includes('components: [buildSearchSourceRow(searchId), buildSearchCancelRow(searchId)]'));
});


test('Kazagumo starts are awaited and only one response is emitted for first-track playback', () => {
  assert.ok(commands.includes('async function startKazagumoPlayback(player, track = null)'));
  assert.ok(commands.includes('const staleIdleTrack = Boolean('));
  assert.ok(commands.includes('await player.destroy()'));
  assert.ok(commands.includes('player = await manager.createPlayer({'));
  assert.ok(commands.includes('await player.play()'));
  assert.ok(commands.includes('await startKazagumoPlayback(player)'));
  assert.ok(commands.includes('playerStart owns the single response after playback starts'));
});

test('request-channel success updates its persistent controller instead of sending duplicate confirmations', () => {
  assert.ok(controller.includes('await kazagumoPlayer.setVoiceChannel(voiceChannel.id)'));
  assert.ok(controller.includes('await kazagumoPlayer.play()'));
  assert.ok(controller.includes('Keep the persistent controller as the only success response.'));
  assert.ok(musicManager.includes("player.data.delete('starryPlaybackStartPending')"));
  assert.ok(musicManager.includes('interaction.deleteReply()'));
  assert.doesNotMatch(controller, /Added to Queue:/);
  assert.doesNotMatch(controller, /Enqueued Playlist:/);
});
