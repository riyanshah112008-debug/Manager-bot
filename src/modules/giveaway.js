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
    // 🎨 SUPREME AESTHETIC GIVEAWAY CREATOR
    // ==========================================
    async function startGiveaway(channel, author, durationStr, winnerCount = 1, prize) {
        const msDuration = parseTime(durationStr);
        if (!msDuration) return '❌ **Invalid time format!** Use `s`, `m`, `h`, `d`, or `w` *(Example: `10m`, `2h`)*.';
        if (winnerCount < 1) return '❌ **Invalid winners!** Must have at least 1 winner.';

        const endsAt = Date.now() + msDuration;
        const endTimestamp = Math.floor(endsAt / 1000);

        // 🌟 Supreme Mobile-Responsive Aesthetic Embed
        const embed = new EmbedBuilder()
            .setColor('#FF2A6D') // Vibrant Modern Neon Pink
            .setAuthor({ 
                name: '🎉 EXCLUSIVE GIVEAWAY', 
                iconURL: 'https://cdn-icons-png.flaticon.com/512/3112/3112905.png' 
            })
            .setTitle(`🎁  ${prize}`)
            .setDescription([
                `> React with 🎉 to enter the giveaway!`,
                `> Make sure you stay in the server until it ends.`
            ].join('\n'))
            .addFields(
                { name: '👑 Hosted By', value: `<@${author.id}>`, inline: true },
                { name: '👥 Winners', value: `\`${winnerCount}\``, inline: true },
                { name: '⏰ Ending', value: `<t:${endTimestamp}:R>\n(<t:${endTimestamp}:f>)`, inline: false }
            )
            .setThumbnail('https://cdn-icons-png.flaticon.com/512/4213/4213958.png')
            .setFooter({ 
                text: `Hosted by ${author.tag}`, 
                iconURL: author.displayAvatarURL({ dynamic: true }) 
            })
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
    // 🏁 ENDING ENGINE & WINNER SELECTOR
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

                if (validUsers.length === 0) {
                    const failEmbed = new EmbedBuilder()
                        .setColor('#2B2D31') // Sleek dark grey
                        .setAuthor({ name: '🎉 GIVEAWAY ENDED' })
                        .setTitle(`🎁 ${giveaway.prize}`)
                        .setDescription('> 😭 **No valid participants entered the giveaway!**')
                        .addFields(
                            { name: '👑 Host', value: `<@${giveaway.hostId}>`, inline: true },
                            { name: '🏆 Winners', value: '`None`', inline: true }
                        )
                        .setFooter({ text: 'Giveaway Concluded' })
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

                // 🏆 Supreme Emerald Winner Embed
                const winEmbed = new EmbedBuilder()
                    .setColor('#00F5D4') // Vibrant Cyan / Mint Emerald
                    .setAuthor({ name: '🎊 GIVEAWAY WINNER(S)' })
                    .setTitle(`🏆  ${giveaway.prize}`)
                    .setDescription(`> Congratulations to the winner(s) of **${giveaway.prize}**!`)
                    .addFields(
                        { name: '🥳 Winner(s)', value: winnersText, inline: false },
                        { name: '👑 Host', value: `<@${giveaway.hostId}>`, inline: true }
                    )
                    .setThumbnail('https://cdn-icons-png.flaticon.com/512/3112/3112905.png')
                    .setFooter({ text: 'Giveaway Ended' })
                    .setTimestamp();

                await message.edit({ embeds: [winEmbed] }).catch(() => {});
                await channel.send(`🎉 **CONGRATULATIONS** ${winnersText}! You won **${giveaway.prize}**!`).catch(() => {});

            } catch (error) {
                console.error('Error ending giveaway:', error);
            }
        }
    }
};
