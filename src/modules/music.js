// ==========================================
// 🎵 STARRY SUPREME MUSIC ENGINE MODULE
// ==========================================
const { EmbedBuilder, PermissionsBitField, MessageFlags } = require('discord.js');
const EPHEMERAL_FLAG = MessageFlags.Ephemeral || 6;

// Helper function to enforce a safety timeout on node connections (increased to 25s for Render)
const withTimeout = (promise, ms, errorMessage) => {
    let timeoutId;
    const timeoutPromise = new Promise((_, reject) => {
        timeoutId = setTimeout(() => reject(new Error(errorMessage)), ms);
    });
    return Promise.race([
        promise.then(res => { clearTimeout(timeoutId); return res; }),
        timeoutPromise
    ]);
};

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
            return interaction.reply({ content: '❌ You must be connected to a voice channel to play music!', flags: [EPHEMERAL_FLAG] }).catch(() => {});
        }

        if (!checkPermissions(voiceChannel, interaction.guild.members.me)) {
            return interaction.reply({ content: '❌ I need **Connect** and **Speak** permissions in your voice channel!', flags: [EPHEMERAL_FLAG] }).catch(() => {});
        }

        const manager = client.manager;
        if (!manager) {
            return interaction.reply({ content: '❌ Music Manager is not properly initialized on the bot server.', flags: [EPHEMERAL_FLAG] }).catch(() => {});
        }

        try {
            if (command === 'play') {
                const query = interaction.options.getString('song', true).trim();
                
                // Immediately defer reply to satisfy Discord's 3s requirement
                await interaction.deferReply({ flags: [EPHEMERAL_FLAG] }).catch(() => {});

                // Verify Lavalink nodes are online
                const activeNodes = manager.shoukaku.nodes;
                const hasConnectedNode = Array.from(activeNodes.values()).some(n => n.state === 1); // 1 = CONNECTED

                if (!hasConnectedNode) {
                    return interaction.editReply({ content: '⚠️ **Music Nodes Reconnecting:** Lavalink nodes are initializing. Please try again in 5 seconds!' });
                }

                // Search for the track with a generous 20s timeout
                const res = await withTimeout(
                    manager.search(query, { requester: interaction.user }),
                    20000,
                    'Song search timed out. Audio nodes are currently slow.'
                );

                if (!res || res.loadType === 'empty' || res.loadType === 'error') {
                    return interaction.editReply({ content: '❌ No songs found matching your query.' });
                }

                // Connect to Voice Channel with a 25s timeout for voice gateway handshake
                let player = manager.getPlayer(interaction.guild.id);
                if (!player) {
                    player = await withTimeout(
                        manager.createPlayer({
                            guildId: interaction.guild.id,
                            voiceChannelId: voiceChannel.id,
                            textChannelId: interaction.channel.id,
                            selfDeafen: true
                        }),
                        25000,
                        'Voice channel connection timed out. Please try again.'
                    );
                }

                if (res.loadType === 'playlist') {
                    for (const track of res.tracks) player.queue.add(track);
                    if (!player.playing && !player.paused) player.play();
                    return interaction.editReply({ content: `✅ Loaded playlist **${res.playlist.name}** (${res.tracks.length} tracks queued).` });
                } else {
                    const track = res.tracks[0];
                    player.queue.add(track);
                    if (!player.playing && !player.paused) player.play();
                    return interaction.editReply({ content: `🎵 Added to queue: **${track.title}**` });
                }
            }

            const player = manager.getPlayer(interaction.guild.id);
            if (!player) {
                return interaction.reply({ content: '❌ No active music session in this server.', flags: [EPHEMERAL_FLAG] });
            }

            if (command === 'pause') {
                if (player.paused) return interaction.reply({ content: '⚠️ Music is already paused.', flags: [EPHEMERAL_FLAG] });
                player.pause(true);
                return interaction.reply({ content: '⏸️ **Paused playback.**', flags: [EPHEMERAL_FLAG] });
            }

            if (command === 'resume') {
                if (!player.paused) return interaction.reply({ content: '⚠️ Music is not paused.', flags: [EPHEMERAL_FLAG] });
                player.pause(false);
                return interaction.reply({ content: '▶️ **Resumed playback.**', flags: [EPHEMERAL_FLAG] });
            }

            if (command === 'skip') {
                player.skip();
                return interaction.reply({ content: '⏭️ **Skipped current song.**', flags: [EPHEMERAL_FLAG] });
            }

            if (command === 'stop') {
                player.destroy();
                return interaction.reply({ content: '🛑 **Stopped playback and left the voice channel.**', flags: [EPHEMERAL_FLAG] });
            }

            if (command === 'volume') {
                const volume = interaction.options.getInteger('amount', true);
                player.setVolume(volume);
                return interaction.reply({ content: `🔊 **Volume set to ${volume}%.**`, flags: [EPHEMERAL_FLAG] });
            }

            if (command === 'queue') {
                if (!player.queue || player.queue.length === 0) {
                    return interaction.reply({ content: '📭 The queue is currently empty.', flags: [EPHEMERAL_FLAG] });
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
            const content = `❌ **Music Error:** \`${error.message || 'Unknown error'}\``;
            if (interaction.deferred) {
                await interaction.editReply({ content }).catch(() => {});
            } else {
                await interaction.reply({ content, flags: [EPHEMERAL_FLAG] }).catch(() => {});
            }
        }
    });
};
