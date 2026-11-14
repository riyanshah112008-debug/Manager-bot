'use strict';

const { PermissionsBitField } = require('discord.js');
const { planUserRepairs } = require('./reactionRoleReconciliation');

const SCAN_INTERVAL_MS = 15 * 60 * 1000;
const PAGE_SIZE = 100;
const emojiKey = emoji => emoji?.id ? `custom:${emoji.id}` : `unicode:${emoji?.name || ''}`;

async function fetchAllReactionUsers(reaction, withDiscordRetry) {
  const users = new Map();
  let after;
  for (;;) {
    const page = await withDiscordRetry(
      () => reaction.users.fetch({ limit: PAGE_SIZE, ...(after ? { after } : {}) }),
      { label: 'fetch reaction-role voters' }
    );
    for (const user of page.values()) {
      if (user && !user.bot) users.set(user.id, user);
    }
    if (page.size < PAGE_SIZE) break;
    const last = [...page.keys()].at(-1);
    if (!last || last === after) break;
    after = last;
  }
  return users;
}

function createReconciler(client, db, serializeByKey, withDiscordRetry) {
  let scanInFlight = false;

  async function reconcilePanel(guild, messageId, panel, totals) {
    if (!panel || !Array.isArray(panel.mappings) || !panel.mappings.length) return;
    const channel = await withDiscordRetry(
      () => guild.channels.fetch(panel.channelId),
      { label: 'fetch reaction-role channel' }
    ).catch(error => {
      console.warn(`[ReactionRoles] Reconcile: cannot fetch channel ${panel.channelId} in ${guild.id}: ${error.message}`);
      return null;
    });
    if (!channel?.isTextBased?.() || !channel.messages?.fetch) return;

    const message = await withDiscordRetry(
      () => channel.messages.fetch(messageId),
      { label: 'fetch reaction-role panel message' }
    ).catch(error => {
      console.warn(`[ReactionRoles] Reconcile: cannot fetch panel ${messageId} in ${guild.id}: ${error.message}`);
      return null;
    });
    if (!message) return;

    const botMember = guild.members.me || await withDiscordRetry(
      () => guild.members.fetchMe(),
      { label: 'fetch bot member for reaction-role reconciliation' }
    ).catch(error => {
      console.warn(`[ReactionRoles] Reconcile: cannot fetch bot member in ${guild.id}: ${error.message}`);
      return null;
    });
    if (!botMember?.permissions?.has(PermissionsBitField.Flags.ManageRoles)) {
      console.warn(`[ReactionRoles] Reconcile: Manage Roles is unavailable in guild ${guild.id}.`);
      return;
    }

    const usableMappings = [];
    for (const mapping of panel.mappings) {
      if (!mapping?.roleId || !mapping?.emojiKey) continue;
      const role = guild.roles.cache.get(mapping.roleId) || await withDiscordRetry(
        () => guild.roles.fetch(mapping.roleId),
        { label: 'fetch mapped role for reconciliation' }
      ).catch(error => {
        console.warn(`[ReactionRoles] Reconcile: cannot fetch role ${mapping.roleId} in ${guild.id}: ${error.message}`);
        return null;
      });
      if (!role || role.managed || role.id === guild.id || role.position >= botMember.roles.highest.position) {
        totals.unassignable += 1;
        continue;
      }
      usableMappings.push({ ...mapping, role });
    }
    if (!usableMappings.length) return;

    // Fetch each configured reaction's complete voter list. A missing reaction
    // means nobody currently has that selection; failed fetches are skipped.
    const votersByRole = new Map();
    let voterFetchIncomplete = false;
    for (const mapping of usableMappings) {
      const reaction = message.reactions.cache.find(item => emojiKey(item.emoji) === mapping.emojiKey);
      if (!reaction) {
        votersByRole.set(mapping.roleId, new Set());
        continue;
      }
      try {
        const voters = await fetchAllReactionUsers(reaction, withDiscordRetry);
        votersByRole.set(mapping.roleId, new Set(voters.keys()));
      } catch (error) {
        totals.fetchFailures += 1;
        voterFetchIncomplete = true;
        console.warn(`[ReactionRoles] Reconcile: could not read voters for ${mapping.emoji} on ${messageId}: ${error.message}`);
      }
    }

    // In single-select mode, an unreadable reaction makes the user's intended
    // choice ambiguous. Skip the panel rather than assigning the wrong role.
    if (panel.mode === 'single' && voterFetchIncomplete) {
      console.warn(`[ReactionRoles] Reconcile: skipped single-select panel ${messageId} because at least one voter list could not be read.`);
      return;
    }

    const userIds = new Set();
    for (const ids of votersByRole.values()) for (const id of ids) userIds.add(id);

    for (const userId of userIds) {
      await serializeByKey(userId, async () => {
        const member = await withDiscordRetry(
          () => guild.members.fetch({ user: userId, force: true }),
          { label: 'fetch member during reaction-role reconciliation' }
        ).catch(error => {
          totals.memberFailures += 1;
          console.warn(`[ReactionRoles] Reconcile: cannot fetch member ${userId} in ${guild.id}: ${error.message}`);
          return null;
        });
        if (!member || member.user?.bot) return;

        const selectedRoleIds = usableMappings
          .filter(mapping => votersByRole.get(mapping.roleId)?.has(userId))
          .map(mapping => mapping.roleId);
        const repairs = planUserRepairs(panel, selectedRoleIds, member.roles.cache.keys());
        for (const roleId of repairs) {
          const mapping = usableMappings.find(item => item.roleId === roleId);
          try {
            await withDiscordRetry(
              () => member.roles.add(mapping.role, 'Automatic reaction-role reconciliation'),
              { label: 'restore missing reaction role' }
            );
            totals.repaired += 1;
            console.log(`[ReactionRoles] Reconciled missing role ${roleId} to member ${userId} in guild ${guild.id}.`);
          } catch (error) {
            totals.assignmentFailures += 1;
            console.error(`[ReactionRoles] Reconcile assignment failed (guild=${guild.id}, user=${userId}, role=${roleId}): ${error.message}`);
          }
        }
        if (panel.mode === 'single' && selectedRoleIds.length > 1) totals.ambiguousSingleSelect += 1;
      });
    }
  }

  async function reconcileAll(reason = 'scheduled') {
    if (scanInFlight || !client.isReady()) return;
    scanInFlight = true;
    const totals = {
      panels: 0, repaired: 0, unassignable: 0, fetchFailures: 0,
      memberFailures: 0, assignmentFailures: 0, ambiguousSingleSelect: 0
    };
    try {
      for (const guild of client.guilds.cache.values()) {
        const panels = db.getReactionRolePanels(guild.id) || {};
        for (const [messageId, panel] of Object.entries(panels)) {
          totals.panels += 1;
          try {
            await reconcilePanel(guild, messageId, panel, totals);
          } catch (error) {
            console.error(`[ReactionRoles] Reconcile panel failed (guild=${guild.id}, message=${messageId}): ${error.stack || error}`);
          }
        }
      }
      console.log(`[ReactionRoles] Reconciliation ${reason} complete: ${JSON.stringify(totals)}`);
    } catch (error) {
      console.error('[ReactionRoles] Reconciliation scan failed:', error.stack || error);
    } finally {
      scanInFlight = false;
    }
  }

  let started = false;
  function start() {
    if (started) return;
    started = true;
    // Give the gateway/cache a moment to settle before the first full scan.
    setTimeout(() => reconcileAll('startup'), 30_000);
    const timer = setInterval(() => reconcileAll('scheduled'), SCAN_INTERVAL_MS);
    timer.unref?.();
    console.log('[ReactionRoles] Automatic reconciliation enabled (startup + every 15 minutes).');
  }

  if (client.isReady()) start();
  else client.once('ready', start);

  return { reconcileAll };
}

module.exports = { createReconciler, fetchAllReactionUsers, SCAN_INTERVAL_MS };
