const { EmbedBuilder, ChannelType, PermissionsBitField } = require('discord.js');
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
setInterval(saveTrackerData, 60 * 1000); // Auto-save every 60 seconds

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
        console.log('✅ Premium 14-Day Activity Tracker Loaded.');
    });

    client.on('inviteCreate', (invite) => {
        if (!invitesCache.has(invite.guild.id)) invitesCache.set(invite.guild.id, new Map());
        invitesCache.get(invite.guild.id).set(invite.code, invite.uses);
    });

    // ==========================================
    // 📥 1. USER JOINS: START LIVE TRACKING (PREMIUM ONLY)
    // ==========================================
    client.on('guildMemberAdd', async (member) => {
        if (member.user.bot) return;
        const guild = member.guild;

        // 💎 PREMIUM GATE: Abort immediately if the server is not Premium!
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

        // Resolve Log Channel (Prioritize Custom Channel, fallback to name)
        let logChannel = null;
        if (trackerCache[guild.id] && trackerCache[guild.id].customLogChannel) {
            logChannel = guild.channels.cache.get(trackerCache[guild.id].customLogChannel);
        }
        if (!logChannel) {
            logChannel = guild.channels.cache.find(c => 
                c.type === ChannelType.GuildText && (c.name.includes('user-invite-logs') || c.name.includes('invite-logs') || c.name.includes('mod-logs'))
            );
        }

        let trackingMsgId = null;
        const joinedAtMs = Date.now();
        const endsAtUnix = Math.floor((joinedAtMs + (14 * 24 * 60 * 60 * 1000)) / 1000);

        if (logChannel) {
            const trackEmbed = new EmbedBuilder()
                .setColor('#5865F2') // Blurple line
                .setDescription(`**Messages:** 0\n**Media:** 0\n**Links:** 0\n**Voice joins:** 0\n**Reactions:** 0\n**Invites:** 0\n\n**Tracking ends**\n<t:${endsAtUnix}:F>\n<t:${endsAtUnix}:R>`)
                .setFooter({ text: `💎 Premium Feature • User ID: ${member.id} • Activity counter updates for 14 days.` });

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
        // 💎 PREMIUM GATE: Don't process stats if server lost Premium status
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
        const hasMedia = message.attachments.size > 0 ? 1 : 0;
        const hasLink = /(https?:\/\/[^\s]+)/g.test(message.content) ? 1 : 0;
        updateActivity(message.guild, message.author, { msgs: 1, media: hasMedia, links: hasLink });
    });

    client.on('voiceStateUpdate', (oldState, newState) => {
        if (!newState.member || newState.member.user.bot) return;
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
    // 🚨 4. AUTOMATED 14-DAY CHECKER (PREMIUM ONLY)
    // ==========================================
    setInterval(async () => {
        const now = Date.now();
        const fourteenDaysMs = 14 * 24 * 60 * 60 * 1000;

        for (const guildId in trackerCache) {
            // 💎 PREMIUM GATE: Skip scanning guilds that aren't Premium
            const isGuildPremium = typeof client.isPremium === 'function' ? client.isPremium(guildId) : false;
            if (!isGuildPremium) continue;

            const guild = client.guilds.cache.get(guildId);
            if (!guild) continue;

            // Resolve Log Channel (Prioritize Custom Channel, fallback to name)
            let logChannel = null;
            if (trackerCache[guildId] && trackerCache[guildId].customLogChannel) {
                logChannel = guild.channels.cache.get(trackerCache[guildId].customLogChannel);
            }
            if (!logChannel) {
                logChannel = guild.channels.cache.find(c => 
                    c.type === ChannelType.GuildText && (c.name.includes('user-invite-logs') || c.name.includes('invite-logs') || c.name.includes('mod-logs'))
                );
            }

            for (const userId in trackerCache[guildId]) {
                const userRecord = trackerCache[guildId][userId];

                if (now - userRecord.joinedAt >= fourteenDaysMs && !userRecord.alerted) {
                    userRecord.alerted = true; 
                    saveTrackerData();

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
    }, 60 * 60 * 1000); // Runs once every hour

    // ==========================================
    // ⚙️ 5. MANUAL SETUP COMMAND (/tracker)
    // ==========================================
    client.on('interactionCreate', async (interaction) => {
        if (!interaction.isChatInputCommand() || interaction.commandName !== 'tracker') return;

        if (!interaction.member.permissions.has(PermissionsBitField.Flags.ManageGuild)) {
            return interaction.reply({ content: '❌ You need **Manage Server** permissions to configure the tracker.', ephemeral: true });
        }

        const channel = interaction.options.getChannel('channel');
        
        if (!trackerCache[interaction.guildId]) trackerCache[interaction.guildId] = {};
        trackerCache[interaction.guildId].customLogChannel = channel.id;
        saveTrackerData();

        return interaction.reply({ content: `✅ **Success!** 14-Day Inactivity dashboards and alerts will now be sent to ${channel}.` });
    });
};
