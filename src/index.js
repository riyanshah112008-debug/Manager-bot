'use strict';

require('dotenv').config();

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const express = require('express');
const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  Client,
  EmbedBuilder,
  GatewayIntentBits,
  PermissionFlagsBits,
  REST,
  Routes,
  SlashCommandBuilder,
} = require('discord.js');

const PORT = Number(process.env.PORT || 10000);
const DATA_DIR = path.resolve(process.env.DATA_DIR || './data');
const DATA_FILE = path.join(DATA_DIR, 'manager-data.json');
const MAX_REMINDER_MS = 30 * 24 * 60 * 60 * 1000;
const BRAND = 0x5865f2;

function loadData() {
  try {
    const parsed = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
    return {
      guilds: parsed.guilds && typeof parsed.guilds === 'object' ? parsed.guilds : {},
      reminders: Array.isArray(parsed.reminders) ? parsed.reminders : [],
      directory: Array.isArray(parsed.directory) ? parsed.directory : [],
    };
  } catch (error) {
    if (error.code !== 'ENOENT') console.error('Could not read bot data; starting with empty data:', error.message);
    return { guilds: {}, reminders: [], directory: [] };
  }
}

const data = loadData();
let saveQueued = false;
function saveData() {
  if (saveQueued) return;
  saveQueued = true;
  setImmediate(() => {
    saveQueued = false;
    try {
      fs.mkdirSync(DATA_DIR, { recursive: true });
      const tempPath = `${DATA_FILE}.${process.pid}.tmp`;
      fs.writeFileSync(tempPath, JSON.stringify(data, null, 2), { mode: 0o600 });
      fs.renameSync(tempPath, DATA_FILE);
    } catch (error) {
      console.error('Could not persist bot data:', error.message);
    }
  });
}

function settingsFor(guildId) {
  if (!data.guilds[guildId]) data.guilds[guildId] = {};
  return data.guilds[guildId];
}

function parseDuration(input) {
  const match = /^\s*(\d{1,5})\s*(s|sec|m|min|h|hr|d|day|days)\s*$/i.exec(input || '');
  if (!match) return null;
  const amount = Number(match[1]);
  const unit = match[2].toLowerCase();
  const multiplier = unit.startsWith('s') ? 1000
    : unit.startsWith('m') ? 60_000
      : unit.startsWith('h') ? 3_600_000 : 86_400_000;
  const duration = amount * multiplier;
  return duration > 0 && duration <= MAX_REMINDER_MS ? duration : null;
}

function channelOption(name, description, required = true, channelTypes) {
  return option => {
    option.setName(name).setDescription(description).setRequired(required);
    if (channelTypes) option.addChannelTypes(...channelTypes);
    return option;
  };
}

const commands = [
  new SlashCommandBuilder().setName('help').setDescription('Show Manager Bot features and commands.'),
  new SlashCommandBuilder().setName('serverinfo').setDescription('Show information about this server.'),
  new SlashCommandBuilder().setName('setup').setDescription('Configure Manager Bot features for this server.')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand(s => s.setName('welcome').setDescription('Choose where join announcements are sent.')
      .addChannelOption(channelOption('channel', 'Text channel for welcome messages.', true, [ChannelType.GuildText])))
    .addSubcommand(s => s.setName('logs').setDescription('Choose the moderation and ticket log channel.')
      .addChannelOption(channelOption('channel', 'Text channel for bot logs.', true, [ChannelType.GuildText])))
    .addSubcommand(s => s.setName('verification').setDescription('Set the role granted by the verification button.')
      .addRoleOption(o => o.setName('role').setDescription('Role to grant after the member clicks Verify.').setRequired(true)))
    .addSubcommand(s => s.setName('tickets').setDescription('Configure private support ticket creation.')
      .addChannelOption(channelOption('category', 'Category for new tickets.', false, [ChannelType.GuildCategory]))
      .addRoleOption(o => o.setName('support_role').setDescription('Optional support team role.').setRequired(false)))
    .addSubcommand(s => s.setName('starboard').setDescription('Configure the starboard destination and threshold.')
      .addChannelOption(channelOption('channel', 'Text channel for starred messages.', true, [ChannelType.GuildText]))
      .addIntegerOption(o => o.setName('threshold').setDescription('Star reaction count required (1–20).').setMinValue(1).setMaxValue(20).setRequired(true))),
  new SlashCommandBuilder().setName('verify').setDescription('Post the configured role-verification panel.')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand(s => s.setName('panel').setDescription('Post a Verify button in this channel.')),
  new SlashCommandBuilder().setName('ticket').setDescription('Open or manage support tickets.')
    .addStringOption(o => o.setName('action').setDescription('Choose a ticket action.').setRequired(true)
      .addChoices({ name: 'Post support panel', value: 'panel' }, { name: 'Close this ticket', value: 'close' })),
  new SlashCommandBuilder().setName('remind').setDescription('Set a reminder in this channel.')
    .addStringOption(o => o.setName('in').setDescription('Duration such as 10m, 2h, or 1d (maximum 30 days).').setRequired(true))
    .addStringOption(o => o.setName('message').setDescription('What should I remind you about?').setMaxLength(500).setRequired(true)),
  new SlashCommandBuilder().setName('bump').setDescription('List or refresh this server in the local community directory.')
    .addStringOption(o => o.setName('invite').setDescription('Permanent Discord invite URL (discord.gg).').setRequired(true)),
  new SlashCommandBuilder().setName('directory').setDescription('Show communities listed in this bot’s local directory.'),
].map(command => command.toJSON());

const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers] });
const app = express();
app.disable('x-powered-by');
app.get('/health', (_req, res) => res.status(200).json({ status: 'ok', uptime: Math.floor(process.uptime()) }));
app.get('/api/status', (_req, res) => res.json({
  status: client.isReady() ? 'online' : 'waiting_for_discord',
  bot: client.user?.tag || null,
  guilds: client.guilds.cache.size,
  uptime: Math.floor(process.uptime()),
}));
app.get('/', (_req, res) => res.type('html').send(`<!doctype html>
<html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Manager Bot</title><style>body{margin:0;background:#11131a;color:#f5f6fa;font:16px system-ui;display:grid;min-height:100vh;place-items:center}.card{max-width:620px;margin:24px;padding:32px;border:1px solid #303442;border-radius:20px;background:#1a1d27}h1{margin-top:0}p{color:#b6bbca;line-height:1.6}code{color:#b9c3ff}</style>
<main class="card"><h1>Manager Bot</h1><p>A community bot for verification, support tickets, reminders, and server discovery.</p><p>Service health: <a href="/health">/health</a> · Read-only status: <a href="/api/status">/api/status</a></p></main></html>`));
const server = app.listen(PORT, '0.0.0.0', () => console.log(`Health/dashboard service listening on ${PORT}`));

function embed(title, description) {
  return new EmbedBuilder().setColor(BRAND).setTitle(title).setDescription(description).setTimestamp();
}

async function sendLog(guild, text) {
  const channelId = settingsFor(guild.id).logChannelId;
  const channel = channelId && guild.channels.cache.get(channelId);
  if (channel?.isTextBased()) await channel.send({ embeds: [embed('Manager Bot · Log', text)] }).catch(() => {});
}

function verifyPanel() {
  return {
    embeds: [embed('Member verification', 'Press the button below to receive the server’s verified-member role.')],
    components: [new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('manager:verify').setLabel('Verify').setStyle(ButtonStyle.Success),
    )],
  };
}

function ticketPanel() {
  return {
    embeds: [embed('Need help?', 'Press **Open a ticket** to create a private support channel.')],
    components: [new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('manager:ticket-open').setLabel('Open a ticket').setStyle(ButtonStyle.Primary),
    )],
  };
}

async function createTicket(interaction) {
  const guild = interaction.guild;
  const current = guild.channels.cache.find(channel => channel.type === ChannelType.GuildText && channel.topic === `manager-ticket:${interaction.user.id}`);
  if (current) return interaction.reply({ content: `You already have an open ticket: ${current}`, ephemeral: true });

  const config = settingsFor(guild.id);
  const overwrites = [
    { id: guild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] },
    { id: interaction.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory, PermissionFlagsBits.AttachFiles] },
    { id: client.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory, PermissionFlagsBits.ManageChannels] },
  ];
  if (config.supportRoleId && guild.roles.cache.has(config.supportRoleId)) {
    overwrites.push({ id: config.supportRoleId, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] });
  }
  const safeName = interaction.user.username.toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-').slice(0, 40) || 'member';
  const channel = await guild.channels.create({
    name: `ticket-${safeName}`,
    type: ChannelType.GuildText,
    topic: `manager-ticket:${interaction.user.id}`,
    parent: config.ticketCategoryId && guild.channels.cache.has(config.ticketCategoryId) ? config.ticketCategoryId : undefined,
    permissionOverwrites: overwrites,
    reason: `Support ticket opened by ${interaction.user.tag}`,
  });
  await channel.send({
    content: `<@${interaction.user.id}>${config.supportRoleId ? ` <@&${config.supportRoleId}>` : ''}`,
    embeds: [embed('Support ticket', 'Describe your issue and a moderator will help. Use the button below when you are finished.')],
    components: [new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('manager:ticket-close').setLabel('Close ticket').setStyle(ButtonStyle.Danger),
    )],
    allowedMentions: { users: [interaction.user.id], roles: config.supportRoleId ? [config.supportRoleId] : [] },
  });
  await interaction.reply({ content: `Your private ticket is ready: ${channel}`, ephemeral: true });
  await sendLog(guild, `Ticket opened by <@${interaction.user.id}> in ${channel}.`);
}

async function closeTicket(interaction) {
  const channel = interaction.channel;
  if (!channel || channel.type !== ChannelType.GuildText || !channel.topic?.startsWith('manager-ticket:')) {
    return interaction.reply({ content: 'This command can only be used in a Manager Bot ticket channel.', ephemeral: true });
  }
  const ownerId = channel.topic.slice('manager-ticket:'.length);
  const isOwner = interaction.user.id === ownerId;
  const canManage = interaction.memberPermissions?.has(PermissionFlagsBits.ManageChannels);
  if (!isOwner && !canManage) return interaction.reply({ content: 'Only the ticket opener or a server moderator can close this ticket.', ephemeral: true });
  await interaction.reply({ content: 'Closing this ticket in a few seconds…' });
  await sendLog(interaction.guild, `Ticket ${channel} closed by <@${interaction.user.id}>.`);
  setTimeout(() => channel.delete(`Ticket closed by ${interaction.user.tag}`).catch(() => {}), 2500);
}

async function handleSetup(interaction) {
  const sub = interaction.options.getSubcommand();
  const settings = settingsFor(interaction.guildId);
  if (sub === 'welcome') {
    settings.welcomeChannelId = interaction.options.getChannel('channel').id;
    await interaction.reply({ content: 'Welcome announcements are configured.', ephemeral: true });
  } else if (sub === 'logs') {
    settings.logChannelId = interaction.options.getChannel('channel').id;
    await interaction.reply({ content: 'Bot logs are configured.', ephemeral: true });
  } else if (sub === 'verification') {
    const role = interaction.options.getRole('role');
    if (role.managed || role.id === interaction.guild.roles.everyone.id) {
      return interaction.reply({ content: 'Choose a regular server role that the bot can assign.', ephemeral: true });
    }
    settings.verifyRoleId = role.id;
    await interaction.reply({ content: `Verification will grant ${role}. Make sure the bot role is higher than it.`, ephemeral: true });
  } else if (sub === 'tickets') {
    const category = interaction.options.getChannel('category');
    const supportRole = interaction.options.getRole('support_role');
    settings.ticketCategoryId = category?.id || null;
    settings.supportRoleId = supportRole?.id || null;
    await interaction.reply({ content: 'Ticket settings saved.', ephemeral: true });
  } else if (sub === 'starboard') {
    settings.starboardChannelId = interaction.options.getChannel('channel').id;
    settings.starboardThreshold = interaction.options.getInteger('threshold');
    await interaction.reply({ content: 'Starboard settings saved.', ephemeral: true });
  }
  saveData();
}

async function handleCommand(interaction) {
  if (!interaction.inGuild() && !['help'].includes(interaction.commandName)) {
    return interaction.reply({ content: 'This command can only be used in a server.', ephemeral: true });
  }

  switch (interaction.commandName) {
    case 'help':
      return interaction.reply({ embeds: [embed('Manager Bot commands', [
        '`/setup` — configure welcome, logs, verification, tickets, and starboard.',
        '`/verify panel` — post the role verification button.',
        '`/ticket action:panel|close` — create a support panel or close your ticket.',
        '`/remind in:<duration> message:<text>` — set a reminder (up to 30 days).',
        '`/bump invite:<discord.gg URL>` and `/directory` — community directory.',
        '`/serverinfo` — server overview.',
      ].join('\n'))], ephemeral: true });

    case 'serverinfo': {
      const guild = interaction.guild;
      const description = `**Owner:** <@${guild.ownerId}>\n**Members:** ${guild.memberCount}\n**Channels:** ${guild.channels.cache.size}\n**Created:** <t:${Math.floor(guild.createdTimestamp / 1000)}:D>`;
      return interaction.reply({ embeds: [embed(guild.name, description)] });
    }

    case 'setup':
      return handleSetup(interaction);

    case 'verify': {
      const roleId = settingsFor(interaction.guildId).verifyRoleId;
      if (!roleId) return interaction.reply({ content: 'Configure a verification role first with `/setup verification`.', ephemeral: true });
      return interaction.channel.send(verifyPanel()).then(() => interaction.reply({ content: 'Verification panel posted.', ephemeral: true }));
    }

    case 'ticket': {
      const action = interaction.options.getString('action');
      if (action === 'panel') {
        if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) return interaction.reply({ content: 'Manage Server permission is required to post a ticket panel.', ephemeral: true });
        return interaction.channel.send(ticketPanel()).then(() => interaction.reply({ content: 'Ticket panel posted.', ephemeral: true }));
      }
      return closeTicket(interaction);
    }

    case 'remind': {
      const delay = parseDuration(interaction.options.getString('in'));
      if (!delay) return interaction.reply({ content: 'Use a duration such as `10m`, `2h`, or `1d` (maximum 30 days).', ephemeral: true });
      const reminder = {
        id: crypto.randomUUID(),
        guildId: interaction.guildId,
        channelId: interaction.channelId,
        userId: interaction.user.id,
        message: interaction.options.getString('message'),
        dueAt: Date.now() + delay,
      };
      data.reminders.push(reminder);
      saveData();
      return interaction.reply({ content: `Got it — I’ll remind you <t:${Math.floor(reminder.dueAt / 1000)}:R>.`, ephemeral: true });
    }

    case 'bump': {
      const invite = interaction.options.getString('invite').trim();
      if (!/^https:\/\/(discord\.gg|discord\.com\/invite)\/[A-Za-z0-9-]+\/?$/i.test(invite)) {
        return interaction.reply({ content: 'Provide a valid `https://discord.gg/...` or `https://discord.com/invite/...` invite URL.', ephemeral: true });
      }
      const entry = {
        guildId: interaction.guildId,
        name: interaction.guild.name,
        members: interaction.guild.memberCount,
        invite,
        bumpedAt: Date.now(),
      };
      const index = data.directory.findIndex(item => item.guildId === entry.guildId);
      if (index >= 0) data.directory[index] = entry;
      else data.directory.push(entry);
      data.directory.sort((a, b) => b.bumpedAt - a.bumpedAt);
      data.directory = data.directory.slice(0, 200);
      saveData();
      return interaction.reply({ content: 'Your server is now listed in this bot instance’s community directory.', ephemeral: true });
    }

    case 'directory': {
      const entries = data.directory.slice(0, 10);
      if (!entries.length) return interaction.reply({ content: 'The community directory is empty. Server admins can add their server with `/bump`.', ephemeral: true });
      const lines = entries.map((entry, index) => `**${index + 1}. ${entry.name}** · ${entry.members} members · [Join](${entry.invite}) · bumped <t:${Math.floor(entry.bumpedAt / 1000)}:R>`);
      return interaction.reply({ embeds: [embed('Community directory', lines.join('\n'))], ephemeral: true });
    }

    default:
      return interaction.reply({ content: 'Unknown command.', ephemeral: true });
  }
}

client.on('interactionCreate', async interaction => {
  try {
    if (interaction.isChatInputCommand()) return await handleCommand(interaction);
    if (!interaction.isButton()) return;

    if (interaction.customId === 'manager:verify') {
      const roleId = settingsFor(interaction.guildId).verifyRoleId;
      const role = roleId && interaction.guild.roles.cache.get(roleId);
      if (!role) return interaction.reply({ content: 'Verification has not been configured or the role no longer exists.', ephemeral: true });
      const botMember = interaction.guild.members.me;
      if (!botMember?.permissions.has(PermissionFlagsBits.ManageRoles) || role.position >= botMember.roles.highest.position) {
        return interaction.reply({ content: 'The bot needs Manage Roles permission and its role must be above the verification role.', ephemeral: true });
      }
      await interaction.member.roles.add(role, 'Member completed verification button');
      return interaction.reply({ content: `You’re verified and have received ${role}.`, ephemeral: true });
    }
    if (interaction.customId === 'manager:ticket-open') return await createTicket(interaction);
    if (interaction.customId === 'manager:ticket-close') return await closeTicket(interaction);
  } catch (error) {
    console.error('Interaction failed:', error);
    const reply = { content: 'Something went wrong while handling that action. Please try again or contact a moderator.', ephemeral: true };
    if (interaction.replied || interaction.deferred) await interaction.followUp(reply).catch(() => {});
    else await interaction.reply(reply).catch(() => {});
  }
});

client.on('guildMemberAdd', async member => {
  const channelId = settingsFor(member.guild.id).welcomeChannelId;
  const channel = channelId && member.guild.channels.cache.get(channelId);
  if (channel?.isTextBased()) {
    await channel.send({ content: `Welcome <@${member.id}> to **${member.guild.name}**!`, allowedMentions: { users: [member.id] } }).catch(() => {});
  }
});

client.on('messageReactionAdd', async (reaction, user) => {
  try {
    if (user.bot) return;
    if (reaction.partial) await reaction.fetch();
    if (reaction.emoji.name !== '⭐') return;
    const config = settingsFor(reaction.message.guildId);
    if (!config.starboardChannelId) return;
    const stars = reaction.count || 0;
    if (stars < (config.starboardThreshold || 3)) return;
    const destination = reaction.message.guild.channels.cache.get(config.starboardChannelId);
    if (!destination?.isTextBased()) return;
    if (reaction.message.channelId === destination.id) return;
    const embedMessage = new EmbedBuilder()
      .setColor(0xffd166)
      .setAuthor({ name: reaction.message.author?.tag || 'Unknown member' })
      .setDescription(reaction.message.content?.slice(0, 4000) || '*No text content*')
      .addFields({ name: 'Source', value: `[Jump to message](${reaction.message.url})` })
      .setFooter({ text: `${stars} ⭐ · ${reaction.message.channel?.name || 'channel'}` })
      .setTimestamp(reaction.message.createdAt || new Date());
    if (reaction.message.attachments.first()) embedMessage.setImage(reaction.message.attachments.first().url);
    const marker = `starboard:${reaction.message.id}`;
    const existing = destination.messages.cache.find(message => message.embeds[0]?.footer?.text?.includes(marker));
    if (!existing) await destination.send({ embeds: [embedMessage.setFooter({ text: `${stars} ⭐ · ${reaction.message.channel?.name || 'channel'} · ${marker}` })] });
  } catch (error) {
    console.error('Starboard update failed:', error.message);
  }
});

async function deliverReminder(reminder) {
  const channel = await client.channels.fetch(reminder.channelId).catch(() => null);
  if (channel?.isTextBased()) {
    await channel.send({
      content: `<@${reminder.userId}> ⏰ Reminder: ${reminder.message}`,
      allowedMentions: { users: [reminder.userId] },
    }).catch(() => {});
  }
  data.reminders = data.reminders.filter(item => item.id !== reminder.id);
  saveData();
}

setInterval(() => {
  if (!client.isReady()) return;
  const now = Date.now();
  for (const reminder of [...data.reminders]) {
    if (reminder.dueAt <= now) void deliverReminder(reminder);
  }
}, 15_000).unref();

client.once('ready', async readyClient => {
  console.log(`Logged in as ${readyClient.user.tag} (${readyClient.guilds.cache.size} servers)`);
  try {
    const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN || process.env.BOT_TOKEN);
    await rest.put(Routes.applicationCommands(readyClient.user.id), { body: commands });
    console.log(`Registered ${commands.length} slash commands.`);
  } catch (error) {
    console.error('Could not register slash commands:', error.message);
  }
});

client.on('guildCreate', guild => {
  console.log(`Joined ${guild.name} (${guild.id})`);
});
client.on('error', error => console.error('Discord client error:', error));
process.on('unhandledRejection', error => console.error('Unhandled rejection:', error));

async function shutdown(signal) {
  console.log(`${signal} received; shutting down.`);
  server.close();
  client.destroy();
  await new Promise(resolve => setTimeout(resolve, 100));
  process.exit(0);
}
process.once('SIGINT', () => void shutdown('SIGINT'));
process.once('SIGTERM', () => void shutdown('SIGTERM'));

const token = process.env.DISCORD_TOKEN || process.env.BOT_TOKEN;
if (!token) {
  console.error('Missing DISCORD_TOKEN (or BOT_TOKEN). Set it in the host environment; never submit it to a web form.');
} else {
  client.login(token).catch(error => {
    console.error('Discord login failed:', error.message);
    process.exitCode = 1;
  });
}

module.exports = { parseDuration };
