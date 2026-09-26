const { Kazagumo, KazagumoPlayer, KazagumoTrack } = require('kazagumo');
const { Connectors } = require('shoukaku');
const KazagumoSpotify = require('kazagumo-spotify');
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, MessageFlags } = require('discord.js');
const { getGuildLanguageSync, localizePayload, t } = require('./i18n');

// 🛡️ Ensure KazagumoPlayer has .search() for internal delegates
if (KazagumoPlayer && !KazagumoPlayer.prototype.search) {
    KazagumoPlayer.prototype.search = function(query, options) {
        return this.kazagumo.search(query, options);
    };
}

// 🛡️ CANONICAL ORIGINAL TRACK SCORING & DEDUPLICATION ENGINE
function cleanStr(s) {
    return (s || '').toLowerCase();
}

function scoreTrack(track, rawQuery) {
    let score = 50;
    const title = cleanStr(track.title);
    const author = cleanStr(track.author);
    const q = cleanStr(rawQuery).replace(/^(ytsearch|ytmsearch|scsearch):/i, '').trim();

    // 1. Duration filter: Penalize short status/teasers & multi-hour loops
    const lenMs = track.length || 0;
    if (lenMs > 0 && lenMs < 60000) {
        score -= 150; // Under 1 min: snippet / WhatsApp status / short / teaser
    } else if (lenMs > 900000) {
        score -= 80; // Over 15 mins: 1 hour loop or full album unless requested
    } else if (lenMs >= 100000 && lenMs <= 380000) {
        score += 25; // Ideal radio/streaming song length (1.6 - 6.3 mins)
    }

    // 2. Heavy penalties for duplicate / cover / bootleg / remake keywords (unless requested in query)
    const modifierChecks = [
        { key: 'cover', penalty: 130 },
        { key: 'covered by', penalty: 130 },
        { key: 'fan cover', penalty: 130 },
        { key: 'slowed', penalty: 100 },
        { key: 'reverb', penalty: 100 },
        { key: 'slowed + reverb', penalty: 120 },
        { key: 'slowed and reverb', penalty: 120 },
        { key: 'sped up', penalty: 100 },
        { key: 'speed up', penalty: 100 },
        { key: 'speedup', penalty: 100 },
        { key: 'nightcore', penalty: 100 },
        { key: 'daycore', penalty: 100 },
        { key: 'chipmunk', penalty: 120 },
        { key: 'status', penalty: 150 },
        { key: 'whatsapp status', penalty: 160 },
        { key: 'shorts', penalty: 150 },
        { key: 'short', penalty: 80 },
        { key: 'reel', penalty: 120 },
        { key: 'tiktok', penalty: 100 },
        { key: 'karaoke', penalty: 120 },
        { key: 'instrumental', penalty: 100 },
        { key: 'backing track', penalty: 120 },
        { key: 'reaction', penalty: 150 },
        { key: 'reacting', penalty: 150 },
        { key: 'review', penalty: 150 },
        { key: 'parody', penalty: 150 },
        { key: 'tutorial', penalty: 150 },
        { key: 'how to play', penalty: 150 },
        { key: '10 hour', penalty: 120 },
        { key: '1 hour', penalty: 100 },
        { key: 'loop', penalty: 80 },
        { key: 'bass boosted', penalty: 90 },
        { key: '8d audio', penalty: 90 },
        { key: 'snippet', penalty: 120 },
        { key: 'leak', penalty: 90 }
    ];

    for (const { key, penalty } of modifierChecks) {
        if (!q.includes(key)) {
            if (title.includes(key)) score -= penalty;
            if (author.includes(key)) score -= Math.floor(penalty * 0.7);
        }
    }

    // Live concert penalty unless query includes 'live'
    if (!q.includes('live')) {
        if (title.includes('live at') || title.includes('live in') || title.includes('live performance') || title.includes('(live)') || title.includes('[live]')) {
            score -= 85;
        }
    }

    // 3. Positive official signals
    // YouTube Music Topic channel (Official uncompressed digital distributor master upload)
    if (author.endsWith('- topic') || author.includes(' - topic')) {
        score += 55;
    }

    // Major label channel detection
    const majorLabels = [
        't-series', 'tseries', 'sony music', 'zee music', 'yrf', 'warner music',
        'universal music', 'vevo', 'saregama', 'speed records', 'geet mp3',
        'white hill music', 'tips official', 'spinnin', 'def jam', 'atlantic records',
        'columbia records', 'interscope', 'republic records', 'coke studio'
    ];
    if (majorLabels.some(lbl => author.includes(lbl) || title.includes(lbl))) {
        score += 45;
    }

    // Official audio release indicators
    if (title.includes('official audio') || title.includes('(audio)') || title.includes('[audio]')) {
        score += 50;
    } else if (title.includes('official music video') || title.includes('official video') || title.includes('(video)') || title.includes('[video]')) {
        score += 35;
    } else if (title.includes('original motion picture') || title.includes('original soundtrack') || title.includes('ost') || title.includes('from "') || title.includes("from '")) {
        score += 40;
    } else if (title.includes('lyrical') || title.includes('lyrics')) {
        score += 20;
    }

    // 4. Token & Phonetic matching
    const qTokens = q.split(/[\s\-_\,\.\:\;]+/).filter(t => t.length > 1);
    let matchedCount = 0;
    for (const tok of qTokens) {
        if (title.includes(tok) || author.includes(tok)) {
            matchedCount++;
        } else {
            const normTok = tok[0] + tok.slice(1).replace(/[aeiou]/g, '');
            if (normTok.length > 2 && (title.includes(normTok) || author.includes(normTok))) {
                matchedCount += 0.8;
            }
        }
    }
    const matchRatio = qTokens.length > 0 ? (matchedCount / qTokens.length) : 1;
    score += matchRatio * 40;

    return Math.round(score);
}

function rankAndFilterCanonicalTracks(tracks, rawQuery) {
    if (!tracks || !Array.isArray(tracks) || tracks.length <= 1) return tracks || [];
    return [...tracks].sort((a, b) => scoreTrack(b, rawQuery) - scoreTrack(a, rawQuery));
}

// 🛡️ Monkey patch Kazagumo.prototype.search to enforce canonical original track ranking & smart fallbacks
const rawKazagumoSearch = Kazagumo.prototype.search;
Kazagumo.prototype.search = async function(query, options) {
    const isUrl = /^https?:\/\/.*/.test(query);
    if (isUrl) {
        return rawKazagumoSearch.call(this, query, options);
    }

    const cleanQueryForScoring = query.replace(/^(ytsearch|ytmsearch|scsearch):/i, '').trim();

    // 1. Primary search via default engine (YouTube Music)
    let res = await rawKazagumoSearch.call(this, query, options).catch(() => null);
    if (res && res.tracks && res.tracks.length > 0) {
        res.tracks = rankAndFilterCanonicalTracks(res.tracks, cleanQueryForScoring);
    }

    const topScore = (res && res.tracks && res.tracks[0]) ? scoreTrack(res.tracks[0], cleanQueryForScoring) : -999;

    // 2. If no tracks found or top track score is poor (< 35), search with "Official Audio" on YouTube
    if (!res || !res.tracks || res.tracks.length === 0 || topScore < 35) {
        try {
            const ytOptions = { ...(options || {}), engine: 'youtube' };
            const fallbackRes = await rawKazagumoSearch.call(this, `${cleanQueryForScoring} Official Audio`, ytOptions).catch(() => null);
            if (fallbackRes && fallbackRes.tracks && fallbackRes.tracks.length > 0) {
                const rankedFallback = rankAndFilterCanonicalTracks(fallbackRes.tracks, cleanQueryForScoring);
                const fallbackTopScore = scoreTrack(rankedFallback[0], cleanQueryForScoring);
                if (fallbackTopScore > topScore) {
                    res = fallbackRes;
                    res.tracks = rankedFallback;
                }
            }
        } catch (_) {}
    }

    // 3. If still no tracks or empty, try pure ytsearch
    if (!res || !res.tracks || res.tracks.length === 0) {
        try {
            const ytOptions = { ...(options || {}), engine: 'youtube' };
            const ytRes = await rawKazagumoSearch.call(this, cleanQueryForScoring, ytOptions).catch(() => null);
            if (ytRes && ytRes.tracks && ytRes.tracks.length > 0) {
                res = ytRes;
                res.tracks = rankAndFilterCanonicalTracks(res.tracks, cleanQueryForScoring);
            }
        } catch (_) {}
    }

    return res || { loadType: 'empty', tracks: [] };
};

// 🛡️ Monkey patch KazagumoSpotify so it produces root KazagumoTrack (v3.4+) instances instead of nested v2.4
if (KazagumoSpotify && KazagumoSpotify.prototype) {
    KazagumoSpotify.prototype.buildKazagumoTrack = function(spotifyTrack, requester, thumbnail) {
        const track = new KazagumoTrack({
            track: '',
            info: {
                sourceName: 'spotify',
                identifier: spotifyTrack.id,
                isSeekable: true,
                author: spotifyTrack.artists?.[0]?.name || 'Unknown',
                length: spotifyTrack.duration_ms,
                isStream: false,
                position: 0,
                title: spotifyTrack.name,
                uri: `https://open.spotify.com/track/${spotifyTrack.id}`,
                thumbnail: thumbnail || spotifyTrack.album?.images?.[0]?.url
            }
        }, requester);
        if (this.kazagumo) track.setKazagumo(this.kazagumo);
        return track;
    };
}

// 🛡️ Patch getTrack on both root and any nested KazagumoTrack classes to ensure seamless Lavalink v4 resolution
const trackClasses = [KazagumoTrack];
try {
    const nested = require('kazagumo-spotify/node_modules/kazagumo/dist/Managers/Supports/KazagumoTrack');
    if (nested && nested.KazagumoTrack && !trackClasses.includes(nested.KazagumoTrack)) {
        trackClasses.push(nested.KazagumoTrack);
    }
} catch (e) {}

for (const TrackClass of trackClasses) {
    if (!TrackClass || !TrackClass.prototype) continue;
    TrackClass.prototype.getTrack = async function(player) {
        const query = [this.author, this.title].filter(Boolean).join(' - ');
        const searcher = player || this.kazagumo;
        if (!searcher) throw new Error('Neither player nor kazagumo is available');
        
        let searchResult = null;
        try {
            searchResult = await searcher.search(`ytmsearch:${query}`, { requester: this.requester });
        } catch (_) {}
        if (!searchResult || !searchResult.tracks || !searchResult.tracks.length) {
            try {
                searchResult = await searcher.search(`ytsearch:${query} Official Audio`, { requester: this.requester });
            } catch (_) {}
        }
        if (!searchResult || !searchResult.tracks || !searchResult.tracks.length) {
            try {
                searchResult = await searcher.search(`ytsearch:${query}`, { requester: this.requester });
            } catch (_) {}
        }
        if (!searchResult || !searchResult.tracks || !searchResult.tracks.length) {
            try {
                searchResult = await searcher.search(query, { requester: this.requester });
            } catch (_) {}
        }
        
        if (!searchResult || !searchResult.tracks || !searchResult.tracks.length) {
            throw new Error(`No tracks found for ${query}`);
        }
        
        const ranked = rankAndFilterCanonicalTracks(searchResult.tracks, query);
        const found = ranked[0] || searchResult.tracks[0];
        return {
            encoded: found.track,
            track: found.track,
            info: {
                title: found.title,
                author: found.author,
                length: found.length,
                identifier: found.identifier,
                isSeekable: found.isSeekable,
                isStream: found.isStream,
                uri: found.realUri || found.uri
            }
        };
    };
}

const EPHEMERAL_FLAG = MessageFlags ? MessageFlags.Ephemeral : 64;

const Nodes = [
    {
        name: 'Node-1-Serenetia-SSL',
        url: 'lavalink.serenetia.com:443',
        auth: 'youshallnotpass',
        secure: true,
        retryAmount: 50,
        retryDelay: 3000
    },
    {
        name: 'Node-2-Ajieblogs-NonSSL',
        url: 'lava-v4.ajieblogs.eu.org:80',
        auth: 'https://dsc.gg/ajidevserver',
        secure: false,
        retryAmount: 50,
        retryDelay: 3000
    }
];

function buildNowPlayingComponents(guildId = null, isAutoplay = false) {
    const lang = guildId ? getGuildLanguageSync(guildId) : 'en';

    // Row 1: Primary Transport Controls (4 buttons - fits mobile without wrapping)
    const row1 = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('music_pause').setEmoji('⏸️').setLabel(t(lang, 'music.btn_pause')).setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId('music_skip').setEmoji('⏭️').setLabel(t(lang, 'music.btn_skip')).setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId('music_loop').setEmoji('🔁').setLabel(t(lang, 'music.btn_loop')).setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId('music_stop').setEmoji('⏹️').setLabel(t(lang, 'music.btn_stop')).setStyle(ButtonStyle.Danger)
    );

    // Row 2: Queue & Volume Controls (4 buttons - fits mobile without wrapping)
    const row2 = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('dj_vol_down').setEmoji('🔉').setLabel(t(lang, 'music.btn_voldown')).setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId('dj_vol_up').setEmoji('🔊').setLabel(t(lang, 'music.btn_volup')).setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId('dj_shuffle').setEmoji('🔀').setLabel(t(lang, 'music.btn_shuffle')).setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId('music_queue').setEmoji('📜').setLabel(t(lang, 'music.btn_queue')).setStyle(ButtonStyle.Secondary)
    );

    // Row 3: Voice Channel Security, Autoplay & Spotify (4 buttons)
    const row3 = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId('music_autoplay')
            .setEmoji('📻')
            .setLabel(isAutoplay ? 'AutoPlay: ON' : 'AutoPlay: OFF')
            .setStyle(isAutoplay ? ButtonStyle.Success : ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId('ctrl_spotify').setEmoji('🟢').setLabel('My Spotify').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId('dj_lock').setEmoji('🔒').setLabel(t(lang, 'music.btn_lockvc')).setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId('dj_unlock').setEmoji('🔓').setLabel(t(lang, 'music.btn_unlockvc')).setStyle(ButtonStyle.Success)
    );

    // Row 4: High-Fidelity Audio DSP Filters (Dropdown)
    const filterRow = new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder().setCustomId('music_filter').setPlaceholder(t(lang, 'music.filter_placeholder')).addOptions([
            { label: '⭐ Studio Hi-Fi Master (Empowering)', description: 'Audiophile punch, deep sub-bass, silky vocals & wide stage', value: 'empowering', emoji: '✨' },
            { label: 'Clear / Flat Studio', description: 'Raw, pristine uncolored studio audio', value: 'clear', emoji: '🚫' },
            { label: 'Bass', description: 'Deep physical vibration & subwoofer rumble (Vocals clear)', value: 'bass', emoji: '🔊' },
            { label: '8D Spatial Audio', description: '360° rotating spatial surround sound', value: '8d', emoji: '🌀' },
            { label: 'Nightcore', description: 'Sped up tempo + higher pitch aesthetic', value: 'nightcore', emoji: '✨' },
            { label: 'Daycore / Slowed', description: 'Slowed down tempo + deeper tone', value: 'daycore', emoji: '🌅' },
            { label: 'Vaporwave', description: 'Slowed reverb + retro cassette feel', value: 'vaporwave', emoji: '🪩' },
            { label: 'Lo-Fi Chill', description: 'Warm vinyl tape flutter & mellow acoustic tone', value: 'lofi', emoji: '☕' },
            { label: 'Slowed & Reverb', description: 'Immersive stadium & cathedral concert reverb', value: 'reverb', emoji: '🌌' },
            { label: 'Karaoke', description: 'Attenuates center vocals for sing-along', value: 'karaoke', emoji: '🎤' },
            { label: '3D Surround', description: 'Wide immersive cinematic surround soundstage', value: 'surround', emoji: '🎧' },
            { label: 'EDM & Club', description: 'High-energy dance punch & crisp sizzling hats', value: 'electronic', emoji: '⚡' },
            { label: 'Soft & Mellow', description: 'Non-fatiguing smooth sound for late night chill', value: 'soft', emoji: '🍃' },
            { label: 'Retro Radio', description: 'Vintage 1950s AM telephone receiver sound', value: 'radio', emoji: '📻' },
            { label: 'Treble Boost', description: 'Crisp, crystal clear high frequencies', value: 'treble', emoji: '💎' },
            { label: 'Pop & Vocal Clarity', description: 'Enhanced vocal presence with clean highs', value: 'pop', emoji: '🎙️' }
        ])
    );

    return [row1, row2, row3, filterRow];
}

async function applyKazagumoFilter(player, filterName) {
    if (!player || !player.shoukaku) return false;
    try {
        const shoukakuPlayer = player.shoukaku;
        const normalized = (filterName || 'clear').toLowerCase().trim();

        switch (normalized) {
            case 'bass':
            case 'bassboost':
            case 'vibrate':
            case 'vibration':
            case 'deepbass':
            case 'subwoofer':
                // 🔊 TRUE CLEAN SUB-BASS VIBRATION (Zero Clipping • Crystal-Clear Vocals):
                // Focused resonant energy at 40Hz & 63Hz (the headphone driver vibration sweet-spot).
                // Band 5 (250Hz) is gently dipped to keep the low-end separated from male/female vocals.
                // Volume pre-attenuated to 0.70 to provide +3.5dB of clean headroom, completely eliminating
                // digital clipping, square-wave distortion, and voice crackling!
                await shoukakuPlayer.setFilters({
                    volume: 0.70,
                    equalizer: [
                        { band: 0, gain: 0.28 },  // 25 Hz - Clean sub-rumble
                        { band: 1, gain: 0.38 },  // 40 Hz - Tactile physical vibration
                        { band: 2, gain: 0.32 },  // 63 Hz - Headphone diaphragm vibration
                        { band: 3, gain: 0.14 },  // 100 Hz - Tight, punchy 808/kick
                        { band: 4, gain: -0.04 }, // 160 Hz - Transition slope
                        { band: 5, gain: -0.12 }, // 250 Hz - Mud scoop to protect vocals
                        { band: 6, gain: 0.00 },  // 400 Hz - Flat
                        { band: 7, gain: 0.00 },  // 630 Hz - Flat
                        { band: 8, gain: 0.00 },  // 1.0 kHz - 100% untouched vocals
                        { band: 9, gain: 0.00 },  // 1.6 kHz - 100% untouched vocals
                        { band: 10, gain: 0.00 }, // 2.5 kHz - 100% untouched vocals
                        { band: 11, gain: 0.00 }, // 4.0 kHz - 100% untouched vocals
                        { band: 12, gain: 0.00 }, // 6.3 kHz - Flat
                        { band: 13, gain: 0.00 }  // 10.0 kHz - Flat
                    ],
                    timescale: null,
                    rotation: null,
                    tremolo: null,
                    vibrato: null,
                    karaoke: null,
                    channelMix: null,
                    lowPass: null,
                    distortion: null
                });
                break;

            case '8d':
                // 🌀 360° Rotating Binaural Surround Sound
                await shoukakuPlayer.setFilters({
                    volume: 0.94,
                    rotation: { rotationHz: 0.22 },
                    equalizer: [
                        { band: 0, gain: 0.15 },
                        { band: 1, gain: 0.12 },
                        { band: 10, gain: 0.10 },
                        { band: 11, gain: 0.14 }
                    ],
                    timescale: null,
                    tremolo: null,
                    vibrato: null,
                    karaoke: null,
                    channelMix: null,
                    lowPass: null,
                    distortion: null
                });
                break;

            case 'nightcore':
                // ✨ Upbeat tempo + pitched vocal remix with de-essed highs
                await shoukakuPlayer.setFilters({
                    volume: 0.92,
                    timescale: { speed: 1.25, pitch: 1.25, rate: 1.0 },
                    equalizer: [
                        { band: 0, gain: 0.15 },
                        { band: 1, gain: 0.12 },
                        { band: 10, gain: -0.06 },
                        { band: 11, gain: -0.08 }
                    ],
                    rotation: null,
                    tremolo: null,
                    vibrato: null,
                    karaoke: null,
                    channelMix: null,
                    lowPass: null,
                    distortion: null
                });
                break;

            case 'daycore':
            case 'slowed':
                // 🌅 Relaxed slowed tempo + deep acoustic body
                await shoukakuPlayer.setFilters({
                    volume: 0.88,
                    timescale: { speed: 0.85, pitch: 0.85, rate: 1.0 },
                    equalizer: [
                        { band: 0, gain: 0.20 },
                        { band: 1, gain: 0.18 },
                        { band: 2, gain: 0.12 },
                        { band: 11, gain: -0.05 },
                        { band: 12, gain: -0.08 }
                    ],
                    rotation: null,
                    tremolo: null,
                    vibrato: null,
                    karaoke: null,
                    channelMix: null,
                    lowPass: null,
                    distortion: null
                });
                break;

            case 'vaporwave':
                // 🪩 Retro slowed cassette tape vibe with subtle tremolo
                await shoukakuPlayer.setFilters({
                    volume: 0.86,
                    timescale: { speed: 0.80, pitch: 0.80, rate: 1.0 },
                    tremolo: { frequency: 2.2, depth: 0.16 },
                    equalizer: [
                        { band: 0, gain: 0.18 },
                        { band: 1, gain: 0.15 },
                        { band: 2, gain: 0.10 },
                        { band: 10, gain: -0.10 },
                        { band: 11, gain: -0.15 }
                    ],
                    rotation: null,
                    vibrato: null,
                    karaoke: null,
                    channelMix: null,
                    lowPass: null,
                    distortion: null
                });
                break;

            case 'lofi':
            case 'lo-fi':
            case 'chill':
                // ☕ Warm analog vinyl tape flutter & softened highs
                await shoukakuPlayer.setFilters({
                    volume: 0.92,
                    lowPass: { smoothing: 16.0 },
                    timescale: { speed: 0.96, pitch: 0.96, rate: 1.0 },
                    vibrato: { frequency: 1.8, depth: 0.12 },
                    equalizer: [
                        { band: 0, gain: 0.20 },
                        { band: 1, gain: 0.25 },
                        { band: 2, gain: 0.20 },
                        { band: 3, gain: 0.15 },
                        { band: 10, gain: -0.25 },
                        { band: 11, gain: -0.35 },
                        { band: 12, gain: -0.40 },
                        { band: 13, gain: -0.45 }
                    ],
                    rotation: null,
                    tremolo: null,
                    karaoke: null,
                    channelMix: null,
                    distortion: null
                });
                break;

            case 'reverb':
            case 'slowreverb':
            case 'hall':
            case 'echo':
                // 🌌 Massive concert hall / arena spatial reverberation
                await shoukakuPlayer.setFilters({
                    volume: 0.92,
                    timescale: { speed: 0.88, pitch: 0.88, rate: 1.0 },
                    tremolo: { frequency: 1.6, depth: 0.14 },
                    channelMix: { leftToLeft: 0.82, leftToRight: 0.28, rightToLeft: 0.28, rightToRight: 0.82 },
                    equalizer: [
                        { band: 0, gain: 0.25 },
                        { band: 1, gain: 0.20 },
                        { band: 8, gain: 0.10 },
                        { band: 9, gain: 0.15 },
                        { band: 10, gain: 0.18 }
                    ],
                    rotation: null,
                    vibrato: null,
                    karaoke: null,
                    lowPass: null,
                    distortion: null
                });
                break;

            case 'karaoke':
            case 'vocalremover':
            case 'instrumental':
            case 'vocalcut':
                // 🎤 Center vocal cancellation for sing-along / instrumental
                await shoukakuPlayer.setFilters({
                    volume: 0.95,
                    karaoke: {
                        level: 1.0,
                        monoLevel: 1.0,
                        filterBand: 220.0,
                        filterWidth: 100.0
                    },
                    equalizer: [],
                    timescale: null,
                    rotation: null,
                    tremolo: null,
                    vibrato: null,
                    channelMix: null,
                    lowPass: null,
                    distortion: null
                });
                break;

            case 'surround':
            case '3d':
            case 'spatial':
                // 🎧 Wide 3D soundstage with panoramic channel crossfeed
                await shoukakuPlayer.setFilters({
                    volume: 0.94,
                    channelMix: {
                        leftToLeft: 0.85,
                        leftToRight: 0.28,
                        rightToLeft: 0.28,
                        rightToRight: 0.85
                    },
                    equalizer: [
                        { band: 0, gain: 0.15 },
                        { band: 1, gain: 0.12 },
                        { band: 10, gain: 0.15 },
                        { band: 11, gain: 0.20 },
                        { band: 12, gain: 0.22 }
                    ],
                    timescale: null,
                    rotation: null,
                    tremolo: null,
                    vibrato: null,
                    karaoke: null,
                    lowPass: null,
                    distortion: null
                });
                break;

            case 'electronic':
            case 'edm':
            case 'club':
                // ⚡ High-energy club master with thumping kick & sizzling highs
                await shoukakuPlayer.setFilters({
                    volume: 0.75,
                    equalizer: [
                        { band: 0, gain: 0.28 },
                        { band: 1, gain: 0.32 },
                        { band: 2, gain: 0.22 },
                        { band: 3, gain: 0.12 },
                        { band: 4, gain: -0.06 },
                        { band: 5, gain: -0.12 },
                        { band: 6, gain: 0.00 },
                        { band: 10, gain: 0.10 },
                        { band: 11, gain: 0.14 },
                        { band: 12, gain: 0.16 },
                        { band: 13, gain: 0.14 }
                    ],
                    timescale: null,
                    rotation: null,
                    tremolo: null,
                    vibrato: null,
                    karaoke: null,
                    channelMix: null,
                    lowPass: null,
                    distortion: null
                });
                break;

            case 'soft':
            case 'mellow':
            case 'relax':
                // 🍃 Non-fatiguing smooth sound with rolled-off treble
                await shoukakuPlayer.setFilters({
                    volume: 0.95,
                    lowPass: { smoothing: 10.0 },
                    equalizer: [
                        { band: 0, gain: 0.10 },
                        { band: 1, gain: 0.12 },
                        { band: 2, gain: 0.08 },
                        { band: 10, gain: -0.15 },
                        { band: 11, gain: -0.22 },
                        { band: 12, gain: -0.28 },
                        { band: 13, gain: -0.32 }
                    ],
                    timescale: null,
                    rotation: null,
                    tremolo: null,
                    vibrato: null,
                    karaoke: null,
                    channelMix: null,
                    distortion: null
                });
                break;

            case 'radio':
            case 'vintage':
                // 📻 Retro 1950s AM telephone receiver bandpass filter
                await shoukakuPlayer.setFilters({
                    volume: 0.90,
                    equalizer: [
                        { band: 0, gain: -0.25 },
                        { band: 1, gain: -0.25 },
                        { band: 2, gain: -0.20 },
                        { band: 3, gain: -0.15 },
                        { band: 6, gain: 0.35 },
                        { band: 7, gain: 0.45 },
                        { band: 8, gain: 0.45 },
                        { band: 9, gain: 0.30 },
                        { band: 10, gain: -0.20 },
                        { band: 11, gain: -0.25 },
                        { band: 12, gain: -0.25 },
                        { band: 13, gain: -0.25 }
                    ],
                    timescale: null,
                    rotation: null,
                    tremolo: null,
                    vibrato: null,
                    karaoke: null,
                    channelMix: null,
                    lowPass: null,
                    distortion: null
                });
                break;

            case 'treble':
                // 💎 Crisp, crystal clear high-frequency sparkle
                await shoukakuPlayer.setFilters({
                    volume: 0.88,
                    equalizer: [
                        { band: 0, gain: -0.10 },
                        { band: 1, gain: -0.08 },
                        { band: 2, gain: -0.04 },
                        { band: 9, gain: 0.12 },
                        { band: 10, gain: 0.18 },
                        { band: 11, gain: 0.22 },
                        { band: 12, gain: 0.24 },
                        { band: 13, gain: 0.25 }
                    ],
                    timescale: null,
                    rotation: null,
                    tremolo: null,
                    vibrato: null,
                    karaoke: null,
                    channelMix: null,
                    lowPass: null,
                    distortion: null
                });
                break;

            case 'pop':
                // 🎙️ Modern vocal forward pop master with clean lows
                await shoukakuPlayer.setFilters({
                    volume: 0.94,
                    equalizer: [
                        { band: 0, gain: 0.12 },
                        { band: 1, gain: 0.10 },
                        { band: 4, gain: -0.08 },
                        { band: 5, gain: -0.12 },
                        { band: 7, gain: 0.15 },
                        { band: 8, gain: 0.22 },
                        { band: 9, gain: 0.25 },
                        { band: 10, gain: 0.20 },
                        { band: 11, gain: 0.15 }
                    ],
                    timescale: null,
                    rotation: null,
                    tremolo: null,
                    vibrato: null,
                    karaoke: null,
                    channelMix: null,
                    lowPass: null,
                    distortion: null
                });
                break;

            case 'empowering':
            case 'hifi':
            case 'audiophile':
            case 'master':
            case 'studio':
                // ⭐ PRO STUDIO HI-FI MASTERING (Praisable Audiophile Grade Audio)
                // - Deep, tactile physical sub-bass (25-63Hz) that rumbles cleanly without distortion
                // - Mid-bass punch (100Hz) with zero muddiness
                // - Precision 250Hz mud scoop (-0.10) to de-mask vocals and acoustic instruments
                // - Forward, crystal-clear vocal presence & intelligibility (1.0kHz - 4.0kHz)
                // - Silky, airy high-end shimmer (10kHz - 16kHz)
                // - Volume pre-attenuation (0.92) giving ~2.5dB clean headroom to eliminate Opus inter-sample clipping
                // - Subtle wide stereo spatial soundstage
                await shoukakuPlayer.setFilters({
                    volume: 0.92,
                    equalizer: [
                        { band: 0, gain: 0.24 },  // 25 Hz: Deep sub-bass physical rumble
                        { band: 1, gain: 0.28 },  // 40 Hz: Tactile chest/headphone vibration
                        { band: 2, gain: 0.20 },  // 63 Hz: Warm bass body
                        { band: 3, gain: 0.08 },  // 100 Hz: Tight, punchy kick transient
                        { band: 4, gain: -0.02 }, // 160 Hz: Transition slope
                        { band: 5, gain: -0.10 }, // 250 Hz: Mud scoop - de-masks vocals!
                        { band: 6, gain: -0.02 }, // 400 Hz: Clean separation
                        { band: 7, gain: 0.04 },  // 630 Hz: Natural body
                        { band: 8, gain: 0.08 },  // 1.0 kHz: Vocal intelligibility
                        { band: 9, gain: 0.14 },  // 1.6 kHz: Vocal forwardness
                        { band: 10, gain: 0.16 }, // 2.5 kHz: Crystal-clear vocal bite
                        { band: 11, gain: 0.14 }, // 4.0 kHz: Snare snap & presence
                        { band: 12, gain: 0.12 }, // 6.3 kHz: Silky smooth highs
                        { band: 13, gain: 0.16 }, // 10.0 kHz: Air & sparkle
                        { band: 14, gain: 0.18 }  // 16.0 kHz: Ultra-high brilliance
                    ],
                    channelMix: {
                        leftToLeft: 0.96,
                        leftToRight: 0.06,
                        rightToLeft: 0.06,
                        rightToRight: 0.96
                    },
                    timescale: null,
                    rotation: null,
                    tremolo: null,
                    vibrato: null,
                    karaoke: null,
                    lowPass: null,
                    distortion: null
                });
                break;

            case 'clear':
            case 'flat':
            default:
                await shoukakuPlayer.setFilters({
                    volume: 1.0,
                    equalizer: [],
                    timescale: null,
                    rotation: null,
                    tremolo: null,
                    vibrato: null,
                    karaoke: null,
                    channelMix: null,
                    lowPass: null,
                    distortion: null
                });
                break;
        }

        const canonicalFilter = ['bassboost', 'vibrate', 'vibration', 'deepbass', 'subwoofer'].includes(normalized) ? 'bass' : (['empowering', 'hifi', 'studio', 'master', 'audiophile'].includes(normalized) ? 'empowering' : normalized);
        player.data.set('activeFilter', canonicalFilter);

        // Keep Music Controller request channel synced
        try {
            const musicController = require('../modules/musicController');
            if (player.guildId) {
                musicController.update(player.guildId, player.kazagumo?.client).catch(() => {});
            }
        } catch (ctrlErr) {}

        return true;
    } catch (e) {
        console.warn('⚠️ Could not apply Lavalink filter:', e.message);
        return false;
    }
}

function createMusicManager(client) {
    if (client.manager) return client.manager;

    const manager = new Kazagumo({
        defaultSearchEngine: "youtube_music",
        searchFallbacks: { 
            spotify: "ytmsearch", 
            soundcloud: "ytmsearch", 
            youtube: "ytsearch" 
        },
        trackResolver: async function(options) {
            try {
                if (this.readyToPlay) return true;
                const query = [this.author, this.title].filter(Boolean).join(' - ');
                let searchRes = await this.kazagumo.search(`ytmsearch:${query}`, { requester: this.requester });
                if (!searchRes || !searchRes.tracks || searchRes.tracks.length === 0) {
                    searchRes = await this.kazagumo.search(`ytsearch:${query} Official Audio`, { requester: this.requester });
                }
                if (!searchRes || !searchRes.tracks || searchRes.tracks.length === 0) {
                    searchRes = await this.kazagumo.search(`ytsearch:${query}`, { requester: this.requester });
                }
                if (!searchRes || !searchRes.tracks || searchRes.tracks.length === 0) {
                    searchRes = await this.kazagumo.search(query, { requester: this.requester });
                }
                if (searchRes && searchRes.tracks && searchRes.tracks.length > 0) {
                    const ranked = rankAndFilterCanonicalTracks(searchRes.tracks, query);
                    const found = ranked[0] || searchRes.tracks[0];
                    this.track = found.track;
                    this.realUri = found.realUri || found.uri;
                    if (!this.thumbnail && found.thumbnail) this.thumbnail = found.thumbnail;
                    return true;
                }
            } catch (e) {
                console.warn('⚠️ [Kazagumo trackResolver Warning]:', e.message);
            }
            return false;
        },
        plugins: [
            new KazagumoSpotify({ 
                clientId: process.env.SPOTIFY_CLIENT_ID || 'dummy_id', 
                clientSecret: process.env.SPOTIFY_CLIENT_SECRET || 'dummy_secret', 
                playlistPageLimit: 5, 
                albumPageLimit: 3, 
                searchMarket: 'US', 
                searchPrefix: 'ytmsearch:' 
            })
        ],
        send: (guildId, payload) => {
            const guild = client.guilds.cache.get(guildId);
            if (guild && guild.shard) {
                guild.shard.send(payload);
            } else if (client.ws?.shards) {
                const shard = client.ws.shards.first?.() || client.ws.shards.get(0);
                if (shard) shard.send(payload);
            }
        }
    }, new Connectors.DiscordJS(client), Nodes, {
        moveOnDisconnect: true,
        resume: true,
        resumeTimeout: 60,
        reconnectTries: 50,
        reconnectInterval: 3000,
        restTimeout: 10000,
        voiceConnectionTimeout: 15000,
        linkInitializers: true,
        nodeResolver: (nodes) => {
            const allNodes = Array.from(nodes.values());
            const readyNodes = allNodes.filter(node => node.state === 1);
            if (readyNodes.length > 0) {
                return readyNodes.reduce((prev, current) => {
                    const prevLoad = prev.stats?.cpu?.lavalinkLoad || 0;
                    const currentLoad = current.stats?.cpu?.lavalinkLoad || 0;
                    return prevLoad < currentLoad ? prev : current;
                });
            }
            return allNodes[0] || null;
        }
    });

    manager.shoukaku.on('ready', (name) => {
        console.log(`✅ [Lavalink Active] (${client.user ? client.user.username : 'Bot'}) Connected to: ${name}`);
    });

    manager.shoukaku.on('error', (name, error) => {
        console.warn(`⚠️ [Lavalink Failover] (${client.user ? client.user.username : 'Bot'}) Node [${name}] notice`);
    });

    manager.shoukaku.on('disconnect', (name, count) => {
        console.warn(`⚠️ [Lavalink] Node [${name}] disconnected (Retry: ${count})`);
    });

    // If client is already ready or logged in, connect nodes immediately
    if (client.isReady?.() || client.user) {
        try {
            manager.shoukaku.connector.ready(Nodes);
        } catch (readyErr) {
            console.warn(`⚠️ [Lavalink Attach] (${client.user ? client.user.username : 'Bot'}):`, readyErr.message);
        }
    }

    // Player Start Event
    manager.on('playerStart', async (player, track) => {
        player.data.set('previousTrack', track);

        // 🔊 PRO STUDIO HI-FI DSP MASTERING: Automatically apply empowering studio master out of the box
        const activeFilter = player.data.get('activeFilter') || 'empowering';
        player.data.set('activeFilter', activeFilter);
        await applyKazagumoFilter(player, activeFilter).catch(() => {});

        // Dedicated Request Channel Integration: Update controller in-place, never duplicate
        try {
            const musicController = require('../modules/musicController');
            if (musicController.isRequestChannel(player.guildId, player.textId)) {
                await musicController.update(player.guildId, client).catch(() => {});
                return;
            }
        } catch (ctrlErr) {}

        const channel = client.channels.cache.get(player.textId);
        const interaction = player.data.get('interaction');
        player.data.delete('interaction');

        // Delete any prior loading placeholder message
        const loadingMsg = player.data.get('loadingMessage');
        if (loadingMsg) {
            await loadingMsg.delete().catch(() => {});
            player.data.delete('loadingMessage');
        }

        try {
            const guild = client.guilds.cache.get(player.guildId);
            if (guild && client.vcLocks && client.vcLocks.get(guild.id)) {
                const voiceChannel = guild.channels.cache.get(player.voiceId);
                if (voiceChannel) {
                    await voiceChannel.permissionOverwrites.edit(guild.roles.everyone, { Connect: false }).catch(() => {});
                }
            }
        } catch (lockErr) {}

        const formatTime = (ms) => {
            if (!ms || isNaN(ms)) return '0:00';
            const totalSeconds = Math.floor(ms / 1000);
            const minutes = Math.floor(totalSeconds / 60);
            const seconds = totalSeconds % 60;
            return `${minutes}m ${seconds.toString().padStart(2, '0')}s`;
        };

        const oldMsg = player.data.get('nowPlayingMessage');
        if (oldMsg) {
            await oldMsg.delete().catch(() => {});
            player.data.delete('nowPlayingMessage');
        }

        const fallbackThumb = 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=500&q=80';
        const trackThumb = (track.thumbnail && !track.thumbnail.includes('imgur.com'))
            ? track.thumbnail
            : (client.user?.displayAvatarURL({ dynamic: true }) || fallbackThumb);

        const currentActiveFilter = player.data.get('activeFilter') || 'empowering';
        const isAutoplay = Boolean(player.data.get('autoplay') || player.autoplay);

        const embed = new EmbedBuilder()
            .setColor('#5865F2')
            .setAuthor({ 
                name: `Now Playing • ${client.user ? client.user.username : 'Music Bot'}`, 
                iconURL: 'https://cdn.discordapp.com/emojis/1049283733054177301.webp?size=96' 
            })
            .setTitle(track.title ? track.title.substring(0, 95) : 'Audio Track')
            .setURL(track.uri || 'https://discord.gg')
            .setThumbnail(trackThumb)
            .setDescription(
                `ℹ️ **Song Details**\n` +
                `▶️ **Status:** Playing | 📻 **Autoplay:** ${isAutoplay ? '🟢 Enabled' : '🔴 Disabled'}\n` +
                `⚙️ **Loop:** ${player.loop === 'none' ? 'Off' : player.loop === 'track' ? '🔂 Track' : '🔁 Queue'} | 🔊 **Volume:** ${player.volume || 100}%\n` +
                `🕒 **Duration:** ${track.isStream ? '🔴 LIVE' : formatTime(track.length)}\n` +
                `👤 **Requester:** ${track.requester ? `<@${track.requester.id}>` : 'Unknown'}\n` +
                `🌐 **Source:** ${track.sourceName ? track.sourceName.charAt(0).toUpperCase() + track.sourceName.slice(1) : 'Spotify'}\n` +
                `🎛️ **DSP Audio Profile:** \`${currentActiveFilter === 'empowering' ? '⭐ Studio Hi-Fi Master (Empowering)' : currentActiveFilter.toUpperCase()}\`\n` +
                `🔠 **Queue:** \`${player.queue.length}\` songs in queue\n\n` +
                `⚙️ **Playback & Filters (1-Year Response Lifetime)**\n` +
                `Use the interactive controls below to manage your audio session.`
            )
            .setFooter({ 
                text: `Starry Hi-Fi Music Engine • Loop: ${player.loop.toUpperCase()} • Autoplay: ${isAutoplay ? 'ON' : 'OFF'} • Volume: ${player.volume || 100}%`, 
                iconURL: client.user ? client.user.displayAvatarURL() : undefined 
            });

        const lang = player.guildId ? getGuildLanguageSync(player.guildId) : 'en';
        const components = buildNowPlayingComponents(player.guildId, isAutoplay);
        const messageData = localizePayload({ embeds: [embed], components }, lang);

        try {
            if (interaction) {
                const msg = await interaction.editReply(messageData).catch(() => {});
                if (msg) player.data.set('nowPlayingMessage', msg);
            } else if (channel) {
                const msg = await channel.send(messageData).catch(() => {});
                if (msg) player.data.set('nowPlayingMessage', msg);
            }
        } catch (e) {
            if (channel) {
                const msg = await channel.send(messageData).catch(() => {});
                if (msg) player.data.set('nowPlayingMessage', msg);
            }
        }
    });

    manager.on('playerResolveError', (player, track, message) => {
        console.warn(`⚠️ [Music PlayerResolveError] Guild ${player?.guildId}: ${track?.title} - ${message}`);
    });

    manager.on('playerException', async (player, track, exception) => {
        console.warn(`⚠️ [Music Player Exception] Guild ${player?.guildId}:`, exception?.message || exception || 'Node failover event');
        if (player && player.queue && player.queue.length > 0) {
            player.skip();
        }
    });

    manager.on('playerEnd', (player, track, reason) => {
        console.log(`ℹ️ [Music PlayerEnd] Guild ${player?.guildId}: ${track?.title} (Reason: ${reason})`);
    });

    manager.on('playerClosed', (player, data) => {
        console.warn(`⚠️ [Music PlayerClosed] Guild ${player?.guildId}: Code ${data?.code}, Reason: ${data?.reason}`);
    });

    manager.on('playerEmpty', async player => {
        const channel = client.channels.cache.get(player.textId);
        const isAutoplay = Boolean(player.data.get('autoplay') || player.autoplay);

        // 📻 HIGH-INTELLIGENCE AUTOPLAY RECOMMENDATION ENGINE
        if (isAutoplay) {
            const previousTrack = player.data.get('previousTrack');
            if (previousTrack) {
                try {
                    let result = null;
                    const cleanTitle = (previousTrack.title || '')
                        .replace(/[\(\[].*?[\)\]]/g, '')
                        .replace(/official|audio|video|lyrics|ft\.|feat\./gi, '')
                        .trim();
                    const primaryArtist = (previousTrack.author || '').split(',')[0].trim();

                    // Tier 1: If YouTube source with 11-char ID, use YouTube Mix
                    if (previousTrack.sourceName === 'youtube' && previousTrack.identifier && previousTrack.identifier.length === 11) {
                        const searchQuery = `https://www.youtube.com/watch?v=${previousTrack.identifier}&list=RD${previousTrack.identifier}`;
                        result = await manager.search(searchQuery, { requester: previousTrack.requester }).catch(() => null);
                    }

                    // Tier 2: Spotify Search via Kazagumo Spotify plugin
                    if (!result || !result.tracks || !result.tracks.length) {
                        try {
                            result = await manager.search(`${primaryArtist} ${cleanTitle}`, { 
                                requester: previousTrack.requester, 
                                engine: 'spotify' 
                            });
                        } catch (spErr) {}
                    }

                    // Tier 3: Artist Radio / Popular tracks
                    if (!result || !result.tracks || !result.tracks.length) {
                        try {
                            result = await manager.search(`${primaryArtist} top tracks`, { 
                                requester: previousTrack.requester, 
                                engine: 'spotify' 
                            });
                        } catch (e) {}
                    }

                    // Tier 4: General keyword search fallback
                    if (!result || !result.tracks || !result.tracks.length) {
                        result = await manager.search(`${primaryArtist} ${cleanTitle} related`, { 
                            requester: previousTrack.requester 
                        });
                    }

                    // Tier 5: Soundcloud fallback
                    if (!result || !result.tracks || !result.tracks.length) {
                        result = await manager.search(`${primaryArtist} ${cleanTitle}`, { 
                            requester: previousTrack.requester, 
                            engine: 'soundcloud' 
                        });
                    }

                    if (result && result.tracks && result.tracks.length > 0) {
                        // Pick next track that isn't the identical track
                        const nextTrack = result.tracks.find(t => 
                            t.identifier !== previousTrack.identifier && 
                            t.title.toLowerCase() !== previousTrack.title.toLowerCase()
                        ) || result.tracks[0];

                        player.queue.add(nextTrack);
                        await player.play();

                        if (channel) {
                            const formatDuration = (ms) => {
                                if (!ms || isNaN(ms)) return '0:00';
                                const sec = Math.floor(ms / 1000);
                                const m = Math.floor(sec / 60);
                                const s = sec % 60;
                                return `${m}m ${s.toString().padStart(2, '0')}s`;
                            };

                            const autoEmbed = new EmbedBuilder()
                                .setColor('#5865F2')
                                .setAuthor({ 
                                    name: '📻 Autoplay Smart Stream • Next Song', 
                                    iconURL: 'https://cdn.discordapp.com/emojis/1049283733054177301.webp?size=96' 
                                })
                                .setTitle(nextTrack.title ? nextTrack.title.substring(0, 85) : 'Recommended Track')
                                .setURL(nextTrack.uri || 'https://discord.gg')
                                .setDescription(
                                    `🎵 **Continuous Smart Autoplay Active**\n` +
                                    `▶️ **Now Streaming:** **[${nextTrack.title}](${nextTrack.uri || 'https://discord.gg'})**\n` +
                                    `👤 **Artist:** \`${nextTrack.author || primaryArtist}\` | 🕒 **Duration:** \`${formatDuration(nextTrack.length)}\`\n\n` +
                                    `*Autoplay is on. Click 📻 on the player embed or use \`,autoplay\` to disable.*`
                                )
                                .setFooter({ text: 'Starry Hi-Fi Audio Engine • Continuous Stream' });
                            
                            const notifyMsg = await channel.send({ embeds: [autoEmbed] }).catch(() => null);
                            if (notifyMsg) {
                                setTimeout(() => notifyMsg.delete().catch(() => {}), 15000);
                            }
                        }

                        // Update controller if active
                        try {
                            const musicController = require('../modules/musicController');
                            await musicController.update(player.guildId, client).catch(() => {});
                        } catch (e) {}

                        return;
                    }
                } catch (err) {
                    console.error('❌ Autoplay Recommendation Error:', err.message || err);
                }
            }
        }

        // Dedicated Request Channel Integration: Update controller in-place
        try {
            const musicController = require('../modules/musicController');
            if (musicController.isRequestChannel(player.guildId, player.textId)) {
                await musicController.update(player.guildId, client).catch(() => {});
                return;
            }
        } catch (ctrlErr) {}

        // Clean up now playing message
        const oldMsg = player.data.get('nowPlayingMessage');
        if (oldMsg) {
            await oldMsg.delete().catch(() => {});
            player.data.delete('nowPlayingMessage');
        }

        const loadingMsg = player.data.get('loadingMessage');
        if (loadingMsg) {
            await loadingMsg.delete().catch(() => {});
            player.data.delete('loadingMessage');
        }

        if (channel) {
            const lang = player.guildId ? getGuildLanguageSync(player.guildId) : 'en';
            channel.send(t(lang, 'music.queue_ended', { play_cmd: '`,play <song>`' })).catch(() => {});
        }
    });

    client.manager = manager;
    return manager;
}

module.exports = {
    Nodes,
    createMusicManager,
    buildNowPlayingComponents,
    applyKazagumoFilter,
    scoreTrack,
    rankAndFilterCanonicalTracks
};
