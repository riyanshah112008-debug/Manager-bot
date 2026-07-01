const { PermissionsBitField, EmbedBuilder } = require('discord.js');

module.exports = (client) => {
    client.on('messageCreate', async (message) => {
        // 1. Ignore bots and direct messages
        if (message.author.bot || !message.guild) return;

        // 2. Ignore Admins and Moderators (so you and your staff can still post links!)
        if (message.member.permissions.has(PermissionsBitField.Flags.ManageMessages)) return;

        // 3. Detect any website links or Discord server invites
        const linkRegex = /(https?:\/\/[^\s]+)|(discord\.gg\/[a-zA-Z0-9]+)/i;

        if (linkRegex.test(message.content)) {
            try {
                // Delete the unauthorized link
                await message.delete();

                // Build a warning embed
                const embed = new EmbedBuilder()
                    .setColor('Red')
                    .setTitle('🚫 Unauthorized Link')
                    .setDescription(`<@${message.author.id}>, you do not have permission to post links here!`);

                // Send the warning safely
                const warningMessage = await message.channel.send({ embeds: [embed] }).catch(() => {});

                // Auto-delete the warning after 5 seconds so it doesn't clutter the chat
                if (warningMessage) {
                    setTimeout(() => {
                        warningMessage.delete().catch(() => {});
                    }, 5000);
                }
            } catch (error) {
                // Silently ignore if Starry lacks permission to delete messages in a specific channel
                return;
            }
        }
    });
};
