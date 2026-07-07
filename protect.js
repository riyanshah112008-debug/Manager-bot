const { EmbedBuilder, Events, AuditLogEvent } = require('discord.js');
const Database = require('better-sqlite3');

// 1. Initialize the Protection Database
const db = new Database('protect.db');

db.exec(`
    CREATE TABLE IF NOT EXISTS protected_users (
        guild_id TEXT,
        user_id TEXT,
        PRIMARY KEY (guild_id, user_id)
    )
`);

const addProtect = db.prepare('INSERT OR IGNORE INTO protected_users (guild_id, user_id) VALUES (?, ?)');
const removeProtect = db.prepare('DELETE FROM protected_users WHERE guild_id = ? AND user_id = ?');
const getProtect = db.prepare('SELECT 1 FROM protected_users WHERE guild_id = ? AND user_id = ?');

module.exports = (client) => {
    const PREFIX = '.';

    // Export this function so your other moderation files can check it before kicking/banning
    client.isUserProtected = (guildId, userId) => {
        return !!getProtect.get(guildId, userId);
    };

    // ==========================================
    // 1. PREFIX COMMANDS (.protect / .unprotect)
    // ==========================================
    client.on('messageCreate', async message => {
        if (message.author.bot || !message.guild) return;

        if (message.content.startsWith(PREFIX)) {
            const args = message.content.slice(PREFIX.length).trim().split(/ +/);
            const command = args.shift().toLowerCase();

            if (command === 'protect' || command === 'unprotect') {
                // 🛑 STRICT OWNERSHIP CHECK (Server Owner OR Bot Owner)
                if (message.author.id !== message.guild.ownerId && message.author.id !== process.env.OWNER_ID) {
                    return message.reply('❌ **Access Denied:** Only the Server Owner can use this command!').catch(() => {});
                }

                const targetUser = message.mentions.users.first();
                if (!targetUser) {
                    return message.reply(`❌ Please mention a user to ${command}.`).catch(() => {});
                }

                if (command === 'protect') {
                    addProtect.run(message.guild.id, targetUser.id);
                    return message.reply(`🛡️ **${targetUser.username}** is now heavily protected! Staff cannot ban or kick them.`).catch(() => {});
                } else {
                    removeProtect.run(message.guild.id, targetUser.id);
                    return message.reply(`🔓 **${targetUser.username}** is no longer protected.`).catch(() => {});
                }
            }
        }
    });

    // ==========================================
    // 2. SLASH COMMANDS (/protect / /unprotect)
    // ==========================================
    client.on('interactionCreate', async interaction => {
        if (!interaction.isChatInputCommand()) return;

        if (interaction.commandName === 'protect' || interaction.commandName === 'unprotect') {
            // 🛑 STRICT OWNERSHIP CHECK
            if (interaction.user.id !== interaction.guild.ownerId && interaction.user.id !== process.env.OWNER_ID) {
                return interaction.reply({ content: '❌ **Access Denied:** Only the Server Owner can use this command!', ephemeral: true }).catch(() => {});
            }

            const targetUser = interaction.options.getUser('user');

            if (interaction.commandName === 'protect') {
                addProtect.run(interaction.guildId, targetUser.id);
                return interaction.reply({ content: `🛡️ **${targetUser.username}** is now heavily protected! Staff cannot ban or kick them.` }).catch(() => {});
            } else {
                removeProtect.run(interaction.guildId, targetUser.id);
                return interaction.reply({ content: `🔓 **${targetUser.username}** is no longer protected.` }).catch(() => {});
            }
        }
    });

    // ==========================================
    // 3. THE ACTIVE ANTI-BAN / ANTI-KICK SHIELD
    // ==========================================
    client.on(Events.GuildAuditLogEntryCreate, async (auditLog, guild) => {
        const { action, executorId, targetId } = auditLog;

        // Ignore if the bot did it, or if the Server Owner/Bot Owner did it
        if (executorId === client.user.id || executorId === guild.ownerId || executorId === process.env.OWNER_ID) return;

        // Check if the target is on the protected list
        const isProtected = client.isUserProtected(guild.id, targetId);
        if (!isProtected) return;

        const logChannel = guild.systemChannel;
        const targetUser = await client.users.fetch(targetId).catch(() => null);
        const targetName = targetUser ? targetUser.tag : targetId;

        // 🔨 IF SOMEONE BANS A PROTECTED USER
        if (action === AuditLogEvent.MemberBanAdd) {
            try {
                // Instantly reverse the ban
                await guild.members.unban(targetId, "Anti-Ban System: Target is a protected user");
                
                if (logChannel) {
                    const embed = new EmbedBuilder()
                        .setColor('#ED4245')
                        .setTitle('🚨 PROTECTION ALERT: ILLEGAL BAN 🚨')
                        .setDescription(`<@${executorId}> attempted to ban **${targetName}**!`)
                        .addFields({ name: 'Action Taken', value: 'The ban was automatically reversed because this user is protected by the Server Owner.' })
                        .setTimestamp();
                    logChannel.send({ embeds: [embed] }).catch(() => null);
                }
            } catch (error) {
                console.error("Failed to reverse ban:", error);
            }
        }
        
        // 👢 IF SOMEONE KICKS A PROTECTED USER
        else if (action === AuditLogEvent.MemberKick) {
            if (logChannel) {
                const embed = new EmbedBuilder()
                    .setColor('#E67E22')
                    .setTitle('🚨 PROTECTION ALERT: ILLEGAL KICK 🚨')
                    .setDescription(`<@${executorId}> kicked **${targetName}**!`)
                    .addFields({ name: 'Notice', value: 'This user is protected by the Server Owner! (Note: Kicks cannot be automatically reversed, please invite them back).' })
                    .setTimestamp();
                logChannel.send({ embeds: [embed] }).catch(() => null);
            }
        }
    });
};
                        
