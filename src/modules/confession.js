'use strict';

const mongoose = require('mongoose');
const {
  EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder,
  TextInputBuilder, TextInputStyle, PermissionFlagsBits, SlashCommandBuilder,
  ChannelType, MessageFlags
} = require('discord.js');

const EPHEMERAL = MessageFlags.Ephemeral ?? 64;
const MAX_BODY = 1000;
const MAX_REPLY = 500;
const COLOR = 0x8B5CF6;

const configSchema = new mongoose.Schema({
  guildId: { type: String, required: true, unique: true },
  enabled: { type: Boolean, default: true },
  panelChannelId: { type: String, default: '' },
  reportChannelId: { type: String, default: '' },
  staffRoleId: { type: String, default: '' },
  nextNumber: { type: Number, default: 1 }
}, { timestamps: true });

const postSchema = new mongoose.Schema({
  guildId: { type: String, required: true },
  number: { type: Number, required: true },
  channelId: { type: String, required: true },
  messageId: { type: String, required: true },
  status: { type: String, enum: ['published', 'hidden'], default: 'published' },
  reportCount: { type: Number, default: 0 }
}, { timestamps: true });
postSchema.index({ guildId: 1, number: 1 }, { unique: true });
postSchema.index({ guildId: 1, messageId: 1 }, { unique: true });

const Config = mongoose.models.ConfessionConfig || mongoose.model('ConfessionConfig', configSchema);
const Post = mongoose.models.ConfessionPost || mongoose.model('ConfessionPost', postSchema);

const setupPayload = new SlashCommandBuilder()
  .setName('confessionsetup').setDescription('Set up the anonymous confession room')
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
  .addChannelOption(o => o.setName('channel').setDescription('Confession channel').addChannelTypes(ChannelType.GuildText))
  .addChannelOption(o => o.setName('reports').setDescription('Private staff report channel').addChannelTypes(ChannelType.GuildText))
  .addRoleOption(o => o.setName('staff_role').setDescription('Role to notify for reports'));
const confessPayload = new SlashCommandBuilder().setName('confess').setDescription('Open the anonymous confession form');
const confessionPayload = new SlashCommandBuilder().setName('confession').setDescription('Open the anonymous confession form');

function clean(value, limit) {
  return String(value ?? '').replace(/\u0000/g, '').replace(/[\u200B-\u200D\uFEFF]/g, '').trim().slice(0, limit);
}
function publicText(value) {
  return clean(value, MAX_BODY).replace(/@everyone/gi, '@\u200Beveryone')
    .replace(/@here/gi, '@\u200Bhere').replace(/<@&?\d{17,20}>/g, '@member');
}
function panelEmbed() {
  return new EmbedBuilder().setColor(COLOR).setTitle('💌  THE CONFESSION ROOM')
    .setDescription([
      'A quiet place for the things you have been meaning to say.',
      '',
      'Share a story, a thought, a secret crush, or something you need off your chest. Your public post will not show your Discord username or avatar.',
      '',
      '**HOW IT WORKS**',
      '1. Tap **Write a confession**.',
      '2. Add an optional topic and your message.',
      '3. Submit it anonymously.',
      '',
      '**COMMUNITY PROMISE**',
      'Be kind. No doxxing, threats, targeted harassment, or private information.',
      '',
      '*Starry does not attach your identity to the public post. Discord and the bot still process interaction metadata; never include identifying information.*'
    ].join('\n'))
    .addFields(
      { name: '🕯️ YOUR SPACE', value: 'Honest · Respectful · Anonymous', inline: true },
      { name: '🛡️ COMMUNITY', value: 'Reports go to server staff', inline: true }
    ).setFooter({ text: 'STARRY • CONFESSION ROOM / Speak freely. Stay respectful.' });
}
function panelRow() {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('starry_confess:open').setLabel('Write a confession').setEmoji('💌').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId('starry_confess:rules').setLabel('Privacy & rules').setEmoji('🛡️').setStyle(ButtonStyle.Secondary)
  );
}
function confessionEmbed(number, topic, body) {
  const embed = new EmbedBuilder().setColor(COLOR).setAuthor({ name: '💌  CONFESSION  #' + number })
    .setDescription('> ' + publicText(body).replace(/\n/g, '\n> '))
    .addFields({ name: '🕯️ ANONYMOUS', value: 'No public author identity', inline: true })
    .setFooter({ text: 'Starry Confession Room • Keep the conversation kind' }).setTimestamp();
  const safeTopic = clean(topic, 50);
  if (safeTopic) embed.setTitle('✦ ' + safeTopic);
  return embed;
}
function postRow(number) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('starry_confess:reply:' + number).setLabel('Reply anonymously').setEmoji('💬').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('starry_confess:report:' + number).setLabel('Report').setEmoji('🚩').setStyle(ButtonStyle.Danger)
  );
}
function submissionModal() {
  const modal = new ModalBuilder().setCustomId('starry_confess:submit').setTitle('Write anonymously');
  const topic = new TextInputBuilder().setCustomId('topic').setLabel('Topic (optional)')
    .setPlaceholder('Crushes, friendship, life, anything…').setStyle(TextInputStyle.Short).setRequired(false).setMaxLength(50);
  const body = new TextInputBuilder().setCustomId('body').setLabel('What would you like to share?')
    .setPlaceholder('Write your confession here…').setStyle(TextInputStyle.Paragraph)
    .setRequired(true).setMinLength(3).setMaxLength(MAX_BODY);
  return modal.addComponents(new ActionRowBuilder().addComponents(topic), new ActionRowBuilder().addComponents(body));
}
function replyModal(number) {
  const modal = new ModalBuilder().setCustomId('starry_confess:reply-submit:' + number).setTitle('Reply to #' + number);
  const input = new TextInputBuilder().setCustomId('reply').setLabel('Your anonymous reply')
    .setPlaceholder('Respond with kindness…').setStyle(TextInputStyle.Paragraph).setRequired(true).setMaxLength(MAX_REPLY);
  return modal.addComponents(new ActionRowBuilder().addComponents(input));
}
async function getConfig(guildId) {
  return Config.findOne().where('guildId').equals(guildId).lean().exec();
}
async function getOrCreateConfig(guildId) {
  return Config.findOneAndUpdate({ guildId }, { $setOnInsert: { guildId, enabled: true, nextNumber: 1 } },
    { upsert: true, new: true, setDefaultsOnInsert: true }).exec();
}
async function allocateNumber(guildId) {
  const settings = await Config.findOneAndUpdate(
    { guildId },
    { $setOnInsert: { guildId, enabled: true }, $inc: { nextNumber: 1 } },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  ).exec();
  return settings.nextNumber - 1;
}
function readField(interaction, names) {
  for (const name of names) {
    try { return interaction.fields.getTextInputValue(name); } catch (error) {}
  }
  return '';
}
function respondPrivate(interaction, content) {
  const payload = { content, flags: EPHEMERAL };
  return interaction.deferred || interaction.replied ? interaction.followUp(payload) : interaction.reply(payload);
}

function confessionModule(client) {
  const cooldowns = new Map();
  client.on('interactionCreate', async interaction => {
    const command = interaction.isChatInputCommand?.();
    const button = interaction.isButton?.();
    const modal = interaction.isModalSubmit?.();
    if (!command && !button && !modal) return;
    const name = command ? interaction.commandName : '';
    const id = button || modal ? interaction.customId : '';
    const known = ['confessionsetup', 'confess', 'confession'].includes(name) ||
      id.startsWith('starry_confess:') || id === 'confess_btn_open' ||
      id === 'confess_modal_submit' || id.startsWith('confess_btn_reply_') ||
      id.startsWith('confess_btn_report_') || id.startsWith('confess_modal_reply_');
    if (!known) return;

    try {
      if (!interaction.guild) return respondPrivate(interaction, 'Confessions are available inside a server only.');

      if (command && name === 'confessionsetup') {
        await interaction.deferReply({ flags: EPHEMERAL });
        const channel = interaction.options.getChannel('channel') || interaction.channel;
        const reports = interaction.options.getChannel('reports');
        const staffRole = interaction.options.getRole('staff_role');
        if (!channel || channel.type !== ChannelType.GuildText) {
          return interaction.editReply({ content: 'Choose a regular text channel for the confession room.' });
        }
        const settings = await getOrCreateConfig(interaction.guildId);
        settings.enabled = true;
        settings.panelChannelId = channel.id;
        if (reports) settings.reportChannelId = reports.id;
        if (staffRole) settings.staffRoleId = staffRole.id;
        await settings.save();
        await channel.send({ embeds: [panelEmbed()], components: [panelRow()] });
        return interaction.editReply({ content: '💌 Confession Room is ready in ' + channel + '.' });
      }

      if (command && (name === 'confess' || name === 'confession')) return interaction.showModal(submissionModal());

      if (button) {
        if (id === 'starry_confess:open' || id === 'confess_btn_open') return interaction.showModal(submissionModal());
        if (id === 'starry_confess:rules') {
          return respondPrivate(interaction, '**Privacy:** Your username and avatar are not placed on public posts. Discord and Starry still process interaction metadata. Do not include identifying details.\n\n**Rules:** No doxxing, threats, targeted harassment, hate, or illegal content. Use Report if a post needs staff attention.');
        }
        const replyMatch = id.match(/^(?:starry_confess:reply:|confess_btn_reply_)(\d+)$/);
        if (replyMatch) return interaction.showModal(replyModal(replyMatch[1]));
        const reportMatch = id.match(/^(?:starry_confess:report:|confess_btn_report_)(\d+)$/);
        if (reportMatch) {
          await interaction.deferReply({ flags: EPHEMERAL });
          const settings = await getConfig(interaction.guildId);
          const number = Number(reportMatch[1]);
          const post = await Post.findOneAndUpdate({ guildId: interaction.guildId, number, status: 'published' },
            { $inc: { reportCount: 1 } }, { new: true }).lean().exec();
          const targetChannelId = settings?.reportChannelId;
          const target = targetChannelId ? await interaction.guild.channels.fetch(targetChannelId).catch(() => null) : null;
          if (target?.isTextBased()) {
            const rolePing = settings.staffRoleId ? '<@&' + settings.staffRoleId + '> ' : '';
            const channelId = post?.channelId || interaction.channelId;
            const messageId = post?.messageId || interaction.message.id;
            await target.send({
              content: rolePing + '🚩 **Confession #' + number + ' reported** • ' + (post?.reportCount || 1) +
                ' report(s)\nhttps://discord.com/channels/' + interaction.guildId + '/' + channelId + '/' + messageId,
              allowedMentions: { roles: settings.staffRoleId ? [settings.staffRoleId] : [] }
            });
          }
          return interaction.editReply({ content: '🚩 Report sent privately to the configured staff channel. Thank you.' });
        }
      }

      if (modal && (id === 'starry_confess:submit' || id === 'confess_modal_submit')) {
        await interaction.deferReply({ flags: EPHEMERAL });
        const key = interaction.guildId + ':' + interaction.user.id;
        const now = Date.now();
        const last = cooldowns.get(key) || 0;
        if (now - last < 30000) return interaction.editReply({ content: 'Please wait a little before submitting another confession.' });
        const body = clean(readField(interaction, ['body', 'confess_input_text']), MAX_BODY);
        const topic = clean(readField(interaction, ['topic', 'confess_input_topic']), 50);
        if (body.length < 3) return interaction.editReply({ content: 'Your confession needs at least 3 characters.' });
        const settings = await getConfig(interaction.guildId);
        if (settings?.enabled === false) return interaction.editReply({ content: 'The confession room is currently paused.' });
        const channel = settings?.panelChannelId ? await interaction.guild.channels.fetch(settings.panelChannelId).catch(() => null) : interaction.channel;
        if (!channel?.isTextBased()) return interaction.editReply({ content: 'The confession channel is unavailable. Ask an admin to run /confessionsetup again.' });

        let number;
        if (mongoose.connection.readyState === 1) number = await allocateNumber(interaction.guildId);
        else number = Math.floor(now / 1000);
        const message = await channel.send({
          embeds: [confessionEmbed(number, topic, body)], components: [postRow(number)],
          allowedMentions: { parse: [] }
        });
        if (mongoose.connection.readyState === 1) {
          await Post.create({ guildId: interaction.guildId, number, channelId: channel.id, messageId: message.id });
        }
        cooldowns.set(key, now);
        for (const [entry, timestamp] of cooldowns) if (now - timestamp > 60000) cooldowns.delete(entry);
        return interaction.editReply({ content: '💌 Your confession has been posted anonymously as **#' + number + '**.' });
      }

      const replyMatch = modal && id.match(/^(?:starry_confess:reply-submit:|confess_modal_reply_)(\d+)$/);
      if (replyMatch) {
        await interaction.deferReply({ flags: EPHEMERAL });
        const reply = clean(readField(interaction, ['reply', 'confess_input_reply']), MAX_REPLY);
        if (!reply) return interaction.editReply({ content: 'Your reply cannot be empty.' });
        const post = await Post.findOne({ guildId: interaction.guildId, number: Number(replyMatch[1]), status: 'published' }).lean().exec();
        if (!post) return interaction.editReply({ content: 'That confession is unavailable for replies. Please use a current confession card.' });
        const channel = await interaction.guild.channels.fetch(post.channelId).catch(() => null);
        const original = channel?.isTextBased() ? await channel.messages.fetch(post.messageId).catch(() => null) : null;
        if (!original) return interaction.editReply({ content: 'The original confession could not be found.' });
        await original.reply({
          embeds: [new EmbedBuilder().setColor(0xA78BFA)
            .setDescription('💬 **Anonymous reply**\n> ' + publicText(reply).replace(/\n/g, '\n> '))
            .setFooter({ text: 'In reply to confession #' + post.number }).setTimestamp()],
          allowedMentions: { parse: [] }
        });
        return interaction.editReply({ content: '💬 Your anonymous reply to **#' + post.number + '** has been posted.' });
      }
    } catch (error) {
      console.error('[ConfessionRoom] Interaction failed:', error);
      return respondPrivate(interaction, '⚠️ Starry could not complete that action. Please try again; if it continues, ask an admin to check the bot logs.').catch(() => null);
    }
  });
  console.log('[ConfessionRoom] Anonymous confession experience initialized.');
}

confessionModule.confessionSetupPayload = setupPayload.toJSON();
confessionModule.confessPayload = confessPayload.toJSON();
confessionModule.confessionPayload = confessionPayload.toJSON();
confessionModule._test = { clean, publicText, panelEmbed, confessionEmbed, panelRow, postRow };
module.exports = confessionModule;
