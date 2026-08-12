// ==========================================
// 🌸 INTERACTIVE WELCOME SUITE - SCHEMA & MANAGER SUITE
// File Path: welcome.js (Part 1 of 2)
// ==========================================
const { 
    EmbedBuilder, 
    ActionRowBuilder, 
    ButtonBuilder, 
    ButtonStyle, 
    ModalBuilder, 
    TextInputBuilder, 
    TextInputStyle, 
    PermissionFlagsBits, 
    SlashCommandBuilder 
} = require('discord.js');
const mongoose = require('mongoose');

const welcomeSchema = new mongoose.Schema({
    guildId: { type: String, required: true, unique: true },
    channelId: { type: String, required: true },
    title: { type: String, default: '✨ WELCOME TO {server} ✨' },
    description: { type: String, default: '💖 Hello {user}! We are so overjoyed to have you join our family! Make sure to read the guidelines and have an amazing time here. 🌟' },
    color: { type: String, default: '#FF73FA' },
    image: { type: String, default: 'https://media.tenor.com/images/5f4481d68378873724c9c22e032997aa/tenor.gif' },
    thumbnail: { type: String, default: 'avatar' }, // 'avatar' or custom URL
    footer: { type: String, default: '✨ Enjoy your stellar journey in {server}! ✨' },
    pingContent: { type: String, default: '💫 Welcome {user}! Grab a seat and enjoy your stay! 🥂' }
});

const WelcomeSettings = mongoose.models.WelcomeSettings || mongoose.model('WelcomeSettings', welcomeSchema);

const setupWelcomeCommand = new SlashCommandBuilder()
    .setName('setupwelcome')
    .setDescription('✨ Set up and interactively customize welcome messages')
    .addChannelOption(option => 
        option.setName('channel')
            .setDescription('The text channel to send aesthetic welcome cards in')
            .setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild);

function replacePlaceholders(text, member) {
    if (!text) return '';
    return text
        .replace(/\{user\}/g, `<@${member.id}>`)
        .replace(/\{username\}/g, member.user.username)
        .replace(/\{tag\}/g, member.user.tag || member.user.username)
        .replace(/\{server\}/g, member.guild.name)
        .replace(/\{count\}/g, `${member.guild.memberCount}`);
}

async function getWelcomeControlPanel(guildId, client) {
    let settings = await WelcomeSettings.findOne({ guildId });
    if (!settings) return null;

    const panelEmbed = new EmbedBuilder()
        .setColor(settings.color || '#FF73FA')
        .setTitle(`🎨 Welcome Customizer & Manager | ${settings.guildId}`)
        .setDescription(
            `Configure and design custom welcome cards for your server.\n\n` +
            `**📍 Welcome Channel:** <#${settings.channelId}>\n` +
            `**💬 Message Header:** \`${settings.pingContent}\`\n` +
            `**🏷️ Title:** \`${settings.title}\`\n` +
            `**📝 Description:** \`\`\`${settings.description}\`\`\`\n` +
            `**🎨 Hex Color:** \`${settings.color}\` | **🌸 Footer:** \`${settings.footer}\`\n` +
            `**🖼️ Banner Image:** [View Image](${settings.image})`
        )
        .addFields({
            name: '🔤 Supported Variables',
            value: '`{user}` • `{username}` • `{tag}` • `{server}` • `{count}`',
            inline: false
        })
        .setFooter({ text: 'Use the interactive buttons below to modify each section in real time.' });

    const row1 = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('welc_btn_text').setLabel('Edit Title & Text').setStyle(ButtonStyle.Primary).setEmoji('✏️'),
        new ButtonBuilder().setCustomId('welc_btn_media').setLabel('Edit Banner & Thumb').setStyle(ButtonStyle.Secondary).setEmoji('🖼️'),
        new ButtonBuilder().setCustomId('welc_btn_style').setLabel('Edit Style & Footer').setStyle(ButtonStyle.Secondary).setEmoji('🎨')
    );

    const row2 = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('welc_btn_ping').setLabel('Edit Ping Header').setStyle(ButtonStyle.Secondary).setEmoji('💬'),
        new ButtonBuilder().setCustomId('welc_btn_preview').setLabel('Test Preview Card').setStyle(ButtonStyle.Success).setEmoji('👁️')
    );

    return { embeds: [panelEmbed], components: [row1, row2] };
}

const welcomeModule = (client) => {
    if (client.commands && typeof client.commands.set === 'function') {
        client.commands.set('setupwelcome', { data: setupWelcomeCommand, execute: handleSetupWelcome });
    }

    async function handleSetupWelcome(interaction) {
        try {
            if (!interaction.deferred && !interaction.replied) {
                await interaction.deferReply({ flags: [6] });
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

        const panelData = await getWelcomeControlPanel(interaction.guildId, client);
        return interaction.editReply({ 
            content: `✅ **Welcome channel configured to ${channel}!** Use the Embed Manager below to customize layout:`,
            ...panelData 
        });
    }

    client.on('guildMemberAdd', async (member) => {
        if (member.user.bot) return;

        try {
            const config = await WelcomeSettings.findOne({ guildId: member.guild.id });
            if (!config || !config.channelId) return;

            const channel = member.guild.channels.cache.get(config.channelId);
            if (!channel) return;

            const pingMsg = replacePlaceholders(config.pingContent, member);
            const titleMsg = replacePlaceholders(config.title, member);
            const descMsg = replacePlaceholders(config.description, member);
            const footerMsg = replacePlaceholders(config.footer, member);

            const welcomeEmbed = new EmbedBuilder()
                .setColor(config.color || '#FF73FA')
                .setTitle(titleMsg)
                .setDescription(descMsg)
                .addFields(
                    { name: '🌸 Community Member', value: `You are our precious member **#${member.guild.memberCount}**! 🎉`, inline: false },
                    { name: '✨ Account Created', value: `<t:${Math.floor(member.user.createdTimestamp / 1000)}:R>`, inline: true }
                )
                .setTimestamp();

            if (config.image) welcomeEmbed.setImage(config.image);

            if (config.thumbnail === 'avatar') {
                welcomeEmbed.setThumbnail(member.user.displayAvatarURL({ dynamic: true, size: 256 }));
            } else if (config.thumbnail) {
                welcomeEmbed.setThumbnail(config.thumbnail);
            }

            if (footerMsg) welcomeEmbed.setFooter({ text: footerMsg });

            await channel.send({ content: pingMsg, embeds: [welcomeEmbed] }).catch(() => {});
        } catch (error) {
            console.error('[Welcome Engine Error]:', error);
        }
    });
                                          // ==========================================
// 🌸 INTERACTIVE WELCOME SUITE - INTERACTION CONTROLLERS
// File Path: welcome.js (Part 2 of 2)
// ==========================================

    client.on('interactionCreate', async (interaction) => {
        if (interaction.isChatInputCommand()) {
            if (interaction.commandName === 'setupwelcome') await handleSetupWelcome(interaction);
            return;
        }

        // ==========================================
        // 🔘 INTERACTIVE EMBED MANAGER BUTTON HANDLERS
        // ==========================================
        if (interaction.isButton() && interaction.customId.startsWith('welc_btn_')) {
            if (!interaction.member.permissions.has(PermissionFlagsBits.ManageGuild)) {
                return interaction.reply({ content: '❌ You need **Manage Server** permissions.', flags: [6] });
            }

            const settings = await WelcomeSettings.findOne({ guildId: interaction.guildId });
            if (!settings) return interaction.reply({ content: '❌ Please run `/setupwelcome` first.', flags: [6] });

            // EDIT TITLE & DESCRIPTION MODAL
            if (interaction.customId === 'welc_btn_text') {
                const modal = new ModalBuilder().setCustomId('welc_modal_text').setTitle('Edit Welcome Title & Text');
                
                const titleInput = new TextInputBuilder()
                    .setCustomId('in_title')
                    .setLabel('Welcome Embed Title')
                    .setStyle(TextInputStyle.Short)
                    .setValue(settings.title || '')
                    .setRequired(true);

                const descInput = new TextInputBuilder()
                    .setCustomId('in_desc')
                    .setLabel('Welcome Description')
                    .setStyle(TextInputStyle.Paragraph)
                    .setValue(settings.description || '')
                    .setRequired(true);

                modal.addComponents(new ActionRowBuilder().addComponents(titleInput), new ActionRowBuilder().addComponents(descInput));
                return interaction.showModal(modal);
            }

            // EDIT BANNER & THUMBNAIL MODAL
            if (interaction.customId === 'welc_btn_media') {
                const modal = new ModalBuilder().setCustomId('welc_modal_media').setTitle('Edit Banner & Thumbnail');

                const imageInput = new TextInputBuilder()
                    .setCustomId('in_image')
                    .setLabel('Banner Image URL (GIF or PNG)')
                    .setStyle(TextInputStyle.Short)
                    .setValue(settings.image || '')
                    .setRequired(false);

                const thumbInput = new TextInputBuilder()
                    .setCustomId('in_thumb')
                    .setLabel('Thumbnail ("avatar" or custom image URL)')
                    .setStyle(TextInputStyle.Short)
                    .setValue(settings.thumbnail || 'avatar')
                    .setRequired(false);

                modal.addComponents(new ActionRowBuilder().addComponents(imageInput), new ActionRowBuilder().addComponents(thumbInput));
                return interaction.showModal(modal);
            }

            // EDIT STYLE & FOOTER MODAL
            if (interaction.customId === 'welc_btn_style') {
                const modal = new ModalBuilder().setCustomId('welc_modal_style').setTitle('Edit Hex Color & Footer');

                const colorInput = new TextInputBuilder()
                    .setCustomId('in_color')
                    .setLabel('Hex Color Code (e.g. #FF73FA)')
                    .setStyle(TextInputStyle.Short)
                    .setValue(settings.color || '#FF73FA')
                    .setRequired(true);

                const footerInput = new TextInputBuilder()
                    .setCustomId('in_footer')
                    .setLabel('Footer Text')
                    .setStyle(TextInputStyle.Short)
                    .setValue(settings.footer || '')
                    .setRequired(false);

                modal.addComponents(new ActionRowBuilder().addComponents(colorInput), new ActionRowBuilder().addComponents(footerInput));
                return interaction.showModal(modal);
            }

            // EDIT PING HEADER MODAL
            if (interaction.customId === 'welc_btn_ping') {
                const modal = new ModalBuilder().setCustomId('welc_modal_ping').setTitle('Edit Message Ping Header');

                const pingInput = new TextInputBuilder()
                    .setCustomId('in_ping')
                    .setLabel('Content Above Embed')
                    .setStyle(TextInputStyle.Short)
                    .setValue(settings.pingContent || '')
                    .setRequired(true);

                modal.addComponents(new ActionRowBuilder().addComponents(pingInput));
                return interaction.showModal(modal);
            }

            // TEST PREVIEW CARD
            if (interaction.customId === 'welc_btn_preview') {
                const member = interaction.member;
                const pingMsg = replacePlaceholders(settings.pingContent, member);
                const titleMsg = replacePlaceholders(settings.title, member);
                const descMsg = replacePlaceholders(settings.description, member);
                const footerMsg = replacePlaceholders(settings.footer, member);

                const previewEmbed = new EmbedBuilder()
                    .setColor(settings.color || '#FF73FA')
                    .setTitle(titleMsg)
                    .setDescription(descMsg)
                    .addFields(
                        { name: '🌸 Community Member', value: `You are our precious member **#${member.guild.memberCount}**! 🎉`, inline: false },
                        { name: '✨ Account Created', value: `<t:${Math.floor(member.user.createdTimestamp / 1000)}:R>`, inline: true }
                    )
                    .setTimestamp();

                if (settings.image) previewEmbed.setImage(settings.image);
                if (settings.thumbnail === 'avatar') previewEmbed.setThumbnail(member.user.displayAvatarURL({ dynamic: true, size: 256 }));
                else if (settings.thumbnail) previewEmbed.setThumbnail(settings.thumbnail);
                if (footerMsg) previewEmbed.setFooter({ text: `${footerMsg} (Setup Preview)` });

                return interaction.reply({ content: `${pingMsg} *(Setup Preview)*`, embeds: [previewEmbed], flags: [6] });
            }
        }

        // ==========================================
        // 📝 MODAL SUBMISSION PROCESSORS
        // ==========================================
        if (interaction.isModalSubmit() && interaction.customId.startsWith('welc_modal_')) {
            const guildId = interaction.guildId;

            if (interaction.customId === 'welc_modal_text') {
                const title = interaction.fields.getTextInputValue('in_title');
                const description = interaction.fields.getTextInputValue('in_desc');
                await WelcomeSettings.findOneAndUpdate({ guildId }, { title, description }, { upsert: true });
            }

            if (interaction.customId === 'welc_modal_media') {
                const image = interaction.fields.getTextInputValue('in_image');
                const thumbnail = interaction.fields.getTextInputValue('in_thumb');
                await WelcomeSettings.findOneAndUpdate({ guildId }, { image, thumbnail }, { upsert: true });
            }

            if (interaction.customId === 'welc_modal_style') {
                const color = interaction.fields.getTextInputValue('in_color');
                const footer = interaction.fields.getTextInputValue('in_footer');
                await WelcomeSettings.findOneAndUpdate({ guildId }, { color, footer }, { upsert: true });
            }

            if (interaction.customId === 'welc_modal_ping') {
                const pingContent = interaction.fields.getTextInputValue('in_ping');
                await WelcomeSettings.findOneAndUpdate({ guildId }, { pingContent }, { upsert: true });
            }

            await interaction.reply({ content: '✅ **Welcome Embed Design Updated!**', flags: [6] });

            const panelData = await getWelcomeControlPanel(guildId, client);
            if (interaction.message && panelData) {
                await interaction.message.edit(panelData).catch(() => {});
            }
        }
    });
};

welcomeModule.WelcomeSettings = WelcomeSettings;
welcomeModule.setupWelcomeData = setupWelcomeCommand;
module.exports = welcomeModule;
