const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const mongoose = require('mongoose');

// 🗄️ MONGODB SCHEMAS
const LevelUserSchema = new mongoose.Schema({
    userId: { type: String, required: true },
    guildId: { type: String, required: true },
    xp: { type: Number, default: 0 },
    level: { type: Number, default: 0 },
    messages: { type: Number, default: 0 },
    vc_time: { type: Number, default: 0 }
});
LevelUserSchema.index({ userId: 1, guildId: 1 }, { unique: true });
const LevelUser = mongoose.models.LevelUser || mongoose.model('LevelUser', LevelUserSchema);

const LevelSettings = mongoose.models.LevelSettings || mongoose.model('LevelSettings', new mongoose.Schema({
    guildId: { type: String, required: true, unique: true },
    enabled: { type: Boolean, default: true },
    logChannelId: { type: String, default: null } // 🟢 Added Custom Log Channel
}));

// In-Memory Caches
const settingsCache = new Map(); // Now stores { enabled: boolean, logChannelId: string | null }
const xpCooldowns = new Map(); 
const vcJoinTimes = new Map(); 

// Helper Functions
function calculateLevel(xp) { return Math.floor(0.1 * Math.sqrt(xp)); }
function xpForNextLevel(currentLevel) { return Math.pow((currentLevel + 1) / 0.1, 2); }
function formatVcTime(minutes) {
    if (!minutes) return '0m';
    const hrs = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return hrs > 0 ? `${hrs}h ${mins}m` : `${mins}m`;
}

// Build Rank Embed
function buildRankEmbed(targetUser, userData, guild) {
    const nextLevelXp = xpForNextLevel(userData.level);
    const progressPercent = Math.min(Math.round((userData.xp / nextLevelXp) * 10), 10);
    const progressBar = '🟩'.repeat(progressPercent) + '⬛'.repeat(10 - progressPercent);

    return new EmbedBuilder()
        .setColor('#2b2d31')
        .setAuthor({ name: `${targetUser.username}'s Server Stats`, iconURL: targetUser.displayAvatarURL({ dynamic: true }) })
        .setThumbnail(targetUser.displayAvatarURL({ dynamic: true, size: 256 }))
        .addFields(
            { name: '✨ Level', value: `\`\`\`ansi\n\u001b[1;36mLevel ${userData.level}\u001b[0m\n\`\`\``, inline: true },
            { name: '📊 Total XP', value: `\`\`\`ansi\n\u001b[1;33m${userData.xp} XP\u001b[0m\n\`\`\``, inline: true },
            { name: '\u200b', value: '\u200b', inline: true }, 
            { name: '💬 Messages Sent', value: `\`${userData.messages || 0}\``, inline: true },
            { name: '🎙️ Time in Voice', value: `\`${formatVcTime(userData.vc_time)}\``, inline: true },
            { name: '\u200b', value: '\u200b', inline: true }, 
            { name: `📈 Progress to Level ${userData.level + 1}`, value: `${progressBar} (${Math.round((userData.xp / nextLevelXp) * 100)}%)` }
        )
        .setFooter({ text: guild.name, iconURL: guild.iconURL() })
        .setTimestamp();
}

// Build Interactive Leaderboards
async function buildLeaderboardData(guildId, guild, type = 'xp') {
    let topUsers = [];
    let title = ''; let emoji = ''; let color = '';

    if (type === 'xp') {
        topUsers = await LevelUser.find({ guildId }).sort({ xp: -1 }).limit(10);
        title = 'Top XP Earners'; emoji = '✨'; color = '#FFD700';
    } else if (type === 'messages') {
        topUsers = await LevelUser.find({ guildId }).sort({ messages: -1 }).limit(10);
        title = 'Most Active Chatters'; emoji = '💬'; color = '#00BFFF';
    } else if (type === 'vc') {
        topUsers = await LevelUser.find({ guildId }).sort({ vc_time: -1 }).limit(10);
        title = 'Voice Channel Leaders'; emoji = '🎙️'; color = '#FF4500';
    }

    let description = '';
    if (topUsers.length === 0) {
        description = '*No data available for this category yet.*';
    } else {
        topUsers.forEach((user, index) => {
            let medal = '🏅';
            if (index === 0) medal = '🥇';
            if (index === 1) medal = '🥈';
            if (index === 2) medal = '🥉';

            if (type === 'xp') description += `**${index + 1}.** ${medal} <@${user.userId}>\n↳ **Level ${user.level}** • \`${user.xp} XP\`\n\n`;
            if (type === 'messages') description += `**${index + 1}.** ${medal} <@${user.userId}>\n↳ \`${user.messages} Messages\`\n\n`;
            if (type === 'vc') description += `**${index + 1}.** ${medal} <@${user.userId}>\n↳ \`${formatVcTime(user.vc_time)}\` in Voice\n\n`;
        });
    }

    const embed = new EmbedBuilder()
        .setColor(color)
        .setTitle(`🏆 Leaderboard: ${title}`)
        .setDescription(description)
        .setThumbnail(guild.iconURL({ dynamic: true }))
        .setTimestamp();

    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('lb_xp').setLabel('XP Rank').setStyle(type === 'xp' ? ButtonStyle.Success : ButtonStyle.Secondary).setEmoji('✨'),
        new ButtonBuilder().setCustomId('lb_messages').setLabel('Messages').setStyle(type === 'messages' ? ButtonStyle.Success : ButtonStyle.Secondary).setEmoji('💬'),
        new ButtonBuilder().setCustomId('lb_vc').setLabel('Voice Time').setStyle(type === 'vc' ? ButtonStyle.Success : ButtonStyle.Secondary).setEmoji('🎙️')
    );

    return { embeds: [embed], components: [row] };
}

module.exports = (client) => {
    const PREFIX = '.';

    client.on('clientReady', async () => {
        try {
            const settings = await LevelSettings.find();
            settings.forEach(s => settingsCache.set(s.guildId, { enabled: s.enabled, logChannelId: s.logChannelId }));
            console.log('✅ Leveling Module Loaded (MongoDB Synced)');
        } catch (err) {}
    });

    // ==========================================
    // 1. VOICE ACTIVITY TRACKER
    // ==========================================
    client.on('voiceStateUpdate', async (oldState, newState) => {
        if (newState.member.user.bot) return;

        const userId = newState.member.id;
        const guildId = newState.guild.id;
        const cacheKey = `${guildId}-${userId}`;

        if (!oldState.channelId && newState.channelId) {
            vcJoinTimes.set(cacheKey, Date.now());
        } else if (oldState.channelId && !newState.channelId) {
            if (vcJoinTimes.has(cacheKey)) {
                const durationMs = Date.now() - vcJoinTimes.get(cacheKey);
                const durationMinutes = Math.floor(durationMs / 60000);
                if (durationMinutes > 0) {
                    await LevelUser.findOneAndUpdate(
                        { userId, guildId }, 
                        { $inc: { vc_time: durationMinutes } }, 
                        { upsert: true }
                    ).catch(()=>{});
                }
                vcJoinTimes.delete(cacheKey);
            }
        }
    });
    // ==========================================
    // 2. MESSAGE TRACKING & XP
    // ==========================================
    client.on('messageCreate', async message => {
        if (message.author.bot || !message.guild) return;

        const userId = message.author.id;
        const guildId = message.guild.id;

        if (message.content.startsWith(PREFIX)) {
            const args = message.content.slice(PREFIX.length).trim().split(/ +/);
            const command = args.shift().toLowerCase();

            if (command === 'rank') {
                const targetUser = message.mentions.users.first() || message.author;
                let userData = await LevelUser.findOne({ userId: targetUser.id, guildId });
                if (!userData) userData = { xp: 0, level: 0, messages: 0, vc_time: 0 };
                return message.reply({ embeds: [buildRankEmbed(targetUser, userData, message.guild)] }).catch(() => {});
            }
            if (command === 'messages') {
                const targetUser = message.mentions.users.first() || message.author;
                const userData = await LevelUser.findOne({ userId: targetUser.id, guildId });
                return message.reply(`💬 **${targetUser.username}** has sent **${userData ? userData.messages : 0}** messages in this server!`).catch(() => {});
            }
            if (command === 'leaderboard' || command === 'lb') {
                const data = await buildLeaderboardData(guildId, message.guild, 'xp');
                return message.reply(data).catch(() => {});
            }
            return; 
        }

        const guildSettings = settingsCache.get(guildId) || { enabled: true, logChannelId: null };
        if (!guildSettings.enabled) return; 

        const cooldownKey = `${guildId}-${userId}`;
        const onCooldown = xpCooldowns.has(cooldownKey) && (Date.now() - xpCooldowns.get(cooldownKey) < 60000);

        if (onCooldown) {
            await LevelUser.findOneAndUpdate({ userId, guildId }, { $inc: { messages: 1 } }, { upsert: true }).catch(()=>{});
            return;
        }

        xpCooldowns.set(cooldownKey, Date.now()); 
        
        const userDoc = await LevelUser.findOneAndUpdate(
            { userId, guildId },
            { $inc: { messages: 1, xp: 15 } },
            { new: true, upsert: true }
        ).catch(()=>{});

        if (!userDoc) return;

        const newLevel = calculateLevel(userDoc.xp);
        if (newLevel > userDoc.level) {
            await LevelUser.updateOne({ userId, guildId }, { level: newLevel }).catch(()=>{});

            // 🟢 CUSTOM CHANNEL ROUTING LOGIC
            let logChannel = null;
            if (guildSettings.logChannelId) {
                logChannel = message.guild.channels.cache.get(guildSettings.logChannelId);
            }
            
            // Fallback to Smart Router if no custom channel is set or it got deleted
            if (!logChannel && typeof client.getLogChannel === 'function') {
                logChannel = client.getLogChannel(message.guild, 'misc');
            }
            
            if (logChannel) {
                const levelUpEmbed = new EmbedBuilder()
                    .setColor('#FFD700')
                    .setAuthor({ name: 'Level Up!', iconURL: message.author.displayAvatarURL({ dynamic: true }) })
                    .setDescription(`🎉 Congrats <@${userId}>! You've advanced to **Level ${newLevel}**!`)
                    .setTimestamp();

                logChannel.send({ 
                    content: `<@${userId}>`, 
                    embeds: [levelUpEmbed],
                    allowedMentions: { users: [userId] }
                }).catch(() => {});
            } else {
                message.react('⭐').catch(() => {});
            }
        }
    });

    // ==========================================
    // 3. SLASH COMMANDS & BUTTON HANDLING
    // ==========================================
    client.on('interactionCreate', async interaction => {
        if (interaction.isButton() && interaction.customId.startsWith('lb_')) {
            const type = interaction.customId.split('_')[1]; 
            const data = await buildLeaderboardData(interaction.guildId, interaction.guild, type);
            return interaction.update(data).catch(() => {});
        }

        if (!interaction.isChatInputCommand()) return;

        const currentSettings = settingsCache.get(interaction.guildId) || { enabled: true, logChannelId: null };

        if (interaction.commandName === 'setlevelchannel') {
            const channel = interaction.options.getChannel('channel', true);
            
            await LevelSettings.findOneAndUpdate(
                { guildId: interaction.guildId },
                { logChannelId: channel.id },
                { upsert: true }
            );
            
            settingsCache.set(interaction.guildId, { enabled: currentSettings.enabled, logChannelId: channel.id });
            return interaction.reply({ content: `✅ **Success:** All Level-Up notifications will now be sent to <#${channel.id}>.`, ephemeral: true }).catch(() => {});
        }

        if (interaction.commandName === 'toggleleveling') {
            const requestedState = interaction.options ? interaction.options.getString('state') : null; 
            let targetState;

            if (requestedState === 'on') targetState = true;
            else if (requestedState === 'off') targetState = false;
            else targetState = !currentSettings.enabled;

            if (targetState === currentSettings.enabled && requestedState) {
                return interaction.reply({ content: `⚠️ The leveling system is already **${targetState ? 'ENABLED' : 'DISABLED'}**!`, ephemeral: true }).catch(() => {});
            }

            await LevelSettings.findOneAndUpdate({ guildId: interaction.guildId }, { enabled: targetState }, { upsert: true });
            settingsCache.set(interaction.guildId, { enabled: targetState, logChannelId: currentSettings.logChannelId });
            
            return interaction.reply({ content: `⚙️ Leveling system has been **${targetState ? 'ENABLED ✅' : 'DISABLED ❌'}** for this server.`, ephemeral: true }).catch(() => {});
        }

        if (interaction.commandName === 'rank') {
            const targetUser = interaction.options.getUser('target') || interaction.user;
            let userData = await LevelUser.findOne({ userId: targetUser.id, guildId: interaction.guildId });
            if (!userData) userData = { xp: 0, level: 0, messages: 0, vc_time: 0 };
            await interaction.reply({ embeds: [buildRankEmbed(targetUser, userData, interaction.guild)] }).catch(() => {});
        }

        if (interaction.commandName === 'messages') {
            const targetUser = interaction.options.getUser('target') || interaction.user;
            const userData = await LevelUser.findOne({ userId: targetUser.id, guildId: interaction.guildId });
            await interaction.reply({ content: `💬 <@${targetUser.id}> has sent **${userData ? userData.messages : 0}** messages in this server!`, ephemeral: false }).catch(() => {});
        }

        if (interaction.commandName === 'leaderboard') {
            const data = await buildLeaderboardData(interaction.guildId, interaction.guild, 'xp');
            await interaction.reply(data).catch(() => {});
        }
    });
};
