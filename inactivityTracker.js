const { EmbedBuilder, ChannelType } = require('discord.js');
const fs = require('fs');
const path = require('path');

const dbPath = path.join(__dirname, 'inactivityTracker.json');

// ==========================================
// 🧠 MEMORY CACHE SYSTEM (Prevents file corruption & lag)
// ==========================================
let trackerCache = {};
if (fs.existsSync(dbPath)) {
    try { trackerCache = JSON.parse(fs.readFileSync(dbPath, 'utf-8')); } 
    catch (e) { console.error('❌ Failed to load tracker database.'); }
}

// Silently saves data to the file in the background
function saveTrackerData() {
    fs.writeFile(dbPath, JSON.stringify(trackerCache, null, 2), (err) => {
        if (err) console.error('❌ Failed to save tracker data:', err);
    });
}
// Auto-save every 60 seconds
setInterval(saveTrackerData, 60 * 1000);

// Helper to format account age
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
        console.log('✅ Advanced 14-Day Activity Tracker Loaded.');
    });

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

        const logChannel = guild.channels.cache.find(c => 
            c.type === ChannelType.GuildText && (c.name.includes('user-invite-logs') || c.name.includes('invite-logs') || c.name.includes('mod-logs'))
        );

        let trackingMsgId = null;
        const joinedAtMs = Date.now();
        const endsAtUnix = Math.floor((joinedAtMs + (14 * 24 * 60 * 60 * 1000)) / 1000);

        if (logChannel) {
            const trackEmbed = new EmbedBuilder()
                .setColor('#5865F2') // Blurple line
                .setDescription(`**Messages:** 0\n**Media:** 0\n**Links:** 0\n**Voice joins:** 0\n**Reactions:** 0\n**Invites:** 0\n\n**Tracking ends**\n<t:${endsAtUnix}:F>\n<t:${endsAtUnix}:R>`)
                .setFooter({ text: `User ID: ${member.id} • Activity counter updates for 14 days.` });

            const sentMsg = await logChannel.send({ embeds: [trackEmbed] }).catch(() => null);
            if (sentMsg) trackingMsgId = sentMsg.id;
        }

        if (!trackerCache[guild.id]) trackerCache[guild.id] = {};
        
        trackerCache[guild.id][member.id] = {
            joinedAt: joinedAtMs,
            inviterId: inviterId,
            inviteCode: inviteCode,
            logChannelId: logChannel ? logChannel.id : null,
            logMessageId: trackingMsgId,
            stats: { msgs: 0, media: 0, links: 0, voice: 0, reacts: 0, invites: 0 },
            alerted: false
        };
        saveTrackerData();
    });

    // ==========================================
    // 📊 2. LIVE ACTIVITY UPDATER FUNCTION
    // ==========================================
    async function updateActivity(guild, user, newStats) {
        if (!trackerCache[guild.id] || !trackerCache[guild.id][user.id]) return;
        
        const record = trackerCache[guild.id][user.id];
        
        // Stop tracking if 14 days have passed
        if (Date.now() - record.joinedAt >= 14 * 24 * 60 * 60 * 1000) return;

        // Add new activity to totals
        record.stats.msgs += newStats.msgs || 0;
        record.stats.media += newStats.media || 0;
        record.stats.links += newStats.links || 0;
        record.stats.voice += newStats.voice || 0;
        record.stats.reacts += newStats.reacts || 0;
        record.stats.invites += newStats.invites || 0;

        // Update the live message in Discord
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
                            .setFooter({ text: `User ID: ${user.id} • Activity counter updates for 14 days.` });
                        
                        await msg.edit({ embeds: [updatedEmbed] }).catch(() => {});
                    }
                }
            } catch (err) {}
        }
    }

    // ==========================================
    // 🎧 3. EVENT LISTENERS (Catching Activity)
    // ==========================================
    client.on('messageCreate', (message) => {
        if (message.author.bot || !message.guild) return;
        const hasMedia = message.attachments.size > 0 ? 1 : 0;
        const hasLink = /(https?:\/\/[^\s]+)/g.test(message.content) ? 1 : 0;
        updateActivity(message.guild, message.author, { msgs: 1, media: hasMedia, links: hasLink });
    });

    client.on('voiceStateUpdate', (oldState, newState) => {
        if (!newState.member || newState.member.user.bot) return;
        // Check if they joined a new voice channel
        if (!oldState.channelId && newState.channelId) {
            updateActivity(newState.guild, newState.member.user, { voice: 1 });
        }
    });

    client.on('messageReactionAdd', (reaction, user) => {
        if (user.bot || !reaction.message.guild) return;
        updateActivity(reaction.message.guild, user, { reacts: 1 });
    });

    client.on('inviteCreate', (invite) => {
        if (!invite.inviter || invite.inviter.bot) return;
        updateActivity(invite.guild, invite.inviter, { invites: 1 });
    });

    // ==========================================
    // 🚨 4. AUTOMATED 14-DAY CHECKER
    // ==========================================
    setInterval(async () => {
        const now = Date.now();
        const fourteenDaysMs = 14 * 24 * 60 * 60 * 1000;

        for (const guildId in trackerCache) {
            const guild = client.guilds.cache.get(guildId);
            if (!guild) continue;

            const logChannel = guild.channels.cache.find(c => 
                c.type === ChannelType.GuildText && (c.name.includes('user-invite-logs') || c.name.includes('invite-logs') || c.name.includes('mod-logs'))
            );

            for (const userId in trackerCache[guildId]) {
                const userRecord = trackerCache[guildId][userId];

                if (now - userRecord.joinedAt >= fourteenDaysMs && !userRecord.alerted) {
                    userRecord.alerted = true; // Mark as alerted
                    saveTrackerData();

                    // Sum up all activity. If greater than 0, they are safe.
                    const s = userRecord.stats;
                    const totalActivity = s.msgs + s.media + s.links + s.voice + s.reacts + s.invites;
                    if (totalActivity > 0) continue; 

                    if (logChannel) {
                        const member = await guild.members.fetch(userId).catch(() => null);
                        const inviter = userRecord.inviterId !== 'Unknown' ? `<@${userRecord.inviterId}>` : 'Unknown Inviter';
                        const joinUnix = Math.floor(userRecord.joinedAt / 1000);
                        const accountAge = member ? getAccountAge(member.user.createdAt) : 'Unknown';

                        const alertEmbed = new EmbedBuilder()
                            .setColor('#ED4245')
                            .setTitle('⚠️ No activity after 14 days')
                            .setDescription(`The user <@${userId}> had no interaction within **14 days** after joining.\n\nThe user joined through invite code \`${userRecord.inviteCode}\` created by ${inviter} on <t:${joinUnix}:F>.`)
                            .setThumbnail(member ? member.user.displayAvatarURL({ dynamic: true }) : null)
                            .setFooter({ text: `Account age: ${accountAge} • User ID: ${userId}` })
                            .setTimestamp();

                        await logChannel.send({
                            content: `${inviter !== 'Unknown Inviter' ? inviter : ''}\nThe user <@${userId}> had no interaction within 14 days after joining.`,
                            embeds: [alertEmbed]
                        }).catch(() => {});
                    }
                }
            }
        }
    }, 60 * 60 * 1000); // Runs once every hour
};
