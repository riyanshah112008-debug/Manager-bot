const { registerInteractionHandler } = require('../utils/interactionHandler');
const { EmbedBuilder, PermissionsBitField, Events } = require('discord.js');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const dbPath = path.join(__dirname, 'giveaways.json');

// 🎬 DIRECT GIPHY CDN ASSETS (DISCORD PROXY GUARANTEED)
const ASSETS = {
    // Active Banner: Tony Stark / Iron Man (Direct i.giphy CDN)
    ACTIVE_BANNER: 'https://i.giphy.com/O7ifqdHteyN7q.gif', 

    // Winner Banner: Leonardo DiCaprio Great Gatsby Toast (Direct i.giphy CDN)
    WINNER_BANNER: 'https://i.giphy.com/g9582DNuQppxC.gif'
};

module.exports = (client) => {
    const config = require('../config');
    const PREFIX = config.DEFAULT_PREFIX || ',';

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
    // ⏰ BACKGROUND CHECKER ENGINE
    // ==========================================
    client.once(Events.ClientReady || 'clientReady', () => {
        setInterval(checkGiveaways, 8000);
        console.log('✅ Supreme Starry Giveaway Engine Active');
    });

    // ==========================================
    // 🚀 1. ACTIVE GIVEAWAY EMBED (TONY STARK EDITION)
    // ==========================================
    async function startGiveaway(channel, author, durationStr, winnerCount = 1, prize) {
        const msDuration = parseTime(durationStr);
        if (!msDuration) return '❌ **Invalid time format!** Use `s`, `m`, `h`, `d`, or `w` *(Example: `10m`, `2h`, `1d`)*.';
        if (winnerCount < 1) return '❌ **Invalid winners!** Must specify at least 1 winner.';

        const endsAt = Date.now() + msDuration;
        const endTimestamp = Math.floor(endsAt / 1000);

        const embed = new EmbedBuilder()
            .setColor('#FF007F') // Supreme Cyber Neon Pink
            .setAuthor({ 
                name: '✨ SUPREME OFFICIAL GIVEAWAY ✨', 
                iconURL: author.displayAvatarURL({ dynamic: true }) 
            })
            .setTitle(`🎁 ${prize}`)
            .setDescription([
                `> React with **🎉** to enter the grand prize drop!`,
                ``,
                `⏳ **Ending:** <t:${endTimestamp}:R> (<t:${endTimestamp}:F>)`,
                `👑 **Hosted By:** <@${author.id}>`,
                `🏆 **Lucky Winners:** \`${winnerCount}\``,
                ``,
                `*“Genius, billionaire, playboy, philanthropist level drop.”* 🚀`
            ].join('\n'))
            .setImage(ASSETS.ACTIVE_BANNER)
            .setFooter({ 
                text: `Hosted by ${author.tag} • Tap 🎉 to enter!`, 
                iconURL: client.user.displayAvatarURL({ dynamic: true }) 
            })
            .setTimestamp(endsAt);

        const message = await channel.send({ embeds: [embed] }).catch(() => null);
        if (!message) return '❌ Failed to send giveaway message. Verify channel bot permissions!';

        await message.react('🎉').catch(() => {});

        const giveaways = getGiveaways();
        giveaways.push({
            messageId: message.id,
            channelId: channel.id,
            guildId: channel.guild.id,
            prize: prize,
            winners: winnerCount,
            endsAt: endsAt,
            hostId: author.id,
            status: 'active',
            createdAt: Date.now(),
            participantCount: 0,
            winnerIds: []
        });
        saveGiveaways(giveaways);

        return '✅ Supreme Giveaway launched successfully!';
    }

    // ==========================================
    // 🔄 2. REROLL WINNER FUNCTION
    // ==========================================
    async function rerollGiveaway(channel, messageId, winnerCount = 1, executor) {
        const message = await channel.messages.fetch(messageId).catch(() => null);
        if (!message) return '❌ **Giveaway message not found!** Make sure you provided a valid Message ID from this channel.';

        const reaction = message.reactions.cache.get('🎉');
        if (!reaction) return '❌ **No 🎉 reactions found on that message!**';

        const fetchedUsers = await reaction.users.fetch({ limit: 100 });
        let validUsers = fetchedUsers.filter(u => !u.bot).map(u => u.id);

        if (validUsers.length === 0) {
            return '❌ **Cannot reroll!** There are no human participants in the reactions.';
        }

        // Exclude previous winners if possible
        const previousWinnerMentions = message.embeds[0]?.description?.match(/<@!?(\d+)>/g) || [];
        const previousWinnerIds = previousWinnerMentions.map(m => m.replace(/<@!?|>/g, ''));

        const filteredUsers = validUsers.filter(id => !previousWinnerIds.includes(id));
        if (filteredUsers.length >= winnerCount) {
            validUsers = filteredUsers;
        }

        const winners = [];
        for (let i = 0; i < winnerCount; i++) {
            if (validUsers.length === 0) break;
            const randomIndex = crypto.randomInt(validUsers.length);
            winners.push(validUsers[randomIndex]);
            validUsers.splice(randomIndex, 1);
        }

        const winnersText = winners.map(id => `<@${id}>`).join(', ');

        const rerollEmbed = new EmbedBuilder()
            .setColor('#00F5D4')
            .setAuthor({ name: '🔄 GIVEAWAY WINNER REROLLED 🔄' })
            .setTitle(message.embeds[0]?.title || '🎁 Prize Reroll')
            .setDescription([
                `> A new winner has been selected by request!`,
                ``,
                `🥳 **New Winner(s):** ${winnersText}`,
                `👑 **Rerolled By:** <@${executor.id}>`,
                ``,
                `*“Here’s to the new champion!”* 🥂`
            ].join('\n'))
            .setImage(ASSETS.WINNER_BANNER)
            .setFooter({ text: 'Reroll Complete • Winner Verified', iconURL: client.user.displayAvatarURL({ dynamic: true }) })
            .setTimestamp();

        await channel.send({ 
            content: `🎉 **NEW REROLLED WINNER(S):** ${winnersText}! Congratulations! 🚀🥂`, 
            embeds: [rerollEmbed] 
        }).catch(() => {});

        return '✅ Winner rerolled successfully!';
    }

    // Single service facade used by both Discord commands and the dashboard API.
    client.starryGiveawayEngine = {
        list: async guildId => {
            const records = getGiveaways().filter(item => item.guildId === String(guildId));
            return Promise.all(records.map(async item => {
                let participantCount = Number(item.participantCount || 0);
                if (item.status === 'active') {
                    const guild = client.guilds.cache.get(item.guildId);
                    const channel = guild?.channels.cache.get(item.channelId);
                    const message = await channel?.messages.fetch(item.messageId).catch(() => null);
                    const reaction = message?.reactions.cache.get('🎉');
                    if (reaction) {
                        const users = await reaction.users.fetch({ limit: 100 }).catch(() => null);
                        if (users) participantCount = users.filter(user => !user.bot).size;
                    }
                }
                return {
                    messageId: item.messageId, channelId: item.channelId, guildId: item.guildId,
                    prize: item.prize, winners: item.winners, endsAt: item.endsAt, hostId: item.hostId,
                    status: item.status || (item.endsAt > Date.now() ? 'active' : 'processing'),
                    participantCount, winnerIds: item.winnerIds || [],
                    createdAt: item.createdAt || null, completedAt: item.completedAt || null
                };
            }));
        },
        create: async (channel, author, duration, winnerCount, prize) => {
            const response = await startGiveaway(channel, author, duration, winnerCount, prize);
            if (String(response).includes('❌')) throw new Error(String(response).replace(/\*\*/g, ''));
            const record = getGiveaways().filter(item =>
                item.guildId === channel.guild.id && item.hostId === author.id && item.prize === prize
            ).slice(-1)[0];
            if (!record) throw new Error('Giveaway message was sent but its record could not be verified.');
            return { message: response, giveaway: record };
        },
        find: (guildId, messageId) => getGiveaways().find(item =>
            item.guildId === String(guildId) && item.messageId === String(messageId)
        ) || null,
        end: async (guildId, messageId) => {
            const records = getGiveaways();
            const record = records.find(item => item.guildId === String(guildId) && item.messageId === String(messageId));
            if (!record) throw new Error('Giveaway does not exist in this server.');
            if (record.status === 'completed' || record.status === 'failed') throw new Error('This giveaway has already ended.');
            record.endsAt = Date.now();
            record.status = 'active';
            saveGiveaways(records);
            await checkGiveaways();
            const updated = getGiveaways().find(item => item.messageId === String(messageId));
            return { success: updated?.status === 'completed', giveaway: updated || record };
        },
        reroll: async (guildId, messageId, winnerCount, executor) => {
            const record = getGiveaways().find(item => item.guildId === String(guildId) && item.messageId === String(messageId));
            if (!record) throw new Error('Giveaway does not exist in this server.');
            const guild = client.guilds.cache.get(String(guildId));
            const channel = guild?.channels.cache.get(record.channelId);
            if (!channel) throw new Error('The giveaway channel is unavailable.');
            const response = await rerollGiveaway(channel, String(messageId), winnerCount || record.winners || 1, executor);
            if (String(response).includes('❌')) throw new Error(String(response).replace(/\*\*/g, ''));
            return { success: true, message: response };
        }
    };

    // ==========================================
    // 💬 LISTENERS (Slash & Prefix)
    // ==========================================
    registerInteractionHandler(client, 'giveaway:1', async (interaction) => {
        if (!interaction.isChatInputCommand()) return;

        // ⏱️ INSTANT ACKNOWLEDGMENT (Prevents "Application Did Not Respond" error)
        if (interaction.commandName === 'giveaway' || interaction.commandName === 'reroll') {
            await interaction.deferReply({ ephemeral: true }).catch(() => {});
        }

        // REROLL SLASH COMMAND
        if (interaction.commandName === 'reroll' || (interaction.commandName === 'giveaway' && interaction.options.getSubcommand(false) === 'reroll')) {
            const messageId = interaction.options.getString('message_id');
            const winners = interaction.options.getInteger('winners') || 1;
            const response = await rerollGiveaway(interaction.channel, messageId, winners, interaction.user);
            return interaction.editReply({ content: response }).catch(() => {});
        }

        // START GIVEAWAY SLASH COMMAND
        if (interaction.commandName === 'giveaway') {
            const duration = interaction.options.getString('duration');
            const prize = interaction.options.getString('prize');
            const winners = interaction.options.getInteger('winners') || 1;
            const targetChannel = interaction.options.getChannel('channel') || interaction.channel;

            const response = await startGiveaway(targetChannel, interaction.user, duration, winners, prize);
            await interaction.editReply({ content: response }).catch(() => {});
        }
    });

    client.on('messageCreate', async (message) => {
        if (message.author.bot || !message.guild) return;

        // PREFIX REROLL COMMAND (.reroll <message_id> [winners])
        if (message.content.toLowerCase().startsWith(PREFIX + 'reroll') || message.content.toLowerCase().startsWith(PREFIX + 'giveaway reroll') || message.content.toLowerCase().startsWith(',reroll') || message.content.toLowerCase().startsWith(',giveaway reroll')) {
            if (!config.isBotOwner(message.author.id, client)) return;
            if (!message.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
                return message.reply('❌ You need **Administrator** permissions to reroll giveaways.').catch(() => {});
            }

            const args = message.content.split(/ +/);
            const messageId = args.find(a => /^\d{17,20}$/.test(a));

            if (!messageId) {
                return message.reply('🔹 **Usage:** `.reroll <message_id> [winners]`\n*Example:* `.reroll 123456789012345678 1`').catch(() => {});
            }

            let winners = 1;
            const numArg = args.find(a => !isNaN(a) && a !== messageId && parseInt(a) > 0);
            if (numArg) winners = parseInt(numArg);

            const response = await rerollGiveaway(message.channel, messageId, winners, message.author);
            return message.reply(response).catch(() => {});
        }

        // PREFIX START GIVEAWAY COMMAND (.giveaway <duration> [winners] <prize>)
        if (message.content.toLowerCase().startsWith(PREFIX + 'giveaway') || message.content.toLowerCase().startsWith(',giveaway')) {
            if (!config.isBotOwner(message.author.id, client)) return;
            if (!message.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
                return message.reply('❌ You need **Administrator** permissions to start a giveaway.').catch(() => {});
            }

            const args = message.content.slice(PREFIX.length + 8).trim().split(/ +/);
            if (args.length < 2) {
                return message.reply('🔹 **Usage:** `.giveaway <duration> [winners] <prize>`\n*Example:* `.giveaway 10m 1 Discord Nitro`').catch(() => {});
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
    // 🏁 3. CONCLUDED GIVEAWAY AUTOMATION ENGINE
    // ==========================================
    let giveawayCheckRunning = false;
    async function checkGiveaways() {
        if (giveawayCheckRunning) return;
        giveawayCheckRunning = true;
        try {
            const giveaways = getGiveaways();
            if (!giveaways.length) return;
            const now = Date.now();
            const due = giveaways.filter(item => item.status !== 'completed' && item.status !== 'failed' && Number(item.endsAt) <= now);
            for (const giveaway of due) {
                try {
                    giveaway.status = 'processing';
                    saveGiveaways(giveaways);

                    const guild = client.guilds.cache.get(giveaway.guildId);
                    const channel = guild?.channels.cache.get(giveaway.channelId);
                    const message = await channel?.messages.fetch(giveaway.messageId).catch(() => null);
                    if (!guild || !channel || !message) {
                        giveaway.status = 'failed';
                        giveaway.completedAt = Date.now();
                        giveaway.failureReason = 'Giveaway message is no longer available.';
                        saveGiveaways(giveaways);
                        continue;
                    }

                    const reaction = message.reactions.cache.get('🎉');
                    const users = reaction ? await reaction.users.fetch({ limit: 100 }).catch(() => null) : null;
                    const participants = users ? users.filter(user => !user.bot).map(user => user.id) : [];
                    giveaway.participantCount = participants.length;

                    if (!participants.length) {
                        const failEmbed = new EmbedBuilder()
                            .setColor('#ED4245')
                            .setAuthor({ name: '❌ GIVEAWAY EXPIRED' })
                            .setTitle('🎁 ' + giveaway.prize)
                            .setDescription('Nobody entered this giveaway.\n\n👑 **Host:** <@' + giveaway.hostId + '>')
                            .setFooter({ text: 'Giveaway Ended • No Participants' })
                            .setTimestamp();
                        await message.edit({ embeds: [failEmbed] }).catch(() => {});
                        await channel.send('📢 The giveaway for **' + giveaway.prize + '** ended, but nobody entered!').catch(() => {});
                        giveaway.winnerIds = [];
                    } else {
                        const pool = [...participants];
                        const winners = [];
                        for (let i = 0; i < Math.min(Number(giveaway.winners) || 1, pool.length); i++) {
                            winners.push(pool.splice(crypto.randomInt(pool.length), 1)[0]);
                        }
                        giveaway.winnerIds = winners;
                        const winnersText = winners.map(id => '<@' + id + '>').join(', ');
                        const winEmbed = new EmbedBuilder()
                            .setColor('#00F5D4')
                            .setAuthor({ name: '🥂 GRAND GIVEAWAY CONCLUDED 🥂' })
                            .setTitle('🏆 ' + giveaway.prize)
                            .setDescription('🥳 **Winner(s):** ' + winnersText + '\n👑 **Host:** <@' + giveaway.hostId + '>')
                            .setImage(ASSETS.WINNER_BANNER)
                            .setFooter({ text: 'Giveaway Ended • Winner Selected', iconURL: client.user.displayAvatarURL({ dynamic: true }) })
                            .setTimestamp();
                        await message.edit({ embeds: [winEmbed] }).catch(() => {});
                        await channel.send('🎉 **CONGRATULATIONS** ' + winnersText + '! You won **' + giveaway.prize + '**!').catch(() => {});
                    }
                    giveaway.status = 'completed';
                    giveaway.completedAt = Date.now();
                    delete giveaway.failureReason;
                    saveGiveaways(giveaways);
                } catch (error) {
                    console.error('Error ending giveaway:', error.message);
                    giveaway.status = 'active';
                    saveGiveaways(giveaways);
                }
            }
        } finally {
            giveawayCheckRunning = false;
        }
    }
};
