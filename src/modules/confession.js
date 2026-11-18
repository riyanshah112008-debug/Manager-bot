'use strict';
const mongoose = require('mongoose');
const {
 ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType, EmbedBuilder,
 MessageFlags, ModalBuilder, PermissionFlagsBits, SlashCommandBuilder,
 TextInputBuilder, TextInputStyle
} = require('discord.js');
const { registerInteractionHandler } = require('../utils/interactionHandler');

const EPHEMERAL = MessageFlags.Ephemeral;
const PANEL_BUTTON = 'whisper:open';
const SUBMIT_MODAL = 'whisper:submit';
const REPORT_MODAL_PREFIX = 'whisper:report-submit:';
const REPLY_MODAL_PREFIX = 'confession:reply-submit:';
const STAFF_REMOVE_PREFIX = 'whisper:staff:remove:';
const STAFF_DISMISS_PREFIX = 'whisper:staff:dismiss:';
const LEGACY_OPEN_IDS = new Set(['starry:confession:open', 'confess_btn_open', 'confess_open_modal']);
const MAX_BODY = 1000;
const MAX_TOPIC = 60;
const MAX_REPORT_REASON = 500;

const configSchema = new mongoose.Schema({
 guildId: { type: String, required: true, unique: true, index: true },
 channelId: { type: String, required: true },
 staffChannelId: { type: String, required: true },
 staffRoleId: { type: String, required: true }
}, { timestamps: true });
const counterSchema = new mongoose.Schema({
 guildId: { type: String, required: true, unique: true, index: true },
 value: { type: Number, default: 0 }
}, { timestamps: true });
const WhisperConfig = mongoose.models.StarryConfessionConfig || mongoose.model('StarryConfessionConfig', configSchema);
const WhisperCounter = mongoose.models.StarryConfessionCounter || mongoose.model('StarryConfessionCounter', counterSchema);

const setupPayload = new SlashCommandBuilder()
 .setName('confessionsetup')
 .setDescription('Create or replace the anonymous confession panel')
 .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
 .addChannelOption(o => o.setName('channel').setDescription('Public channel for confessions').addChannelTypes(ChannelType.GuildText).setRequired(false))
 .addChannelOption(o => o.setName('staff_channel').setDescription('Private channel for staff reports (auto-created if omitted)').addChannelTypes(ChannelType.GuildText).setRequired(false))
 .addRoleOption(o => o.setName('staff_role').setDescription('Role allowed to review reports (defaults to your Manage Server/Admin role)').setRequired(false))
 .toJSON();
const confessPayload = new SlashCommandBuilder()
 .setName('confess').setDescription('Submit an anonymous confession').toJSON();

function escapeMentions(value) {
 return String(value ?? '').replace(/@everyone/gi, '@\u200Beveryone').replace(/@here/gi, '@\u200Bhere');
}
function buildPanelEmbed() {
 return new EmbedBuilder().setColor('#C83E4D').setTitle('ANONYMOUS CONFESSIONS')
  .setDescription([
   '**A place to say what you cannot say out loud.**',
   'Share a thought, a secret, or a confession anonymously.',
   '',
   'Your confession is published without your username, avatar, or profile link.',
   'Staff can review reports privately.',
   '',
   '+ Speak honestly',
   '+ Respect other people',
   '- No threats, doxxing, or targeted harassment',
   '- Never share another person’s private information'
  ].join('\n'))
  .addFields(
   { name: '01  /  PRIVATE SUBMISSION', value: 'The form is visible only to you. Your account is not shown on the published post.', inline: true },
   { name: '02  /  COMMUNITY SAFETY', value: 'Every confession can be reported. Reports go to a private staff channel.', inline: true }
  ).setFooter({ text: 'STARRY  •  ANONYMOUS CONFESSIONS  •  Keep it kind' }).setTimestamp();
}
function buildPanelComponents() {
 return [new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId(PANEL_BUTTON).setLabel('Submit Confession').setEmoji('✉️').setStyle(ButtonStyle.Danger))];
}
function buildSubmissionModal() {
 const modal = new ModalBuilder().setCustomId(SUBMIT_MODAL).setTitle('Submit a Confession');
 const topic = new TextInputBuilder().setCustomId('topic').setLabel('A short title (optional)').setPlaceholder('A thought, a memory, a confession…').setStyle(TextInputStyle.Short).setRequired(false).setMaxLength(MAX_TOPIC);
 const body = new TextInputBuilder().setCustomId('body').setLabel('What would you like to say?').setPlaceholder('Write your words here. Do not include private identifying details.').setStyle(TextInputStyle.Paragraph).setRequired(true).setMinLength(3).setMaxLength(MAX_BODY);
 modal.addComponents(new ActionRowBuilder().addComponents(topic), new ActionRowBuilder().addComponents(body));
 return modal;
}
function buildReplyModal(messageId) {
 const modal = new ModalBuilder().setCustomId(REPLY_MODAL_PREFIX + messageId).setTitle('Reply anonymously');
 const body = new TextInputBuilder().setCustomId('body').setLabel('Your anonymous reply').setPlaceholder('Write a thoughtful, respectful reply…').setStyle(TextInputStyle.Paragraph).setRequired(true).setMinLength(2).setMaxLength(MAX_BODY);
 modal.addComponents(new ActionRowBuilder().addComponents(body));
 return modal;
}
function buildReportModal(messageId) {
 const modal = new ModalBuilder().setCustomId(REPORT_MODAL_PREFIX + messageId).setTitle('Flag a confession for review');
 const reason = new TextInputBuilder().setCustomId('reason').setLabel('Why should the staff review this?').setPlaceholder('Harassment, threats, private information, or another concern…').setStyle(TextInputStyle.Paragraph).setRequired(true).setMinLength(3).setMaxLength(MAX_REPORT_REASON);
 modal.addComponents(new ActionRowBuilder().addComponents(reason));
 return modal;
}
function buildConfessionEmbed(number, topic, body) {
 const embed = new EmbedBuilder().setColor('#C83E4D')
  .setAuthor({ name: 'ANONYMOUS CONFESSION' })
  .setTitle('CONFESSION  #' + String(number).padStart(4, '0'))
  .setDescription('> ' + escapeMentions(body).trim().replace(/\n/g, '\n> '))
  .addFields({ name: 'STATUS', value: 'Published anonymously', inline: true })
  .setFooter({ text: 'STARRY  •  ANONYMOUS CONFESSIONS' }).setTimestamp();
 if (topic && topic.trim()) embed.addFields({ name: 'SUBJECT', value: escapeMentions(topic.trim()).slice(0, MAX_TOPIC), inline: true });
 return embed;
}
function buildReportEmbed(number, reason, messageUrl) {
 return new EmbedBuilder().setColor('#D64545').setTitle('ANONYMOUS CONFESSIONS  /  STAFF REVIEW')
  .setDescription('A community member flagged a published confession for review.')
  .addFields(
   { name: 'CONFESSION', value: '#' + String(number).padStart(4, '0'), inline: true },
   { name: 'REASON', value: escapeMentions(reason).slice(0, MAX_REPORT_REASON) },
   { name: 'SOURCE', value: '[Open published confession](' + messageUrl + ')' }
  ).setFooter({ text: 'Private staff notice  •  Reporter identity is not displayed or stored' }).setTimestamp();
}
function buildConfessionComponents() {
 return [new ActionRowBuilder().addComponents(
  new ButtonBuilder().setCustomId('confession:reply').setLabel('Reply').setEmoji('💬').setStyle(ButtonStyle.Primary),
  new ButtonBuilder().setCustomId(PANEL_BUTTON).setLabel('New Confession').setEmoji('✍️').setStyle(ButtonStyle.Success),
  new ButtonBuilder().setCustomId('whisper:report').setLabel('Report').setEmoji('🚩').setStyle(ButtonStyle.Secondary)
 )];
}
function buildReplyEmbed(number, body) {
 return new EmbedBuilder().setColor('#5865F2').setAuthor({ name: 'ANONYMOUS REPLY' })
  .setTitle('CONFESSION  #' + String(number).padStart(4, '0') + '  •  ANONYMOUS REPLY')
  .setDescription('> ' + escapeMentions(body).trim().replace(/\n/g, '\n> '))
  .setFooter({ text: 'STARRY  •  ANONYMOUS CONFESSIONS' }).setTimestamp();
}
function buildStaffComponents(messageId) {
 return [new ActionRowBuilder().addComponents(
  new ButtonBuilder().setCustomId(STAFF_REMOVE_PREFIX + messageId).setLabel('Remove confession').setEmoji('🗑️').setStyle(ButtonStyle.Danger),
  new ButtonBuilder().setCustomId(STAFF_DISMISS_PREFIX + messageId).setLabel('Dismiss report').setEmoji('✓').setStyle(ButtonStyle.Secondary)
 )];
}
function isSnowflake(value) { return typeof value === 'string' && /^\d{17,20}$/.test(value); }
async function getConfig(guildId) { return WhisperConfig.findOne({ guildId }).lean().exec(); }
async function nextNumber(guildId) {
 const record = await WhisperCounter.findOneAndUpdate({ guildId }, { $inc: { value: 1 }, $setOnInsert: { guildId } }, { new: true, upsert: true, setDefaultsOnInsert: true }).lean().exec();
 return record.value;
}
async function getGuild(interaction, client) { return interaction.guild || client.guilds.fetch(interaction.guildId); }
async function getTextChannel(guild, channelId) {
 if (!isSnowflake(channelId)) return null;
 const channel = guild.channels.cache.get(channelId) || await guild.channels.fetch(channelId).catch(() => null);
 return channel && channel.guildId === guild.id && channel.type === ChannelType.GuildText && channel.isTextBased() ? channel : null;
}
async function getBotMember(guild) { return guild.members.me || guild.members.fetchMe().catch(() => null); }
function validateChannels(guild, publicChannel, staffChannel, staffRole, botMember) {
 if (!publicChannel || publicChannel.guildId !== guild.id || publicChannel.type !== ChannelType.GuildText) return 'Choose a regular text channel in this server for public confessions.';
 if (!staffChannel || staffChannel.guildId !== guild.id || staffChannel.type !== ChannelType.GuildText || staffChannel.id === publicChannel.id) return 'The private staff channel must be a different text channel in this server.';
 if (!staffRole || staffRole.guild.id !== guild.id || !botMember) return 'Starry could not verify the staff role or its own server permissions.';
 const pub = publicChannel.permissionsFor(botMember);
 if (!pub?.has(PermissionFlagsBits.ViewChannel) || !pub.has(PermissionFlagsBits.SendMessages) || !pub.has(PermissionFlagsBits.EmbedLinks) || !pub.has(PermissionFlagsBits.ReadMessageHistory)) return 'Starry needs View Channel, Send Messages, Embed Links, and Read Message History in the public channel.';
 const everyone = staffChannel.permissionsFor(guild.roles.everyone);
 const staff = staffChannel.permissionsFor(staffRole);
 const bot = staffChannel.permissionsFor(botMember);
 if (!everyone || everyone.has(PermissionFlagsBits.ViewChannel) || !staff?.has(PermissionFlagsBits.ViewChannel)) return 'The staff channel must be hidden from @everyone and visible to the selected staff role.';
 for (const role of guild.roles.cache.values()) {
  if (role.id === guild.roles.everyone.id || role.id === staffRole.id || role.permissions.has(PermissionFlagsBits.Administrator) || (role.managed && botMember.roles.cache.has(role.id))) continue;
  const permissions = staffChannel.permissionsFor(role);
  if (permissions?.has(PermissionFlagsBits.ViewChannel)) return 'Another non-staff role can view the report channel. Remove its View Channel access first.';
 }
 for (const overwrite of staffChannel.permissionOverwrites.cache.values()) {
  if (overwrite.type === 1 && overwrite.id !== botMember.id && overwrite.allow.has(PermissionFlagsBits.ViewChannel)) return 'A direct member permission grants access to the report channel. Remove non-staff member access.';
 }
 if (!bot?.has(PermissionFlagsBits.ViewChannel) || !bot.has(PermissionFlagsBits.SendMessages) || !bot.has(PermissionFlagsBits.EmbedLinks)) return 'Starry needs View Channel, Send Messages, and Embed Links in the staff channel.';
 return null;
}
function isStaffChannelPermissionIssue(message) {
 return typeof message === 'string' && (
  message.includes('staff channel must be hidden') ||
  message.includes('Another non-staff role can view') ||
  message.includes('direct member permission grants access') ||
  message.includes('Starry needs View Channel, Send Messages, and Embed Links in the staff channel')
 );
}
function isWhisperPost(message, botUserId) {
 const title = message?.embeds?.[0]?.title || '';
 return Boolean(message && message.author?.id === botUserId && /^CONFESSION\s+#\d{4,}$/i.test(title));
}
async function replyPrivate(interaction, content) {
 const payload = { content, allowedMentions: { parse: [] } };
 if (interaction.deferred || interaction.replied) return interaction.editReply(payload).catch(() => null);
 return interaction.reply({ ...payload, flags: EPHEMERAL }).catch(() => null);
}
function chooseFallbackStaffRole(guild, member) {
 const memberRoles = member?.roles?.cache;
 if (!memberRoles) return null;
 const candidates = Array.from(memberRoles.values()).filter(role =>
  role.id !== guild.roles.everyone.id &&
  (role.permissions.has(PermissionFlagsBits.Administrator) || role.permissions.has(PermissionFlagsBits.ManageGuild))
 );
 candidates.sort((a, b) => {
  const adminDifference = Number(b.permissions.has(PermissionFlagsBits.Administrator)) -
   Number(a.permissions.has(PermissionFlagsBits.Administrator));
  return adminDifference || b.position - a.position;
 });
 return candidates[0] || null;
}

async function createPrivateStaffChannel(guild, publicChannel, staffRole, botMember) {
 if (!botMember.permissions?.has(PermissionFlagsBits.ManageChannels)) {
  throw new Error('Starry needs Manage Channels to create the private staff report channel. Select an existing staff_channel option instead.');
 }
 return guild.channels.create({
  name: 'anonymous-confessions-staff',
  type: ChannelType.GuildText,
  parent: publicChannel.parentId || undefined,
  topic: 'Private staff-only reports for Starry Confessions',
  permissionOverwrites: [
   { id: guild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] },
   { id: staffRole.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory, PermissionFlagsBits.EmbedLinks] },
   { id: botMember.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory, PermissionFlagsBits.EmbedLinks] }
  ],
  reason: 'Create private staff review channel for Starry Confessions'
 });
}

async function handleSetup(interaction, client) {
 await interaction.deferReply({ flags: EPHEMERAL });
 const guild = await getGuild(interaction, client).catch(() => null);
 if (!guild) return replyPrivate(interaction, 'I could not access this server. Please try again.');

 const currentConfig = await getConfig(guild.id).catch(() => null);
 const publicChannel = interaction.options.getChannel('channel') || interaction.channel;
 if (!publicChannel || publicChannel.guildId !== guild.id || publicChannel.type !== ChannelType.GuildText) {
  return replyPrivate(interaction, 'Choose a regular text channel for public confessions, or run /confessionsetup inside a text channel.');
 }

 const botMember = await getBotMember(guild);
 if (!botMember) return replyPrivate(interaction, 'Starry could not resolve its own server member. Please try again after the bot reconnects.');
 const invokingMember = guild.members.cache.get(interaction.user.id) ||
  await guild.members.fetch(interaction.user.id).catch(() => null);
 const staffRole = interaction.options.getRole('staff_role') ||
  (currentConfig?.staffRoleId ? guild.roles.cache.get(currentConfig.staffRoleId) : null) ||
  chooseFallbackStaffRole(guild, invokingMember);
 if (!staffRole) {
  return replyPrivate(interaction, 'Select a staff_role with Manage Server or Administrator permission. Starry could not safely choose a staff role automatically.');
 }

 let staffChannel = interaction.options.getChannel('staff_channel') || null;
 if (!staffChannel && currentConfig?.staffChannelId) {
  staffChannel = await getTextChannel(guild, currentConfig.staffChannelId);
 }

 let createdStaffChannel = false;
 if (!staffChannel) {
  try {
   staffChannel = await createPrivateStaffChannel(guild, publicChannel, staffRole, botMember);
   createdStaffChannel = true;
  } catch (error) {
   return replyPrivate(interaction, '⚠️ ' + (error?.message || 'Starry could not create the private staff channel.'));
  }
 }

 let validation = validateChannels(guild, publicChannel, staffChannel, staffRole, botMember);
 // Never let unsafe report-channel overwrites block the public panel. Create a separate locked staff channel instead.
 if (validation && isStaffChannelPermissionIssue(validation)) {
  try {
   const replacement = await createPrivateStaffChannel(guild, publicChannel, staffRole, botMember);
   if (createdStaffChannel && staffChannel.id !== replacement.id) await staffChannel.delete().catch(() => null);
   staffChannel = replacement;
   createdStaffChannel = true;
   validation = validateChannels(guild, publicChannel, staffChannel, staffRole, botMember);
  } catch (error) {
   if (createdStaffChannel) await staffChannel.delete().catch(() => null);
   return replyPrivate(interaction, '⚠️ The selected report channel has unsafe permissions. Starry could not create a separate locked staff channel: ' + (error?.message || 'unknown error') + '. Grant Starry Manage Channels or select a private report channel.');
  }
 }
 if (validation) {
  if (createdStaffChannel) await staffChannel.delete().catch(() => null);
  return replyPrivate(interaction, '⚠️ ' + validation);
 }

 let panel;
 try {
  panel = await publicChannel.send({
   embeds: [buildPanelEmbed()],
   components: buildPanelComponents(),
   allowedMentions: { parse: [] }
  });
  await WhisperConfig.findOneAndUpdate(
   { guildId: guild.id },
   {
    $set: { channelId: publicChannel.id, staffChannelId: staffChannel.id, staffRoleId: staffRole.id },
    $setOnInsert: { guildId: guild.id }
   },
   { upsert: true, new: true, setDefaultsOnInsert: true }
  ).exec();
 } catch (error) {
  if (panel) await panel.delete().catch(() => null);
  if (createdStaffChannel) await staffChannel.delete().catch(() => null);
  throw error;
 }

 return replyPrivate(interaction,
  'Confessions is ready in ' + publicChannel.toString() +
  '. Private staff reports will be delivered to ' + staffChannel.toString() +
  ' for ' + staffRole.toString() + '.');
}
async function handleSubmission(interaction) {
 await interaction.deferReply({ flags: EPHEMERAL });
 const config = await getConfig(interaction.guildId);
 if (!config) return replyPrivate(interaction, 'Confessions are not configured. Ask a manager to run /confessionsetup.');
 const guild = await getGuild(interaction, interaction.client).catch(() => null);
 if (!guild) return replyPrivate(interaction, 'I could not access this server. Please try again later.');
 const channel = await getTextChannel(guild, config.channelId);
 if (!channel) return replyPrivate(interaction, 'The public confession channel is unavailable. Ask a manager to run /confessionsetup again.');
 const body = interaction.fields.getTextInputValue('body').trim();
 const topic = interaction.fields.getTextInputValue('topic').trim();
 if (body.length < 3 || body.length > MAX_BODY) return replyPrivate(interaction, 'Your confession must contain between 3 and 1,000 characters.');
 const number = await nextNumber(guild.id);
 await channel.send({ embeds: [buildConfessionEmbed(number, topic, body)], components: buildConfessionComponents(), allowedMentions: { parse: [] } });
 return replyPrivate(interaction, 'Your confession **#' + String(number).padStart(4, '0') + '** has been published anonymously in ' + channel.toString() + '.');
}
async function handleReply(interaction, client, messageId) {
 await interaction.deferReply({ flags: EPHEMERAL });
 if (!isSnowflake(messageId)) return replyPrivate(interaction, 'This reply button is invalid. Open it from a current confession.');
 const config = await getConfig(interaction.guildId);
 if (!config) return replyPrivate(interaction, 'Confessions are not configured.');
 const guild = await getGuild(interaction, client).catch(() => null);
 if (!guild) return replyPrivate(interaction, 'I could not access this server.');
 const channel = await getTextChannel(guild, config.channelId);
 if (!channel) return replyPrivate(interaction, 'The confession channel is unavailable. Ask a manager to run /confessionsetup again.');
 const source = await channel.messages.fetch(messageId).catch(() => null);
 if (!isWhisperPost(source, client.user.id)) return replyPrivate(interaction, 'That confession is no longer available for replies.');
 const body = interaction.fields.getTextInputValue('body').trim();
 if (body.length < 2 || body.length > MAX_BODY) return replyPrivate(interaction, 'Your reply must contain between 2 and 1,000 characters.');
 const number = Number((source.embeds[0].title.match(/#(\\d+)/) || [])[1]);
 await channel.send({ embeds: [buildReplyEmbed(number, body)], components: buildConfessionComponents(), allowedMentions: { parse: [] } });
 return replyPrivate(interaction, 'Your anonymous reply has been published.');
}
async function handleReport(interaction, client, messageId) {
 await interaction.deferReply({ flags: EPHEMERAL });
 if (!isSnowflake(messageId)) return replyPrivate(interaction, 'This report button is invalid. Use the button on a current confession.');
 const config = await getConfig(interaction.guildId);
 if (!config) return replyPrivate(interaction, 'Confessions are not configured.');
 const guild = await getGuild(interaction, client).catch(() => null);
 if (!guild) return replyPrivate(interaction, 'I could not access this server.');
 const publicChannel = await getTextChannel(guild, config.channelId);
 const staffChannel = await getTextChannel(guild, config.staffChannelId);
 if (!publicChannel) return replyPrivate(interaction, 'The public confession channel is unavailable. Ask a manager to rerun /confessionsetup.');
 if (!staffChannel) return replyPrivate(interaction, 'The private staff report channel is unavailable. Ask a manager to rerun /confessionsetup.');
 const staffRole = guild.roles.cache.get(config.staffRoleId) || await guild.roles.fetch(config.staffRoleId).catch(() => null);
 const botMember = await getBotMember(guild);
 const privacyError = validateChannels(guild, publicChannel, staffChannel, staffRole, botMember);
 if (privacyError) return replyPrivate(interaction, '⚠️ Reports are paused because the configured destinations are no longer safe: ' + privacyError + ' Ask a manager to rerun /confessionsetup.');
 const message = await publicChannel.messages.fetch(messageId).catch(() => null);
 if (!isWhisperPost(message, client.user.id)) return replyPrivate(interaction, 'That confession is no longer available for review.');
 const reason = interaction.fields.getTextInputValue('reason').trim();
 if (reason.length < 3 || reason.length > MAX_REPORT_REASON) return replyPrivate(interaction, 'Please provide a reason between 3 and 500 characters.');
 const number = Number((message.embeds[0].title.match(/#(\d+)/) || [])[1]);
 await staffChannel.send({ embeds: [buildReportEmbed(number, reason, message.url)], components: buildStaffComponents(message.id), allowedMentions: { parse: [] } });
 return replyPrivate(interaction, 'Your report has been delivered privately to the staff team. Thank you.');
}
async function handleStaffAction(interaction, client, action, messageId) {
 await interaction.deferReply({ flags: EPHEMERAL });
 const config = await getConfig(interaction.guildId);
 if (!config) return replyPrivate(interaction, 'Confessions is not configured.');
 if (interaction.channelId !== config.staffChannelId) return replyPrivate(interaction, 'Staff review actions only work inside the configured private report channel.');

 const isAdmin = interaction.memberPermissions?.has(PermissionFlagsBits.Administrator);
 const memberRoles = interaction.member?.roles;
 const hasStaffRole = memberRoles?.cache?.has ? memberRoles.cache.has(config.staffRoleId) : Array.isArray(memberRoles) && memberRoles.includes(config.staffRoleId);
 if (!isAdmin && !hasStaffRole) return replyPrivate(interaction, 'Only the configured staff role or server administrators can use this action.');

 const guild = await getGuild(interaction, client).catch(() => null);
 if (!guild) return replyPrivate(interaction, 'I could not access this server.');
 const channel = await getTextChannel(guild, config.channelId);
 const staffChannel = await getTextChannel(guild, config.staffChannelId);
 const staffRole = guild.roles.cache.get(config.staffRoleId) || await guild.roles.fetch(config.staffRoleId).catch(() => null);
 const botMember = await getBotMember(guild);
 if (!channel || !staffChannel) return replyPrivate(interaction, 'Staff actions are paused because the configured channels are unavailable. Ask a manager to rerun /confessionsetup.');
 const privacyError = validateChannels(guild, channel, staffChannel, staffRole, botMember);
 if (privacyError) return replyPrivate(interaction, 'Staff actions are paused because the configured destinations are no longer safe: ' + privacyError + ' Ask a manager to rerun /confessionsetup.');

 if (action === 'dismiss') {
  try {
   if (interaction.message) {
    await interaction.message.edit({ content: '✓ Report reviewed and dismissed.', embeds: [], components: [] });
   }
  } catch (_) {
   return replyPrivate(interaction, 'The report could not be updated. Please try again or remove its report card manually.');
  }
  return replyPrivate(interaction, 'The report has been dismissed.');
 }

 if (!isSnowflake(messageId)) return replyPrivate(interaction, 'This staff action is invalid.');
 const confession = await channel.messages.fetch(messageId).catch(() => null);
 if (!isWhisperPost(confession, client.user.id)) return replyPrivate(interaction, 'The original confession is already unavailable.');
 // Starry is deleting its own post, so Manage Messages is not required.
 await confession.delete();
 try {
  if (interaction.message) {
   await interaction.message.edit({ content: '🗑️ Confession removed by staff.', embeds: [], components: [] });
  }
 } catch (_) {
  return replyPrivate(interaction, 'The confession was removed, but the report card could not be updated. Staff can manually close that report.');
 }
 return replyPrivate(interaction, 'The confession has been removed.');
}
function createInteractionHandler(client) {
 return async interaction => {
  if (!interaction?.guildId) return;
  try {
   if (interaction.isChatInputCommand()) {
    if (interaction.commandName === 'confessionsetup') return await handleSetup(interaction, client);
    if (interaction.commandName === 'confess') return await interaction.showModal(buildSubmissionModal());
    return;
   }
   if (interaction.isButton()) {
    const id = interaction.customId;
    if (id === PANEL_BUTTON || LEGACY_OPEN_IDS.has(id)) return await interaction.showModal(buildSubmissionModal());
    if (id === 'confession:reply') return await interaction.showModal(buildReplyModal(interaction.message?.id));
    if (id === 'whisper:report') return await interaction.showModal(buildReportModal(interaction.message?.id));
    if (id.startsWith(STAFF_REMOVE_PREFIX)) return await handleStaffAction(interaction, client, 'remove', id.slice(STAFF_REMOVE_PREFIX.length));
    if (id.startsWith(STAFF_DISMISS_PREFIX)) return await handleStaffAction(interaction, client, 'dismiss', id.slice(STAFF_DISMISS_PREFIX.length));
    return;
   }
   if (interaction.isModalSubmit()) {
    if (interaction.customId === SUBMIT_MODAL) return await handleSubmission(interaction);
    if (interaction.customId.startsWith(REPORT_MODAL_PREFIX)) return await handleReport(interaction, client, interaction.customId.slice(REPORT_MODAL_PREFIX.length));
    if (interaction.customId.startsWith(REPLY_MODAL_PREFIX)) return await handleReply(interaction, client, interaction.customId.slice(REPLY_MODAL_PREFIX.length));
   }
  } catch (error) {
   console.error('[Confessions] Action failed:', error?.message || error);
   if (interaction.isRepliable?.()) await replyPrivate(interaction, 'Confessions could not complete that action. Please try again or contact a server manager.');
  }
 };
}
function registerWorkerHook(client, manager) {
 if (!client || client.isPrimary === false || client.__starryWhisperWorkerHookRegistered) return false;
 const multiBot = manager || client.multiBot || require('./multiBot');
 if (!multiBot || typeof multiBot.registerEventHook !== 'function') return false;
 client.__starryWhisperWorkerHookRegistered = true;
 multiBot.registerEventHook(workerClient => whisperModule(workerClient));
 return true;
}
function whisperModule(client) {
 if (!client || client.__starryWhisperHandlerInstalled) return;
 registerWorkerHook(client);
 registerInteractionHandler(client, 'anonymous-confessions', createInteractionHandler(client), { priority: 1000 });
 client.__starryWhisperHandlerInstalled = true;
 console.log('✉️ Starry Anonymous Confessions initialized.');
}
whisperModule.setupPayload = setupPayload;
whisperModule.confessPayload = confessPayload;
whisperModule.buildPanelEmbed = buildPanelEmbed;
whisperModule.buildPanelComponents = buildPanelComponents;
whisperModule.buildSubmissionModal = buildSubmissionModal;
whisperModule.buildReportModal = buildReportModal;
whisperModule.buildReplyModal = buildReplyModal;
whisperModule.buildConfessionEmbed = buildConfessionEmbed;
whisperModule.buildReportEmbed = buildReportEmbed;
whisperModule.buildConfessionComponents = buildConfessionComponents;
whisperModule.buildReplyEmbed = buildReplyEmbed;
whisperModule.buildStaffComponents = buildStaffComponents;
whisperModule.isWhisperPost = isWhisperPost;
whisperModule.validateChannels = validateChannels;
whisperModule.isStaffChannelPermissionIssue = isStaffChannelPermissionIssue;
whisperModule.createInteractionHandler = createInteractionHandler;
whisperModule.registerWorkerHook = registerWorkerHook;
module.exports = whisperModule;
