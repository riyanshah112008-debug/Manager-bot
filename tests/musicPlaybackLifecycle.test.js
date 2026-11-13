const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const read = p => fs.readFileSync(path.join(__dirname, '..', p), 'utf8');
const native = read('src/utils/nativeAudioEngine.js');
const commands = read('src/commands/bundles/musicCommands.js');
const search = read('src/utils/musicSearchHelper.js');

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
