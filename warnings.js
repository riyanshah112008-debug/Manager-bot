const { EmbedBuilder, PermissionsBitField } = require('discord.js');
const Database = require('better-sqlite3');
const db = new Database('warnings.db');

db.exec(`
    CREATE TABLE IF NOT EXISTS warnings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id TEXT,
        guild_id TEXT,
        reason TEXT,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
    )
`);

const insertWarn = db.prepare('INSERT INTO warnings (user_id, guild_id, reason) VALUES (?, ?, ?)');
const getWarns = db.prepare('SELECT * FROM warnings WHERE user_id = ? AND guild_id = ?');
const delWarn = db.prepare('DELETE FROM warnings WHERE id = ? AND guild_id = ?');
const clearWarns = db.prepare('DELETE FROM warnings WHERE user_id = ? AND guild_id = ?');

module.exports = (client) => {
    client.on('interactionCreate', async (interaction) => {
        if (!interaction.isChatInputCommand()) return;

        const warningCommands = new Set(['warn', 'warnings', 'delwarn']);
        if (!warningCommands.has(interaction.commandName)) return;

        // Security: Require Manage Messages permission only for warning commands.
        if (!interaction.member.permissions.has(PermissionsBitField.Flags.ManageMessages)) {
            return interaction.reply({ content: '❌ You do not have permission to use this.', ephemeral: true });
        }

        // --- WARN COMMAND ---
        if (interaction.commandName === 'warn') {
            const user = interaction.options.getUser('target');
            const reason = interaction.options.getString('reason');

            if (user.id === interaction.guild.ownerId) return interaction.reply({ content: '❌ You cannot warn the owner!', ephemeral: true });

            insertWarn.run(user.id, interaction.guildId, reason);
            const userWarns = getWarns.all(user.id, interaction.guildId);

            // 🔒 PREMIUM AUTO-KICK (3 Warnings = Kick)
            if (userWarns.length >= 3 && client.isPremium(interaction.guildId)) {
                const member = await interaction.guild.members.fetch(user.id).catch(() => null);
                if (member?.kickable) await member.kick('Reached 3 warnings').catch(() => {});
                interaction.reply(`⚠️ <@${user.id}> has reached 3 warnings and has been kicked!`);
            } else {
                interaction.reply(`⚠️ **<@${user.id}> has been warned.** (Total: ${userWarns.length})`);
            }
        }

        // --- WARNINGS COMMAND (Lists warnings) ---
        if (interaction.commandName === 'warnings') {
            const user = interaction.options.getUser('target');
            const userWarns = getWarns.all(user.id, interaction.guildId);

            if (userWarns.length === 0) return interaction.reply({ content: `✅ <@${user.id}> has 0 warnings.`, ephemeral: true });

            const embed = new EmbedBuilder()
                .setColor('Red')
                .setTitle(`⚠️ Warnings for ${user.username}`)
                .setDescription(userWarns.map((w, i) => `**${i + 1}.** ${w.reason} *(ID: ${w.id})*`).join('\n'))
                .setFooter({ text: 'Use /delwarn <ID> to remove a specific warning.' });

            await interaction.reply({ embeds: [embed] });
        }

        // --- DELWARN COMMAND ---
        if (interaction.commandName === 'delwarn') {
            const id = interaction.options.getInteger('id');
            const result = delWarn.run(id, interaction.guildId);
            interaction.reply(result.changes > 0 ? '✅ Warning removed.' : '❌ Warning not found.');
        }
    });
};
                                
