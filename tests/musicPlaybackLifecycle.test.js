const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const read = p => fs.readFileSync(path.join(__dirname, '..', p), 'utf8');
const native = read('src/utils/nativeAudioEngine.js');
const commands = read('src/commands/bundles/musicCommands.js');
const search = read('src/utils/musicSearchHelper.js');
const slashPlay = read('src/commands/music/play.js');
const resolverClient = read('src/utils/streamResolverClient.js');

test('Starry announces Now Playing only after Discord confirms audio is Playing', () => {
  const play = native.indexOf('this.player.play(this.audioResource)');
  const playing = native.indexOf('await entersState(this.player, AudioPlayerStatus.Playing, 7000)');
  const panel = native.indexOf('await this.sendNowPlayingPanel(track, true)');
  assert.ok(play >= 0 && playing > play && panel > playing);
});

test('Starry advances each failed track only once', () => {
  assert.match(native, /this\._endedTrack === expectedTrack/);
  assert.match(native, /handleTrackEnd\(expectedTrack = this\.currentTrack\)/);
});

test('multi-source search does not wait for SoundCloud token refresh and bounds provider fan-out', () => {
 assert.match(native, /refreshSoundCloudToken\(\)\.catch\(\(\) => \{\}\)/);
 assert.match(native, /timeoutMs = 2000/);
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


test('native playback overlaps voice connection and uses short bounded source resolution', () => {
  const connectStart = native.indexOf('const connectionReady = this.connect()');
  const configure = native.indexOf('await this.configureAudioQuality()', connectStart);
  const sourceSearch = native.indexOf('play.search(searchQuery, { limit: 1 })', configure);
  const voiceAwait = native.indexOf('await connectionReady', sourceSearch);
  assert.ok(connectStart >= 0 && configure > connectStart && sourceSearch > configure && voiceAwait > sourceSearch,
    'Voice setup must begin before source search and only be awaited after source preparation');
  assert.match(native, /waitForReadyMs: 0, timeoutMs: 900/);
  assert.match(resolverClient, /options\.waitForReadyMs/);
  assert.match(resolverClient, /options\.timeoutMs/);
});

test('playable source results are ranked before metadata-only catalogues', () => {
  assert.match(native, /providerPriority = \{ YouTube: 0, SoundCloud: 1, Spotify: 2/);
});

test('failed streams suppress raw transport errors and false queue-ended notices', () => {
  assert.match(native, /_suppressQueueEndedOnce/);
  assert.doesNotMatch(native, /Could not stream \\*\\*\$\{track\.title\}/);
  assert.match(native, /suppressQueueEnded/);
});

test('prefix and slash play start voice while search is bounded and do not publish premature Now Playing', () => {
  assert.match(commands, /player\.connect\(\)\.catch\(\(\) => \{\}\);[\s\S]{0,180}StarryAudioEngine\.search/);
  assert.match(commands, /setTimeout\(\(\) => resolve\(null\), 2800\)/);
  assert.match(slashPlay, /setTimeout\(\(\) => resolve\(null\), 2800\)/);
  assert.doesNotMatch(slashPlay, /buildNowPlayingPayload\(track\)/);
  assert.match(slashPlay, /player\.playNext\(\)\.catch\(\(\) => \{\}\)/);
});

test('plain text search returns playable YouTube matches before waiting for catalogue APIs', () => {
  const fastPath = native.indexOf('Fast path for ordinary song names');
  const safeSearch = native.indexOf('const safeSearch = async');
  const catalogPromise = native.indexOf('const [spotifyResults, youtubeResults, soundCloudResults');
  assert.ok(fastPath > safeSearch && fastPath < catalogPromise);
  assert.match(native, /play\.search\(query, \{ limit: 5 \}\), 1200/);
  assert.match(native, /providerPriority = \{ YouTube: 0, SoundCloud: 1/);
});

test('both FFmpeg input paths use reduced probe windows for quicker stream startup', () => {
  const analysisWindows = native.match(/'-analyzeduration', '500000'/g) || [];
  const probeWindows = native.match(/'-probesize', '262144'/g) || [];
  assert.equal(analysisWindows.length, 2);
  assert.equal(probeWindows.length, 2);
});
