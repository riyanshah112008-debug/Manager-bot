const { Events, EmbedBuilder } = require('discord.js');
const { getConfig } = require('./logManager');

module.exports = {
    name: Events.MessageDelete,
    async execute(message) {
        if (!message.guild || message.author?.bot) return;

        const config = getConfig();
        const logChannelId = config[message.guild.id]?.logChannel;
        if (!logChannelId) return;

        const logChannel = message.guild.channels.cache.get(logChannelId);
        if (!logChannel) return;

        const embed = new EmbedBuilder()
            .setColor('Red')
            .setTitle('🗑️ Message Deleted')
            .addFields(
                { name: 'Author', value: `${message.author} (${message.author.tag})`, inline: true },
                { name: 'Channel', value: `${message.channel}`, inline: true },
                { name: 'Content', value: message.content || '*[No text content]*' }
            )
            .setTimestamp();

        await logChannel.send({ embeds: [embed] }).catch(() => {});
    }
};
