// ==========================================
// 🛡️ FLAVI-STYLE SUPREME MODERATION SUITE (32 COMMANDS)
// File Path: src/commands/bundles/moderationCommands.js
// Hierarchy Protection, Instant DM Notices, 1-Year Mod Panels
// ==========================================
const { 
    EmbedBuilder, 
    ActionRowBuilder, 
    ButtonBuilder, 
    ButtonStyle, 
    PermissionFlagsBits,
    ChannelType 
} = require('discord.js');
const config = require('../../config');
const { ONE_YEAR_MS } = require('../../utils/contextHelper');

// Helper to parse duration string like 10m, 1h, 1d to ms
function parseDuration(str) {
    if (!str) return null;
    const match = str.match(/^(\d+)(s|m|h|d|w)?$/i);
    if (!match) return null;
    const num = parseInt(match[1]);
    const unit = (match[2] || 'm').toLowerCase();
    switch (unit) {
        case 's': return num * 1000;
        case 'm': return num * 60 * 1000;
        case 'h': return num * 60 * 60 * 1000;
        case 'd': return num * 24 * 60 * 60 * 1000;
        case 'w': return num * 7 * 24 * 60 * 60 * 1000;
        default: return num * 60 * 1000;
    }
}

// Check if executor can moderate target
function checkHierarchy(executorMember, targetMember, guild) {
    if (config.BOT_OWNERS.includes(executorMember.id)) return { allowed: true };
    if (executorMember.id === guild.ownerId) return { allowed: true };
    if (targetMember.id === executorMember.id) return { allowed: false, reason: "You cannot moderate yourself!" };
    if (targetMember.id === guild.ownerId) return { allowed: false, reason: "You cannot moderate the Server Owner!" };
    if (targetMember.roles.highest.position >= executorMember.roles.highest.position) {
        return { allowed: false, reason: "Target has a higher or equal role than you!" };
    }
    const botMember = guild.members.me;
    if (targetMember.roles.highest.position >= botMember.roles.highest.position) {
        return { allowed: false, reason: "Bot cannot moderate this user due to role hierarchy!" };
    }
    return { allowed: true };
}

// Extract target user / member from args or mentions
async function resolveTarget(ctx, argIndex = 0) {
    if (ctx.isSlash) {
        const u = ctx.interaction.options.getUser('target') || ctx.interaction.options.getUser('user');
        if (u) {
            const m = await ctx.guild.members.fetch(u.id).catch(() => null);
            return { user: u, member: m };
        }
    }
    if (ctx.message?.mentions?.users?.size > 0) {
        const u = ctx.message.mentions.users.first();
        const m = await ctx.guild.members.fetch(u.id).catch(() => null);
        return { user: u, member: m };
    }
    const rawId = ctx.args[argIndex]?.replace(/[^0-9]/g, '');
    if (rawId) {
        const u = await ctx.client.users.fetch(rawId).catch(() => null);
        const m = await ctx.guild.members.fetch(rawId).catch(() => null);
        if (u) return { user: u, member: m };
    }
    return { user: null, member: null };
}

// In-memory / MongoDB warning store helper
const warningMemoryMap = new Map();

const commands = [
    // 1. BAN
    {
        name: 'ban',
        aliases: ['b'],
        category: 'Moderation',
        description: 'Ban a member from the server with optional reason.',
        usage: ',ban <@user / ID> [reason]',
        permissions: [PermissionFlagsBits.BanMembers],
        async execute(ctx) {
            if (!ctx.member.permissions.has(PermissionFlagsBits.BanMembers) && !config.BOT_OWNERS.includes(ctx.user.id)) {
                return ctx.reply('❌ You need **Ban Members** permission to use this command.');
            }
            const { user: targetUser, member: targetMember } = await resolveTarget(ctx, 0);
            if (!targetUser) return ctx.reply('❌ Please mention a user or provide a valid User ID to ban.\n*Usage: `,ban @user [reason]`*');

            if (targetMember) {
                const hier = checkHierarchy(ctx.member, targetMember, ctx.guild);
                if (!hier.allowed) return ctx.reply(`❌ Cannot ban: **${hier.reason}**`);
            }

            const reason = ctx.args.slice(1).join(' ') || 'No reason provided';
            await targetUser.send(`🔨 You were banned from **${ctx.guild.name}**\n**Reason:** ${reason}\n**Moderator:** ${ctx.user.tag}`).catch(() => {});
            await ctx.guild.members.ban(targetUser.id, { reason: `${reason} | By: ${ctx.user.tag}` });

            const embed = new EmbedBuilder()
                .setColor(config.EMBED_COLORS.DANGER)
                .setTitle('🔨 Member Banned')
                .setThumbnail(targetUser.displayAvatarURL({ dynamic: true }))
                .addFields(
                    { name: '👤 User', value: `${targetUser.tag} (\`${targetUser.id}\`)`, inline: true },
                    { name: '🛡️ Moderator', value: `${ctx.user.tag}`, inline: true },
                    { name: '📝 Reason', value: `>>> ${reason}`, inline: false }
                )
                .setFooter({ text: 'Flavi Moderation Engine • Prefix: ,' })
                .setTimestamp();
            return ctx.reply({ embeds: [embed] });
        }
    },

    // 2. UNBAN
    {
        name: 'unban',
        aliases: ['ub'],
        category: 'Moderation',
        description: 'Unban a user by their User ID.',
        usage: ',unban <User ID> [reason]',
        permissions: [PermissionFlagsBits.BanMembers],
        async execute(ctx) {
            if (!ctx.member.permissions.has(PermissionFlagsBits.BanMembers) && !config.BOT_OWNERS.includes(ctx.user.id)) {
                return ctx.reply('❌ You need **Ban Members** permission to use this command.');
            }
            const userId = ctx.args[0]?.replace(/[^0-9]/g, '');
            if (!userId) return ctx.reply('❌ Provide the User ID to unban: `,unban 123456789012345678`');

            const reason = ctx.args.slice(1).join(' ') || 'No reason provided';
            try {
                await ctx.guild.members.unban(userId, `${reason} | By: ${ctx.user.tag}`);
                return ctx.reply(`✅ **Successfully unbanned User ID \`${userId}\`.**`);
            } catch (err) {
                return ctx.reply(`❌ Could not unban User ID \`${userId}\`. Ensure the ID is valid and currently banned.`);
            }
        }
    },

    // 3. SOFTBAN
    {
        name: 'softban',
        aliases: ['sb'],
        category: 'Moderation',
        description: 'Ban and immediately unban a member to wipe their recent messages.',
        usage: ',softban <@user / ID> [reason]',
        permissions: [PermissionFlagsBits.BanMembers],
        async execute(ctx) {
            if (!ctx.member.permissions.has(PermissionFlagsBits.BanMembers) && !config.BOT_OWNERS.includes(ctx.user.id)) {
                return ctx.reply('❌ You need **Ban Members** permission.');
            }
            const { user: targetUser, member: targetMember } = await resolveTarget(ctx, 0);
            if (!targetUser) return ctx.reply('❌ Specify a user to softban.');
            if (targetMember) {
                const hier = checkHierarchy(ctx.member, targetMember, ctx.guild);
                if (!hier.allowed) return ctx.reply(`❌ Cannot softban: **${hier.reason}**`);
            }
            const reason = ctx.args.slice(1).join(' ') || 'Softban message cleanup';
            await ctx.guild.members.ban(targetUser.id, { reason: `Softban: ${reason}`, deleteMessageSeconds: 7 * 86400 });
            await ctx.guild.members.unban(targetUser.id, 'Softban unban');
            return ctx.reply(`🧹 **Softbanned ${targetUser.tag}** (Wiped 7 days of messages).`);
        }
    },

    // 4. TEMPBAN
    {
        name: 'tempban',
        aliases: ['tb'],
        category: 'Moderation',
        description: 'Temporarily ban a user for a specified duration (e.g. 1d, 12h).',
        usage: ',tempban <@user / ID> <duration> [reason]',
        permissions: [PermissionFlagsBits.BanMembers],
        async execute(ctx) {
            if (!ctx.member.permissions.has(PermissionFlagsBits.BanMembers) && !config.BOT_OWNERS.includes(ctx.user.id)) {
                return ctx.reply('❌ You need **Ban Members** permission.');
            }
            const { user: targetUser, member: targetMember } = await resolveTarget(ctx, 0);
            if (!targetUser) return ctx.reply('❌ Specify a user to tempban.');
            if (targetMember) {
                const hier = checkHierarchy(ctx.member, targetMember, ctx.guild);
                if (!hier.allowed) return ctx.reply(`❌ Cannot tempban: **${hier.reason}**`);
            }
            const durationMs = parseDuration(ctx.args[1]);
            if (!durationMs) return ctx.reply('❌ Invalid duration! Example: `,tempban @user 1d Rule violations` (units: m, h, d, w)');
            const reason = ctx.args.slice(2).join(' ') || 'Temporary Ban';

            await ctx.guild.members.ban(targetUser.id, { reason: `Tempban (${ctx.args[1]}): ${reason}` });
            setTimeout(async () => {
                await ctx.guild.members.unban(targetUser.id, 'Tempban expired').catch(() => {});
            }, durationMs);

            return ctx.reply(`⏳ **Tempbanned ${targetUser.tag}** for **${ctx.args[1]}**.`);
        }
    },

    // 5. KICK
    {
        name: 'kick',
        aliases: ['k'],
        category: 'Moderation',
        description: 'Kick a member from the server.',
        usage: ',kick <@user / ID> [reason]',
        permissions: [PermissionFlagsBits.KickMembers],
        async execute(ctx) {
            if (!ctx.member.permissions.has(PermissionFlagsBits.KickMembers) && !config.BOT_OWNERS.includes(ctx.user.id)) {
                return ctx.reply('❌ You need **Kick Members** permission.');
            }
            const { user: targetUser, member: targetMember } = await resolveTarget(ctx, 0);
            if (!targetMember) return ctx.reply('❌ Please specify a member currently in the server.');
            const hier = checkHierarchy(ctx.member, targetMember, ctx.guild);
            if (!hier.allowed) return ctx.reply(`❌ Cannot kick: **${hier.reason}**`);

            const reason = ctx.args.slice(1).join(' ') || 'No reason provided';
            await targetUser.send(`🚪 You were kicked from **${ctx.guild.name}**\n**Reason:** ${reason}`).catch(() => {});
            await targetMember.kick(`${reason} | By: ${ctx.user.tag}`);

            return ctx.reply(`🚪 **Successfully kicked ${targetUser.tag}** from the server.`);
        }
    },

    // 6. MUTE / TIMEOUT
    {
        name: 'mute',
        aliases: ['timeout', 'tempmute', 'm'],
        category: 'Moderation',
        description: 'Timeout/mute a member for a duration (e.g. 10m, 1h, 1d).',
        usage: ',mute <@user> [duration] [reason]',
        permissions: [PermissionFlagsBits.ModerateMembers],
        async execute(ctx) {
            if (!ctx.member.permissions.has(PermissionFlagsBits.ModerateMembers) && !config.BOT_OWNERS.includes(ctx.user.id)) {
                return ctx.reply('❌ You need **Timeout Members** permission.');
            }
            const { user: targetUser, member: targetMember } = await resolveTarget(ctx, 0);
            if (!targetMember) return ctx.reply('❌ Specify a member to mute.');
            const hier = checkHierarchy(ctx.member, targetMember, ctx.guild);
            if (!hier.allowed) return ctx.reply(`❌ Cannot mute: **${hier.reason}**`);

            const durationMs = parseDuration(ctx.args[1]) || 10 * 60 * 1000;
            const reason = (parseDuration(ctx.args[1]) ? ctx.args.slice(2).join(' ') : ctx.args.slice(1).join(' ')) || 'No reason provided';

            await targetMember.timeout(durationMs, `${reason} | By: ${ctx.user.tag}`);
            return ctx.reply(`🔇 **Timed out ${targetUser.tag}** for **${formatTime(durationMs)}**.\n**Reason:** ${reason}`);
        }
    },

    // 7. UNMUTE / UNTIMEOUT
    {
        name: 'unmute',
        aliases: ['untimeout', 'um'],
        category: 'Moderation',
        description: 'Remove timeout/mute from a member.',
        usage: ',unmute <@user>',
        permissions: [PermissionFlagsBits.ModerateMembers],
        async execute(ctx) {
            if (!ctx.member.permissions.has(PermissionFlagsBits.ModerateMembers) && !config.BOT_OWNERS.includes(ctx.user.id)) {
                return ctx.reply('❌ You need **Timeout Members** permission.');
            }
            const { user: targetUser, member: targetMember } = await resolveTarget(ctx, 0);
            if (!targetMember) return ctx.reply('❌ Specify a member to unmute.');
            await targetMember.timeout(null, `Untimeout by ${ctx.user.tag}`);
            return ctx.reply(`🔊 **Removed timeout from ${targetUser.tag}.**`);
        }
    },

    // 8. WARN
    {
        name: 'warn',
        aliases: ['w'],
        category: 'Moderation',
        description: 'Issue an official warning to a user.',
        usage: ',warn <@user> <reason>',
        permissions: [PermissionFlagsBits.ModerateMembers],
        async execute(ctx) {
            if (!ctx.member.permissions.has(PermissionFlagsBits.ModerateMembers) && !config.BOT_OWNERS.includes(ctx.user.id)) {
                return ctx.reply('❌ You need **Moderate Members** permission.');
            }
            const { user: targetUser } = await resolveTarget(ctx, 0);
            if (!targetUser) return ctx.reply('❌ Specify a user to warn.');
            const reason = ctx.args.slice(1).join(' ');
            if (!reason) return ctx.reply('❌ Please provide a reason for the warning.');

            const key = `${ctx.guild.id}-${targetUser.id}`;
            const current = warningMemoryMap.get(key) || [];
            const warnId = Math.random().toString(36).substring(2, 7).toUpperCase();
            current.push({ id: warnId, reason, mod: ctx.user.tag, date: new Date().toISOString() });
            warningMemoryMap.set(key, current);

            await targetUser.send(`⚠️ You were officially warned in **${ctx.guild.name}**\n**Reason:** ${reason}\n**Moderator:** ${ctx.user.tag}`).catch(() => {});
            return ctx.reply(`⚠️ **Warned ${targetUser.tag}** (Warn ID: \`#${warnId}\` | Total Warns: \`${current.length}\`).\n**Reason:** ${reason}`);
        }
    },

    // 9. WARNINGS / WARNS
    {
        name: 'warnings',
        aliases: ['warns'],
        category: 'Moderation',
        description: 'View active warnings for a user.',
        usage: ',warnings <@user>',
        async execute(ctx) {
            const { user: targetUser } = await resolveTarget(ctx, 0);
            const target = targetUser || ctx.user;
            const key = `${ctx.guild.id}-${target.id}`;
            const warns = warningMemoryMap.get(key) || [];

            if (warns.length === 0) return ctx.reply(`✅ **${target.tag}** has zero active warnings.`);

            const list = warns.map((w, i) => `\`#${w.id}\` **${w.reason}** — By: *${w.mod}* (<t:${Math.floor(new Date(w.date).getTime() / 1000)}:R>)`).join('\n');
            const embed = new EmbedBuilder()
                .setColor(config.EMBED_COLORS.WARNING)
                .setTitle(`📋 Warnings for ${target.tag} (${warns.length})`)
                .setDescription(list)
                .setFooter({ text: 'Flavi Moderation Engine • Prefix: ,' })
                .setTimestamp();
            return ctx.reply({ embeds: [embed] });
        }
    },

    // 10. CLEARWARNS
    {
        name: 'clearwarns',
        aliases: ['resetwarns', 'cw'],
        category: 'Moderation',
        description: 'Clear all active warnings for a user.',
        usage: ',clearwarns <@user>',
        permissions: [PermissionFlagsBits.ModerateMembers],
        async execute(ctx) {
            if (!ctx.member.permissions.has(PermissionFlagsBits.ModerateMembers) && !config.BOT_OWNERS.includes(ctx.user.id)) {
                return ctx.reply('❌ Permission denied.');
            }
            const { user: targetUser } = await resolveTarget(ctx, 0);
            if (!targetUser) return ctx.reply('❌ Specify a user.');
            const key = `${ctx.guild.id}-${targetUser.id}`;
            warningMemoryMap.delete(key);
            return ctx.reply(`🧹 **Cleared all warnings for ${targetUser.tag}.**`);
        }
    },

    // 11. DELWARN
    {
        name: 'delwarn',
        aliases: ['removewarn'],
        category: 'Moderation',
        description: 'Delete a single warning by its ID.',
        usage: ',delwarn <@user> <warnID>',
        permissions: [PermissionFlagsBits.ModerateMembers],
        async execute(ctx) {
            if (!ctx.member.permissions.has(PermissionFlagsBits.ModerateMembers) && !config.BOT_OWNERS.includes(ctx.user.id)) {
                return ctx.reply('❌ Permission denied.');
            }
            const { user: targetUser } = await resolveTarget(ctx, 0);
            const warnId = ctx.args[1]?.toUpperCase();
            if (!targetUser || !warnId) return ctx.reply('❌ Usage: `,delwarn @user <WarnID>`');

            const key = `${ctx.guild.id}-${targetUser.id}`;
            const warns = warningMemoryMap.get(key) || [];
            const index = warns.findIndex(w => w.id === warnId);
            if (index === -1) return ctx.reply(`❌ Warning ID \`#${warnId}\` not found for this user.`);
            warns.splice(index, 1);
            warningMemoryMap.set(key, warns);
            return ctx.reply(`✅ **Deleted warning \`#${warnId}\` for ${targetUser.tag}.**`);
        }
    },

    // 12. PURGE / CLEAR
    {
        name: 'purge',
        aliases: ['clear', 'clean', 'prune'],
        category: 'Moderation',
        description: 'Bulk delete 1-100 messages from the channel.',
        usage: ',purge <1-100>',
        permissions: [PermissionFlagsBits.ManageMessages],
        async execute(ctx) {
            if (!ctx.member.permissions.has(PermissionFlagsBits.ManageMessages) && !config.BOT_OWNERS.includes(ctx.user.id)) {
                return ctx.reply('❌ You need **Manage Messages** permission.');
            }
            const amount = parseInt(ctx.args[0]);
            if (isNaN(amount) || amount < 1 || amount > 100) {
                return ctx.reply('❌ Specify an amount between 1 and 100 to purge: `,purge 50`');
            }
            const deleted = await ctx.channel.bulkDelete(amount, true);
            const msg = await ctx.channel.send(`🧹 **Successfully purged ${deleted.size} messages!**`);
            setTimeout(() => msg.delete().catch(() => {}), 4000);
        }
    },

    // 13. PURGEUSER
    {
        name: 'purgeuser',
        aliases: ['clearuser'],
        category: 'Moderation',
        description: 'Delete recent messages from a specific user.',
        usage: ',purgeuser <@user> [amount]',
        permissions: [PermissionFlagsBits.ManageMessages],
        async execute(ctx) {
            if (!ctx.member.permissions.has(PermissionFlagsBits.ManageMessages) && !config.BOT_OWNERS.includes(ctx.user.id)) {
                return ctx.reply('❌ Permission denied.');
            }
            const { user: targetUser } = await resolveTarget(ctx, 0);
            if (!targetUser) return ctx.reply('❌ Specify a user to purge messages for.');
            const limit = parseInt(ctx.args[1]) || 50;

            const fetched = await ctx.channel.messages.fetch({ limit: Math.min(limit, 100) });
            const userMessages = fetched.filter(m => m.author.id === targetUser.id);
            const deleted = await ctx.channel.bulkDelete(userMessages, true);
            return ctx.reply(`🧹 **Purged ${deleted.size} messages from ${targetUser.tag}.**`);
        }
    },

    // 14. PURGELINKS
    {
        name: 'purgelinks',
        aliases: ['clearlinks'],
        category: 'Moderation',
        description: 'Bulk delete messages containing URLs/links.',
        usage: ',purgelinks [amount]',
        permissions: [PermissionFlagsBits.ManageMessages],
        async execute(ctx) {
            if (!ctx.member.permissions.has(PermissionFlagsBits.ManageMessages) && !config.BOT_OWNERS.includes(ctx.user.id)) {
                return ctx.reply('❌ Permission denied.');
            }
            const limit = parseInt(ctx.args[0]) || 50;
            const fetched = await ctx.channel.messages.fetch({ limit: Math.min(limit, 100) });
            const linkMsgs = fetched.filter(m => /(https?:\/\/[^\s]+)/gi.test(m.content));
            const deleted = await ctx.channel.bulkDelete(linkMsgs, true);
            return ctx.reply(`🧹 **Purged ${deleted.size} link messages.**`);
        }
    },

    // 15. PURGEBOT
    {
        name: 'purgebot',
        aliases: ['clearbot', 'botclean'],
        category: 'Moderation',
        description: 'Bulk delete recent bot commands and bot replies.',
        usage: ',purgebot [amount]',
        permissions: [PermissionFlagsBits.ManageMessages],
        async execute(ctx) {
            if (!ctx.member.permissions.has(PermissionFlagsBits.ManageMessages) && !config.BOT_OWNERS.includes(ctx.user.id)) {
                return ctx.reply('❌ Permission denied.');
            }
            const limit = parseInt(ctx.args[0]) || 50;
            const fetched = await ctx.channel.messages.fetch({ limit: Math.min(limit, 100) });
            const botMsgs = fetched.filter(m => m.author.bot || m.content.startsWith(','));
            const deleted = await ctx.channel.bulkDelete(botMsgs, true);
            return ctx.reply(`🤖 **Purged ${deleted.size} bot messages.**`);
        }
    },

    // 16. SLOWMODE
    {
        name: 'slowmode',
        aliases: ['sm'],
        category: 'Moderation',
        description: 'Set channel slowmode delay (0 to 21600 seconds).',
        usage: ',slowmode <seconds / 0 to disable>',
        permissions: [PermissionFlagsBits.ManageChannels],
        async execute(ctx) {
            if (!ctx.member.permissions.has(PermissionFlagsBits.ManageChannels) && !config.BOT_OWNERS.includes(ctx.user.id)) {
                return ctx.reply('❌ Permission denied.');
            }
            const seconds = parseInt(ctx.args[0]);
            if (isNaN(seconds) || seconds < 0 || seconds > 21600) {
                return ctx.reply('❌ Provide seconds between 0 and 21600: `,slowmode 5`');
            }
            await ctx.channel.setRateLimitPerUser(seconds);
            return ctx.reply(`⏱️ **Slowmode set to ${seconds}s** ${seconds === 0 ? '(Disabled)' : ''}.`);
        }
    },

    // 17. LOCK
    {
        name: 'lock',
        aliases: ['lockchannel'],
        category: 'Moderation',
        description: 'Lock current channel from @everyone sending messages.',
        usage: ',lock [reason]',
        permissions: [PermissionFlagsBits.ManageChannels],
        async execute(ctx) {
            if (!ctx.member.permissions.has(PermissionFlagsBits.ManageChannels) && !config.BOT_OWNERS.includes(ctx.user.id)) {
                return ctx.reply('❌ Permission denied.');
            }
            await ctx.channel.permissionOverwrites.edit(ctx.guild.roles.everyone, { SendMessages: false });
            return ctx.reply('🔒 **This channel is now LOCKED.**');
        }
    },

    // 18. UNLOCK
    {
        name: 'unlock',
        aliases: ['unlockchannel'],
        category: 'Moderation',
        description: 'Unlock a locked channel.',
        usage: ',unlock',
        permissions: [PermissionFlagsBits.ManageChannels],
        async execute(ctx) {
            if (!ctx.member.permissions.has(PermissionFlagsBits.ManageChannels) && !config.BOT_OWNERS.includes(ctx.user.id)) {
                return ctx.reply('❌ Permission denied.');
            }
            await ctx.channel.permissionOverwrites.edit(ctx.guild.roles.everyone, { SendMessages: null });
            return ctx.reply('🔓 **This channel is now UNLOCKED.**');
        }
    },

    // 19. LOCKDOWN
    {
        name: 'lockdown',
        aliases: ['masslock'],
        category: 'Moderation',
        description: 'Emergency lockdown of all public text channels in server.',
        usage: ',lockdown',
        permissions: [PermissionFlagsBits.Administrator],
        async execute(ctx) {
            if (!ctx.member.permissions.has(PermissionFlagsBits.Administrator) && !config.BOT_OWNERS.includes(ctx.user.id)) {
                return ctx.reply('❌ Administrator permissions required for server-wide lockdown.');
            }
            let count = 0;
            for (const ch of ctx.guild.channels.cache.values()) {
                if (ch.type === ChannelType.GuildText) {
                    await ch.permissionOverwrites.edit(ctx.guild.roles.everyone, { SendMessages: false }).catch(() => {});
                    count++;
                }
            }
            return ctx.reply(`🚨 **SERVER LOCKDOWN ACTIVE:** Locked **${count}** text channels.`);
        }
    },

    // 20. UNLOCKDOWN
    {
        name: 'unlockdown',
        aliases: ['massunlock'],
        category: 'Moderation',
        description: 'End server-wide emergency lockdown.',
        usage: ',unlockdown',
        permissions: [PermissionFlagsBits.Administrator],
        async execute(ctx) {
            if (!ctx.member.permissions.has(PermissionFlagsBits.Administrator) && !config.BOT_OWNERS.includes(ctx.user.id)) {
                return ctx.reply('❌ Administrator permissions required.');
            }
            let count = 0;
            for (const ch of ctx.guild.channels.cache.values()) {
                if (ch.type === ChannelType.GuildText) {
                    await ch.permissionOverwrites.edit(ctx.guild.roles.everyone, { SendMessages: null }).catch(() => {});
                    count++;
                }
            }
            return ctx.reply(`🟢 **SERVER LOCKDOWN ENDED:** Restored access across **${count}** text channels.`);
        }
    },

    // 21. NUKE
    {
        name: 'nuke',
        category: 'Moderation',
        description: 'Recreate and completely wipe the current channel.',
        usage: ',nuke',
        permissions: [PermissionFlagsBits.ManageChannels],
        async execute(ctx) {
            if (!ctx.member.permissions.has(PermissionFlagsBits.ManageChannels) && !config.BOT_OWNERS.includes(ctx.user.id)) {
                return ctx.reply('❌ You need **Manage Channels** permission.');
            }
            const ch = ctx.channel;
            const pos = ch.position;
            const newCh = await ch.clone();
            await ch.delete();
            await newCh.setPosition(pos);

            const embed = new EmbedBuilder()
                .setColor(config.EMBED_COLORS.PRIMARY)
                .setTitle('💣 Channel Nuked')
                .setDescription(`This channel was completely sanitized and recreated by ${ctx.user}.`)
                .setImage('https://media.tenor.com/giN_G-s7Z08AAAAC/explosion-anime.gif')
                .setTimestamp();
            return newCh.send({ embeds: [embed] });
        }
    },

    // 22. HIDE
    {
        name: 'hide',
        category: 'Moderation',
        description: 'Hide channel from @everyone view.',
        usage: ',hide',
        permissions: [PermissionFlagsBits.ManageChannels],
        async execute(ctx) {
            if (!ctx.member.permissions.has(PermissionFlagsBits.ManageChannels) && !config.BOT_OWNERS.includes(ctx.user.id)) {
                return ctx.reply('❌ Permission denied.');
            }
            await ctx.channel.permissionOverwrites.edit(ctx.guild.roles.everyone, { ViewChannel: false });
            return ctx.reply('👁️‍🗨️ **Channel is now HIDDEN from @everyone.**');
        }
    },

    // 23. UNHIDE
    {
        name: 'unhide',
        category: 'Moderation',
        description: 'Unhide channel for @everyone view.',
        usage: ',unhide',
        permissions: [PermissionFlagsBits.ManageChannels],
        async execute(ctx) {
            if (!ctx.member.permissions.has(PermissionFlagsBits.ManageChannels) && !config.BOT_OWNERS.includes(ctx.user.id)) {
                return ctx.reply('❌ Permission denied.');
            }
            await ctx.channel.permissionOverwrites.edit(ctx.guild.roles.everyone, { ViewChannel: null });
            return ctx.reply('👁️ **Channel is now VISIBLE to @everyone.**');
        }
    },

    // 24. SETNICK
    {
        name: 'setnick',
        aliases: ['nick', 'nickname'],
        category: 'Moderation',
        description: 'Change or reset a member\'s nickname.',
        usage: ',setnick <@user> [new nickname]',
        permissions: [PermissionFlagsBits.ManageNicknames],
        async execute(ctx) {
            if (!ctx.member.permissions.has(PermissionFlagsBits.ManageNicknames) && !config.BOT_OWNERS.includes(ctx.user.id)) {
                return ctx.reply('❌ Permission denied.');
            }
            const { member: targetMember } = await resolveTarget(ctx, 0);
            if (!targetMember) return ctx.reply('❌ Specify a member in this server.');
            const newNick = ctx.args.slice(1).join(' ') || null;
            await targetMember.setNickname(newNick);
            return ctx.reply(`🏷️ **Updated nickname for ${targetMember.user.tag}** to \`${newNick || '*Reset*'}\`.`);
        }
    },

    // 25. ROLE
    {
        name: 'role',
        category: 'Moderation',
        description: 'Manage server roles (info/create).',
        usage: ',role create <name>',
        permissions: [PermissionFlagsBits.ManageRoles],
        async execute(ctx) {
            if (!ctx.member.permissions.has(PermissionFlagsBits.ManageRoles) && !config.BOT_OWNERS.includes(ctx.user.id)) {
                return ctx.reply('❌ You need **Manage Roles** permission.');
            }
            const sub = ctx.args[0]?.toLowerCase();
            if (sub === 'create') {
                const name = ctx.args.slice(1).join(' ');
                if (!name) return ctx.reply('❌ Specify a role name.');
                const role = await ctx.guild.roles.create({ name, reason: `Created by ${ctx.user.tag}` });
                return ctx.reply(`✅ **Created role:** <@&${role.id}> (\`${role.name}\`)`);
            }
            return ctx.reply('ℹ️ **Role Commands:** `,addrole @user @role`, `,removerole @user @role`, `,role create <name>`');
        }
    },

    // 26. ADDROLE
    {
        name: 'addrole',
        aliases: ['roleadd', 'giverole'],
        category: 'Moderation',
        description: 'Add a role to a member.',
        usage: ',addrole <@user> <@role / role name>',
        permissions: [PermissionFlagsBits.ManageRoles],
        async execute(ctx) {
            if (!ctx.member.permissions.has(PermissionFlagsBits.ManageRoles) && !config.BOT_OWNERS.includes(ctx.user.id)) {
                return ctx.reply('❌ Permission denied.');
            }
            const { member: targetMember } = await resolveTarget(ctx, 0);
            if (!targetMember) return ctx.reply('❌ Specify a member.');

            const roleQuery = ctx.args.slice(1).join(' ').replace(/[^0-9]/g, '');
            const role = ctx.guild.roles.cache.get(roleQuery) || ctx.guild.roles.cache.find(r => r.name.toLowerCase() === ctx.args.slice(1).join(' ').toLowerCase());
            if (!role) return ctx.reply('❌ Role not found.');

            await targetMember.roles.add(role);
            return ctx.reply(`✅ **Added role <@&${role.id}> to ${targetMember.user.tag}.**`);
        }
    },

    // 27. REMOVEROLE
    {
        name: 'removerole',
        aliases: ['roledel', 'takerole'],
        category: 'Moderation',
        description: 'Remove a role from a member.',
        usage: ',removerole <@user> <@role / role name>',
        permissions: [PermissionFlagsBits.ManageRoles],
        async execute(ctx) {
            if (!ctx.member.permissions.has(PermissionFlagsBits.ManageRoles) && !config.BOT_OWNERS.includes(ctx.user.id)) {
                return ctx.reply('❌ Permission denied.');
            }
            const { member: targetMember } = await resolveTarget(ctx, 0);
            if (!targetMember) return ctx.reply('❌ Specify a member.');

            const roleQuery = ctx.args.slice(1).join(' ').replace(/[^0-9]/g, '');
            const role = ctx.guild.roles.cache.get(roleQuery) || ctx.guild.roles.cache.find(r => r.name.toLowerCase() === ctx.args.slice(1).join(' ').toLowerCase());
            if (!role) return ctx.reply('❌ Role not found.');

            await targetMember.roles.remove(role);
            return ctx.reply(`✅ **Removed role <@&${role.id}> from ${targetMember.user.tag}.**`);
        }
    },

    // 28. ROLEALL
    {
        name: 'roleall',
        aliases: ['massrole'],
        category: 'Moderation',
        description: 'Give a role to all human members or bots in server.',
        usage: ',roleall <humans/bots/all> <@role>',
        permissions: [PermissionFlagsBits.Administrator],
        async execute(ctx) {
            if (!ctx.member.permissions.has(PermissionFlagsBits.Administrator) && !config.BOT_OWNERS.includes(ctx.user.id)) {
                return ctx.reply('❌ Administrator permission required.');
            }
            const targetType = ctx.args[0]?.toLowerCase();
            const roleQuery = ctx.args.slice(1).join(' ').replace(/[^0-9]/g, '');
            const role = ctx.guild.roles.cache.get(roleQuery);
            if (!role) return ctx.reply('❌ Usage: `,roleall humans @role` or `,roleall bots @role`');

            ctx.reply(`⏳ **Applying role <@&${role.id}> to ${targetType}...**`);
            const members = await ctx.guild.members.fetch();
            let count = 0;
            for (const m of members.values()) {
                if (targetType === 'humans' && m.user.bot) continue;
                if (targetType === 'bots' && !m.user.bot) continue;
                if (!m.roles.cache.has(role.id)) {
                    await m.roles.add(role).catch(() => {});
                    count++;
                }
            }
            return ctx.channel.send(`✅ **Finished mass role:** Added <@&${role.id}> to **${count}** members.`);
        }
    },

    // 29. VCKICK
    {
        name: 'vckick',
        aliases: ['voicedisconnect'],
        category: 'Moderation',
        description: 'Disconnect a user from their voice channel.',
        usage: ',vckick <@user>',
        permissions: [PermissionFlagsBits.MoveMembers],
        async execute(ctx) {
            if (!ctx.member.permissions.has(PermissionFlagsBits.MoveMembers) && !config.BOT_OWNERS.includes(ctx.user.id)) {
                return ctx.reply('❌ Permission denied.');
            }
            const { member: targetMember } = await resolveTarget(ctx, 0);
            if (!targetMember || !targetMember.voice?.channel) return ctx.reply('❌ User is not in a voice channel.');
            await targetMember.voice.disconnect(`VC Kick by ${ctx.user.tag}`);
            return ctx.reply(`🔌 **Disconnected ${targetMember.user.tag} from voice.**`);
        }
    },

    // 30. VCMUTE
    {
        name: 'vcmute',
        aliases: ['voicemute'],
        category: 'Moderation',
        description: 'Server-mute a member in voice channels.',
        usage: ',vcmute <@user>',
        permissions: [PermissionFlagsBits.MuteMembers],
        async execute(ctx) {
            if (!ctx.member.permissions.has(PermissionFlagsBits.MuteMembers) && !config.BOT_OWNERS.includes(ctx.user.id)) {
                return ctx.reply('❌ Permission denied.');
            }
            const { member: targetMember } = await resolveTarget(ctx, 0);
            if (!targetMember || !targetMember.voice?.channel) return ctx.reply('❌ User is not in a voice channel.');
            await targetMember.voice.setMute(true, `VC Mute by ${ctx.user.tag}`);
            return ctx.reply(`🎙️ **Server-muted ${targetMember.user.tag} in voice.**`);
        }
    },

    // 31. VCUNMUTE
    {
        name: 'vcunmute',
        aliases: ['voiceunmute'],
        category: 'Moderation',
        description: 'Server-unmute a member in voice channels.',
        usage: ',vcunmute <@user>',
        permissions: [PermissionFlagsBits.MuteMembers],
        async execute(ctx) {
            if (!ctx.member.permissions.has(PermissionFlagsBits.MuteMembers) && !config.BOT_OWNERS.includes(ctx.user.id)) {
                return ctx.reply('❌ Permission denied.');
            }
            const { member: targetMember } = await resolveTarget(ctx, 0);
            if (!targetMember || !targetMember.voice?.channel) return ctx.reply('❌ User is not in a voice channel.');
            await targetMember.voice.setMute(false, `VC Unmute by ${ctx.user.tag}`);
            return ctx.reply(`🎙️ **Server-unmuted ${targetMember.user.tag} in voice.**`);
        }
    },

    // 32. MODPANEL
    {
        name: 'modpanel',
        category: 'Moderation',
        description: 'Open interactive 1-Year Visual Moderation Dashboard for a user.',
        usage: ',modpanel <@user>',
        permissions: [PermissionFlagsBits.ModerateMembers],
        async execute(ctx) {
            if (!ctx.member.permissions.has(PermissionFlagsBits.ModerateMembers) && !config.BOT_OWNERS.includes(ctx.user.id)) {
                return ctx.reply('❌ Permission denied.');
            }
            const { user: targetUser, member: targetMember } = await resolveTarget(ctx, 0);
            if (!targetUser) return ctx.reply('❌ Specify a user: `,modpanel @user`');

            const embed = new EmbedBuilder()
                .setColor(config.EMBED_COLORS.PRIMARY)
                .setTitle(`🛡️ Moderation Dashboard: ${targetUser.tag}`)
                .setThumbnail(targetUser.displayAvatarURL({ dynamic: true }))
                .addFields(
                    { name: 'User ID', value: `\`${targetUser.id}\``, inline: true },
                    { name: 'Joined Server', value: targetMember ? `<t:${Math.floor(targetMember.joinedTimestamp / 1000)}:R>` : 'Not in server', inline: true },
                    { name: 'Roles Count', value: targetMember ? `\`${targetMember.roles.cache.size - 1}\`` : 'N/A', inline: true }
                )
                .setDescription('*Interactive button controls with high 1-year lifetime.*')
                .setFooter({ text: 'Flavi-Style Moderation Panel • Prefix: ,' })
                .setTimestamp();

            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId(`mp_warn_${targetUser.id}`).setLabel('Warn').setStyle(ButtonStyle.Secondary).setEmoji('⚠️'),
                new ButtonBuilder().setCustomId(`mp_timeout_${targetUser.id}`).setLabel('Timeout (10m)').setStyle(ButtonStyle.Primary).setEmoji('🔇'),
                new ButtonBuilder().setCustomId(`mp_kick_${targetUser.id}`).setLabel('Kick').setStyle(ButtonStyle.Danger).setEmoji('🚪'),
                new ButtonBuilder().setCustomId(`mp_ban_${targetUser.id}`).setLabel('Ban').setStyle(ButtonStyle.Danger).setEmoji('🔨')
            );

            return ctx.reply({ embeds: [embed], components: [row] });
        }
    }
];

module.exports = commands;
