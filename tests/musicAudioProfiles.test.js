process.env.STARRY_DISABLE_STREAM_RESOLVER = '1';
const assert = require('node:assert/strict');
const test = require('node:test');
const {
    applyKazagumoFilter,
    applyPremiumVoiceBitrate,
    PREMIUM_VOICE_BITRATE,
    rankAndFilterCanonicalTracks
} = require('../src/utils/musicManager');

const PROFILES = [
    'clear', 'flat', 'empowering', 'bass', 'bassboost', '8d', 'nightcore',
    'daycore', 'vaporwave', 'lofi', 'reverb', 'karaoke', 'surround',
    'electronic', 'soft', 'radio', 'treble', 'pop'
];

function createPlayer() {
    let applied = null;
    return {
        player: {
            shoukaku: { setFilters: async filters => { applied = filters; } },
            data: new Map()
        },
        getApplied: () => applied
    };
}

test('every dashboard-supported profile applies bounded Lavalink filters', async () => {
    for (const profile of PROFILES) {
        const stub = createPlayer();
        assert.equal(await applyKazagumoFilter(stub.player, profile), true, profile);
        const filters = stub.getApplied();
        assert.ok(filters, profile + ' must call Shoukaku setFilters');
        assert.ok(filters.volume >= 0 && filters.volume <= 1, profile + ' volume must stay at or below unity');
        for (const band of filters.equalizer || []) {
            assert.ok(band.gain >= -0.5 && band.gain <= 0.25, profile + ' EQ gain must remain conservative');
        }
    }
});

test('clear resets every Lavalink filter dimension', async () => {
    const stub = createPlayer();
    assert.equal(await applyKazagumoFilter(stub.player, 'clear'), true);
    const filters = stub.getApplied();
    assert.deepEqual(filters.equalizer, []);
    for (const key of ['timescale', 'karaoke', 'rotation', 'tremolo', 'vibrato', 'lowPass', 'channelMix', 'distortion']) {
        assert.equal(filters[key], null, key + ' must be cleared');
    }
    assert.equal(filters.volume, 1);
});

test('Studio master remains a gentle headroom-safe profile', async () => {
    const stub = createPlayer();
    assert.equal(await applyKazagumoFilter(stub.player, 'empowering'), true);
    const filters = stub.getApplied();
    assert.ok(filters.volume < 1);
    assert.ok(filters.equalizer.some(band => band.band === 5 && band.gain < 0));
    assert.ok(filters.equalizer.some(band => band.band === 9 && band.gain > 0));
});

test('official artist/topic audio ranks above lyric-video and fan uploads', () => {
    const official = { title: 'Song Name (Official Audio)', author: 'Artist - Topic', length: 210000 };
    const lyric = { title: 'Song Name Lyrics Video', author: 'Fan Upload', length: 210000 };
    const ranked = rankAndFilterCanonicalTracks([lyric, official], 'Song Name Artist');
    assert.equal(ranked[0], official);
});


test('384 kbps voice bitrate is restricted to Premium Level 3 servers', async () => {
    let edits = 0;
    const channel = {
        bitrate: 128000,
        edit: async payload => {
            edits += 1;
            assert.equal(payload.bitrate, PREMIUM_VOICE_BITRATE);
            channel.bitrate = payload.bitrate;
        }
    };
    const guild = {
        id: 'guild-premium',
        premiumTier: 3,
        channels: { cache: new Map([['voice-1', channel]]) },
        members: { me: { permissionsIn: () => ({ has: permission => permission === 'ManageChannels' }) } }
    };
    const client = {
        guilds: { cache: new Map([[guild.id, guild]]) },
        isPremium: guildId => guildId === guild.id
    };
    const result = await applyPremiumVoiceBitrate({ guildId: guild.id, voiceId: 'voice-1' }, client);
    assert.equal(result.applied, true);
    assert.equal(channel.bitrate, PREMIUM_VOICE_BITRATE);
    assert.equal(edits, 1);
});

test('non-Premium and non-Level-3 servers never receive the 384 kbps request', async () => {
    let edits = 0;
    const channel = { bitrate: 96000, edit: async () => { edits += 1; } };
    const guild = {
        id: 'guild-basic',
        premiumTier: 3,
        channels: { cache: new Map([['voice-1', channel]]) },
        members: { me: { permissionsIn: () => ({ has: () => true }) } }
    };
    const client = { guilds: { cache: new Map([[guild.id, guild]]) }, isPremium: () => false };
    const basic = await applyPremiumVoiceBitrate({ guildId: guild.id, voiceId: 'voice-1' }, client);
    assert.equal(basic.reason, 'not-premium');
    client.isPremium = () => true;
    guild.premiumTier = 2;
    const lowerTier = await applyPremiumVoiceBitrate({ guildId: guild.id, voiceId: 'voice-1' }, client);
    assert.equal(lowerTier.reason, 'server-not-level-3');
    assert.equal(edits, 0);
});

test('music starts with flat unprocessed audio unless a filter was explicitly selected', async () => {
    const source = require('node:fs').readFileSync(require.resolve('../src/utils/musicManager'), 'utf8');
    assert.match(content, /player\.data\.get\('activeFilter'\) \|\| 'clear'/);
});
