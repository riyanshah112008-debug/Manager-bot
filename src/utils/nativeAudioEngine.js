// ==========================================
// 🎵 STARRY SUPREME BULLETPROOF NATIVE AUDIO ENGINE
// File Path: src/utils/nativeAudioEngine.js
// Direct @discordjs/voice + play-dl/yt-dlp + FFmpeg libopus OggOpus
// 100% Host-Anywhere • 0 External Lavalink Dependencies • Bulletproof
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
const { spawn } = require('child_process');
const play = require('play-dl');
const fetch = require('node-fetch');
const spotify = require('spotify-url-info')(fetch);
const prism = require('prism-media');
const { 
    EmbedBuilder, 
    ActionRowBuilder, 
    ButtonBuilder, 
    ButtonStyle, 
    StringSelectMenuBuilder 
} = require('discord.js');
const config = require('../config');

// Audio Filter FFmpeg arguments
const FILTER_ARGS = {
    clear: [],
    bassboost: ['-af', 'equalizer=f=40:width_type=h:width=50:g=10,equalizer=f=80:width_type=h:width=50:g=8'],
    '8d': ['-af', 'apulsator=hz=0.125'],
    nightcore: ['-af', 'asetrate=48000*1.25,aresample=48000,atempo=1.0'],
    daycore: ['-af', 'asetrate=48000*0.85,aresample=48000,atempo=1.0'],
    vaporwave: ['-af', 'asetrate=48000*0.8,aresample=48000,atempo=0.9,aecho=0.8:0.88:60:0.4']
};

function formatTime(ms) {
    if (!ms || isNaN(ms)) return '0:00';
    const totalSec = Math.floor(ms / 1000);
    const m = Math.floor(totalSec / 60);
    const s = totalSec % 60;
    return `${m}m ${s.toString().padStart(2, '0')}s`;
}

class StarryGuildPlayer {
    constructor(client, guildId, voiceChannel, textChannel) {
        this.client = client;
        this.guildId = guildId;
        this.voiceChannel = voiceChannel;
        this.textChannel = textChannel;
        this.queue = [];
        this.currentTrack = null;
        this.loop = 'none'; // 'none' | 'track' | 'queue'
        this.volume = 100;
        this.filter = 'clear';
        this.is247 = false;
        this.autoplay = false;
        this.nowPlayingMessage = null;
        this.audioResource = null;
        this.paused = false;
        this.destroyed = false;
        this.streamProcess = null;

        // Initialize Discord.js Voice Player
        this.player = createAudioPlayer();
        this.connection = null;

        this.setupPlayerEvents();
    }

    setupPlayerEvents() {
        this.player.on(AudioPlayerStatus.Idle, () => {
            if (this.destroyed) return;
            this.handleTrackEnd();
        });

        this.player.on('error', (error) => {
            console.warn(`⚠️ [Native Audio Player Error in ${this.guildId}]:`, error.message);
            if (this.destroyed) return;
            this.handleTrackEnd();
        });
    }

    async connect() {
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
                        entersState(this.connection, VoiceConnectionStatus.Signalling, 5000),
                        entersState(this.connection, VoiceConnectionStatus.Connecting, 5000)
                    ]);
                } catch (e) {
                    if (!this.is247) {
                        this.destroy();
                    }
                }
            });

            this.connection.subscribe(this.player);
        }

        if (this.connection.state.status !== VoiceConnectionStatus.Ready) {
            try {
                await entersState(this.connection, VoiceConnectionStatus.Ready, 10000);
            } catch (e) {
                console.warn('Voice connection ready timeout:', e.message);
            }
        }
        return this.connection;
    }

    async playNext() {
        if (this.destroyed) return;

        if (this.streamProcess) {
            try { this.streamProcess.kill('SIGKILL'); } catch (e) {}
            this.streamProcess = null;
        }

        if (this.queue.length === 0) {
            this.currentTrack = null;
            if (this.nowPlayingMessage) {
                await this.nowPlayingMessage.delete().catch(() => {});
                this.nowPlayingMessage = null;
            }
            if (this.textChannel) {
                this.textChannel.send('📭 **The queue has ended.**').catch(() => {});
            }
            if (!this.is247) {
                setTimeout(() => {
                    if (this.queue.length === 0 && !this.currentTrack) {
                        this.destroy();
                    }
                }, 60000);
            }
            return;
        }

        await this.connect();
        const track = this.queue.shift();
        this.currentTrack = track;

        try {
            const streamTarget = track.url || `ytsearch1:${track.title}`;
            
            // Spawn yt-dlp to stream audio with Node JS runtime
            const ytdlpProc = spawn('yt-dlp', [
                '--js-runtimes', 'node',
                '-o', '-',
                '-f', 'bestaudio/best',
                '--no-playlist',
                '--quiet',
                '--no-warnings',
                streamTarget
            ]);
            this.streamProcess = ytdlpProc;

            const filterArg = (this.filter && this.filter !== 'clear' && FILTER_ARGS[this.filter]) 
                ? FILTER_ARGS[this.filter] 
                : [];

            // Direct transcode into libopus OggOpus for 100% audible native Discord playback
            const ffmpeg = new prism.FFmpeg({
                args: [
                    '-analyzeduration', '0',
                    '-loglevel', '0',
                    '-i', '-',
                    ...filterArg,
                    '-f', 'opus',
                    '-c:a', 'libopus',
                    '-ar', '48000',
                    '-ac', '2',
                    '-b:a', '128k'
                ]
            });

            const oggStream = ytdlpProc.stdout.pipe(ffmpeg);

            this.audioResource = createAudioResource(oggStream, {
                inputType: StreamType.OggOpus,
                inlineVolume: true
            });

            if (this.audioResource.volume) {
                this.audioResource.volume.setVolume(this.volume / 100);
            }

            this.player.play(this.audioResource);
            this.paused = false;

            await this.sendNowPlayingPanel(track);

        } catch (err) {
            console.error('Play error in Native Audio Engine:', err);
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
            .setTitle(track.title ? track.title.substring(0, 95) : 'Unknown Title')
            .setURL(track.url || 'https://discord.gg')
            .setThumbnail(trackThumb)
            .setDescription(
                `ℹ️ **Track Details**\n` +
                `▶️ **Status:** ${this.paused ? '⏸️ Paused' : '▶️ Playing'}\n` +
                `⚙️ **Loop:** ${this.loop === 'none' ? 'Off' : this.loop === 'track' ? '🔂 Track' : '🔁 Queue'}\n` +
                `🔊 **Volume:** \`${this.volume}%\` | **Filter:** \`${this.filter.toUpperCase()}\`\n` +
                `🕒 **Duration:** \`${formatTime(track.duration)}\`\n` +
                `👤 **Requester:** ${track.requester ? `<@${track.requester.id}>` : 'Unknown'}\n` +
                `🌐 **Source:** \`${track.source || 'Official Audio / High-Fi'}\`\n` +
                `🔠 **Queue:** \`${this.queue.length}\` songs remaining\n\n` +
                `⚙️ **Interactive Controls & 1-Year Lifetime**\nUse the buttons below to control playback.`
            )
            .setFooter({ text: 'Starry Native High-Fidelity Audio Engine • Prefix: ,' })
            .setTimestamp();

        const row1 = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('music_pause').setEmoji('⏸️').setLabel('Pause').setStyle(ButtonStyle.Primary),
            new ButtonBuilder().setCustomId('music_skip').setEmoji('⏭️').setLabel('Skip').setStyle(ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId('music_loop').setEmoji('🔁').setLabel('Loop').setStyle(ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId('dj_shuffle').setEmoji('🔀').setLabel('Shuffle').setStyle(ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId('music_stop').setEmoji('⏹️').setLabel('Stop').setStyle(ButtonStyle.Danger)
        );

        const row2 = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('dj_vol_down').setEmoji('🔉').setLabel('Vol -').setStyle(ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId('dj_vol_up').setEmoji('🔊').setLabel('Vol +').setStyle(ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId('dj_lock').setEmoji('🔒').setLabel('Lock VC').setStyle(ButtonStyle.Success),
            new ButtonBuilder().setCustomId('dj_unlock').setEmoji('🔓').setLabel('Unlock VC').setStyle(ButtonStyle.Success),
            new ButtonBuilder().setCustomId('music_queue').setEmoji('📜').setLabel('Queue').setStyle(ButtonStyle.Secondary)
        );

        const filterRow = new ActionRowBuilder().addComponents(
            new StringSelectMenuBuilder().setCustomId('music_filter').setPlaceholder('🎧 Select Audio Filter / Sound FX...').addOptions([
                { label: 'Clear Filters', description: 'Removes all audio effects (Default)', value: 'clear', emoji: '🚫' },
                { label: 'Bassboost', description: 'Heavy low-frequency boost', value: 'bassboost', emoji: '🎸' },
                { label: '8D Audio', description: 'Rotates sound 360°', value: '8d', emoji: '🌀' },
                { label: 'Nightcore', description: 'Faster tempo + higher pitch', value: 'nightcore', emoji: '✨' },
                { label: 'Daycore / Slowed', description: 'Slower tempo + lower pitch', value: 'daycore', emoji: '🌅' },
                { label: 'Vaporwave', description: 'Slowed + reverb aesthetic', value: 'vaporwave', emoji: '🪩' }
            ])
        );

        this.nowPlayingMessage = await this.textChannel.send({
            embeds: [embed],
            components: [row1, row2, filterRow]
        }).catch(() => null);
    }

    pause() {
        if (this.player.state.status === AudioPlayerStatus.Playing) {
            this.player.pause();
            this.paused = true;
            return true;
        } else if (this.player.state.status === AudioPlayerStatus.Paused) {
            this.player.unpause();
            this.paused = false;
            return false;
        }
        return false;
    }

    skip() {
        this.player.stop();
        return true;
    }

    stop() {
        this.queue = [];
        this.currentTrack = null;
        if (this.streamProcess) {
            try { this.streamProcess.kill('SIGKILL'); } catch (e) {}
            this.streamProcess = null;
        }
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

    static async search(query, requester) {
        const tracks = [];

        // 1. Spotify URL Handling
        if (query.includes('spotify.com')) {
            try {
                if (query.includes('/playlist/') || query.includes('/album/')) {
                    const spTracks = await spotify.getTracks(query);
                    if (spTracks && spTracks.length > 0) {
                        spTracks.forEach(t => {
                            tracks.push({
                                title: `${t.artists?.map(a => a.name).join(', ') || ''} - ${t.name}`,
                                url: null,
                                duration: (t.duration_ms || t.duration || 180) * 1000,
                                author: t.artists?.[0]?.name || 'Spotify Artist',
                                thumbnail: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=500&q=80',
                                source: 'Spotify Playlist',
                                requester
                            });
                        });
                        return { type: 'PLAYLIST', tracks, playlistName: 'Spotify Playlist' };
                    }
                } else if (query.includes('/track/')) {
                    const t = await spotify.getData(query);
                    if (t) {
                        const thumb = t.coverArt?.sources?.[0]?.url || 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=500&q=80';
                        tracks.push({
                            title: `${t.artists?.map(a => a.name).join(', ') || ''} - ${t.name}`,
                            url: null,
                            duration: (t.duration_ms || 180000),
                            author: t.artists?.[0]?.name || 'Spotify Artist',
                            thumbnail: thumb,
                            source: 'Spotify',
                            requester
                        });
                        return { type: 'TRACK', tracks };
                    }
                }
            } catch (e) {
                console.warn('Spotify url resolution fallback:', e.message);
            }
        }

        // 2. Ultra-Fast Search via play-dl (Takes 0.5s)
        try {
            const pRes = await play.search(query, { limit: 1 }).catch(() => []);
            if (pRes && pRes.length > 0) {
                const item = pRes[0];
                const thumb = item.thumbnails?.[0]?.url || `https://i.ytimg.com/vi/${item.id}/hqdefault.jpg`;
                tracks.push({
                    title: item.title || query,
                    url: item.url,
                    duration: (item.durationInSec || 180) * 1000,
                    author: item.channel?.name || 'Artist',
                    thumbnail: thumb,
                    source: 'Official Audio / Spotify Matched',
                    requester
                });
                return { type: 'TRACK', tracks };
            }
        } catch (pe) {}

        // 3. Fallback Search via yt-dlp spawn
        return new Promise((resolve) => {
            const searchTarget = (query.startsWith('http://') || query.startsWith('https://'))
                ? query
                : `ytsearch1:${query}`;

            const proc = spawn('yt-dlp', [
                '--js-runtimes', 'node',
                '-j',
                '--no-playlist',
                searchTarget
            ]);

            let data = '';
            proc.stdout.on('data', chunk => data += chunk);

            const timer = setTimeout(() => {
                try { proc.kill('SIGKILL'); } catch (e) {}
            }, 10000);

            proc.on('close', () => {
                clearTimeout(timer);
                try {
                    const info = JSON.parse(data);
                    if (info && (info.title || info.webpage_url)) {
                        const thumb = info.thumbnail || (info.id ? `https://i.ytimg.com/vi/${info.id}/hqdefault.jpg` : 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=500&q=80');
                        tracks.push({
                            title: info.title || query,
                            url: info.webpage_url || info.url || searchTarget,
                            duration: (info.duration || 180) * 1000,
                            author: info.uploader || info.channel || 'Artist',
                            thumbnail: thumb,
                            source: 'Official Audio / Spotify Matched',
                            requester
                        });
                        return resolve({ type: 'TRACK', tracks });
                    }
                } catch (pe) {}

                tracks.push({
                    title: query,
                    url: null,
                    duration: 180000,
                    author: 'Artist',
                    thumbnail: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=500&q=80',
                    source: 'Smart Audio Stream',
                    requester
                });
                return resolve({ type: 'TRACK', tracks });
            });

            proc.on('error', () => {
                clearTimeout(timer);
                tracks.push({
                    title: query,
                    url: null,
                    duration: 180000,
                    author: 'Artist',
                    thumbnail: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=500&q=80',
                    source: 'Smart Audio Stream',
                    requester
                });
                return resolve({ type: 'TRACK', tracks });
            });
        });
    }
}

module.exports = {
    StarryAudioEngine,
    StarryGuildPlayer
};
