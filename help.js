const { EmbedBuilder, REST, Routes } = require('discord.js');

module.exports = (client) => {
    const PREFIX = '.';

    // ==========================================
    // 1. DISCORD SLASH COMMAND SYNC
    // ==========================================
    client.on('clientReady', async () => {
        const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
        try {
            await rest.put(
                Routes.applicationCommands(client.user.id),
                { body: [{
                    name: 'help',
                    description: 'Shows all available commands and bot info'
                }] },
            );
            console.log('✅ Help Slash Command Synced');
        } catch (error) {
            console.error('❌ Failed to sync help slash command:', error);
        }
    });

    // ==========================================
    // 2. HELP EMBED BUILDER
    // ==========================================
    const buildHelpEmbed = (user, guild) => {
        return new EmbedBuilder()
            .setColor('#2b2d31') // Clean, dark Discord theme color
            .setTitle('🤖 Manager Bot | Command List')
            .setDescription(`Prefix for this server is \`${PREFIX}\`\nYou can also use **Slash Commands (/)** for most features!`)
            .setThumbnail(client.user.displayAvatarURL({ dynamic: true, size: 256 }))
            .addFields(
                { 
                    name: '🌐 Translation', 
                    value: '`translate <language> <text>` - Translate text\n*(Tip: Reply to a message with .translate <language>)*', 
                    inline: false 
                },
                { 
                    name: '📈 Leveling System', 
                    value: '`rank` - Check your XP and Level\n`rank @user` - Check someone else\'s stats\n`toggleleveling` - Enable/Disable XP (Admin)', 
                    inline: false 
                },
                { 
                    name: '🎵 Music', 
                    value: '`play <song>` - Play audio in your voice channel', 
                    inline: false 
                },
                { 
                    name: '🛡️ Moderation & Automod', 
                    value: 'General server protection, reaction roles, and automated moderation features are actively running in the background.', 
                    inline: false 
                },
                { 
                    name: '🎨 Extras', 
                    value: 'Image Generation and Premium features are enabled.', 
                    inline: false 
                }
            )
            .setFooter({ text: `Requested by ${user.username}`, iconURL: user.displayAvatarURL({ dynamic: true }) })
            .setTimestamp();
    };

        
    // ==========================================
    // 3. DISCORD SLASH COMMAND SYNC (MODULAR)
    // ==========================================
        // ==========================================
    // 3. PREFIX COMMAND (.help)
    // ==========================================
    client.on('messageCreate', async (message) => {
        if (message.author.bot || !message.guild) return;

        // Added .trim() to catch mobile ghost spaces!
        if (message.content.trim().toLowerCase() === PREFIX + 'help') {
            const helpEmbed = buildHelpEmbed(message.author, message.guild);
            return message.reply({ embeds: [helpEmbed] });
        }
    });
    
    // ==========================================
    // 4. SLASH COMMAND (/help)
    // ==========================================
    client.on('interactionCreate', async (interaction) => {
        if (!interaction.isChatInputCommand()) return;
        if (interaction.commandName !== 'help') return;

        const helpEmbed = buildHelpEmbed(interaction.user, interaction.guild);
        await interaction.reply({ embeds: [helpEmbed] });
    });
};
              
