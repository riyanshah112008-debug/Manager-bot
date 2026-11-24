const { registerInteractionHandler } = require('../utils/interactionHandler');
const { EmbedBuilder, PermissionsBitField, Events } = require('discord.js');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const dbPath = path.join(__dirname, 'giveaways.json');
const rerollLocks = new Set();
let giveawayStoreQueue = Promise.resolve();
let giveawayCheckPromise = null;

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
        const temporaryPath = dbPath + '.tmp';
        fs.writeFileSync(temporaryPath, JSON.stringify(data, null, 2));
        fs.renameSync(temporaryPath, dbPath);
    }

    function withGiveawayStoreLock(operation) {
        const pending = giveawayStoreQueue.then(operation, operation);
        giveawayStoreQueue = pending.catch(() => {});
        return pending;
    }

    async function addGiveawayRecord(record) {
        return withGiveawayStoreLock(() => {
            const records = getGiveaways();
            records.push(record);
            saveGiveaways(records);
            return JSON.parse(JSON.stringify(record));
        });
    }

    async function updateGiveawayRecord(guildId, messageId, update) {
        return withGiveawayStoreLock(() => {
            const records = getGiveaways();
            const record = records.find(item =>
                String(item.guildId) === String(guildId) && String(item.messageId) === String(messageId)
            );
            if (!record) return null;
            update(record);
            saveGiveaways(records);
            return JSON.parse(JSON.stringify(record));
        });
    }

    function isDiscordNotFound(error, code) {
        return Number(error && (error.code || (error.rawError && error.rawError.code))) === code;
    }

    async function fetchHumanParticipants(reaction) {
        const participants = new Set();
        let after;
        // Discord returns at most 100 users per request. Page so large giveaways
        // do not silently ignore members beyond the first page.
        for (let page = 0; page < 100; page++) {
            const options = { limit: 100 };
            if (after) options.after = after;
            const users = await reaction.users.fetch(options);
            if (!users?.size) break;
            for (const user of users.values()) if (user && !user.bot) participants.add(user.id);
            if (users.size < 100) break;
            const lastUser = users.last();
            if (!lastUser || lastUser.id === after) break;
            after = lastUser.id;
        }
        return [...participants];
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
        setInterval(() => checkGiveaways().catch(error => console.error('[Giveaway] Scheduled sweep failed:', error.message)), 8000);
        console.log('✅ Supreme Starry Giveaway Engine Active');
    });

    // ==========================================
    // 🚀 1. ACTIVE GIVEAWAY EMBED (TONY STARK EDITION)
    // ==========================================
    async function startGiveaway(channel, author, durationStr, winnerCount = 1, prize) {
        const msDuration = parseTime(typeof durationStr === 'string' ? durationStr.trim() : '');
        const normalizedPrize = typeof prize === 'string' ? prize.trim() : '';
        if (!msDuration || msDuration < 10000 || msDuration > 90 * 24 * 60 * 60 * 1000) {
            return { success: false, message: '❌ Use a duration between 10 seconds and 90 days (for example, 10m, 2h or 1d).' };
        }
        if (!Number.isInteger(winnerCount) || winnerCount < 1 || winnerCount > 20) {
            return { success: false, message: '❌ Winner count must be a whole number from 1 to 20.' };
        }
        if (!normalizedPrize || normalizedPrize.length > 200) {
            return { success: false, message: '❌ Prize must contain 1 to 200 characters.' };
        }

        const endsAt = Date.now() + msDuration;
        const endTimestamp = Math.floor(endsAt / 1000);
        const embed = new EmbedBuilder()
            .setColor('#FF007F')
            .setAuthor({ name: '✨ SUPREME OFFICIAL GIVEAWAY ✨', iconURL: author.displayAvatarURL({ dynamic: true }) })
            .setTitle('🎁 ' + normalizedPrize)
            .setDescription([
                '> React with 🎉 to enter the grand prize drop!',
                '',
                'Ending: <t:' + endTimestamp + ':R> (<t:' + endTimestamp + ':F>)',
                'Hosted by: <@' + author.id + '>',
                'Lucky winners: ' + winnerCount
            ].join('\n'))
            .setImage(ASSETS.ACTIVE_BANNER)
            .setFooter({ text: 'Hosted by ' + author.tag + ' • Tap 🎉 to enter!', iconURL: client.user.displayAvatarURL({ dynamic: true }) })
            .setTimestamp(endsAt);

        let message;
        try {
            message = await channel.send({ embeds: [embed] });
        } catch (error) {
            console.error('[Giveaway] Message creation failed:', error.message);
            return { success: false, message: '❌ Failed to send the giveaway message. Check Starry’s channel permissions.' };
        }

        try {
            await message.react('🎉');
        } catch (error) {
            try {
                await message.delete('Giveaway setup failed because the entry reaction could not be added.');
                return { success: false, message: '❌ Starry could not add the 🎉 entry reaction, so the incomplete giveaway post was removed.' };
            } catch (cleanupError) {
                return {
                    success: false,
                    message: '❌ Starry could not add the entry reaction or remove the incomplete post. No active record was saved. Ask an administrator to remove message ' +
                        message.id + ' in channel ' + channel.id + '.'
                };
            }
        }

        const record = {
            messageId: message.id,
            channelId: channel.id,
            guildId: channel.guild.id,
            prize: normalizedPrize,
            winners: winnerCount,
            endsAt: endsAt,
            hostId: author.id,
            status: 'active',
            createdAt: Date.now(),
            participantCount: 0,
            winnerIds: [],
            processingResult: null
        };
        try {
            await addGiveawayRecord(record);
        } catch (error) {
            try { await message.delete('Giveaway record persistence failed.'); } catch (_) {}
            console.error('[Giveaway] Could not persist giveaway record:', error.message);
            return { success: false, message: '❌ The giveaway could not be saved. No active giveaway was registered.' };
        }

        return { success: true, message: '✅ Supreme Giveaway launched successfully!', giveaway: record };
    }

    // ==========================================
    // 🔄 2. REROLL WINNER FUNCTION
    // ==========================================
    async function rerollGiveaway(channel, messageId, winnerCount = 1, executor) {
        const lockKey = String(channel.guild.id) + ':' + String(messageId);
        if (rerollLocks.has(lockKey)) return '❌ This giveaway is already being rerolled. Please retry shortly.';
        rerollLocks.add(lockKey);
        try {
            if (!Number.isInteger(winnerCount) || winnerCount < 1 || winnerCount > 20) {
                return '❌ Winner count must be a whole number from 1 to 20.';
            }
            const record = getGiveaways().find(item =>
                String(item.messageId) === String(messageId) && String(item.guildId) === String(channel.guild.id)
            );
            if (!record) return '❌ This giveaway is not in Starry’s records.';

            const message = await channel.messages.fetch(String(messageId));
            const reaction = message.reactions.cache.get('🎉');
            if (!reaction) return '❌ No 🎉 reactions were found on that giveaway.';
            const validUsers = await fetchHumanParticipants(reaction);
            if (!validUsers.length) return '❌ There are no human participants to reroll.';

            let pending = record.pendingReroll;
            if (!pending) {
                const previousWinnerMentions = message.embeds[0] && message.embeds[0].description
                    ? message.embeds[0].description.match(/<@!?(\d+)>/g) || []
                    : [];
                const previousWinnerIds = Array.isArray(record.winnerIds) && record.winnerIds.length
                    ? record.winnerIds
                    : previousWinnerMentions.map(mention => mention.replace(/<@!?|>/g, '')).filter(id => id !== record.hostId);
                const filteredUsers = validUsers.filter(id => !previousWinnerIds.includes(id));
                const eligibleUsers = filteredUsers.length >= winnerCount ? filteredUsers : [...validUsers];
                const drawLimit = Math.min(winnerCount, eligibleUsers.length);
                const winners = [];
                for (let index = 0; index < drawLimit; index++) {
                    winners.push(eligibleUsers.splice(crypto.randomInt(eligibleUsers.length), 1)[0]);
                }
                if (!winners.length) return '❌ No eligible participants could be selected.';
                const saved = await updateGiveawayRecord(channel.guild.id, String(messageId), current => {
                    if (!current.pendingReroll) {
                        current.pendingReroll = {
                            nonce: crypto.randomBytes(12).toString('hex'),
                            winnerIds: winners,
                            winnerCount,
                            executorId: String(executor.id),
                            createdAt: Date.now()
                        };
                    }
                });
                pending = saved && saved.pendingReroll;
            }
            if (!pending || !Array.isArray(pending.winnerIds) || !pending.winnerIds.length) {
                return '❌ The saved reroll result is unavailable. Please contact support.';
            }

            const winners = pending.winnerIds;
            const winnersText = winners.map(id => '<@' + id + '>').join(', ');
            const marker = '\u2063starry-reroll:' + pending.nonce + '\u2063';
            const rerollEmbed = new EmbedBuilder()
                .setColor('#00F5D4')
                .setAuthor({ name: '🔄 GIVEAWAY WINNER REROLLED 🔄' })
                .setTitle(message.embeds[0] && message.embeds[0].title || '🎁 Prize Reroll')
                .setDescription([
                    '> A new winner has been selected by request!',
                    '',
                    '🥳 **New Winner(s):** ' + winnersText,
                    '👑 **Rerolled By:** <@' + pending.executorId + '>',
                    '',
                    '*“Here’s to the new champion!”* 🥂'
                ].join('\n'))
                .setImage(ASSETS.WINNER_BANNER)
                .setFooter({ text: 'Reroll Complete • Winner Verified', iconURL: client.user.displayAvatarURL({ dynamic: true }) })
                .setTimestamp();

            const recentMessages = await channel.messages.fetch({ limit: 50 });
            const alreadyAnnounced = recentMessages.some(item =>
                item.author && item.author.id === client.user.id &&
                typeof item.content === 'string' && item.content.includes(marker)
            );
            if (!alreadyAnnounced) {
                await channel.send({
                    content: '🎉 **NEW REROLLED WINNER(S):** ' + winnersText + '! Congratulations! 🚀🥂\n' + marker,
                    embeds: [rerollEmbed],
                    allowedMentions: { parse: [], users: winners }
                });
            }

            await updateGiveawayRecord(channel.guild.id, String(messageId), current => {
                if (!current.pendingReroll || current.pendingReroll.nonce !== pending.nonce) return;
                current.winnerIds = winners;
                current.lastRerolledAt = Date.now();
                current.rerollCount = Number(current.rerollCount || 0) + 1;
                current.rerollHistory = Array.isArray(current.rerollHistory) ? current.rerollHistory : [];
                current.rerollHistory.push({ nonce: pending.nonce, winnerIds: winners, at: Date.now() });
                delete current.pendingReroll;
            });
            return '✅ Winner rerolled successfully!';
        } catch (error) {
            console.error('Giveaway reroll failed:', error.message);
            return '❌ Could not publish the saved reroll result right now. Retry to publish the same selected winner(s).';
        } finally {
            rerollLocks.delete(lockKey);
        }
    }

    // One serialized JSON-backed service facade is shared by Discord and the dashboard.
    client.starryGiveawayEngine = {
        list: async guildId => getGiveaways()
            .filter(item => String(item.guildId) === String(guildId))
            .map(item => ({
                messageId: item.messageId,
                channelId: item.channelId,
                guildId: item.guildId,
                prize: item.prize,
                winners: item.winners,
                endsAt: item.endsAt,
                hostId: item.hostId,
                status: item.status || (Number(item.endsAt) > Date.now() ? 'active' : 'processing'),
                participantCount: Number(item.participantCount || 0),
                winnerIds: item.winnerIds || [],
                createdAt: item.createdAt || null,
                completedAt: item.completedAt || null
            })),
        create: async (channel, author, duration, winnerCount, prize) => {
            const result = await startGiveaway(channel, author, duration, winnerCount, prize);
            if (!result.success) throw new Error(result.message);
            return { message: result.message, giveaway: result.giveaway };
        },
        find: (guildId, messageId) => {
            const record = getGiveaways().find(item =>
                String(item.guildId) === String(guildId) && String(item.messageId) === String(messageId)
            );
            return record ? JSON.parse(JSON.stringify(record)) : null;
        },
        end: async (guildId, messageId) => {
            const updated = await updateGiveawayRecord(guildId, messageId, current => {
                if (current.status === 'completed' || current.status === 'failed') return;
                current.endsAt = Date.now();
                if (current.status !== 'processing') current.status = 'active';
            });
            if (!updated) throw new Error('Giveaway does not exist in this server.');
            if (updated.status === 'completed' || updated.status === 'failed') {
                throw new Error('This giveaway has already ended.');
            }
            await checkGiveaways(String(messageId));
            const result = client.starryGiveawayEngine.find(guildId, messageId);
            return {
                success: result && result.status === 'completed',
                pending: Boolean(result && result.status !== 'completed' && result.status !== 'failed'),
                giveaway: result
            };
        },
        reroll: async (guildId, messageId, winnerCount, executor) => {
            const record = client.starryGiveawayEngine.find(guildId, messageId);
            if (!record) throw new Error('Giveaway does not exist in this server.');
            const guild = client.guilds.cache.get(String(guildId));
            const channel = guild && guild.channels.cache.get(record.channelId);
            if (!channel) throw new Error('The giveaway channel is unavailable.');
            const response = await rerollGiveaway(channel, String(messageId), winnerCount || record.winners || 1, executor);
            if (String(response).startsWith('❌')) throw new Error(String(response).replace(/\*\*/g, ''));
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
            await interaction.editReply({ content: response.message }).catch(() => {});
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
            if (!response.success) {
                await message.reply(response.message).catch(() => {});
            } else {
                await message.delete().catch(() => {});
            }
        }
    });

    // ==========================================
    // 🏁 3. CONCLUDED GIVEAWAY AUTOMATION ENGINE
    // ==========================================
    async function processDueGiveaway(snapshot) {
        const guild = client.guilds.cache.get(String(snapshot.guildId));
        if (!guild) throw new Error('Giveaway guild is temporarily unavailable to Starry; retrying.');

        const channel = guild.channels.cache.get(String(snapshot.channelId)) ||
            await guild.channels.fetch(String(snapshot.channelId)).catch(error => {
                if (isDiscordNotFound(error, 10003)) return null;
                throw error;
            });
        if (!channel) {
            await updateGiveawayRecord(snapshot.guildId, snapshot.messageId, current => {
                current.status = 'failed';
                current.completedAt = Date.now();
                current.failureReason = 'Giveaway channel no longer exists.';
            });
            return;
        }

        const message = await channel.messages.fetch(String(snapshot.messageId)).catch(error => {
            if (isDiscordNotFound(error, 10008)) return null;
            throw error;
        });
        if (!message) {
            await updateGiveawayRecord(snapshot.guildId, snapshot.messageId, current => {
                current.status = 'failed';
                current.completedAt = Date.now();
                current.failureReason = 'Giveaway message no longer exists.';
            });
            return;
        }

        let record = client.starryGiveawayEngine.find(snapshot.guildId, snapshot.messageId);
        if (!record || record.status === 'completed' || record.status === 'failed') return;

        if (!record.processingResult) {
            const reaction = message.reactions.cache.get('🎉');
            // Provider/API failures must retry, not masquerade as a zero-entry giveaway.
            const participants = reaction ? await fetchHumanParticipants(reaction) : [];
            const pool = [...participants];
            const requestedWinners = Math.max(1, Number(record.winners) || 1);
            const drawLimit = Math.min(requestedWinners, pool.length);
            const winnerIds = [];
            for (let index = 0; index < drawLimit; index++) {
                winnerIds.push(pool.splice(crypto.randomInt(pool.length), 1)[0]);
            }

            const draw = {
                nonce: crypto.randomBytes(12).toString('hex'),
                participantCount: participants.length,
                winnerIds,
                noParticipants: participants.length === 0,
                messageEdited: false,
                announcementSent: false,
                createdAt: Date.now()
            };
            record = await updateGiveawayRecord(snapshot.guildId, snapshot.messageId, current => {
                if (!current.processingResult) {
                    current.status = 'processing';
                    current.participantCount = draw.participantCount;
                    current.processingResult = draw;
                }
            });
            if (!record) throw new Error('Could not persist the giveaway result; retrying.');
        }

        const result = record.processingResult;
        if (!result || !result.nonce) throw new Error('The persisted giveaway result is invalid; retrying.');
        const winnersText = result.winnerIds.map(id => '<@' + id + '>').join(', ');
        let finalEmbed;
        let announcementContent;

        if (result.noParticipants) {
            finalEmbed = new EmbedBuilder()
                .setColor('#ED4245')
                .setAuthor({ name: '❌ GIVEAWAY EXPIRED' })
                .setTitle('🎁 ' + record.prize)
                .setDescription('Nobody entered this giveaway.\n\n👑 **Host:** <@' + record.hostId + '>')
                .setFooter({ text: 'Giveaway Ended • No Participants' })
                .setTimestamp();
            announcementContent = '📢 The giveaway for **' + record.prize + '** ended, but nobody entered!';
        } else {
            finalEmbed = new EmbedBuilder()
                .setColor('#00F5D4')
                .setAuthor({ name: '🥂 GRAND GIVEAWAY CONCLUDED 🥂' })
                .setTitle('🏆 ' + record.prize)
                .setDescription('🥳 **Winner(s):** ' + winnersText + '\n👑 **Host:** <@' + record.hostId + '>')
                .setImage(ASSETS.WINNER_BANNER)
                .setFooter({ text: 'Giveaway Ended • Winner Selected', iconURL: client.user.displayAvatarURL({ dynamic: true }) })
                .setTimestamp();
            announcementContent = '🎉 **CONGRATULATIONS** ' + winnersText + '! You won **' + record.prize + '**!';
        }

        if (result.messageEdited !== true) {
            await message.edit({ embeds: [finalEmbed] });
            record = await updateGiveawayRecord(snapshot.guildId, snapshot.messageId, current => {
                if (current.processingResult && current.processingResult.nonce === result.nonce) {
                    current.processingResult.messageEdited = true;
                }
            });
            if (!record) throw new Error('Could not persist giveaway publication progress; retrying.');
        }

        if (!record.processingResult || record.processingResult.announcementSent !== true) {
            const marker = '\u2063starry-giveaway:' + result.nonce + '\u2063';
            const recentMessages = await channel.messages.fetch({ limit: 100 });
            const alreadyAnnounced = recentMessages.some(item =>
                item.author && item.author.id === client.user.id &&
                typeof item.content === 'string' && item.content.includes(marker)
            );
            if (!alreadyAnnounced) {
                await channel.send({
                    content: announcementContent + '\n' + marker,
                    allowedMentions: { parse: [], users: result.winnerIds }
                });
            }
            record = await updateGiveawayRecord(snapshot.guildId, snapshot.messageId, current => {
                if (current.processingResult && current.processingResult.nonce === result.nonce) {
                    current.processingResult.announcementSent = true;
                }
            });
            if (!record) throw new Error('Could not persist giveaway announcement progress; retrying.');
        }

        await updateGiveawayRecord(snapshot.guildId, snapshot.messageId, current => {
            if (!current.processingResult ||
                current.processingResult.nonce !== result.nonce ||
                current.processingResult.messageEdited !== true ||
                current.processingResult.announcementSent !== true) return;
            current.status = 'completed';
            current.completedAt = Date.now();
            current.participantCount = result.participantCount;
            current.winnerIds = result.winnerIds;
            current.completionNonce = result.nonce;
            delete current.processingResult;
            delete current.failureReason;
            delete current.lastProcessingError;
        });
    }

    async function checkGiveaways(targetMessageId = null) {
        if (giveawayCheckPromise) {
            await giveawayCheckPromise;
            if (targetMessageId) return checkGiveaways(targetMessageId);
            return;
        }

        const run = (async () => {
            const due = getGiveaways().filter(item =>
                item.status !== 'completed' &&
                item.status !== 'failed' &&
                Number(item.endsAt) <= Date.now() &&
                (!targetMessageId || String(item.messageId) === String(targetMessageId))
            );

            for (const snapshot of due) {
                await updateGiveawayRecord(snapshot.guildId, snapshot.messageId, current => {
                    if (current.status !== 'completed' && current.status !== 'failed') {
                        current.status = 'processing';
                        current.lastProcessingAttemptAt = Date.now();
                    }
                });
                try {
                    await processDueGiveaway(snapshot);
                } catch (error) {
                    console.error('[Giveaway] Processing will retry:', error.message);
                    await updateGiveawayRecord(snapshot.guildId, snapshot.messageId, current => {
                        if (current.status !== 'completed' && current.status !== 'failed') {
                            current.status = 'processing';
                            current.lastProcessingError = String(error.message || 'Temporary Discord operation failed').slice(0, 300);
                            current.lastProcessingAttemptAt = Date.now();
                        }
                    });
                }
            }
        })();

        giveawayCheckPromise = run;
        try {
            await run;
        } finally {
            if (giveawayCheckPromise === run) giveawayCheckPromise = null;
        }
    }
};
