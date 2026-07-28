// ==========================================
// 1. IMPORTS & COMMAND SCHEMA
// ==========================================
const { 
    EmbedBuilder, 
    PermissionsBitField, 
    SlashCommandBuilder, 
    PermissionFlagsBits,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle
} = require('discord.js');

const UserActivity = require('../models/UserActivity');
const ChannelScrapeState = require('../models/ChannelScrapeState');
const GuildTrackerSettings = require('../models/GuildTrackerSettings');

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
    if (!total || total === 0) return '░'.repeat(length) + ' 0%';
    const progress = Math.min(Math.max(current / total, 0), 1);
    const fill = Math.round(length * progress);
    const bar = '█'.repeat(fill) + '░'.repeat(length - fill);
    return `\`${bar}\` ${Math.floor(progress * 100)}%`;
}

// ⚡ SLASH COMMAND DATA SCHEMA
const commandData = new SlashCommandBuilder()
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
            .setDescription('Premium: Scrape historical messages into MongoDB')
            .addChannelOption(option =>
                option.setName('private_channel')
                    .setDescription('The private channel for the live scraping dashboard')
                    .setRequired(true))
            .addIntegerOption(option =>
                option.setName('after_days')
                    .setDescription('Fetch data only from the last X days (e.g. 7, 30, 90). Leave blank for full scrape.')
                    .setRequired(false)
                    .setMinValue(1)));

// ==========================================
// 2. HELPER EMBED BUILDERS
// ==========================================
function buildModPanelRow(targetUserId) {
    return new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(`mod_timeout_${targetUserId}`)
            .setLabel('Timeout (7d)')
            .setStyle(ButtonStyle.Secondary)
            .setEmoji('⏰'),
        new ButtonBuilder()
            .setCustomId(`mod_kick_${targetUserId}`)
            .setLabel('Kick User')
            .setStyle(ButtonStyle.Danger)
            .setEmoji('👢'),
        new ButtonBuilder()
            .setCustomId(`mod_ban_${targetUserId}`)
            .setLabel('Ban User')
            .setStyle(ButtonStyle.Danger)
            .setEmoji('🔨'),
        new ButtonBuilder()
            .setCustomId(`mod_dismiss_${targetUserId}`)
            .setLabel('Dismiss Alert')
            .setStyle(ButtonStyle.Secondary)
            .setEmoji('🗑️')
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
        .setAuthor({ 
            name: 'Invite used', 
            iconURL: member.guild.iconURL({ dynamic: true }) || undefined 
        })
        .setTitle('👋 New member joined through this invite')
        .setDescription(
            `<@${member.id}> joined with invite code \`${inviteCode}\` created by ${inviterMention}.\n\n` +
            `**Nickname**\n${member.nickname || 'None'}\n\n` +
            `**Global name**\n\`${member.user.globalName || member.user.username}\`\n\n` +
            `**Joined**\n<t:${joinedUnix}:F>\n<t:${joinedUnix}:R>\n\n` +
            `**Account age**\n<t:${createdAtUnix}:F>\n<t:${createdAtUnix}:R>\n**Age:** ${ageStr}\n\n` +
            `**Activity counter**\nMessages: **${stats.msgs}**\nMedia: **${stats.media}**\nLinks: **${stats.links}**\nVoice joins: **${stats.voice}**\nReactions: **${stats.reacts}**\n\n` +
            `**Tracking ends**\n<t:${endsAtUnix}:F>\n<t:${endsAtUnix}:R>`
        )
        .setThumbnail(member.user.displayAvatarURL({ dynamic: true, size: 256 }))
        .setFooter({ text: `User ID: ${member.id} • Activity counter` });
}

function buildInactivityAlertEmbed(member, inviterId, inviteCode, joinedAtMs) {
    const joinedUnix = Math.floor(joinedAtMs / 1000);
    const ageStr = getAccountAge(member.user.createdAt);
    const inviterMention = inviterId !== 'Unknown' ? `<@${inviterId}>` : 'Unknown Inviter';

    return new EmbedBuilder()
        .setColor('#ED4245')
        .setTitle('⚠️ No activity after 14 days')
        .setDescription(
            `The user <@${member.id}> had no interaction within **14 days** after joining.\n\n` +
            `The user joined through invite code \`${inviteCode}\` created by ${inviterMention} on <t:${joinedUnix}:F>.\n\n` +
            `**Account age:** ${ageStr} • **User ID:** ${member.id}`
        )
        .setThumbnail(member.user.displayAvatarURL({ dynamic: true, size: 256 }));
}
// ==========================================
// 3. SCRAPING ENGINE FUNCTIONS
// ==========================================
async function updateLiveDashboard(logMessage, currentChannel, messagesInChannel, completed = 0, total = 0, timeframeDays = null) {
    try {
        const progressBar = generateProgressBar(completed, total);
        const timeFilterText = timeframeDays ? `Last **${timeframeDays} days**` : '**All Time (Full Scrape)**';

        const embed = new EmbedBuilder()
            .setColor('#5865F2')
            .setAuthor({ name: '🧠 AI Data Bridge • Historical Scraper', iconURL: logMessage.guild.iconURL({ dynamic: true }) || undefined })
            .setTitle('🚀 Live Scraper Engine Active')
            .setDescription('Reading past channel histories to sync activity data into MongoDB. **Do not restart the bot during this process.**')
            .addFields(
                { name: '📍 Current Target', value: `${currentChannel} (\`#${currentChannel.name}\`)`, inline: true },
                { name: '💬 Messages Processed', value: `\`${messagesInChannel.toLocaleString()}\` msgs`, inline: true },
                { name: '⏱️ Time Filter', value: timeFilterText, inline: true },
                { name: '📈 Overall Progress', value: `${progressBar}\n**${completed}** of **${total}** Channels Completed`, inline: false }
            )
            .setFooter({ text: '💎 Premium Engine • Safe Rate-Limit Throttling Active' })
            .setTimestamp();

        await logMessage.edit({ embeds: [embed] });
    } catch (err) {}
}

async function scrapeChannelHistory(channel, logMessage, totalChannels, completedChannels, minTimestamp = 0, timeframeDays = null) {
    let state = await ChannelScrapeState.findOne({ channelId: channel.id }) || 
                new ChannelScrapeState({ guildId: channel.guild.id, channelId: channel.id });

    let fetchOptions = { limit: 100 };
    if (state.newestScrapedId) fetchOptions.after = state.newestScrapedId;

    let hasMoreMessages = true;
    let batchCount = 0;

    while (hasMoreMessages) {
        try {
            const messages = await channel.messages.fetch(fetchOptions);
            if (messages.size === 0) {
                hasMoreMessages = false;
                break;
            }

            const bulkOps = [];
            let reachedTimeLimit = false;

            messages.forEach(msg => {
                if (msg.author.bot) return;

                if (minTimestamp > 0 && msg.createdTimestamp < minTimestamp) {
                    reachedTimeLimit = true;
                    return;
                }

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
            });

            if (bulkOps.length > 0) await UserActivity.bulkWrite(bulkOps);

            const sortedIds = Array.from(messages.keys()).sort();
            if (!state.oldestScrapedId || sortedIds[0] < state.oldestScrapedId) state.oldestScrapedId = sortedIds[0];
            if (!state.newestScrapedId || sortedIds[sortedIds.length - 1] > state.newestScrapedId) state.newestScrapedId = sortedIds[sortedIds.length - 1];

            state.totalMessagesProcessed += messages.size;
            await state.save();

            if (reachedTimeLimit) {
                hasMoreMessages = false;
                break;
            }

            if (state.isFullyScraped) fetchOptions.after = sortedIds[sortedIds.length - 1];
            else fetchOptions.before = sortedIds[0];

            batchCount++;
            if (batchCount % 3 === 0) {
                await updateLiveDashboard(logMessage, channel, state.totalMessagesProcessed, completedChannels, totalChannels, timeframeDays);
            }
            await sleep(1200);
        } catch (error) {
            await sleep(5000);
        }
    }
    state.isFullyScraped = true;
    await state.save();
}

async function startServerScrape(guild, privateAdminChannelId, timeframeDays = null) {
    const adminChannel = guild.channels.cache.get(privateAdminChannelId);
    if (!adminChannel) return;

    const minTimestamp = timeframeDays ? Date.now() - (timeframeDays * 24 * 60 * 60 * 1000) : 0;

    const initEmbed = new EmbedBuilder()
        .setColor('#FEE75C')
        .setTitle('⏳ Initializing Historical Data Engine...')
        .setDescription(`Preparing MongoDB sync... Time Filter: ${timeframeDays ? `**Last ${timeframeDays} Days**` : '**All Time**'}`)
        .setTimestamp();

    const logMessage = await adminChannel.send({ embeds: [initEmbed] });
    const textChannels = guild.channels.cache.filter(c => c.isTextBased());
    let channelsCompleted = 0;

    for (const [id, channel] of textChannels) {
        await updateLiveDashboard(logMessage, channel, 0, channelsCompleted, textChannels.size, timeframeDays);
        await scrapeChannelHistory(channel, logMessage, textChannels.size, channelsCompleted, minTimestamp, timeframeDays);
        channelsCompleted++;
    }

    const doneEmbed = new EmbedBuilder()
        .setColor('#57F287')
        .setAuthor({ name: '🧠 AI Data Bridge • Complete', iconURL: guild.iconURL({ dynamic: true }) || undefined })
        .setTitle('✅ Historical Scrape Completed Successfully')
        .setDescription(
            `Successfully processed **${textChannels.size} channels** into MongoDB.\n\n` +
            `• **Time Window:** ${timeframeDays ? `Last ${timeframeDays} days` : 'Full History'}\n` +
            `• **Status:** Database successfully populated & synced.`
        )
        .setFooter({ text: 'Universal Tracker System' })
        .setTimestamp();

    await logMessage.edit({ embeds: [doneEmbed] });
}
// ==========================================
// 4. MAIN EXPORT (STANDARD COMMAND HANDLER PATTERN)
// ==========================================
module.exports = {
    data: commandData,
    async execute(interaction) {
        if (!interaction.member.permissions.has(PermissionsBitField.Flags.ManageGuild)) {
            return interaction.reply({ content: '❌ You need **Manage Server** permissions.', ephemeral: true });
        }

        const subCommand = interaction.options.getSubcommand();

        if (subCommand === 'setup') {
            await interaction.deferReply();
            const channel = interaction.options.getChannel('channel', true);
            
            await GuildTrackerSettings.findOneAndUpdate(
                { guildId: interaction.guildId },
                { customLogChannel: channel.id },
                { upsert: true }
            );

            const sampleMember = interaction.member;
            const sampleJoinedMs = Date.now();

            const livePreview = buildLiveTrackingEmbed(sampleMember, interaction.user.id, 'uPUQpU4ecR', sampleJoinedMs);
            const alertPreview = buildInactivityAlertEmbed(sampleMember, interaction.user.id, '2xuchf2VnM', sampleJoinedMs - (14 * 24 * 60 * 60 * 1000));
            const modPanelRow = buildModPanelRow(sampleMember.id);

            await channel.send({
                content: '⚙️ **Universal Tracker Configured!** Below is a preview of the tracking cards:',
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

            await GuildTrackerSettings.findOneAndUpdate(
                { guildId: interaction.guildId },
                { privateAdminChannel: privateChannel.id },
                { upsert: true }
            );

            const filterNotice = afterDays ? ` (Filtering last **${afterDays} days**)` : ' (Full Server History)';

            interaction.editReply({ 
                content: `🚀 **Scraper Started!** Check ${privateChannel} for the live dashboard${filterNotice}. Do not restart the bot.` 
            });

            startServerScrape(interaction.guild, privateChannel.id, afterDays);
        }
    }
};
