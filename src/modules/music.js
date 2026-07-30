// ==========================================
// 🎵 STARRY SUPREME MUSIC ENGINE MODULE
// ==========================================
const { EmbedBuilder, PermissionsBitField, MessageFlags } = require('discord.js');
const EPHEMERAL_FLAG = MessageFlags.Ephemeral || 6;

module.exports = (client) => {
    const checkPermissions = (channel, botMember) => {
        const permissions = channel.permissionsFor(botMember);
        return permissions?.has(PermissionsBitField.Flags.Connect) && permissions?.has(PermissionsBitField.Flags.Speak);
    };

    client.on('interactionCreate', async (interaction) => {
        if (!interaction.isChatInputCommand() || !interaction.inGuild()) return;

        const command = interaction.commandName;
        const musicCommands = new Set(['play', 'pause', 'resume', 'skip', 'stop', 'queue', 'volume']);
        if (!musicCommands.has(command)) return;

        const voiceChannel = interaction.member?.voice?.channel;
        if (!voiceChannel) {
            return interaction.reply({ content: '❌ You must be in a voice channel to use music commands.', flags: [EPHEMERAL_FLAG] }).catch(() => {});
        }

        if (!checkPermissions(voiceChannel, interaction.guild.members.me)) {
            return interaction.reply({ content: '❌ I need **Connect** and **Speak** permissions in your voice channel.', flags: [EPHEMERAL_FLAG] }).catch(() => {});
        }

        const player = client.manager ? client.manager.getPlayer(interaction.guild.id) : null;

        try {
            if (command === 'play') {
                const query = interaction.options.getString('song', true).trim();
                
                // ⚡ CRITICAL FIX: Immediately defer reply so Discord never triggers "The application did not respond"
                await interaction.deferReply({ flags: [EPHEMERAL_FLAG] }).catch(() => {});

                let activePlayer = player;
                if (!activePlayer) {
                    activePlayer = await client.manager.createPlayer({
                        guildId: interaction.guild.id,
                        voiceChannelId: voiceChannel.id,
                        textChannelId: interaction.channel.id,
                        selfDeafen: true
                    });
                }

                const res = await client.manager.search(query, { requester: interaction.user });
                if (!res || res.loadType === 'empty' || res.loadType === 'error') {
                    return interaction.editReply({ content: '❌ No songs found or search failed.' });
                }

                if (res.loadType === 'playlist') {
                    for (const track of res.tracks) activePlayer.queue.add(track);
                    if (!activePlayer.playing && !activePlayer.paused) activePlayer.play();
                    return interaction.editReply({ content: `✅ Loaded playlist **${res.playlist.name}** (${res.tracks.length} songs).` });
                } else {
                    const track = res.tracks[0];
                    activePlayer.queue.add(track);
                    if (!activePlayer.playing && !activePlayer.paused) activePlayer.play();
                    return interaction.editReply({ content: `🎵 Added to queue: **${track.title}**` });
                }
            }

            if (!player) {
                return interaction.reply({ content: '❌ Nothing is playing right now.', flags: [EPHEMERAL_FLAG] });
            }

            if (command === 'pause') {
                if (player.paused) return interaction.reply({ content: '⚠️ Music is already paused.', flags: [EPHEMERAL_FLAG] });
                player.pause(true);
                return interaction.reply({ content: '⏸️ **Paused the music.**', flags: [EPHEMERAL_FLAG] });
            }

            if (command === 'resume') {
                if (!player.paused) return interaction.reply({ content: '⚠️ Music is not paused.', flags: [EPHEMERAL_FLAG] });
                player.pause(false);
                return interaction.reply({ content: '▶️ **Resumed the music.**', flags: [EPHEMERAL_FLAG] });
            }

            if (command === 'skip') {
                player.skip();
                return interaction.reply({ content: '⏭️ **Skipped the current song.**', flags: [EPHEMERAL_FLAG] });
            }

            if (command === 'stop') {
                player.destroy();
                return interaction.reply({ content: '🛑 **Stopped the music and cleared the queue.**', flags: [EPHEMERAL_FLAG] });
            }

            if (command === 'volume') {
                const volume = interaction.options.getInteger('amount', true);
                player.setVolume(volume);
                return interaction.reply({ content: `🔊 **Volume set to ${volume}%.**`, flags: [EPHEMERAL_FLAG] });
            }

            if (command === 'queue') {
                if (!player.queue || player.queue.length === 0) {
                    return interaction.reply({ content: '📭 The queue is empty.', flags: [EPHEMERAL_FLAG] });
                }
                const queueList = player.queue.slice(0, 10).map((t, i) => `**${i + 1}.** ${t.title}`).join('\n');
                const embed = new EmbedBuilder()
                    .setColor('#5865F2')
                    .setTitle('🎶 Current Music Queue')
                    .setDescription(queueList)
                    .setFooter({ text: `Total songs: ${player.queue.length}` });
                return interaction.reply({ embeds: [embed], flags: [EPHEMERAL_FLAG] });
            }

        } catch (error) {
            const content = `❌ Music error: \`${error.message?.slice(0, 200) || 'Unknown error'}\``;
            if (interaction.deferred) {
                await interaction.editReply({ content }).catch(() => {});
            } else {
                await interaction.reply({ content, flags: [EPHEMERAL_FLAG] }).catch(() => {});
            }
        }
    });
};
