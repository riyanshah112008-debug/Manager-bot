'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const { getDiscordGuildBitrateCap, resolveAudioQuality } = require('../src/utils/audioQuality');

test('Starry Premium on a level-three server can use the 384 kbps encoder profile', () => {
    assert.deepEqual(resolveAudioQuality({ premium: true, guildTier: 3, guildMaximumBitrate: 384000, channelBitrate: 384000 }), {
        bitrateKbps: 384,
        bitrate: 384000,
        premium: true,
        label: '384 kbps • Premium'
    });
});

test('free guilds never receive the Premium 384 kbps encoder profile', () => {
    const quality = resolveAudioQuality({ premium: false, guildTier: 3, guildMaximumBitrate: 384000, channelBitrate: 384000 });
    assert.equal(quality.bitrateKbps, 128);
    assert.equal(quality.label, '128 kbps');
});

test('Premium bitrate is capped by the Discord boost tier', () => {
    assert.equal(resolveAudioQuality({ premium: true, guildTier: 2, channelBitrate: 256000 }).bitrateKbps, 256);
    assert.equal(resolveAudioQuality({ premium: true, guildTier: 0, channelBitrate: 384000 }).bitrateKbps, 96);
});

test('Premium bitrate is capped by the actual voice-channel bitrate', () => {
    assert.equal(resolveAudioQuality({ premium: true, guildTier: 3, channelBitrate: 256000 }).bitrateKbps, 256);
});

test('missing channel bitrate safely falls back to the guild boost cap', () => {
    assert.equal(resolveAudioQuality({ premium: true, guildTier: 3 }).bitrateKbps, 384);
    assert.equal(resolveAudioQuality({ premium: false, guildTier: 3 }).bitrateKbps, 128);
});

test('reported guild bitrate cannot exceed its boost-tier cap', () => {
    assert.equal(getDiscordGuildBitrateCap(2, 384000), 256000);
    assert.equal(getDiscordGuildBitrateCap(3, 384000), 384000);
});
