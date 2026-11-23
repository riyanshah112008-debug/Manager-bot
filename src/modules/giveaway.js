const { registerInteractionHandler } = require('../utils/interactionHandler');
const { EmbedBuilder, PermissionsBitField, Events } = require('discord.js');
const mongoose = require('mongoose');
const crypto = require('node:crypto');
const Giveaway = require('../models/Giveaway');
const { notifyGuild } = require('../utils/guildNotifications');
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

    // MongoDB is the durable source of truth in hosted deployments.
    // The JSON file remains a temporary fallback for offline operation and is migrated on reconnect.
    async function getGiveaways(guildId = null) {
        if (mongoose.connection.readyState === 1) {
            const query = { status: 'active' };
            if (guildId) query.guildId = guildId;
            const docs = await Giveaway.find(query).sort({ endsAt: 1 }).limit(250).lean();
            return docs.map(doc => ({ ...doc, endsAt: new Date(doc.endsAt).getTime() }));
        }
        try {
            if (!fs.existsSync(dbPath)) fs.writeFileSync(dbPath, JSON.stringify([], null, 2));
            const rows = JSON.parse(fs.readFileSync(dbPath, 'utf-8'));
            return Array.isArray(rows) ? rows.filter(row => !guildId || row.guildId === guildId) : [];
        } catch {
            return [];
        }
    }

    function saveGiveaways(data) {
        fs.writeFileSync(dbPath, JSON.stringify(data, null, 2));
    }

    async function migrateLegacyGiveaways() {
        if (mongoose.connection.readyState !== 1) return;
        try {
            const legacy = getGiveawaysFromFile();
            for (const item of legacy) {
                if (!item?.messageId || !item.guildId || !item.channelId || !item.endsAt) continue;
                await Giveaway.updateOne(
                    { messageId: String(item.messageId) },
                    { $setOnInsert: {
                        guildId: String(item.guildId),
                        channelId: String(item.channelId),
                        messageId: String(item.messageId),
                        prize: String(item.prize || 'Community giveaway').slice(0, 150),
                        winners: Math.min(20, Math.max(1, Number(item.winners) || 1)),
                        endsAt: new Date(Number(item.endsAt)),
                        hostId: String(item.hostId || client.user.id),
                        status: 'active'
                    } },
                    { upsert: true }
                );
            }
            fs.writeFileSync(dbPath, JSON.stringify([], null, 2));
        } catch (error) {
            console.warn('[Giveaway] Legacy JSON migration deferred:', error.message);
        }
    }

    function getGiveawaysFromFile() {
        try {
            if (!fs.existsSync(dbPath)) fs.writeFileSync(dbPath, JSON.stringify([], null, 2));
            const rows = JSON.parse(fs.readFileSync(dbPath, 'utf-8'));
            return Array.isArray(rows) ? rows : [];
        } catch {
            return [];
        }
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
    client.once(Events.ClientReady || 'clientReady', async () => {
        await migrateLegacyGiveaways();
        setInterval(() => checkGiveaways().catch(error => console.warn('[Giveaway] Scheduler cycle failed:', error.message)), 8000);
        console.log('✅ Supreme Starry Giveaway Engine Active');
    });

    // ==========================================
    // 🚀 1. ACTIVE GIVEAWAY EMBED (TONY STARK EDITION)
    // ==========================================
    async function startGiveaway(channel, author, durationStr, winnerCount = 1, prize, returnMeta = false) {
        const msDuration = parseTime(durationStr);
        const fail = message => returnMeta ? { success: false, message } : message;
        if (!msDuration || msDuration < 60000 || msDuration > 30 * 24 * 60 * 60 * 1000) return fail('❌ **Invalid duration.** Choose between 1 minute and 30 days.');
        if (!Number.isInteger(Number(winnerCount)) || Number(winnerCount) < 1 || Number(winnerCount) > 20) return fail('❌ **Invalid winners!** Choose from 1 to 20 winners.');
        if (typeof prize !== 'string' || !prize.trim() || prize.trim().length > 150) return fail('❌ **Invalid prize.** Enter a prize between 1 and 150 characters.');
        if (!channel?.guild || !channel.isTextBased?.() || typeof channel.send !== 'function') return fail('❌ Choose a text channel inside a Discord server.');
        if (mongoose.connection.readyState !== 1) return fail('❌ Giveaway database is unavailable. Please retry when the database reconnects.');

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

        try {
            await message.react('🎉');
            await Giveaway.create({
                messageId: message.id,
                channelId: channel.id,
                guildId: channel.guild.id,
                prize: prize.trim(),
                winners: Number(winnerCount),
                endsAt: new Date(endsAt),
                hostId: author.id,
                status: 'active'
            });
        } catch (error) {
            await message.delete().catch(() => {});
            console.error('[Giveaway] Could not persist giveaway:', error.message);
            return fail('❌ Starry could not save this giveaway. No giveaway was left running.');
        }

        const result = { success: true, message: 'Giveaway launched successfully.', messageId: message.id, channelId: channel.id, guildId: channel.guild.id, prize: prize.trim(), winners: Number(winnerCount), endsAt };
        return returnMeta ? result : '✅ Supreme Giveaway launched successfully!';
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

        if (!Number.isInteger(Number(winnerCount)) || Number(winnerCount) < 1 || Number(winnerCount) > 20) return '❌ Choose between 1 and 20 winners.';
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
            const randomIndex = crypto.randomInt(0, validUsers.length);
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
    async function checkGiveaways() {
        if (mongoose.connection.readyState !== 1) return;
        const now = new Date();
        const staleBefore = new Date(Date.now() - 2 * 60 * 1000);
        const candidates = await Giveaway.find({
            $or: [
                { status: 'active', endsAt: { $lte: now } },
                { status: 'processing', updatedAt: { $lte: staleBefore } }
            ]
        }).sort({ endsAt: 1 }).limit(25).lean();

        for (const candidate of candidates) {
            // Claim active jobs, or safely resume a stale processing job after a crash.
            const giveaway = await Giveaway.findOneAndUpdate(
                {
                    messageId: candidate.messageId,
                    $or: [
                        { status: 'active', endsAt: { $lte: now } },
                        { status: 'processing', updatedAt: { $lte: staleBefore } }
                    ]
                },
                { $set: { status: 'processing', updatedAt: new Date() } },
                { new: true }
            ).lean();
            if (!giveaway) continue;

            try {
                const guild = client.guilds.cache.get(giveaway.guildId);
                const channel = guild?.channels?.cache?.get(giveaway.channelId);
                const message = channel ? await channel.messages.fetch(giveaway.messageId).catch(() => null) : null;
                if (!guild || !channel || !message) {
                    await Giveaway.updateOne({ messageId: giveaway.messageId, status: 'processing' }, {
                        $set: { status: 'cancelled', endedAt: new Date() }
                    });
                    continue;
                }

                let winners;
                if (giveaway.outcomeCommitted === true) {
                    // Reuse the committed winner set after a restart; never reroll on retry.
                    winners = Array.isArray(giveaway.winnerIds) ? giveaway.winnerIds : [];
                } else {
                    const reaction = message.reactions.cache.get('🎉');
                    const users = reaction ? await reaction.users.fetch().catch(() => null) : null;
                    const participants = users
                        ? users.filter(user => !user.bot).map(user => user.id)
                        : [];
                    winners = [];
                    while (participants.length && winners.length < giveaway.winners) {
                        const index = crypto.randomInt(0, participants.length);
                        winners.push(participants.splice(index, 1)[0]);
                    }

                    const committed = await Giveaway.updateOne(
                        { messageId: giveaway.messageId, status: 'processing', outcomeCommitted: { $ne: true } },
                        { $set: { winnerIds: winners, outcomeCommitted: true, updatedAt: new Date() } }
                    );
                    if (!committed.modifiedCount) continue;
                }

                // The Discord giveaway post is the source-visible completion marker.
                // If it was already edited before a restart, do not duplicate winner posts.
                const alreadyConcluded = String(message.embeds[0]?.footer?.text || '').includes('Giveaway Ended');
                if (!alreadyConcluded && winners.length === 0) {
                    const failEmbed = new EmbedBuilder()
                        .setColor('#ED4245')
                        .setAuthor({ name: '❌ GIVEAWAY EXPIRED' })
                        .setTitle('🎁 ' + giveaway.prize)
                        .setDescription('Nobody entered this giveaway.')
                        .setFooter({ text: 'Giveaway Ended • No Participants' })
                        .setTimestamp();
                    await message.edit({ embeds: [failEmbed] });
                    await channel.send('📢 The giveaway for **' + giveaway.prize + '** ended, but nobody entered!').catch(() => {});
                } else if (!alreadyConcluded) {
                    const winnersText = winners.map(id => '<@' + id + '>').join(', ');
                    const winEmbed = new EmbedBuilder()
                        .setColor('#00F5D4')
                        .setAuthor({ name: '🥂 GRAND GIVEAWAY CONCLUDED 🥂' })
                        .setTitle('🏆 ' + giveaway.prize)
                        .setDescription([
                            '> Cheers to the lucky champion(s)!',
                            '',
                            '🥳 **Winner(s):** ' + winnersText,
                            '👑 **Host:** <@' + giveaway.hostId + '>',
                            '',
                            '*“Here’s to the ones who dream, and the ones who win.”* 🍾'
                        ].join('\n'))
                        .setImage(ASSETS.WINNER_BANNER)
                        .setFooter({ text: 'Giveaway Ended • Winner Verified', iconURL: client.user.displayAvatarURL({ dynamic: true }) })
                        .setTimestamp();
                    await message.edit({ embeds: [winEmbed] });
                    await channel.send({
                        content: '🎉 **CHEERS & CONGRATULATIONS** ' + winnersText + '! You won **' + giveaway.prize + '**! 🚀🥂',
                        allowedMentions: { parse: [], users: winners }
                    });
                    await notifyGuild(client, guild.id, 'giveawayResult', {
                        content: 'Giveaway **' + giveaway.prize + '** ended. Winner(s): ' + winnersText
                    }).catch(() => {});
                }

                await Giveaway.updateOne(
                    { messageId: giveaway.messageId, status: 'processing', outcomeCommitted: true },
                    { $set: { status: 'ended', endedAt: new Date() } }
                );
            } catch (error) {
                console.error('Error ending giveaway:', error);
                // Leave the committed result in processing so the same winner set is retried.
                // A later scheduler cycle reclaims it after the stale-job safety window.
                await Giveaway.updateOne(
                    { messageId: giveaway.messageId, status: 'processing' },
                    { $set: { updatedAt: new Date() } }
                ).catch(() => {});
            }
        }
    }

    async function listActiveGiveaways(guildId) {
        if (!guildId || mongoose.connection.readyState !== 1) {
            throw new Error('Giveaway database is unavailable.');
        }
        return Giveaway.find({ guildId, status: 'active' })
            .sort({ endsAt: 1 })
            .limit(100)
            .lean();
    }

    async function cancelGiveaway(guildId, messageId) {
        if (!guildId || !messageId || mongoose.connection.readyState !== 1) {
            throw new Error('Giveaway database is unavailable.');
        }
        const cancelled = await Giveaway.findOneAndUpdate(
            { guildId, messageId, status: 'active' },
            { $set: { status: 'cancelled', endedAt: new Date() } },
            { new: true }
        ).lean();
        if (!cancelled) return false;
        const guild = client.guilds.cache.get(guildId);
        const channel = guild?.channels?.cache?.get(cancelled.channelId);
        const message = channel ? await channel.messages.fetch(messageId).catch(() => null) : null;
        if (message) {
            const embed = EmbedBuilder.from(message.embeds[0] || new EmbedBuilder())
                .setColor('#6B7280')
                .setFooter({ text: 'Giveaway cancelled by a server administrator.' });
            await message.edit({ embeds: [embed] }).catch(() => {});
        }
        return true;
    }

    client.giveawayManager = {
        listActive: listActiveGiveaways,
        start: (channel, author, duration, winners, prize) => startGiveaway(channel, author, duration, winners, prize, true),
        cancel: cancelGiveaway
    };
};
