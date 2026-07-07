const { Events, EmbedBuilder } = require('discord.js');
const { getConfig } = require('./logManager');

module.exports = {
    name: Events.GuildMemberUpdate,
    async execute(oldMember, newMember) {
        const config = getConfig();
        const logChannelId = config[oldMember.guild.id]?.logChannel;
        if (!logChannelId) return;

        const logChannel = oldMember.guild.channels.cache.get(logChannelId);
        if (!logChannel) return;

        const oldRoles = oldMember.roles.cache;
        const newRoles = newMember.roles.cache;

        const addedRoles = newRoles.filter(role => !oldRoles.has(role.id));
        const removedRoles = oldRoles.filter(role => !newRoles.has(role.id));

        if (addedRoles.size === 0 && removedRoles.size === 0) return;

        const embed = new EmbedBuilder()
            .setAuthor({ name: newMember.user.tag, iconURL: newMember.user.displayAvatarURL() })
            .setTimestamp()
            .setFooter({ text: `ID: ${newMember.id}` });

        if (addedRoles.size > 0) {
            embed.setColor('Green')
            embed.setTitle('🛡️ Roles Added');
            embed.setDescription(addedRoles.map(r => r.toString()).join(', '));
        } else if (removedRoles.size > 0) {
            embed.setColor('Red')
            embed.setTitle('🛡️ Roles Removed');
            embed.setDescription(removedRoles.map(r => r.toString()).join(', '));
        }

        await logChannel.send({ embeds: [embed] }).catch(() => {});
    }
};
