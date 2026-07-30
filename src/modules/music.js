// ==========================================
// 🎵 STARRY SUPREME MUSIC ENGINE MODULE
// ==========================================
process.env.FFMPEG_PATH = require('ffmpeg-static');

const { EmbedBuilder, PermissionsBitField } = require('discord.js');
const { DefaultExtractors } = require('@discord-player/extractor');

module.exports = (client) => {
    const player = client.player;
    let extractorLoadPromise = null;

    const ensureExtractors = async () => {
        if (!extractorLoadPromise && player) {
            extractorLoadPromise = (async () => {
                try {
                    await player.extractors.loadMulti(DefaultExtractors);
                    console.log('✅ All Cloud-Friendly Audio Extractors loaded successfully.');
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

    client.once('clientReady', () => {
        ensureExtractors().catch((error) => {
            console.error('❌ Failed to load music extractors on startup:', error);
        });
    });

    if (player) {
        player.events.on('error', (queue, error) => {
            console.error('🔴 [Player Error]:', error.message || error);
        });

        player.events.on('playerError', (queue, error) => {
            console.error('🔴 [Audio Stream Error]:', error.message || error);
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
    }

    const checkPermissions = (channel, botMember) => {
        const permissions = channel.permissionsFor(botMember);
        return permissions?.has(PermissionsBitField.Flags.Connect) && permissions?.has(PermissionsBitField.Flags.Speak);
    };

    const isYouTubeUrl = (query) => /(?:youtube\.com|youtu\.be)/i.test(query);
    const isUrl = (query) => /^https?:\/\//i.test(query);

    client.on('interactionCreate', async (interaction) => {
        if (!interaction.isChatInputCommand() || !interaction.inGuild()) return;

        const command = interaction.commandName;
        const musicCommands = new Set(['play', 'pause', 'resume', 'skip', 'stop', 'queue', 'volume']);
        if (!musicCommands.has(command)) return;

        const voiceChannel = interaction.member?.voice?.channel;
        if (!voiceChannel) {
            return interaction.reply({ content: '❌ You must be in a voice channel to use music commands.', ephemeral: true }).catch(() => {});
        }

        if (!checkPermissions(voiceChannel, interaction.guild.members.me)) {
            return interaction.reply({ content: '❌ I need **Connect** and **Speak** permissions in your voice channel.', ephemeral: true }).catch(() => {});
        }

        const queue = player ? player.nodes.get(interaction.guildId) : null;
        if (queue?.channel && queue.channel.id !== voiceChannel.id) {
            return interaction.reply({ content: `❌ Join <#${queue.channel.id}> to control the active music queue.`, ephemeral: true }).catch(() => {});
        }

        try {
            if (command === 'play') {
                const query = interaction.options.getString('song', true).trim();
                if (isYouTubeUrl(query)) {
                    return interaction.reply({ content: '❌ YouTube playback is not supported. Use a song name, SoundCloud URL, or Spotify URL instead.', ephemeral: true });
                }

                await interaction.deferReply();
                await ensureExtractors();

                const result = await player.play(voiceChannel, query, {
                    requestedBy: interaction.user,
                    searchEngine: isUrl(query) ? 'auto' : 'soundcloudSearch', 
                    nodeOptions: {
                        metadata: { channel: interaction.channel, requestedBy: interaction.user, guildId: interaction.guildId },
                        volume: 80,
                        selfDeaf: true,
                        bufferingTimeout: 15000,
                        leaveOnEmpty: true,
                        leaveOnEmptyCooldown: 300000,
                        leaveOnEnd: true,
                        leaveOnEndCooldown: 15000,
                        leaveOnStop: true,
                        leaveOnStopCooldown: 5000
                    }
                });

                const track = result.track;
                if (!track) return interaction.editReply({ content: '❌ Could not find or stream any track matching your search.' });

                return interaction.editReply({
                    embeds: [new EmbedBuilder().setColor('#3BA55C').setDescription(`✅ Added **${track.title}** to the queue.`)]
                });
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
            const message = error?.message || 'Unknown music-player error';
            const content = `❌ I could not process that command. \`${message.slice(0, 300)}\``;
            if (interaction.deferred || interaction.replied) {
                await interaction.editReply({ content, embeds: [] }).catch(() => {});
            } else {
                await interaction.reply({ content, ephemeral: true }).catch(() => {});
            }
        }
    });
};
            
