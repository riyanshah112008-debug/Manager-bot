const { REST, Routes, EmbedBuilder } = require('discord.js');
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

const getUser = db.prepare('SELECT xp, level FROM users WHERE user_id = ? AND guild_id = ?');
const insertUser = db.prepare('INSERT INTO users (user_id, guild_id, xp, level) VALUES (?, ?, ?, ?)');
const updateUser = db.prepare('UPDATE users SET xp = ?, level = ? WHERE user_id = ? AND guild_id = ?');

function calculateLevel(xp) {
    return Math.floor(0.1 * Math.sqrt(xp));
}

// Function to calculate XP needed for the next level
function xpForNextLevel(currentLevel) {
    return Math.pow((currentLevel + 1) / 0.1, 2);
}

module.exports = (client) => {
    const PREFIX = '.';

    client.on('ready', async () => {
        const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
        try {
            await rest.put(
                Routes.applicationCommands(client.user.id),
                { body: [{
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
                const member = message.guild.members.cache.get(targetUser.id) || await message.guild.members.fetch(targetUser.id);
                const userData = getUser.get(targetUser.id, guildId);

                if (!userData) {
                    return message.reply(`❌ **${targetUser.username}** hasn't chatting activity recorded yet.`);
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
            return; 
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

    // Handle Slash Command
    client.on('interactionCreate', async interaction => {
        if (!interaction.isChatInputCommand()) return;

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
