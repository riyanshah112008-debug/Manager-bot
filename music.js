process.env.FFMPEG_PATH = require('ffmpeg-static');

const { EmbedBuilder, PermissionsBitField } = require('discord.js');
const { SoundCloudExtractor, SpotifyExtractor } = require('@discord-player/extractor');

module.exports = (client) => {
    const player = client.player;
    let extractorLoadPromise = null;

    const ensureExtractors = async () => {
        if (!extractorLoadPromise) {
            extractorLoadPromise = (async () => {
                try {
                    // 1. Register SoundCloud (with fallback if credentials missing)
                    await player.extractors.register(SoundCloudExtractor, {
                        clientId: process.env.SOUNDCLOUD_CLIENT_ID || undefined,
                        oauthToken: process.env.SOUNDCLOUD_OAUTH_TOKEN || undefined
                    });
                    console.log('🎶 SoundCloud Extractor loaded');

                    // 2. Register Spotify (only if credentials available)
                    if (process.env.SPOTIFY_CLIENT_ID && process.env.SPOTIFY_CLIENT_SECRET) {
                        await player.extractors.register(SpotifyExtractor, {
                            clientId: process.env.SPOTIFY_CLIENT_ID,
                            clientSecret: process.env.SPOTIFY_CLIENT_SECRET
                        });
                        console.log('🎶 Spotify Extractor loaded');
                    } else {
                        console.warn('⚠️ Spotify credentials missing - Spotify URLs will not work');
                    }
                    console.log('✅ Audio Extractors ready (YouTube fully bypassed).');
                } catch (error) {
                    console.error('❌ Extractor registration error:', error);
                    throw error;
                }
            })().catch((error) => {
                extractorLoadPromise = null;
                throw error;
            });
        }
        return extractorLoadPromise;
    };

    client.once('ready', () => {
        ensureExtractors().catch((error) => {
            console.error('❌ Failed to load music extractors on startup:', error);
        });
    });

    // Log all player events for debugging
    player.events.on('error', (queue, error) => {
        console.error('🔴 [Player Error]', error.message || error);
    });
    
    player.events.on('playerError', (queue, error) => {
        console.error('🔴 [Audio Stream Error]', error.message || error);
    });
    
    player.events.on('playerStart', (queue, track) => {
        console.log('🎵 [playerStart Event] Track:', track.title);
        const metadata = queue.metadata || {};
        const textChannel = metadata.channel;
        if (!textChannel?.send) {
            console.warn('⚠️ No text channel found in metadata');
            return;
        }

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

    player.events.on('queueCreate', (queue) => {
        console.log('📊 [queueCreate Event] New queue created for:', queue.guild.name);
    });

    const checkPermissions = (channel, botMember) => {
        const permissions = channel.permissionsFor(botMember);
        const hasConnect = permissions?.has(PermissionsBitField.Flags.Connect);
        const hasSpeak = permissions?.has(PermissionsBitField.Flags.Speak);
        console.log(`✓ Channel Permissions - Connect: ${hasConnect}, Speak: ${hasSpeak}`);
        return hasConnect && hasSpeak;
    };

    const isYouTubeUrl = (query) => /(?:youtube\.com|youtu\.be)/i.test(query);
    const isUrl = (query) => /^https?:\/\//i.test(query);
    const getPlayableQuery = (query) => isUrl(query) ? query : `scsearch:${query}`;

    client.on('interactionCreate', async (interaction) => {
        if (!interaction.isChatInputCommand()) return;

        const command = interaction.commandName;
        const musicCommands = new Set(['play', 'pause', 'resume', 'skip', 'stop', 'queue', 'volume']);
        if (!musicCommands.has(command)) return;

        if (!interaction.inGuild()) {
            return interaction.reply({ content: '❌ Music commands can only be used in a server.', ephemeral: true }).catch(() => {});
        }

        if (client.isPremium && !client.isPremium(interaction.guildId)) {
            return interaction.reply({ content: '❌ **Music is a Premium feature!** Ask the owner to upgrade the server.', ephemeral: true }).catch(() => {});
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
            return interaction.reply({ content: `❌ Join <#${queue.channel.id}> to control the active music queue.`, ephemeral: true }).catch(() => {});
        }

        try {
            if (command === 'play') {
                const query = interaction.options.getString('song', true).trim();
                console.log(`🎵 [PLAY] User query: "${query}"`);

                if (isYouTubeUrl(query)) {
                    return interaction.reply({ content: '❌ YouTube playback is not supported. Use a song name, SoundCloud URL, or Spotify URL instead.', ephemeral: true });
                }

                await interaction.deferReply();

                try {
                    await ensureExtractors();
                } catch (error) {
                    console.error('❌ Extractor loading failed:', error);
                    return interaction.editReply({ content: '❌ Music system failed to initialize. Please try again later.' });
                }

                // Check if server-muted
                const botVoiceState = interaction.guild.members.me?.voice;
                if (botVoiceState?.serverMute) {
                    return interaction.editReply({ content: '❌ The bot is server-muted. Ask a server administrator to unmute the bot in the voice channel.' });
                }

                const playableQuery = getPlayableQuery(query);
                console.log(`🔍 [PLAY] Playable query: "${playableQuery}"`);

                try {
                    // 🔧 FIX: Use player.search() FIRST to validate the track exists
                    console.log('🔍 Searching for track...');
                    const searchResult = await player.search(playableQuery, {
                        requestedBy: interaction.user
                    });

                    if (!searchResult || searchResult.tracks.length === 0) {
                        console.log('❌ No tracks found in search');
                        return interaction.editReply({ content: '❌ No tracks found. Try a different search term.' });
                    }

                    console.log(`✅ Found ${searchResult.tracks.length} track(s). Playing first: ${searchResult.tracks[0].title}`);

                    // 🔧 FIX: Now play the track
                    const result = await player.play(voiceChannel, searchResult.tracks[0], {
                        requestedBy: interaction.user,
                        nodeOptions: {
                            metadata: { 
                                channel: interaction.channel, 
                                requestedBy: interaction.user,
                                guildId: interaction.guildId
                            },
                            volume: 80,
                            selfDeaf: false,
                            bufferingTimeout: 15000,
                            leaveOnEmpty: true,
                            leaveOnEmptyCooldown: 300000,
                            leaveOnEnd: true,
                            leaveOnEndCooldown: 15000,
                            leaveOnStop: true,
                            leaveOnStopCooldown: 5000
                        }
                    });

                    console.log('✅ Track queued:', result?.track?.title);

                    const trackTitle = result?.track?.title || 'Unknown track';
                    return interaction.editReply({
                        embeds: [new EmbedBuilder()
                            .setColor('#3BA55C')
                            .setDescription(`✅ Added **${trackTitle}** to the queue.`)]
                    });

                } catch (playError) {
                    console.error('🔴 Play error:', playError.message);
                    return interaction.editReply({ content: `❌ Failed to play track: \`${playError.message.slice(0, 200)}\`` });
                }
            }

            if (!queue || !queue.currentTrack) {
                return interaction.reply({ content: '❌ Nothing is playing right now.', ephemeral: true });
            }

            if (command === 'pause') {
                if (queue.node.isPaused()) return interaction.reply({ content: '⚠️ The music is already paused.', ephemeral: true });
                queue.node.setPaused(true);
                return interaction.reply({ content: '⏸️ **Paused the music.**' });
            }

            if (command === 'resume') {
                if (!queue.node.isPaused()) return interaction.reply({ content: '⚠️ The music is not paused.', ephemeral: true });
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
                    queueText += tracks.slice(0, 10).map((track, index) => `**${index + 1}.** [${track.title}](${track.url}) - \`${track.duration}\``).join('\n');
                    if (tracks.length > 10) queueText += `\n*...and ${tracks.length - 10} more*`;
                }

                return interaction.reply({ embeds: [new EmbedBuilder().setColor('#5865F2').setTitle(`📜 Music Queue for ${interaction.guild.name}`).setDescription(queueText)] });
            }
        } catch (error) {
            console.error('🔴 Music Command Error:', error);
            const message = error?.message || 'Unknown music-player error';
            const content = `❌ I could not process that command. \`${message.slice(0, 300)}\``;

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
