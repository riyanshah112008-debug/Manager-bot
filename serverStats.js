const { ChannelType, PermissionsBitField } = require('discord.js');

module.exports = (client) => {
    client.on('clientReady', async () => {
        try {
            await client.application.commands.create({
                name: 'setupstats',
                description: 'Create live server stat tracking channels (Admin Only)',
                default_member_permissions: '8'
            });
            console.log('✅ Server Stats Slash Command Added');
        } catch (err) {}
    });

    const updateStats = async (guild) => {
        // Find the specific channels by their emoji markers
        const memberCountChannel = guild.channels.cache.find(c => c.name.startsWith('👥 Members:'));
        const botCountChannel = guild.channels.cache.find(c => c.name.startsWith('🤖 Bots:'));

        if (memberCountChannel) {
            const members = guild.members.cache.filter(m => !m.user.bot).size;
            memberCountChannel.setName(`👥 Members: ${members}`).catch(() => {});
        }
        if (botCountChannel) {
            const bots = guild.members.cache.filter(m => m.user.bot).size;
            botCountChannel.setName(`🤖 Bots: ${bots}`).catch(() => {});
        }
    };

    client.on('interactionCreate', async (interaction) => {
        if (!interaction.isChatInputCommand() || interaction.commandName !== 'setupstats') return;

        await interaction.reply({ content: '⏳ Setting up live stat channels...', ephemeral: true }).catch(() => {});

        try {
            let category = interaction.guild.channels.cache.find(c => c.name === '📊 SERVER STATS' && c.type === ChannelType.GuildCategory);
            if (!category) {
                category = await interaction.guild.channels.create({ name: '📊 SERVER STATS', type: ChannelType.GuildCategory });
            }

            const members = interaction.guild.members.cache.filter(m => !m.user.bot).size;
            const bots = interaction.guild.members.cache.filter(m => m.user.bot).size;

            await interaction.guild.channels.create({
                name: `👥 Members: ${members}`,
                type: ChannelType.GuildVoice,
                parent: category.id,
                // Deny connect permissions so users can't actually join the stat channels
                permissionOverwrites: [{ id: interaction.guild.id, deny: [PermissionsBitField.Flags.Connect] }]
            });

            await interaction.guild.channels.create({
                name: `🤖 Bots: ${bots}`,
                type: ChannelType.GuildVoice,
                parent: category.id,
                permissionOverwrites: [{ id: interaction.guild.id, deny: [PermissionsBitField.Flags.Connect] }]
            });

            await interaction.editReply({ content: '✅ Server stat channels successfully created!' }).catch(() => {});
        } catch (error) {
            await interaction.editReply({ content: '❌ Failed to create channels. Ensure Starry has Administrator permissions.' }).catch(() => {});
        }
    });

    // Auto-update the numbers whenever someone joins or leaves
    client.on('guildMemberAdd', member => updateStats(member.guild));
    client.on('guildMemberRemove', member => updateStats(member.guild));
};
