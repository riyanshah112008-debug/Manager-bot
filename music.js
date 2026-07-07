const { EmbedBuilder, PermissionsBitField } = require('discord.js');
const { Player } = require('discord-player');
const { YoutubeiExtractor } = require('discord-player-youtubei'); 

module.exports = (client) => {
    const player = new Player(client);
    
    client.once('ready', async () => {
        try {
            await player.extractors.register(YoutubeiExtractor, {});
            await player.extractors.loadDefault((ext) => ext !== 'YouTubeExtractor');
            console.log('🎶 Audio extractors loaded successfully!');
        } catch (err) {
            console.error('❌ Failed to load music extractors:', err);
        }
    });

    // ==========================================
    // 🎵 AUTOMATIC "NOW PLAYING" EMBED
    // ==========================================
    player.events.on('playerStart', (queue, track) => {
        const embed = new EmbedBuilder()
            .setColor('#FFD700')
            .setAuthor({ name: '🎵 Now Playing' })
            .setTitle(track.title)
            .setURL(track.url)
            .setDescription(`**Duration:** \`${track.duration}\` | **Requested by:** <@${track.requestedBy?.id || queue.metadata.user.id}>`)
            .setThumbnail(track.thumbnail)
            .setFooter({ text: 'Starry Music Player' })
            .setTimestamp();
        
        queue.metadata.channel.send({ embeds: [embed] }).catch(() => {});
    });

    const checkPermissions = (channel, botMember) => {
        const permissions = channel.permissionsFor(botMember);
        return permissions.has(PermissionsBitField.Flags.Connect) && permissions.has(PermissionsBitField.Flags.Speak);
    };

    // ==========================================
    // 🎛️ MUSIC SLASH COMMANDS
    // ==========================================
    client.on('interactionCreate', async (interaction) => {
        if (!interaction.isChatInputCommand()) return;

        const command = interaction.commandName;
        const musicCommands = ['play', 'pause', 'resume', 'skip', 'stop', 'queue'];
        
        if (!musicCommands.includes(command)) return;

        // 🔒 PREMIUM LOCK
        if (!client.isPremium(interaction.guild.id)) {
            return interaction.reply({ content: '❌ **Music is a Premium feature!** Ask the owner to upgrade the server.', ephemeral: true }).catch(() => {});
        }

        const channel = interaction.member.voice.channel;
        if (!channel) return interaction.reply({ content: '❌ You must be in a voice channel to use music commands!', ephemeral: true }).catch(() => {});
        if (!checkPermissions(channel, interaction.guild.members.me)) return interaction.reply({ content: '❌ I am missing Connect or Speak permissions!', ephemeral: true }).catch(() => {});

        const queue = player.nodes.get(interaction.guild.id);

        try {
            // --- /PLAY ---
            if (command === 'play') {
                const query = interaction.options.getString('song');
                await interaction.reply({ embeds: [new EmbedBuilder().setColor('#2b2d31').setDescription(`🔍 Searching for **${query}**...`)] }).catch(() => {});

                try {
                    await player.play(channel, query, {
                        nodeOptions: { 
                            metadata: interaction, // Passes interaction so playerStart knows where to send the embed
                            leaveOnEmpty: true 
                        }
                    });
                    return interaction.editReply({ embeds: [new EmbedBuilder().setColor('#3BA55C').setDescription(`✅ Added to queue!`)] }).catch(() => {});
                } catch (error) {
                    return interaction.editReply({ content: '❌ Failed to play song. YouTube might have blocked this specific track.', embeds: [] }).catch(() => {});
                }
            }

            // --- /PAUSE ---
            if (command === 'pause') {
                if (!queue || !queue.isPlaying()) return interaction.reply({ content: '❌ Nothing is playing right now.', ephemeral: true });
                queue.node.setPaused(true);
                return interaction.reply({ content: '⏸️ **Paused the music.**' });
            }

            // --- /RESUME ---
            if (command === 'resume') {
                if (!queue || !queue.isPlaying()) return interaction.reply({ content: '❌ Nothing is playing right now.', ephemeral: true });
                queue.node.setPaused(false);
                return interaction.reply({ content: '▶️ **Resumed the music.**' });
            }

            // --- /SKIP ---
            if (command === 'skip') {
                if (!queue || !queue.isPlaying()) return interaction.reply({ content: '❌ Nothing is playing right now.', ephemeral: true });
                queue.node.skip();
                return interaction.reply({ content: '⏭️ **Skipped to the next song.**' });
            }

            // --- /STOP ---
            if (command === 'stop') {
                if (!queue || !queue.isPlaying()) return interaction.reply({ content: '❌ Nothing is playing right now.', ephemeral: true });
                queue.delete();
                return interaction.reply({ content: '🛑 **Stopped the music and cleared the queue.**' });
            }

            // --- /QUEUE ---
            if (command === 'queue') {
                if (!queue || !queue.isPlaying()) return interaction.reply({ content: '❌ Nothing is playing right now.', ephemeral: true });
                const currentTrack = queue.currentTrack;
                const tracks = queue.tracks.toArray(); 

                let queueString = `**🎵 Now Playing:**\n[${currentTrack.title}](${currentTrack.url}) - \`${currentTrack.duration}\`\n\n**Up Next:**\n`;
                
                if (tracks.length === 0) {
                    queueString += '*The queue is empty.*';
                } else {
                    queueString += tracks.slice(0, 10).map((t, i) => `**${i + 1}.** [${t.title}](${t.url}) - \`${t.duration}\``).join('\n');
                    if (tracks.length > 10) queueString += `\n*...and ${tracks.length - 10} more*`;
                }

                const embed = new EmbedBuilder()
                    .setColor('#5865F2')
                    .setTitle(`📜 Music Queue for ${interaction.guild.name}`)
                    .setDescription(queueString);

                return interaction.reply({ embeds: [embed] });
            }
        } catch (error) {
            console.error('Music Command Error:', error);
            if (interaction.replied || interaction.deferred) {
                await interaction.followUp({ content: '❌ An error occurred with the music player.', ephemeral: true }).catch(()=>{});
            } else {
                await interaction.reply({ content: '❌ An error occurred with the music player.', ephemeral: true }).catch(()=>{});
            }
        }
    });
};
            
