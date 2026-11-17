const mongoose = require('mongoose');
const { EmbedBuilder, PermissionFlagsBits, ChannelType } = require('discord.js');

const DAY_MS = 24 * 60 * 60 * 1000;
const SCAN_INTERVAL_MS = 6 * 60 * 60 * 1000;
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
    lastActivityAt: { type: Date, default: null },
    inactivityAlertedAt: { type: Date, default: null },
    riskAlertedAt: { type: Date, default: null }
}, { timestamps: true });
memberSchema.index({ guildId: 1, userId: 1 }, { unique: true });
memberSchema.index({ guildId: 1, joinedAt: 1, inactivityAlertedAt: 1 });

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
            // Sort oldest-first, then apply the date threshold in JavaScript.
            // This keeps MongoDB filters to scalar equality predicates (no raw
            // event-sourced objects or dynamic query operators reach the database).
            const unalertedMembers = await SusAccountMember.find()
                .where('guildId').equals(guild.id)
                .where('lastActivityAt').equals(null)
                .where('inactivityAlertedAt').equals(null)
                .setOptions({ sanitizeFilter: true })
                .sort({ joinedAt: 1 })
                .limit(100)
                .exec();
            const candidates = unalertedMembers.filter(record =>
                hasReachedInactivityThreshold(record.joinedAt, settings.inactivityDays)
            );

            for (const record of candidates) {
                let member = guild.members.cache.get(record.userId);
                if (!member) {
                    try { member = await guild.members.fetch(record.userId); }
                    catch { 
                        await SusAccountMember.updateOne({}, {
                            $set: { inactivityAlertedAt: new Date() }
                        })
                            .where('_id').equals(record._id)
                            .where('inactivityAlertedAt').equals(null)
                            .setOptions({ sanitizeFilter: true })
                            .exec();
                        continue;
                    }
                }
                if (member.user.bot) continue;

                const now = new Date();
                const claim = await SusAccountMember.updateOne({}, {
                    $set: { inactivityAlertedAt: now }
                })
                    .where('_id').equals(record._id)
                    .where('inactivityAlertedAt').equals(null)
                    .where('lastActivityAt').equals(null)
                    .setOptions({ sanitizeFilter: true })
                    .exec();
                if (!claim.modifiedCount) continue;

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
                        $set: { inactivityAlertedAt: null }
                    })
                        .where('_id').equals(record._id)
                        .setOptions({ sanitizeFilter: true })
                        .exec()
                        .catch(() => {});
                }
            }
        } catch (error) {
            console.error(`[SusAccount] Inactivity scan failed for ${guild.id}:`, error);
        } finally {
            scanLocks.delete(guild.id);
        }
    }

    client.on('interactionCreate', async (interaction) => {
        if (!interaction.isChatInputCommand() || interaction.commandName !== 'sussetup') return;
        if (!interaction.inGuild()) return interaction.reply({ content: 'Use this setup inside a server.', ephemeral: true });
        if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) {
            return interaction.reply({ content: '❌ You need **Manage Server** permission.', ephemeral: true });
        }

        // Discord guild IDs are snowflakes. Validate and normalize the external value
        // before using it in any MongoDB query to prevent operator/object injection.
        const guild = interaction.guild;
        if (!guild || !/^\d{17,20}$/.test(guild.id)) {
            return interaction.reply({ content: '❌ Could not validate this server ID.', ephemeral: true });
        }

        const enabled = interaction.options.getBoolean('enabled');
        const channelOption = interaction.options.getChannel('channel');
        const staffRole = interaction.options.getRole('staff_role');
        const inactivityDays = interaction.options.getInteger('inactivity_days');
        const accountAgeDays = interaction.options.getInteger('account_age_days');

        // Use the verified guild object and keep the MongoDB predicate scalar.
        const guildId = guild.id;
        const current = await SusAccountSettings.findOne()
            .where('guildId').equals(guildId)
            .setOptions({ sanitizeFilter: true })
            .exec();
        const patch = {
            enabled: enabled ?? current?.enabled ?? true,
            logChannelId: channelOption?.id ?? current?.logChannelId ?? interaction.channelId,
            staffRoleId: staffRole?.id ?? current?.staffRoleId ?? '',
            inactivityDays: inactivityDays ?? current?.inactivityDays ?? DEFAULT_INACTIVITY_DAYS,
            accountAgeDays: accountAgeDays ?? current?.accountAgeDays ?? DEFAULT_ACCOUNT_AGE_DAYS,
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
                { name: 'Alert channel', value: `<#${settings.logChannelId}>`, inline: true },
                { name: 'Staff role', value: settings.staffRoleId ? `<@&${settings.staffRoleId}>` : 'Not configured', inline: true },
                { name: 'Inactivity threshold', value: `${settings.inactivityDays} days`, inline: true },
                { name: 'Young-account threshold', value: `${settings.accountAgeDays} days`, inline: true },
                { name: 'Moderation policy', value: 'Alerts only. Staff review and use Wick for any moderation action. Starry never auto-punishes members.', inline: false }
            )
            .setFooter({ text: 'Inactivity means no message observed in this server after joining.' })
            .setTimestamp();
        return interaction.reply({ embeds: [embed], ephemeral: true });
    });

    client.on('guildMemberAdd', async (member) => {
        if (member.user.bot) return;
        try {
            const settings = await getSettings(member.guild.id);
            if (!settings || !settings.enabled) return;

            const joinedAt = new Date(member.joinedTimestamp || Date.now());
            await SusAccountMember.findOneAndUpdate(
                {},
                {
                    $set: {
                        joinedAt,
                        accountCreatedAt: new Date(member.user.createdTimestamp),
                        lastActivityAt: null,
                        inactivityAlertedAt: null,
                        riskAlertedAt: null
                    }
                },
                { upsert: true, setDefaultsOnInsert: true, sanitizeFilter: true }
            )
                .where('guildId').equals(member.guild.id)
                .where('userId').equals(member.id)
                .exec();

            const accountAgeDays = daysBetween(member.user.createdTimestamp);
            const channel = await safeChannel(member.guild, settings.logChannelId);
            if (!channel) return;
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
                    .setOptions({ sanitizeFilter: true })
                    .exec();
            }
        } catch (error) {
            console.error('[SusAccount] Join assessment failed:', error);
        }
    });

    client.on('guildMemberRemove', async (member) => {
        if (member.user?.bot) return;
        await SusAccountMember.deleteOne()
            .where('guildId').equals(member.guild.id)
            .where('userId').equals(member.id)
            .setOptions({ sanitizeFilter: true })
            .exec()
            .catch((error) => console.error('[SusAccount] Member record cleanup failed:', error.message));
    });

    client.on('messageCreate', async (message) => {
        if (!message.guild || message.author.bot || message.webhookId) return;
        await SusAccountMember.updateOne({}, {
            $set: { lastActivityAt: new Date(message.createdTimestamp || Date.now()) }
        })
            .where('guildId').equals(message.guild.id)
            .where('userId').equals(message.author.id)
            .where('lastActivityAt').equals(null)
            .setOptions({ sanitizeFilter: true })
            .exec()
            .catch((error) => console.error('[SusAccount] Activity tracking failed:', error.message));
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
module.exports._internals = { daysBetween, hasReachedInactivityThreshold };
