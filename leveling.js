const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionsBitField } = require('discord.js');
const Database = require('better-sqlite3');

const db = new Database('leveling.db');

// 1. DATABASE SETUP & AUTO-MIGRATION
db.exec(`
    CREATE TABLE IF NOT EXISTS users (
        user_id TEXT,
        guild_id TEXT,
        xp INTEGER DEFAULT 0,
        level INTEGER DEFAULT 0,
        PRIMARY KEY (user_id, guild_id)
    )
`);

db.exec(`
    CREATE TABLE IF NOT EXISTS guild_settings (
        guild_id TEXT PRIMARY KEY,
        leveling_enabled INTEGER DEFAULT 1
    )
`);

// Gracefully add new columns to existing databases without breaking old data
try { db.exec('ALTER TABLE users ADD COLUMN messages INTEGER DEFAULT 0'); } catch (e) {}
try { db.exec('ALTER TABLE users ADD COLUMN vc_time INTEGER DEFAULT 0'); } catch (e) {} // stored in minutes

// Database Queries
const getUser = db.prepare('SELECT * FROM users WHERE user_id = ? AND guild_id = ?');
const insertUser = db.prepare('INSERT INTO users (user_id, guild_id, xp, level, messages, vc_time) VALUES (?, ?, ?, ?, ?, ?)');
const updateUserXP = db.prepare('UPDATE users SET xp = ?, level = ? WHERE user_id = ? AND guild_id = ?');
const addMessage = db.prepare('UPDATE users SET messages = messages + 1 WHERE user_id = ? AND guild_id = ?');
const addVcTime = db.prepare('UPDATE users SET vc_time = vc_time + ? WHERE user_id = ? AND guild_id = ?');

const getTopXP = db.prepare('SELECT user_id, xp, level FROM users WHERE guild_id = ? ORDER BY xp DESC LIMIT 10');
const getTopMessages = db.prepare('SELECT user_id, messages FROM users WHERE guild_id = ? ORDER BY messages DESC LIMIT 10');
const getTopVC = db.prepare('SELECT user_id, vc_time FROM users WHERE guild_id = ? ORDER BY vc_time DESC LIMIT 10');

const getSettings = db.prepare('SELECT leveling_enabled FROM guild_settings WHERE guild_id = ?');
const setSettings = db.prepare(`
    INSERT INTO guild_settings (guild_id, leveling_enabled) 
    VALUES (?, ?) 
    ON CONFLICT(guild_id) DO UPDATE SET leveling_enabled = ?
`);

// In-Memory Caches
const xpCooldowns = new Map(); // Prevents XP spam (1 min cooldown)
const vcJoinTimes = new Map(); // Tracks when users join VC

// Helper Functions
function calculateLevel(xp) { return Math.floor(0.1 * Math.sqrt(xp)); }
function xpForNextLevel(currentLevel) { return Math.pow((currentLevel + 1) / 0.1, 2); }
function formatVcTime(minutes) {
    if (!minutes) return '0m';
    const hrs = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return hrs > 0 ? `${hrs}h ${mins}m` : `${mins}m`;
}

// Ensure user exists in DB before updating stats
function ensureUserExists(userId, guildId) {
    let data = getUser.get(userId, guildId);
    if (!data) {
        insertUser.run(userId, guildId, 0, 0, 0, 0);
        data = { user_id: userId, guild_id: guildId, xp: 0, level: 0, messages: 0, vc_time: 0 };
    }
    return data;
}

// Reusable function to build the rank embed
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
            { name: '\u200b', value: '\u200b', inline: true }, // Empty field for alignment
            { name: '💬 Messages Sent', value: `\`${userData.messages || 0}\``, inline: true },
            { name: '🎙️ Time in Voice', value: `\`${formatVcTime(userData.vc_time)}\``, inline: true },
            { name: '\u200b', value: '\u200b', inline: true }, 
            { name: `📈 Progress to Level ${userData.level + 1}`, value: `${progressBar} (${Math.round((userData.xp / nextLevelXp) * 100)}%)` }
        )
        .setFooter({ text: guild.name, iconURL: guild.iconURL() })
        .setTimestamp();
}

// Reusable function to build Interactive Leaderboards
function buildLeaderboardData(guildId, guild, type = 'xp') {
    let topUsers = [];
    let title = '';
    let emoji = '';
    let color = '';

    if (type === 'xp') {
        topUsers = getTopXP.all(guildId);
        title = 'Top XP Earners'; emoji = '✨'; color = '#FFD700';
    } else if (type === 'messages') {
        topUsers = getTopMessages.all(guildId);
        title = 'Most Active Chatters'; emoji = '💬'; color = '#00BFFF';
    } else if (type === 'vc') {
        topUsers = getTopVC.all(guildId);
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

            if (type === 'xp') description += `**${index + 1}.** ${medal} <@${user.user_id}>\n↳ **Level ${user.level}** • \`${user.xp} XP\`\n\n`;
            if (type === 'messages') description += `**${index + 1}.** ${medal} <@${user.user_id}>\n↳ \`${user.messages} Messages\`\n\n`;
            if (type === 'vc') description += `**${index + 1}.** ${medal} <@${user.user_id}>\n↳ \`${formatVcTime(user.vc_time)}\` in Voice\n\n`;
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

    // ==========================================
    // 1. VOICE ACTIVITY TRACKER
    // ==========================================
    client.on('voiceStateUpdate', (oldState, newState) => {
        if (newState.member.user.bot) return;

        const userId = newState.member.id;
        const guildId = newState.guild.id;
        const cacheKey = `${guildId}-${userId}`;

        // User joined a voice channel
        if (!oldState.channelId && newState.channelId) {
            vcJoinTimes.set(cacheKey, Date.now());
        }
        
        // User left a voice channel
        else if (oldState.channelId && !newState.channelId) {
            if (vcJoinTimes.has(cacheKey)) {
                const joinTime = vcJoinTimes.get(cacheKey);
                const durationMs = Date.now() - joinTime;
                const durationMinutes = Math.floor(durationMs / 60000);

                if (durationMinutes > 0) {
                    ensureUserExists(userId, guildId);
                    addVcTime.run(durationMinutes, userId, guildId);
                }
                vcJoinTimes.delete(cacheKey);
            }
        }
    });

    // ==========================================
    // 2. MESSAGE TRACKING & PREFIX COMMANDS
    // ==========================================
    client.on('messageCreate', async message => {
        if (message.author.bot || !message.guild) return;

        const userId = message.author.id;
        const guildId = message.guild.id;

        // --- COMMAND HANDLING ---
        if (message.content.startsWith(PREFIX)) {
            const args = message.content.slice(PREFIX.length).trim().split(/ +/);
            const command = args.shift().toLowerCase();

            if (command === 'rank') {
                const targetUser = message.mentions.users.first() || message.author;
                const userData = ensureUserExists(targetUser.id, guildId);
                return message.reply({ embeds: [buildRankEmbed(targetUser, userData, message.guild)] }).catch(() => {});
            }

            if (command === 'messages') {
                const targetUser = message.mentions.users.first() || message.author;
                const userData = ensureUserExists(targetUser.id, guildId);
                return message.reply(`💬 **${targetUser.username}** has sent **${userData.messages || 0}** messages in this server!`).catch(() => {});
            }

            if (command === 'leaderboard' || command === 'lb') {
                const data = buildLeaderboardData(guildId, message.guild, 'xp');
                return message.reply(data).catch(() => {});
            }
            return; 
        }

        // --- STATS & XP GENERATION SYSTEM ---
        const currentSetting = getSettings.get(guildId);
        if (currentSetting && currentSetting.leveling_enabled === 0) return; 

        // Always log the message count
        ensureUserExists(userId, guildId);
        addMessage.run(userId, guildId);

        // Cooldown Check for XP (1 minute)
        const cooldownKey = `${guildId}-${userId}`;
        if (xpCooldowns.has(cooldownKey)) {
            const lastMessageTime = xpCooldowns.get(cooldownKey);
            if (Date.now() - lastMessageTime < 60000) return; 
        }
        
        xpCooldowns.set(cooldownKey, Date.now()); 
        
        // Add XP
        const xpToAdd = 15;
        let userData = getUser.get(userId, guildId);
        const newXp = userData.xp + xpToAdd;
        const currentLevel = userData.level;
        const newLevel = calculateLevel(newXp);

        updateUserXP.run(newXp, newLevel, userId, guildId);

        if (newLevel > currentLevel) {
            const levelUpEmbed = new EmbedBuilder()
                .setColor('#FFD700')
                .setAuthor({ name: 'Level Up!', iconURL: message.author.displayAvatarURL({ dynamic: true }) })
                .setDescription(`🎉 Congrats <@${userId}>! You've advanced to **Level ${newLevel}**!`)
                .setTimestamp();

            message.channel.send({ 
                content: `🎉 Congrats <@${userId}>, you just advanced to **Level ${newLevel}**!`, 
                embeds: [levelUpEmbed] 
            }).catch(() => {});
        }
    });

    // ==========================================
    // 3. SLASH COMMANDS & BUTTON HANDLING
    // ==========================================
    client.on('interactionCreate', async interaction => {
        // --- BUTTON HANDLING FOR LEADERBOARD ---
        if (interaction.isButton() && interaction.customId.startsWith('lb_')) {
            const type = interaction.customId.split('_')[1]; // 'xp', 'messages', or 'vc'
            const data = buildLeaderboardData(interaction.guildId, interaction.guild, type);
            return interaction.update(data).catch(() => {});
        }

        // --- SLASH COMMANDS ---
        if (!interaction.isChatInputCommand()) return;

        if (interaction.commandName === 'toggleleveling') {
            // Logic unchanged
            const currentSetting = getSettings.get(interaction.guildId);
            const isEnabled = currentSetting ? currentSetting.leveling_enabled : 1;
            const requestedState = interaction.options ? interaction.options.getString('state') : null; 
            let newSetting;

            if (requestedState === 'on') newSetting = 1;
            else if (requestedState === 'off') newSetting = 0;
            else newSetting = isEnabled ? 0 : 1;

            if (newSetting === isEnabled && requestedState) {
                return interaction.reply({ content: `⚠️ The leveling system is already **${newSetting ? 'ENABLED' : 'DISABLED'}**!`, ephemeral: true }).catch(() => {});
            }

            setSettings.run(interaction.guildId, newSetting, newSetting);
            return interaction.reply({ content: `⚙️ Leveling system has been **${newSetting ? 'ENABLED ✅' : 'DISABLED ❌'}** for this server.`, ephemeral: true }).catch(() => {});
        }

        if (interaction.commandName === 'rank') {
            const targetUser = interaction.options.getUser('target') || interaction.user;
            const userData = ensureUserExists(targetUser.id, interaction.guildId);
            await interaction.reply({ embeds: [buildRankEmbed(targetUser, userData, interaction.guild)] }).catch(() => {});
        }

        if (interaction.commandName === 'messages') {
            const targetUser = interaction.options.getUser('target') || interaction.user;
            const userData = ensureUserExists(targetUser.id, interaction.guildId);
            await interaction.reply({ content: `💬 <@${targetUser.id}> has sent **${userData.messages || 0}** messages in this server!`, ephemeral: false }).catch(() => {});
        }

        if (interaction.commandName === 'leaderboard') {
            const data = buildLeaderboardData(interaction.guildId, interaction.guild, 'xp');
            await interaction.reply(data).catch(() => {});
        }
    });
};
                                                
