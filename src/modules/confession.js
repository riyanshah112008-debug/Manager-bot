'use strict';

const mongoose = require('mongoose');
const {
    ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType, EmbedBuilder,
    MessageFlags, ModalBuilder, PermissionFlagsBits, SlashCommandBuilder,
    TextInputBuilder, TextInputStyle
} = require('discord.js');

const EPHEMERAL = MessageFlags.Ephemeral;
const OPEN_BUTTON = 'starry:confession:open';
const LEGACY_OPEN_BUTTON = 'confess_btn_open';
const SUBMIT_MODAL = 'starry:confession:submit';
const REPORT_PREFIX = 'starry:confession:report:';
const REPLY_PREFIX = 'starry:confession:reply:';
const MAX_BODY = 1000;
const MAX_TOPIC = 60;
const MAX_REPLY = 500;

const configSchema = new mongoose.Schema({
    guildId: { type: String, required: true, unique: true, index: true },
    channelId: { type: String, required: true },
    staffChannelId: { type: String, required: true },
    repliesEnabled: { type: Boolean, default: true },
    reportsEnabled: { type: Boolean, default: true },
}, { timestamps: true });
const counterSchema = new mongoose.Schema({
    guildId: { type: String, required: true, unique: true, index: true },
    value: { type: Number, default: 0 }
}, { timestamps: true });

const ConfessionConfig = mongoose.models.StarryConfessionConfig ||
    mongoose.model('StarryConfessionConfig', configSchema);
const ConfessionCounter = mongoose.models.StarryConfessionCounter ||
    mongoose.model('StarryConfessionCounter', counterSchema);

const setupPayload = new SlashCommandBuilder()
    .setName('confessionsetup')
    .setDescription('Configure Starry anonymous confessions')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addChannelOption(option => option.setName('channel')
        .setDescription('Where anonymous confessions will be published')
        .addChannelTypes(ChannelType.GuildText).setRequired(true))
    .addChannelOption(option => option.setName('staff_channel')
        .setDescription('Private staff channel for confession reports')
        .addChannelTypes(ChannelType.GuildText).setRequired(true))
    .toJSON();

const confessPayload = new SlashCommandBuilder()
    .setName('confess').setDescription('Open the private anonymous confession form').toJSON();
const confessionPayload = new SlashCommandBuilder()
    .setName('confession').setDescription('Open the private anonymous confession form').toJSON();

function buildPanelEmbed() {
    return new EmbedBuilder().setColor(0x8B5CF6)
        .setTitle('💌  Starry Confession Box')
        .setDescription([
            'A quiet place to say what you have been holding in.',
            '',
            '**Your words. Your choice. No public identity.**',
            'Tap below, write your confession, and Starry will publish it without displaying your account.',
            '',
            '┌  **Community promise**',
            '│  • No doxxing, threats, or targeted harassment',
            '│  • Be respectful; sensitive reports go to staff',
            '└  • Reports are reviewed privately'
        ].join('\n'))
        .addFields(
            { name: '✍️  Submit', value: 'Open the private form and share up to 1,000 characters.', inline: true },
            { name: '🛡️  Safety', value: 'Every post has a report option for staff review.', inline: true }
        ).setFooter({ text: 'STARRY  •  CONFESSIONS  •  Share thoughtfully' });
}

function buildPanelComponents() {
    return [new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(OPEN_BUTTON).setLabel('Submit a confession')
            .setEmoji('💌').setStyle(ButtonStyle.Primary)
    )];
}

function buildConfessionEmbed(number, topic, body) {
    const embed = new EmbedBuilder().setColor(0xA78BFA)
        .setAuthor({ name: 'ANONYMOUS CONFESSION  ·  #' + number, iconURL: 'https://cdn.discordapp.com/embed/avatars/0.png' })
        .setDescription('“' + body.trim() + '”')
        .addFields({ name: '🕰️ Shared', value: '<t:' + Math.floor(Date.now() / 1000) + ':R>', inline: true })
        .setFooter({ text: 'Starry Confessions  •  Keep it kind. Keep it safe.' });
    if (topic && topic.trim()) embed.setTitle('✦ ' + topic.trim().slice(0, MAX_TOPIC));
    return embed;
}

function buildConfessionActions(messageId, repliesEnabled) {
    const buttons = [];
    if (repliesEnabled !== false) {
        buttons.push(new ButtonBuilder().setCustomId(REPLY_PREFIX + messageId)
            .setLabel('Reply anonymously').setEmoji('↩️').setStyle(ButtonStyle.Secondary));
    }
    buttons.push(new ButtonBuilder().setCustomId(REPORT_PREFIX + messageId)
        .setLabel('Report').setEmoji('🚩').setStyle(ButtonStyle.Danger));
    return [new ActionRowBuilder().addComponents(buttons)];
}

function buildConfessionModal() {
    const modal = new ModalBuilder().setCustomId(SUBMIT_MODAL).setTitle('Send an anonymous confession');
    const topic = new TextInputBuilder().setCustomId('topic').setLabel('Topic (optional)')
        .setPlaceholder('Crush, friendship, life, a thought…').setStyle(TextInputStyle.Short)
        .setRequired(false).setMaxLength(MAX_TOPIC);
    const body = new TextInputBuilder().setCustomId('body').setLabel('Your confession')
        .setPlaceholder('Write what you want to share. Do not include private identifying details.')
        .setStyle(TextInputStyle.Paragraph).setRequired(true).setMinLength(3).setMaxLength(MAX_BODY);
    modal.addComponents(new ActionRowBuilder().addComponents(topic), new ActionRowBuilder().addComponents(body));
    return modal;
}

function buildReplyModal(messageId) {
    const modal = new ModalBuilder().setCustomId(REPLY_PREFIX + messageId).setTitle('Write an anonymous reply');
    const body = new TextInputBuilder().setCustomId('reply').setLabel('Your reply')
        .setPlaceholder('Respond kindly. Your account will not be shown.')
        .setStyle(TextInputStyle.Paragraph).setRequired(true).setMinLength(1).setMaxLength(MAX_REPLY);
    modal.addComponents(new ActionRowBuilder().addComponents(body));
    return modal;
}

function buildReportModal(messageId) {
    const modal = new ModalBuilder().setCustomId(REPORT_PREFIX + messageId).setTitle('Report a confession');
    const reason = new TextInputBuilder().setCustomId('reason').setLabel('Why should staff review this?')
        .setPlaceholder('Harassment, personal information, threats…')
        .setStyle(TextInputStyle.Paragraph).setRequired(true).setMinLength(3).setMaxLength(500);
    modal.addComponents(new ActionRowBuilder().addComponents(reason));
    return modal;
}

async function getConfig(guildId) {
    return ConfessionConfig.findOne().where('guildId').equals(guildId).lean().exec();
}

async function nextConfessionNumber(guildId) {
    const counter = await ConfessionCounter.findOneAndUpdate(
        { guildId }, { $inc: { value: 1 }, $setOnInsert: { guildId } },
        { new: true, upsert: true, setDefaultsOnInsert: true }
    ).lean().exec();
    return counter.value;
}

async function fetchTextChannel(guild, channelId) {
    const channel = guild.channels.cache.get(channelId) ||
        await guild.channels.fetch(channelId).catch(() => null);
    return channel && channel.type === ChannelType.GuildText && channel.isTextBased() ? channel : null;
}

async function privateReply(interaction, content) {
    const payload = { content, flags: EPHEMERAL, allowedMentions: { parse: [] } };
    if (interaction.deferred || interaction.replied) return interaction.editReply(payload).catch(() => null);
    return interaction.reply(payload).catch(() => null);
}

function confessionModule(client) {
    if (client.__starryConfessionHandlerInstalled) return;
    client.__starryConfessionHandlerInstalled = true;

    client.on('interactionCreate', async interaction => {
        try {
            if (interaction.isChatInputCommand()) {
                if (interaction.commandName === 'confessionsetup') {
                    await interaction.deferReply({ flags: EPHEMERAL });
                    const channel = interaction.options.getChannel('channel', true);
                    const staffChannel = interaction.options.getChannel('staff_channel', true);
                    if (channel.guildId !== interaction.guildId || staffChannel.guildId !== interaction.guildId) {
                        return interaction.editReply({ content: 'Both channels must belong to this server.' });
                    }
                    await ConfessionConfig.findOneAndUpdate(
                        { guildId: interaction.guildId },
                        { $set: { channelId: channel.id, staffChannelId: staffChannel.id },
                          $setOnInsert: { guildId: interaction.guildId } },
                        { upsert: true, new: true, setDefaultsOnInsert: true }
                    ).exec();
                    await channel.send({ embeds: [buildPanelEmbed()], components: buildPanelComponents() });
                    return interaction.editReply({ content: 'Confession panel posted in ' + channel + '. Reports will be delivered to ' + staffChannel + '.' });
                }
                if (interaction.commandName === 'confess' || interaction.commandName === 'confession') {
                    if (!interaction.inGuild()) return privateReply(interaction, 'Confessions can only be submitted inside a server.');
                    return interaction.showModal(buildConfessionModal());
                }
            }

            if (interaction.isButton()) {
                if (interaction.customId === OPEN_BUTTON || interaction.customId === LEGACY_OPEN_BUTTON) return interaction.showModal(buildConfessionModal());
                if (interaction.customId.startsWith(REPLY_PREFIX)) {
                    const messageId = interaction.customId.slice(REPLY_PREFIX.length);
                    if (!/^\d{17,20}$/.test(messageId)) return privateReply(interaction, 'This confession button is invalid. Please use the latest panel.');
                    return interaction.showModal(buildReplyModal(messageId));
                }
                if (interaction.customId.startsWith(REPORT_PREFIX)) {
                    const messageId = interaction.customId.slice(REPORT_PREFIX.length);
                    if (!/^\d{17,20}$/.test(messageId)) return privateReply(interaction, 'This report button is invalid.');
                    return interaction.showModal(buildReportModal(messageId));
                }
            }

            if (interaction.isModalSubmit()) {
                if (interaction.customId === SUBMIT_MODAL) {
                    await interaction.deferReply({ flags: EPHEMERAL });
                    if (!interaction.inGuild()) return privateReply(interaction, 'Confessions can only be submitted inside a server.');
                    const config = await getConfig(interaction.guildId);
                    if (!config) return privateReply(interaction, 'The confession box is not configured yet. Ask a server manager to run /confessionsetup.');
                    const channel = await fetchTextChannel(interaction.guild, config.channelId);
                    if (!channel) return privateReply(interaction, 'The confession channel is unavailable. Ask a server manager to run /confessionsetup again.');
                    const body = interaction.fields.getTextInputValue('body').trim();
                    const topic = interaction.fields.getTextInputValue('topic').trim();
                    if (body.length < 3 || body.length > MAX_BODY) return privateReply(interaction, 'Your confession must be between 3 and 1,000 characters.');
                    const number = await nextConfessionNumber(interaction.guildId);
                    const message = await channel.send({ embeds: [buildConfessionEmbed(number, topic, body)], allowedMentions: { parse: [] } });
                    await message.edit({ components: buildConfessionActions(message.id, config.repliesEnabled !== false) });
                    return interaction.editReply({ content: '💌 Your confession #' + number + ' has been posted anonymously in ' + channel + '.' });
                }
                if (interaction.customId.startsWith(REPLY_PREFIX)) {
                    await interaction.deferReply({ flags: EPHEMERAL });
                    const messageId = interaction.customId.slice(REPLY_PREFIX.length);
                    const config = await getConfig(interaction.guildId);
                    if (!config || !config.repliesEnabled) return privateReply(interaction, 'Anonymous replies are currently unavailable.');
                    const channel = await fetchTextChannel(interaction.guild, config.channelId);
                    if (!channel) return privateReply(interaction, 'The confession channel is unavailable.');
                    const original = await channel.messages.fetch(messageId).catch(() => null);
                    if (!original) return privateReply(interaction, 'That confession is no longer available.');
                    const reply = interaction.fields.getTextInputValue('reply').trim();
                    if (!reply || reply.length > MAX_REPLY) return privateReply(interaction, 'Your reply must be between 1 and 500 characters.');
                    await original.reply({ content: '↩️ **Anonymous reply**\n' + reply, allowedMentions: { parse: [] } });
                    return interaction.editReply({ content: 'Your anonymous reply has been posted.' });
                }
                if (interaction.customId.startsWith(REPORT_PREFIX)) {
                    await interaction.deferReply({ flags: EPHEMERAL });
                    const messageId = interaction.customId.slice(REPORT_PREFIX.length);
                    const config = await getConfig(interaction.guildId);
                    if (!config || !config.reportsEnabled) return privateReply(interaction, 'Confession reporting is currently unavailable.');
                    const reviewChannel = await fetchTextChannel(interaction.guild, config.staffChannelId);
                    if (!reviewChannel) return privateReply(interaction, 'The private staff review channel is unavailable. Ask a server manager to update /confessionsetup.');
                    const confessionChannel = await fetchTextChannel(interaction.guild, config.channelId);
                    const original = confessionChannel ? await confessionChannel.messages.fetch(messageId).catch(() => null) : null;
                    if (!original) return privateReply(interaction, 'That confession is no longer available.');
                    const reason = interaction.fields.getTextInputValue('reason').trim();
                    const report = new EmbedBuilder().setColor(0xEF4444)
                        .setTitle('🚩 Anonymous confession report')
                        .setDescription('**Reason**\n' + reason)
                        .addFields(
                            { name: 'Confession', value: '#' + original.id, inline: true },
                            { name: 'Source', value: '[Jump to confession](' + original.url + ')', inline: true }
                        ).setFooter({ text: 'Reporter identity is not included in this report.' }).setTimestamp();
                    await reviewChannel.send({ embeds: [report], allowedMentions: { parse: [] } });
                    return interaction.editReply({ content: 'Thank you. Your report has been sent privately to the staff team.' });
                }
            }
        } catch (error) {
            console.error('[Starry Confessions] Interaction failed:', error);
            if (interaction.isRepliable()) {
                await privateReply(interaction, 'Starry could not complete that action. Please try again, or ask a server manager to check the bot permissions.');
            }
        }
    });

    console.log('💌 Starry Confessions module initialized.');
}

confessionModule.confessionSetupPayload = setupPayload;
confessionModule.confessPayload = confessPayload;
confessionModule.confessionPayload = confessionPayload;
confessionModule.buildPanelEmbed = buildPanelEmbed;
confessionModule.buildPanelComponents = buildPanelComponents;
confessionModule.buildConfessionEmbed = buildConfessionEmbed;
confessionModule.buildConfessionActions = buildConfessionActions;
confessionModule.buildConfessionModal = buildConfessionModal;
confessionModule.buildReplyModal = buildReplyModal;
confessionModule.buildReportModal = buildReportModal;
confessionModule.nextConfessionNumber = nextConfessionNumber;

module.exports = confessionModule;
