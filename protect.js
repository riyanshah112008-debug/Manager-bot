const { Events, AuditLogEvent } = require('discord.js');
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
    // 2. REGISTER SLASH COMMANDS
    // ==========================================
    client.on('clientReady', async () => {
        try {
            await client.application.commands.create({
                name: 'protect',
                description: 'Protect a user from being kicked or banned by staff (Owner Only)',
                default_member_permissions: '0', 
                options: [
                    { name: 'user', description: 'The user to protect', type: 6, required: true }
                ]
            });
            await client.application.commands.create({
                name: 'unprotect',
                description: 'Remove protection from a user (Owner Only)',
                default_member_permissions: '0',
                options: [
                    { name: 'user', description: 'The user to unprotect', type: 6, required: true }
                ]
            });
            console.log('✅ Protection Slash Commands Added');
        } catch (error) {
            console.error('❌ Failed to add protect slash commands:', error);
        }
    });

    // ==========================================
    // 3. PREFIX COMMANDS (.protect / .unprotect)
    // ==========================================
    client.on('messageCreate', async message => {
        if (message.author.bot || !message.guild) return;

        if (message.content.startsWith(PREFIX)) {
            const args = message.content.slice(PREFIX.length).trim().split(/ +/);
            const command = args.shift().toLowerCase();

            if (command === 'protect' || command === 'unprotect') {
                // 🛑 STRICT OWNERSHIP CHECK
                if (message.author.id !== message.guild.ownerId) {
                    return message.reply('❌ **Access Denied:** Only the Server Owner can use this command!').catch(() => {});
                }

                const targetUser = message.mentions.users.first();
                if (!targetUser) {
                    return message.reply(`❌ Please mention a user to ${command}.`).catch(() => {});
                }

                if (command === 'protect') {
                    addProtect.run(message.guild.id, targetUser.id);
                    return message.reply(`🛡️ **${targetUser.username}** is now heavily protected! Staff cannot ban them.`).catch(() => {});
                } else {
                    removeProtect.run(message.guild.id, targetUser.id);
                    return message.reply(`🔓 **${targetUser.username}** is no longer protected.`).catch(() => {});
                }
            }
        }
    });

    // ==========================================
    // 4. SLASH COMMANDS (/protect / /unprotect)
    // ==========================================
    client.on('interactionCreate', async interaction => {
        if (!interaction.isChatInputCommand()) return;

        if (interaction.commandName === 'protect' || interaction.commandName === 'unprotect') {
            // 🛑 STRICT OWNERSHIP CHECK
            if (interaction.user.id !== interaction.guild.ownerId) {
                return interaction.reply({ content: '❌ **Access Denied:** Only the Server Owner can use this command!', ephemeral: true }).catch(() => {});
            }

            const targetUser = interaction.options.getUser('user');

            if (interaction.commandName === 'protect') {
                addProtect.run(interaction.guildId, targetUser.id);
                return interaction.reply({ content: `🛡️ **${targetUser.username}** is now heavily protected! Staff cannot ban them.` }).catch(() => {});
            } else {
                removeProtect.run(interaction.guildId, targetUser.id);
                return interaction.reply({ content: `🔓 **${targetUser.username}** is no longer protected.` }).catch(() => {});
            }
        }
    });

    // ==========================================
    // 5. THE ACTIVE ANTI-BAN SHIELD
    // ==========================================
    client.on(Events.GuildAuditLogEntryCreate, async (auditLog, guild) => {
        // If a ban is executed, intercept it
        if (auditLog.action === AuditLogEvent.MemberBanAdd) {
            const targetId = auditLog.targetId;
            const executorId = auditLog.executorId;

            // Ignore if the bot did it, or if the Owner did it
            if (executorId === client.user.id || executorId === guild.ownerId) return;

            // Check if the target is on the protected list
            const isProtected = client.isUserProtected(guild.id, targetId);
            
            if (isProtected) {
                try {
                    // Instantly reverse the ban
                    await guild.members.unban(targetId, "Anti-Ban System: Target is a protected user");
                    
                    // Fetch details to alert the server
                    const targetUser = await client.users.fetch(targetId).catch(() => null);
                    const logChannel = guild.systemChannel; 
                    
                    if (logChannel) {
                        logChannel.send(`🚨 **PROTECTION ALERT** 🚨\n<@${executorId}> attempted to ban **${targetUser ? targetUser.tag : targetId}**, but they are protected by the Owner!\n*The ban has been automatically reversed.*`);
                    }
                } catch (error) {
                    console.error("Failed to reverse ban:", error);
                }
            }
        }
    });
};
