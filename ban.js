const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('ban')
        .setDescription('Ban a user from the server (Respects Protection System)')
        .addUserOption(option => 
            option.setName('target')
                .setDescription('The user to ban')
                .setRequired(true))
        .addStringOption(option => 
            option.setName('reason')
                .setDescription('Reason for the ban')),

    async execute(interaction, client) {
        const targetUser = interaction.options.getUser('target');
        const reason = interaction.options.getString('reason') || 'No reason provided';
        const guildId = interaction.guildId;

        // 1. Check the protection database
        const isProtected = client.isUserProtected(guildId, targetUser.id);

        if (isProtected) {
            // --- ALERT SYSTEM START ---
            
            // Option A: Send an alert to a specific private logging channel
            // Replace '123456789012345678' with your actual private channel ID
            const logChannelId = '123456789012345678'; 
            const logChannel = interaction.guild.channels.cache.get(logChannelId);
            
            if (logChannel) {
                logChannel.send(`🚨 **PROTECTION ALERT** 🚨\nModerator <@${interaction.user.id}> attempted to ban protected user <@${targetUser.id}>.\n**Reason provided:** ${reason}`);
            }

            // Option B: Send a Direct Message (DM) to the Server Owner
            try {
                const owner = await interaction.guild.fetchOwner();
                if (owner) {
                    await owner.send(`🚨 **Alert from ${interaction.guild.name}** 🚨\nModerator <@${interaction.user.id}> just tried to ban protected user <@${targetUser.id}> using the bot command.\n**Reason provided:** ${reason}`);
                }
            } catch (error) {
                console.error("Failed to DM the server owner:", error);
            }
            
            // --- ALERT SYSTEM END ---

            // Reject the command for the moderator
            return interaction.reply({ 
                content: `❌ **Action Denied:** You cannot ban **${targetUser.tag}** because they are protected by the server owner. This attempt has been logged.`, 
                ephemeral: true 
            });
        }

        // 2. If not protected, proceed with the ban
        try {
            const targetMember = await interaction.guild.members.fetch(targetUser.id);
            
            if (!targetMember.bannable) {
                return interaction.reply({ content: `❌ I cannot ban ${targetUser.tag}. Their role is higher than mine.`, ephemeral: true });
            }

            await targetMember.ban({ reason: `Banned by ${interaction.user.tag}: ${reason}` });
            return interaction.reply({ content: `✅ Successfully banned **${targetUser.tag}**.\nReason: ${reason}` });

        } catch (error) {
            console.error(error);
            return interaction.reply({ content: '❌ An error occurred while trying to ban this user.', ephemeral: true });
        }
    }
};
