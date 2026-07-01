const { EmbedBuilder } = require('discord.js');
const Database = require('better-sqlite3');
const db = new Database('warnings.db');

// Create the warnings table if it doesn't exist yet
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

module.exports = (client) => {
    client.on('clientReady', async () => {
        try {
            await client.application.commands.create({
                name: 'warn',
                description: 'Warn a user (Admin Only)',
                default_member_permissions: '8',
                options: [
                    { name: 'target', description: 'The user to warn', type: 6, required: true },
                    { name: 'reason', description: 'Reason for the warning', type: 3, required: true }
                ]
            });

            await client.application.commands.create({
                name: 'warnings',
                description: 'Check a users warnings',
                options: [
                    { name: 'target', description: 'The user to check', type: 6, required: true }
                ]
            });
            console.log('✅ Warning Slash Commands Added');
        } catch (err) {}
    });

    client.on('interactionCreate', async (interaction) => {
        if (!interaction.isChatInputCommand()) return;

        if (interaction.commandName === 'warn') {
            const user = interaction.options.getUser('target');
            const reason = interaction.options.getString('reason');

            insertWarn.run(user.id, interaction.guildId, reason);

            const embed = new EmbedBuilder()
                .setColor('Orange')
                .setTitle('⚠️ User Warned')
                .setDescription(`<@${user.id}> has been officially warned.\n**Reason:** ${reason}`);

            await interaction.reply({ embeds: [embed] }).catch(() => {});
        }

        if (interaction.commandName === 'warnings') {
            const user = interaction.options.getUser('target');
            const userWarns = getWarns.all(user.id, interaction.guildId);

            if (userWarns.length === 0) {
                return interaction.reply({ content: `✅ <@${user.id}> has 0 warnings on record.`, ephemeral: true }).catch(() => {});
            }

            const embed = new EmbedBuilder()
                .setColor('Red')
                .setTitle(`⚠️ Warnings for ${user.username}`)
                .setDescription(userWarns.map((w, i) => `**${i + 1}.** ${w.reason} *(ID: ${w.id})*`).join('\n'));

            await interaction.reply({ embeds: [embed] }).catch(() => {});
        }
    });
};
