// ==========================================
// 🛡️ STARRY TRACKER ENGINE (PART 1 OF 2)
// ==========================================
const { 
    EmbedBuilder, 
    PermissionsBitField, 
    SlashCommandBuilder, 
    PermissionFlagsBits,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    ChannelType
} = require('discord.js');
const mongoose = require('mongoose');

// Safe Schema Fallbacks
let UserActivity, ChannelScrapeState, GuildTrackerSettings;
try { UserActivity = require('../models/UserActivity'); } catch (e) { UserActivity = mongoose.models.UserActivity; }
try { ChannelScrapeState = require('../models/ChannelScrapeState'); } catch (e) { ChannelScrapeState = mongoose.models.ChannelScrapeState; }
try { GuildTrackerSettings = require('../models/GuildTrackerSettings'); } catch (e) { GuildTrackerSettings = mongoose.models.GuildTrackerSettings; }

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function getAccountAge(createdAt) {
    const diffDays = Math.floor((Date.now() - createdAt.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays >= 365) {
        const years = Math.floor(diffDays / 365);
        return `${years} year${years > 1 ? 's' : ''}`;
    }
    if (diffDays >= 30) {
        const months = Math.floor(diffDays / 30);
        return `${months} month${months > 1 ? 's' : ''}`;
    }
    return `${diffDays} day${diffDays > 1 ? 's' : ''}`;
}

function generateProgressBar(current, total, length = 12) {
    if (!total || total === 0) return '`░░░░░░░░░░░░` 0%';
    const progress = Math.min(Math.max(current / total, 0), 1);
    const fill = Math.round(length * progress);
    const bar = '█'.repeat(fill) + '░'.repeat(length - fill);
    return `\`${bar}\` **${Math.floor(progress * 100)}%**`;
}

// Slash Command Definition
const trackerCommandSchema = new SlashCommandBuilder()
    .setName('tracker')
    .setDescription('Universal Invite Tracker & 14-Day Inactivity System')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand(subcommand =>
        subcommand
            .setName('setup')
            .setDescription('Setup the 14-day inactivity log channel & preview embeds')
            .addChannelOption(option =>
                option.setName('channel')
                    .setDescription('The channel to send inactivity alerts to')
                    .setRequired(true)))
    .addSubcommand(subcommand =>
        subcommand
            .setName('scrape')
            .setDescription('Premium: Scrape historical messages into MongoDB Cloud')
            .addChannelOption(option =>
                option.setName('private_channel')
                    .setDescription('The private channel for the live scraping dashboard')
                    .setRequired(true))
            .addIntegerOption(option =>
                option.setName('after_days')
                    .setDescription('Fetch data only from last X days (e.g. 7, 30, 90). Leave blank for full scrape.')
                    .setRequired(false)
                    .setMinValue(1)));

function buildModPanelRow(targetUserId) {
    return new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`mod_timeout_${targetUserId}`).setLabel('Timeout (7d)').setStyle(ButtonStyle.Secondary).setEmoji('⏰'),
        new ButtonBuilder().setCustomId(`mod_kick_${targetUserId}`).setLabel('Kick User').setStyle(ButtonStyle.Danger).setEmoji('👢'),
        new ButtonBuilder().setCustomId(`mod_ban_${targetUserId}`).setLabel('Ban User').setStyle(ButtonStyle.Danger).setEmoji('🔨'),
        new ButtonBuilder().setCustomId(`mod_dismiss_${targetUserId}`).setLabel('Dismiss Alert').setStyle(ButtonStyle.Secondary).setEmoji('🗑️')
    );
}

function buildLiveTrackingEmbed(member, inviterId, inviteCode, joinedAtMs, stats = { msgs: 0, media: 0, links: 0, voice: 0, reacts: 0 }) {
    const joinedUnix = Math.floor(joinedAtMs / 1000);
    const endsAtUnix = Math.floor((joinedAtMs + (14 * 24 * 60 * 60 * 1000)) / 1000);
    const createdAtUnix = Math.floor(member.user.createdTimestamp / 1000);
    const ageStr = getAccountAge(member.user.createdAt);
    const inviterMention = inviterId !== 'Unknown' ? `<@${inviterId}>` : 'Direct/Vanity';

    return new EmbedBuilder()
        .setColor('#5865F2')
        .setAuthor({ name: 'Invite Tracker • Member Joined', iconURL: member.guild.iconURL({ dynamic: true }) || undefined })
        .setTitle(`👋 Welcome to ${member.guild.name}`)
        .setDescription(
            `<@${member.id}> joined with invite code \`${inviteCode}\` created by ${inviterMention}.\n\n` +
            `**Nickname:** ${member.nickname || 'None'}\n` +
            `**Global Name:** \`${member.user.globalName || member.user.username}\`\n\n` +
            `**Joined Server:** <t:${joinedUnix}:F> (<t:${joinedUnix}:R>)\n` +
            `**Account Created:** <t:${createdAtUnix}:F> (<t:${createdAtUnix}:R>)\n` +
            `**Account Age:** ${ageStr}\n\n` +
            `📊 **Activity Counter (14-Day Window)**\n` +
            `• Messages: **${stats.msgs}**\n` +
            `• Media/Attachments: **${stats.media}**\n` +
            `• Web Links: **${stats.links}**\n` +
            `• Voice Connections: **${stats.voice}**\n` +
            `• Reactions Added: **${stats.reacts}**\n\n` +
            `⏳ **Tracking Period Ends:** <t:${endsAtUnix}:F> (<t:${endsAtUnix}:R>)`
        )
        .setThumbnail(member.user.displayAvatarURL({ dynamic: true, size: 256 }))
        .setFooter({ text: `User ID: ${member.id} • Starry Activity Engine` })
        .setTimestamp();
}

function buildInactivityAlertEmbed(member, inviterId, inviteCode, joinedAtMs) {
    const joinedUnix = Math.floor(joinedAtMs / 1000);
    const ageStr = getAccountAge(member.user.createdAt);
    const inviterMention = inviterId !== 'Unknown' ? `<@${inviterId}>` : 'Unknown Inviter';

    return new EmbedBuilder()
        .setColor('#ED4245')
        .setTitle('🚨 14-Day Inactivity Notice')
        .setDescription(
            `The user <@${member.id}> (\`${member.user.tag}\`) had **ZERO recorded interaction** within 14 days after joining.\n\n` +
            `**Invite Used:** \`${inviteCode}\` (Created by ${inviterMention})\n` +
            `**Joined Date:** <t:${joinedUnix}:F>\n` +
            `**Account Age:** ${ageStr}\n` +
            `**User ID:** \`${member.id}\``
        )
        .setThumbnail(member.user.displayAvatarURL({ dynamic: true, size: 256 }))
        .setFooter({ text: 'Starry Moderation Assistant' })
        .setTimestamp();
                                                 }
            // ==========================================
// 🛡️ STARRY TRACKER ENGINE (PART 2 OF 2)
// ==========================================
const universalTrackerModule = (client) => {

    client.getUserActivity = async (guildId, userId) => {
        if (!UserActivity) return null;
        return await UserActivity.findOne({ guildId, userId });
    };

    if (client.commands && typeof client.commands.set === 'function') {
        client.commands.set('tracker', { data: trackerCommandSchema, execute: handleCommand });
    }

    const invitesCache = new Map();

    client.once('ready', async () => {
        try {
            for (const [guildId, guild] of client.guilds.cache) {
                if (guild.members.me?.permissions.has(PermissionsBitField.Flags.ManageGuild)) {
                    const guildInvites = await guild.invites.fetch().catch(() => null);
                    if (guildInvites) invitesCache.set(guildId, new Map(guildInvites.map(inv => [inv.code, inv.uses])));
                }
            }
            console.log(`✅ Universal Tracker Engine synchronized across ${client.guilds.cache.size} servers.`);
        } catch (err) {}
    });

    client.on('inviteCreate', invite => {
        const guildInvites = invitesCache.get(invite.guild.id);
        if (guildInvites) guildInvites.set(invite.code, invite.uses);
    });

    client.on('inviteDelete', invite => {
        const guildInvites = invitesCache.get(invite.guild.id);
        if (guildInvites) guildInvites.delete(invite.code);
    });

    // --- MEMBER JOIN LISTENER DIRECTED TO #inactivity-tracker ---
    client.on('guildMemberAdd', async member => {
        if (member.user.bot) return;
        const guild = member.guild;

        // Automated Strict Sus Profile / Young Account Detection -> #sus-account-tracker
        const accountAgeDays = (Date.now() - member.user.createdTimestamp) / (1000 * 60 * 60 * 24);
        if (accountAgeDays < 7) {
            const susCh = guild.channels.cache.find(c => c.name === 'sus-account-tracker');
            if (susCh) {
                const susEmbed = new EmbedBuilder()
                    .setColor('#ED4245')
                    .setTitle('🚨 Automated Alt / Young Profile Flagged')
                    .setDescription(
                        `**Member:** <@${member.id}> (\`${member.user.tag}\`)\n` +
                        `**Account Created:** <t:${Math.floor(member.user.createdTimestamp / 1000)}:R>\n` +
                        `**Account Age:** \`${Math.floor(accountAgeDays)} days old\`\n\n` +
                        `⚠️ **Strict Security Policy:** Flagged automatically by Starry Security Engine due to account age < 7 days.`
                    )
                    .setThumbnail(member.user.displayAvatarURL({ dynamic: true }))
                    .setFooter({ text: 'Starry Security Engine' })
                    .setTimestamp();

                await susCh.send({ embeds: [susEmbed] }).catch(() => {});
            }
        }

        let inviterId = 'Unknown';
        let inviteCode = 'Direct/Vanity';

        if (guild.members.me?.permissions.has(PermissionsBitField.Flags.ManageGuild)) {
            const cachedInvites = invitesCache.get(guild.id);
            const newInvites = await guild.invites.fetch().catch(() => null);

            if (cachedInvites && newInvites) {
                const usedInvite = newInvites.find(inv => {
                    const oldUses = cachedInvites.get(inv.code) || 0;
                    return inv.uses > oldUses;
                });

                if (usedInvite) {
                    inviterId = usedInvite.inviter ? usedInvite.inviter.id : 'Unknown';
                    inviteCode = usedInvite.code;
                }
                invitesCache.set(guild.id, new Map(newInvites.map(inv => [inv.code, inv.uses])));
            }
        }

        // --- ENFORCE #inactivity-tracker AS TARGET CHANNEL ---
        let logChannel = guild.channels.cache.find(c => c.name === 'inactivity-tracker');
        if (!logChannel && GuildTrackerSettings) {
            const settings = await GuildTrackerSettings.findOne({ guildId: guild.id }).catch(() => null);
            if (settings?.customLogChannel) logChannel = guild.channels.cache.get(settings.customLogChannel);
        }

        let trackingMsgId = null;
        const joinedAtMs = Date.now();

        // Send 14-Day Activity Counter embed specifically to #inactivity-tracker
        if (logChannel) {
            const trackEmbed = buildLiveTrackingEmbed(member, inviterId, inviteCode, joinedAtMs);
            const sentMsg = await logChannel.send({ embeds: [trackEmbed] }).catch(() => null);
            if (sentMsg) trackingMsgId = sentMsg.id;
        }

        if (UserActivity) {
            await UserActivity.findOneAndUpdate(
                { guildId: guild.id, userId: member.id },
                {
                    joinedAt: joinedAtMs, inviterId, inviteCode,
                    logChannelId: logChannel ? logChannel.id : null, logMessageId: trackingMsgId,
                    is14DayTracker: true, alerted: false,
                    $setOnInsert: { stats: { msgs: 0, media: 0, links: 0, voice: 0, reacts: 0, invites: 0 } }
                },
                { upsert: true, new: true }
            ).catch(() => {});
        }
    });

    async function updateLiveDashboard(logMessage, currentChannel, processedMsgs, completed = 0, total = 0, timeframeDays = null) {
        try {
            const progressBar = generateProgressBar(completed, total);
            const timeFilterText = timeframeDays ? `Last **${timeframeDays} days**` : '**All Time (Full Scrape)**';

            const embed = new EmbedBuilder()
                .setColor('#5865F2')
                .setAuthor({ name: '🧠 AI Data Bridge • Historical Scraper', iconURL: logMessage.guild.iconURL({ dynamic: true }) || undefined })
                .setTitle('🚀 Live Scraper Engine Active')
                .setDescription('Reading past channel histories to sync activity data into MongoDB Cloud. **Do not restart the bot during this process.**')
                .addFields(
                    { name: '📍 Current Target', value: `\`#${currentChannel.name}\``, inline: true },
                    { name: '💬 Messages Processed', value: `\`${processedMsgs.toLocaleString()}\` msgs`, inline: true },
                    { name: '⏱️ Time Filter', value: timeFilterText, inline: true },
                    { name: '📈 Overall Progress', value: `${progressBar}\n**${completed}** of **${total}** Channels Processed`, inline: false }
                )
                .setFooter({ text: 'Starry Premium Engine • Safe Rate-Limit Throttling Active' })
                .setTimestamp();

            await logMessage.edit({ embeds: [embed] }).catch(() => {});
        } catch (err) {}
    }

    async function scrapeChannelHistory(channel, logMessage, totalChannels, completedChannels, minTimestamp = 0, timeframeDays = null) {
        let totalProcessedInChannel = 0;
        let lastMessageId = null;
        let channelDone = false;

        while (!channelDone) {
            const options = { limit: 100 };
            if (lastMessageId) options.before = lastMessageId;

            let fetchedMessages;
            try {
                fetchedMessages = await channel.messages.fetch(options);
            } catch (err) {
                break;
            }

            if (!fetchedMessages || fetchedMessages.size === 0) break;

            const bulkOps = [];
            for (const msg of fetchedMessages.values()) {
                if (msg.author.bot) continue;

                if (minTimestamp > 0 && msg.createdTimestamp < minTimestamp) {
                    channelDone = true;
                    break;
                }

                totalProcessedInChannel++;
                if (UserActivity) {
                    bulkOps.push({
                        updateOne: {
                            filter: { guildId: channel.guild.id, userId: msg.author.id },
                            update: { 
                                $inc: { 
                                    'stats.msgs': 1,
                                    'stats.media': msg.attachments.size > 0 ? 1 : 0,
                                    'stats.links': /(https?:\/\/[^\s]+)/g.test(msg.content) ? 1 : 0 
                                }
                            },
                            upsert: true
                        }
                    });
                }
            }

            if (bulkOps.length > 0 && UserActivity) {
                await UserActivity.bulkWrite(bulkOps).catch(() => {});
            }

            lastMessageId = fetchedMessages.last()?.id;
            await sleep(250);
        }

        return totalProcessedInChannel;
    }

    async function startServerScrape(guild, privateAdminChannelId, timeframeDays = null) {
        const adminChannel = guild.channels.cache.get(privateAdminChannelId);
        if (!adminChannel) return;

        const minTimestamp = timeframeDays ? Date.now() - (timeframeDays * 24 * 60 * 60 * 1000) : 0;
        const textChannels = Array.from(guild.channels.cache.values()).filter(c => c.isTextBased());

        const initEmbed = new EmbedBuilder()
            .setColor('#FEE75C')
            .setTitle('⏳ Initializing Historical Data Engine...')
            .setDescription(`Preparing MongoDB sync for **${textChannels.length} channels**...\nTime Filter: ${timeframeDays ? `**Last ${timeframeDays} Days**` : '**All Time**'}`)
            .setTimestamp();

        let logMessage;
        try {
            logMessage = await adminChannel.send({ embeds: [initEmbed] });
        } catch (e) { return; }

        let channelsCompleted = 0;
        let totalServerMsgs = 0;

        for (const channel of textChannels) {
            const perms = channel.permissionsFor(guild.members.me);
            if (!perms || !perms.has(PermissionsBitField.Flags.ViewChannel) || !perms.has(PermissionsBitField.Flags.ReadMessageHistory)) {
                channelsCompleted++;
                continue;
            }

            await updateLiveDashboard(logMessage, channel, totalServerMsgs, channelsCompleted, textChannels.length, timeframeDays);
            const count = await scrapeChannelHistory(channel, logMessage, textChannels.length, channelsCompleted, minTimestamp, timeframeDays);
            totalServerMsgs += count;
            channelsCompleted++;
        }

        const doneEmbed = new EmbedBuilder()
            .setColor('#23A559')
            .setAuthor({ name: '🧠 AI Data Bridge • Complete', iconURL: guild.iconURL({ dynamic: true }) || undefined })
            .setTitle('✅ Historical Scrape Completed Successfully')
            .setDescription(
                `Successfully processed **${channelsCompleted} channels** and indexed **${totalServerMsgs.toLocaleString()} messages** into MongoDB Cloud.\n\n` +
                `• **Time Window:** ${timeframeDays ? `Last ${timeframeDays} days` : 'Full History'}\n` +
                `• **Status:** System ready for tracking.`
            )
            .setFooter({ text: 'Starry Tracking Core • Data Sync Ready' })
            .setTimestamp();

        await logMessage.edit({ embeds: [doneEmbed] }).catch(() => {});
    }

    client.on('interactionCreate', async (interaction) => {
        if (!interaction.isButton() || !interaction.customId.startsWith('mod_')) return;

        const [_, action, targetUserId] = interaction.customId.split('_');

        if (!interaction.member.permissions.has(PermissionsBitField.Flags.ModerateMembers)) {
            return interaction.reply({ content: '❌ You lack permission to perform moderation actions.', ephemeral: true });
        }

        const member = await interaction.guild.members.fetch(targetUserId).catch(() => null);

        try {
            if (action === 'timeout') {
                if (!member) return interaction.reply({ content: '❌ Member no longer in server.', ephemeral: true });
                await member.timeout(7 * 24 * 60 * 60 * 1000, 'Inactive for 14 days after joining');
                await interaction.reply({ content: `⏰ Timed out <@${targetUserId}> for 7 days.`, ephemeral: true });
            } else if (action === 'kick') {
                if (!member) return interaction.reply({ content: '❌ Member no longer in server.', ephemeral: true });
                await member.kick('Inactive for 14 days after joining');
                await interaction.reply({ content: `👢 Kicked <@${targetUserId}> from the server.`, ephemeral: true });
            } else if (action === 'ban') {
                await interaction.guild.members.ban(targetUserId, { reason: 'Inactive for 14 days after joining' });
                await interaction.reply({ content: `🔨 Banned <@${targetUserId}> from the server.`, ephemeral: true });
            } else if (action === 'dismiss') {
                await interaction.message.delete().catch(() => {});
            }
        } catch (error) {
            return interaction.reply({ content: `❌ **Failed to perform action:** \`${error.message}\``, ephemeral: true });
        }
    });

    async function handleCommand(interaction) {
        if (!interaction.member.permissions.has(PermissionsBitField.Flags.ManageGuild)) {
            return interaction.reply({ content: '❌ You need **Manage Server** permissions.', ephemeral: true });
        }

        const subCommand = interaction.options.getSubcommand();

        if (subCommand === 'setup') {
            await interaction.deferReply();
            const channel = interaction.options.getChannel('channel', true);
            const botMember = interaction.guild.members.me;

            const perms = channel.permissionsFor(botMember);
            if (!perms.has(PermissionsBitField.Flags.SendMessages) || !perms.has(PermissionsBitField.Flags.EmbedLinks)) {
                return interaction.editReply({ content: `❌ **Permission Error:** Please give me **Send Messages** and **Embed Links** permissions in ${channel}!` });
            }

            if (GuildTrackerSettings) {
                await GuildTrackerSettings.findOneAndUpdate(
                    { guildId: interaction.guildId },
                    { customLogChannel: channel.id },
                    { upsert: true }
                ).catch(() => {});
            }

            const sampleMember = interaction.member;
            const sampleJoinedMs = Date.now();

            const livePreview = buildLiveTrackingEmbed(sampleMember, interaction.user.id, 'uPUQpU4ecR', sampleJoinedMs);
            const alertPreview = buildInactivityAlertEmbed(sampleMember, interaction.user.id, '2xuchf2VnM', sampleJoinedMs - (14 * 24 * 60 * 60 * 1000));
            const modPanelRow = buildModPanelRow(sampleMember.id);

            await channel.send({
                content: '⚙️ **Universal Tracker Configured!** Below is a live preview of tracking embeds:',
                embeds: [livePreview]
            }).catch(() => {});

            await channel.send({
                content: `<@${interaction.user.id}>\nThe user <@${sampleMember.id}> had no interaction within 14 days after joining. *(Preview)*`,
                embeds: [alertPreview],
                components: [modPanelRow]
            }).catch(() => {});

            return interaction.editReply({ content: `✅ **Success!** Target tracking channel configured to ${channel}. Sent live preview embeds!` });
        }

        if (subCommand === 'scrape') {
            await interaction.deferReply();
            const privateChannel = interaction.options.getChannel('private_channel', true);
            const afterDays = interaction.options.getInteger('after_days');

            if (GuildTrackerSettings) {
                await GuildTrackerSettings.findOneAndUpdate(
                    { guildId: interaction.guildId },
                    { privateAdminChannel: privateChannel.id },
                    { upsert: true }
                ).catch(() => {});
            }

            const filterNotice = afterDays ? ` (Filtering last **${afterDays} days**)` : ' (Full Server History)';

            await interaction.editReply({ 
                content: `🚀 **Scraper Started!** Check ${privateChannel} for the live dashboard${filterNotice}. Do not restart the bot.` 
            });

            startServerScrape(interaction.guild, privateChannel.id, afterDays);
        }
    }

    client.on('interactionCreate', async (interaction) => {
        if (!interaction.isChatInputCommand() || interaction.commandName !== 'tracker') return;
        await handleCommand(interaction);
    });

    client.on('messageCreate', async (message) => {
        if (!message.content.startsWith('.testalert')) return;

        const targetMember = message.mentions.members.first() || message.member;
        const mockJoinedUnix = Date.now() - (14 * 24 * 60 * 60 * 1000);

        const alertEmbed = buildInactivityAlertEmbed(targetMember, message.author.id, 'uPUQpU4ecR', mockJoinedUnix);
        const modRow = buildModPanelRow(targetMember.id);

        await message.channel.send({
            content: `<@${message.author.id}>\nThe user <@${targetMember.id}> had no interaction within 14 days after joining. *(Test Alert)*`,
            embeds: [alertEmbed],
            components: [modRow]
        }).catch(() => {});
    });
};

universalTrackerModule.data = trackerCommandSchema;
universalTrackerModule.execute = async (interaction) => {
    if (interaction.isChatInputCommand() && interaction.commandName === 'tracker') {
        const subCommand = interaction.options.getSubcommand();
        if (subCommand === 'setup') {
            await interaction.deferReply();
            const channel = interaction.options.getChannel('channel', true);
            return interaction.editReply({ content: `✅ Target channel set to ${channel}.` });
        }
    }
};

module.exports = universalTrackerModule;
module.exports.startServerScrape = universalTrackerModule.startServerScrape;
                                 
