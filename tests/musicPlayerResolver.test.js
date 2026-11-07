const assert = require('assert');
const { selectActiveMusicPlayer, isActiveMusicPlayer } = require('../src/utils/musicPlayerResolver');
const streamResolver = require('../src/utils/streamResolverClient');

console.log('🧪 Testing active Starry music player selection...');

const idleNative = { queue: [], currentTrack: null, isPlaying: false, voiceChannel: { id: 'voice-a' } };
const activeLavalink = { queue: { current: { title: 'Now Playing' }, length: 0 }, playing: true, voiceId: 'voice-b' };
const activeNative = { queue: [], currentTrack: { title: 'Native Track' }, isPlaying: true, voiceChannel: { id: 'voice-c' } };

assert.strictEqual(isActiveMusicPlayer(idleNative), false, 'An idle native player must not shadow active playback');
assert.strictEqual(isActiveMusicPlayer(activeLavalink), true, 'An active Lavalink player must be detected');
assert.strictEqual(selectActiveMusicPlayer([
    { player: idleNative },
    { player: activeLavalink }
]), activeLavalink, 'The active Lavalink player must win over a stale idle native player');
assert.strictEqual(selectActiveMusicPlayer([
    { player: activeLavalink },
    { player: activeNative }
], 'voice-c'), activeNative, 'The player connected to the selected voice channel must win');
assert.strictEqual(selectActiveMusicPlayer([{ player: idleNative }]), idleNative, 'An idle player remains available as a fallback');

console.log('✅ Active player selection tests passed.');
if (streamResolver.process) {
    try { streamResolver.process.kill(); } catch (_) {}
}
process.exit(0);
