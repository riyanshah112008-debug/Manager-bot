// ==========================================
// 🖼️ STARRY BOT AVATAR - SLASH COMMAND
// File Path: src/commands/moderation/botavatar.js
// Custom Server Profile Picture (Guild Member Avatar) Manager
// ==========================================
const { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } = require('discord.js');
const botAvatarHelper = require('../../utils/botAvatarHelper');

const EPHEMERAL_FLAG = (MessageFlags && MessageFlags.Ephemeral) ? MessageFlags.Ephemeral : 64;

module.exports = {
    data: new SlashCommandBuilder()
        .setName('botavatar')
        .setDescription('🖼️ Customize or reset the bot\'s profile picture (server avatar) for this server')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
        .setDMPermission(false)
        .addAttachmentOption(opt => 
            opt.setName('image')
               .setDescription('Upload a new profile picture (PNG, JPG, WebP, GIF)')
               .setRequired(false)
        )
        .addStringOption(opt => 
            opt.setName('url')
               .setDescription('Direct image URL for the new profile picture')
               .setRequired(false)
        )
        .addStringOption(opt => 
            opt.setName('action')
               .setDescription('View current avatar or reset back to default global avatar')
               .setRequired(false)
               .addChoices(
                   { name: 'View Current Server Avatar', value: 'view' },
                   { name: 'Reset to Default Global Avatar', value: 'reset' }
               )
        ),

    async execute(interaction) {
        if (!interaction.guild) {
            return interaction.reply({ content: '❌ This command can only be used in a Discord server.', flags: [EPHEMERAL_FLAG] });
        }

        if (!botAvatarHelper.canManageBotAvatar(interaction.member, interaction.user, interaction.guild)) {
            return interaction.reply({ 
                content: '❌ You need the **Manage Server** permission to change the bot\'s avatar for this server.', 
                flags: [EPHEMERAL_FLAG] 
            });
        }

        const action = interaction.options.getString('action');
        const attachment = interaction.options.getAttachment('image');
        const urlInput = interaction.options.getString('url');

        // Case 1: Action = View
        if (action === 'view' || (!attachment && !urlInput && !action)) {
            const payload = botAvatarHelper.buildCurrentAvatarEmbed(interaction.guild, interaction.client, interaction.user);
            const replyMsg = await interaction.reply(payload).catch(() => null);

            // Handle button collector for Reset button if present
            if (replyMsg) {
                const collector = replyMsg.createMessageComponentCollector({
                    filter: (i) => i.customId === 'botavatar_btn_reset' && i.user.id === interaction.user.id,
                    time: 120000
                });

                collector.on('collect', async (btnInt) => {
                    await btnInt.deferUpdate().catch(() => {});
                    try {
                        const resetRes = await botAvatarHelper.resetBotServerAvatar(
                            interaction.guild, 
                            interaction.client, 
                            `Reset via button by ${btnInt.user.tag}`
                        );
                        const resetPayload = botAvatarHelper.buildAvatarResetEmbed(
                            interaction.guild, 
                            interaction.client, 
                            resetRes.globalAvatarUrl, 
                            btnInt.user
                        );
                        await interaction.editReply(resetPayload).catch(() => {});
                    } catch (e) {
                        await interaction.followUp({ content: `❌ Error resetting avatar: \`${e.message}\``, ephemeral: true }).catch(() => {});
                    }
                });
            }
            return;
        }

        // Defer reply for image processing / API call
        if (!interaction.deferred && !interaction.replied) {
            await interaction.deferReply().catch(() => {});
        }

        // Case 2: Action = Reset
        if (action === 'reset' || urlInput?.toLowerCase() === 'reset') {
            try {
                const resetRes = await botAvatarHelper.resetBotServerAvatar(
                    interaction.guild, 
                    interaction.client, 
                    `Reset via slash command by ${interaction.user.tag}`
                );
                const payload = botAvatarHelper.buildAvatarResetEmbed(
                    interaction.guild, 
                    interaction.client, 
                    resetRes.globalAvatarUrl, 
                    interaction.user
                );
                return await interaction.editReply(payload);
            } catch (err) {
                return await interaction.editReply({ content: `❌ Failed to reset server avatar: \`${err.message}\`` });
            }
        }

        // Case 3: Update Avatar
        const targetImage = attachment ? attachment.url : urlInput;
        if (!targetImage) {
            return await interaction.editReply({ 
                content: '❌ Please provide an image upload or an image URL to set the server avatar!' 
            });
        }

        try {
            const updateRes = await botAvatarHelper.updateBotServerAvatar(
                interaction.guild, 
                interaction.client, 
                targetImage, 
                `Updated via slash command by ${interaction.user.tag} (${interaction.user.id})`
            );

            const payload = botAvatarHelper.buildAvatarSuccessEmbed(
                interaction.guild, 
                interaction.client, 
                updateRes.avatarUrl, 
                interaction.user
            );

            const replyMsg = await interaction.editReply(payload);

            // Handle Reset button collector
            if (replyMsg) {
                const collector = replyMsg.createMessageComponentCollector({
                    filter: (i) => i.customId === 'botavatar_btn_reset' && i.user.id === interaction.user.id,
                    time: 120000
                });

                collector.on('collect', async (btnInt) => {
                    await btnInt.deferUpdate().catch(() => {});
                    try {
                        const resetRes = await botAvatarHelper.resetBotServerAvatar(
                            interaction.guild, 
                            interaction.client, 
                            `Reset via button by ${btnInt.user.tag}`
                        );
                        const resetPayload = botAvatarHelper.buildAvatarResetEmbed(
                            interaction.guild, 
                            interaction.client, 
                            resetRes.globalAvatarUrl, 
                            btnInt.user
                        );
                        await interaction.editReply(resetPayload).catch(() => {});
                    } catch (e) {
                        await interaction.followUp({ content: `❌ Error resetting avatar: \`${e.message}\``, ephemeral: true }).catch(() => {});
                    }
                });
            }
        } catch (err) {
            console.error('BotAvatar Slash Command Error:', err);
            const isRateLimit = err.status === 429 || (err.message && err.message.includes('rate limit'));
            const errorMsg = isRateLimit
                ? '⚠️ **Discord Rate Limit:** Profile changes are temporarily limited by Discord. Please wait a few moments and try again!'
                : `❌ **Failed to update server avatar:** ${err.message || 'Unknown Discord API error'}`;
            return await interaction.editReply({ content: errorMsg });
        }
    }
};
