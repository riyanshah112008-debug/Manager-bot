// 🔧 Sets the exact path to the audio engine
process.env.FFMPEG_PATH = require('ffmpeg-static');

const { EmbedBuilder, PermissionsBitField } = require('discord.js');
const { SoundCloudExtractor, SpotifyExtractor } = require('@discord-player/extractor');

module.exports = (client) => {
    const player = client.player;

    client.once('ready', async () => {
        try {
            await player.extractors.register(SoundCloudExtractor, {});
            if (process.env.SPOTIFY_CLIENT_ID) {
                await player.extractors.register(SpotifyExtractor, {
                    clientId: process.env.SPOTIFY_CLIENT_ID,
                    clientSecret: process.env.SPOTIFY_CLIENT_SECRET
                });
            }
            console.log('🎶 Audio Extractors loaded (YouTube bypassed).');
        } catch (error) {
            console.error('❌ Extractor Error:', error);
        }
    });

    player.events.on('error', (queue, error) => console.error(`[Player Error]`, error));
    player.events.on('playerError', (queue, error) => console.error(`[Audio Stream Error]`, error));

    player.events.on('playerStart', (queue, track) => {
        const textChannel = queue.metadata?.channel;
        if (!textChannel) return;

        const embed = new EmbedBuilder()
            .setColor('#FFD700')
            .setAuthor({ name: '🎵 Now Playing' })
            .setTitle(track.title || 'Unknown track')
            .setURL(track.url || null)
            .setDescription(`**Duration:** \`${track.duration}\``)
            .setThumbnail(track.thumbnail || null)
            .setFooter({ text: 'Starry Music Player' })
            .setTimestamp();

        textChannel.send({ embeds: [embed] }).catch(() => {});
    });

    const checkPermissions = (channel, botMember) => {
        const permissions = channel.permissionsFor(botMember);
        return permissions?.has(PermissionsBitField.Flags.Connect) && permissions.has(PermissionsBitField.Flags.Speak);
    };

    const isYouTubeUrl = (query) => /(?:youtube\.com|youtu\.be)/i.test(query);
    const isUrl = (query) => /^https?:\/\//i.test(query);
    const getPlayableQuery = (query) => isUrl(query) ? query : `scsearch:${query}`;
    client.on('interactionCreate', async (interaction) => {
        if (!interaction.isChatInputCommand()) return;
        const command = interaction.commandName;
        if (!['play', 'pause', 'resume', 'skip', 'stop', 'queue', 'volume'].includes(command)) return;

        if (!interaction.inGuild()) return interaction.reply({ content: '❌ Music commands are server-only.', ephemeral: true });
        if (client.isPremium && !client.isPremium(interaction.guildId)) return interaction.reply({ content: '❌ **Music is a Premium feature!** Ask the owner to upgrade the server.', ephemeral: true });

        const voiceChannel = interaction.member?.voice?.channel;
        if (!voiceChannel) return interaction.reply({ content: '❌ You must be in a voice channel!', ephemeral: true });
        if (!checkPermissions(voiceChannel, interaction.guild.members.me)) return interaction.reply({ content: '❌ I need Connect and Speak permissions.', ephemeral: true });

        const queue = player.nodes.get(interaction.guildId);
        if (queue?.channel && queue.channel.id !== voiceChannel.id) return interaction.reply({ content: `❌ Join <#${queue.channel.id}> to use music commands.`, ephemeral: true });

        try {
            if (command === 'play') {
                const query = interaction.options.getString('song', true).trim();
                if (isYouTubeUrl(query)) return interaction.reply({ content: '❌ YouTube is blocked. Use song names, Spotify, or SoundCloud links.', ephemeral: true });

                await interaction.deferReply();
                const result = await player.play(voiceChannel, getPlayableQuery(query), {
                    requestedBy: interaction.user,
                    nodeOptions: {
                        metadata: { channel: interaction.channel },
                        // 🔧 CRITICAL FIX: Explicitly set to 100 to disable FFmpeg volume filters and protect the weak CPU
                        volume: 100,
                        leaveOnEmpty: true,
                        leaveOnEnd: true,
                        leaveOnStop: true
                    }
                });

                const trackTitle = result?.track?.title || 'the track';
                return interaction.editReply({ embeds: [new EmbedBuilder().setColor('#3BA55C').setDescription(`✅ Added **${trackTitle}** to the queue.`)] });
            }

            if (!queue || !queue.currentTrack) return interaction.reply({ content: '❌ Nothing is playing.', ephemeral: true });

            if (command === 'volume') {
                // 🔧 Disabled to protect the CPU
                return interaction.reply({ content: '❌ **Volume control is disabled** to prevent server crashes. Please adjust the bot\'s volume by right-clicking its profile!', ephemeral: true });
            }

            if (command === 'pause') { queue.node.setPaused(true); return interaction.reply('⏸️ **Paused.**'); }
            if (command === 'resume') { queue.node.setPaused(false); return interaction.reply('▶️ **Resumed.**'); }
            if (command === 'skip') { queue.node.skip(); return interaction.reply('⏭️ **Skipped.**'); }
            if (command === 'stop') { queue.delete(); return interaction.reply('🛑 **Stopped.**'); }
            
            if (command === 'queue') {
                const tracks = queue.tracks.toArray();
                let q = `**🎵 Now Playing:**\n[${queue.currentTrack.title}](${queue.currentTrack.url})\n\n**Up Next:**\n`;
                q += tracks.length === 0 ? '*Empty*' : tracks.slice(0, 10).map((t, i) => `**${i + 1}.** [${t.title}](${t.url})`).join('\n');
                return interaction.reply({ embeds: [new EmbedBuilder().setColor('#5865F2').setTitle('📜 Queue').setDescription(q)] });
            }
        } catch (error) {
            console.error('Command Error:', error);
            const msg = { content: '❌ Failed to play audio. The stream may be restricted or timed out.', ephemeral: true };
            if (interaction.deferred) await interaction.editReply(msg).catch(()=>{});
            else await interaction.reply(msg).catch(()=>{});
        }
    });
};
