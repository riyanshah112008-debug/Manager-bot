// ==========================================
// 🎵 MASTER HIGH-FIDELITY AUDIO ENGINE
// File Path: src/utils/nativeAudioEngine.js
// Multi-Platform Search Resolver • Direct Stream Encoder • DSP Filters • 100% Host-Anywhere
// ==========================================
const {
    joinVoiceChannel,
    createAudioPlayer,
    createAudioResource,
    AudioPlayerStatus,
    VoiceConnectionStatus,
    entersState,
    StreamType
} = require('@discordjs/voice');
const play = require('play-dl');
const fetch = require('node-fetch');
const spotify = require('spotify-url-info')(fetch);
const prism = require('prism-media');
const { 
    EmbedBuilder, 
    ActionRowBuilder, 
    ButtonBuilder, 
    ButtonStyle, 
    StringSelectMenuBuilder,
    MessageFlags
} = require('discord.js');
const config = require('../config');

const EPHEMERAL_FLAG = (MessageFlags && MessageFlags.Ephemeral) ? MessageFlags.Ephemeral : 64;

// Audio DSP Filter FFmpeg argument definitions
const FILTER_ARGS = {
    clear: [],
    bassboost: ['-af', 'equalizer=f=40:width_type=h:width=50:g=14,equalizer=f=80:width_type=h:width=50:g=10'],
    '8d': ['-af', 'apulsator=hz=0.125'],
    nightcore: ['-af', 'asetrate=48000*1.25,aresample=48000,atempo=1.0'],
    daycore: ['-af', 'asetrate=48000*0.85,aresample=48000,atempo=1.0'],
    vaporwave: ['-af', 'asetrate=48000*0.8,aresample=48000,atempo=0.9,aecho=0.8:0.88:60:0.4'],
    treble: ['-af', 'equalizer=f=8000:width_type=h:width=1000:g=8,equalizer=f=12000:width_type=h:width=1000:g=10'],
    pop: ['-af', 'equalizer=f=1000:width_type=h:width=500:g=5,equalizer=f=3000:width_type=h:width=1000:g=4']
};

let scClientId = null;
let lastTokenRefresh = 0;

async function refreshSoundCloudToken() {
    const now = Date.now();
    if (scClientId && (now - lastTokenRefresh < 3600000)) return;
    try {
        const id = await play.getFreeClientID();
        if (id) {
            scClientId = id;
            await play.setToken({ soundcloud: { client_id: id } });
            lastTokenRefresh = now;
        }
    } catch (e) {}
}
refreshSoundCloudToken();

function formatTime(ms) {
    if (!ms || isNaN(ms)) return '0:00';
    const totalSec = Math.floor(ms / 1000);
    const m = Math.floor(totalSec / 60);
    const s = totalSec % 60;
    return `${m}m ${s.toString().padStart(2, '0')}s`;
}

function createProgressBar(currentMs, totalMs, length = 12) {
    if (!totalMs || totalMs <= 0) return '🔘' + '▬'.repeat(length - 1);
    const progress = Math.min(Math.max(currentMs / totalMs, 0), 1);
    const index = Math.round(progress * (length - 1));
    let bar = '';
    for (let i = 0; i < length; i++) {
        bar += (i === index) ? '🔘' : '▬';
    }
    return bar;
}

class StarryGuildPlayer {
    constructor(client, guildId, voiceChannel, textChannel) {
        this.client = client;
        this.guildId = guildId;
        this.voiceChannel = voiceChannel;
        this.textChannel = textChannel;
        this.queue = [];
        this.history = [];
        this.currentTrack = null;
        this.previousTrack = null;
        this.loop = 'none'; // 'none' | 'track' | 'queue'
        this.volume = 100;
        this.filter = 'clear';
        this.is247 = false;
        this.autoplay = false;
        this.nowPlayingMessage = null;
        this.audioResource = null;
        this.paused = false;
        this.destroyed = false;
        this.isPlaying = false;
        this.playbackStartTime = 0;
        this.disconnectTimeout = null;

        // Initialize Discord.js AudioPlayer
        this.player = createAudioPlayer();
        this.connection = null;

        this.setupPlayerEvents();
    }

    get position() {
        if (!this.currentTrack || this.playbackStartTime === 0) return 0;
        if (this.paused) return this._pausedPosition || 0;
        return Date.now() - this.playbackStartTime;
    }

    setupPlayerEvents() {
        this.player.on(AudioPlayerStatus.Playing, () => {
            this.isPlaying = true;
        });

        this.player.on(AudioPlayerStatus.Idle, () => {
            if (this.destroyed) return;
            if (this.isPlaying) {
                this.isPlaying = false;
                this.handleTrackEnd();
            }
        });

        this.player.on('error', (error) => {
            console.warn(`⚠️ [Audio Stream Engine Status in ${this.guildId}]:`, error.message || error);
            if (this.destroyed) return;
            if (this.isPlaying) {
                this.isPlaying = false;
                this.handleTrackEnd();
            }
        });
    }

    async connect() {
        if (this.disconnectTimeout) {
            clearTimeout(this.disconnectTimeout);
            this.disconnectTimeout = null;
        }

        if (!this.connection || this.connection.state.status === VoiceConnectionStatus.Destroyed) {
            this.connection = joinVoiceChannel({
                channelId: this.voiceChannel.id,
                guildId: this.guildId,
                adapterCreator: this.voiceChannel.guild.voiceAdapterCreator,
                selfDeaf: true,
                selfMute: false
            });

            this.connection.on(VoiceConnectionStatus.Disconnected, async () => {
                try {
                    await Promise.race([
                        entersState(this.connection, VoiceConnectionStatus.Signalling, 3000),
                        entersState(this.connection, VoiceConnectionStatus.Connecting, 3000)
                    ]);
                } catch (e) {
                    if (!this.is247) {
                        this.destroy();
                    }
                }
            });
        }

        this.connection.subscribe(this.player);

        if (this.connection.state.status !== VoiceConnectionStatus.Ready) {
            try {
                await entersState(this.connection, VoiceConnectionStatus.Ready, 4000);
                this.connection.subscribe(this.player);
            } catch (e) {}
        }
        return this.connection;
    }

    async playNext() {
        if (this.destroyed) return;

        if (this.queue.length === 0) {
            const hadTrack = !!this.currentTrack;
            if (this.currentTrack) {
                this.history.push(this.currentTrack);
                this.previousTrack = this.currentTrack;
            }
            this.currentTrack = null;
            this.isPlaying = false;

            if (this.nowPlayingMessage) {
                await this.nowPlayingMessage.delete().catch(() => {});
                this.nowPlayingMessage = null;
            }

            // High-Intelligence Autoplay Recommendation
            if (this.autoplay && this.previousTrack) {
                try {
                    if (this.textChannel) {
                        await this.textChannel.send('📻 **Autoplay:** Finding next recommended song...').catch(() => {});
                    }
                    const searchSeed = `${this.previousTrack.author || ''} ${this.previousTrack.title || ''}`.replace(/[^\w\s]/gi, ' ').trim();
                    const relatedRes = await StarryAudioEngine.search(`${searchSeed} song`, this.previousTrack.requester);
                    if (relatedRes && relatedRes.tracks && relatedRes.tracks.length > 0) {
                        const nextSong = relatedRes.tracks.find(t => t.url !== this.previousTrack.url && !this.history.some(h => h.url === t.url)) || relatedRes.tracks[0];
                        if (nextSong) {
                            this.queue.push(nextSong);
                            return this.playNext();
                        }
                    }
                } catch (e) {}
            }

            if (hadTrack && !this.destroyed) {
                if (this.textChannel) {
                    this.textChannel.send('📭 **The queue has ended.** Use `,play <song>` to queue more music!').catch(() => {});
                }
            }

            if (!this.is247) {
                this.disconnectTimeout = setTimeout(() => {
                    if (this.queue.length === 0 && !this.currentTrack) {
                        this.destroy();
                    }
                }, 60000);
            }
            return;
        }

        await this.connect();
        const track = this.queue.shift();
        if (this.currentTrack) {
            this.history.push(this.currentTrack);
            this.previousTrack = this.currentTrack;
        }
        this.currentTrack = track;

        try {
            await refreshSoundCloudToken();

            let targetUrl = track.url;
            if (!targetUrl) {
                const searchRes = await StarryAudioEngine.search(track.title, track.requester);
                if (searchRes && searchRes.tracks && searchRes.tracks[0] && searchRes.tracks[0].url) {
                    targetUrl = searchRes.tracks[0].url;
                    track.url = targetUrl;
                }
            }

            if (!targetUrl) {
                throw new Error('Could not resolve audio stream URL.');
            }

            let stream = null;
            try {
                stream = await play.stream(targetUrl, { quality: 2, discordPlayerCompatibility: true });
            } catch (streamErr) {
                console.warn(`⚠️ [Stream Fallback] "${targetUrl}" failed (${streamErr.message}). Searching fallback stream...`);
                const altResults = await play.search(`${track.author || ''} ${track.title}`.trim(), { limit: 4 }).catch(() => []);
                for (const alt of altResults) {
                    if (alt.url && alt.url !== targetUrl) {
                        try {
                            stream = await play.stream(alt.url, { quality: 2, discordPlayerCompatibility: true });
                            if (stream) {
                                track.url = alt.url;
                                break;
                            }
                        } catch (e) {}
                    }
                }
                if (!stream) {
                    const scAlt = await play.search(track.title, { source: { soundcloud: 'tracks' }, limit: 4 }).catch(() => []);
                    for (const alt of scAlt) {
                        if (alt.url && alt.url !== targetUrl) {
                            try {
                                stream = await play.stream(alt.url, { quality: 2, discordPlayerCompatibility: true });
                                if (stream) {
                                    track.url = alt.url;
                                    break;
                                }
                            } catch (e) {}
                        }
                    }
                }
                if (!stream) throw streamErr;
            }
            let audioStream = stream.stream;

            // Apply Real-time FFmpeg Audio DSP Filters
            if (this.filter && this.filter !== 'clear' && FILTER_ARGS[this.filter]) {
                const ffmpeg = new prism.FFmpeg({
                    args: [
                        '-analyzeduration', '0',
                        '-loglevel', '0',
                        '-i', '-',
                        ...FILTER_ARGS[this.filter],
                        '-f', 's16le',
                        '-ar', '48000',
                        '-ac', '2'
                    ]
                });
                audioStream = audioStream.pipe(ffmpeg);

                this.audioResource = createAudioResource(audioStream, {
                    inputType: StreamType.Raw,
                    inlineVolume: true
                });
            } else {
                this.audioResource = createAudioResource(audioStream, {
                    inputType: stream.type,
                    inlineVolume: true
                });
            }

            if (this.audioResource.volume) {
                this.audioResource.volume.setVolume(this.volume / 100);
            }

            this.player.play(this.audioResource);
            this.paused = false;
            this.playbackStartTime = Date.now();
            this._pausedPosition = 0;

            await this.sendNowPlayingPanel(track);

        } catch (err) {
            console.error(`⚠️ [Playback Exception for "${track.title}"]:`, err.message || err);
            this.handleTrackEnd();
        }
    }

    handleTrackEnd() {
        if (this.loop === 'track' && this.currentTrack) {
            this.queue.unshift(this.currentTrack);
        } else if (this.loop === 'queue' && this.currentTrack) {
            this.queue.push(this.currentTrack);
        }
        this.playNext();
    }

    async sendNowPlayingPanel(track) {
        if (!this.textChannel) return;

        if (this.nowPlayingMessage) {
            await this.nowPlayingMessage.delete().catch(() => {});
            this.nowPlayingMessage = null;
        }

        const fallbackThumb = 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=500&q=80';
        const trackThumb = (track.thumbnail && !track.thumbnail.includes('imgur.com')) 
            ? track.thumbnail 
            : (this.client.user?.displayAvatarURL({ dynamic: true }) || fallbackThumb);

        const embed = new EmbedBuilder()
            .setColor('#5865F2')
            .setAuthor({ 
                name: `Now Playing • ${this.client.user?.username || 'Starry Audio'}`, 
                iconURL: 'https://cdn.discordapp.com/emojis/1049283733054177301.webp?size=96' 
            })
            .setTitle(track.title ? track.title.substring(0, 95) : 'Audio Track')
            .setURL(track.url || 'https://discord.gg')
            .setThumbnail(trackThumb)
            .setDescription(
                `ℹ️ **Song Details**\n` +
                `▶️ **Status:** ${this.paused ? '⏸️ Paused' : 'Playing'} | ⚙️ **Loop:** ${this.loop === 'none' ? 'Off' : this.loop === 'track' ? '🔂 Track' : '🔁 Queue'}\n` +
                `🕒 **Duration:** ${formatTime(track.duration)} | 🔊 **Volume:** ${this.volume}%\n` +
                `👤 **Requester:** ${track.requester ? `<@${track.requester.id}>` : 'Unknown'}\n` +
                `🌐 **Source:** ${track.source || 'Soundcloud / Hi-Fi'}\n` +
                `🔠 **Queue:** \`${this.queue.length}\` songs in queue\n\n` +
                `⚙️ **Playback & Filters (1-Year Response Lifetime)**\n` +
                `Use the interactive controls below to manage your audio session.`
            )
            .setFooter({ text: `Starry Music Engine • Bot: ${this.client.user ? this.client.user.tag : 'Starry'}`, iconURL: this.client.user ? this.client.user.displayAvatarURL() : undefined });

        // Row 1: 4 buttons (No mobile wrapping)
        const row1 = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('music_pause').setEmoji('⏸️').setLabel('Pause').setStyle(ButtonStyle.Primary),
            new ButtonBuilder().setCustomId('music_skip').setEmoji('⏭️').setLabel('Skip').setStyle(ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId('music_loop').setEmoji('🔁').setLabel('Loop').setStyle(ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId('music_stop').setEmoji('⏹️').setLabel('Stop').setStyle(ButtonStyle.Danger)
        );

        // Row 2: 4 buttons (No mobile wrapping)
        const row2 = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('dj_vol_down').setEmoji('🔉').setLabel('Vol -').setStyle(ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId('dj_vol_up').setEmoji('🔊').setLabel('Vol +').setStyle(ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId('dj_shuffle').setEmoji('🔀').setLabel('Shuffle').setStyle(ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId('music_queue').setEmoji('📜').setLabel('Queue').setStyle(ButtonStyle.Secondary)
        );

        // Row 3: 2 buttons (Voice Channel Security)
        const row3 = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('dj_lock').setEmoji('🔒').setLabel('Lock VC').setStyle(ButtonStyle.Success),
            new ButtonBuilder().setCustomId('dj_unlock').setEmoji('🔓').setLabel('Unlock VC').setStyle(ButtonStyle.Success)
        );

        // Row 4: High-Fidelity Audio DSP Filters
        const filterRow = new ActionRowBuilder().addComponents(
            new StringSelectMenuBuilder().setCustomId('music_filter').setPlaceholder('🎧 Select Audio Filter / Sound FX...').addOptions([
                { label: 'Clear Filters', description: 'Removes all active audio effects (Default)', value: 'clear', emoji: '🚫' },
                { label: 'Bassboost', description: 'Deep, heavy bass enhancement', value: 'bassboost', emoji: '🎸' },
                { label: '8D Audio', description: '360° rotating spatial surround sound', value: '8d', emoji: '🌀' },
                { label: 'Nightcore', description: 'Sped up tempo + higher pitch aesthetic', value: 'nightcore', emoji: '✨' },
                { label: 'Daycore / Slowed', description: 'Slowed down tempo + deeper tone', value: 'daycore', emoji: '🌅' },
                { label: 'Vaporwave', description: 'Slowed reverb + retro cassette feel', value: 'vaporwave', emoji: '🪩' },
                { label: 'Treble Boost', description: 'Crisp, crystal clear high frequencies', value: 'treble', emoji: '🔊' },
                { label: 'Pop & Vocal Clarity', description: 'Enhanced vocals and clean acoustic profile', value: 'pop', emoji: '📻' }
            ])
        );

        this.nowPlayingMessage = await this.textChannel.send({
            embeds: [embed],
            components: [row1, row2, row3, filterRow]
        }).catch(() => null);
    }

    pause(shouldPause) {
        if (shouldPause === undefined) {
            shouldPause = (this.player.state.status === AudioPlayerStatus.Playing);
        }
        if (shouldPause) {
            this._pausedPosition = this.position;
            this.player.pause();
            this.paused = true;
            return true;
        } else {
            this.playbackStartTime = Date.now() - (this._pausedPosition || 0);
            this.player.unpause();
            this.paused = false;
            return false;
        }
    }

    skip() {
        this.player.stop();
        return true;
    }

    stop() {
        this.queue = [];
        this.currentTrack = null;
        this.player.stop();
        if (this.nowPlayingMessage) {
            this.nowPlayingMessage.delete().catch(() => {});
            this.nowPlayingMessage = null;
        }
    }

    setVolume(vol) {
        this.volume = Math.max(0, Math.min(200, vol));
        if (this.audioResource && this.audioResource.volume) {
            this.audioResource.volume.setVolume(this.volume / 100);
        }
    }

    async setFilter(filterName) {
        this.filter = filterName;
        if (this.currentTrack && this.player.state.status === AudioPlayerStatus.Playing) {
            this.queue.unshift(this.currentTrack);
            this.player.stop();
        }
    }

    shuffle() {
        for (let i = this.queue.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [this.queue[i], this.queue[j]] = [this.queue[j], this.queue[i]];
        }
    }

    jump(position) {
        const index = position - 1;
        if (index < 0 || index >= this.queue.length) return false;
        this.queue = this.queue.slice(index);
        this.skip();
        return true;
    }

    move(from, to) {
        const fromIdx = from - 1;
        const toIdx = to - 1;
        if (fromIdx < 0 || fromIdx >= this.queue.length || toIdx < 0 || toIdx >= this.queue.length) return false;
        const [moved] = this.queue.splice(fromIdx, 1);
        this.queue.splice(toIdx, 0, moved);
        return true;
    }

    remove(position) {
        const index = position - 1;
        if (index < 0 || index >= this.queue.length) return null;
        return this.queue.splice(index, 1)[0];
    }

    clearQueue() {
        const count = this.queue.length;
        this.queue = [];
        return count;
    }

    replay() {
        if (!this.currentTrack) return false;
        this.queue.unshift(this.currentTrack);
        this.skip();
        return true;
    }

    previous() {
        if (this.history.length === 0) return false;
        const prev = this.history.pop();
        if (this.currentTrack) this.queue.unshift(this.currentTrack);
        this.queue.unshift(prev);
        this.skip();
        return true;
    }

    destroy() {
        this.destroyed = true;
        this.stop();
        if (this.connection) {
            this.connection.destroy();
            this.connection = null;
        }
        StarryAudioEngine.players.delete(this.guildId);
    }
}

class StarryAudioEngine {
    static players = new Map();

    static getPlayer(guildId) {
        return this.players.get(guildId) || null;
    }

    static getOrCreatePlayer(client, guildId, voiceChannel, textChannel) {
        let player = this.players.get(guildId);
        if (!player || player.destroyed) {
            player = new StarryGuildPlayer(client, guildId, voiceChannel, textChannel);
            this.players.set(guildId, player);
        } else {
            if (voiceChannel) player.voiceChannel = voiceChannel;
            if (textChannel) player.textChannel = textChannel;
        }
        return player;
    }

    static async search(rawQuery, requester) {
        const tracks = [];
        await refreshSoundCloudToken();
        const query = rawQuery.trim();

        // 1. Spotify URL Handling
        if (query.includes('spotify.com')) {
            try {
                if (query.includes('/playlist/') || query.includes('/album/')) {
                    const spTracks = await spotify.getTracks(query);
                    if (spTracks && spTracks.length > 0) {
                        for (const t of spTracks) {
                            tracks.push({
                                title: `${t.artists?.map(a => a.name).join(', ') || ''} - ${t.name}`,
                                url: null,
                                duration: (t.duration_ms || t.duration || 180) * 1000,
                                author: t.artists?.[0]?.name || 'Spotify Artist',
                                thumbnail: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=500&q=80',
                                source: 'Spotify Playlist',
                                requester
                            });
                        }
                        return { type: 'PLAYLIST', tracks, playlistName: 'Spotify Playlist' };
                    }
                } else if (query.includes('/track/')) {
                    const t = await spotify.getData(query);
                    if (t) {
                        const thumb = t.coverArt?.sources?.[0]?.url || 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=500&q=80';
                        const resolvedTitle = `${t.artists?.map(a => a.name).join(', ') || ''} - ${t.name}`;
                        
                        let matchedUrl = null;
                        const scRes = await play.search(resolvedTitle, { source: { soundcloud: 'tracks' }, limit: 1 }).catch(() => []);
                        if (scRes && scRes[0]) matchedUrl = scRes[0].url;

                        tracks.push({
                            title: resolvedTitle,
                            url: matchedUrl,
                            duration: (t.duration_ms || 180000),
                            author: t.artists?.[0]?.name || 'Spotify Artist',
                            thumbnail: thumb,
                            source: 'Spotify',
                            requester
                        });
                        return { type: 'TRACK', tracks };
                    }
                }
            } catch (e) {}
        }

        // 2. Direct SoundCloud Link or Search
        try {
            if (query.includes('soundcloud.com/')) {
                const scData = await play.soundcloud(query).catch(() => null);
                if (scData) {
                    if (scData.type === 'playlist') {
                        const allTracks = await scData.all_tracks();
                        for (const t of allTracks) {
                            tracks.push({
                                title: t.name || t.title,
                                url: t.url,
                                duration: (t.durationInSec || 180) * 1000,
                                author: t.user?.name || 'SoundCloud Artist',
                                thumbnail: t.thumbnail || 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=500&q=80',
                                source: 'SoundCloud Playlist',
                                requester
                            });
                        }
                        return { type: 'PLAYLIST', tracks, playlistName: scData.name || 'SoundCloud Playlist' };
                    } else {
                        tracks.push({
                            title: scData.name || scData.title || query,
                            url: scData.url,
                            duration: (scData.durationInSec || 180) * 1000,
                            author: scData.user?.name || 'SoundCloud Artist',
                            thumbnail: scData.thumbnail || 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=500&q=80',
                            source: 'SoundCloud',
                            requester
                        });
                        return { type: 'TRACK', tracks };
                    }
                }
            }

            // High-Speed Keyword Search via SoundCloud
            const scSearch = await play.search(query, { source: { soundcloud: 'tracks' }, limit: 1 }).catch(() => []);
            if (scSearch && scSearch.length > 0) {
                const item = scSearch[0];
                tracks.push({
                    title: item.name || item.title || query,
                    url: item.url,
                    duration: (item.durationInSec || 180) * 1000,
                    author: item.user?.name || 'SoundCloud Artist',
                    thumbnail: item.thumbnail || 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=500&q=80',
                    source: 'SoundCloud',
                    requester
                });
                return { type: 'TRACK', tracks };
            }
        } catch (scErr) {}

        // 3. Fallback YouTube Search
        try {
            const ytSearch = await play.search(query, { limit: 1 }).catch(() => []);
            if (ytSearch && ytSearch.length > 0) {
                const item = ytSearch[0];
                tracks.push({
                    title: item.title || query,
                    url: item.url,
                    duration: (item.durationInSec || 180) * 1000,
                    author: item.channel?.name || 'Artist',
                    thumbnail: item.thumbnails?.[0]?.url || 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=500&q=80',
                    source: 'YouTube',
                    requester
                });
                return { type: 'TRACK', tracks };
            }
        } catch (ytErr) {}

        return { type: 'TRACK', tracks: [] };
    }
}

module.exports = {
    StarryAudioEngine,
    StarryGuildPlayer,
    formatTime,
    createProgressBar
};
