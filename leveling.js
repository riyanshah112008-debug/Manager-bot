const { REST, Routes } = require('discord.js');
const Database = require('better-sqlite3');

// Initialize the SQLite database
const db = new Database('leveling.db');
db.exec(`
    CREATE TABLE IF NOT EXISTS users (
        user_id TEXT,
        guild_id TEXT,
        xp INTEGER,
        level INTEGER,
        PRIMARY KEY (user_id, guild_id)
    )
`);

// Prepared statements for faster database queries
const getUser = db.prepare('SELECT xp, level FROM users WHERE user_id = ? AND guild_id = ?');
const insertUser = db.prepare('INSERT INTO users (user_id, guild_id, xp, level) VALUES (?, ?, ?, ?)');
const updateUser = db.prepare('UPDATE users SET xp = ?, level = ? WHERE user_id = ? AND guild_id = ?');

function calculateLevel(xp) {
    return Math.floor(0.1 * Math.sqrt(xp));
}

module.exports = (client) => {
    const PREFIX = '.';

    // Sync slash commands when the bot is ready
    client.on('ready', async () => {
        const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
        try {
            await rest.put(
                Routes.applicationCommands(client.user.id),
                { body: [{
                    name: 'rank',
                    description: 'Check your XP and Level',
                    options: [
                        {
                            name: 'target',
                            description: 'The user to check',
                            type: 6, // USER type in Discord API
                            required: false
                        }
                    ]
                }] },
            );
        } catch (error) {
            console.error('❌ Failed to sync leveling slash commands:', error);
        }
    });

    // Handle messages for XP and Prefix Command
    client.on('messageCreate', async message => {
        if (message.author.bot || !message.guild) return;

        const userId = message.author.id;
        const guildId = message.guild.id;

        // --- TRIGGER COMMAND LOGIC ---
        if (message.content.startsWith(PREFIX)) {
            const args = message.content.slice(PREFIX.length).trim().split(/ +/);
            const command = args.shift().toLowerCase();

            if (command === 'rank') {
                const targetUser = message.mentions.users.first() || message.author;
                const userData = getUser.get(targetUser.id, guildId);

                if (!userData) {
                    return message.reply(`**${targetUser.username}** hasn't earned any XP yet.`);
                }
                return message.reply(`📊 **${targetUser.username}** | Level: **${userData.level}** | XP: **${userData.xp}**`);
            }
            return; // Exit so using a command doesn't grant XP
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
                message.channel.send(`🎉 Congratulations <@${userId}>! You've leveled up to **Level ${newLevel}**!`);
            }
        }
    });

    // Handle Slash Command
    client.on('interactionCreate', async interaction => {
        if (!interaction.isChatInputCommand()) return;

        if (interaction.commandName === 'rank') {
            const targetUser = interaction.options.getUser('target') || interaction.user;
            const userData = getUser.get(targetUser.id, interaction.guildId);

            if (!userData) {
                return interaction.reply({ content: `**${targetUser.username}** hasn't earned any XP yet.`, ephemeral: true });
            }

            await interaction.reply(`📊 **${targetUser.username}** | Level: **${userData.level}** | XP: **${userData.xp}**`);
        }
    });
};
  
