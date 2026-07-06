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

    const checkPermissions = (channel, botMember) => {
        const permissions = channel.permissionsFor(botMember);
        return permissions.has(PermissionsBitField.Flags.Connect) && permissions.has(PermissionsBitField.Flags.Speak);
    };

    const buildPlayingEmbed = (track, user) => {
        return new EmbedBuilder()
            .setColor('#2b2d31')
            .setAuthor({ name: '🎵 Now Playing' })
            .setTitle(track.title)
            .setURL(track.url)
            .setDescription(`**Duration:** \`${track.duration}\` | **Requested by:** <@${user.id}>`)
            .setThumbnail(track.thumbnail)
            .setTimestamp();
    };

    client.on('messageCreate', async (message) => {
        if (message.author.bot || !message.guild) return;

        if (message.content.toLowerCase().startsWith('.play')) {
            // 🔒 PREMIUM LOCK
            if (!client.isPremium(message.guild.id)) {
                return message.reply('❌ **Music is a Premium feature!** Use `.premium` to learn how to upgrade your server.').catch(() => {});
            }

            const query = message.content.slice(5).trim();
            const channel = message.member.voice.channel;

            if (!channel) return message.reply('❌ You need to join a voice channel first!').catch(() => {});
            if (!query) return message.reply('🔹 **Usage:** `.play <song name or link>`').catch(() => {});
            
            if (!checkPermissions(channel, message.guild.members.me)) {
                return message.reply('❌ I do not have permission to `Connect` and `Speak`!').catch(() => {});
            }

            const waitEmbed = new EmbedBuilder().setColor('#2b2d31').setDescription(`🔍 Searching for **${query}**...`);
            const waitMessage = await message.reply({ embeds: [waitEmbed] }).catch(() => null);
            if (!waitMessage) return;

            try {
                const { track } = await player.play(channel, query, {
                    nodeOptions: { metadata: message, leaveOnEmpty: true }
                });
                return waitMessage.edit({ content: null, embeds: [buildPlayingEmbed(track, message.author)] }).catch(() => {});
            } catch (error) {
                return waitMessage.edit({ content: '❌ Failed to play the song. It might be age-restricted or unavailable.', embeds: [] }).catch(() => {});
            }
        }
    });

    client.on('interactionCreate', async (interaction) => {
        if (!interaction.isChatInputCommand() || interaction.commandName !== 'play') return;

        // 🔒 PREMIUM LOCK
        if (!client.isPremium(interaction.guild.id)) {
            return interaction.reply({ content: '❌ **Music is a Premium feature!** Use `.premium` to learn how to upgrade your server.', ephemeral: true }).catch(() => {});
        }

        const query = interaction.options.getString('song');
        const channel = interaction.member.voice.channel;

        if (!channel) return interaction.reply({ content: '❌ Join a voice channel first!', ephemeral: true }).catch(() => {});
        if (!checkPermissions(channel, interaction.guild.members.me)) return interaction.reply({ content: '❌ Missing permissions!', ephemeral: true }).catch(() => {});

        await interaction.reply({ embeds: [new EmbedBuilder().setDescription(`🔍 Searching for **${query}**...`)] }).catch(() => {});

        try {
            const { track } = await player.play(channel, query, {
                nodeOptions: { metadata: interaction, leaveOnEmpty: true }
            });
            return interaction.editReply({ embeds: [buildPlayingEmbed(track, interaction.user)] }).catch(() => {});
        } catch (error) {
            return interaction.editReply({ content: '❌ Failed to play song.', embeds: [] }).catch(() => {});
        }
    });
};
                    
