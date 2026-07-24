const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

// Helper function to prevent Discord from crashing due to rate limits
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

module.exports = {
    data: new SlashCommandBuilder()
        .setName('emergency-nuke')
        .setDescription('⚠️ EMERGENCY: Deletes all channels except General. (Admins Only)')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator), // Strictly Admins only

    async execute(interaction) {
        // 1. Send the Ultimate Warning
        const embed = new EmbedBuilder()
            .setColor('#FF0000')
            .setTitle('☢️ EMERGENCY SERVER NUKE ☢️')
            .setDescription(
                '**WARNING: THIS ACTION IS IRREVERSIBLE.**\n\n' +
                'Are you absolutely sure you want to delete **EVERY CHANNEL AND CATEGORY** in this server?\n\n' +
                'The only channels that will survive are `general` and the channel you are in right now.'
            );

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('nuke_confirm').setLabel('NUKE SERVER').setStyle(ButtonStyle.Danger).setEmoji('☢️'),
            new ButtonBuilder().setCustomId('nuke_cancel').setLabel('CANCEL').setStyle(ButtonStyle.Secondary)
        );

        // Make it ephemeral so only the admin sees the button
        const response = await interaction.reply({ embeds: [embed], components: [row], ephemeral: true });

        const filter = i => i.user.id === interaction.user.id;
        
        try {
            // 2. Wait for them to click a button (Expires in 30 seconds)
            const confirmation = await response.awaitMessageComponent({ filter, time: 30000 });

            if (confirmation.customId === 'nuke_cancel') {
                return confirmation.update({ content: '🚫 Nuke aborted. The server is safe.', embeds: [], components: [] });
            }

            // 3. IF CONFIRMED, START THE NUKE
            await confirmation.update({ content: '☢️ **INITIATING EMERGENCY NUKE PROTOCOL...** ☢️\nDeleting channels now...', embeds: [], components: [] });

            const channels = await interaction.guild.channels.fetch();
            let deletedCount = 0;

            for (const [id, channel] of channels) {
                // Protect the channel the command was sent in AND any channel with 'general' in the name
                if (id === interaction.channel.id || channel.name.toLowerCase().includes('general')) {
                    continue; 
                }

                try {
                    await channel.delete('Emergency Nuke Protocol initiated by Admin');
                    deletedCount++;
                    await delay(400); // 0.4s delay so Discord doesn't block the bot
                } catch (err) {
                    console.log(`[Nuke] Could not delete channel ${channel.name}: ${err.message}`);
                }
            }

            // 4. Send final confirmation
            const safeChannel = interaction.guild.channels.cache.get(interaction.channel.id);
            if (safeChannel) {
                const finishEmbed = new EmbedBuilder()
                    .setColor('#2ecc71')
                    .setTitle('☢️ Nuke Complete')
                    .setDescription(`Successfully wiped **${deletedCount} channels** from the server.\nOnly General channels remain.`);
                
                await safeChannel.send({ embeds: [finishEmbed] });
            }

        } catch (e) {
            // If they don't click anything for 30 seconds, cancel it automatically
            await interaction.editReply({ content: '⚠️ Command timed out. Nuke aborted.', embeds: [], components: [] });
        }
    }
};
