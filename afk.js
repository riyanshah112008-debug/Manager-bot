const { EmbedBuilder } = require('discord.js');
const afkCollection = new Map();
const PREFIX = '.'; 

module.exports = (client) => {
    // ==========================================
    // 1. REGISTER THE SLASH COMMAND
    // ==========================================
    client.on('clientReady', async () => {
        try {
            await client.application.commands.create({
                name: 'afk',
                description: 'Set an AFK status so people know you are away',
                options: [
                    { name: 'reason', description: 'Why are you AFK?', type: 3, required: false }
                ]
            });
            console.log('✅ AFK Slash Command Added');
        } catch (err) {}
    });

    // ==========================================
    // 2. HANDLE THE SLASH COMMAND (/afk)
    // ==========================================
    client.on('interactionCreate', async (interaction) => {
        if (!interaction.isChatInputCommand() || interaction.commandName !== 'afk') return;

        const reason = interaction.options.getString('reason') || 'AFK';
        
        afkCollection.set(interaction.user.id, { reason: reason, time: Date.now() });
        await interaction.reply({ content: `✅ I set your AFK status: **${reason}**`, ephemeral: true }).catch(() => {});
    });

    // ==========================================
    // 3. HANDLE PREFIX (.afk) AND MESSAGE TRACKING
    // ==========================================
    client.on('messageCreate', async (message) => {
        if (message.author.bot || !message.guild) return;

        // --- A. THE PREFIX COMMAND FALLBACK ---
        if (message.content.toLowerCase().startsWith(PREFIX + 'afk')) {
            // Grab whatever they typed after ".afk "
            const args = message.content.slice(PREFIX.length + 3).trim();
            const reason = args || 'AFK';

            afkCollection.set(message.author.id, { reason: reason, time: Date.now() });
            
            const reply = await message.reply(`✅ I set your AFK status: **${reason}**`).catch(() => {});
            
            // Auto-delete the bot's confirmation after 5 seconds so chat stays clean
            if (reply) {
                setTimeout(() => reply.delete().catch(() => {}), 5000);
            }
            return; // Stop running the rest of the code so it doesn't instantly remove the AFK status!
        }

        // --- B. REMOVE AFK WHEN THEY TALK ---
        if (afkCollection.has(message.author.id)) {
            afkCollection.delete(message.author.id);
            const welcomeBack = await message.channel.send(`👋 Welcome back <@${message.author.id}>, I removed your AFK status.`).catch(() => {});
            
            if (welcomeBack) {
                setTimeout(() => welcomeBack.delete().catch(() => {}), 5000);
            }
        }

        // --- C. WARN USERS WHO PING THEM ---
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
