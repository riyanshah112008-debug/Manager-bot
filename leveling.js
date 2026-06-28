const { REST, Routes, EmbedBuilder, PermissionsBitField } = require('discord.js');
const Database = require('better-sqlite3');

// Initialize the SQLite database
const db = new Database('leveling.db');

// 1. Users table for tracking XP
db.exec(`
    CREATE TABLE IF NOT EXISTS users (
        user_id TEXT,
        guild_id TEXT,
        xp INTEGER,
        level INTEGER,
        PRIMARY KEY (user_id, guild_id)
    )
`);

// 2. Settings table for tracking if leveling is enabled per server
db.exec(`
    CREATE TABLE IF NOT EXISTS guild_settings (
        guild_id TEXT PRIMARY KEY,
        leveling_enabled INTEGER DEFAULT 1
    )
`);

const getUser = db.prepare('SELECT xp, level FROM users WHERE user_id = ? AND guild_id = ?');
const insertUser = db.prepare('INSERT INTO users (user_id, guild_id, xp, level) VALUES (?, ?, ?, ?)');
const updateUser = db.prepare('UPDATE users SET xp = ?, level = ? WHERE user_id = ? AND guild_id = ?');

const getSettings = db.prepare('SELECT leveling_enabled FROM guild_settings WHERE guild_id = ?');
// UPSERT: Inserts a new row, or updates the existing one if the guild_id already exists
const setSettings = db.prepare(`
    INSERT INTO guild_settings (guild_id, leveling_enabled) 
    VALUES (?, ?) 
    ON CONFLICT(guild_id) DO UPDATE SET leveling_enabled = ?
`);

function calculateLevel(xp) {
    return Math.floor(0.1 * Math.sqrt(xp));
}

function xpForNextLevel(currentLevel) {
    return Math.pow((currentLevel + 1) / 0.1, 2);
}

module.exports = (client) => {
    const PREFIX = '.';
    // ==========================================
    // 1. DISCORD SLASH COMMAND SYNC (MODULAR)
    // ==========================================
    client.on('clientReady', async () => {
        try {
            await client.application.commands.create({
                name: 'rank',
                description: 'Check your current server rank, level, and XP',
                options: [
                    {
                        name: 'target',
                        description: 'The user whose rank you want to view',
                        type: 6, 
                        required: false
                    }
                ]
            });

            await client.application.commands.create({
                name: 'toggleleveling',
                description: 'Enable or disable the leveling system for this server',
                default_member_permissions: '8' 
            });

            console.log('✅ Leveling Slash Commands Added');
        } catch (error) {
            console.error('❌ Failed to add leveling slash commands:', error);
        }
    });


    client.on('messageCreate', async message => {
        if (message.author.bot || !message.guild) return;

        const userId = message.author.id;
        const guildId = message.guild.id;

        // --- PREFIX COMMAND LOGIC ---
        if (message.content.startsWith(PREFIX)) {
            const args = message.content.slice(PREFIX.length).trim().split(/ +/);
            const command = args.shift().toLowerCase();

            // TOGGLE COMMAND
            if (command === 'toggleleveling') {
                if (!message.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
                    return message.reply('❌ You need **Administrator** permissions to use this command.');
                }

                const currentSetting = getSettings.get(guildId);
                const isEnabled = currentSetting ? currentSetting.leveling_enabled : 1; // Default is 1 (enabled)
                const newSetting = isEnabled ? 0 : 1; // Flip the bit

                setSettings.run(guildId, newSetting, newSetting);

                return message.reply(`⚙️ Leveling system has been **${newSetting ? 'ENABLED ✅' : 'DISABLED ❌'}** for this server.`);
            }

            // RANK COMMAND
            if (command === 'rank') {
                const targetUser = message.mentions.users.first() || message.author;
                const userData = getUser.get(targetUser.id, guildId);

                if (!userData) {
                    return message.reply(`❌ **${targetUser.username}** has no chatting activity recorded yet.`);
                }

                const nextLevelXp = xpForNextLevel(userData.level);
                const progressPercent = Math.min(Math.round((userData.xp / nextLevelXp) * 10), 10);
                const progressBar = '🟩'.repeat(progressPercent) + '⬛'.repeat(10 - progressPercent);

                const rankEmbed = new EmbedBuilder()
                    .setColor('#7289DA')
                    .setAuthor({ name: `${targetUser.username}'s Progression`, iconURL: targetUser.displayAvatarURL({ dynamic: true }) })
                    .setThumbnail(targetUser.displayAvatarURL({ dynamic: true, size: 256 }))
                    .addFields(
                        { name: '✨ Level', value: `\`\`\`ansi\n\u001b[1;36mLevel ${userData.level}\u001b[0m\n\`\`\``, inline: true },
                        { name: '📊 Total XP', value: `\`\`\`ansi\n\u001b[1;33m${userData.xp} XP\u001b[0m\n\`\`\``, inline: true },
                        { name: `📈 Progress to Level ${userData.level + 1}`, value: `${progressBar} (${Math.round((userData.xp / nextLevelXp) * 100)}%)` }
                    )
                    .setFooter({ text: message.guild.name, iconURL: message.guild.iconURL() })
                    .setTimestamp();

                return message.reply({ embeds: [rankEmbed] });
            }
            return; // Stop processing further so command usage doesn't grant XP
        }

        // --- XP GENERATION GUARD ---
        // Check if leveling is disabled before granting XP
        const currentSetting = getSettings.get(guildId);
        if (currentSetting && currentSetting.leveling_enabled === 0) {
            return; // Exit silently if disabled
        }

        // --- XP & LEVELING LOGIC ---
        const xpToAdd = 15;
        let userData = getUser.get(userId, guildId);

        if (!userData) {
            const newLevel = calculateLevel(xpToAdd);
            insertUser.run(userId, guildId, xpToAdd, newLevel);
        } else {
            const newXp = userData.xp + xpToAdd;
            const currentLevel = userData.level;
            const newLevel = calculateLevel(newXp);

            updateUser.run(newXp, newLevel, userId, guildId);

            if (newLevel > currentLevel) {
                const levelUpEmbed = new EmbedBuilder()
                    .setColor('#FFD700')
                    .setAuthor({ name: 'Level Up!', iconURL: message.author.displayAvatarURL({ dynamic: true }) })
                    .setDescription(`🎉 Congrats <@${userId}>! You've advanced to **Level ${newLevel}**!`)
                    .setTimestamp();

                message.channel.send({ content: `<@${userId}>`, embeds: [levelUpEmbed] });
            }
        }
    });

    // --- SLASH COMMAND LOGIC ---
    client.on('interactionCreate', async interaction => {
        if (!interaction.isChatInputCommand()) return;

        if (interaction.commandName === 'toggleleveling') {
            const currentSetting = getSettings.get(interaction.guildId);
            const isEnabled = currentSetting ? currentSetting.leveling_enabled : 1;
            const newSetting = isEnabled ? 0 : 1;

            setSettings.run(interaction.guildId, newSetting, newSetting);

            return interaction.reply({ content: `⚙️ Leveling system has been **${newSetting ? 'ENABLED ✅' : 'DISABLED ❌'}** for this server.`, ephemeral: true });
        }

        if (interaction.commandName === 'rank') {
            const targetUser = interaction.options.getUser('target') || interaction.user;
            const userData = getUser.get(targetUser.id, interaction.guildId);

            if (!userData) {
                return interaction.reply({ content: `❌ **${targetUser.username}** hasn't earned any XP yet.`, ephemeral: true });
            }

            const nextLevelXp = xpForNextLevel(userData.level);
            const progressPercent = Math.min(Math.round((userData.xp / nextLevelXp) * 10), 10);
            const progressBar = '🟩'.repeat(progressPercent) + '⬛'.repeat(10 - progressPercent);

            const rankEmbed = new EmbedBuilder()
                .setColor('#7289DA')
                .setAuthor({ name: `${targetUser.username}'s Progression`, iconURL: targetUser.displayAvatarURL({ dynamic: true }) })
                .setThumbnail(targetUser.displayAvatarURL({ dynamic: true, size: 256 }))
                .addFields(
                    { name: '✨ Level', value: `\`\`\`ansi\n\u001b[1;36mLevel ${userData.level}\u001b[0m\n\`\`\``, inline: true },
                    { name: '📊 Total XP', value: `\`\`\`ansi\n\u001b[1;33m${userData.xp} XP\u001b[0m\n\`\`\``, inline: true },
                    { name: `📈 Progress to Level ${userData.level + 1}`, value: `${progressBar} (${Math.round((userData.xp / nextLevelXp) * 100)}%)` }
                )
                .setFooter({ text: interaction.guild.name, iconURL: interaction.guild.iconURL() })
                .setTimestamp();

            await interaction.reply({ embeds: [rankEmbed] });
        }
    });
};
        
