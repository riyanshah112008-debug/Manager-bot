const { EmbedBuilder } = require('discord.js');
const Database = require('better-sqlite3');

// 1. Initialize the SQLite Database
const db = new Database('reputation.db');

db.exec(`
    CREATE TABLE IF NOT EXISTS rep (
        guild_id TEXT,
        user_id TEXT,
        rep INTEGER DEFAULT 0,
        last_given INTEGER DEFAULT 0,
        PRIMARY KEY (guild_id, user_id)
    )
`);

const getUser = db.prepare('SELECT rep, last_given FROM rep WHERE guild_id = ? AND user_id = ?');
const insertUser = db.prepare('INSERT INTO rep (guild_id, user_id, rep, last_given) VALUES (?, ?, ?, ?)');
const updateRep = db.prepare('UPDATE rep SET rep = rep + 1 WHERE guild_id = ? AND user_id = ?');
const updateCooldown = db.prepare('UPDATE rep SET last_given = ? WHERE guild_id = ? AND user_id = ?');

function ensureUser(guildId, userId) {
    let user = getUser.get(guildId, userId);
    if (!user) {
        insertUser.run(guildId, userId, 0, 0);
        user = { rep: 0, last_given: 0 };
    }
    return user;
}

module.exports = (client) => {
    // ==========================================
    // SLASH COMMAND HANDLERS
    // ==========================================
    client.on('interactionCreate', async (interaction) => {
        if (!interaction.isChatInputCommand()) return;

        // --- COMMAND: /rep ---
        if (interaction.commandName === 'rep') {
            const target = interaction.options.getUser('user');
            
            if (target.id === interaction.user.id) {
                return interaction.reply({ content: '❌ You cannot give reputation to yourself!', ephemeral: true }).catch(() => {});
            }
            if (target.bot) {
                return interaction.reply({ content: '❌ You cannot give reputation to bots!', ephemeral: true }).catch(() => {});
            }

            const guildId = interaction.guild.id;
            const giverId = interaction.user.id;
            const targetId = target.id;
            const now = Date.now();
            const cooldown = 24 * 60 * 60 * 1000; // 24 hours in milliseconds

            // Ensure both users exist in the database
            const giverData = ensureUser(guildId, giverId);
            ensureUser(guildId, targetId);

            // Check Cooldown
            if (now - giverData.last_given < cooldown) {
                const timeLeft = Math.floor((giverData.last_given + cooldown) / 1000);
                return interaction.reply({ content: `⏳ You have already given rep today! You can give rep again <t:${timeLeft}:R>.`, ephemeral: true }).catch(() => {});
            }

            // Execute the Transaction
            updateRep.run(guildId, targetId);
            updateCooldown.run(now, guildId, giverId);

            // Fetch the updated rep count for the target
            const updatedTargetData = getUser.get(guildId, targetId);

            const embed = new EmbedBuilder()
                .setColor('#FFD700') // Gold
                .setDescription(`🌟 <@${giverId}> gave **+1 Reputation** to <@${targetId}>!\nThey now have **${updatedTargetData.rep}** Rep.`)
                .setTimestamp();
            
            await interaction.reply({ embeds: [embed] }).catch(() => {});
        }

        // --- COMMAND: /checkrep ---
        if (interaction.commandName === 'checkrep') {
            const target = interaction.options.getUser('user') || interaction.user;
            const guildId = interaction.guild.id;

            const userData = ensureUser(guildId, target.id);

            const embed = new EmbedBuilder()
                .setColor('#2b2d31')
                .setAuthor({ name: `${target.username}'s Reputation`, iconURL: target.displayAvatarURL({ dynamic: true }) })
                .setDescription(`🌟 **Reputation Points:** \`${userData.rep}\``)
                .setTimestamp();
            
            await interaction.reply({ embeds: [embed] }).catch(() => {});
        }
    });
};
                                          
