const { EmbedBuilder, PermissionsBitField } = require('discord.js');
const fs = require('fs');
const path = require('path');
const dbPath = path.join(__dirname, 'giveaways.json');

module.exports = (client) => {
    const PREFIX = '.';

    // ==========================================
    // 1. HELPER FUNCTIONS
    // ==========================================
    function getGiveaways() {
        if (!fs.existsSync(dbPath)) fs.writeFileSync(dbPath, JSON.stringify([]));
        return JSON.parse(fs.readFileSync(dbPath, 'utf-8'));
    }

    function saveGiveaways(data) {
        fs.writeFileSync(dbPath, JSON.stringify(data, null, 2));
    }

    function parseTime(timeStr) {
        const match = timeStr.match(/^(\d+)(s|m|h|d)$/);
        if (!match) return null;
        const val = parseInt(match[1]);
        const unit = match[2];
        if (unit === 's') return val * 1000;
        if (unit === 'm') return val * 60 * 1000;
        if (unit === 'h') return val * 60 * 60 * 1000;
        if (unit === 'd') return val * 24 * 60 * 60 * 1000;
        return null;
    }

    // ==========================================
    // 2. REGISTER THE SLASH COMMAND
    // ==========================================
    client.on('ready', async () => {
        try {
            await client.application.commands.create({
                name: 'giveaway',
                description: 'Start a new giveaway in the current channel (Admin Only)',
                default_member_permissions: '8',
                options: [
                    { name: 'duration', description: 'Example: 10m, 1h, 2d', type: 3, required: true },
                    { name: 'winners', description: 'Number of winners (e.g., 1)', type: 4, required: true },
                    { name: 'prize', description: 'What are you giving away?', type: 3, required: true }
                ]
            });
            console.log('✅ Giveaway Module Loaded');
        } catch (err) {}

        setInterval(checkGiveaways, 10000); 
    });

    // ==========================================
    // 3. START A GIVEAWAY
    // ==========================================
    async function startGiveaway(channel, author, durationStr, winnerCount, prize) {
        const msDuration = parseTime(durationStr);
        if (!msDuration) return '❌ Invalid time format! Please use `s`, `m`, `h`, or `d` (Example: `10m`).';
        if (winnerCount < 1) return '❌ You must have at least 1 winner!';

        const endsAt = Date.now() + msDuration;
        const endTimestamp = Math.floor(endsAt / 1000);

        const embed = new EmbedBuilder()
            .setColor('#FF0055')
            .setTitle(`🎉 GIVEAWAY: ${prize} 🎉`)
            .setDescription(`React with 🎉 to enter!\n\n**Winners:** ${winnerCount}\n**Hosted by:** <@${author.id}>\n**Ends:** <t:${endTimestamp}:R> (<t:${endTimestamp}:f>)`)
            .setTimestamp(endsAt);

        const message = await channel.send({ embeds: [embed] }).catch(() => null);
        if (!message) return '❌ Failed to send the giveaway message. Check my permissions!';

        await message.react('🎉').catch(() => {});

        const giveaways = getGiveaways();
        giveaways.push({
            messageId: message.id,
            channelId: channel.id,
            guildId: channel.guild.id,
            prize: prize,
            winners: winnerCount,
            endsAt: endsAt,
            hostId: author.id
        });
        saveGiveaways(giveaways);

        return '✅ Giveaway started successfully!';
    }

    // Slash Command Logic
    client.on('interactionCreate', async (interaction) => {
        if (!interaction.isChatInputCommand() || interaction.commandName !== 'giveaway') return;

        const duration = interaction.options.getString('duration');
        const winners = interaction.options.getInteger('winners');
        const prize = interaction.options.getString('prize');

        const response = await startGiveaway(interaction.channel, interaction.user, duration, winners, prize);
        await interaction.reply({ content: response, ephemeral: true }).catch(() => {});
    });

    // Prefix Command Logic (.giveaway)
    client.on('messageCreate', async (message) => {
        if (message.author.bot || !message.guild) return;

        if (message.content.toLowerCase().startsWith(PREFIX + 'giveaway')) {
            if (!message.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
                return message.reply('❌ You need **Administrator** permissions to use this command.').catch(() => {});
            }

            const args = message.content.slice(PREFIX.length + 8).trim().split(/ +/);
            if (args.length < 2) {
                return message.reply('🔹 **Usage:** `.giveaway <duration> [winners] <prize>`\n*Example:* `.giveaway 10m 1 VIP Role`').catch(() => {});
            }

            const duration = args[0];
            let winners = parseInt(args[1]);
            let prize;

            if (isNaN(winners)) {
                winners = 1;
                prize = args.slice(1).join(' ');
            } else {
                prize = args.slice(2).join(' ');
            }

            const response = await startGiveaway(message.channel, message.author, duration, winners, prize);
            if (response.includes('❌')) {
                return message.reply(response).catch(() => {});
            } else {
                await message.delete().catch(() => {});
            }
        }
    });

    // ==========================================
    // 4. BACKGROUND CHECKER (ENDS GIVEAWAYS)
    // ==========================================
    async function checkGiveaways() {
        let giveaways = getGiveaways();
        const now = Date.now();

        const ended = giveaways.filter(g => g.endsAt <= now);
        const active = giveaways.filter(g => g.endsAt > now);

        if (ended.length > 0) saveGiveaways(active);

        for (const giveaway of ended) {
            try {
                const guild = client.guilds.cache.get(giveaway.guildId);
                if (!guild) continue;

                const channel = guild.channels.cache.get(giveaway.channelId);
                if (!channel) continue;

                const message = await channel.messages.fetch(giveaway.messageId).catch(() => null);
                if (!message) continue;

                const reaction = message.reactions.cache.get('🎉');
                if (!reaction) continue;

                const users = await reaction.users.fetch();
                const validUsers = users.filter(u => !u.bot).map(u => u.id);

                if (validUsers.length === 0) {
                    const failEmbed = new EmbedBuilder()
                        .setColor('DarkButNotBlack')
                        .setTitle(`🎉 GIVEAWAY ENDED: ${giveaway.prize} 🎉`)
                        .setDescription(`Nobody entered the giveaway! 😢\n**Hosted by:** <@${giveaway.hostId}>`);

                    await message.edit({ embeds: [failEmbed] }).catch(() => {});
                    await channel.send(`The giveaway for **${giveaway.prize}** has ended, but nobody entered!`).catch(() => {});
                    continue;
                }

                const winners = [];
                for (let i = 0; i < giveaway.winners; i++) {
                    if (validUsers.length === 0) break;
                    const randomIndex = Math.floor(Math.random() * validUsers.length);
                    winners.push(validUsers[randomIndex]);
                    validUsers.splice(randomIndex, 1);
                }

                const winnersText = winners.map(id => `<@${id}>`).join(', ');

                const winEmbed = new EmbedBuilder()
                    .setColor('Green')
                    .setTitle(`🎉 GIVEAWAY ENDED: ${giveaway.prize} 🎉`)
                    .setDescription(`**Winners:** ${winnersText}\n**Hosted by:** <@${giveaway.hostId}>`);

                await message.edit({ embeds: [winEmbed] }).catch(() => {});
                await channel.send(`Congratulations ${winnersText}! You won the **${giveaway.prize}**! 🎉`).catch(() => {});

            } catch (error) {
                console.error('Error ending a giveaway:', error);
            }
        }
    }
};
