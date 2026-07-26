const { EmbedBuilder, PermissionsBitField } = require('discord.js');
const fs = require('fs');
const path = require('path');
const dbPath = path.join(__dirname, 'giveaways.json');

module.exports = (client) => {
    const PREFIX = '.';

    // ==========================================
    // 📁 JSON DATABASE HELPERS
    // ==========================================
    function getGiveaways() {
        try {
            if (!fs.existsSync(dbPath)) fs.writeFileSync(dbPath, JSON.stringify([], null, 2));
            return JSON.parse(fs.readFileSync(dbPath, 'utf-8'));
        } catch {
            return [];
        }
    }

    function saveGiveaways(data) {
        fs.writeFileSync(dbPath, JSON.stringify(data, null, 2));
    }

    function parseTime(timeStr) {
        const match = timeStr.match(/^(\d+)(s|m|h|d|w)$/i);
        if (!match) return null;
        const val = parseInt(match[1]);
        const unit = match[2].toLowerCase();
        if (unit === 's') return val * 1000;
        if (unit === 'm') return val * 60 * 1000;
        if (unit === 'h') return val * 60 * 60 * 1000;
        if (unit === 'd') return val * 24 * 60 * 60 * 1000;
        if (unit === 'w') return val * 7 * 24 * 60 * 60 * 1000;
        return null;
    }

    // ==========================================
    // ⏰ BACKGROUND CHECKER (Every 8 Seconds)
    // ==========================================
    client.once('ready', () => {
        setInterval(checkGiveaways, 8000);
        console.log('✅ Supreme Aesthetic Giveaway Engine Active');
    });

    // ==========================================
    // 🎨 ACTIVE GIVEAWAY EMBED (BEFORE)
    // ==========================================
    async function startGiveaway(channel, author, durationStr, winnerCount = 1, prize) {
        const msDuration = parseTime(durationStr);
        if (!msDuration) return '❌ **Invalid time format!** Use `s`, `m`, `h`, `d`, or `w` *(Example: `10m`, `2h`)*.';
        if (winnerCount < 1) return '❌ **Invalid winners!** Must have at least 1 winner.';

        const endsAt = Date.now() + msDuration;
        const endTimestamp = Math.floor(endsAt / 1000);

        // 🌟 Ultra-Clean Mobile Responsive Active Embed
        const embed = new EmbedBuilder()
            .setColor('#9B51E0') // Vibrant Royal Violet
            .setAuthor({ 
                name: '🎉 ACTIVE GIVEAWAY', 
                iconURL: author.displayAvatarURL({ dynamic: true }) 
            })
            .setTitle(`🎁 ${prize}`)
            .setDescription([
                `> React with 🎉 to enter this giveaway!`,
                ``,
                `⏰ **Ends:** <t:${endTimestamp}:R> (<t:${endTimestamp}:f>)`,
                `👑 **Host:** <@${author.id}>`,
                `👥 **Winners:** \`${winnerCount}\``
            ].join('\n'))
            .setFooter({ text: 'Ends at' })
            .setTimestamp(endsAt);

        const message = await channel.send({ embeds: [embed] }).catch(() => null);
        if (!message) return '❌ Failed to send giveaway message. Please check my channel permissions!';

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

        return '✅ Giveaway launched successfully!';
    }

    // ==========================================
    // 💬 LISTENERS (Slash & Prefix)
    // ==========================================
    client.on('interactionCreate', async (interaction) => {
        if (!interaction.isChatInputCommand() || interaction.commandName !== 'giveaway') return;

        const duration = interaction.options.getString('duration');
        const prize = interaction.options.getString('prize');
        const winners = interaction.options.getInteger('winners') || 1;
        const targetChannel = interaction.options.getChannel('channel') || interaction.channel;

        const response = await startGiveaway(targetChannel, interaction.user, duration, winners, prize);
        await interaction.reply({ content: response, ephemeral: true }).catch(() => {});
    });

    client.on('messageCreate', async (message) => {
        if (message.author.bot || !message.guild) return;

        if (message.content.toLowerCase().startsWith(PREFIX + 'giveaway')) {
            if (!message.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
                return message.reply('❌ You need **Administrator** permissions to start a giveaway.').catch(() => {});
            }

            const args = message.content.slice(PREFIX.length + 8).trim().split(/ +/);
            if (args.length < 2) {
                return message.reply('🔹 **Usage:** `.giveaway <duration> [winners] <prize>`\n*Example:* `.giveaway 10m 1 Nitro Classic`').catch(() => {});
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
                await message.reply(response).catch(() => {});
            } else {
                await message.delete().catch(() => {});
            }
        }
    });

    // ==========================================
    // 🏁 ENDED GIVEAWAY EMBED (AFTER)
    // ==========================================
    async function checkGiveaways() {
        let giveaways = getGiveaways();
        if (!giveaways.length) return;

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

                // ❌ EXPIRED EMBED (No Winners)
                if (validUsers.length === 0) {
                    const failEmbed = new EmbedBuilder()
                        .setColor('#2B2D31') // Sleek Dark Discord Slate
                        .setAuthor({ name: '❌ GIVEAWAY EXPIRED' })
                        .setTitle(`🎁 ${giveaway.prize}`)
                        .setDescription([
                            `> Could not determine a winner because no valid participants entered!`,
                            ``,
                            `👑 **Host:** <@${giveaway.hostId}>`
                        ].join('\n'))
                        .setFooter({ text: 'Ended at' })
                        .setTimestamp();

                    await message.edit({ embeds: [failEmbed] }).catch(() => {});
                    await channel.send(`📢 The giveaway for **${giveaway.prize}** has ended, but nobody entered!`).catch(() => {});
                    continue;
                }

                // Pick random winners
                const winners = [];
                for (let i = 0; i < giveaway.winners; i++) {
                    if (validUsers.length === 0) break;
                    const randomIndex = Math.floor(Math.random() * validUsers.length);
                    winners.push(validUsers[randomIndex]);
                    validUsers.splice(randomIndex, 1);
                }

                const winnersText = winners.map(id => `<@${id}>`).join(', ');

                // 🏆 WINNER EMBED (AFTER)
                const winEmbed = new EmbedBuilder()
                    .setColor('#2ECC71') // High-Contrast Emerald Green
                    .setAuthor({ name: '🎊 GIVEAWAY CONCLUDED' })
                    .setTitle(`🏆 ${giveaway.prize}`)
                    .setDescription([
                        `> Congratulations to the winner(s) of **${giveaway.prize}**!`,
                        ``,
                        `🥳 **Winner(s):** ${winnersText}`,
                        `👑 **Host:** <@${giveaway.hostId}>`
                    ].join('\n'))
                    .setFooter({ text: 'Ended at' })
                    .setTimestamp();

                await message.edit({ embeds: [winEmbed] }).catch(() => {});
                await channel.send(`🎉 **CONGRATULATIONS** ${winnersText}! You won **${giveaway.prize}**!`).catch(() => {});

            } catch (error) {
                console.error('Error ending giveaway:', error);
            }
        }
    }
};
