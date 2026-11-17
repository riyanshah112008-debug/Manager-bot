const mongoose = require('mongoose');
const { EmbedBuilder, PermissionFlagsBits, ChannelType, MessageFlags } = require('discord.js');

const DAY_MS = 24 * 60 * 60 * 1000;
const SCAN_INTERVAL_MS = 15 * 60 * 1000;
const CLAIM_RECOVERY_MS = 10 * 60 * 1000;
const MEMBER_INIT_WINDOW_MS = 5 * 60 * 1000;
const DEFAULT_INACTIVITY_DAYS = 14;
const DEFAULT_ACCOUNT_AGE_DAYS = 7;

const settingsSchema = new mongoose.Schema({
    guildId: { type: String, required: true, unique: true, index: true },
    enabled: { type: Boolean, default: true },
    logChannelId: { type: String, default: '' },
    staffRoleId: { type: String, default: '' },
    inactivityDays: { type: Number, default: DEFAULT_INACTIVITY_DAYS, min: 1, max: 90 },
    accountAgeDays: { type: Number, default: DEFAULT_ACCOUNT_AGE_DAYS, min: 0, max: 365 },
    configuredBy: { type: String, default: '' }
}, { timestamps: true });

const memberSchema = new mongoose.Schema({
    guildId: { type: String, required: true },
    userId: { type: String, required: true },
    joinedAt: { type: Date, required: true },
    accountCreatedAt: { type: Date, required: true },
    firstActivityAt: { type: Date, default: null },
    inactivityAlertedAt: { type: Date, default: null },
    inactivityAlertStatus: { type: String, enum: ['pending', 'sent'], default: null },
    inactivityAlertClaimedAt: { type: Date, default: null },
    riskAlertedAt: { type: Date, default: null }
}, { timestamps: true });
memberSchema.index({ guildId: 1, userId: 1 }, { unique: true });
memberSchema.index({ guildId: 1, firstActivityAt: 1, inactivityAlertedAt: 1, joinedAt: 1 });

const SusAccountSettings = mongoose.models.SusAccountSettings ||
    mongoose.model('SusAccountSettings', settingsSchema);
const SusAccountMember = mongoose.models.SusAccountMember ||
    mongoose.model('SusAccountMember', memberSchema);

function daysBetween(from, to = Date.now()) {
    const timestamp = new Date(from).getTime();
    if (!Number.isFinite(timestamp) || !Number.isFinite(to)) return 0;
    return Math.max(0, Math.floor((to - timestamp) / DAY_MS));
}

function hasReachedInactivityThreshold(joinedAt, inactivityDays, now = Date.now()) {
    const joinedTimestamp = new Date(joinedAt).getTime();
    const days = Number(inactivityDays);
    return Number.isFinite(joinedTimestamp) && Number.isInteger(days) &&
        days >= 1 && days <= 90 && Number.isFinite(now) &&
        now - joinedTimestamp >= days * DAY_MS;
}

function isSameMembership(recordJoinedAt, currentJoinedAt) {
    const recordTime = new Date(recordJoinedAt).getTime();
    const currentTime = new Date(currentJoinedAt).getTime();
    return Number.isFinite(recordTime) && Number.isFinite(currentTime) && recordTime === currentTime;
}

function isClaimRecoverable(status, claimedAt, now = Date.now()) {
    if (status !== 'pending') return true;
    if (!claimedAt) return true;
    const claimTime = new Date(claimedAt).getTime();
    return !Number.isFinite(claimTime) || now - claimTime >= CLAIM_RECOVERY_MS;
}

async function safeChannel(guild, channelId) {
    let channel = guild.systemChannel;
    if (channelId) {
        channel = guild.channels.cache.get(channelId) ||
            await guild.channels.fetch(channelId).catch(() => null);
    }
    return channel && channel.type === ChannelType.GuildText && channel.isTextBased() ? channel : null;
}

function buildJoinRiskEmbed(member, accountAgeDays, threshold) {
    const youngAccount = accountAgeDays <= threshold;
    const embed = new EmbedBuilder()
        .setColor(youngAccount ? 0xF59E0B : 0x5865F2)
        .setTitle(youngAccount ? '⚠️ New Account — Staff Review' : '👤 New Member Joined')
        .setDescription(`<@${member.id}> joined **${member.guild.name}**.`)
        .addFields(
            { name: 'Account age', value: `${accountAgeDays} day(s)`, inline: true },
            { name: 'Joined server', value: `<t:${Math.floor(member.joinedTimestamp / 1000)}:R>`, inline: true },
            { name: 'Account created', value: `<t:${Math.floor(member.user.createdTimestamp / 1000)}:F>`, inline: false },
            { name: 'Risk assessment', value: youngAccount ? `Account is at or below the configured ${threshold}-day age threshold. This is a review signal, not proof of abuse.` : 'No configured young-account age signal detected.', inline: false }
        )
        .setThumbnail(member.user.displayAvatarURL({ size: 256 }))
        .setFooter({ text: 'Starry Member Risk Monitor • Staff review only; no automatic moderation' })
        .setTimestamp();
    return embed;
}

module.exports = (client) => {
    const scanLocks = new Set();
    const memberQueues = new Map();
    const pendingActivity = new Map();

    const membershipKey = (guildId, userId, joinedAt) =>
        `${guildId}:${userId}:${new Date(joinedAt).getTime()}`;

    function queueMemberTask(guildId, userId, task) {
        const key = `${guildId}:${userId}`;
        const previous = memberQueues.get(key) || Promise.resolve();
        const current = previous.catch(() => {}).then(task);
        memberQueues.set(key, current);
        current.finally(() => {
            if (memberQueues.get(key) === current) memberQueues.delete(key);
        }).catch(() => {});
        return current;
    }

    async function getSettings(guildId) {
        // Build equality predicates with Mongoose's query builder instead of
        // passing event/interaction-derived objects as a MongoDB filter.
        return SusAccountSettings.findOne()
            .where('guildId').equals(guildId)
            .setOptions({ sanitizeFilter: true })
            .lean()
            .exec();
    }

    async function sendInactivityAlerts(guild) {
        if (scanLocks.has(guild.id)) return;
        scanLocks.add(guild.id);
        try {
            const settings = await getSettings(guild.id);
            if (!settings || !settings.enabled || !settings.logChannelId) return;
            const channel = await safeChannel(guild, settings.logChannelId);
            if (!channel) {
                console.warn(`[SusAccount] Alert channel unavailable in guild ${guild.id}.`);
                return;
            }
            // Keep delivered alerts out of the scan, but include abandoned pending
            // claims so a process restart cannot permanently lose an alert.
            const unalertedMembers = await SusAccountMember.find()
                .where('guildId').equals(guild.id)
                .where('firstActivityAt').equals(null)
                .where('inactivityAlertStatus').ne('sent')
                .setOptions({ sanitizeFilter: true })
                .sort({ joinedAt: 1 })
                .limit(200)
                .exec();
            const candidates = unalertedMembers.filter(record =>
                hasReachedInactivityThreshold(record.joinedAt, settings.inactivityDays)
            );

            for (const record of candidates) {
                const previousClaimAt = record.inactivityAlertClaimedAt || null;
                const isPending = record.inactivityAlertStatus === 'pending';
                if (!isClaimRecoverable(record.inactivityAlertStatus, previousClaimAt)) continue;

                let member = guild.members.cache.get(record.userId);
                if (!member) {
                    try {
                        member = await guild.members.fetch(record.userId);
                    } catch (error) {
                        // Only Discord's explicit Unknown Member response proves the
                        // user left. Other 404/network/API errors remain retryable.
                        if (error?.code === 10007) {
                            await SusAccountMember.deleteOne()
                                .where('_id').equals(record._id)
                                .where('joinedAt').equals(record.joinedAt)
                                .setOptions({ sanitizeFilter: true })
                                .exec();
                        } else {
                            console.warn(`[SusAccount] Could not fetch member ${record.userId} in ${guild.id}; will retry:`, error?.message || error);
                        }
                        continue;
                    }
                }
                if (member.user.bot) {
                    await SusAccountMember.deleteOne()
                        .where('_id').equals(record._id)
                        .where('joinedAt').equals(record.joinedAt)
                        .setOptions({ sanitizeFilter: true })
                        .exec();
                    continue;
                }

                const now = new Date();
                const claimQuery = SusAccountMember.updateOne({}, {
                    $set: {
                        inactivityAlertStatus: 'pending',
                        inactivityAlertClaimedAt: now
                    }
                })
                    .where('_id').equals(record._id)
                    .where('joinedAt').equals(record.joinedAt)
                    .where('firstActivityAt').equals(null)
                    .where('inactivityAlertStatus').equals(isPending ? 'pending' : null)
                    .setOptions({ sanitizeFilter: true });
                claimQuery.where('inactivityAlertClaimedAt').equals(previousClaimAt);
                const claim = await claimQuery.exec();
                if (!claim.modifiedCount) continue;

                // Re-read the current membership after claiming. This stops an alert
                // for a stale membership if the user spoke or rejoined during the scan.
                const stillInactive = await SusAccountMember.findOne()
                    .where('_id').equals(record._id)
                    .where('joinedAt').equals(record.joinedAt)
                    .where('firstActivityAt').equals(null)
                    .where('inactivityAlertStatus').equals('pending')
                    .where('inactivityAlertClaimedAt').equals(now)
                    .setOptions({ sanitizeFilter: true })
                    .lean()
                    .exec();
                if (!stillInactive) continue;

                const accountAge = daysBetween(record.accountCreatedAt, now);
                const embed = new EmbedBuilder()
                    .setColor(0xF59E0B)
                    .setTitle(`⏳ New Member — ${settings.inactivityDays}-Day Inactivity Review`)
                    .setDescription(`<@${member.id}> has been in the server for **${settings.inactivityDays} days** without a recorded message.`)
                    .addFields(
                        { name: 'Member', value: `${member.user.tag || member.user.username} (${member.id})`, inline: false },
                        { name: 'Joined', value: `<t:${Math.floor(new Date(record.joinedAt).getTime() / 1000)}:F>`, inline: true },
                        { name: 'Account age now', value: `${accountAge} day(s)`, inline: true },
                        { name: 'Activity', value: 'No message activity has been observed since joining. Reactions, voice presence and activity outside this server are not counted.', inline: false },
                        { name: 'Staff action', value: 'Please review the member and use Wick if moderation is warranted. Starry will not kick, ban, timeout or assign roles.', inline: false }
                    )
                    .setThumbnail(member.user.displayAvatarURL({ size: 256 }))
                    .setFooter({ text: 'Inactivity is a review signal, not proof of a suspicious account.' })
                    .setTimestamp();

                const content = settings.staffRoleId ? `<@&${settings.staffRoleId}> — member inactivity review` : 'Staff review requested.';
                try {
                    await channel.send({
                        content,
                        embeds: [embed],
                        allowedMentions: { roles: settings.staffRoleId ? [settings.staffRoleId] : [], users: [] }
                    });
                } catch (error) {
                    console.error(`[SusAccount] Failed to send inactivity alert in ${guild.id}:`, error.message);
                    await SusAccountMember.updateOne({}, {
                        $set: {
                            inactivityAlertStatus: null,
                            inactivityAlertedAt: null,
                            inactivityAlertClaimedAt: null
                        }
                    })
                        .where('_id').equals(record._id)
                        .where('joinedAt').equals(record.joinedAt)
                        .where('inactivityAlertStatus').equals('pending')
                        .where('inactivityAlertClaimedAt').equals(now)
                        .setOptions({ sanitizeFilter: true })
                        .exec()
                        .catch(() => {});
                    continue;
                }

                // Mark delivered only after Discord accepts the message. Do not require
                // firstActivityAt to remain null here: the member may speak after the
                // alert has already gone out, and that must not leave a delivered alert
                // in pending state for duplicate retry.
                await SusAccountMember.updateOne({}, {
                    $set: {
                        inactivityAlertStatus: 'sent',
                        inactivityAlertedAt: new Date(),
                        inactivityAlertClaimedAt: null
                    }
                })
                    .where('_id').equals(record._id)
                    .where('joinedAt').equals(record.joinedAt)
                    .where('inactivityAlertStatus').equals('pending')
                    .where('inactivityAlertClaimedAt').equals(now)
                    .setOptions({ sanitizeFilter: true })
                    .exec()
                    .catch((error) => {
                        console.error(`[SusAccount] Alert was sent but its delivery marker could not be saved in ${guild.id}:`, error.message);
                    });
            }
        } catch (error) {
            console.error(`[SusAccount] Inactivity scan failed for ${guild.id}:`, error);
        } finally {
            scanLocks.delete(guild.id);
        }
    }

    client.on('interactionCreate', async (interaction) => {
        if (!interaction.isChatInputCommand() || interaction.commandName !== 'sussetup') return;
        if (!interaction.inGuild()) {
            return interaction.reply({ content: 'Use this setup inside a server.', ephemeral: true });
        }
        if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) {
            return interaction.reply({ content: '❌ You need **Manage Server** permission.', ephemeral: true });
        }

        const guild = interaction.guild;
        if (!guild || !/^\\d{17,20}$/.test(guild.id)) {
            return interaction.reply({ content: '❌ Could not validate this server ID.', ephemeral: true });
        }

        // Defer before database/API work to stay within Discord's initial response deadline.
        try {
            await interaction.deferReply({ flags: [MessageFlags.Ephemeral] });
        } catch (error) {
            console.warn('[SusAccount] Could not defer setup interaction:', error?.message || error);
            return;
        }

        try {
            const enabled = interaction.options.getBoolean('enabled');
            const channelOption = interaction.options.getChannel('channel');
            const staffRole = interaction.options.getRole('staff_role');
            const inactivityDays = interaction.options.getInteger('inactivity_days');
            const accountAgeDays = interaction.options.getInteger('account_age_days');
            const guildId = guild.id;

            const current = await SusAccountSettings.findOne()
                .where('guildId').equals(guildId)
                .setOptions({ sanitizeFilter: true })
                .exec();

            const monitoringEnabled = enabled ?? current?.enabled ?? true;
            const logChannelId = channelOption?.id ?? current?.logChannelId ?? interaction.channelId;
            const staffRoleId = staffRole?.id ?? current?.staffRoleId ?? '';
            const inactivityWindow = inactivityDays ?? current?.inactivityDays ?? DEFAULT_INACTIVITY_DAYS;
            const accountAgeWindow = accountAgeDays ?? current?.accountAgeDays ?? DEFAULT_ACCOUNT_AGE_DAYS;

            if (monitoringEnabled) {
                if (!staffRoleId || staffRoleId === guild.id) {
                    return interaction.editReply({
                        content: '❌ Select a dedicated staff role. Starry needs it to notify moderators about inactivity reviews; @everyone is not accepted.'
                    });
                }

                const resolvedRole = staffRole ||
                    guild.roles.cache.get(staffRoleId) ||
                    await guild.roles.fetch(staffRoleId).catch(() => null);
                if (!resolvedRole || resolvedRole.id === guild.id) {
                    return interaction.editReply({
                        content: '❌ The saved staff role no longer exists. Select a current staff role.'
                    });
                }

                const resolvedChannel = channelOption ||
                    guild.channels.cache.get(logChannelId) ||
                    await guild.channels.fetch(logChannelId).catch(() => null);
                if (!resolvedChannel || resolvedChannel.type !== ChannelType.GuildText || !resolvedChannel.isTextBased()) {
                    return interaction.editReply({
                        content: '❌ Select a valid text channel for member risk and inactivity alerts.'
                    });
                }

                const botMember = guild.members.me || await guild.members.fetchMe().catch(() => null);
                if (!botMember) {
                    return interaction.editReply({
                        content: '❌ Starry could not verify its server permissions. Please try again.'
                    });
                }

                const channelPermissions = resolvedChannel.permissionsFor(botMember);
                if (!channelPermissions?.has([
                    PermissionFlagsBits.ViewChannel,
                    PermissionFlagsBits.SendMessages,
                    PermissionFlagsBits.EmbedLinks
                ])) {
                    return interaction.editReply({
                        content: '❌ Give Starry View Channel, Send Messages and Embed Links permissions in the alert channel.'
                    });
                }

                const canMentionStaff = resolvedRole.mentionable ||
                    channelPermissions.has(PermissionFlagsBits.MentionEveryone);
                if (!canMentionStaff) {
                    return interaction.editReply({
                        content: '❌ Make the staff role mentionable or grant Starry Mention Everyone permission in the alert channel so inactivity alerts can ping staff.'
                    });
                }
            }

            const patch = {
                enabled: monitoringEnabled,
                logChannelId,
                staffRoleId,
                inactivityDays: inactivityWindow,
                accountAgeDays: accountAgeWindow,
                configuredBy: interaction.user.id
            };
            const settings = await SusAccountSettings.findOneAndUpdate(
                {},
                { $set: patch, $setOnInsert: { guildId } },
                { upsert: true, new: true, setDefaultsOnInsert: true, sanitizeFilter: true }
            )
                .where('guildId').equals(guildId)
                .exec();

            const embed = new EmbedBuilder()
                .setColor(settings.enabled ? 0x22C55E : 0x6B7280)
                .setTitle('🛡️ Starry Member Risk Monitor')
                .setDescription(settings.enabled
                    ? 'Monitoring is enabled. Starry reports account-age signals on join and alerts staff when a new member reaches the inactivity threshold.'
                    : 'Monitoring is disabled. No new risk or inactivity alerts will be sent.')
                .addFields(
                    { name: 'Alert channel', value: settings.logChannelId ? `<#${settings.logChannelId}>` : 'Not configured', inline: true },
                    { name: 'Staff role', value: settings.staffRoleId ? `<@&${settings.staffRoleId}>` : 'Not configured', inline: true },
                    { name: 'Inactivity threshold', value: `${settings.inactivityDays} days`, inline: true },
                    { name: 'Young-account threshold', value: `${settings.accountAgeDays} days`, inline: true },
                    { name: 'Moderation policy', value: 'Alerts only. Staff review and use Wick for any moderation action. Starry never auto-punishes members.', inline: false }
                )
                .setFooter({ text: 'Inactivity means no message observed in this server after joining.' })
                .setTimestamp();
            return interaction.editReply({ embeds: [embed] });
        } catch (error) {
            console.error('[SusAccount] Setup failed:', error);
            return interaction.editReply({
                content: '❌ Could not save suspicious-member monitoring settings. Please try again.'
            }).catch(() => {});
        }
    });

    client.on('guildMemberAdd', (member) => {
        if (member.user.bot) return;
        return queueMemberTask(member.guild.id, member.id, async () => {
            try {
                const settings = await getSettings(member.guild.id);
                if (!settings || !settings.enabled) return;

                const joinedAt = new Date(member.joinedTimestamp || Date.now());
                const existing = await SusAccountMember.findOne()
                    .where('guildId').equals(member.guild.id)
                    .where('userId').equals(member.id)
                    .setOptions({ sanitizeFilter: true })
                    .lean()
                    .exec();
                const membershipId = membershipKey(member.guild.id, member.id, joinedAt);
                const pendingFirstActivity = pendingActivity.get(membershipId) || null;
                const sameMembership = existing && isSameMembership(existing.joinedAt, joinedAt);

                // Preserve a first message captured while join initialization was
                // pending for this exact join. A later rejoin starts a fresh record.
                await SusAccountMember.findOneAndUpdate(
                    {},
                    {
                        $set: {
                            joinedAt,
                            accountCreatedAt: new Date(member.user.createdTimestamp),
                            firstActivityAt: sameMembership
                                ? (existing.firstActivityAt || pendingFirstActivity)
                                : pendingFirstActivity,
                            inactivityAlertedAt: sameMembership ? (existing.inactivityAlertedAt || null) : null,
                            inactivityAlertStatus: sameMembership ? (existing.inactivityAlertStatus || null) : null,
                            inactivityAlertClaimedAt: sameMembership ? (existing.inactivityAlertClaimedAt || null) : null,
                            riskAlertedAt: sameMembership ? (existing.riskAlertedAt || null) : null
                        },
                        $setOnInsert: { guildId: member.guild.id, userId: member.id }
                    },
                    { upsert: true, setDefaultsOnInsert: true, sanitizeFilter: true }
                )
                    .where('guildId').equals(member.guild.id)
                    .where('userId').equals(member.id)
                    .exec();
                pendingActivity.delete(membershipId);

                const accountAgeDays = daysBetween(member.user.createdTimestamp);
                const channel = await safeChannel(member.guild, settings.logChannelId);
                if (!channel) {
                    console.warn(`[SusAccount] Join alert channel unavailable in guild ${member.guild.id}.`);
                    return;
                }

                const embed = buildJoinRiskEmbed(member, accountAgeDays, settings.accountAgeDays);
                const content = accountAgeDays <= settings.accountAgeDays && settings.staffRoleId
                    ? `<@&${settings.staffRoleId}> — new-account review`
                    : '';
                await channel.send({
                    content,
                    embeds: [embed],
                    allowedMentions: { roles: content ? [settings.staffRoleId] : [], users: [] }
                });

                if (accountAgeDays <= settings.accountAgeDays) {
                    await SusAccountMember.updateOne({}, {
                        $set: { riskAlertedAt: new Date() }
                    })
                        .where('guildId').equals(member.guild.id)
                        .where('userId').equals(member.id)
                        .where('joinedAt').equals(joinedAt)
                        .setOptions({ sanitizeFilter: true })
                        .exec();
                }
            } catch (error) {
                console.error('[SusAccount] Join assessment failed:', error);
            }
        });
    });

    client.on('guildMemberRemove', (member) => {
        if (member.user?.bot) return;
        const joinedAt = new Date(member.joinedTimestamp || 0);
        return queueMemberTask(member.guild.id, member.id, async () => {
            await SusAccountMember.deleteOne()
                .where('guildId').equals(member.guild.id)
                .where('userId').equals(member.id)
                .where('joinedAt').equals(joinedAt)
                .setOptions({ sanitizeFilter: true })
                .exec()
                .catch((error) => console.error('[SusAccount] Member record cleanup failed:', error.message));
        });
    });

    client.on('messageCreate', (message) => {
        if (!message.guild || message.author.bot || message.webhookId) return;
        const member = message.member || message.guild.members.cache.get(message.author.id);
        const joinedTimestamp = member?.joinedTimestamp;
        if (!joinedTimestamp) return;
        const joinedAt = new Date(joinedTimestamp);
        const firstActivityAt = new Date(message.createdTimestamp || Date.now());

        return queueMemberTask(message.guild.id, message.author.id, async () => {
            try {
                const existing = await SusAccountMember.findOne()
                    .where('guildId').equals(message.guild.id)
                    .where('userId').equals(message.author.id)
                    .setOptions({ sanitizeFilter: true })
                    .lean()
                    .exec();

                if (!existing || !isSameMembership(existing.joinedAt, joinedAt)) {
                    // Only buffer very recent join activity while the join record is
                    // being initialized. Never create tracking rows for every ordinary
                    // message from existing/untracked server members.
                    const ageSinceJoin = Date.now() - joinedAt.getTime();
                    if (ageSinceJoin >= 0 && ageSinceJoin <= MEMBER_INIT_WINDOW_MS) {
                        for (const [pendingKey, pendingAt] of pendingActivity) {
                            if (Date.now() - new Date(pendingAt).getTime() > MEMBER_INIT_WINDOW_MS) {
                                pendingActivity.delete(pendingKey);
                            }
                        }
                        const key = membershipKey(message.guild.id, message.author.id, joinedAt);
                        const pending = pendingActivity.get(key);
                        if (!pending || firstActivityAt < pending) pendingActivity.set(key, firstActivityAt);
                    }
                    return;
                }

                if (existing.firstActivityAt) return;
                await SusAccountMember.updateOne({}, {
                    $set: { firstActivityAt }
                })
                    .where('guildId').equals(message.guild.id)
                    .where('userId').equals(message.author.id)
                    .where('joinedAt').equals(joinedAt)
                    .where('firstActivityAt').equals(null)
                    .setOptions({ sanitizeFilter: true })
                    .exec();
            } catch (error) {
                console.error('[SusAccount] Activity tracking failed:', error.message);
            }
        });
    });

    const runScan = async () => {
        for (const guild of client.guilds.cache.values()) {
            await sendInactivityAlerts(guild);
        }
    };
    if (client.isReady()) {
        runScan();
        setInterval(runScan, SCAN_INTERVAL_MS).unref?.();
    } else {
        client.once('ready', () => {
            runScan();
            setInterval(runScan, SCAN_INTERVAL_MS).unref?.();
        });
    }
};

module.exports.SusAccountSettings = SusAccountSettings;
module.exports.SusAccountMember = SusAccountMember;
module.exports._internals = { daysBetween, hasReachedInactivityThreshold, isSameMembership, isClaimRecoverable };
