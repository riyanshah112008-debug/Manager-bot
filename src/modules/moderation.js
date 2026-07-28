// ==========================================
// 1. IMPORTS, SCHEMAS & BUILDERS
// ==========================================
const { 
    SlashCommandBuilder, 
    EmbedBuilder, 
    PermissionsBitField, 
    PermissionFlagsBits,
    Events,
    AuditLogEvent
} = require('discord.js');
const mongoose = require('mongoose');
const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

// --- MongoDB Schemas ---
const automodGuildSchema = new mongoose.Schema({
    guildId: { type: String, required: true, unique: true },
    enabled: { type: Boolean, default: true }
});

const automodChannelSchema = new mongoose.Schema({
    channelId: { type: String, required: true, unique: true },
    links: { type: Boolean, default: false },
    emojis: { type: Boolean, default: false }
});

const warningSchema = new mongoose.Schema({
    guildId: String,
    userId: String,
    warnId: Number,
    reason: String,
    moderatorId: String,
    date: { type: Date, default: Date.now }
});

const AutomodGuild = mongoose.models.AutomodGuild || mongoose.model('AutomodGuild', automodGuildSchema);
const AutomodChannel = mongoose.models.AutomodChannel || mongoose.model('AutomodChannel', automodChannelSchema);
const Warning = mongoose.models.Warning || mongoose.model('Warning', warningSchema);

let Transcript;
try { Transcript = require('../models/Transcript'); } catch (e) { Transcript = mongoose.models.Transcript; }

// --- SQLite Database Setup ---
const protectDb = new Database('protect.db');
protectDb.exec(`
    CREATE TABLE IF NOT EXISTS protected_users (
        guild_id TEXT,
        user_id TEXT,
        PRIMARY KEY (guild_id, user_id)
    )
`);

const addProtect = protectDb.prepare('INSERT OR IGNORE INTO protected_users (guild_id, user_id) VALUES (?, ?)');
const removeProtect = protectDb.prepare('DELETE FROM protected_users WHERE guild_id = ? AND user_id = ?');
const getProtect = protectDb.prepare('SELECT 1 FROM protected_users WHERE guild_id = ? AND user_id = ?');

// Media Storage
const mediaDbPath = path.join(__dirname, 'mediaChannels.json');
function getMediaData() {
    if (!fs.existsSync(mediaDbPath)) fs.writeFileSync(mediaDbPath, JSON.stringify([]));
    try { return JSON.parse(fs.readFileSync(mediaDbPath, 'utf-8')); } catch { return []; }
}
function saveMediaData(data) {
    fs.writeFileSync(mediaDbPath, JSON.stringify(data, null, 2));
}

const userMessageLog = new Map();
const badWordsList = ['badword1', 'badword2', 'scam', 'free nitro', 'click here for free'];

// ==========================================
// 2. MASTER SLASH COMMAND BUILDERS
// ==========================================
const modMasterCommand = new SlashCommandBuilder()
    .setName('mod')
    .setDescription('🛡️ Master Moderation & Enforcement Command Hub')
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .addSubcommand(sub => 
        sub.setName('warn')
           .setDescription('Warn a server member')
           .addUserOption(opt => opt.setName('target').setDescription('Member to warn').setRequired(true))
           .addStringOption(opt => opt.setName('reason').setDescription('Reason for warning').setRequired(true))
    )
    .addSubcommand(sub => 
        sub.setName('warnings')
           .setDescription('View a member\'s warning record')
           .addUserOption(opt => opt.setName('target').setDescription('Member to view').setRequired(true))
    )
    .addSubcommand(sub => 
        sub.setName('delwarn')
           .setDescription('Delete a warning record by ID')
           .addIntegerOption(opt => opt.setName('id').setDescription('Warning ID').setRequired(true))
    )
    .addSubcommand(sub => 
        sub.setName('clear')
           .setDescription('Bulk delete messages and archive to transcript log')
           .addIntegerOption(opt => opt.setName('amount').setDescription('Number of messages (1-2000)').setRequired(true).setMinValue(1).setMaxValue(2000))
    )
    .addSubcommand(sub => 
        sub.setName('lockdown')
           .setDescription('Lock or unlock the current channel')
           .addStringOption(opt => opt.setName('action').setDescription('Action').setRequired(true).addChoices(
               { name: 'Lock', value: 'lock' },
               { name: 'Unlock', value: 'unlock' }
           ))
    )
    .addSubcommand(sub => 
        sub.setName('protect')
           .setDescription('Protect a user from staff actions (Server Owner Only)')
           .addUserOption(opt => opt.setName('user').setDescription('Target user').setRequired(true))
    )
    .addSubcommand(sub => 
        sub.setName('unprotect')
           .setDescription('Remove user protection (Server Owner Only)')
           .addUserOption(opt => opt.setName('user').setDescription('Target user').setRequired(true))
    );

const autoModMasterCommand = new SlashCommandBuilder()
    .setName('automod')
    .setDescription('⚙️ Master Security & Auto-Mod Config Hub')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommand(sub => sub.setName('status').setDescription('Check server-wide Automod status'))
    .addSubcommand(sub => 
        sub.setName('toggle')
           .setDescription('Toggle Server Automod or Protection Modules')
           .addStringOption(opt => opt.setName('module').setDescription('Module to toggle').setRequired(true).addChoices(
               { name: 'Server Auto-Mod Core', value: 'core' },
               { name: 'Wick Anti-Nuke', value: 'wick' },
               { name: 'Beemo Anti-Raid', value: 'beemo' },
               { name: 'AltDentifier', value: 'altdentifier' }
           ))
           .addBooleanOption(opt => opt.setName('status').setDescription('Enable/Disable').setRequired(true))
    )
    .addSubcommand(sub => 
        sub.setName('ignore')
           .setDescription('Disable automod filters in a channel')
           .addStringOption(opt => opt.setName('type').setDescription('Filter type').setRequired(true).addChoices(
               { name: 'Links', value: 'links' },
               { name: 'Emojis', value: 'emojis' },
               { name: 'All Filters', value: 'all' },
               { name: 'Check Status', value: 'status' }
           ))
           .addChannelOption(opt => opt.setName('channel').setDescription('Target channel').setRequired(false))
    )
    .addSubcommand(sub => 
        sub.setName('unignore')
           .setDescription('Re-enable automod filters in a channel')
           .addStringOption(opt => opt.setName('type').setDescription('Filter type').setRequired(true).addChoices(
               { name: 'Links', value: 'links' },
               { name: 'Emojis', value: 'emojis' },
               { name: 'All Filters', value: 'all' }
           ))
           .addChannelOption(opt => opt.setName('channel').setDescription('Target channel').setRequired(false))
    )
    .addSubcommand(sub => 
        sub.setName('mediaonly')
           .setDescription('Configure media-only mode for a channel')
           .addStringOption(opt => opt.setName('action').setDescription('Action').setRequired(true).addChoices(
               { name: 'Enable', value: 'enable' },
               { name: 'Disable', value: 'disable' },
               { name: 'Check Status', value: 'status' }
           ))
           .addChannelOption(opt => opt.setName('channel').setDescription('Target channel').setRequired(false))
    );
// ==========================================
// 3. BULLETPROOF /mod HANDLER
// ==========================================
async function handleModCommands(client, interaction) {
    if (!interaction.deferred && !interaction.replied) {
        await interaction.deferReply({ ephemeral: true }).catch(() => {});
    }

    const sub = interaction.options.getSubcommand();
    const guild = interaction.guild;

    switch (sub) {
        case 'warn': {
            const user = interaction.options.getUser('target', true);
            const reason = interaction.options.getString('reason', true);

            if (user.id === guild.ownerId) return interaction.editReply('❌ You cannot warn the Server Owner!');

            const warnId = Math.floor(1000 + Math.random() * 9000);
            await Warning.create({ guildId: guild.id, userId: user.id, warnId, reason, moderatorId: interaction.user.id });

            const userWarns = await Warning.find({ guildId: guild.id, userId: user.id });

            if (userWarns.length >= 3 && typeof client.isPremium === 'function' && client.isPremium(guild.id)) {
                const member = await guild.members.fetch(user.id).catch(() => null);
                if (member?.kickable) await member.kick('Reached 3 active warnings').catch(() => {});
                return interaction.editReply(`⚠️ <@${user.id}> reached 3 warnings and was automatically kicked.`);
            }

            return interaction.editReply(`⚠️ **<@${user.id}> has been warned.** (Total: ${userWarns.length})\nReason: *${reason}* | ID: \`#${warnId}\``);
        }

        case 'warnings': {
            const user = interaction.options.getUser('target', true);
            const warns = await Warning.find({ guildId: guild.id, userId: user.id });

            if (!warns || warns.length === 0) {
                return interaction.editReply(`✅ **${user.username}** has 0 warnings on record.`);
            }

            const embed = new EmbedBuilder()
                .setColor('#ED4245')
                .setTitle(`⚠️ Warnings Record for ${user.username}`)
                .setDescription(warns.map((w, i) => `**${i + 1}.** ${w.reason} *(ID: #${w.warnId || w._id})*`).join('\n'))
                .setFooter({ text: 'Use /mod delwarn <ID> to clear a warning.' });

            return interaction.editReply({ embeds: [embed] });
        }

        case 'delwarn': {
            const id = interaction.options.getInteger('id', true);
            const deleted = await Warning.findOneAndDelete({ guildId: guild.id, warnId: id });

            if (!deleted) return interaction.editReply(`❌ Warning ID \`#${id}\` was not found.`);
            return interaction.editReply(`✅ Warning ID \`#${id}\` has been removed.`);
        }

        case 'clear': {
            let amount = interaction.options.getInteger('amount', true);
            let totalDeleted = 0;
            let collectedMessages = [];

            try {
                while (amount > 0) {
                    const fetchSize = amount > 100 ? 100 : amount;
                    const messages = await interaction.channel.messages.fetch({ limit: fetchSize }).catch(() => null);
                    if (!messages || messages.size === 0) break;

                    messages.forEach(m => {
                        collectedMessages.push({
                            authorId: m.author.id,
                            authorTag: m.author.tag,
                            content: m.content || '[Embed / Attachment]',
                            timestamp: m.createdAt
                        });
                    });

                    const deleted = await interaction.channel.bulkDelete(messages, true).catch(() => null);
                    if (!deleted || deleted.size === 0) break;

                    totalDeleted += deleted.size;
                    amount -= fetchSize;

                    if (deleted.size < fetchSize) break;
                }

                if (collectedMessages.length > 0 && Transcript) {
                    await Transcript.create({
                        guildId: guild.id,
                        channelId: interaction.channel.id,
                        moderatorId: interaction.user.id,
                        deletedCount: totalDeleted,
                        messages: collectedMessages
                    }).catch(() => {});
                }

                return interaction.editReply(`🧹 Successfully purged **${totalDeleted}** messages!`);
            } catch (err) {
                return interaction.editReply(`❌ Bulk delete error: \`${err.message}\`. Ensure messages are under 14 days old.`);
            }
        }

        case 'lockdown': {
            if (!interaction.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
                return interaction.editReply('❌ Administrator permission required for Lockdown.');
            }

            const action = interaction.options.getString('action', true);
            const everyoneRole = guild.roles.everyone;

            if (action === 'lock') {
                await interaction.channel.permissionOverwrites.edit(everyoneRole, { SendMessages: false });
                return interaction.editReply('🔒 **CHANNEL LOCKED.** Normal members can no longer send messages here.');
            }

            await interaction.channel.permissionOverwrites.edit(everyoneRole, { SendMessages: null });
            return interaction.editReply('🔓 **CHANNEL UNLOCKED.** Normal members can send messages again.');
        }

        case 'protect':
        case 'unprotect': {
            const isOwner = interaction.user.id === guild.ownerId || interaction.user.id === process.env.OWNER_ID;
            if (!isOwner) return interaction.editReply('❌ **Access Denied:** Only the Server Owner can use protection commands!');

            const targetUser = interaction.options.getUser('user', true);

            if (sub === 'protect') {
                addProtect.run(guild.id, targetUser.id);
                return interaction.editReply(`🛡️ **${targetUser.username}** is now protected! Staff cannot ban or kick them.`);
            } else {
                removeProtect.run(guild.id, targetUser.id);
                return interaction.editReply(`🔓 **${targetUser.username}** is no longer protected.`);
            }
        }

        default:
            return interaction.editReply('❌ Unknown subcommand.');
    }
}

// ==========================================
// 4. MASTER /automod HANDLER
// ==========================================
async function handleAutoModCommands(client, interaction, guildCache, channelCache) {
    if (!interaction.deferred && !interaction.replied) {
        await interaction.deferReply({ ephemeral: true }).catch(() => {});
    }

    const sub = interaction.options.getSubcommand();
    const guildId = interaction.guildId;

    if (sub === 'status') {
        const isEnabled = guildCache.has(guildId) ? guildCache.get(guildId) : true;
        return interaction.editReply(`📢 **Server-Wide Automod Status:** ${isEnabled ? '🟢 Enabled' : '🔴 Disabled'}`);
    }

    if (sub === 'toggle') {
        const moduleName = interaction.options.getString('module', true);
        const status = interaction.options.getBoolean('status', true);

        if (moduleName === 'core') {
            await AutomodGuild.findOneAndUpdate({ guildId }, { enabled: status }, { upsert: true, new: true });
            guildCache.set(guildId, status);
            return interaction.editReply(`⚙️ Server Automod Core is now **${status ? 'ENABLED ✅' : 'DISABLED ❌'}**.`);
        }

        return interaction.editReply(`⚙️ Module **${moduleName.toUpperCase()}** status updated to: **${status ? 'ENABLED ✅' : 'DISABLED ❌'}**.`);
    }

    if (sub === 'ignore' || sub === 'unignore') {
        const type = interaction.options.getString('type', true);
        const channel = interaction.options.getChannel('channel') || interaction.channel;
        const channelId = channel.id;

        let cSettings = channelCache.get(channelId) || { links: false, emojis: false };

        if (type === 'status' && sub === 'ignore') {
            return interaction.editReply(`📢 **Automod Status for <#${channelId}>:**\n🔗 Links: ${cSettings.links ? '❌ Ignored' : '✅ Active'}\n😀 Emojis: ${cSettings.emojis ? '❌ Ignored' : '✅ Active'}`);
        }

        const targetState = sub === 'ignore';
        if (type === 'links' || type === 'all') cSettings.links = targetState;
        if (type === 'emojis' || type === 'all') cSettings.emojis = targetState;

        await AutomodChannel.findOneAndUpdate({ channelId }, { links: cSettings.links, emojis: cSettings.emojis }, { upsert: true, new: true });
        channelCache.set(channelId, cSettings);

        const typeName = type === 'all' ? '**All** Automod filters are' : `Automod **${type}** filter is`;
        return interaction.editReply(`${targetState ? '🚫' : '✅'} ${typeName} now **${targetState ? 'DISABLED' : 'ENABLED'}** in <#${channelId}>.`);
    }

    if (sub === 'mediaonly') {
        const action = interaction.options.getString('action', true);
        const channel = interaction.options.getChannel('channel') || interaction.channel;
        let mediaChannels = getMediaData();

        if (action === 'status') {
            return interaction.editReply(`📢 **Media-Only Status for ${channel}:** ${mediaChannels.includes(channel.id) ? '🟢 Enabled' : '🔴 Disabled'}`);
        }

        if (action === 'enable') {
            if (!mediaChannels.includes(channel.id)) mediaChannels.push(channel.id);
            saveMediaData(mediaChannels);
            return interaction.editReply(`✅ Media-Only mode **enabled** in ${channel}.`);
        } else {
            mediaChannels = mediaChannels.filter(id => id !== channel.id);
            saveMediaData(mediaChannels);
            return interaction.editReply(`🚫 Media-Only mode **disabled** in ${channel}.`);
        }
    }
}
// ==========================================
// 5. MAIN MODULE INITIALIZER & PASSIVE FILTERS
// ==========================================
module.exports = (client) => {
    const guildCache = new Map();
    const channelCache = new Map();

    client.isUserProtected = (guildId, userId) => !!getProtect.get(guildId, userId);

    client.once('ready', async () => {
        try {
            const gSettings = await AutomodGuild.find().lean();
            gSettings.forEach(s => guildCache.set(s.guildId, s.enabled));

            const cSettings = await AutomodChannel.find().lean();
            cSettings.forEach(s => channelCache.set(s.channelId, { links: s.links, emojis: s.emojis }));

            console.log('✅ Integrated Master Moderation & Automod Engine Ready!');
        } catch (err) {}
    });

    // --- Slash Command Router ---
    client.on('interactionCreate', async (interaction) => {
        if (!interaction.isChatInputCommand() || !interaction.guild) return;

        if (interaction.commandName === 'mod') await handleModCommands(client, interaction);
        if (interaction.commandName === 'automod') await handleAutoModCommands(client, interaction, guildCache, channelCache);
    });

    // --- PASSIVE REAL-TIME CHAT SECURITY ENGINE ---
    client.on('messageCreate', async (message) => {
        if (message.author.bot || !message.guild) return;

        const isStaff = message.member && (
            message.member.permissions.has(PermissionsBitField.Flags.Administrator) ||
            message.member.permissions.has(PermissionsBitField.Flags.ModerateMembers) ||
            message.member.permissions.has(PermissionsBitField.Flags.ManageMessages)
        );

        if (isStaff || message.author.id === message.guild.ownerId) return;

        const content = message.content.toLowerCase();

        // 1. Bad Words Filter
        if (badWordsList.some(w => content.includes(w))) {
            await message.delete().catch(() => {});
            const warn = await message.channel.send(`🛑 <@${message.author.id}>, your message was removed for containing restricted words.`).catch(() => {});
            if (warn) setTimeout(() => warn.delete().catch(() => {}), 4000);
            return;
        }

        // 2. Anti-Invite Protection
        if (/(discord\.gg\/|discord\.com\/invite\/)[a-zA-Z0-9-]+/i.test(message.content)) {
            await message.delete().catch(() => {});
            await message.member.timeout(10 * 60 * 1000, 'Automod: Discord Invite').catch(() => {});
            const warn = await message.channel.send(`⚠️ <@${message.author.id}>, posting external Discord invites is forbidden.`).catch(() => {});
            if (warn) setTimeout(() => warn.delete().catch(() => {}), 4000);
            return;
        }

        // 3. Rapid Spam Detection
        const userId = message.author.id;
        const now = Date.now();
        if (!userMessageLog.has(userId)) userMessageLog.set(userId, []);
        const times = userMessageLog.get(userId);
        times.push(now);
        const recent = times.filter(t => now - t < 5000);
        userMessageLog.set(userId, recent);

        if (recent.length >= 5) {
            userMessageLog.delete(userId);
            await message.member.timeout(5 * 60 * 1000, "Anti-Abuse: Spam").catch(() => {});
            const msgs = await message.channel.messages.fetch({ limit: 10 }).catch(() => null);
            if (msgs) {
                const userMsgs = msgs.filter(m => m.author.id === userId);
                await message.channel.bulkDelete(userMsgs, true).catch(() => {});
            }
            return message.channel.send(`🔨 **Auto-Mod:** <@${userId}> timed out for 5 minutes (Spam).`).catch(() => {});
        }

        // 4. Emoji Spam Filter (> 8 emojis)
        const customEmojis = message.content.match(/<a?:[a-zA-Z0-9_]+:[0-9]+>/g) || [];
        const unicodeEmojis = message.content.match(/[\u2700-\u27BF]|[\uE000-\uF8FF]|\uD83C[\uDC00-\uDFFF]|\uD83D[\uDC00-\uDFFF]/g) || [];
        if (customEmojis.length + unicodeEmojis.length > 8) {
            await message.delete().catch(() => {});
            const warn = await message.channel.send(`⚠️ <@${message.author.id}>, please do not spam emojis!`).catch(() => {});
            if (warn) setTimeout(() => warn.delete().catch(() => {}), 4000);
            return;
        }

        // 5. Media-Only Channel Enforcer
        const mediaChannels = getMediaData();
        if (mediaChannels.includes(message.channel.id)) {
            const hasMedia = message.attachments.size > 0 || message.stickers.size > 0 || /https?:\/\/\S+/i.test(message.content);
            if (!hasMedia) {
                await message.delete().catch(() => {});
                const warn = await message.channel.send(`⚠️ <@${message.author.id}>, this is a **Media-Only** channel! Attach images, media, or links.`).catch(() => {});
                if (warn) setTimeout(() => warn.delete().catch(() => {}), 5000);
                return;
            }
        }
    });

    // --- Anti-Kick / Anti-Ban Protected Users Shield ---
    client.on(Events.GuildAuditLogEntryCreate, async (auditLog, guild) => {
        const { action, executorId, targetId } = auditLog;

        if (executorId === client.user.id || executorId === guild.ownerId) return;
        if (!client.isUserProtected(guild.id, targetId)) return;

        if (action === AuditLogEvent.MemberBanAdd) {
            await guild.members.unban(targetId, "Anti-Ban Shield: Protected User").catch(() => {});
            if (guild.systemChannel) {
                guild.systemChannel.send(`🚨 **PROTECTION ALERT:** <@${executorId}> attempted to ban protected user <@${targetId}>! Ban automatically reversed.`).catch(() => {});
            }
        }
    });
};

module.exports.modMasterPayload = modMasterCommand.toJSON();
module.exports.autoModMasterPayload = autoModMasterCommand.toJSON();
