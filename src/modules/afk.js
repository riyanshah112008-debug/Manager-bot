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
            .setContexts([0]) // 0 restricts it to Guilds (servers) only, blocking DMs natively
            .addStringOption(option => 
                option.setName('reason')
                    .setDescription('Reason for going AFK')
                    .setRequired(false)
            ),

        async execute(interaction) {
            const reason = interaction.options.getString('reason') || 'AFK';
            
            // STRICT ISOLATION: Locks the AFK status to THIS specific server
            const afkKey = `${interaction.guildId}-${interaction.user.id}`;

            afkCollection.set(afkKey, { reason: reason, time: Date.now() });

            const embed = new EmbedBuilder()
                .setColor('#23a559')
                .setDescription(`💤 **${interaction.user.username}**, I set your AFK status for this server: **${reason}**`);

            await interaction.reply({ embeds: [embed] }).catch(() => {});
        }
    });

    // ==========================================
    // 2. HANDLE PREFIX (.afk) AND MESSAGE TRACKING
    // ==========================================
    client.on('messageCreate', async (message) => {
        // Ignore bots and DMs entirely
        if (message.author.bot || !message.guild) return;

        // STRICT ISOLATION KEY
        const authorKey = `${message.guild.id}-${message.author.id}`;

        // --- A. THE PREFIX COMMAND (.afk) ---
        if (message.content.toLowerCase().startsWith(PREFIX + 'afk')) {
            const args = message.content.slice(PREFIX.length + 3).trim();
            const reason = args || 'AFK';

            afkCollection.set(authorKey, { reason: reason, time: Date.now() });

            const embed = new EmbedBuilder()
                .setColor('#23a559')
                .setDescription(`💤 **${message.author.username}**, I set your AFK status for this server: **${reason}**`);

            const reply = await message.reply({ embeds: [embed] }).catch(() => {});

            // Auto-delete confirmation after 5 seconds
            if (reply) setTimeout(() => reply.delete().catch(() => {}), 5000);
            
            return; // Stops execution so the bot doesn't immediately remove the AFK status!
        }

        // --- B. REMOVE AFK WHEN THEY TALK ---
        if (afkCollection.has(authorKey)) {
            const afkData = afkCollection.get(authorKey);
            
            // Anti-Glitch: Prevents removing AFK if they trigger it by typing ".afk" less than 3 seconds ago
            if (Date.now() - afkData.time > 3000) {
                afkCollection.delete(authorKey);
                
                const embed = new EmbedBuilder()
                    .setColor('#FEE75C')
                    .setDescription(`👋 Welcome back **${message.author.username}**, I removed your AFK status for this server.`);
                
                const welcomeBack = await message.channel.send({ embeds: [embed] }).catch(() => {});
                
                if (welcomeBack) setTimeout(() => welcomeBack.delete().catch(() => {}), 5000);
            }
        }

        // --- C. WARN USERS WHO PING THEM ---
        const mentionedUsers = message.mentions.users;
        if (mentionedUsers.size > 0) {
            mentionedUsers.forEach(user => {
                // Check if the pinged user is AFK in THIS specific server
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
