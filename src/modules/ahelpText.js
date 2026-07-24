const { Events, PermissionFlagsBits } = require('discord.js');
const { buildAdminHelpEmbed } = require('../commands/moderation/help-admin'); // Import the embed

module.exports = (client) => {
    client.on(Events.MessageCreate, async message => {
        if (message.author.bot || !message.guild) return;

        // Trigger if the user types exactly .ahelp
        if (message.content.toLowerCase() === '.ahelp') {
            
            // Security Check: Make sure they are at least a moderator
            if (!message.member.permissions.has(PermissionFlagsBits.ManageMessages)) {
                return message.reply({ content: '❌ You do not have permission to view the Admin panel.' }).catch(() => {});
            }

            // Fetch the embed from the Slash Command file and send it!
            const embed = buildAdminHelpEmbed(client);
            return message.reply({ embeds: [embed] }).catch(() => {});
        }
    });
};
