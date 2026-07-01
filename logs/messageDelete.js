const { Events, EmbedBuilder } = require('discord.js');
const { getConfig } = require('./logManager');

module.exports = {
    name: Events.MessageDelete,
    async execute(message) {
        // Ignore direct messages or messages from bots
        if (!message.guild || message.author?.bot) return;

        // Fetch the logging configuration for this server
        const config = getConfig();
        const logChannelId = config[message.guild.id]?.logChannel;

        // If no log channel is set up yet, do nothing
        if (!logChannelId) return;

        // Find the channel in the server
        const logChannel = message.guild.channels.cache.get(logChannelId);
        if (!logChannel) return;

        // Create a beautiful embed to show what was deleted
        const embed = new EmbedBuilder()
            .setColor('Red')
            .setTitle('🗑️ Message Deleted')
            .addFields(
                { name: 'Author', value: `${message.author} (${message.author.tag})`, inline: true },
                { name: 'Channel', value: `${message.channel}`, inline: true },
                { name: 'Content', value: message.content || '*[No text content (likely an embed or image)]*' }
            )
            .setTimestamp();

        // Safely send the log to your designated channel
        await logChannel.send({ embeds: [embed] }).catch(() => {});
    }
};
