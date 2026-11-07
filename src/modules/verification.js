const {
  Events, ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder,
  ModalBuilder, TextInputBuilder, TextInputStyle, PermissionFlagsBits
} = require('discord.js');
const crypto = require('crypto');
const { getPublicUrl } = require('../utils/tunnelManager');

async function getConfig(guildId) {
  try {
    const mongoose = require('mongoose');
    if (mongoose.connection?.readyState !== 1) return {};
    const Model = require('../models/ServerSettings');
    const doc = await Model.findOne({ guildId: String(guildId) }).lean();
    return doc?.verification || {};
  } catch (_) { return {}; }
}

async function resolveTargetRole(guild, roleId) {
  if (!guild) return null;
  const id = roleId || (await getConfig(guild.id)).roleId;
  if (id && /^\d{17,20}$/.test(id)) return guild.roles.cache.get(id) || await guild.roles.fetch(id).catch(() => null);
  return guild.roles.cache.find(r => ['verified','member','members','human'].includes(r.name.toLowerCase())) || null;
}

function ageFailure(member, config) {
  const days = Math.max(0, Number(config.minAccountAgeDays) || 0);
  if (days && Date.now() - member.user.createdTimestamp < days * 86400000 && config.ageAction !== 'warn') {
    const remaining = Math.ceil((days * 86400000 - (Date.now() - member.user.createdTimestamp)) / 86400000);
    return `Your Discord account must be at least ${days} days old. Please try again in about ${remaining} day(s).`;
  }
  if (config.requireAvatar && !member.user.avatar) return 'Please set a Discord profile picture before verifying.';
  return null;
}

async function grantVerified(member, role, client, method) {
  const bot = member.guild.members.me || await member.guild.members.fetch(client.user.id).catch(() => null);
  if (!bot?.permissions.has(PermissionFlagsBits.ManageRoles)) throw new Error('Starry needs Manage Roles permission.');
  if (!role || role.managed || role.id === member.guild.id || role.position >= bot.roles.highest.position) throw new Error('The verified role is invalid or is above Starry in the role hierarchy.');
  if (!member.roles.cache.has(role.id)) await member.roles.add(role, `Starry verification: ${method}`);
  const cfg = await getConfig(member.guild.id);
  if (cfg.unverifiedRoleId && cfg.unverifiedRoleId !== role.id) {
    const pending = member.guild.roles.cache.get(cfg.unverifiedRoleId);
    if (pending && pending.position < bot.roles.highest.position) await member.roles.remove(pending, 'Starry verification completed').catch(() => {});
  }
  const logId = cfg.logChannelId;
  const log = logId ? member.guild.channels.cache.get(logId) : null;
  if (log?.isTextBased()) log.send({ embeds: [new EmbedBuilder().setColor(0x22c55e).setTitle('Member verified').setDescription(`<@${member.id}> completed verification using **${method}**.`).setTimestamp()] }).catch(() => {});
}

module.exports = client => {
  client.verifyMap ||= new Map();
  const pending = new Map();
  client.verifyAcceptedRules ||= new Set();
  const key = (guildId, userId) => `${guildId}:${userId}`;

  client.on(Events.GuildMemberAdd, async member => {
    const cfg = await getConfig(member.guild.id);
    if (!cfg.enabled || !cfg.unverifiedRoleId) return;
    const role = member.guild.roles.cache.get(cfg.unverifiedRoleId);
    const bot = member.guild.members.me;
    if (role && bot?.permissions.has(PermissionFlagsBits.ManageRoles) && role.position < bot.roles.highest.position) {
      await member.roles.add(role, 'Starry verification pending').catch(error => console.error('[Verification] Could not assign pending role:', error.message));
    }
  });

  client.on(Events.InteractionCreate, async interaction => {
    try {
      if (interaction.isButton() && interaction.customId === 'starry_verify_open') {
        const cfg = await getConfig(interaction.guildId);
        if (!cfg.enabled) return interaction.reply({ content: 'Verification is currently disabled by the server administrators.', ephemeral: true });
        const methods = cfg.methods || {};
        const buttons = [];
        if (methods.button !== false) buttons.push(new ButtonBuilder().setCustomId('starry_verify_button').setLabel('One-click').setStyle(ButtonStyle.Success));
        if (methods.math !== false) buttons.push(new ButtonBuilder().setCustomId('starry_verify_math').setLabel('Math challenge').setStyle(ButtonStyle.Primary));
        if (methods.captcha !== false) buttons.push(new ButtonBuilder().setCustomId('starry_verify_captcha').setLabel('Web CAPTCHA').setStyle(ButtonStyle.Secondary));
        if (methods.dm !== false) buttons.push(new ButtonBuilder().setCustomId('starry_verify_dm').setLabel('DM link').setStyle(ButtonStyle.Secondary));
        if (methods.rules !== false) buttons.push(new ButtonBuilder().setCustomId('starry_verify_rules').setLabel('Accept rules').setStyle(ButtonStyle.Secondary));
        if (!buttons.length) return interaction.reply({ content: 'No verification methods are enabled. Contact a server administrator.', ephemeral: true });
        const rows = [];
        for (let i = 0; i < buttons.length; i += 5) rows.push(new ActionRowBuilder().addComponents(buttons.slice(i, i + 5)));
        return interaction.reply({ content: 'Choose a verification method. Your account-age requirements apply to every method.', components: rows, ephemeral: true });
      }

      if (interaction.isButton() && interaction.customId.startsWith('starry_verify_') && interaction.customId !== 'starry_verify_open' && interaction.customId !== 'starry_verify_accept_rules') {
        const cfg = await getConfig(interaction.guildId);
        if (!cfg.enabled) return interaction.reply({ content: 'Verification is disabled.', ephemeral: true });
        const member = await interaction.guild.members.fetch(interaction.user.id).catch(() => null);
        if (!member) return interaction.reply({ content: 'Could not find your server membership. Please rejoin and try again.', ephemeral: true });
        const ageError = ageFailure(member, cfg);
        if (ageError) return interaction.reply({ content: '🛡️ ' + ageError, ephemeral: true });
        const role = await resolveTargetRole(interaction.guild, cfg.roleId);
        if (!role) return interaction.reply({ content: 'The verified role is not configured. Ask a server administrator.', ephemeral: true });
        if (member.roles.cache.has(role.id)) return interaction.reply({ content: 'You are already verified.', ephemeral: true });

        const method = interaction.customId.replace('starry_verify_', '');
        if (cfg.requireRules && method !== 'rules' && !client.verifyAcceptedRules.has(key(interaction.guildId, interaction.user.id))) return interaction.reply({ content: 'Please read and accept the server rules first.', ephemeral: true });
        if (method === 'math') {
          const a = crypto.randomInt(2, 10), b = crypto.randomInt(2, 10);
          pending.set(key(interaction.guildId, interaction.user.id), { answer: String(a + b), expires: Date.now() + 5 * 60000, attempts: 0 });
          const modal = new ModalBuilder().setCustomId('starry_verify_math_submit').setTitle('Human verification');
          const answer = new TextInputBuilder().setCustomId('answer').setLabel(`What is ${a} + ${b}?`).setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(3);
          modal.addComponents(new ActionRowBuilder().addComponents(answer));
          return interaction.showModal(modal);
        }
        if (method === 'captcha' || method === 'dm') {
          // Expire stale capabilities before issuing a new one and cap memory use under request floods.
          for (const [existingToken, session] of client.verifyMap) {
            if (!session?.expiresAt || session.expiresAt <= Date.now()) client.verifyMap.delete(existingToken);
          }
          if (client.verifyMap.size >= 10000) return interaction.reply({ content: 'Verification is temporarily busy. Please try again in a few minutes.', ephemeral: true });
          const token = crypto.randomBytes(24).toString('hex');
          client.verifyMap.set(token, { userId: interaction.user.id, guildId: interaction.guildId, roleId: role.id, expiresAt: Date.now() + 10 * 60000, minAccountAgeDays: Number(cfg.minAccountAgeDays) || 0, ageAction: cfg.ageAction || 'reject', requireAvatar: !!cfg.requireAvatar });
          const base = getPublicUrl() || '';
          const url = base ? `${base.replace(/\/$/, '')}/verify?token=${token}` : null;
          if (!url) return interaction.reply({ content: 'The verification website URL is not configured. Use another method or contact an administrator.', ephemeral: true });
          if (method === 'dm') {
            await interaction.user.send({ content: `Complete verification for **${interaction.guild.name}** within 10 minutes: ${url}` }).catch(() => null);
            return interaction.reply({ content: 'I sent your single-use verification link by DM. If DMs are closed, enable them or use another method.', ephemeral: true });
          }
          return interaction.reply({ content: `Your single-use web verification link (expires in 10 minutes): ${url}`, ephemeral: true });
        }
        if (method === 'button' || method === 'rules') {
          if (method === 'rules') {
            const accept = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('starry_verify_accept_rules').setLabel('I have read and accept the rules').setStyle(ButtonStyle.Success));
            return interaction.reply({ content: `**Server rules**\n${String(cfg.rulesText || 'I agree to follow the server rules and community guidelines.').slice(0, 1800)}\n\nPress below to confirm acceptance.`, components: [accept], ephemeral: true });
          }
          await grantVerified(member, role, client, method === 'rules' ? 'rules acceptance' : 'one-click');
          return interaction.reply({ content: '✅ Verification complete. Your verified role has been assigned.', ephemeral: true });
        }
      }

      if (interaction.isButton() && interaction.customId === 'starry_verify_accept_rules') {
        const cfg = await getConfig(interaction.guildId);
        const member = await interaction.guild.members.fetch(interaction.user.id).catch(() => null);
        if (!member) return interaction.reply({ content: 'Member not found.', ephemeral: true });
        const ageError = ageFailure(member, cfg);
        if (ageError) return interaction.reply({ content: ageError, ephemeral: true });
        client.verifyAcceptedRules.add(key(interaction.guildId, interaction.user.id));
        const role = await resolveTargetRole(interaction.guild, cfg.roleId);
        if (cfg.requireRules) return interaction.reply({ content: '✅ Rules accepted. Now choose another verification method to complete the checks.', ephemeral: true });
        await grantVerified(member, role, client, 'rules acceptance');
        return interaction.reply({ content: '✅ Rules accepted. You are verified.', ephemeral: true });
      }

      if (interaction.isModalSubmit() && interaction.customId === 'starry_verify_math_submit') {
        const id = key(interaction.guildId, interaction.user.id), challenge = pending.get(id);
        if (!challenge || challenge.expires < Date.now()) { pending.delete(id); return interaction.reply({ content: 'Challenge expired. Start verification again.', ephemeral: true }); }
        if (interaction.fields.getTextInputValue('answer').trim() !== challenge.answer) {
          challenge.attempts++;
          if (challenge.attempts >= 3) pending.delete(id);
          return interaction.reply({ content: challenge.attempts >= 3 ? 'Too many incorrect attempts. Start again.' : 'Incorrect answer. Please try again.', ephemeral: true });
        }
        pending.delete(id);
        const cfg = await getConfig(interaction.guildId), member = await interaction.guild.members.fetch(interaction.user.id).catch(() => null);
        if (!member) return interaction.reply({ content: 'Member not found.', ephemeral: true });
        const ageError = ageFailure(member, cfg);
        if (ageError) return interaction.reply({ content: ageError, ephemeral: true });
        const role = await resolveTargetRole(interaction.guild, cfg.roleId);
        await grantVerified(member, role, client, 'math challenge');
        return interaction.reply({ content: '✅ Correct. You are verified.', ephemeral: true });
      }
    } catch (error) {
      console.error('[Verification]', error);
      const payload = { content: `Verification could not be completed: ${error.message || 'Unknown error'}`, ephemeral: true };
      if (interaction.deferred || interaction.replied) await interaction.followUp(payload).catch(() => {});
      else await interaction.reply(payload).catch(() => {});
    }
  });
};

module.exports.resolveTargetRole = resolveTargetRole;
module.exports.getConfig = getConfig;
module.exports.ageFailure = ageFailure;
