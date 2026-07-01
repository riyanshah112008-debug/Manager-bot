const { EmbedBuilder } = require('discord.js');
const afkCollection = new Map();

module.exports = (client) => {
    client.on('clientReady', async () => {
        try {
            await client.application.commands.create({
                name: 'afk',
                description: 'Set an AFK status so people know you are away',
                options: [
                    { 
                        name: 'reason', 
                        description: 'Why are you AFK?', 
                        type: 3, 
                        required: false 
                    }
                ]
            });
            console.log('✅ AFK Slash Command Added');
        } catch (err) {}
    });

    // 1. Set the AFK Status
    client.on('interactionCreate', async (interaction) => {
        if (!interaction.isChatInputCommand() || interaction.commandName !== 'afk') return;

        const reason = interaction.options.getString('reason') || 'AFK';
        
        // Save their status and the exact time they went AFK
        afkCollection.set(interaction.user.id, { reason: reason, time: Date.now() });
        
        await interaction.reply({ content: `✅ I set your AFK status: **${reason}**`, ephemeral: true }).catch(() => {});
    });

    // 2. Remove AFK on typing, and warn users who ping them
    client.on('messageCreate', async (message) => {
        if (message.author.bot || !message.guild) return;

        // If the user types a message, remove their AFK status
        if (afkCollection.has(message.author.id)) {
            afkCollection.delete(message.author.id);
            const welcomeBack = await message.channel.send(`👋 Welcome back <@${message.author.id}>, I removed your AFK status.`).catch(() => {});
            
            // Delete the welcome back message after 5 seconds so it doesn't clutter chat
            if (welcomeBack) {
                setTimeout(() => welcomeBack.delete().catch(() => {}), 5000);
            }
        }

        // If someone pings a user who is AFK, throw a warning!
        const mentionedUsers = message.mentions.users;
        if (mentionedUsers.size > 0) {
            mentionedUsers.forEach(user => {
                if (afkCollection.has(user.id)) {
                    const data = afkCollection.get(user.id);
                    const timeAgo = Math.floor(data.time / 1000);
                    
                    const embed = new EmbedBuilder()
                        .setColor('Orange')
                        .setDescription(`💤 **${user.username}** is currently AFK: ${data.reason} *(Since <t:${timeAgo}:R>)*`);
                        
                    message.reply({ embeds: [embed] }).catch(() => {});
                }
            });
        }
    });
};
