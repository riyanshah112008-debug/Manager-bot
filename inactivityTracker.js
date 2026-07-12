const { EmbedBuilder, PermissionsBitField } = require('discord.js');
const fs = require('fs');
const path = require('path');

const dbPath = path.join(__dirname, 'inactivityTracker.json');

// ==========================================
// 🧠 MEMORY CACHE SYSTEM
// ==========================================
let trackerCache = {};
if (fs.existsSync(dbPath)) {
    try { trackerCache = JSON.parse(fs.readFileSync(dbPath, 'utf-8')); } 
    catch (e) { console.error('❌ Failed to load tracker database.'); }
}

function saveTrackerData() {
    fs.writeFile(dbPath, JSON.stringify(trackerCache, null, 2), (err) => {
        if (err) console.error('❌ Failed to save tracker data:', err);
    });
}
setInterval(saveTrackerData, 60 * 1000);

function getAccountAge(createdAt) {
    const diffDays = Math.floor((Date.now() - createdAt.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays >= 365) return `${Math.floor(diffDays / 365)} year(s)`;
    if (diffDays >= 30) return `${Math.floor(diffDays / 30)} month(s)`;
    return `${diffDays} day(s)`;
}

module.exports = (client) => {
    const invitesCache = new Map();

    client.on('clientReady', async () => {
        client.guilds.cache.forEach(async (guild) => {
            try {
                const invites = await guild.invites.fetch();
                invitesCache.set(guild.id, new Map(invites.map(inv => [inv.code, inv.uses])));
            } catch (err) {}
        });
        console.log('✅ Premium 14-Day Activity Tracker Loaded (Using Global Router).');
    });
module.exports = (client) => {
    client.trackerCache = trackerCache; // 🟢 Add this line!
    
    const invitesCache = new Map();
    // ... rest of your code ...

    client.on('inviteCreate', (invite) => {
        if (!invitesCache.has(invite.guild.id)) invitesCache.set(invite.guild.id, new Map());
        invitesCache.get(invite.guild.id).set(invite.code, invite.uses);
    });

    // ==========================================
    // 📥 1. USER JOINS: START LIVE TRACKING
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

        // 🧭 GLOBAL SMART ROUTE: Request the 'access' log channel
        const logChannel = trackerCache[guild.id]?.customLogChannel 
            ? guild.channels.cache.get(trackerCache[guild.id].customLogChannel) 
            : client.getLogChannel(guild, 'access');

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

        if (!trackerCache[guild.id]) trackerCache[guild.id] = {};
        trackerCache[guild.id][member.id] = {
            joinedAt: joinedAtMs, inviterId: inviterId, inviteCode: inviteCode,
            logChannelId: logChannel ? logChannel.id : null, logMessageId: trackingMsgId,
            stats: { msgs: 0, media: 0, links: 0, voice: 0, reacts: 0, invites: 0 },
            alerted: false
        };
        saveTrackerData();
    });

    // ==========================================
    // 📊 2. LIVE ACTIVITY UPDATER FUNCTION
    // ==========================================
    async function updateActivity(guild, user, newStats) {
        const isGuildPremium = typeof client.isPremium === 'function' ? client.isPremium(guild.id) : false;
        if (!isGuildPremium || !trackerCache[guild.id] || !trackerCache[guild.id][user.id]) return;

        const record = trackerCache[guild.id][user.id];
        if (Date.now() - record.joinedAt >= 14 * 24 * 60 * 60 * 1000) return;

        record.stats.msgs += newStats.msgs || 0;
        record.stats.media += newStats.media || 0;
        record.stats.links += newStats.links || 0;
        record.stats.voice += newStats.voice || 0;
        record.stats.reacts += newStats.reacts || 0;
        record.stats.invites += newStats.invites || 0;

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
    // 🚨 4. AUTOMATED 14-DAY CHECKER
    // ==========================================
    setInterval(async () => {
        const now = Date.now();
        const fourteenDaysMs = 14 * 24 * 60 * 60 * 1000;

        for (const guildId in trackerCache) {
            const isGuildPremium = typeof client.isPremium === 'function' ? client.isPremium(guildId) : false;
            if (!isGuildPremium) continue;

            const guild = client.guilds.cache.get(guildId);
            if (!guild) continue;

            // 🧭 GLOBAL SMART ROUTE: Request the 'access' log channel
            const logChannel = trackerCache[guildId]?.customLogChannel 
                ? guild.channels.cache.get(trackerCache[guildId].customLogChannel) 
                : client.getLogChannel(guild, 'access');

            for (const userId in trackerCache[guildId]) {
                const userRecord = trackerCache[guildId][userId];

                if (now - userRecord.joinedAt >= fourteenDaysMs && !userRecord.alerted) {
                    userRecord.alerted = true; 
                    saveTrackerData();

                    const s = userRecord.stats;
                    const totalActivity = s.msgs + s.media + s.links + s.voice + s.reacts + s.invites;
                    if (totalActivity > 0) continue; 

                    const member = await guild.members.fetch(userId).catch(() => null);
                    if (!member) {
                        delete trackerCache[guildId][userId]; saveTrackerData(); continue;
                    }

                    if (logChannel) {
                        const inviter = userRecord.inviterId !== 'Unknown' ? `<@${userRecord.inviterId}>` : 'Unknown Inviter';
                        const joinUnix = Math.floor(userRecord.joinedAt / 1000);
                        const accountAge = getAccountAge(member.user.createdAt);

                        const alertEmbed = new EmbedBuilder()
                            .setColor('#ED4245')
                            .setTitle('⚠️ No activity after 14 days')
                            .setDescription(`The user <@${userId}> had no interaction within **14 days** after joining.\n\nThe user joined through invite code \`${userRecord.inviteCode}\` created by ${inviter} on <t:${joinUnix}:F>.`)
                            .setThumbnail(member.user.displayAvatarURL({ dynamic: true }))
                            .setFooter({ text: `💎 Premium Feature • Account age: ${accountAge} • User ID: ${userId}` })
                            .setTimestamp();

                        await logChannel.send({
                            content: `${inviter !== 'Unknown Inviter' ? inviter : ''}\nThe user <@${userId}> had no interaction within 14 days after joining.`,
                            embeds: [alertEmbed]
                        }).catch(() => {});
                    }
                }
            }
        }
    }, 60 * 60 * 1000);

    // ==========================================
    // ⚙️ 5. MANUAL SETUP COMMAND (/tracker)
    // ==========================================
    client.on('interactionCreate', async (interaction) => {
        if (!interaction.isChatInputCommand() || interaction.commandName !== 'tracker') return;
        await interaction.deferReply();
        try {
            if (!interaction.member.permissions.has(PermissionsBitField.Flags.ManageGuild)) return interaction.editReply({ content: '❌ You need **Manage Server** permissions.' });
            const channel = interaction.options.getChannel('channel', true);
            if (!trackerCache[interaction.guildId]) trackerCache[interaction.guildId] = {};
            trackerCache[interaction.guildId].customLogChannel = channel.id;
            saveTrackerData();
            return interaction.editReply({ content: `✅ **Success!** 14-Day Inactivity dashboards and alerts will now be sent to ${channel}.` });
        } catch (error) { return interaction.editReply({ content: `❌ **Error:** \`${error.message}\`` }); }
    });

    // ==========================================
    // 🧪 6. DEVELOPER TEST COMMAND (.testalert)
    // ==========================================
    client.on('messageCreate', async (message) => {
        if (typeof client.isOwner === 'function' ? !client.isOwner(message.author.id) : message.author.id !== process.env.OWNER_ID) return;
        if (!message.content.startsWith('.testalert')) return;

        const targetMember = message.mentions.members.first() || message.member;
        const mockInviter = message.member;
        const mockJoinUnix = Math.floor((Date.now() - (14 * 24 * 60 * 60 * 1000)) / 1000); 
        const accountAge = getAccountAge(targetMember.user.createdAt);

        // Test the Global Smart Router in this server
        const logChannel = trackerCache[message.guild.id]?.customLogChannel 
            ? message.guild.channels.cache.get(trackerCache[message.guild.id].customLogChannel) 
            : client.getLogChannel(message.guild, 'access');
            
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
