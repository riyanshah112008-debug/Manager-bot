const { EmbedBuilder } = require('discord.js');

module.exports = (client) => {
    client.on('messageCreate', async (message) => {
        // Check if the message is from the official Disboard bot
        if (message.author.id === '302050872383242240') {
            
            // Check if it's a successful bump embed
            if (message.embeds.length > 0 && message.embeds[0].description && message.embeds[0].description.includes('Bump done')) {
                const embed = new EmbedBuilder()
                    .setColor('Blue')
                    .setTitle('📈 Server Bumped!')
                    .setDescription('Thank you for bumping the server! You can bump us again in 2 hours.')
                    .setTimestamp();
                
                await message.channel.send({ embeds: [embed] }).catch(() => {});
            }
        }
    });
};
