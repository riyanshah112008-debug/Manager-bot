const { EmbedBuilder } = require('discord.js');

module.exports = (client) => {
    client.on('guildMemberAdd', async (member) => {
        // Calculate the account age in milliseconds
        const accountAgeMs = Date.now() - member.user.createdTimestamp;
        // Convert milliseconds to days
        const daysOld = Math.floor(accountAgeMs / (1000 * 60 * 60 * 24));

        // If the account is 7 days old or newer, sound the alarm!
        if (daysOld <= 7) {
            const embed = new EmbedBuilder()
                .setColor('Red')
                .setTitle('🚨 Suspicious Account Detected')
                .setDescription(`<@${member.id}> just joined the server, but their account is unusually new!`)
                .addFields(
                    { name: 'Account Age', value: `${daysOld} days old`, inline: true },
                    // The <t: :F> tag formats the timestamp into a readable date for Discord
                    { name: 'Created On', value: `<t:${Math.floor(member.user.createdTimestamp / 1000)}:F>`, inline: true }
                )
                .setThumbnail(member.user.displayAvatarURL({ dynamic: true }))
                .setFooter({ text: `User ID: ${member.id}` })
                .setTimestamp();

            // Send the alert to the server's official system messages channel
            const systemChannel = member.guild.systemChannel;
            if (systemChannel) {
                await systemChannel.send({ embeds: [embed] }).catch(() => {});
            }
        }
    });
};
