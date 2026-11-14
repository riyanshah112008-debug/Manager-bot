'use strict';

const {
  PermissionsBitField, EmbedBuilder, MessageFlags, ActionRowBuilder,
  ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle,
  StringSelectMenuBuilder, ChannelType
} = require('discord.js');
const { randomUUID } = require('node:crypto');
const db = require('../utils/database');
const { serializeByKey, withDiscordRetry } = require('./reactionRoleReliability');

const EPHEMERAL = MessageFlags.Ephemeral ?? 64;
const sessions = new Map();
const emojiKey = e => e.id ? `custom:${e.id}` : `unicode:${e.name}`;

function parseEmoji(input) {
  const emoji = String(input || '').trim();
  const custom = emoji.match(/^<(a?):([\w~]+):(\d{17,20})>$/);
  if (custom) {
    return {
      display: emoji,
      reaction: `${custom[2]}:${custom[3]}`,
      key: `custom:${custom[3]}`,
      animated: custom[1] === 'a'
    };
  }
  if (!emoji || emoji.length > 32 || /[\s=|]/u.test(emoji)) {
    throw new Error('Enter one valid Unicode emoji or a custom emoji mention.');
  }
  return { display: emoji, reaction: emoji, key: `unicode:${emoji}`, animated: false };
}

function parseRole(input, guild) {
  const value = String(input || '').trim();
  const id = value.match(/^(?:<@&)?(\d{17,20})>?$/)?.[1];
  const role = id ? guild.roles.cache.get(id) : guild.roles.cache.find(r => r.name.toLowerCase() === value.toLowerCase());
  if (!role || role.id === guild.id || role.managed) {
    throw new Error('Role not found. Paste its @mention or ID, and make sure it is assignable.');
  }
  return role;
}

function sessionEmbed(session) {
  const lines = session.mappings.length
    ? session.mappings.map((m, index) => `**${index + 1}.** ${m.emoji}  <@&${m.roleId}>`).join('\n')
    : '*No roles added yet. Select **Add role** to begin.*';
  return new EmbedBuilder()
    .setColor(0x5865F2)
    .setTitle('Reaction Roles • Panel Builder')
    .setDescription(`Configure your self-assignable roles below.\n\n${lines}`)
    .addFields(
      { name: 'Destination', value: `<#${session.channelId}>`, inline: true },
      { name: 'Selection mode', value: session.mode === 'single' ? 'One role at a time' : 'Multiple roles', inline: true },
      { name: 'Roles', value: `${session.mappings.length}/20`, inline: true }
    )
    .setFooter({ text: 'Add roles, choose a mode, then publish when ready.' });
}

function sessionComponents(session) {
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`rr:add:${session.id}`).setLabel('Add role').setStyle(ButtonStyle.Primary).setEmoji('➕'),
    new ButtonBuilder().setCustomId(`rr:remove:${session.id}`).setLabel('Remove role').setStyle(ButtonStyle.Secondary).setEmoji('➖').setDisabled(!session.mappings.length),
    new ButtonBuilder().setCustomId(`rr:mode:${session.id}`).setLabel(session.mode === 'single' ? 'Switch to multiple' : 'Switch to single').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId(`rr:publish:${session.id}`).setLabel('Publish panel').setStyle(ButtonStyle.Success).setEmoji('📨').setDisabled(!session.mappings.length),
    new ButtonBuilder().setCustomId(`rr:cancel:${session.id}`).setLabel('Cancel').setStyle(ButtonStyle.Danger)
  );
  return [row];
}

async function openBuilder(i) {
  const channel = i.options.getChannel('channel') || i.channel;
  if (!channel?.isTextBased() || !channel.send) {
    return i.reply({ content: 'Choose a text channel for the reaction-role panel.', flags: EPHEMERAL });
  }
  const me = i.guild.members.me || await i.guild.members.fetchMe();
  const needed = [
    PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages,
    PermissionsBitField.Flags.EmbedLinks, PermissionsBitField.Flags.AddReactions,
    PermissionsBitField.Flags.ReadMessageHistory, PermissionsBitField.Flags.ManageRoles
  ];
  if (!channel.permissionsFor(me)?.has(needed)) {
    return i.reply({ content: 'I need View Channel, Send Messages, Embed Links, Add Reactions, Read Message History and Manage Roles in that channel.', flags: EPHEMERAL });
  }
  const id = randomUUID().replace(/-/g, '').slice(0, 16);
  const session = { id, ownerId: i.user.id, guildId: i.guild.id, channelId: channel.id, mode: 'multiple', mappings: [], createdAt: Date.now() };
  sessions.set(id, session);
  await i.reply({ embeds: [sessionEmbed(session)], components: sessionComponents(session), flags: EPHEMERAL });
  session.builderMessage = await i.fetchReply().catch(() => null);
  return;
}

async function publish(i, session) {
  const channel = await i.guild.channels.fetch(session.channelId).catch(() => null);
  if (!channel?.isTextBased() || !channel.send) {
    return i.reply({ content: 'The destination channel is no longer available.', flags: EPHEMERAL });
  }
  const me = i.guild.members.me || await i.guild.members.fetchMe();
  const missing = session.mappings.find(m => {
    const role = i.guild.roles.cache.get(m.roleId);
    return !role || role.managed || role.position >= me.roles.highest.position;
  });
  if (missing) {
    return i.reply({ content: `Move my highest role above <@&${missing.roleId}> and try publishing again.`, flags: EPHEMERAL });
  }
  const needsExternal = session.mappings.some(m => m.emojiKey.startsWith('custom:') && !i.guild.emojis.cache.has(m.emojiKey.slice(7)));
  if (needsExternal && !channel.permissionsFor(me)?.has(PermissionsBitField.Flags.UseExternalEmojis)) {
    return i.reply({ content: 'I need **Use External Emojis** in the destination channel to use emojis from other servers.', flags: EPHEMERAL });
  }
  const body = session.mappings.map(m => `${m.emoji}  <@&${m.roleId}>`).join('\n');
  const embed = new EmbedBuilder()
    .setColor(0x5865F2)
    .setTitle('Choose your roles')
    .setDescription(`${body}\n\nReact below to ${session.mode === 'single' ? 'select one role. Choosing another replaces it.' : 'add roles. Remove your reaction to remove a role.'}`)
    .setFooter({ text: session.mode === 'single' ? 'Single selection' : 'Multiple selections' });
  await i.deferReply({ flags: EPHEMERAL });
  let message;
  try {
    message = await channel.send({ embeds: [embed], allowedMentions: { parse: [] } });
    for (const mapping of session.mappings) await message.react(mapping.reaction);
    db.setReactionRolePanel(i.guild.id, message.id, {
      channelId: channel.id, mode: session.mode, mappings: session.mappings,
      createdBy: i.user.id
    });
    sessions.delete(session.id);
    return i.editReply(`✅ Reaction-role panel published in <#${channel.id}> with ${session.mappings.length} roles.`);
  } catch (error) {
    if (message) await message.delete().catch(() => {});
    console.error('[ReactionRoles] Publish failed:', error);
    return i.editReply('❌ I could not publish the panel. Check my channel permissions and emoji access.');
  }
}

async function handleReaction(reaction, user, adding) {
  if (!user || user.bot) return;
  return serializeByKey(user.id, async () => {
    if (reaction?.partial) {
      try { reaction = await withDiscordRetry(() => reaction.fetch(), { label: 'fetch partial reaction' }); }
      catch (error) { console.warn('[ReactionRoles] Could not fetch partial reaction:', error.message); return; }
    }
    if (!reaction?.message) return;
    if (reaction.message.partial) {
      try { await withDiscordRetry(() => reaction.message.fetch(), { label: 'fetch partial panel message' }); }
      catch (error) { console.warn('[ReactionRoles] Could not fetch partial panel message:', error.message); return; }
    }
    const guild = reaction.message.guild;
    if (!guild) return;
    const panel = db.getReactionRolePanels(guild.id)?.[reaction.message.id];
    if (!panel || !Array.isArray(panel.mappings)) return;
    const mapping = panel.mappings.find(x => x.emojiKey === emojiKey(reaction.emoji));
    if (!mapping?.roleId) return;

    const member = await withDiscordRetry(() => guild.members.fetch({ user: user.id, force: true }), { label: 'fetch member' })
      .catch(error => { console.warn(`[ReactionRoles] Could not fetch member ${user.id} in ${guild.id}:`, error.message); return null; });
    if (!member || member.user?.bot) return;
    const me = guild.members.me || await withDiscordRetry(() => guild.members.fetchMe(), { label: 'fetch bot member' })
      .catch(error => { console.warn(`[ReactionRoles] Could not fetch bot member in ${guild.id}:`, error.message); return null; });
    if (!me) return;

    const role = guild.roles.cache.get(mapping.roleId) || await withDiscordRetry(() => guild.roles.fetch(mapping.roleId), { label: 'fetch reaction role' })
      .catch(error => { console.warn(`[ReactionRoles] Could not resolve role ${mapping.roleId} in ${guild.id}:`, error.message); return null; });
    if (!role || role.managed || role.id === guild.id) return;
    if (!me.permissions.has(PermissionsBitField.Flags.ManageRoles) || role.position >= me.roles.highest.position) {
      console.warn(`[ReactionRoles] Cannot assign role ${role.id} in ${guild.id}: check Manage Roles and role hierarchy.`);
      return;
    }

    try {
      if (adding && panel.mode === 'single') {
        await Promise.all(panel.mappings
          .filter(x => x.roleId !== role.id && !guild.roles.cache.has(x.roleId))
          .map(x => withDiscordRetry(() => guild.roles.fetch(x.roleId), { label: 'fetch mapped single-select role' })
            .catch(error => { console.warn(`[ReactionRoles] Could not resolve mapped role ${x.roleId} in ${guild.id}:`, error.message); return null; })));
        const remove = panel.mappings.filter(x => x.roleId !== role.id).map(x => x.roleId)
          .filter(id => member.roles.cache.has(id));
        for (const id of remove) {
          await withDiscordRetry(() => member.roles.remove(id, 'Single-select reaction role'), { label: 'remove previous reaction role' });
        }
      }
      const refreshed = await withDiscordRetry(() => guild.members.fetch({ user: user.id, force: true }), { label: 'refresh member before role mutation' });
      if (adding) {
        if (!refreshed.roles.cache.has(role.id)) {
          await withDiscordRetry(() => refreshed.roles.add(role.id, 'Reaction role selection'), { label: 'add reaction role' });
        }
      } else if (refreshed.roles.cache.has(role.id)) {
        await withDiscordRetry(() => refreshed.roles.remove(role.id, 'Reaction role deselection'), { label: 'remove reaction role' });
      }
    } catch (error) {
      console.error(`[ReactionRoles] Assignment failed (guild=${guild.id}, user=${user.id}, role=${role.id}, action=${adding ? 'add' : 'remove'}):`, error.message);
    }
  });
}

module.exports = client => {
  client.on('interactionCreate', async i => {
    if (!i.guild) return;
    if (i.isChatInputCommand() && i.commandName === 'reactionroles') {
      const allowed = i.memberPermissions?.has(PermissionsBitField.Flags.ManageRoles)
        || i.memberPermissions?.has(PermissionsBitField.Flags.Administrator);
      if (!allowed) return i.reply({ content: 'You need Manage Roles permission.', flags: EPHEMERAL }).catch(() => {});
      return openBuilder(i).catch(error => {
        console.error('[ReactionRoles] Builder failed:', error);
        const payload = { content: 'Could not open the reaction-role builder. Check permissions and try again.', flags: EPHEMERAL };
        return (i.deferred || i.replied) ? i.followUp(payload).catch(() => {}) : i.reply(payload).catch(() => {});
      });
    }

    const customId = i.customId || '';
    const match = customId.match(/^rr:(add|remove|mode|publish|cancel|save):([a-f0-9]+)$/);
    if (!match) return;
    const [, action, id] = match;
    const session = sessions.get(id);
    if (!session || session.guildId !== i.guild.id || session.ownerId !== i.user.id) {
      return i.reply({ content: 'This builder has expired or belongs to another moderator. Run /reactionroles again.', flags: EPHEMERAL }).catch(() => {});
    }
    if (Date.now() - session.createdAt > 15 * 60 * 1000) {
      sessions.delete(id);
      return i.reply({ content: 'This builder expired. Run /reactionroles again.', flags: EPHEMERAL }).catch(() => {});
    }

    if (i.isButton()) {
      if (action === 'add') {
        const modal = new ModalBuilder().setCustomId(`rr:save:${id}`).setTitle('Add a reaction role');
        const emojiInput = new TextInputBuilder().setCustomId('emoji').setLabel('Emoji (Unicode or custom emoji)').setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(100).setPlaceholder('🎮 or <:name:id> or <a:name:id>');
        const roleInput = new TextInputBuilder().setCustomId('role').setLabel('Role mention or role ID').setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(100).setPlaceholder('@Gamer or role ID');
        modal.addComponents(new ActionRowBuilder().addComponents(emojiInput), new ActionRowBuilder().addComponents(roleInput));
        return i.showModal(modal);
      }
      if (action === 'remove') {
        const menu = new StringSelectMenuBuilder().setCustomId(`rr:remove:${id}`).setPlaceholder('Select a role mapping to remove').setMinValues(1).setMaxValues(Math.min(session.mappings.length, 20))
          .addOptions(session.mappings.map((m, index) => ({ label: m.roleName.slice(0, 80), description: `Remove ${m.emoji}`, value: String(index), emoji: m.emoji.startsWith('<') ? undefined : m.emoji })));
        return i.reply({ content: 'Choose the mappings to remove:', components: [new ActionRowBuilder().addComponents(menu)], flags: EPHEMERAL });
      }
      if (action === 'mode') {
        session.mode = session.mode === 'single' ? 'multiple' : 'single';
        return i.update({ embeds: [sessionEmbed(session)], components: sessionComponents(session) });
      }
      if (action === 'publish') return publish(i, session);
      if (action === 'cancel') {
        sessions.delete(id);
        return i.update({ content: 'Reaction-role setup cancelled.', embeds: [], components: [] });
      }
    }

    if (i.isModalSubmit() && action === 'save') {
      let parsed, role;
      try {
        parsed = parseEmoji(i.fields.getTextInputValue('emoji'));
        role = parseRole(i.fields.getTextInputValue('role'), i.guild);
        if (session.mappings.length >= 20) throw new Error('A panel can contain up to 20 role mappings.');
        if (session.mappings.some(m => m.emojiKey === parsed.key)) throw new Error('That emoji is already used in this panel.');
        if (session.mappings.some(m => m.roleId === role.id)) throw new Error('That role is already used in this panel.');
        const me = i.guild.members.me || await i.guild.members.fetchMe();
        if (role.position >= me.roles.highest.position) throw new Error(`Move my highest role above <@&${role.id}> first.`);
        session.mappings.push({ emoji: parsed.display, reaction: parsed.reaction, emojiKey: parsed.key, roleId: role.id, roleName: role.name, animated: parsed.animated });
        await session.builderMessage?.edit({ embeds: [sessionEmbed(session)], components: sessionComponents(session) }).catch(() => {});
        return i.reply({ content: `Added ${parsed.display} → <@&${role.id}>.`, flags: EPHEMERAL });
      } catch (error) {
        return i.reply({ content: `❌ ${error.message}`, flags: EPHEMERAL });
      }
    }

    if (i.isStringSelectMenu() && action === 'remove') {
      const indexes = i.values.map(Number).filter(n => Number.isInteger(n) && n >= 0 && n < session.mappings.length);
      session.mappings = session.mappings.filter((_, index) => !indexes.includes(index));
      await session.builderMessage?.edit({ embeds: [sessionEmbed(session)], components: sessionComponents(session) }).catch(() => {});
      return i.update({ content: `Removed ${indexes.length} mapping(s). The builder has been updated.`, components: [] });
    }
  });

  client.on('messageReactionAdd', (reaction, user) => {
    handleReaction(reaction, user, true).catch(error =>
      console.error('[ReactionRoles] Unhandled add event failure:', error)
    );
  });
  client.on('messageReactionRemove', (reaction, user) => {
    handleReaction(reaction, user, false).catch(error =>
      console.error('[ReactionRoles] Unhandled remove event failure:', error)
    );
  });
  const { createReconciler } = require('./reactionRoleReconciler');
  createReconciler(client, db, serializeByKey, withDiscordRetry);
};
