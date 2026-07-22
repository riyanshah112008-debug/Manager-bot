const { EmbedBuilder } = require('discord.js');

module.exports = (client) => {
    client.on('interactionCreate', async (interaction) => {
        if (!interaction.isChatInputCommand() || interaction.commandName !== 'whois') return;

        const user = interaction.options.getUser('target') || interaction.user;
        const member = await interaction.guild.members.fetch(user.id).catch(() => null);

        const embed = new EmbedBuilder()
            .setColor(member?.displayHexColor || '#2b2d31')
            .setAuthor({ name: user.tag, iconURL: user.displayAvatarURL({ dynamic: true }) })
            .setThumbnail(user.displayAvatarURL({ dynamic: true, size: 256 }))
            .addFields(
                { name: '👤 Username', value: `\`${user.username}\``, inline: true },
                { name: '🆔 User ID', value: `\`${user.id}\``, inline: true },
                { name: '🤖 Is Bot?', value: user.bot ? 'Yes' : 'No', inline: true },
                { name: '📆 Account Created', value: `<t:${Math.floor(user.createdTimestamp / 1000)}:R>`, inline: true }
            );

        if (member) {
            // Get highest role, excluding @everyone
            const roles = member.roles.cache.filter(r => r.id !== interaction.guild.id).sort((a, b) => b.position - a.position);
            const roleList = roles.map(r => `<@&${r.id}>`).join(', ') || 'None';
            
            // Check for dangerous permissions
            const isAdmin = member.permissions.has('Administrator');
            
            embed.addFields(
                { name: '📥 Joined Server', value: `<t:${Math.floor(member.joinedTimestamp / 1000)}:R>`, inline: true },
                { name: '🛡️ Highest Role', value: member.roles.highest.toString(), inline: true },
                { name: '⚠️ Administrator?', value: isAdmin ? '✅ Yes' : '❌ No', inline: true },
                { name: `🏷️ Roles [${roles.size}]`, value: roleList.length > 1024 ? 'Too many roles to display.' : roleList }
            );
        } else {
            embed.setFooter({ text: 'User is not in this server.' });
        }

        await interaction.reply({ embeds: [embed] }).catch(() => {});
    });
};
