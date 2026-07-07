process.env.FFMPEG_PATH = require('ffmpeg-static');

const { EmbedBuilder, PermissionsBitField } = require('discord.js');
const { DefaultExtractors, SoundCloudExtractor, SpotifyExtractor } = require('@discord-player/extractor');

module.exports = (client) => {
    const player = client.player;
    let extractorLoadPromise = null;

    const ensureExtractors = async () => {
        if (!extractorLoadPromise) {
            const extractorOptions = {};

            if (process.env.SOUNDCLOUD_CLIENT_ID || process.env.SOUNDCLOUD_OAUTH_TOKEN) {
                extractorOptions[SoundCloudExtractor.identifier] = {
                    clientId: process.env.SOUNDCLOUD_CLIENT_ID || undefined,
                    oauthToken: process.env.SOUNDCLOUD_OAUTH_TOKEN || undefined
                };
            }

            if (process.env.SPOTIFY_CLIENT_ID && process.env.SPOTIFY_CLIENT_SECRET) {
                extractorOptions[SpotifyExtractor.identifier] = {
                    clientId: process.env.SPOTIFY_CLIENT_ID,
                    clientSecret: process.env.SPOTIFY_CLIENT_SECRET
                };
            }

            extractorLoadPromise = player.extractors.loadMulti(DefaultExtractors, extractorOptions)
                .then(() => {
                    console.log('🎶 Discord Player v7 extractors loaded successfully.');
                    console.log(player.scanDeps());
                })
                .catch((error) => {
                    extractorLoadPromise = null;
                    throw error;
                });
        }
        return extractorLoadPromise;
    };

    client.once('ready', () => {
        ensureExtractors().catch((error) => {
            console.error('❌ Failed to load music extractors:', error);
        });
    });

    player.events.on('error', (queue, error) => {
        console.error(`[Player Error][${queue?.guild?.name || 'unknown guild'}]`, error);
    });

    player.events.on('playerError', (queue, error) => {
        console.error(`[Audio Stream Error][${queue?.guild?.name || 'unknown guild'}]`, error);
    });

    player.events.on('debug', (queue, message) => {
        if (process.env.MUSIC_DEBUG === 'true') {
            console.log(`[Player Debug][${queue?.guild?.name || 'unknown guild'}] ${message}`);
        }
    });

    player.events.on('playerStart', (queue, track) => {
        const metadata = queue.metadata || {};
        const textChannel = metadata.channel;
        if (!textChannel?.send) return;

        const requesterId = track.requestedBy?.id || metadata.requestedBy?.id;
        const embed = new EmbedBuilder()
            .setColor('#FFD700')
            .setAuthor({ name: '🎵 Now Playing' })
            .setTitle(track.title || 'Unknown track')
            .setDescription([
                `**Duration:** \`${track.duration || 'Unknown'}\``,
                requesterId ? `**Requested by:** <@${requesterId}>` : null
            ].filter(Boolean).join(' | '))
            .setFooter({ text: 'Starry Music Player' })
            .setTimestamp();

        if (track.url) embed.setURL(track.url);
        if (track.thumbnail) embed.setThumbnail(track.thumbnail);

        textChannel.send({ embeds: [embed] }).catch(() => {});
    });

    const checkPermissions = (channel, botMember) => {
        const permissions = channel.permissionsFor(botMember);
        return permissions?.has(PermissionsBitField.Flags.Connect)
            && permissions.has(PermissionsBitField.Flags.Speak);
    };

    const isYouTubeUrl = (query) => /(?:youtube\.com|youtu\.be)/i.test(query);
    const isUrl = (query) => /^https?:\/\//i.test(query);

    const getPlayableQuery = (query) => {
        // Plain text searches are explicitly routed through SoundCloud.
        // Spotify and SoundCloud URLs are left untouched for their own extractors.
        return isUrl(query) ? query : `scsearch:${query}`;
    };

    client.on('interactionCreate', async (interaction) => {
        if (!interaction.isChatInputCommand()) return;

        const command = interaction.commandName;
        const musicCommands = new Set(['play', 'pause', 'resume', 'skip', 'stop', 'queue', 'volume']);
        if (!musicCommands.has(command)) return;

        if (!interaction.inGuild()) {
            return interaction.reply({ content: '❌ Music commands can only be used in a server.', ephemeral: true }).catch(() => {});
        }

        if (client.isPremium && !client.isPremium(interaction.guildId)) {
            return interaction.reply({
                content: '❌ **Music is a Premium feature!** Ask the owner to upgrade the server.',
                ephemeral: true
            }).catch(() => {});
        }

        const voiceChannel = interaction.member?.voice?.channel;
        if (!voiceChannel) {
            return interaction.reply({ content: '❌ You must be in a voice channel to use music commands.', ephemeral: true }).catch(() => {});
        }

        if (!checkPermissions(voiceChannel, interaction.guild.members.me)) {
            return interaction.reply({ content: '❌ I need **Connect** and **Speak** permissions in your voice channel.', ephemeral: true }).catch(() => {});
        }

        const queue = player.nodes.get(interaction.guildId);
        if (queue?.channel && queue.channel.id !== voiceChannel.id) {
            return interaction.reply({
                content: `❌ Join <#${queue.channel.id}> to control the active music queue.`,
                ephemeral: true
            }).catch(() => {});
        }

        try {
            if (command === 'play') {
                const query = interaction.options.getString('song', true).trim();

                if (isYouTubeUrl(query)) {
                    return interaction.reply({
                        content: '❌ YouTube playback is not supported by Discord Player v7. Use a song name, SoundCloud URL, or Spotify URL instead.',
                        ephemeral: true
                    });
                }

                await interaction.deferReply();
                await ensureExtractors();

                const playableQuery = getPlayableQuery(query);
                const result = await player.play(voiceChannel, playableQuery, {
                    requestedBy: interaction.user,
                    nodeOptions: {
                        metadata: {
                            channel: interaction.channel,
                            requestedBy: interaction.user
                        },
                        volume: 80,
                        bufferingTimeout: 15000,
                        leaveOnEmpty: true,
                        leaveOnEmptyCooldown: 300000,
                        leaveOnEnd: true,
                        leaveOnEndCooldown: 15000,
                        leaveOnStop: true,
                        leaveOnStopCooldown: 5000
                    }
                });

                const trackTitle = result?.track?.title;
                return interaction.editReply({
                    embeds: [new EmbedBuilder()
                        .setColor('#3BA55C')
                        .setDescription(trackTitle ? `✅ Added **${trackTitle}** to the queue.` : '✅ Added the track to the queue.')]
                });
            }

            if (!queue || !queue.currentTrack) {
                return interaction.reply({ content: '❌ Nothing is playing right now.', ephemeral: true });
            }

            if (command === 'pause') {
                if (queue.node.isPaused()) {
                    return interaction.reply({ content: '⚠️ The music is already paused.', ephemeral: true });
                }
                queue.node.setPaused(true);
                return interaction.reply({ content: '⏸️ **Paused the music.**' });
            }

            if (command === 'resume') {
                if (!queue.node.isPaused()) {
                    return interaction.reply({ content: '⚠️ The music is not paused.', ephemeral: true });
                }
                queue.node.setPaused(false);
                return interaction.reply({ content: '▶️ **Resumed the music.**' });
            }

            if (command === 'skip') {
                queue.node.skip();
                return interaction.reply({ content: '⏭️ **Skipped the current song.**' });
            }

            if (command === 'stop') {
                queue.delete();
                return interaction.reply({ content: '🛑 **Stopped the music and cleared the queue.**' });
            }

            if (command === 'volume') {
                const volume = interaction.options.getInteger('amount', true);
                queue.node.setVolume(volume);
                return interaction.reply({ content: `🔊 **Volume set to ${volume}%.**` });
            }

            if (command === 'queue') {
                const tracks = queue.tracks.toArray();
                let queueText = `**🎵 Now Playing:**\n[${queue.currentTrack.title}](${queue.currentTrack.url}) - \`${queue.currentTrack.duration}\`\n\n**Up Next:**\n`;

                if (tracks.length === 0) {
                    queueText += '*The queue is empty.*';
                } else {
                    queueText += tracks.slice(0, 10)
                        .map((track, index) => `**${index + 1}.** [${track.title}](${track.url}) - \`${track.duration}\``)
                        .join('\n');
                    if (tracks.length > 10) queueText += `\n*...and ${tracks.length - 10} more*`;
                }

                return interaction.reply({
                    embeds: [new EmbedBuilder()
                        .setColor('#5865F2')
                        .setTitle(`📜 Music Queue for ${interaction.guild.name}`)
                        .setDescription(queueText)]
                });
            }
        } catch (error) {
            console.error('Music Command Error:', error);
            const message = error?.message || 'Unknown music-player error';
            const content = `❌ I could not play that track. SoundCloud may block copyrighted tracks, or Spotify bridging may not have found a playable match.\n\`${message.slice(0, 300)}\``;

            if (interaction.deferred || interaction.replied) {
                await interaction.editReply({ content, embeds: [] }).catch(async () => {
                    await interaction.followUp({ content, ephemeral: true }).catch(() => {});
                });
            } else {
                await interaction.reply({ content, ephemeral: true }).catch(() => {});
            }
        }
    });
};
