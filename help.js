const { EmbedBuilder, REST, Routes } = require('discord.js');

module.exports = (client) => {
    const PREFIX = '.';

    // ==========================================
    // 1. DISCORD SLASH COMMAND SYNC (MODULAR)
    // ==========================================
    client.on('clientReady', async () => {
        try {
            await client.application.commands.create({
                name: 'help',
                description: 'Shows all available commands and bot info'
            });
            console.log('✅ Help Slash Command Added');
        } catch (error) {
            console.error('❌ Failed to add help slash command:', error);
        }
    });

    // ==========================================
    // 2. HELP EMBED BUILDER
    // ==========================================
    const buildHelpEmbed = (user, guild) => {
        return new EmbedBuilder()
            .setColor('#2b2d31') 
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
                    value: '**Automod Controls (Admin Only):**\n`.automod <enable/disable/status>` - Server-wide master switch\n`.ignore <links/emojis/all/status> [#channel]` - Disable channel filters\n`.unignore <links/emojis/all/status> [#channel]` - Enable channel filters\n\n**Auto-Punish Controls (Admin Only):**\n`.autokick <enable/disable/status>` - Toggle auto-kick for new accounts\n`.autoban <enable/disable/status>` - Toggle auto-ban for scam profiles', 
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
    // 3. PREFIX COMMAND (.help)
    // ==========================================
    client.on('messageCreate', async (message) => {
        if (message.author.bot || !message.guild) return;

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
                        
