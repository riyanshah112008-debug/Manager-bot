const { Events, EmbedBuilder } = require('discord.js');
const { getConfig } = require('./logManager');

module.exports = {
    name: Events.GuildMemberAdd,
    async execute(member) {
        const config = getConfig();
        const logChannelId = config[member.guild.id]?.logChannel;
        if (!logChannelId) return;

        const logChannel = member.guild.channels.cache.get(logChannelId);
        if (!logChannel) return;

        const embed = new EmbedBuilder()
            .setColor('Green')
            .setTitle('📥 Member Joined')
            .setDescription(`${member.user} (${member.user.tag}) has entered the server.`)
            .setThumbnail(member.user.displayAvatarURL())
            .setFooter({ text: `ID: ${member.id}` })
            .setTimestamp();

        await logChannel.send({ embeds: [embed] }).catch(() => {});
    }
};
