// ==========================================
// 🎵 FLAVI-STYLE SUPREME MUSIC SUITE (33 COMMANDS)
// File Path: src/commands/bundles/musicCommands.js
// 1-Year Interaction Timers & High Quality Audio
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

// Check if member is in voice and connected to same VC
function getVoiceGuard(ctx) {
    const voiceChannel = ctx.member?.voice?.channel;
    if (!voiceChannel) {
        return { error: '❌ You must be connected to a voice channel first!' };
    }
    const botMember = ctx.guild.members.me;
    if (botMember?.voice?.channelId && botMember.voice.channelId !== voiceChannel.id) {
        return { error: `❌ I am already active in <#${botMember.voice.channelId}>! Join my channel or wait until it's free.` };
    }
    return { voiceChannel, botMember };
}

function getPlayer(client, guildId) {
    return client.manager ? client.manager.getPlayer(guildId) : null;
}

const commands = [
    // 1. PLAY
    {
        name: 'play',
        aliases: ['p'],
        category: 'Music',
        description: 'Play high quality audio from Spotify, SoundCloud, YouTube, Apple Music or query.',
        usage: ',play <song / url>',
        async execute(ctx) {
            const guard = getVoiceGuard(ctx);
            if (guard.error) return ctx.reply(guard.error);

            let query = ctx.isSlash ? ctx.interaction.options.getString('song') : ctx.args.join(' ');
            if (!query || !query.trim()) {
                return ctx.reply('❌ Please provide a song name, Spotify link, or SoundCloud URL!\n*Usage: `,play <song title or URL>`*');
            }
            query = query.trim();

            await ctx.defer();

            const manager = ctx.client.manager;
            if (!manager) return ctx.reply('❌ Lavalink Audio Manager is initializing. Please try again in 5 seconds.');

            try {
                let player = manager.getPlayer(ctx.guild.id);
                if (!player) {
                    player = await manager.createPlayer({
                        guildId: ctx.guild.id,
                        textId: ctx.channel.id,
                        voiceId: guard.voiceChannel.id,
                        volume: 100,
                        deaf: true
                    });
                }

                if (!player) return ctx.reply('❌ Could not connect to audio node. Please try again.');

                let result = null;
                if (query.startsWith('http://') || query.startsWith('https://')) {
                    result = await manager.search(query, { requester: ctx.user });
                } else {
                    const engines = ['spotify', 'soundcloud', 'youtube'];
                    for (const eng of engines) {
                        try {
                            const res = await manager.search(query, { requester: ctx.user, engine: eng });
                            if (res && res.tracks && res.tracks.length > 0 && res.type !== 'EXCEPTION') {
                                result = res;
                                break;
                            }
                        } catch (e) {}
                    }
                    if (!result || !result.tracks.length) {
                        result = await manager.search(`ytmsearch:${query}`, { requester: ctx.user }).catch(() => null);
                    }
                }

                if (!result || !result.tracks || !result.tracks.length || result.type === 'EXCEPTION') {
                    return ctx.reply('❌ No audio results found. Please check your query or link!');
                }

                if (result.type === 'PLAYLIST' || result.type === 'PLAYLIST_LOADED') {
                    for (const track of result.tracks) {
                        player.queue.add(track);
                    }
                    if (!player.playing && !player.paused) await player.play();

                    const embed = new EmbedBuilder()
                        .setColor(config.EMBED_COLORS.MUSIC)
                        .setTitle('📚 Playlist Loaded')
                        .setDescription(`✅ Added **${result.tracks.length}** tracks from **${result.playlistName || 'Playlist'}** to queue!`)
                        .addFields(
                            { name: '🔠 Total Queue', value: `\`${player.queue.length}\` tracks`, inline: true },
                            { name: '👤 Requester', value: `${ctx.user}`, inline: true }
                        )
                        .setFooter({ text: 'Flavi-Style Music System • Prefix: ,' })
                        .setTimestamp();
                    return ctx.reply({ embeds: [embed] });
                } else {
                    const track = result.tracks[0];
                    player.queue.add(track);
                    if (!player.playing && !player.paused) await player.play();

                    const embed = new EmbedBuilder()
                        .setColor(config.EMBED_COLORS.MUSIC)
                        .setAuthor({ name: 'Track Queued', iconURL: ctx.user.displayAvatarURL({ dynamic: true }) })
                        .setTitle(track.title.substring(0, 90))
                        .setURL(track.uri)
                        .setThumbnail(track.thumbnail || 'https://i.imgur.com/8QJ8zuz.png')
                        .setDescription(`👤 **Author:** \`${track.author || 'Unknown'}\`\n🕒 **Duration:** \`${track.isStream ? '🔴 LIVE' : formatTime(track.length)}\`\n🔢 **Queue Position:** \`#${player.queue.length}\``)
                        .setFooter({ text: 'Use ,queue to view songs • Prefix: ,' })
                        .setTimestamp();
                    return ctx.reply({ embeds: [embed] });
                }
            } catch (err) {
                console.error('Play error:', err);
                return ctx.reply(`❌ Playback failed: \`${err.message}\``);
            }
        }
    },

    // 2. PAUSE
    {
        name: 'pause',
        category: 'Music',
        description: 'Pause currently playing music.',
        usage: ',pause',
        async execute(ctx) {
            const player = getPlayer(ctx.client, ctx.guild.id);
            if (!player || !player.queue.current) return ctx.reply('❌ No music is currently playing.');
            if (player.paused) return ctx.reply('⚠️ Music is already paused. Use `,resume` to unpause.');
            player.pause(true);
            return ctx.reply('⏸️ **Paused playback.** Use `,resume` to continue.');
        }
    },

    // 3. RESUME
    {
        name: 'resume',
        aliases: ['unpause'],
        category: 'Music',
        description: 'Resume paused music.',
        usage: ',resume',
        async execute(ctx) {
            const player = getPlayer(ctx.client, ctx.guild.id);
            if (!player || !player.queue.current) return ctx.reply('❌ No music is currently playing.');
            if (!player.paused) return ctx.reply('⚠️ Music is already playing.');
            player.pause(false);
            return ctx.reply('▶️ **Resumed playback.**');
        }
    },

    // 4. SKIP
    {
        name: 'skip',
        aliases: ['s', 'next'],
        category: 'Music',
        description: 'Skip current playing song.',
        usage: ',skip',
        async execute(ctx) {
            const player = getPlayer(ctx.client, ctx.guild.id);
            if (!player || !player.queue.current) return ctx.reply('❌ No music is currently playing.');
            const current = player.queue.current;
            player.skip();
            return ctx.reply(`⏭️ **Skipped:** \`${current.title.substring(0, 50)}\``);
        }
    },

    // 5. SKIPTO / JUMP
    {
        name: 'skipto',
        aliases: ['jump'],
        category: 'Music',
        description: 'Skip directly to a specific track index in queue.',
        usage: ',skipto <track number>',
        async execute(ctx) {
            const player = getPlayer(ctx.client, ctx.guild.id);
            if (!player || !player.queue.current) return ctx.reply('❌ No music is currently playing.');
            const index = parseInt(ctx.args[0]);
            if (isNaN(index) || index < 1 || index > player.queue.length) {
                return ctx.reply(`❌ Please provide a valid track number between \`1\` and \`${player.queue.length}\`!`);
            }
            player.queue.splice(0, index - 1);
            player.skip();
            return ctx.reply(`⏩ **Jumped to track #${index}** in queue!`);
        }
    },

    // 6. STOP / LEAVE / DISCONNECT
    {
        name: 'stop',
        aliases: ['leave', 'dc', 'disconnect'],
        category: 'Music',
        description: 'Stop music, clear queue, and disconnect from VC.',
        usage: ',stop',
        async execute(ctx) {
            const player = getPlayer(ctx.client, ctx.guild.id);
            if (!player) return ctx.reply('❌ No active music session.');
            player.destroy();
            return ctx.reply('⏹️ **Stopped playback, cleared the queue, and disconnected from voice.**');
        }
    },

    // 7. QUEUE
    {
        name: 'queue',
        aliases: ['q', 'list'],
        category: 'Music',
        description: 'View and manage music queue with interactive 1-year buttons.',
        usage: ',queue',
        async execute(ctx) {
            const player = getPlayer(ctx.client, ctx.guild.id);
            if (!player || !player.queue.current) return ctx.reply('📭 The queue is currently empty.');

            const itemsPerPage = 10;
            let page = 0;
            const tracks = player.queue;
            const totalPages = Math.max(Math.ceil(tracks.length / itemsPerPage), 1);

            const buildEmbed = (p) => {
                const current = player.queue.current;
                const start = p * itemsPerPage;
                const slice = tracks.slice(start, start + itemsPerPage);
                const list = slice.length > 0
                    ? slice.map((t, idx) => `\`${start + idx + 1}.\` [${t.title.substring(0, 45)}](${t.uri}) - \`${formatTime(t.length)}\``).join('\n')
                    : '*No upcoming tracks.*';

                return new EmbedBuilder()
                    .setColor(config.EMBED_COLORS.PRIMARY)
                    .setTitle(`🎶 Server Music Queue (${tracks.length} songs)`)
                    .setDescription(`**▶️ Now Playing:**\n[${current.title}](${current.uri}) - \`${formatTime(current.length)}\`\n\n**📑 Up Next:**\n${list}`)
                    .setFooter({ text: `Page ${p + 1}/${totalPages} • 1-Year Interactive Controls • Prefix: ,` })
                    .setTimestamp();
            };

            const buildRow = (p) => {
                return new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId('q_first').setEmoji('⏮️').setStyle(ButtonStyle.Primary).setDisabled(p === 0),
                    new ButtonBuilder().setCustomId('q_prev').setEmoji('◀️').setStyle(ButtonStyle.Primary).setDisabled(p === 0),
                    new ButtonBuilder().setCustomId('q_next').setEmoji('▶️').setStyle(ButtonStyle.Primary).setDisabled(p >= totalPages - 1),
                    new ButtonBuilder().setCustomId('q_last').setEmoji('⏭️').setStyle(ButtonStyle.Primary).setDisabled(p >= totalPages - 1),
                    new ButtonBuilder().setCustomId('q_shuffle').setEmoji('🔀').setLabel('Shuffle').setStyle(ButtonStyle.Secondary)
                );
            };

            const replyMsg = await ctx.reply({ embeds: [buildEmbed(page)], components: totalPages > 1 || tracks.length > 1 ? [buildRow(page)] : [] });

            // 1-Year Component Collector
            const collector = replyMsg.createMessageComponentCollector({ time: ONE_YEAR_MS });
            collector.on('collect', async (i) => {
                if (i.user.id !== ctx.user.id) {
                    return i.reply({ content: '❌ You did not invoke this queue menu.', ephemeral: true });
                }
                if (i.customId === 'q_first') page = 0;
                else if (i.customId === 'q_prev') page = Math.max(0, page - 1);
                else if (i.customId === 'q_next') page = Math.min(totalPages - 1, page + 1);
                else if (i.customId === 'q_last') page = totalPages - 1;
                else if (i.customId === 'q_shuffle') {
                    player.queue.shuffle();
                    page = 0;
                }
                await i.update({ embeds: [buildEmbed(page)], components: [buildRow(page)] }).catch(() => {});
            });
        }
    },

    // 8. NOWPLAYING / NP
    {
        name: 'nowplaying',
        aliases: ['np', 'current'],
        category: 'Music',
        description: 'Display detailed info and live progress bar for current song.',
        usage: ',nowplaying',
        async execute(ctx) {
            const player = getPlayer(ctx.client, ctx.guild.id);
            if (!player || !player.queue.current) return ctx.reply('❌ No music is currently playing.');
            const track = player.queue.current;
            const currentMs = player.position || 0;
            const totalMs = track.length || 0;
            const bar = createProgressBar(currentMs, totalMs, 16);

            const embed = new EmbedBuilder()
                .setColor(config.EMBED_COLORS.MUSIC)
                .setAuthor({ name: 'Now Playing', iconURL: 'https://i.imgur.com/13w1J4L.png' })
                .setTitle(track.title)
                .setURL(track.uri)
                .setThumbnail(track.thumbnail || 'https://i.imgur.com/8QJ8zuz.png')
                .setDescription(
                    `👤 **Artist:** \`${track.author || 'Unknown'}\`\n` +
                    `🕒 **Progress:** \`${formatTime(currentMs)} / ${track.isStream ? 'LIVE' : formatTime(totalMs)}\`\n` +
                    `\`[${bar}]\`\n\n` +
                    `🔊 **Volume:** \`${player.volume}%\` | 🔁 **Loop:** \`${player.loop || 'off'}\` | 📻 **Autoplay:** \`${player.data.get('autoplay') ? 'On' : 'Off'}\`\n` +
                    `👤 **Requester:** ${track.requester ? `<@${track.requester.id}>` : 'Unknown'}`
                )
                .setFooter({ text: 'Flavi-Style Music Engine • Prefix: ,' })
                .setTimestamp();

            return ctx.reply({ embeds: [embed] });
        }
    },

    // 9. VOLUME
    {
        name: 'volume',
        aliases: ['vol', 'v'],
        category: 'Music',
        description: 'Set music volume between 1% and 100%.',
        usage: ',volume <1-100>',
        async execute(ctx) {
            const player = getPlayer(ctx.client, ctx.guild.id);
            if (!player || !player.queue.current) return ctx.reply('❌ No music is currently playing.');

            const val = parseInt(ctx.args[0]);
            if (isNaN(val) || val < 1 || val > 100) {
                return ctx.reply(`🔊 Current volume is **${player.volume}%**. Set with: \`,volume <1-100>\``);
            }
            player.setVolume(val);
            return ctx.reply(`🔊 **Volume updated to ${val}%.**`);
        }
    },

    // 10. LOOP
    {
        name: 'loop',
        aliases: ['repeat', 'lp'],
        category: 'Music',
        description: 'Loop track, queue, or disable looping.',
        usage: ',loop [track / queue / off]',
        async execute(ctx) {
            const player = getPlayer(ctx.client, ctx.guild.id);
            if (!player || !player.queue.current) return ctx.reply('❌ No music is currently playing.');

            const modeArg = ctx.args[0]?.toLowerCase();
            let newMode = 'none';

            if (modeArg === 'track' || modeArg === 'song' || modeArg === 'current') newMode = 'track';
            else if (modeArg === 'queue' || modeArg === 'all' || modeArg === 'q') newMode = 'queue';
            else if (modeArg === 'off' || modeArg === 'disable') newMode = 'none';
            else {
                // Toggle mode
                if (player.loop === 'none') newMode = 'track';
                else if (player.loop === 'track') newMode = 'queue';
                else newMode = 'none';
            }

            player.setLoop(newMode);
            const status = newMode === 'track' ? '🔂 Loop Track' : newMode === 'queue' ? '🔁 Loop Queue' : '🚫 Loop Disabled';
            return ctx.reply(`⚙️ **Loop mode set to:** \`${status}\``);
        }
    },

    // 11. SHUFFLE
    {
        name: 'shuffle',
        aliases: ['shuff', 'mix'],
        category: 'Music',
        description: 'Shuffle all songs in queue randomly.',
        usage: ',shuffle',
        async execute(ctx) {
            const player = getPlayer(ctx.client, ctx.guild.id);
            if (!player || player.queue.length < 2) return ctx.reply('❌ Need at least 2 songs in queue to shuffle.');
            player.queue.shuffle();
            return ctx.reply(`🔀 **Shuffled ${player.queue.length} songs in the queue!**`);
        }
    },

    // 12. SEEK
    {
        name: 'seek',
        category: 'Music',
        description: 'Seek to a timestamp in current song (e.g. 1:30 or 90).',
        usage: ',seek <time in seconds or mm:ss>',
        async execute(ctx) {
            const player = getPlayer(ctx.client, ctx.guild.id);
            if (!player || !player.queue.current) return ctx.reply('❌ No music is currently playing.');
            const input = ctx.args[0];
            if (!input) return ctx.reply('❌ Specify time to seek to (e.g. `,seek 1:30` or `,seek 90`).');

            let seconds = 0;
            if (input.includes(':')) {
                const parts = input.split(':').map(Number);
                if (parts.length === 2) seconds = parts[0] * 60 + parts[1];
                else if (parts.length === 3) seconds = parts[0] * 3600 + parts[1] * 60 + parts[2];
            } else {
                seconds = parseInt(input);
            }

            if (isNaN(seconds) || seconds < 0 || seconds * 1000 > player.queue.current.length) {
                return ctx.reply(`❌ Invalid timestamp! Song length is \`${formatTime(player.queue.current.length)}\`.`);
            }
            player.seek(seconds * 1000);
            return ctx.reply(`⏩ **Seeked to:** \`${formatTime(seconds * 1000)}\``);
        }
    },

    // 13. FORWARD
    {
        name: 'forward',
        aliases: ['ff', 'fwd'],
        category: 'Music',
        description: 'Fast-forward X seconds in current song.',
        usage: ',forward [seconds]',
        async execute(ctx) {
            const player = getPlayer(ctx.client, ctx.guild.id);
            if (!player || !player.queue.current) return ctx.reply('❌ No music is currently playing.');
            const secs = parseInt(ctx.args[0]) || 15;
            const newPos = Math.min(player.position + secs * 1000, player.queue.current.length);
            player.seek(newPos);
            return ctx.reply(`⏩ **Fast-forwarded ${secs}s** to \`${formatTime(newPos)}\`.`);
        }
    },

    // 14. REWIND
    {
        name: 'rewind',
        aliases: ['rw', 'back'],
        category: 'Music',
        description: 'Rewind X seconds in current song.',
        usage: ',rewind [seconds]',
        async execute(ctx) {
            const player = getPlayer(ctx.client, ctx.guild.id);
            if (!player || !player.queue.current) return ctx.reply('❌ No music is currently playing.');
            const secs = parseInt(ctx.args[0]) || 15;
            const newPos = Math.max(player.position - secs * 1000, 0);
            player.seek(newPos);
            return ctx.reply(`⏪ **Rewinded ${secs}s** to \`${formatTime(newPos)}\`.`);
        }
    },

    // 15. REPLAY
    {
        name: 'replay',
        aliases: ['restart'],
        category: 'Music',
        description: 'Replay currently playing song from start.',
        usage: ',replay',
        async execute(ctx) {
            const player = getPlayer(ctx.client, ctx.guild.id);
            if (!player || !player.queue.current) return ctx.reply('❌ No music is currently playing.');
            player.seek(0);
            return ctx.reply('🔄 **Replaying current track from the beginning.**');
        }
    },

    // 16. PREVIOUS
    {
        name: 'previous',
        aliases: ['prev'],
        category: 'Music',
        description: 'Play previous song.',
        usage: ',previous',
        async execute(ctx) {
            const player = getPlayer(ctx.client, ctx.guild.id);
            if (!player) return ctx.reply('❌ No active music session.');
            const prev = player.data.get('previousTrack');
            if (!prev) return ctx.reply('❌ No previous track recorded.');
            player.queue.unshift(prev);
            player.skip();
            return ctx.reply(`⏮️ **Playing previous song:** \`${prev.title.substring(0, 50)}\``);
        }
    },

    // 17. CLEARQUEUE
    {
        name: 'clearqueue',
        aliases: ['cq', 'clearq'],
        category: 'Music',
        description: 'Clear all upcoming songs from queue.',
        usage: ',clearqueue',
        async execute(ctx) {
            const player = getPlayer(ctx.client, ctx.guild.id);
            if (!player || player.queue.length === 0) return ctx.reply('📭 Queue is already empty.');
            const count = player.queue.length;
            player.queue.clear();
            return ctx.reply(`🗑️ **Cleared ${count} songs from the queue.**`);
        }
    },

    // 18. REMOVE
    {
        name: 'remove',
        aliases: ['del', 'rm'],
        category: 'Music',
        description: 'Remove a specific song from queue by position number.',
        usage: ',remove <track number>',
        async execute(ctx) {
            const player = getPlayer(ctx.client, ctx.guild.id);
            if (!player || player.queue.length === 0) return ctx.reply('📭 Queue is empty.');
            const pos = parseInt(ctx.args[0]);
            if (isNaN(pos) || pos < 1 || pos > player.queue.length) {
                return ctx.reply(`❌ Specify a valid track number from \`1\` to \`${player.queue.length}\`.`);
            }
            const removed = player.queue.remove(pos - 1);
            return ctx.reply(`🗑️ **Removed track #${pos}:** \`${removed ? removed.title.substring(0, 45) : 'Track'}\``);
        }
    },

    // 19. MOVESONG
    {
        name: 'movesong',
        aliases: ['move', 'mv'],
        category: 'Music',
        description: 'Move a song from one position in queue to another.',
        usage: ',movesong <from> <to>',
        async execute(ctx) {
            const player = getPlayer(ctx.client, ctx.guild.id);
            if (!player || player.queue.length < 2) return ctx.reply('❌ Need at least 2 songs in queue.');
            const from = parseInt(ctx.args[0]);
            const to = parseInt(ctx.args[1]);
            if (isNaN(from) || isNaN(to) || from < 1 || to < 1 || from > player.queue.length || to > player.queue.length) {
                return ctx.reply(`❌ Provide valid positions between \`1\` and \`${player.queue.length}\`.\n*Usage: \`,movesong 5 1\`*`);
            }
            const target = player.queue[from - 1];
            player.queue.splice(from - 1, 1);
            player.queue.splice(to - 1, 0, target);
            return ctx.reply(`🔀 **Moved:** \`${target.title.substring(0, 40)}\` from \`#${from}\` to \`#${to}\`!`);
        }
    },

    // 20. AUTOPLAY
    {
        name: 'autoplay',
        aliases: ['ap', 'autoradio'],
        category: 'Music',
        description: 'Toggle smart continuous autoplay recommendations.',
        usage: ',autoplay',
        async execute(ctx) {
            const player = getPlayer(ctx.client, ctx.guild.id);
            if (!player) return ctx.reply('❌ No active music session.');
            const currentVal = player.data.get('autoplay') || false;
            player.data.set('autoplay', !currentVal);
            return ctx.reply(`📻 **Autoplay is now ${!currentVal ? 'ENABLED 🟢' : 'DISABLED 🔴'}.**`);
        }
    },

    // 21. BASSBOOST
    {
        name: 'bassboost',
        aliases: ['bb'],
        category: 'Music',
        description: 'Toggle bassboost filter.',
        usage: ',bassboost [off / low / medium / high]',
        async execute(ctx) {
            const player = getPlayer(ctx.client, ctx.guild.id);
            if (!player) return ctx.reply('❌ No active music session.');
            const level = ctx.args[0]?.toLowerCase();
            if (level === 'off' || level === 'clear') {
                await player.shoukaku.clearFilters();
                return ctx.reply('🚫 **Bassboost disabled.**');
            }
            const gain = level === 'high' ? 0.35 : level === 'low' ? 0.15 : 0.25;
            await player.shoukaku.setEqualizer([{ band: 0, gain: gain }, { band: 1, gain: gain * 0.8 }, { band: 2, gain: gain * 0.5 }]);
            return ctx.reply(`🎸 **Bassboost applied (${level || 'medium'}).**`);
        }
    },

    // 22. NIGHTCORE
    {
        name: 'nightcore',
        aliases: ['nc'],
        category: 'Music',
        description: 'Apply Nightcore high pitch & fast speed filter.',
        usage: ',nightcore',
        async execute(ctx) {
            const player = getPlayer(ctx.client, ctx.guild.id);
            if (!player) return ctx.reply('❌ No active music session.');
            await player.shoukaku.setTimescale({ speed: 1.25, pitch: 1.25, rate: 1.0 });
            return ctx.reply('✨ **Nightcore filter applied!**');
        }
    },

    // 23. DAYCORE
    {
        name: 'daycore',
        aliases: ['dc_filter'],
        category: 'Music',
        description: 'Apply Daycore slowed audio filter.',
        usage: ',daycore',
        async execute(ctx) {
            const player = getPlayer(ctx.client, ctx.guild.id);
            if (!player) return ctx.reply('❌ No active music session.');
            await player.shoukaku.setTimescale({ speed: 0.85, pitch: 0.85, rate: 1.0 });
            return ctx.reply('🌅 **Daycore (slowed) filter applied!**');
        }
    },

    // 24. VAPORWAVE
    {
        name: 'vaporwave',
        aliases: ['vw'],
        category: 'Music',
        description: 'Apply Vaporwave aesthetic audio filter.',
        usage: ',vaporwave',
        async execute(ctx) {
            const player = getPlayer(ctx.client, ctx.guild.id);
            if (!player) return ctx.reply('❌ No active music session.');
            await player.shoukaku.setTimescale({ speed: 0.8, pitch: 0.75, rate: 1.0 });
            return ctx.reply('🪩 **Vaporwave filter applied!**');
        }
    },

    // 25. 8D AUDIO
    {
        name: '8d',
        aliases: ['surround'],
        category: 'Music',
        description: 'Apply 360 degree 8D surround sound effect.',
        usage: ',8d',
        async execute(ctx) {
            const player = getPlayer(ctx.client, ctx.guild.id);
            if (!player) return ctx.reply('❌ No active music session.');
            await player.shoukaku.setRotation({ rotationHz: 0.2 });
            return ctx.reply('🌀 **8D Audio Surround filter active! (Best experienced with headphones 🎧)**');
        }
    },

    // 26. KARAOKE
    {
        name: 'karaoke',
        category: 'Music',
        description: 'Suppress vocals for singing along.',
        usage: ',karaoke',
        async execute(ctx) {
            const player = getPlayer(ctx.client, ctx.guild.id);
            if (!player) return ctx.reply('❌ No active music session.');
            await player.shoukaku.setKaraoke({ level: 1.0, monoLevel: 1.0, filterBand: 220.0, filterWidth: 100.0 });
            return ctx.reply('🎤 **Karaoke vocal reducer active!**');
        }
    },

    // 27. TREMOLO
    {
        name: 'tremolo',
        category: 'Music',
        description: 'Apply tremolo volume modulation.',
        usage: ',tremolo',
        async execute(ctx) {
            const player = getPlayer(ctx.client, ctx.guild.id);
            if (!player) return ctx.reply('❌ No active music session.');
            await player.shoukaku.setTremolo({ frequency: 4.0, depth: 0.75 });
            return ctx.reply('🌊 **Tremolo wave filter applied!**');
        }
    },

    // 28. VIBRATO
    {
        name: 'vibrato',
        category: 'Music',
        description: 'Apply vibrato pitch oscillation filter.',
        usage: ',vibrato',
        async execute(ctx) {
            const player = getPlayer(ctx.client, ctx.guild.id);
            if (!player) return ctx.reply('❌ No active music session.');
            await player.shoukaku.setVibrato({ frequency: 6.0, depth: 0.6 });
            return ctx.reply('〰️ **Vibrato filter applied!**');
        }
    },

    // 29. CLEARFILTERS
    {
        name: 'clearfilters',
        aliases: ['resetfilters', 'cf'],
        category: 'Music',
        description: 'Reset all active audio filters and effects.',
        usage: ',clearfilters',
        async execute(ctx) {
            const player = getPlayer(ctx.client, ctx.guild.id);
            if (!player) return ctx.reply('❌ No active music session.');
            await player.shoukaku.clearFilters();
            return ctx.reply('🚫 **All audio filters have been cleared.**');
        }
    },

    // 30. DJPANEL
    {
        name: 'djpanel',
        aliases: ['musicpanel', 'dj'],
        category: 'Music',
        description: 'Spawn persistent 1-Year interactive DJ & Voice Control Hub.',
        usage: ',djpanel',
        async execute(ctx) {
            const voiceChannel = ctx.member?.voice?.channel;
            const vcName = voiceChannel ? voiceChannel.name : 'Not Connected';
            const vcLimit = voiceChannel && voiceChannel.userLimit === 0 ? 'Unlimited' : (voiceChannel ? voiceChannel.userLimit : 'N/A');

            const embed = new EmbedBuilder()
                .setColor(config.EMBED_COLORS.PRIMARY)
                .setTitle('🎛️ Master DJ & Audio Intelligence Hub')
                .setDescription(
                    `Complete audio controller and voice security center.\n\n` +
                    `🎙️ **Active VC:** \`${vcName}\`\n` +
                    `👥 **Capacity:** \`${voiceChannel ? voiceChannel.members.size : 0} / ${vcLimit}\`\n\n` +
                    `*Buttons remain fully responsive with high interaction lifetime up to 1 year!*`
                )
                .addFields(
                    { name: '🎵 Playback', value: 'Control Pause, Skip, Loop, Shuffle, and Volume', inline: true },
                    { name: '🔒 Security', value: 'Lock or Unlock your current voice channel', inline: true }
                )
                .setFooter({ text: 'Starry & Flavi Multi-Bot Audio Hub • Prefix: ,' })
                .setTimestamp();

            const row1 = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('music_pause').setLabel('Pause/Resume').setEmoji('⏸️').setStyle(ButtonStyle.Primary),
                new ButtonBuilder().setCustomId('music_skip').setLabel('Skip').setEmoji('⏭️').setStyle(ButtonStyle.Secondary),
                new ButtonBuilder().setCustomId('dj_loop').setLabel('Loop').setEmoji('🔁').setStyle(ButtonStyle.Secondary),
                new ButtonBuilder().setCustomId('dj_shuffle').setLabel('Shuffle').setEmoji('🔀').setStyle(ButtonStyle.Secondary),
                new ButtonBuilder().setCustomId('music_stop').setLabel('Stop').setEmoji('⏹️').setStyle(ButtonStyle.Danger)
            );

            const row2 = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('dj_vol_down').setLabel('-10% Vol').setEmoji('🔉').setStyle(ButtonStyle.Secondary),
                new ButtonBuilder().setCustomId('dj_vol_up').setLabel('+10% Vol').setEmoji('🔊').setStyle(ButtonStyle.Secondary),
                new ButtonBuilder().setCustomId('dj_lock').setLabel('Lock VC').setEmoji('🔒').setStyle(ButtonStyle.Success),
                new ButtonBuilder().setCustomId('dj_unlock').setLabel('Unlock VC').setEmoji('🔓').setStyle(ButtonStyle.Success),
                new ButtonBuilder().setCustomId('dj_clear_queue').setLabel('Clear Queue').setEmoji('🗑️').setStyle(ButtonStyle.Danger)
            );

            const filterRow = new ActionRowBuilder().addComponents(
                new StringSelectMenuBuilder().setCustomId('music_filter').setPlaceholder('🎚️ Select audio filter effect...').addOptions([
                    { label: 'Clear Filters', description: 'Removes all audio effects', value: 'clear', emoji: '🚫' },
                    { label: 'Bassboost (Medium)', description: 'Boosts low end bass frequencies', value: 'bassboost', emoji: '🎸' },
                    { label: '8D Audio Surround', description: '360° Rotating stereo sound', value: '8d', emoji: '🌀' },
                    { label: 'Nightcore', description: 'Higher pitch + faster pace', value: 'nightcore', emoji: '✨' },
                    { label: 'Daycore', description: 'Slowed + deep atmosphere', value: 'daycore', emoji: '🌅' },
                    { label: 'Vaporwave', description: 'Slowed + aesthetic reverb', value: 'vaporwave', emoji: '🪩' }
                ])
            );

            return ctx.reply({ embeds: [embed], components: [row1, row2, filterRow] });
        }
    },

    // 31. LYRICS
    {
        name: 'lyrics',
        aliases: ['ly'],
        category: 'Music',
        description: 'Fetch lyrics for currently playing or queried song.',
        usage: ',lyrics [song name]',
        async execute(ctx) {
            let query = ctx.args.join(' ');
            const player = getPlayer(ctx.client, ctx.guild.id);
            if (!query && player && player.queue.current) {
                query = player.queue.current.title;
            }
            if (!query) return ctx.reply('❌ Specify a song title or play music first: `,lyrics <song>`');

            await ctx.defer();
            try {
                const searchClean = encodeURIComponent(query.replace(/\([^)]*\)|\[[^\]]*\]/g, '').trim());
                const res = await fetch(`https://some-random-api.com/lyrics?title=${searchClean}`);
                if (!res.ok) throw new Error('Not found');
                const data = await res.json();

                if (!data || !data.lyrics) return ctx.reply(`❌ No lyrics found for **${query}**.`);

                const lyricsText = data.lyrics.length > 3900 ? data.lyrics.substring(0, 3900) + '\n\n*...[Truncated]*' : data.lyrics;

                const embed = new EmbedBuilder()
                    .setColor(config.EMBED_COLORS.PRIMARY)
                    .setTitle(`🎙️ Lyrics: ${data.title || query}`)
                    .setAuthor({ name: data.author || 'Unknown Artist' })
                    .setThumbnail(data.thumbnail?.genius || null)
                    .setDescription(lyricsText)
                    .setFooter({ text: 'Flavi-Style Music Engine • Prefix: ,' })
                    .setTimestamp();

                return ctx.reply({ embeds: [embed] });
            } catch (err) {
                return ctx.reply(`❌ Could not retrieve lyrics for \`${query}\`.`);
            }
        }
    },

    // 32. JOIN / SUMMON
    {
        name: 'join',
        aliases: ['summon', 'j'],
        category: 'Music',
        description: 'Summon bot to your current voice channel.',
        usage: ',join',
        async execute(ctx) {
            const guard = getVoiceGuard(ctx);
            if (guard.error) return ctx.reply(guard.error);

            const manager = ctx.client.manager;
            if (!manager) return ctx.reply('❌ Audio manager offline.');

            let player = manager.getPlayer(ctx.guild.id);
            if (!player) {
                player = await manager.createPlayer({
                    guildId: ctx.guild.id,
                    textId: ctx.channel.id,
                    voiceId: guard.voiceChannel.id,
                    volume: 100,
                    deaf: true
                });
            } else {
                player.setVoiceChannel(guard.voiceChannel.id);
            }
            return ctx.reply(`🔊 **Connected to voice channel:** <#${guard.voiceChannel.id}>`);
        }
    },

    // 33. STAY247
    {
        name: 'stay247',
        aliases: ['247', 'stay'],
        category: 'Music',
        description: 'Toggle 24/7 continuous voice channel stay mode.',
        usage: ',247',
        async execute(ctx) {
            if (!ctx.member.permissions.has(PermissionFlagsBits.ManageGuild)) {
                return ctx.reply('❌ You need **Manage Server** permissions to toggle 24/7 mode.');
            }
            const player = getPlayer(ctx.client, ctx.guild.id);
            if (!player) return ctx.reply('❌ Start playing music in a voice channel first with `,play`.');

            const current = player.data.get('stay247') || false;
            player.data.set('stay247', !current);
            return ctx.reply(`🛡️ **24/7 Stay Mode is now ${!current ? 'ENABLED 🟢 (Bot will not leave empty VC)' : 'DISABLED 🔴'}.**`);
        }
    }
];

module.exports = commands;
