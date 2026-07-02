const { EmbedBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');
const dbPath = path.join(__dirname, 'repData.json');

module.exports = (client) => {
    function getRepData() {
        if (!fs.existsSync(dbPath)) fs.writeFileSync(dbPath, JSON.stringify({}));
        return JSON.parse(fs.readFileSync(dbPath, 'utf-8'));
    }

    function saveRepData(data) {
        fs.writeFileSync(dbPath, JSON.stringify(data, null, 2));
    }

    client.on('ready', async () => {
        try {
            await client.application.commands.create({
                name: 'rep',
                description: 'Give a reputation point to another user (Once per day)',
                options: [{ name: 'user', description: 'The user to give rep to', type: 6, required: true }]
            });
            await client.application.commands.create({
                name: 'checkrep',
                description: 'Check your or another user\'s reputation',
                options: [{ name: 'user', description: 'The user to check', type: 6, required: false }]
            });
            console.log('✅ Reputation System Loaded');
        } catch (err) {}
    });

    client.on('interactionCreate', async (interaction) => {
        if (!interaction.isChatInputCommand()) return;

        if (interaction.commandName === 'rep') {
            const target = interaction.options.getUser('user');
            if (target.id === interaction.user.id) return interaction.reply({ content: '❌ You cannot give reputation to yourself!', ephemeral: true });
            if (target.bot) return interaction.reply({ content: '❌ You cannot give reputation to bots!', ephemeral: true });

            const data = getRepData();
            const guildId = interaction.guild.id;
            const userId = interaction.user.id;
            const targetId = target.id;
            const now = Date.now();
            const cooldown = 24 * 60 * 60 * 1000; // 24 hours

            if (!data[guildId]) data[guildId] = {};
            if (!data[guildId][userId]) data[guildId][userId] = { lastGiven: 0 };
            if (!data[guildId][targetId]) data[guildId][targetId] = { rep: 0 };

            const lastGiven = data[guildId][userId].lastGiven || 0;
            if (now - lastGiven < cooldown) {
                const timeLeft = Math.floor((lastGiven + cooldown) / 1000);
                return interaction.reply({ content: `⏳ You have already given rep recently! You can give rep again <t:${timeLeft}:R>.`, ephemeral: true });
            }

            // Grant the rep
            data[guildId][targetId].rep = (data[guildId][targetId].rep || 0) + 1;
            data[guildId][userId].lastGiven = now;
            saveRepData(data);

            const embed = new EmbedBuilder()
                .setColor('Gold')
                .setDescription(`🌟 <@${interaction.user.id}> gave **+1 Reputation** to <@${targetId}>!\nThey now have **${data[guildId][targetId].rep}** Rep.`);
            
            await interaction.reply({ embeds: [embed] });
        }

        if (interaction.commandName === 'checkrep') {
            const target = interaction.options.getUser('user') || interaction.user;
            const data = getRepData();
            const repCount = data[interaction.guild.id]?.[target.id]?.rep || 0;

            const embed = new EmbedBuilder()
                .setColor('Blurple')
                .setAuthor({ name: target.tag, iconURL: target.displayAvatarURL() })
                .setDescription(`🌟 **Reputation Points:** ${repCount}`);
            
            await interaction.reply({ embeds: [embed] });
        }
    });
};
