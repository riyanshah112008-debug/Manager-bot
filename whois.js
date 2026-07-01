const { EmbedBuilder } = require('discord.js');

module.exports = (client) => {
    client.on('clientReady', async () => {
        try {
            await client.application.commands.create({
                name: 'whois',
                description: 'Get detailed information about a user',
                options: [
                    { 
                        name: 'target', 
                        description: 'The user to look up', 
                        type: 6, 
                        required: false 
                    }
                ]
            });
            console.log('✅ Whois Slash Command Added');
        } catch (err) {}
    });

    client.on('interactionCreate', async (interaction) => {
        if (!interaction.isChatInputCommand() || interaction.commandName !== 'whois') return;

        const user = interaction.options.getUser('target') || interaction.user;
        const member = interaction.guild.members.cache.get(user.id);

        const embed = new EmbedBuilder()
            .setColor('Purple')
            .setAuthor({ name: user.tag, iconURL: user.displayAvatarURL({ dynamic: true }) })
            .setThumbnail(user.displayAvatarURL({ dynamic: true, size: 256 }))
            .addFields(
                { name: '🆔 User ID', value: user.id, inline: true },
                { name: '📆 Account Created', value: `<t:${Math.floor(user.createdTimestamp / 1000)}:R>`, inline: true }
            )
            .setFooter({ text: `Requested by ${interaction.user.username}` })
            .setTimestamp();

        // If the user is currently in the server, add their server-specific data!
        if (member) {
            const roles = member.roles.cache
                .filter(r => r.id !== interaction.guild.id) // Filter out the @everyone role
                .map(r => `<@&${r.id}>`)
                .join(', ') || 'None';

            embed.addFields(
                { name: '📥 Joined Server', value: `<t:${Math.floor(member.joinedTimestamp / 1000)}:R>`, inline: true },
                { name: '🏷️ Roles', value: roles }
            );
        }

        await interaction.reply({ embeds: [embed] }).catch(() => {});
    });
};
