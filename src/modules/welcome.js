// ==========================================
// 🌸 AESTHETIC WELCOME MODULE & SCHEMA
// ==========================================
const { EmbedBuilder, PermissionFlagsBits, SlashCommandBuilder } = require('discord.js');
const mongoose = require('mongoose');

const welcomeSchema = new mongoose.Schema({
    guildId: { type: String, required: true, unique: true },
    channelId: { type: String, required: true }
});

const WelcomeSettings = mongoose.models.WelcomeSettings || mongoose.model('WelcomeSettings', welcomeSchema);

const setupWelcomeCommand = new SlashCommandBuilder()
    .setName('setupwelcome')
    .setDescription('✨ Set up the aesthetic channel for automated welcome cards')
    .addChannelOption(option => 
        option.setName('channel')
            .setDescription('The text channel to send aesthetic welcome cards in')
            .setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild);

const welcomeModule = (client) => {
    if (client.commands && typeof client.commands.set === 'function') {
        client.commands.set('setupwelcome', { data: setupWelcomeCommand, execute: handleSetupWelcome });
    }

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
            .setColor('#FF73FA')
            .setTitle(`🌸 ✨ WELCOME TO ${interaction.guild.name.toUpperCase()} ✨ 🌸`)
            .setDescription(`💖 Hello ${interaction.user}, welcome aboard our magical server! Make yourself completely at home, check out our rules, and enjoy your wonderful stay here. ✨`)
            .addFields(
                { name: '🌸 Member Milestone', value: `You are our stellar member **#${interaction.guild.memberCount}**! 🎉`, inline: false },
                { name: '✨ Account Created', value: `<t:${Math.floor(interaction.user.createdTimestamp / 1000)}:R>`, inline: true }
            )
            .setImage('https://media.tenor.com/9nJ97o10U60AAAAC/anime-welcome.gif')
            .setThumbnail(interaction.user.displayAvatarURL({ dynamic: true, size: 256 }))
            .setFooter({ text: `✨ Starry Aesthetic Welcome System • Setup Preview Mode ✨` })
            .setTimestamp();

        await channel.send({ content: `💫 Hey ${interaction.user}! We've been expecting you! 🥂 *(Setup Preview)*`, embeds: [previewEmbed] }).catch(() => {});

        return interaction.editReply({ content: `✅ **Success!** Aesthetic welcome cards will now be sent to ${channel}!` });
    }

    client.on('interactionCreate', async (interaction) => {
        if (!interaction.isChatInputCommand()) return;
        if (interaction.commandName === 'setupwelcome') await handleSetupWelcome(interaction);
    });

    client.on('guildMemberAdd', async (member) => {
        if (member.user.bot) return;

        try {
            const config = await WelcomeSettings.findOne({ guildId: member.guild.id });
            if (!config || !config.channelId) return;

            const channel = member.guild.channels.cache.get(config.channelId);
            if (!channel) return;

            const aestheticEmbed = new EmbedBuilder()
                .setColor('#FF73FA')
                .setTitle(`✨ WELCOME TO ${member.guild.name.toUpperCase()} ✨`)
                .setDescription(`💖 Hello <@${member.id}>! We are so overjoyed to have you join our family! Make sure to read the guidelines and have an amazing time here. 🌟`)
                .addFields(
                    { name: '🌸 Community Milestone', value: `You are our precious member **#${member.guild.memberCount}**! 🎉`, inline: false },
                    { name: '✨ Account Created', value: `<t:${Math.floor(member.user.createdTimestamp / 1000)}:R>`, inline: true }
                )
                .setImage('https://media.tenor.com/images/5f4481d68378873724c9c22e032997aa/tenor.gif')
                .setThumbnail(member.user.displayAvatarURL({ dynamic: true, size: 256 }))
                .setFooter({ text: `✨ Enjoy your stellar journey in ${member.guild.name}! ✨` })
                .setTimestamp();

            await channel.send({ content: `💫 Welcome <@${member.id}>! Grab a seat and enjoy your stay! 🥂`, embeds: [aestheticEmbed] }).catch(() => {});
        } catch (error) {
            console.error('[Welcome Engine Error]:', error);
        }
    });
};

welcomeModule.WelcomeSettings = WelcomeSettings;
welcomeModule.setupWelcomeData = setupWelcomeCommand;
module.exports = welcomeModule;
