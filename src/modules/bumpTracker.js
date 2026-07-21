const { EmbedBuilder } = require('discord.js');

module.exports = (client) => {
    client.on('messageCreate', async (message) => {
        if (!message.guild) return;

        // ==========================================
        // 1. DISBOARD BUMP TRACKER
        // ==========================================
        if (message.author.id === '302050872383242240') {
            if (message.embeds.length > 0 && message.embeds[0].description && message.embeds[0].description.includes('Bump done')) {
                const embed = new EmbedBuilder()
                    .setColor('Blue')
                    .setTitle('📈 Server Bumped on Disboard!')
                    .setDescription('Thank you for bumping the server! You can bump us on Disboard again in **2 hours**.')
                    .setTimestamp();
                
                await message.channel.send({ embeds: [embed] }).catch(() => {});
            }
        }

        // ==========================================
        // 2. DISCADIA BUMP TRACKER
        // ==========================================
        if (message.author.username.toLowerCase() === 'discadia' || message.author.id === '839211028308426762') {
            // Discadia's embed usually confirms the bump within the description
            if (message.embeds.length > 0 && message.embeds[0].description && message.embeds[0].description.toLowerCase().includes('bump')) {
                const embed = new EmbedBuilder()
                    .setColor('Green')
                    .setTitle('📈 Server Bumped on Discadia!')
                    .setDescription('Thank you for bumping the server! You can bump us on Discadia again in **24 hours**.')
                    .setTimestamp();
                
                await message.channel.send({ embeds: [embed] }).catch(() => {});
            }
        }
    });
};
                
