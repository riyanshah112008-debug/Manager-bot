const { EmbedBuilder } = require('discord.js');
const afkCollection = new Map();
const PREFIX = '.'; 

module.exports = (client) => {
    // ==========================================
    // 1. HANDLE THE SLASH COMMAND (/afk)
    // ==========================================
    client.on('interactionCreate', async (interaction) => {
        if (!interaction.isChatInputCommand() || interaction.commandName !== 'afk') return;
        
        // Prevent crashes if the command is somehow used in DMs
        if (!interaction.guild) {
            return await interaction.reply({ content: '❌ You can only use this command in a server.', ephemeral: true }).catch(() => {});
        }

        const reason = interaction.options.getString('reason') || 'AFK';
        
        // Create a unique key using both the Guild ID and the User ID
        const afkKey = `${interaction.guild.id}-${interaction.user.id}`;

        afkCollection.set(afkKey, { reason: reason, time: Date.now() });
        await interaction.reply({ content: `✅ I set your AFK status for this server: **${reason}**`, ephemeral: true }).catch(() => {});
    });

    // ==========================================
    // 2. HANDLE PREFIX (.afk) AND MESSAGE TRACKING
    // ==========================================
    client.on('messageCreate', async (message) => {
        // Ignore bots and DMs
        if (message.author.bot || !message.guild) return;

        // Create the unique key for the message author in this specific server
        const authorKey = `${message.guild.id}-${message.author.id}`;

        // --- A. THE PREFIX COMMAND FALLBACK ---
        if (message.content.toLowerCase().startsWith(PREFIX + 'afk')) {
            // Grab whatever they typed after ".afk "
            const args = message.content.slice(PREFIX.length + 3).trim();
            const reason = args || 'AFK';

            afkCollection.set(authorKey, { reason: reason, time: Date.now() });

            const reply = await message.reply(`✅ I set your AFK status for this server: **${reason}**`).catch(() => {});

            // Auto-delete the bot's confirmation after 5 seconds so chat stays clean
            if (reply) {
                setTimeout(() => reply.delete().catch(() => {}), 5000);
            }
            return; // Stop running the rest of the code so it doesn't instantly remove the AFK status!
        }

        // --- B. REMOVE AFK WHEN THEY TALK ---
        if (afkCollection.has(authorKey)) {
            afkCollection.delete(authorKey);
            const welcomeBack = await message.channel.send(`👋 Welcome back <@${message.author.id}>, I removed your AFK status for this server.`).catch(() => {});

            if (welcomeBack) {
                setTimeout(() => welcomeBack.delete().catch(() => {}), 5000);
            }
        }

        // --- C. WARN USERS WHO PING THEM ---
        const mentionedUsers = message.mentions.users;
        if (mentionedUsers.size > 0) {
            mentionedUsers.forEach(user => {
                // Check if the mentioned user is AFK in THIS specific server
                const mentionedKey = `${message.guild.id}-${user.id}`;
                
                if (afkCollection.has(mentionedKey)) {
                    const data = afkCollection.get(mentionedKey);
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
