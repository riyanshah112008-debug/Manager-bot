// ==========================================
// 🔍 WHOIS USER LOOKUP MODULE
// File Path: modules/whois.js
// ==========================================
const { EmbedBuilder, PermissionFlagsBits } = require('discord.js');

module.exports = (client) => {
    client.on('interactionCreate', async (interaction) => {
        if (!interaction.isChatInputCommand() || interaction.commandName !== 'whois') return;

        const user = interaction.options.getUser('target') || interaction.user;
        const member = interaction.guild ? await interaction.guild.members.fetch(user.id).catch(() => null) : null;

        const embed = new EmbedBuilder()
            .setColor(member?.displayHexColor && member.displayHexColor !== '#000000' ? member.displayHexColor : '#5865F2')
            .setAuthor({ name: `${user.tag} (${user.id})`, iconURL: user.displayAvatarURL({ dynamic: true }) })
            .setThumbnail(user.displayAvatarURL({ dynamic: true, size: 256 }))
            .addFields(
                { name: '👤 Username', value: `\`${user.username}\``, inline: true },
                { name: '🆔 User ID', value: `\`${user.id}\``, inline: true },
                { name: '🤖 Is Bot?', value: user.bot ? '`Yes 🤖`' : '`No 👤`', inline: true },
                { name: '📆 Account Created', value: `<t:${Math.floor(user.createdTimestamp / 1000)}:R> (<t:${Math.floor(user.createdTimestamp / 1000)}:D>)`, inline: false }
            )
            .setTimestamp();

        if (member && interaction.guild) {
            // Filter roles excluding @everyone
            const roles = member.roles.cache.filter(r => r.id !== interaction.guild.id).sort((a, b) => b.position - a.position);
            const roleList = roles.map(r => `<@&${r.id}>`).join(', ') || 'None';

            const isAdmin = member.permissions.has(PermissionFlagsBits.Administrator);

            embed.addFields(
                { name: '📥 Joined Server', value: `<t:${Math.floor(member.joinedTimestamp / 1000)}:R>`, inline: true },
                { name: '🛡️ Highest Role', value: member.roles.highest.toString(), inline: true },
                { name: '⚠️ Administrator?', value: isAdmin ? '`Yes ✅`' : '`No ❌`', inline: true },
                { name: `🏷️ Roles [${roles.size}]`, value: roleList.length > 1024 ? `${roles.size} roles (List too long to display)` : roleList, inline: false }
            );
        } else {
            embed.setFooter({ text: 'User is not currently in this server.' });
        }

        await interaction.reply({ embeds: [embed] }).catch(() => {});
    });
};
