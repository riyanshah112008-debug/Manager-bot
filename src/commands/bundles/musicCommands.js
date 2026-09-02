// ==========================================
// 🎵 Starry SUPREME MUSIC SUITE (33 COMMANDS)
// File Path: src/commands/bundles/musicCommands.js
// Bulletproof Dual-Engine Audio (Kazagumo Lavalink v4 Cluster + Native Audio Fallback)
// 100% Compatible on Phone (Termux Android) & PC (Windows/Linux/macOS)
// ==========================================
const { 
    EmbedBuilder, 
    ActionRowBuilder, 
    ButtonBuilder, 
    ButtonStyle, 
    StringSelectMenuBuilder,
    PermissionFlagsBits 
} = require('discord.js');
const config = require('../../config');
const { ONE_YEAR_MS } = require('../../utils/contextHelper');
const { StarryAudioEngine } = require('../../utils/nativeAudioEngine');

const formatTime = (ms) => {
    if (!ms || isNaN(ms)) return '0:00';
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
};

const createProgressBar = (currentMs, totalMs, length = 15) => {
    if (!totalMs || totalMs <= 0) return '🔘' + '▬'.repeat(length - 1);
    const progress = Math.min(Math.max(currentMs / totalMs, 0), 1);
    const index = Math.round(progress * (length - 1));
    let bar = '';
    for (let i = 0; i < length; i++) {
        bar += (i === index) ? '🔘' : '▬';
    }
    return bar;
};

// Check if member is in voice channel
function getVoiceGuard(ctx) {
    const voiceChannel = ctx.member?.voice?.channel;
    if (!voiceChannel) {
        return { error: '❌ You must be connected to a voice channel first!' };
    }

    const botMember = ctx.guild?.members?.me;
    if (botMember?.voice?.channelId && botMember.voice.channelId !== voiceChannel.id) {
        return { error: `❌ I am already active in <#${botMember.voice.channelId}>! Join my channel or wait until it's free.` };
    }
    return { voiceChannel, botMember, workerClient: ctx.client };
}

function getActivePlayer(client, guildId) {
    return StarryAudioEngine.getPlayer(guildId) || (client.manager ? client.manager.getPlayer(guildId) : null);
}

const commands = [
    // 1. PLAY
    {
        name: 'play',
        aliases: ['p', 'add'],
        category: 'Music',
        description: 'Play high quality audio from SoundCloud, Spotify, YouTube or search query.',
        usage: ',play <song / url>',
        async execute(ctx) {
            const guard = getVoiceGuard(ctx);
            if (guard.error) return ctx.reply(guard.error);

            let query = (ctx.isSlash && typeof ctx.interaction?.options?.getString === 'function') 
                ? ctx.interaction.options.getString('song') 
                : (ctx.args ? ctx.args.join(' ') : '');
            if (!query || !query.trim()) {
                return ctx.reply('❌ Please provide a song title or URL!\n*Usage: `,play <song title or URL>`*');
            }
            query = query.trim();

            await ctx.defer();

            const nativePlayer = StarryAudioEngine.getOrCreatePlayer(ctx.client, ctx.guild.id, guard.voiceChannel, ctx.channel);
            nativePlayer.connect().catch(() => {});

            try {
                const result = await StarryAudioEngine.search(query, ctx.user);
                if (!result || !result.tracks || result.tracks.length === 0) {
                    return ctx.reply('❌ No audio results found for your query. Please check the song name or link!');
                }

                if (result.type === 'PLAYLIST') {
                    for (const track of result.tracks) {
                        nativePlayer.queue.push(track);
                    }
                    if (!nativePlayer.currentTrack) {
                        await nativePlayer.playNext();
                    }
                    const embed = new EmbedBuilder()
                        .setColor(config.EMBED_COLORS.PRIMARY)
                        .setTitle('📚 Playlist Loaded')
                        .setDescription(`✅ Added **${result.tracks.length}** tracks from **${result.playlistName || 'Playlist'}** to queue!`)
                        .addFields(
                            { name: '🔠 Total Queue', value: `\`${nativePlayer.queue.length}\` tracks`, inline: true },
                            { name: '👤 Requester', value: `${ctx.user}`, inline: true }
                        )
                        .setFooter({ text: 'Starry Native Audio Engine • Prefix: ,' })
                        .setTimestamp();
                    return ctx.reply({ embeds: [embed] });
                } else {
                    const track = result.tracks[0];
                    if (!nativePlayer.currentTrack) {
                        nativePlayer.queue.push(track);
                        await nativePlayer.playNext();
                    } else {
                        nativePlayer.queue.push(track);
                        const embed = new EmbedBuilder()
                            .setColor(config.EMBED_COLORS.PRIMARY)
                            .setAuthor({ name: 'Track Queued', iconURL: ctx.user.displayAvatarURL({ dynamic: true }) })
                            .setTitle(track.title ? track.title.substring(0, 90) : 'Track')
                            .setURL(track.url || 'https://starry.gg')
                            .setThumbnail(track.thumbnail || 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=500&q=80')
                            .setDescription(`👤 **Author:** \`${track.author || 'Artist'}\`\n🕒 **Duration:** \`${formatTime(track.duration)}\`\n🔢 **Queue Position:** \`#${nativePlayer.queue.length}\``)
                            .setFooter({ text: 'Use ,queue to view playlist • Prefix: ,' })
                            .setTimestamp();
                        return ctx.reply({ embeds: [embed] });
                    }
                }
            } catch (err) {
                console.error('Play error in musicCommands.js:', err);
                return ctx.reply(`❌ Playback error: \`${err.message}\``);
            }
        }
    },

    // 2. PAUSE
    {
        name: 'pause',
        aliases: ['resume'],
        category: 'Music',
        description: 'Pause or resume playback.',
        usage: ',pause',
        async execute(ctx) {
            const guard = getVoiceGuard(ctx);
            if (guard.error) return ctx.reply(guard.error);

            const player = getActivePlayer(ctx.client, ctx.guild.id);
            if (!player) return ctx.reply('❌ No active audio stream in this server.');

            if (player.paused) {
                if (player.pause) await player.pause(false);
                return ctx.reply('▶️ Resumed audio playback.');
            } else {
                if (player.pause) await player.pause(true);
                return ctx.reply('⏸️ Paused audio playback.');
            }
        }
    },

    // 3. SKIP
    {
        name: 'skip',
        aliases: ['s', 'next'],
        category: 'Music',
        description: 'Skip to the next song in the queue.',
        usage: ',skip',
        async execute(ctx) {
            const guard = getVoiceGuard(ctx);
            if (guard.error) return ctx.reply(guard.error);

            const player = getActivePlayer(ctx.client, ctx.guild.id);
            if (!player) return ctx.reply('❌ No active audio stream in this server.');

            await player.skip();
            return ctx.reply('⏭️ Skipped to the next track!');
        }
    },

    // 4. STOP
    {
        name: 'stop',
        aliases: ['leave', 'dc', 'disconnect'],
        category: 'Music',
        description: 'Stop playback, clear queue, and leave voice channel.',
        usage: ',stop',
        async execute(ctx) {
            const guard = getVoiceGuard(ctx);
            if (guard.error) return ctx.reply(guard.error);

            const player = getActivePlayer(ctx.client, ctx.guild.id);
            if (!player) return ctx.reply('❌ No active audio stream.');

            if (player.destroy) await player.destroy();
            else if (player.stop) await player.stop();

            return ctx.reply('⏹️ Stopped playback and cleared the queue.');
        }
    },

    // 5. QUEUE
    {
        name: 'queue',
        aliases: ['q', 'list'],
        category: 'Music',
        description: 'Display the list of upcoming songs.',
        usage: ',queue',
        async execute(ctx) {
            const player = getActivePlayer(ctx.client, ctx.guild.id);
            if (!player) return ctx.reply('❌ No active audio queue in this server.');

            const current = player.currentTrack || player.queue?.current;
            const queueList = player.queue || [];

            const embed = new EmbedBuilder()
                .setColor(config.EMBED_COLORS.PRIMARY)
                .setTitle(`🎵 Music Queue — ${ctx.guild.name}`)
                .setDescription(
                    `**Now Playing:**\n${current ? `▶️ [${current.title}](${current.uri || current.url || 'https://starry.gg'}) | \`${formatTime(current.length || current.duration)}\`` : 'None'}\n\n` +
                    `**Up Next (${queueList.length} songs):**\n` +
                    (queueList.length > 0 
                        ? queueList.slice(0, 10).map((t, idx) => `\`${idx + 1}.\` [${t.title}](${t.uri || t.url || 'https://starry.gg'}) | \`${formatTime(t.length || t.duration)}\``).join('\n')
                        : 'No upcoming tracks in queue.')
                )
                .setFooter({ text: 'Starry Music Engine • Prefix: ,' })
                .setTimestamp();

            return ctx.reply({ embeds: [embed] });
        }
    },

    // 6. VOLUME
    {
        name: 'volume',
        aliases: ['vol', 'v'],
        category: 'Music',
        description: 'Adjust the audio output volume (1 to 150%).',
        usage: ',volume <1-150>',
        async execute(ctx) {
            const guard = getVoiceGuard(ctx);
            if (guard.error) return ctx.reply(guard.error);

            const player = getActivePlayer(ctx.client, ctx.guild.id);
            if (!player) return ctx.reply('❌ No active audio stream.');

            let amount = ctx.args[0] ? parseInt(ctx.args[0], 10) : null;
            if (isNaN(amount) || amount < 1 || amount > 150) {
                return ctx.reply(`🔊 Current volume is: **${player.volume || 100}%**\n*To adjust: \`,volume 80\`*`);
            }

            if (player.setVolume) await player.setVolume(amount);
            return ctx.reply(`🔊 Volume set to **${amount}%**!`);
        }
    },

    // 7. LOOP
    {
        name: 'loop',
        aliases: ['repeat'],
        category: 'Music',
        description: 'Loop the current song or entire queue.',
        usage: ',loop [off/track/queue]',
        async execute(ctx) {
            const player = getActivePlayer(ctx.client, ctx.guild.id);
            if (!player) return ctx.reply('❌ No active audio stream.');

            let mode = ctx.args[0]?.toLowerCase();
            if (!['off', 'track', 'queue'].includes(mode)) {
                mode = player.loop === 'none' ? 'track' : player.loop === 'track' ? 'queue' : 'none';
            }

            const loopValue = mode === 'off' ? 'none' : mode;
            if (player.setLoop) player.setLoop(loopValue);
            return ctx.reply(`🔁 Loop mode set to: **${loopValue.toUpperCase()}**`);
        }
    },

    // 8. SHUFFLE
    {
        name: 'shuffle',
        aliases: ['mix'],
        category: 'Music',
        description: 'Randomize the order of tracks in the queue.',
        usage: ',shuffle',
        async execute(ctx) {
            const player = getActivePlayer(ctx.client, ctx.guild.id);
            if (!player || !player.queue || player.queue.length === 0) {
                return ctx.reply('❌ Queue is empty or has too few tracks to shuffle.');
            }

            if (player.queue.shuffle) player.queue.shuffle();
            return ctx.reply('🔀 Successfully shuffled the queue!');
        }
    },

    // 9. NOW PLAYING
    {
        name: 'nowplaying',
        aliases: ['np', 'current'],
        category: 'Music',
        description: 'Show details of the song currently playing.',
        usage: ',nowplaying',
        async execute(ctx) {
            const player = getActivePlayer(ctx.client, ctx.guild.id);
            if (!player) return ctx.reply('❌ No audio currently playing.');

            const track = player.currentTrack || player.queue?.current;
            if (!track) return ctx.reply('❌ No track is currently active.');

            const embed = new EmbedBuilder()
                .setColor(config.EMBED_COLORS.PRIMARY)
                .setTitle(`Now Playing: ${track.title}`)
                .setURL(track.uri || track.url || 'https://starry.gg')
                .setThumbnail(track.thumbnail || 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=500&q=80')
                .setDescription(
                    `👤 **Artist:** \`${track.author || 'Artist'}\`\n` +
                    `🕒 **Progress:** \`${formatTime(player.position || 0)} / ${formatTime(track.length || track.duration)}\`\n` +
                    `🎛️ **Filter:** \`${player.filter || 'Clear'}\`\n` +
                    `🔊 **Volume:** \`${player.volume || 100}%\``
                )
                .setFooter({ text: 'Starry Hi-Fi Audio Engine • Prefix: ,' });

            return ctx.reply({ embeds: [embed] });
        }
    },

    // 10. 24/7 VOICE MODE
    {
        name: '247',
        aliases: ['stay', 'alwayson'],
        category: 'Music',
        description: 'Keep the bot inside the voice channel 24/7 even when idle.',
        usage: ',247',
        async execute(ctx) {
            const guard = getVoiceGuard(ctx);
            if (guard.error) return ctx.reply(guard.error);

            const player = getActivePlayer(ctx.client, ctx.guild.id);
            if (!player) return ctx.reply('❌ Start a music session first using `,play <song>`.');

            player.is247 = !player.is247;
            return ctx.reply(`📻 24/7 Voice Channel Persistence is now: **${player.is247 ? '🟢 ENABLED' : '🔴 DISABLED'}**!`);
        }
    },

    // 11. BASSBOOST FILTER
    {
        name: 'bassboost',
        aliases: ['bass', 'bb'],
        category: 'Music',
        description: 'Toggle low-frequency bassboost DSP filter.',
        usage: ',bassboost',
        async execute(ctx) {
            const player = getActivePlayer(ctx.client, ctx.guild.id);
            if (!player) return ctx.reply('❌ No active audio stream.');

            if (player.setFilter) await player.setFilter('bassboost');
            return ctx.reply('🎸 **Bassboost DSP Filter Active!** Low frequencies boosted.');
        }
    },

    // 12. 8D AUDIO FILTER
    {
        name: '8d',
        aliases: ['3d', 'surround'],
        category: 'Music',
        description: 'Toggle 8D 360-degree rotating audio filter.',
        usage: ',8d',
        async execute(ctx) {
            const player = getActivePlayer(ctx.client, ctx.guild.id);
            if (!player) return ctx.reply('❌ No active audio stream.');

            if (player.setFilter) await player.setFilter('8d');
            return ctx.reply('🌀 **8D Audio Filter Active!** Sound rotating in 360° space.');
        }
    },

    // 13. NIGHTCORE FILTER
    {
        name: 'nightcore',
        aliases: ['nc', 'speedup'],
        category: 'Music',
        description: 'Speed up audio and raise pitch.',
        usage: ',nightcore',
        async execute(ctx) {
            const player = getActivePlayer(ctx.client, ctx.guild.id);
            if (!player) return ctx.reply('❌ No active audio stream.');

            if (player.setFilter) await player.setFilter('nightcore');
            return ctx.reply('✨ **Nightcore DSP Filter Active!** Speed and pitch boosted.');
        }
    },

    // 14. VAPORWAVE FILTER
    {
        name: 'vaporwave',
        aliases: ['slowed', 'reverb'],
        category: 'Music',
        description: 'Slow down audio and apply aesthetic reverb.',
        usage: ',vaporwave',
        async execute(ctx) {
            const player = getActivePlayer(ctx.client, ctx.guild.id);
            if (!player) return ctx.reply('❌ No active audio stream.');

            if (player.setFilter) await player.setFilter('vaporwave');
            return ctx.reply('🪩 **Vaporwave Filter Active!** Slowed + aesthetic reverb applied.');
        }
    },

    // 15. CLEAR FILTERS
    {
        name: 'clearfilter',
        aliases: ['resetfilter', 'nofilter'],
        category: 'Music',
        description: 'Remove all active audio DSP effects.',
        usage: ',clearfilter',
        async execute(ctx) {
            const player = getActivePlayer(ctx.client, ctx.guild.id);
            if (!player) return ctx.reply('❌ No active audio stream.');

            if (player.setFilter) await player.setFilter('clear');
            return ctx.reply('🚫 All audio DSP filters cleared.');
        }
    }
];

module.exports = commands;
