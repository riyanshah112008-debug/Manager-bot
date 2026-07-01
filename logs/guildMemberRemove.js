const { Events, EmbedBuilder } = require('discord.js');
const { getConfig } = require('./logManager');

module.exports = {
    name: Events.GuildMemberRemove,
    async execute(member) {
        const config = getConfig();
        const logChannelId = config[member.guild.id]?.logChannel;
        if (!logChannelId) return;

        const logChannel = member.guild.channels.cache.get(logChannelId);
        if (!logChannel) return;

        const embed = new EmbedBuilder()
            .setColor('Red')
            .setTitle('📤 Member Left')
            .setDescription(`${member.user} (${member.user.tag}) has left or been removed from the server.`)
            .setThumbnail(member.user.displayAvatarURL())
            .setFooter({ text: `ID: ${member.id}` })
            .setTimestamp();

        await logChannel.send({ embeds: [embed] }).catch(() => {});
    }
};
