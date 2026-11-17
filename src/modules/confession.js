'use strict';

const mongoose = require('mongoose');
const {
    ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType, EmbedBuilder,
    MessageFlags, ModalBuilder, PermissionFlagsBits, SlashCommandBuilder,
    TextInputBuilder, TextInputStyle
} = require('discord.js');
const { routeConfessionOpenButton } = require('../utils/confessionInteraction');

const EPHEMERAL = MessageFlags.Ephemeral;
const OPEN_BUTTON = 'starry:confession:open';
const LEGACY_OPEN_BUTTON = 'confess_btn_open';
const REPLY_BUTTON = 'starry:confession:reply';
const REPORT_BUTTON = 'starry:confession:report';
const SUBMIT_MODAL = 'starry:confession:submit';
const REPLY_PREFIX = 'starry:confession:reply:';
const REPORT_PREFIX = 'starry:confession:report:';
const REPLY_SUBMIT_PREFIX = 'starry:confession:reply-submit:';
const REPORT_SUBMIT_PREFIX = 'starry:confession:report-submit:';
const MAX_BODY = 1000;
const MAX_TOPIC = 60;
const MAX_REPLY = 500;

const configSchema = new mongoose.Schema({
    guildId: { type: String, required: true, unique: true, index: true },
    channelId: { type: String, required: true },
    staffChannelId: { type: String, required: true },
    staffRoleId: { type: String, required: true },
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
    .addRoleOption(option => option.setName('staff_role')
        .setDescription('Only this role and server administrators should access reports')
        .setRequired(true))
    .toJSON();

const confessPayload = new SlashCommandBuilder()
    .setName('confess').setDescription('Open the private anonymous confession form').toJSON();
const confessionPayload = new SlashCommandBuilder()
    .setName('confession').setDescription('Open the private anonymous confession form').toJSON();

function buildPanelEmbed() {
    return new EmbedBuilder().setColor('#8B5CF6')
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

function escapeMassMentions(value) {
    return String(value ?? '')
        .replace(/@everyone/gi, '@\u200Beveryone')
        .replace(/@here/gi, '@\u200Bhere');
}

function buildConfessionEmbed(number, topic, body) {
    const safeBody = escapeMassMentions(body).trim();
    const embed = new EmbedBuilder().setColor('#A78BFA')
        .setAuthor({ name: 'ANONYMOUS CONFESSION  ·  #' + number, iconURL: 'https://cdn.discordapp.com/embed/avatars/0.png' })
        .setDescription('“' + safeBody + '”')
        .addFields({ name: '🕰️ Shared', value: '<t:' + Math.floor(Date.now() / 1000) + ':R>', inline: true })
        .setFooter({ text: 'Starry Confessions  •  Keep it kind. Keep it safe.' });
    if (topic && topic.trim()) embed.setTitle('✦ ' + topic.trim().slice(0, MAX_TOPIC));
    return embed;
}

function buildConfessionActions(repliesEnabled) {
    const buttons = [];
    if (repliesEnabled !== false) {
        buttons.push(new ButtonBuilder().setCustomId(REPLY_BUTTON)
            .setLabel('Reply anonymously').setEmoji('↩️').setStyle(ButtonStyle.Secondary));
    }
    buttons.push(new ButtonBuilder().setCustomId(REPORT_BUTTON)
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

function buildReplyModal(channelId, messageId) {
    const modal = new ModalBuilder().setCustomId(REPLY_SUBMIT_PREFIX + channelId + ':' + messageId).setTitle('Write an anonymous reply');
    const body = new TextInputBuilder().setCustomId('reply').setLabel('Your reply')
        .setPlaceholder('Respond kindly. Your account will not be shown.')
        .setStyle(TextInputStyle.Paragraph).setRequired(true).setMinLength(1).setMaxLength(MAX_REPLY);
    modal.addComponents(new ActionRowBuilder().addComponents(body));
    return modal;
}

function buildReportModal(channelId, messageId) {
    const modal = new ModalBuilder().setCustomId(REPORT_SUBMIT_PREFIX + channelId + ':' + messageId).setTitle('Report a confession');
    const reason = new TextInputBuilder().setCustomId('reason').setLabel('Why should staff review this?')
        .setPlaceholder('Harassment, personal information, threats…')
        .setStyle(TextInputStyle.Paragraph).setRequired(true).setMinLength(3).setMaxLength(500);
    modal.addComponents(new ActionRowBuilder().addComponents(reason));
    return modal;
}

async function getConfig(guildId) {
    return ConfessionConfig.findOne().where('guildId').equals(guildId).lean().exec();
}

function isDiscordSnowflake(value) {
    return typeof value === 'string' && /^\d{17,20}$/.test(value);
}

function validatePublishChannel(guild, channel, botMember) {
    if (!guild || !channel || channel.guildId !== guild.id ||
        channel.type !== ChannelType.GuildText || !channel.isTextBased?.()) {
        return { ok: false, reason: 'The confession channel must be a regular text channel in this server.' };
    }
    const permissions = botMember && channel.permissionsFor?.(botMember);
    if (!permissions ||
        !permissions.has(PermissionFlagsBits.ViewChannel) ||
        !permissions.has(PermissionFlagsBits.SendMessages) ||
        !permissions.has(PermissionFlagsBits.EmbedLinks)) {
        return { ok: false, reason: 'Starry needs View Channel, Send Messages, and Embed Links in the confession channel.' };
    }
    return { ok: true };
}

function validateStaffChannel(guild, confessionChannel, staffChannel, staffRole, botMember) {
    if (!guild || !staffChannel || staffChannel.guildId !== guild.id ||
        staffChannel.type !== ChannelType.GuildText || !staffChannel.isTextBased?.()) {
        return { ok: false, reason: 'The staff report destination must be a regular text channel in this server.' };
    }
    if (staffChannel.id === confessionChannel?.id) {
        return { ok: false, reason: 'The staff report channel must be separate from the public confession channel.' };
    }
    if (!guild.roles?.everyone || !staffRole || staffRole.guild.id !== guild.id || !botMember) {
        return { ok: false, reason: 'Starry could not verify the staff role, channel privacy, and bot permissions.' };
    }
    const everyonePermissions = staffChannel.permissionsFor?.(guild.roles.everyone);
    if (!everyonePermissions || everyonePermissions.has(PermissionFlagsBits.ViewChannel)) {
        return { ok: false, reason: '@everyone must not have View Channel permission in the staff report channel.' };
    }

    const staffRolePermissions = staffChannel.permissionsFor?.(staffRole);
    if (!staffRolePermissions || !staffRolePermissions.has(PermissionFlagsBits.ViewChannel)) {
        return { ok: false, reason: 'The selected staff role needs View Channel permission in the private report channel.' };
    }

    const botPermissions = staffChannel.permissionsFor?.(botMember);
    if (!botPermissions ||
        !botPermissions.has(PermissionFlagsBits.ViewChannel) ||
        !botPermissions.has(PermissionFlagsBits.SendMessages) ||
        !botPermissions.has(PermissionFlagsBits.EmbedLinks)) {
        return { ok: false, reason: 'Starry needs View Channel, Send Messages, and Embed Links in the private report channel.' };
    }

    const roles = guild.roles.cache?.values?.() || [];
    for (const role of roles) {
        if (role.id === guild.roles.everyone.id || role.id === staffRole.id) continue;
        if (role.permissions?.has(PermissionFlagsBits.Administrator)) continue;
        const rolePermissions = staffChannel.permissionsFor?.(role);
        if (rolePermissions?.has(PermissionFlagsBits.ViewChannel)) {
            return { ok: false, reason: 'Another non-staff role can view the report channel. Remove its View Channel access or select a dedicated staff-only channel.' };
        }
    }

    const overwrites = staffChannel.permissionOverwrites?.cache?.values?.() || [];
    for (const overwrite of overwrites) {
        const grantsView = overwrite.allow?.has?.(PermissionFlagsBits.ViewChannel);
        if (!grantsView) continue;
        const isEveryone = overwrite.id === guild.roles.everyone.id;
        const isStaffRole = overwrite.id === staffRole.id;
        const isBot = overwrite.id === botMember.id;
        if (!isEveryone && !isStaffRole && !isBot && overwrite.type === 1) {
            return { ok: false, reason: 'A direct member permission grants access to the report channel. Remove non-staff member access.' };
        }
    }
    return { ok: true };
}

function isConfessionMessage(message, botUserId) {
    if (!message || !botUserId || message.author?.id !== botUserId) return false;
    const author = message.embeds?.[0]?.author?.name || '';
    return /^(?:ANONYMOUS CONFESSION|CONFESSION)\s*[·•]\s*#\d+/i.test(author);
}

async function getBotMember(guild) {
    if (guild.members?.me) return guild.members.me;
    return guild.members?.fetchMe ? guild.members.fetchMe().catch(() => null) : null;
}

function getButtonSource(interaction) {
    const customId = interaction.customId;
    const channelId = interaction.channelId;
    const messageId = interaction.message?.id;
    if (!isDiscordSnowflake(channelId) || !isDiscordSnowflake(messageId)) return null;

    if (customId === REPLY_BUTTON || /^confess_btn_reply_\d+$/.test(customId)) {
        return { action: 'reply', channelId, messageId };
    }
    if (customId === REPORT_BUTTON || /^confess_btn_report_\d+$/.test(customId)) {
        return { action: 'report', channelId, messageId };
    }
    const oldReply = customId.match(/^starry:confession:reply:(\d{17,20})$/);
    if (oldReply && oldReply[1] === messageId) return { action: 'reply', channelId, messageId };
    const oldReport = customId.match(/^starry:confession:report:(\d{17,20})$/);
    if (oldReport && oldReport[1] === messageId) return { action: 'report', channelId, messageId };
    return null;
}

function getModalSource(customId, kind, config) {
    if (kind === 'reply') {
        const current = customId.match(/^starry:confession:reply-submit:(\d{17,20}):(\d{17,20})$/);
        if (current) return { channelId: current[1], messageId: current[2] };
        const previous = customId.match(/^starry:confession:reply:(\d{17,20})$/);
        if (previous && config?.channelId) return { channelId: config.channelId, messageId: previous[1] };
    } else {
        const current = customId.match(/^starry:confession:report-submit:(\d{17,20}):(\d{17,20})$/);
        if (current) return { channelId: current[1], messageId: current[2] };
        const previous = customId.match(/^starry:confession:report:(\d{17,20})$/);
        if (previous && config?.channelId) return { channelId: config.channelId, messageId: previous[1] };
    }
    return null;
}

async function fetchConfessionMessage(guild, config, channelId, messageId) {
    if (!isDiscordSnowflake(channelId) || !isDiscordSnowflake(messageId) ||
        channelId !== config.channelId) return null;
    const channel = await fetchTextChannel(guild, channelId);
    if (!channel) return null;
    const message = await channel.messages.fetch(messageId).catch(() => null);
    return isConfessionMessage(message, guild.client?.user?.id) ? { channel, message } : null;
}

function getTextInputValue(interaction, candidateIds) {
    for (const candidate of candidateIds) {
        try {
            return interaction.fields.getTextInputValue(candidate);
        } catch (error) {
            // Older confession modals used different field identifiers.
        }
    }
    return '';
}

async function nextConfessionNumber(guildId) {
    const counter = await ConfessionCounter.findOneAndUpdate(
        { guildId }, { $inc: { value: 1 }, $setOnInsert: { guildId } },
        { new: true, upsert: true, setDefaultsOnInsert: true }
    ).lean().exec();
    return counter.value;
}

async function fetchTextChannel(guild, channelId) {
    if (!isDiscordSnowflake(channelId)) return null;
    const channel = guild.channels.cache.get(channelId) ||
        await guild.channels.fetch(channelId).catch(() => null);
    return channel && channel.guildId === guild.id &&
        channel.type === ChannelType.GuildText && channel.isTextBased() ? channel : null;
}

async function privateReply(interaction, content) {
    const payload = { content, flags: EPHEMERAL, allowedMentions: { parse: [] } };
    if (interaction.deferred || interaction.replied) return interaction.editReply(payload).catch(() => null);
    return interaction.reply(payload).catch(() => null);
}

function registerWorkerInteractionHook(client, manager) {
    if (!client || client.isPrimary === false || client.__starryConfessionWorkerHookRegistered) return false;
    const multiBot = manager || client.multiBot || require('./multiBot');
    if (!multiBot || typeof multiBot.registerEventHook !== 'function') return false;

    client.__starryConfessionWorkerHookRegistered = true;
    multiBot.registerEventHook(workerClient => confessionModule(workerClient));
    return true;
}

function confessionModule(client) {
    if (!client) return;
    registerWorkerInteractionHook(client);
    if (client.__starryConfessionHandlerInstalled) return;
    client.__starryConfessionHandlerInstalled = true;

    client.on('interactionCreate', async interaction => {
        if (interaction?.__starryConfessionOpenHandled) return;
        let publishedConfessionNumber = null;
        let guild = interaction.guild || null;
        const resolveGuild = async () => {
            if (guild || !interaction.guildId) return guild;
            guild = await client.guilds.fetch(interaction.guildId).catch(() => null);
            return guild;
        };
        try {
            if (!interaction.guildId) {
                if (interaction.isChatInputCommand?.() && ['confessionsetup', 'confess', 'confession'].includes(interaction.commandName)) {
                    return await privateReply(interaction, 'Confessions are available inside a server only.');
                }
                if (interaction.isButton?.() || interaction.isModalSubmit?.()) {
                    return await privateReply(interaction, 'Confessions are available inside a server only.');
                }
                return;
            }
            if (interaction.isChatInputCommand()) {
                if (interaction.commandName === 'confessionsetup') {
                    if (!interaction.deferred && !interaction.replied) await interaction.deferReply({ flags: EPHEMERAL });
                    guild = await resolveGuild();
                    if (!guild) return await interaction.editReply({ content: 'I could not access this server. Please try again.' });
                    const channel = interaction.options.getChannel('channel', true);
                    const staffChannel = interaction.options.getChannel('staff_channel', true);
                    const staffRole = interaction.options.getRole('staff_role', true);
                    if (channel.guildId !== interaction.guildId || staffChannel.guildId !== interaction.guildId || staffRole.guild.id !== interaction.guildId) {
                        return await interaction.editReply({ content: 'Both channels must belong to this server.' });
                    }
                    const botMember = await getBotMember(guild);
                    const publicValidation = validatePublishChannel(guild, channel, botMember);
                    if (!publicValidation.ok) return await interaction.editReply({ content: '⚠️ ' + publicValidation.reason });
                    const staffValidation = validateStaffChannel(guild, channel, staffChannel, staffRole, botMember);
                    if (!staffValidation.ok) return await interaction.editReply({ content: '⚠️ ' + staffValidation.reason });

                    const panelMessage = await channel.send({
                        embeds: [buildPanelEmbed()],
                        components: buildPanelComponents(),
                        allowedMentions: { parse: [] }
                    });
                    try {
                        await ConfessionConfig.findOneAndUpdate(
                            { guildId: interaction.guildId },
                            {
                                $set: { channelId: channel.id, staffChannelId: staffChannel.id, staffRoleId: staffRole.id },
                                $setOnInsert: { guildId: interaction.guildId }
                            },
                            { upsert: true, new: true, setDefaultsOnInsert: true }
                        ).exec();
                    } catch (saveError) {
                        await panelMessage.delete().catch(() => null);
                        throw saveError;
                    }
                    return await interaction.editReply({
                        content: '💌 Confession panel posted in ' + channel +
                            '. Reports are restricted to ' + staffRole + ' and server administrators in ' + staffChannel + '.'
                    });
                }
                if (interaction.commandName === 'confess' || interaction.commandName === 'confession') {
                    if (!interaction.inGuild()) return await privateReply(interaction, 'Confessions can only be submitted inside a server.');
                    return await interaction.showModal(buildConfessionModal());
                }
            }

            if (interaction.isButton()) {
                if (interaction.customId === OPEN_BUTTON || interaction.customId === LEGACY_OPEN_BUTTON) {
                    return await routeConfessionOpenButton(interaction, buildConfessionModal);
                }
                const source = getButtonSource(interaction);
                if (source) {
                    if (source.action === 'reply') return await interaction.showModal(buildReplyModal(source.channelId, source.messageId));
                    return await interaction.showModal(buildReportModal(source.channelId, source.messageId));
                }
                if (interaction.customId.startsWith(REPLY_BUTTON) ||
                    interaction.customId.startsWith(REPORT_BUTTON) ||
                    interaction.customId.startsWith('confess_btn_reply_') ||
                    interaction.customId.startsWith('confess_btn_report_')) {
                    return await privateReply(interaction, 'This older confession action is no longer valid. Open the latest confession card and try again.');
                }
            }

            if (interaction.isModalSubmit()) {
                if (interaction.customId === SUBMIT_MODAL || interaction.customId === 'confess_modal_submit') {
                    await interaction.deferReply({ flags: EPHEMERAL });
                    guild = await resolveGuild();
                    if (!guild) return await privateReply(interaction, 'I could not access this server. Please try again later.');
                    const config = await getConfig(interaction.guildId);
                    if (!config) return await privateReply(interaction, 'The confession box is not configured yet. Ask a server manager to run /confessionsetup.');
                    const channel = await fetchTextChannel(guild, config.channelId);
                    if (!channel) return await privateReply(interaction, 'The confession channel is unavailable. Ask a server manager to run /confessionsetup again.');
                    const body = getTextInputValue(interaction, ['body', 'confess_input_text']).trim();
                    const topic = getTextInputValue(interaction, ['topic', 'confess_input_topic']).trim();
                    if (body.length < 3 || body.length > MAX_BODY) return await privateReply(interaction, 'Your confession must be between 3 and 1,000 characters.');
                    const number = await nextConfessionNumber(interaction.guildId);
                    await channel.send({
                        embeds: [buildConfessionEmbed(number, topic, body)],
                        components: buildConfessionActions(config.repliesEnabled !== false),
                        allowedMentions: { parse: [] }
                    });
                    publishedConfessionNumber = number;
                    return await interaction.editReply({ content: '💌 Your confession #' + number + ' has been posted anonymously in ' + channel + '.' });
                }

                if (/^confess_modal_reply_\d+$/.test(interaction.customId)) {
                    await interaction.deferReply({ flags: EPHEMERAL });
                    guild = await resolveGuild();
                    if (!guild) return await privateReply(interaction, 'I could not access this server. Please try again later.');
                    return await privateReply(interaction, 'This older reply form is no longer linked to its confession. Tap **Reply anonymously** on the latest confession card.');
                }

                if (interaction.customId.startsWith(REPLY_SUBMIT_PREFIX) ||
                    interaction.customId.startsWith(REPLY_PREFIX)) {
                    await interaction.deferReply({ flags: EPHEMERAL });
                    const config = await getConfig(interaction.guildId);
                    if (!config || !config.repliesEnabled) return await privateReply(interaction, 'Anonymous replies are currently unavailable.');
                    const source = getModalSource(interaction.customId, 'reply', config);
                    if (!source) return await privateReply(interaction, 'This reply form is invalid. Open the reply button on the confession again.');
                    const found = await fetchConfessionMessage(guild, config, source.channelId, source.messageId);
                    if (!found) return await privateReply(interaction, 'That confession is no longer available for replies.');
                    const reply = getTextInputValue(interaction, ['reply', 'confess_input_reply']).trim();
                    if (!reply || reply.length > MAX_REPLY) return await privateReply(interaction, 'Your reply must be between 1 and 500 characters.');
                    await found.message.reply({
                        content: '↩️ **Anonymous reply**\n' + reply.replace(/@everyone/gi, '@\u200Beveryone').replace(/@here/gi, '@\u200Bhere'),
                        allowedMentions: { parse: [] }
                    });
                    return await interaction.editReply({ content: 'Your anonymous reply has been posted.' });
                }

                if (interaction.customId.startsWith(REPORT_SUBMIT_PREFIX) ||
                    interaction.customId.startsWith(REPORT_PREFIX)) {
                    await interaction.deferReply({ flags: EPHEMERAL });
                    const config = await getConfig(interaction.guildId);
                    if (!config || !config.reportsEnabled) return await privateReply(interaction, 'Confession reporting is currently unavailable.');
                    const source = getModalSource(interaction.customId, 'report', config);
                    if (!source) return await privateReply(interaction, 'This report form is invalid. Open Report on the confession again.');
                    const found = await fetchConfessionMessage(guild, config, source.channelId, source.messageId);
                    if (!found) return await privateReply(interaction, 'That confession is no longer available.');
                    const reviewChannel = await fetchTextChannel(guild, config.staffChannelId);
                    const botMember = await getBotMember(guild);
                    const staffRole = guild.roles.cache.get(config.staffRoleId) ||
                        await guild.roles.fetch(config.staffRoleId).catch(() => null);
                    const staffValidation = validateStaffChannel(guild, found.channel, reviewChannel, staffRole, botMember);
                    if (!staffValidation.ok) {
                        return await privateReply(interaction, '⚠️ Staff reports are paused because the report destination is not private or Starry no longer has the required permissions. Ask a manager to rerun /confessionsetup.');
                    }
                    const reason = getTextInputValue(interaction, ['reason']).trim();
                    if (reason.length < 3 || reason.length > 500) return await privateReply(interaction, 'Please provide a report reason between 3 and 500 characters.');
                    const report = new EmbedBuilder().setColor('#EF4444')
                        .setTitle('🚩 Anonymous confession report')
                        .setDescription('**Reason**\n' + reason.replace(/@everyone/gi, '@\u200Beveryone').replace(/@here/gi, '@\u200Bhere'))
                        .addFields(
                            { name: 'Confession', value: '#' + found.message.id, inline: true },
                            { name: 'Source', value: '[Jump to confession](' + found.message.url + ')', inline: true }
                        ).setFooter({ text: 'Reporter identity is not included in this report.' }).setTimestamp();
                    await reviewChannel.send({ embeds: [report], allowedMentions: { parse: [] } });
                    return await interaction.editReply({ content: 'Thank you. Your report has been sent privately to the staff team.' });
                }
            }
        } catch (error) {
            console.error('[Starry Confessions] Interaction failed:', error);
            if (interaction.isRepliable()) {
                if (publishedConfessionNumber !== null) {
                    await privateReply(interaction, 'Your confession #' + publishedConfessionNumber + ' was published, but Starry could not update the confirmation. Do not submit it again.');
                } else {
                    await privateReply(interaction, 'Starry could not complete that action. Please try again, or ask a server manager to check the bot permissions.');
                }
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
confessionModule.validatePublishChannel = validatePublishChannel;
confessionModule.validateStaffChannel = validateStaffChannel;
confessionModule.isConfessionMessage = isConfessionMessage;
confessionModule.getButtonSource = getButtonSource;
confessionModule.getModalSource = getModalSource;
confessionModule.nextConfessionNumber = nextConfessionNumber;
confessionModule.registerWorkerInteractionHook = registerWorkerInteractionHook;

module.exports = confessionModule;
