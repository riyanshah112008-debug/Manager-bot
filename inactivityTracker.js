const { EmbedBuilder, PermissionsBitField } = require('discord.js');
const UserActivity = require('./models/UserActivity');
const ChannelScrapeState = require('./models/ChannelScrapeState');
const GuildTrackerSettings = require('./models/GuildTrackerSettings');

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function getAccountAge(createdAt) {
    const diffDays = Math.floor((Date.now() - createdAt.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays >= 365) return `${Math.floor(diffDays / 365)} year(s)`;
    if (diffDays >= 30) return `${Math.floor(diffDays / 30)} month(s)`;
    return `${diffDays} day(s)`;
}

module.exports = (client) => {
    // 🟢 DATA BRIDGE: Attach helper methods to client so starry.js can interact with MongoDB
    client.getUserActivity = async (guildId, userId) => {
        return await UserActivity.findOne({ guildId, userId });
    };

    const invitesCache = new Map();

    client.on('clientReady', async () => {
        client.guilds.cache.forEach(async (guild) => {
            try {
                const invites = await guild.invites.fetch();
                invitesCache.set(guild.id, new Map(invites.map(inv => [inv.code, inv.uses])));
            } catch (err) {}
        });
        console.log('✅ Premium 14-Day Tracker & Historical Scraper Loaded (MongoDB + Universal Router Active).');
    });

    client.on('inviteCreate', (invite) => {
        if (!invitesCache.has(invite.guild.id)) invitesCache.set(invite.guild.id, new Map());
        invitesCache.get(invite.guild.id).set(invite.code, invite.uses);
    });

    // ==========================================
    // 📥 1. USER JOINS: START 14-DAY ONBOARDING TRACKING
    // ==========================================
    client.on('guildMemberAdd', async (member) => {
        if (member.user.bot) return;
        const guild = member.guild;

        const isGuildPremium = typeof client.isPremium === 'function' ? client.isPremium(guild.id) : false;
        if (!isGuildPremium) return;

        let inviterId = 'Unknown';
        let inviteCode = 'Direct/Vanity';

        try {
            const newInvites = await guild.invites.fetch();
            const oldInvites = invitesCache.get(guild.id);
            const usedInvite = newInvites.find(inv => {
                const oldUses = oldInvites ? oldInvites.get(inv.code) || 0 : 0;
                return inv.uses > oldUses;
            });
            if (usedInvite) {
                inviterId = usedInvite.inviter ? usedInvite.inviter.id : 'Unknown';
                inviteCode = usedInvite.code;
            }
            invitesCache.set(guild.id, new Map(newInvites.map(inv => [inv.code, inv.uses])));
        } catch (err) {}

        const settings = await GuildTrackerSettings.findOne({ guildId: guild.id });
        const logChannel = settings?.customLogChannel 
            ? guild.channels.cache.get(settings.customLogChannel) 
            : (typeof client.getLogChannel === 'function' ? client.getLogChannel(guild, 'access') : null);

        let trackingMsgId = null;
        const joinedAtMs = Date.now();
        const endsAtUnix = Math.floor((joinedAtMs + (14 * 24 * 60 * 60 * 1000)) / 1000);

        if (logChannel) {
            const trackEmbed = new EmbedBuilder()
                .setColor('#5865F2')
                .setDescription(`**Messages:** 0\n**Media:** 0\n**Links:** 0\n**Voice joins:** 0\n**Reactions:** 0\n**Invites:** 0\n\n**Tracking ends**\n<t:${endsAtUnix}:F>\n<t:${endsAtUnix}:R>`)
                .setFooter({ text: `💎 Premium Feature • User ID: ${member.id} • Activity counter updates for 14 days.` });

            const sentMsg = await logChannel.send({ embeds: [trackEmbed] }).catch(() => null);
            if (sentMsg) trackingMsgId = sentMsg.id;
        }

        await UserActivity.findOneAndUpdate(
            { guildId: guild.id, userId: member.id },
            {
                joinedAt: joinedAtMs, inviterId, inviteCode,
                logChannelId: logChannel ? logChannel.id : null, logMessageId: trackingMsgId,
                is14DayTracker: true, alerted: false,
                $setOnInsert: { stats: { msgs: 0, media: 0, links: 0, voice: 0, reacts: 0, invites: 0 } }
            },
            { upsert: true, new: true }
        );
    });

    // ==========================================
    // 📊 2. LIVE ACTIVITY UPDATER (MONGODB ATOMIC)
    // ==========================================
    async function updateActivity(guild, user, newStats) {
        const isGuildPremium = typeof client.isPremium === 'function' ? client.isPremium(guild.id) : false;
        if (!isGuildPremium || user.bot) return;

        const updateQuery = {};
        for (const [key, val] of Object.entries(newStats)) {
            if (val > 0) updateQuery[`stats.${key}`] = val;
        }

        const record = await UserActivity.findOneAndUpdate(
            { guildId: guild.id, userId: user.id },
            { $inc: updateQuery },
            { new: true, upsert: false } 
        );

        if (!record || !record.is14DayTracker) return;
        if (Date.now() - record.joinedAt >= 14 * 24 * 60 * 60 * 1000) return;

        if (record.logChannelId && record.logMessageId) {
            try {
                const channel = guild.channels.cache.get(record.logChannelId);
                if (channel) {
                    const msg = await channel.messages.fetch(record.logMessageId).catch(() => null);
                    if (msg) {
                        const endsAtUnix = Math.floor((record.joinedAt + (14 * 24 * 60 * 60 * 1000)) / 1000);
                        const updatedEmbed = new EmbedBuilder()
                            .setColor('#5865F2')
                            .setDescription(`**Messages:** ${record.stats.msgs}\n**Media:** ${record.stats.media}\n**Links:** ${record.stats.links}\n**Voice joins:** ${record.stats.voice}\n**Reactions:** ${record.stats.reacts}\n**Invites:** ${record.stats.invites}\n\n**Tracking ends**\n<t:${endsAtUnix}:F>\n<t:${endsAtUnix}:R>`)
                            .setFooter({ text: `💎 Premium Feature • User ID: ${user.id} • Activity counter updates for 14 days.` });
                        await msg.edit({ embeds: [updatedEmbed] }).catch(() => {});
                    }
                }
            } catch (err) {}
        }
    }

    // ==========================================
    // 🎧 3. EVENT LISTENERS
    // ==========================================
    client.on('messageCreate', (message) => {
        if (message.author.bot || !message.guild) return;
        updateActivity(message.guild, message.author, { msgs: 1, media: message.attachments.size > 0 ? 1 : 0, links: /(https?:\/\/[^\s]+)/g.test(message.content) ? 1 : 0 });
    });
    client.on('voiceStateUpdate', (oldState, newState) => {
        if (!newState.member || newState.member.user.bot) return;
        if (!oldState.channelId && newState.channelId) updateActivity(newState.guild, newState.member.user, { voice: 1 });
    });
    client.on('messageReactionAdd', (reaction, user) => {
        if (!user.bot && reaction.message.guild) updateActivity(reaction.message.guild, user, { reacts: 1 });
    });
    client.on('inviteCreate', (invite) => {
        if (invite.inviter && !invite.inviter.bot) updateActivity(invite.guild, invite.inviter, { invites: 1 });
    });
    // ==========================================
    // ⏳ 4. KEVIN'S HISTORICAL SCRAPING ENGINE
    // ==========================================
    async function updateLiveDashboard(logMessage, currentChannel, messagesInChannel, completed = 0, total = 0) {
        try {
            const embed = new EmbedBuilder()
                .setColor('#5865F2')
                .setTitle('🧠 AI Data Bridge: Historical Scraper')
                .setDescription(`Reading past chats to populate MongoDB. Do not restart the bot.`)
                .addFields(
                    { name: '📍 Current Channel', value: `${currentChannel} (\`#${currentChannel.name}\`)`, inline: true },
                    { name: '📊 Channel Messages Processed', value: `${messagesInChannel.toLocaleString()}`, inline: true },
                    { name: '📈 Overall Progress', value: `${completed}/${total || '?'} Channels Completed`, inline: false }
                )
                .setFooter({ text: '💎 Premium Feature • Safe Rate-Limit Throttling Active' })
                .setTimestamp();
            await logMessage.edit({ embeds: [embed] });
        } catch (err) {}
    }

    async function scrapeChannelHistory(channel, logMessage, totalChannels, completedChannels) {
        let state = await ChannelScrapeState.findOne({ channelId: channel.id }) || 
                    new ChannelScrapeState({ guildId: channel.guild.id, channelId: channel.id });

        let fetchOptions = { limit: 100 };
        if (state.newestScrapedId) fetchOptions.after = state.newestScrapedId;

        let hasMoreMessages = true;
        let batchCount = 0;
        let localMessageCount = 0;

        while (hasMoreMessages) {
            try {
                const messages = await channel.messages.fetch(fetchOptions);
                if (messages.size === 0) {
                    hasMoreMessages = false;
                    break;
                }

                const bulkOps = [];
                messages.forEach(msg => {
                    if (msg.author.bot) return;
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

                localMessageCount += messages.size;
                state.totalMessagesProcessed += messages.size;
                await state.save();

                if (state.isFullyScraped) fetchOptions.after = sortedIds[sortedIds.length - 1];
                else fetchOptions.before = sortedIds[0];

                batchCount++;
                if (batchCount % 5 === 0) {
                    await updateLiveDashboard(logMessage, channel, state.totalMessagesProcessed, completedChannels, totalChannels);
                }
                await sleep(1500); // 1.5s delay to prevent Discord 429 rate limit bans
            } catch (error) {
                await sleep(5000);
            }
        }
        state.isFullyScraped = true;
        await state.save();
    }

    async function startServerScrape(guild, privateAdminChannelId) {
        const adminChannel = guild.channels.cache.get(privateAdminChannelId);
        if (!adminChannel) return;

        const initEmbed = new EmbedBuilder()
            .setColor('#FEE75C')
            .setTitle('⏳ Historical Data Scraper Active')
            .setDescription('Initializing MongoDB sync...')
            .setTimestamp();

        const logMessage = await adminChannel.send({ embeds: [initEmbed] });
        const textChannels = guild.channels.cache.filter(c => c.isTextBased());
        let channelsCompleted = 0;

        for (const [id, channel] of textChannels) {
            await updateLiveDashboard(logMessage, channel, 0, channelsCompleted, textChannels.size);
            await scrapeChannelHistory(channel, logMessage, textChannels.size, channelsCompleted);
            channelsCompleted++;
        }

        const doneEmbed = new EmbedBuilder()
            .setColor('#57F287')
            .setTitle('✅ Historical Scrape Complete')
            .setDescription(`Successfully processed **${textChannels.size} channels** into MongoDB without double-counting. The bot is now ready for normal tasks.`)
            .setTimestamp();
        await logMessage.edit({ embeds: [doneEmbed] });
    }

    // ==========================================
    // 🚨 5. AUTOMATED 14-DAY INACTIVITY CHECKER
    // ==========================================
    setInterval(async () => {
        const now = Date.now();
        const fourteenDaysMs = 14 * 24 * 60 * 60 * 1000;
        const cutoffTime = now - fourteenDaysMs;

        try {
            const inactiveUsers = await UserActivity.find({
                is14DayTracker: true,
                alerted: false,
                joinedAt: { $lte: cutoffTime, $gt: 0 }
            });

            for (const userRecord of inactiveUsers) {
                userRecord.alerted = true;
                await userRecord.save();

                const s = userRecord.stats;
                const totalActivity = s.msgs + s.media + s.links + s.voice + s.reacts + s.invites;
                if (totalActivity > 0) continue;

                const guild = client.guilds.cache.get(userRecord.guildId);
                if (!guild) continue;

                const isGuildPremium = typeof client.isPremium === 'function' ? client.isPremium(guild.id) : false;
                if (!isGuildPremium) continue;

                const member = await guild.members.fetch(userRecord.userId).catch(() => null);
                if (!member) {
                    await UserActivity.deleteOne({ _id: userRecord._id });
                    continue;
                }

                const settings = await GuildTrackerSettings.findOne({ guildId: guild.id });
                const logChannel = settings?.customLogChannel 
                    ? guild.channels.cache.get(settings.customLogChannel) 
                    : (typeof client.getLogChannel === 'function' ? client.getLogChannel(guild, 'access') : null);

                if (logChannel) {
                    const inviter = userRecord.inviterId !== 'Unknown' ? `<@${userRecord.inviterId}>` : 'Unknown Inviter';
                    const joinUnix = Math.floor(userRecord.joinedAt / 1000);
                    const accountAge = getAccountAge(member.user.createdAt);

                    const alertEmbed = new EmbedBuilder()
                        .setColor('#ED4245')
                        .setTitle('⚠️ No activity after 14 days')
                        .setDescription(`The user <@${userRecord.userId}> had no interaction within **14 days** after joining.\n\nThe user joined through invite code \`${userRecord.inviteCode}\` created by ${inviter} on <t:${joinUnix}:F>.`)
                        .setThumbnail(member.user.displayAvatarURL({ dynamic: true }))
                        .setFooter({ text: `💎 Premium Feature • Account age: ${accountAge} • User ID: ${userRecord.userId}` })
                        .setTimestamp();

                    await logChannel.send({
                        content: `${inviter !== 'Unknown Inviter' ? inviter : ''}\nThe user <@${userRecord.userId}> had no interaction within 14 days after joining.`,
                        embeds: [alertEmbed]
                    }).catch(() => {});
                }
            }
        } catch (err) {
            console.error('❌ Error in 14-day inactivity checker:', err);
        }
    }, 60 * 60 * 1000);

    // ==========================================
    // ⚙️ 6. COMMANDS (/tracker setup & /tracker scrape)
    // ==========================================
    client.on('interactionCreate', async (interaction) => {
        if (!interaction.isChatInputCommand() || interaction.commandName !== 'tracker') return;
        await interaction.deferReply();
        try {
            if (!interaction.member.permissions.has(PermissionsBitField.Flags.ManageGuild)) {
                return interaction.editReply({ content: '❌ You need **Manage Server** permissions.' });
            }

            const subCommand = interaction.options.getSubcommand();

            if (subCommand === 'setup') {
                const channel = interaction.options.getChannel('channel', true);
                await GuildTrackerSettings.findOneAndUpdate(
                    { guildId: interaction.guildId },
                    { customLogChannel: channel.id },
                    { upsert: true }
                );
                return interaction.editReply({ content: `✅ **Success!** 14-Day Inactivity dashboards and alerts will now be sent to ${channel}.` });
            } 
            
            if (subCommand === 'scrape') {
                const isGuildPremium = typeof client.isPremium === 'function' ? client.isPremium(interaction.guildId) : false;
                if (!isGuildPremium) return interaction.editReply({ content: '💎 This historical scraping engine is a **Premium Only** feature.' });

                const privateChannel = interaction.options.getChannel('private_channel', true);
                await GuildTrackerSettings.findOneAndUpdate(
                    { guildId: interaction.guildId },
                    { privateAdminChannel: privateChannel.id },
                    { upsert: true }
                );
                
                interaction.editReply({ content: `🚀 **Started!** Check ${privateChannel} for the live scraping dashboard. Do not restart the bot while reading past chats.` });
                
                startServerScrape(interaction.guild, privateChannel.id);
            }
        } catch (error) { 
            return interaction.editReply({ content: `❌ **Error:** \`${error.message}\`` }); 
        }
    });

    // ==========================================
    // 🧪 7. DEVELOPER TEST COMMAND (.testalert)
    // ==========================================
    client.on('messageCreate', async (message) => {
        if (typeof client.isOwner === 'function' ? !client.isOwner(message.author.id) : message.author.id !== process.env.OWNER_ID) return;
        if (!message.content.startsWith('.testalert')) return;

        const targetMember = message.mentions.members.first() || message.member;
        const mockInviter = message.member;
        const mockJoinUnix = Math.floor((Date.now() - (14 * 24 * 60 * 60 * 1000)) / 1000); 
        const accountAge = getAccountAge(targetMember.user.createdAt);

        const settings = await GuildTrackerSettings.findOne({ guildId: message.guild.id });
        const logChannel = settings?.customLogChannel 
            ? message.guild.channels.cache.get(settings.customLogChannel) 
            : (typeof client.getLogChannel === 'function' ? client.getLogChannel(message.guild, 'access') : null);

        const destinationText = logChannel ? `**Destination Channel:** ${logChannel}` : `**Destination Channel:** ❌ None found!`;

        const testEmbed = new EmbedBuilder()
            .setColor('#ED4245')
            .setTitle('⚠️ No activity after 14 days')
            .setDescription(`The user <@${targetMember.id}> had no interaction within **14 days** after joining.\n\nThe user joined through invite code \`uPUQpU4ecR\` created by <@${mockInviter.id}> on <t:${mockJoinUnix}:F>.\n\n${destinationText}`)
            .setThumbnail(targetMember.user.displayAvatarURL({ dynamic: true }))
            .setFooter({ text: `💎 Premium Feature • Account age: ${accountAge} • User ID: ${targetMember.id}` })
            .setTimestamp();

        await message.channel.send({ content: `<@${mockInviter.id}>\nThe user <@${targetMember.id}> had no interaction within 14 days after joining.`, embeds: [testEmbed] });
    });
};
