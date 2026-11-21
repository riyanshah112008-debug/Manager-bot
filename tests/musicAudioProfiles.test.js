process.env.STARRY_DISABLE_STREAM_RESOLVER = '1';
const assert = require('node:assert/strict');
const test = require('node:test');
const LAVALINK_MIN_GAIN = -1 / 4;
const LAVALINK_HALF_GAIN = 1 / 2;
const { getFilterArgs, FILTER_ARGS } = require('../src/utils/nativeAudioEngine');
const {
    applyKazagumoFilter,
    applyKazagumoEqualizer,
    applyPremiumVoiceBitrate,
    PREMIUM_VOICE_BITRATE,
    rankAndFilterCanonicalTracks
} = require('../src/utils/musicManager');

const PROFILES = [
    'clear', 'empowering', 'bass', '8d', 'nightcore', 'daycore',
    'vaporwave', 'lofi', 'slowwide', 'karaoke', 'stereo',
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
            assert.ok(band.gain >= -0.25 && band.gain <= 0.65, profile + ' EQ gain must remain within Lavalink limits');
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

test('Automatic studio master has fuller bass, clear vocals and safe peak headroom', async () => {
    const stub = createPlayer();
    assert.equal(await applyKazagumoFilter(stub.player, 'empowering'), true);
    const filters = stub.getApplied();
    assert.ok(filters.volume >= 0.70 && filters.volume < 0.85,
        'mastering should retain useful loudness while reserving headroom for cumulative EQ boosts');
    assert.ok(filters.equalizer.some(band => band.band === 1 && band.gain >= 0.09),
        '40 Hz band must provide audible low-bass weight');
    assert.ok(filters.equalizer.some(band => band.band === 2 && band.gain >= 0.08),
        '63 Hz band must provide kick impact');
    assert.ok(filters.equalizer.some(band => band.band === 5 && band.gain < 0),
        '250 Hz cut must control muddiness');
    assert.ok(filters.equalizer.some(band => band.band === 9 && band.gain > 0),
        'vocal presence must remain clear');
    assert.ok(filters.equalizer.every(band => band.gain >= -0.25 && band.gain <= 0.65),
        'EQ gains must remain within Lavalink limits');
});


test('automatic studio master reserves headroom for cumulative EQ peaks', async () => {
    const stub = createPlayer();
    assert.equal(await applyKazagumoFilter(stub.player, 'empowering'), true);
    const filters = stub.getApplied();
    const positiveBoostSum = filters.equalizer.reduce((sum, band) => sum + Math.max(0, band.gain), 0);
    const expectedHeadroomDb = Math.min(4, 0.5 + positiveBoostSum * 2.5);
    const expectedVolume = Math.pow(10, -expectedHeadroomDb / 20);
    assert.ok(Math.abs(filters.volume - expectedVolume) < 1e-10,
        'preamp must account for combined EQ boosts rather than only the strongest band');
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

test('music starts with the automatic balanced studio master unless a filter is explicitly selected', async () => {
    const source = require('node:fs').readFileSync(require.resolve('../src/utils/musicManager'), 'utf8');
    assert.match(source, /player\.data\.get\('activeFilter'\) \|\| 'empowering'/);
});


test('play command applies Premium bitrate before either playback engine starts', () => {
    const playSource = require('node:fs').readFileSync(require.resolve('../src/commands/music/play'), 'utf8');
    assert.match(playSource, /applyPremiumVoiceBitrate\(\{ guildId: interaction\.guild\.id, voiceId: voiceChannel\.id \}, client\)/);
});


test('bass EQ retains strong low-frequency energy with controlled preamp headroom', async () => {
    const stub = createPlayer();
    assert.equal(await applyKazagumoFilter(stub.player, 'bass'), true);
    const filters = stub.getApplied();
    const volumePercent = Math.round(filters.volume * 100);
    assert.ok(volumePercent > 65 && volumePercent < 85,
        'bass profile should preserve useful overall loudness while retaining headroom');
    assert.ok(filters.equalizer.some(band => band.band === 1 && Math.round(band.gain * 100) >= 13),
        '40 Hz low-bass band must retain a controlled audible boost');
    assert.ok(filters.equalizer.some(band => band.band === 2 && Math.round(band.gain * 100) >= 11),
        '63 Hz punch band must retain a controlled audible boost');
    const lowBandBoost = filters.equalizer
        .filter(band => band.band <= 3)
        .reduce((total, band) => total + band.gain, 0);
    assert.ok(lowBandBoost <= 0.65,
        'combined sub-bass and kick boosts must stay below the saturation guardrail');
    assert.ok(filters.equalizer.every(band => band.gain >= -0.25 && band.gain <= 0.65),
        'all EQ bands must remain inside the supported safety range');
});


test('Bass profile keeps tactile low-end impact with bounded Lavalink headroom', async () => {
    const stub = createPlayer();
    assert.equal(await applyKazagumoFilter(stub.player, 'bass'), true);
    const filters = stub.getApplied();
    assert.ok(filters.volume > 0.78 && filters.volume < 0.85);
    assert.ok(filters.equalizer.find(band => band.band === 1)?.gain >= 0.22);
    assert.ok(filters.equalizer.find(band => band.band === 2)?.gain >= 0.18);
    assert.ok(filters.equalizer.find(band => band.band === 5)?.gain <= -0.07);
    assert.ok(filters.equalizer.every(band => band.gain >= LAVALINK_MIN_GAIN && band.gain <= LAVALINK_HALF_GAIN));
});

test('native Bass and Studio profiles use one final limiter and controlled compression', () => {
    for (const profile of ['bass', 'empowering']) {
        const args = getFilterArgs(profile, 100);
        const filterChain = args[1];
        assert.equal((filterChain.match(/alimiter=/g) || []).length, 1, profile + ' must not stack limiters');
    }
    assert.match(FILTER_ARGS.bass[1], /acompressor=/);
    assert.match(FILTER_ARGS.bass[1], /bass=g=3\.8:f=58/);
    assert.match(FILTER_ARGS.bass[1], /equalizer=f=250/);
});

test('each selectable audio mode applies its defining DSP effect', async () => {
    const expected = {
        '8d': filters => Boolean(filters.rotation && filters.rotation.rotationHz > 0),
        nightcore: filters => Boolean(filters.timescale && filters.timescale.speed > 1 && filters.timescale.pitch > 1),
        daycore: filters => Boolean(filters.timescale && filters.timescale.speed < 1 && filters.timescale.pitch < 1),
        vaporwave: filters => Boolean(filters.timescale && filters.tremolo && filters.lowPass),
        lofi: filters => Boolean(filters.lowPass && filters.vibrato),
        slowwide: filters => Boolean(filters.timescale && filters.channelMix),
        karaoke: filters => Boolean(filters.karaoke && filters.equalizer.length === 0),
        stereo: filters => Boolean(filters.channelMix && !filters.rotation),
        electronic: filters => filters.equalizer.some(band => band.band === 1 && band.gain > 0),
        soft: filters => Boolean(filters.lowPass && filters.equalizer.some(band => band.band === 13 && band.gain < 0)),
        radio: filters => filters.equalizer.some(band => band.band === 8 && band.gain > 0),
        treble: filters => filters.equalizer.some(band => band.band === 13 && band.gain > 0),
        pop: filters => filters.equalizer.some(band => band.band === 9 && band.gain > 0),
        empowering: filters => filters.equalizer.some(band => band.band === 5 && band.gain < 0),
        bass: filters => filters.equalizer.some(band => band.band === 1 && band.gain > 0)
    };
    for (const [profile, hasSignature] of Object.entries(expected)) {
        const stub = createPlayer();
        assert.equal(await applyKazagumoFilter(stub.player, profile), true, profile);
        assert.ok(hasSignature(stub.getApplied()), profile + ' must apply its defining sound effect');
    }
});

test('all selectable audio modes have distinct filter signatures', async () => {
    const signatures = new Map();
    for (const profile of PROFILES) {
        const stub = createPlayer();
        assert.equal(await applyKazagumoFilter(stub.player, profile), true, profile);
        const signature = JSON.stringify(stub.getApplied());
        assert.equal(signatures.has(signature), false, profile + ' must not duplicate another mode');
        signatures.set(signature, profile);
    }
});

test('custom five-band EQ maps bounded dB values to safe Lavalink bands',async()=>{
 const stub=createPlayer(),g={subBass:6,bass:4,mids:0,presence:-2,treble:-6};
 assert.equal(await applyKazagumoEqualizer(stub.player,g),true);
 const f=stub.getApplied();assert.ok(f.volume>0&&f.volume<1);assert.equal(f.equalizer.length,15);
 assert.ok(f.equalizer.every(b=>b.gain >= LAVALINK_MIN_GAIN && b.gain <= LAVALINK_HALF_GAIN));
 assert.equal(f.equalizer[0].gain, LAVALINK_HALF_GAIN);assert.equal(f.equalizer[2].gain,4/12);
 assert.equal(f.equalizer[9].gain,-2/24);assert.equal(f.equalizer[14].gain, -6 / 24);
 assert.deepEqual(stub.player.data.get('customEqualizer'),g);
});
test('bass profile reserves headroom for stacked low-frequency boosts',async()=>{
 const stub=createPlayer();
 assert.equal(await applyKazagumoEqualizer(stub.player,{subBass:3,bass:2,mids:-1,presence:0,treble:0}),true);
 const filters=stub.getApplied();
 const expected=Math.pow(10,-6.5/20);
 assert.ok(Math.abs(filters.volume-expected)<1e-10);
 assert.ok(filters.volume<Math.pow(10,-3/20),'headroom must account for both positive bass bands plus safety margin');
});
test('custom EQ clamps values and neutral reset restores unity',async()=>{
 const stub=createPlayer();assert.equal(await applyKazagumoEqualizer(stub.player,{subBass:99,bass:-99}),true);
 assert.equal(stub.getApplied().equalizer[0].gain, LAVALINK_HALF_GAIN);assert.equal(stub.getApplied().equalizer[2].gain, LAVALINK_MIN_GAIN);
 assert.equal(await applyKazagumoEqualizer(stub.player,{}),true);
 assert.ok(stub.getApplied().equalizer.every(b=>b.gain===0));assert.equal(stub.getApplied().volume,1);
});
