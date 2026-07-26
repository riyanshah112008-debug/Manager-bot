const { EmbedBuilder, SlashCommandBuilder } = require('discord.js');
const afkCollection = new Map();
const PREFIX = '.'; 

module.exports = (client) => {
    // ==========================================
    // 1. DYNAMIC SLASH COMMAND INJECTION
    // ==========================================
    client.commands.set('afk', {
        data: new SlashCommandBuilder()
            .setName('afk')
            .setDescription('Set your AFK status for this specific server.')
            .setContexts([0]) // Restricts to Guilds only
            .addStringOption(option => 
                option.setName('reason')
                    .setDescription('Reason for going AFK')
                    .setRequired(false)
            ),

        async execute(interaction) {
            const reason = interaction.options.getString('reason') || 'Not specified';
            const afkKey = `${interaction.guildId}-${interaction.user.id}`;

            afkCollection.set(afkKey, { reason: reason, time: Date.now() });

            const embed = new EmbedBuilder()
                .setColor('#EC407A') // Nekotina Pink
                .setAuthor({ name: interaction.user.displayName || interaction.user.username })
                .setDescription(`**AFK status set.**\n\n**Reason:** ${reason}`)
                .setThumbnail(interaction.user.displayAvatarURL({ dynamic: true, size: 256 }))
                .setFooter({ text: 'I will notify those who mention you. >w<' });

            // Using content to ping the user directly alongside the embed
            await interaction.reply({ content: `<@${interaction.user.id}>`, embeds: [embed] }).catch(() => {});
        }
    });

    // ==========================================
    // 2. HANDLE PREFIX (.afk) AND MESSAGE TRACKING
    // ==========================================
    client.on('messageCreate', async (message) => {
        if (message.author.bot || !message.guild) return;

        const authorKey = `${message.guild.id}-${message.author.id}`;

        // --- A. THE PREFIX COMMAND (.afk) ---
        if (message.content.toLowerCase().startsWith(PREFIX + 'afk')) {
            const args = message.content.slice(PREFIX.length + 3).trim();
            const reason = args || 'Not specified';

            afkCollection.set(authorKey, { reason: reason, time: Date.now() });

            const embed = new EmbedBuilder()
                .setColor('#EC407A')
                .setAuthor({ name: message.member?.displayName || message.author.username })
                .setDescription(`**AFK status set.**\n\n**Reason:** ${reason}`)
                .setThumbnail(message.author.displayAvatarURL({ dynamic: true, size: 256 }))
                .setFooter({ text: 'I will notify those who mention you. >w<' });

            const reply = await message.reply({ content: `<@${message.author.id}>`, embeds: [embed] }).catch(() => {});

            // Auto-delete confirmation after 5 seconds to keep chat clean
            if (reply) setTimeout(() => reply.delete().catch(() => {}), 5000);
            
            return;
        }

        // --- B. REMOVE AFK WHEN THEY TALK ---
        if (afkCollection.has(authorKey)) {
            const afkData = afkCollection.get(authorKey);
            
            // 3-second anti-glitch cooldown so setting AFK doesn't instantly remove it
            if (Date.now() - afkData.time > 3000) {
                afkCollection.delete(authorKey);
                
                const embed = new EmbedBuilder()
                    .setColor('#2ECC71') // Green for welcome back
                    .setAuthor({ name: message.member?.displayName || message.author.username })
                    .setDescription(`**Welcome back!**\n\nI have removed your AFK status.`)
                    .setThumbnail(message.author.displayAvatarURL({ dynamic: true, size: 256 }));
                
                const welcomeBack = await message.channel.send({ content: `<@${message.author.id}>`, embeds: [embed] }).catch(() => {});
                
                if (welcomeBack) setTimeout(() => welcomeBack.delete().catch(() => {}), 5000);
            }
        }

        // --- C. WARN USERS WHO PING THEM ---
        const mentionedUsers = message.mentions.users;
        if (mentionedUsers.size > 0) {
            mentionedUsers.forEach(user => {
                const mentionedKey = `${message.guild.id}-${user.id}`;

                if (afkCollection.has(mentionedKey)) {
                    const data = afkCollection.get(mentionedKey);
                    const timeAgo = Math.floor(data.time / 1000);

                    const embed = new EmbedBuilder()
                        .setColor('#EC407A')
                        .setAuthor({ name: user.displayName || user.username })
                        .setDescription(`**is currently AFK.**\n\n**Reason:** ${data.reason}\n\n*Went AFK <t:${timeAgo}:R>*`)
                        .setThumbnail(user.displayAvatarURL({ dynamic: true, size: 256 }));

                    message.reply({ embeds: [embed] }).catch(() => {});
                }
            });
        }
    });
};
