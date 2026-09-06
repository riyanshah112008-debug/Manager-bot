// ==========================================
// 🥀 AESTHETIC GOODBYE MODULE & SCHEMA
// ==========================================
const { EmbedBuilder, PermissionFlagsBits, SlashCommandBuilder } = require('discord.js');
const mongoose = require('mongoose');
const { getGuildLanguageSync, t } = require('../utils/i18n');

const goodbyeSchema = new mongoose.Schema({
    guildId: { type: String, required: true, unique: true },
    channelId: { type: String, required: true }
});

const GoodbyeSettings = mongoose.models.GoodbyeSettings || mongoose.model('GoodbyeSettings', goodbyeSchema);

const setupGoodbyeCommand = new SlashCommandBuilder()
    .setName('setupgoodbye')
    .setDescription('🥀 Set up the channel for automated aesthetic goodbye cards')
    .addChannelOption(option => 
        option.setName('channel')
            .setDescription('The text channel to send goodbye cards in')
            .setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild);

const goodbyeModule = (client) => {
    if (client.commands && typeof client.commands.set === 'function') {
        client.commands.set('setupgoodbye', { data: setupGoodbyeCommand, execute: handleSetupGoodbye });
    }

    async function handleSetupGoodbye(interaction) {
        try {
            if (!interaction.deferred && !interaction.replied) {
                await interaction.deferReply({ ephemeral: true });
            }
        } catch (e) { return; }

        if (!interaction.member.permissions.has(PermissionFlagsBits.ManageGuild)) {
            return interaction.editReply({ content: '❌ You need **Manage Server** permissions to configure goodbye messages.' });
        }

        const channel = interaction.options.getChannel('channel', true);
        const lang = getGuildLanguageSync(interaction.guildId);

        await GoodbyeSettings.findOneAndUpdate(
            { guildId: interaction.guildId },
            { channelId: channel.id },
            { upsert: true, new: true }
        );

        const previewEmbed = new EmbedBuilder()
            .setColor('#7289DA')
            .setTitle(t(lang, 'goodbye.preview_title'))
            .setDescription(t(lang, 'goodbye.desc', { user: interaction.user.tag, server: interaction.guild.name }))
            .addFields({ name: t(lang, 'goodbye.census_field'), value: t(lang, 'goodbye.census_value', { count: interaction.guild.memberCount }), inline: false })
            .setImage('https://media.tenor.com/images/99208a68b444b0593457a82b3d39575e/tenor.gif')
            .setThumbnail(interaction.user.displayAvatarURL({ dynamic: true }))
            .setFooter({ text: t(lang, 'goodbye.footer_preview') })
            .setTimestamp();

        await channel.send({ content: t(lang, 'goodbye.preview_content', { user: interaction.user.username }), embeds: [previewEmbed] }).catch(() => {});

        return interaction.editReply({ content: t(lang, 'goodbye.setup_success', { channel: channel.toString() }) });
    }

    client.on('interactionCreate', async (interaction) => {
        if (!interaction.isChatInputCommand()) return;
        if (interaction.commandName === 'setupgoodbye') await handleSetupGoodbye(interaction);
    });

    client.on('guildMemberRemove', async (member) => {
        try {
            const config = await GoodbyeSettings.findOne({ guildId: member.guild.id });
            if (!config || !config.channelId) return;

            const channel = member.guild.channels.cache.get(config.channelId);
            if (!channel) return;

            const lang = getGuildLanguageSync(member.guild.id);

            const aestheticEmbed = new EmbedBuilder()
                .setColor('#7289DA')
                .setTitle(t(lang, 'goodbye.title'))
                .setDescription(t(lang, 'goodbye.desc', { user: member.user.tag, server: member.guild.name }))
                .addFields({ name: t(lang, 'goodbye.census_field'), value: t(lang, 'goodbye.census_value', { count: member.guild.memberCount }), inline: false })
                .setImage('https://media.tenor.com/images/99208a68b444b0593457a82b3d39575e/tenor.gif')
                .setThumbnail(member.user.displayAvatarURL({ dynamic: true }))
                .setFooter({ text: t(lang, 'goodbye.footer') })
                .setTimestamp();

            await channel.send({ content: t(lang, 'goodbye.content', { user: member.user.username }), embeds: [aestheticEmbed] }).catch(() => {});
        } catch (error) {
            console.error('[Goodbye Engine Error]:', error);
        }
    });
};

goodbyeModule.GoodbyeSettings = GoodbyeSettings;
goodbyeModule.setupGoodbyeData = setupGoodbyeCommand;
module.exports = goodbyeModule;
