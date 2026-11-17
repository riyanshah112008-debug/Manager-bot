'use strict';
const mongoose = require('mongoose');
const {
 ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType, EmbedBuilder,
 MessageFlags, ModalBuilder, PermissionFlagsBits, SlashCommandBuilder,
 TextInputBuilder, TextInputStyle
} = require('discord.js');

const EPHEMERAL = MessageFlags.Ephemeral;
const PANEL_BUTTON = 'whisper:open';
const SUBMIT_MODAL = 'whisper:submit';
const REPORT_MODAL_PREFIX = 'whisper:report-submit:';
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
 .setDescription('Create or replace the anonymous Whisper Vault panel')
 .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
 .addChannelOption(o => o.setName('channel').setDescription('Public channel for confessions').addChannelTypes(ChannelType.GuildText).setRequired(true))
 .addChannelOption(o => o.setName('staff_channel').setDescription('Private channel for staff reports').addChannelTypes(ChannelType.GuildText).setRequired(true))
 .addRoleOption(o => o.setName('staff_role').setDescription('Role allowed to review reports').setRequired(true))
 .toJSON();
const confessPayload = new SlashCommandBuilder()
 .setName('confess').setDescription('Open the private Whisper Vault submission form').toJSON();

function escapeMentions(value) {
 return String(value ?? '').replace(/@everyone/gi, '@\u200Beveryone').replace(/@here/gi, '@\u200Bhere');
}
function buildPanelEmbed() {
 return new EmbedBuilder().setColor('#C83E4D').setTitle('WHISPER VAULT')
  .setDescription([
   '**A place for the things you never say out loud.**',
   'Leave a thought, a secret, a confession, or a weight you need to put down.',
   '',
   'Your post appears without your username, avatar, or profile link.',
   'Submissions are private to you until published.',
   '',
   '+ Speak honestly',
   '+ Respect other people',
   '- No threats, doxxing, or targeted harassment',
   '- Never share another person’s private information'
  ].join('\n'))
  .addFields(
   { name: '01  /  PRIVATE SUBMISSION', value: 'The form is visible only to you. Your account is not shown on the published post.', inline: true },
   { name: '02  /  COMMUNITY SAFETY', value: 'Every confession can be reported. Reports go to a private staff channel.', inline: true }
  ).setFooter({ text: 'STARRY  •  WHISPER VAULT  •  Anonymous words, responsible community' }).setTimestamp();
}
function buildPanelComponents() {
 return [new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId(PANEL_BUTTON).setLabel('Open Whisper Vault').setEmoji('✉️').setStyle(ButtonStyle.Danger))];
}
function buildSubmissionModal() {
 const modal = new ModalBuilder().setCustomId(SUBMIT_MODAL).setTitle('Whisper to the Vault');
 const topic = new TextInputBuilder().setCustomId('topic').setLabel('A short title (optional)').setPlaceholder('A thought, a memory, a confession…').setStyle(TextInputStyle.Short).setRequired(false).setMaxLength(MAX_TOPIC);
 const body = new TextInputBuilder().setCustomId('body').setLabel('What would you like to say?').setPlaceholder('Write your words here. Do not include private identifying details.').setStyle(TextInputStyle.Paragraph).setRequired(true).setMinLength(3).setMaxLength(MAX_BODY);
 modal.addComponents(new ActionRowBuilder().addComponents(topic), new ActionRowBuilder().addComponents(body));
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
  .setAuthor({ name: 'WHISPER VAULT  /  ANONYMOUS ENTRY' })
  .setTitle('CONFESSION  #' + String(number).padStart(4, '0'))
  .setDescription('> ' + escapeMentions(body).trim().replace(/\n/g, '\n> '))
  .addFields({ name: 'STATUS', value: 'Published anonymously', inline: true })
  .setFooter({ text: 'STARRY  •  WHISPER VAULT  •  Keep it human. Keep it kind.' }).setTimestamp();
 if (topic && topic.trim()) embed.addFields({ name: 'SUBJECT', value: escapeMentions(topic.trim()).slice(0, MAX_TOPIC), inline: true });
 return embed;
}
function buildReportEmbed(number, reason, messageUrl) {
 return new EmbedBuilder().setColor('#D64545').setTitle('WHISPER VAULT  /  STAFF REVIEW')
  .setDescription('A community member flagged a published confession for review.')
  .addFields(
   { name: 'CONFESSION', value: '#' + String(number).padStart(4, '0'), inline: true },
   { name: 'REASON', value: escapeMentions(reason).slice(0, MAX_REPORT_REASON) },
   { name: 'SOURCE', value: '[Open published confession](' + messageUrl + ')' }
  ).setFooter({ text: 'Private staff notice  •  Reporter identity is not displayed or stored' }).setTimestamp();
}
function buildConfessionComponents() {
 return [new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('whisper:report').setLabel('Report to staff').setEmoji('🚩').setStyle(ButtonStyle.Secondary))];
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
 if (!pub?.has(PermissionFlagsBits.ViewChannel) || !pub.has(PermissionFlagsBits.SendMessages) || !pub.has(PermissionFlagsBits.EmbedLinks)) return 'Starry needs View Channel, Send Messages, and Embed Links in the public channel.';
 const everyone = staffChannel.permissionsFor(guild.roles.everyone);
 const staff = staffChannel.permissionsFor(staffRole);
 const bot = staffChannel.permissionsFor(botMember);
 if (!everyone || everyone.has(PermissionFlagsBits.ViewChannel) || !staff?.has(PermissionFlagsBits.ViewChannel)) return 'The staff channel must be hidden from @everyone and visible to the selected staff role.';
 for (const role of guild.roles.cache.values()) {
  if (role.id === guild.roles.everyone.id || role.id === staffRole.id || role.permissions.has(PermissionFlagsBits.Administrator)) continue;
  const permissions = staffChannel.permissionsFor(role);
  if (permissions?.has(PermissionFlagsBits.ViewChannel)) return 'Another non-staff role can view the report channel. Remove its View Channel access first.';
 }
 for (const overwrite of staffChannel.permissionOverwrites.cache.values()) {
  if (overwrite.type === 1 && overwrite.id !== botMember.id && overwrite.allow.has(PermissionFlagsBits.ViewChannel)) return 'A direct member permission grants access to the report channel. Remove non-staff member access.';
 }
 if (!bot?.has(PermissionFlagsBits.ViewChannel) || !bot.has(PermissionFlagsBits.SendMessages) || !bot.has(PermissionFlagsBits.EmbedLinks)) return 'Starry needs View Channel, Send Messages, and Embed Links in the staff channel.';
 return null;
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
async function handleSetup(interaction, client) {
 await interaction.deferReply({ flags: EPHEMERAL });
 const guild = await getGuild(interaction, client).catch(() => null);
 if (!guild) return replyPrivate(interaction, 'I could not access this server. Please try again.');
 const publicChannel = interaction.options.getChannel('channel', true);
 const staffChannel = interaction.options.getChannel('staff_channel', true);
 const staffRole = interaction.options.getRole('staff_role', true);
 const botMember = await getBotMember(guild);
 const error = validateChannels(guild, publicChannel, staffChannel, staffRole, botMember);
 if (error) return replyPrivate(interaction, '⚠️ ' + error);
 const panel = await publicChannel.send({ embeds: [buildPanelEmbed()], components: buildPanelComponents(), allowedMentions: { parse: [] } });
 try {
  await WhisperConfig.findOneAndUpdate({ guildId: guild.id }, { $set: { channelId: publicChannel.id, staffChannelId: staffChannel.id, staffRoleId: staffRole.id }, $setOnInsert: { guildId: guild.id } }, { upsert: true, new: true, setDefaultsOnInsert: true }).exec();
 } catch (error) {
  await panel.delete().catch(() => null);
  throw error;
 }
 return replyPrivate(interaction, 'Whisper Vault is ready in ' + publicChannel.toString() + '. Private reports will be delivered to ' + staffChannel.toString() + '.');
}
async function handleSubmission(interaction) {
 await interaction.deferReply({ flags: EPHEMERAL });
 const config = await getConfig(interaction.guildId);
 if (!config) return replyPrivate(interaction, 'Whisper Vault is not configured. Ask a manager to run /confessionsetup.');
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
async function handleReport(interaction, client, messageId) {
 await interaction.deferReply({ flags: EPHEMERAL });
 if (!isSnowflake(messageId)) return replyPrivate(interaction, 'This report button is invalid. Use the button on a current confession.');
 const config = await getConfig(interaction.guildId);
 if (!config) return replyPrivate(interaction, 'Whisper Vault is not configured.');
 const guild = await getGuild(interaction, client).catch(() => null);
 if (!guild) return replyPrivate(interaction, 'I could not access this server.');
 const publicChannel = await getTextChannel(guild, config.channelId);
 const staffChannel = await getTextChannel(guild, config.staffChannelId);
 const message = publicChannel && await publicChannel.messages.fetch(messageId).catch(() => null);
 if (!isWhisperPost(message, client.user.id)) return replyPrivate(interaction, 'That confession is no longer available for review.');
 if (!staffChannel) return replyPrivate(interaction, 'The private staff report channel is unavailable. Ask a manager to rerun /confessionsetup.');
 const staffRole = guild.roles.cache.get(config.staffRoleId) || await guild.roles.fetch(config.staffRoleId).catch(() => null);
 const botMember = await getBotMember(guild);
 const privacyError = validateChannels(guild, publicChannel, staffChannel, staffRole, botMember);
 if (privacyError) return replyPrivate(interaction, '⚠️ Reports are paused because the configured destinations are no longer safe: ' + privacyError + ' Ask a manager to rerun /confessionsetup.');
 const reason = interaction.fields.getTextInputValue('reason').trim();
 if (reason.length < 3 || reason.length > MAX_REPORT_REASON) return replyPrivate(interaction, 'Please provide a reason between 3 and 500 characters.');
 const number = Number((message.embeds[0].title.match(/#(\d+)/) || [])[1]);
 await staffChannel.send({ embeds: [buildReportEmbed(number, reason, message.url)], components: buildStaffComponents(message.id), allowedMentions: { parse: [] } });
 return replyPrivate(interaction, 'Your report has been delivered privately to the staff team. Thank you.');
}
async function handleStaffAction(interaction, client, action, messageId) {
 await interaction.deferReply({ flags: EPHEMERAL });
 const config = await getConfig(interaction.guildId);
 if (!config) return replyPrivate(interaction, 'Whisper Vault is not configured.');
 if (interaction.channelId !== config.staffChannelId) return replyPrivate(interaction, 'Staff review actions only work inside the configured private report channel.');
 const isAdmin = interaction.memberPermissions?.has(PermissionFlagsBits.Administrator);
 const memberRoles = interaction.member?.roles;
 const hasStaffRole = memberRoles?.cache?.has ? memberRoles.cache.has(config.staffRoleId) : Array.isArray(memberRoles) && memberRoles.includes(config.staffRoleId);
 if (!isAdmin && !hasStaffRole) return replyPrivate(interaction, 'Only the configured staff role or server administrators can use this action.');
 const guild = await getGuild(interaction, client).catch(() => null);
 const channel = guild && await getTextChannel(guild, config.channelId);
 const confession = channel && await channel.messages.fetch(messageId).catch(() => null);
 if (!isWhisperPost(confession, client.user.id)) return replyPrivate(interaction, 'The original confession is already unavailable.');
 if (action === 'remove') {
  const botMember = await getBotMember(guild);
  if (!channel.permissionsFor(botMember)?.has(PermissionFlagsBits.ManageMessages)) return replyPrivate(interaction, 'Starry needs Manage Messages in the public confession channel to remove posts.');
  await confession.delete();
 }
 if (interaction.message) await interaction.message.edit({ content: action === 'remove' ? '🗑️ Confession removed by staff.' : '✓ Report reviewed and dismissed.', embeds: [], components: [] }).catch(() => null);
 return replyPrivate(interaction, action === 'remove' ? 'The confession has been removed.' : 'The report has been dismissed.');
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
    if (id === 'whisper:report') return await interaction.showModal(buildReportModal(interaction.message?.id));
    if (id.startsWith(STAFF_REMOVE_PREFIX)) return await handleStaffAction(interaction, client, 'remove', id.slice(STAFF_REMOVE_PREFIX.length));
    if (id.startsWith(STAFF_DISMISS_PREFIX)) return await handleStaffAction(interaction, client, 'dismiss', id.slice(STAFF_DISMISS_PREFIX.length));
    return;
   }
   if (interaction.isModalSubmit()) {
    if (interaction.customId === SUBMIT_MODAL) return await handleSubmission(interaction);
    if (interaction.customId.startsWith(REPORT_MODAL_PREFIX)) return await handleReport(interaction, client, interaction.customId.slice(REPORT_MODAL_PREFIX.length));
   }
  } catch (error) {
   console.error('[Whisper Vault] Action failed:', error?.message || error);
   if (interaction.isRepliable?.()) await replyPrivate(interaction, 'Whisper Vault could not complete that action. Please try again or contact a server manager.');
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
 client.__starryWhisperHandlerInstalled = true;
 client.on('interactionCreate', createInteractionHandler(client));
 console.log('✉️ Starry Whisper Vault initialized.');
}
whisperModule.setupPayload = setupPayload;
whisperModule.confessPayload = confessPayload;
whisperModule.buildPanelEmbed = buildPanelEmbed;
whisperModule.buildPanelComponents = buildPanelComponents;
whisperModule.buildSubmissionModal = buildSubmissionModal;
whisperModule.buildReportModal = buildReportModal;
whisperModule.buildConfessionEmbed = buildConfessionEmbed;
whisperModule.buildReportEmbed = buildReportEmbed;
whisperModule.buildConfessionComponents = buildConfessionComponents;
whisperModule.buildStaffComponents = buildStaffComponents;
whisperModule.isWhisperPost = isWhisperPost;
whisperModule.validateChannels = validateChannels;
whisperModule.createInteractionHandler = createInteractionHandler;
whisperModule.registerWorkerHook = registerWorkerHook;
module.exports = whisperModule;
