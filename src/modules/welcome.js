// ==========================================
// 1. IMPORTS & MONGOOSE SCHEMA
// ==========================================
const { EmbedBuilder, PermissionFlagsBits, SlashCommandBuilder } = require('discord.js');
const mongoose = require('mongoose');

// MongoDB Schema for Welcome Channel Configuration
const welcomeSchema = new mongoose.Schema({
    guildId: { type: String, required: true, unique: true },
    channelId: { type: String, required: true }
});

const WelcomeSettings = mongoose.models.WelcomeSettings || mongoose.model('WelcomeSettings', welcomeSchema);

// Slash Command Schema Definition
const setupWelcomeCommand = new SlashCommandBuilder()
    .setName('setupwelcome')
    .setDescription('Set up the channel for automated server welcome messages')
    .addChannelOption(option => 
        option.setName('channel')
            .setDescription('The text channel to send welcome cards in')
            .setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild);

// ==========================================
// 2. MAIN WELCOME MODULE FUNCTION
// ==========================================
const welcomeModule = (client) => {

    // Register /setupwelcome command into client command collection
    if (client.commands && typeof client.commands.set === 'function') {
        client.commands.set('setupwelcome', { data: setupWelcomeCommand, execute: handleSetupWelcome });
    }

    // --- Slash Command Handler ---
    async function handleSetupWelcome(interaction) {
        try {
            if (!interaction.deferred && !interaction.replied) {
                await interaction.deferReply({ ephemeral: true });
            }
        } catch (e) { return; }

        if (!interaction.member.permissions.has(PermissionFlagsBits.ManageGuild)) {
            return interaction.editReply({ content: '❌ You need **Manage Server** permissions to configure welcome messages.' });
        }

        const channel = interaction.options.getChannel('channel', true);

        await WelcomeSettings.findOneAndUpdate(
            { guildId: interaction.guildId },
            { channelId: channel.id },
            { upsert: true, new: true }
        );

        const previewEmbed = new EmbedBuilder()
            .setColor('#FFD700')
            .setTitle(`✨ Welcome to ${interaction.guild.name} ✨`)
            .setDescription(`Hello ${interaction.user}, we are so glad you joined the server! Be sure to read the rules and enjoy your stay.`)
            .addFields(
                { name: '👤 Member Count', value: `You are member **#${interaction.guild.memberCount}**!`, inline: true },
                { name: '📆 Account Created', value: `<t:${Math.floor(interaction.user.createdTimestamp / 1000)}:R>`, inline: true }
            )
            .setThumbnail(interaction.user.displayAvatarURL({ dynamic: true, size: 256 }))
            .setFooter({ text: `Starry Welcome System • Preview Mode` })
            .setTimestamp();

        await channel.send({ content: `Hey ${interaction.user}! 👋 *(Setup Preview)*`, embeds: [previewEmbed] }).catch(() => {});

        return interaction.editReply({ content: `✅ **Success!** Welcome messages will now be sent to ${channel}!` });
    }

    // --- Interaction Router ---
    client.on('interactionCreate', async (interaction) => {
        if (!interaction.isChatInputCommand()) return;
        if (interaction.commandName === 'setupwelcome') await handleSetupWelcome(interaction);
    });

    // --- Member Join Listener ---
    client.on('guildMemberAdd', async (member) => {
        if (member.user.bot) return;

        try {
            const config = await WelcomeSettings.findOne({ guildId: member.guild.id });
            if (!config || !config.channelId) return;

            const channel = member.guild.channels.cache.get(config.channelId);
            if (!channel) return;

            const embed = new EmbedBuilder()
                .setColor('#FFD700')
                .setTitle(`✨ Welcome to ${member.guild.name} ✨`)
                .setDescription(`Hello <@${member.id}>, we are so glad you joined the server! Be sure to read the rules and enjoy your stay.`)
                .addFields(
                    { name: '👤 Member Count', value: `You are member **#${member.guild.memberCount}**!`, inline: true },
                    { name: '📆 Account Created', value: `<t:${Math.floor(member.user.createdTimestamp / 1000)}:R>`, inline: true }
                )
                .setThumbnail(member.user.displayAvatarURL({ dynamic: true, size: 256 }))
                .setFooter({ text: `Enjoy your stay in ${member.guild.name}!` })
                .setTimestamp();

            await channel.send({ content: `Hey <@${member.id}>! 👋`, embeds: [embed] }).catch(() => {});
        } catch (error) {
            console.error('[Welcome Engine Error]:', error);
        }
    });
};

welcomeModule.WelcomeSettings = WelcomeSettings;
welcomeModule.setupWelcomeData = setupWelcomeCommand;
module.exports = welcomeModule;
