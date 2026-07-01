const { Events, EmbedBuilder } = require('discord.js');
const { getConfig } = require('./logManager');

module.exports = {
    name: Events.MessageUpdate,
    async execute(oldMessage, newMessage) {
        if (!oldMessage.guild || oldMessage.author?.bot) return;
        if (oldMessage.content === newMessage.content) return; // Ignores link preview updates

        const config = getConfig();
        const logChannelId = config[oldMessage.guild.id]?.logChannel;
        if (!logChannelId) return;

        const logChannel = oldMessage.guild.channels.cache.get(logChannelId);
        if (!logChannel) return;

        const embed = new EmbedBuilder()
            .setColor('Blue')
            .setAuthor({ name: oldMessage.author.tag, iconURL: oldMessage.author.displayAvatarURL() })
            .setTitle(`✏️ Message edited in #${oldMessage.channel.name}`)
            .setDescription(`**Before:** ${oldMessage.content || '*[Empty]*'}\n**After:** ${newMessage.content || '*[Empty]*'}`)
            .setFooter({ text: `ID: ${oldMessage.author.id}` })
            .setTimestamp();

        await logChannel.send({ embeds: [embed] }).catch(() => {});
    }
};
