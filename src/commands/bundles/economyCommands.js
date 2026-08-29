// ==========================================
// 💰 FLAVI-STYLE SUPREME ECONOMY & LEVELING SUITE (16 COMMANDS)
// File Path: src/commands/bundles/economyCommands.js
// XP Cards, Casino Slots, Banking & 1-Year Interactive Shop
// ==========================================
const { 
    EmbedBuilder, 
    ActionRowBuilder, 
    ButtonBuilder, 
    ButtonStyle, 
    PermissionFlagsBits 
} = require('discord.js');
const mongoose = require('mongoose');
const config = require('../../config');
const { ONE_YEAR_MS } = require('../../utils/contextHelper');

// Economy schema definition / model loader
const economySchema = new mongoose.Schema({
    userId: { type: String, required: true },
    guildId: { type: String, required: true },
    wallet: { type: Number, default: 100 },
    bank: { type: Number, default: 0 },
    xp: { type: Number, default: 0 },
    level: { type: Number, default: 1 },
    lastDaily: { type: Date, default: null },
    lastWeekly: { type: Date, default: null },
    lastWork: { type: Date, default: null },
    lastRob: { type: Date, default: null }
});
economySchema.index({ userId: 1, guildId: 1 }, { unique: true });

const EcoUser = mongoose.models.EcoUser || mongoose.model('EcoUser', economySchema);

async function getOrCreateEcoUser(userId, guildId) {
    let doc = await EcoUser.findOne({ userId, guildId });
    if (!doc) {
        doc = await EcoUser.create({ userId, guildId, wallet: 100, bank: 0, xp: 0, level: 1 });
    }
    return doc;
}

const commands = [
    // 1. RANK / LEVEL
    {
        name: 'rank',
        aliases: ['level', 'lvl'],
        category: 'Economy',
        description: 'Check your current level, XP, and rank progress.',
        usage: ',rank [@user]',
        async execute(ctx) {
            const target = ctx.message?.mentions?.users?.first() || ctx.user;
            const doc = await getOrCreateEcoUser(target.id, ctx.guild.id);
            const neededXp = doc.level * 100;

            const embed = new EmbedBuilder()
                .setColor(config.EMBED_COLORS.PRIMARY)
                .setAuthor({ name: `${target.username}'s Rank & Level`, iconURL: target.displayAvatarURL({ dynamic: true }) })
                .setThumbnail(target.displayAvatarURL({ dynamic: true, size: 256 }))
                .addFields(
                    { name: '👑 Level', value: `\`Level ${doc.level}\``, inline: true },
                    { name: '✨ XP Progress', value: `\`${doc.xp} / ${neededXp} XP\``, inline: true },
                    { name: '💰 Net Worth', value: `\`$${(doc.wallet + doc.bank).toLocaleString()}\``, inline: true }
                )
                .setFooter({ text: 'Flavi Leveling Engine • Prefix: ,' })
                .setTimestamp();

            return ctx.reply({ embeds: [embed] });
        }
    },

    // 2. LEADERBOARD
    {
        name: 'leaderboard',
        aliases: ['lb', 'top'],
        category: 'Economy',
        description: 'View top server members by level and wealth.',
        usage: ',leaderboard [xp / money]',
        async execute(ctx) {
            const type = ctx.args[0]?.toLowerCase() === 'money' ? 'wallet' : 'xp';
            const top = await EcoUser.find({ guildId: ctx.guild.id }).sort({ [type]: -1 }).limit(10).lean();

            if (top.length === 0) return ctx.reply('📭 Leaderboard is empty for this server.');

            const list = top.map((u, i) => {
                const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `\`#${i + 1}\``;
                return `${medal} <@${u.userId}> — **Level ${u.level}** (\`${u.xp} XP\`) | **$${(u.wallet + u.bank).toLocaleString()}**`;
            }).join('\n');

            const embed = new EmbedBuilder()
                .setColor(config.EMBED_COLORS.ECONOMY)
                .setTitle(`🏆 ${ctx.guild.name} Top Leaderboard`)
                .setDescription(list)
                .setFooter({ text: 'Rankings update in real-time • Prefix: ,' })
                .setTimestamp();

            return ctx.reply({ embeds: [embed] });
        }
    },

    // 3. SETLEVEL
    {
        name: 'setlevel',
        aliases: ['givexp'],
        category: 'Economy',
        description: 'Set a user\'s level or add XP (Admins Only).',
        usage: ',setlevel <@user> <level number>',
        permissions: [PermissionFlagsBits.Administrator],
        async execute(ctx) {
            if (!ctx.member.permissions.has(PermissionFlagsBits.Administrator) && !config.BOT_OWNERS.includes(ctx.user.id)) {
                return ctx.reply('❌ Administrator permission required.');
            }
            const target = ctx.message?.mentions?.users?.first();
            const level = parseInt(ctx.args[1]);
            if (!target || isNaN(level) || level < 1) {
                return ctx.reply('❌ Usage: `,setlevel @user <level>`');
            }
            await EcoUser.updateOne({ userId: target.id, guildId: ctx.guild.id }, { level, xp: 0 }, { upsert: true });
            return ctx.reply(`✅ **Set ${target.username}'s level to Level ${level}!**`);
        }
    },

    // 4. BALANCE
    {
        name: 'balance',
        aliases: ['bal', 'coins', 'money', 'wallet'],
        category: 'Economy',
        description: 'Check your wallet cash and bank balance.',
        usage: ',bal [@user]',
        async execute(ctx) {
            const target = ctx.message?.mentions?.users?.first() || ctx.user;
            const doc = await getOrCreateEcoUser(target.id, ctx.guild.id);

            const embed = new EmbedBuilder()
                .setColor(config.EMBED_COLORS.ECONOMY)
                .setAuthor({ name: `${target.username}'s Financial Balance`, iconURL: target.displayAvatarURL({ dynamic: true }) })
                .addFields(
                    { name: '💵 Wallet', value: `\`$${doc.wallet.toLocaleString()}\``, inline: true },
                    { name: '🏦 Bank', value: `\`$${doc.bank.toLocaleString()}\``, inline: true },
                    { name: '💎 Net Worth', value: `\`$${(doc.wallet + doc.bank).toLocaleString()}\``, inline: true }
                )
                .setFooter({ text: 'Flavi Banking System • Prefix: ,' })
                .setTimestamp();

            return ctx.reply({ embeds: [embed] });
        }
    },

    // 5. DAILY
    {
        name: 'daily',
        category: 'Economy',
        description: 'Claim your daily credit reward ($500).',
        usage: ',daily',
        async execute(ctx) {
            const doc = await getOrCreateEcoUser(ctx.user.id, ctx.guild.id);
            const now = new Date();
            const cooldown = 24 * 60 * 60 * 1000;

            if (doc.lastDaily && now - doc.lastDaily < cooldown) {
                const remaining = cooldown - (now - doc.lastDaily);
                const hours = Math.floor(remaining / (3600 * 1000));
                const mins = Math.floor((remaining % (3600 * 1000)) / (60 * 1000));
                return ctx.reply(`⏳ You already claimed your daily reward! Come back in **${hours}h ${mins}m**.`);
            }

            const reward = 500;
            doc.wallet += reward;
            doc.lastDaily = now;
            await doc.save();

            return ctx.reply(`🎁 **Daily Claimed:** You received **$${reward}** credits! New Wallet Balance: \`$${doc.wallet.toLocaleString()}\``);
        }
    },

    // 6. WEEKLY
    {
        name: 'weekly',
        category: 'Economy',
        description: 'Claim your weekly bonus reward ($2,500).',
        usage: ',weekly',
        async execute(ctx) {
            const doc = await getOrCreateEcoUser(ctx.user.id, ctx.guild.id);
            const now = new Date();
            const cooldown = 7 * 24 * 60 * 60 * 1000;

            if (doc.lastWeekly && now - doc.lastWeekly < cooldown) {
                const remaining = cooldown - (now - doc.lastWeekly);
                const days = Math.floor(remaining / (24 * 3600 * 1000));
                return ctx.reply(`⏳ Weekly reward already claimed! Come back in **${days} days**.`);
            }

            const reward = 2500;
            doc.wallet += reward;
            doc.lastWeekly = now;
            await doc.save();

            return ctx.reply(`🎉 **Weekly Bonus:** You received **$${reward.toLocaleString()}** credits!`);
        }
    },

    // 7. WORK
    {
        name: 'work',
        category: 'Economy',
        description: 'Work a random job and earn cash.',
        usage: ',work',
        async execute(ctx) {
            const doc = await getOrCreateEcoUser(ctx.user.id, ctx.guild.id);
            const now = new Date();
            const cooldown = 10 * 60 * 1000; // 10 mins

            if (doc.lastWork && now - doc.lastWork < cooldown) {
                const remaining = cooldown - (now - doc.lastWork);
                const mins = Math.ceil(remaining / 60000);
                return ctx.reply(`⏳ You are tired! Rest for **${mins} minutes** before working again.`);
            }

            const jobs = [
                { job: 'Software Engineer', pay: 250 },
                { job: 'Discord Moderator', pay: 150 },
                { job: 'Music DJ', pay: 200 },
                { job: 'Graphic Designer', pay: 180 },
                { job: 'Coffee Barista', pay: 120 }
            ];
            const choice = jobs[Math.floor(Math.random() * jobs.length)];

            doc.wallet += choice.pay;
            doc.xp += 15;
            doc.lastWork = now;
            await doc.save();

            return ctx.reply(`💼 You worked as a **${choice.job}** and earned **$${choice.pay}** (+15 XP)!`);
        }
    },

    // 8. BEG
    {
        name: 'beg',
        category: 'Economy',
        description: 'Beg for spare coins.',
        usage: ',beg',
        async execute(ctx) {
            const doc = await getOrCreateEcoUser(ctx.user.id, ctx.guild.id);
            const amount = Math.floor(Math.random() * 50) + 10;
            doc.wallet += amount;
            await doc.save();
            return ctx.reply(`🥺 A generous stranger gave you **$${amount}** coins!`);
        }
    },

    // 9. DEPOSIT
    {
        name: 'deposit',
        aliases: ['dep'],
        category: 'Economy',
        description: 'Deposit cash from your wallet into your safe bank.',
        usage: ',deposit <amount / all>',
        async execute(ctx) {
            const doc = await getOrCreateEcoUser(ctx.user.id, ctx.guild.id);
            const arg = ctx.args[0]?.toLowerCase();
            let amount = arg === 'all' || arg === 'max' ? doc.wallet : parseInt(arg);

            if (isNaN(amount) || amount <= 0 || amount > doc.wallet) {
                return ctx.reply(`❌ Invalid deposit amount! You have **$${doc.wallet}** in your wallet.`);
            }

            doc.wallet -= amount;
            doc.bank += amount;
            await doc.save();

            return ctx.reply(`🏦 **Deposited $${amount.toLocaleString()} into your bank.**\nWallet: \`$${doc.wallet.toLocaleString()}\` | Bank: \`$${doc.bank.toLocaleString()}\``);
        }
    },

    // 10. WITHDRAW
    {
        name: 'withdraw',
        aliases: ['with'],
        category: 'Economy',
        description: 'Withdraw cash from your bank into your wallet.',
        usage: ',withdraw <amount / all>',
        async execute(ctx) {
            const doc = await getOrCreateEcoUser(ctx.user.id, ctx.guild.id);
            const arg = ctx.args[0]?.toLowerCase();
            let amount = arg === 'all' || arg === 'max' ? doc.bank : parseInt(arg);

            if (isNaN(amount) || amount <= 0 || amount > doc.bank) {
                return ctx.reply(`❌ Invalid amount! You have **$${doc.bank}** in your bank.`);
            }

            doc.bank -= amount;
            doc.wallet += amount;
            await doc.save();

            return ctx.reply(`💵 **Withdrew $${amount.toLocaleString()} from your bank.**`);
        }
    },

    // 11. PAY / GIVE
    {
        name: 'pay',
        aliases: ['give', 'transfer'],
        category: 'Economy',
        description: 'Transfer credits to another member.',
        usage: ',pay <@user> <amount>',
        async execute(ctx) {
            const target = ctx.message?.mentions?.users?.first();
            const amount = parseInt(ctx.args[1]);

            if (!target || isNaN(amount) || amount <= 0 || target.id === ctx.user.id) {
                return ctx.reply('❌ Usage: `,pay @user <amount>`');
            }

            const sender = await getOrCreateEcoUser(ctx.user.id, ctx.guild.id);
            if (sender.wallet < amount) return ctx.reply(`❌ Insufficient funds! You only have **$${sender.wallet}** in your wallet.`);

            const receiver = await getOrCreateEcoUser(target.id, ctx.guild.id);

            sender.wallet -= amount;
            receiver.wallet += amount;
            await sender.save();
            await receiver.save();

            return ctx.reply(`💸 **Transferred $${amount.toLocaleString()} to ${target.username}!**`);
        }
    },

    // 12. GAMBLE
    {
        name: 'gamble',
        aliases: ['bet'],
        category: 'Economy',
        description: 'Gamble credits with double-or-nothing odds.',
        usage: ',gamble <amount>',
        async execute(ctx) {
            const amount = parseInt(ctx.args[0]);
            const doc = await getOrCreateEcoUser(ctx.user.id, ctx.guild.id);

            if (isNaN(amount) || amount <= 0 || amount > doc.wallet) {
                return ctx.reply(`❌ You can only gamble between $1 and your wallet balance ($${doc.wallet}).`);
            }

            const win = Math.random() >= 0.52; // 48% win chance
            if (win) {
                doc.wallet += amount;
                await doc.save();
                return ctx.reply(`🎉 **YOU WON!** You doubled your bet and received **+$${amount.toLocaleString()}** (New Balance: \`$${doc.wallet.toLocaleString()}\`)`);
            } else {
                doc.wallet -= amount;
                await doc.save();
                return ctx.reply(`💀 **YOU LOST!** You lost **-$${amount.toLocaleString()}**. (New Balance: \`$${doc.wallet.toLocaleString()}\`)`);
            }
        }
    },

    // 13. SLOTS
    {
        name: 'slots',
        category: 'Economy',
        description: 'Play a 3-reel casino slot machine.',
        usage: ',slots <bet amount>',
        async execute(ctx) {
            const bet = parseInt(ctx.args[0]) || 50;
            const doc = await getOrCreateEcoUser(ctx.user.id, ctx.guild.id);

            if (bet <= 0 || bet > doc.wallet) {
                return ctx.reply(`❌ You need **$${bet}** in your wallet to spin the slots!`);
            }

            const items = ['🍒', '🍋', '💎', '7️⃣', '🔔'];
            const r1 = items[Math.floor(Math.random() * items.length)];
            const r2 = items[Math.floor(Math.random() * items.length)];
            const r3 = items[Math.floor(Math.random() * items.length)];

            const winJackpot = r1 === r2 && r2 === r3;
            const winSmall = r1 === r2 || r2 === r3 || r1 === r3;

            let multiplier = 0;
            if (winJackpot) multiplier = r1 === '💎' ? 10 : r1 === '7️⃣' ? 7 : 4;
            else if (winSmall) multiplier = 1.5;

            const payout = Math.floor(bet * multiplier);
            doc.wallet += (payout - bet);
            await doc.save();

            const embed = new EmbedBuilder()
                .setColor(winJackpot ? '#2ECC71' : winSmall ? '#F1C40F' : '#E74C3C')
                .setTitle('🎰 Casino Slot Machine')
                .setDescription(`**[ ${r1} | ${r2} | ${r3} ]**\n\n` + (winJackpot ? `🔥 **JACKPOT!** You won **$${payout.toLocaleString()}** (${multiplier}x)!` : winSmall ? `✨ **MATCH!** You won **$${payout.toLocaleString()}**!` : `❌ No match! You lost **$${bet}**.`))
                .setFooter({ text: `New Balance: $${doc.wallet.toLocaleString()}` });

            return ctx.reply({ embeds: [embed] });
        }
    },

    // 14. ROB
    {
        name: 'rob',
        aliases: ['stealmoney'],
        category: 'Economy',
        description: 'Attempt to pickpocket wallet cash from another member.',
        usage: ',rob <@user>',
        async execute(ctx) {
            const target = ctx.message?.mentions?.users?.first();
            if (!target || target.id === ctx.user.id) return ctx.reply('❌ Specify a user to rob: `,rob @user`');

            const victim = await getOrCreateEcoUser(target.id, ctx.guild.id);
            const robber = await getOrCreateEcoUser(ctx.user.id, ctx.guild.id);

            if (victim.wallet < 100) return ctx.reply('❌ This user is too broke to rob ($100 minimum wallet).');
            if (robber.wallet < 100) return ctx.reply('❌ You need at least $100 in your wallet in case you get caught!');

            const success = Math.random() >= 0.55;
            if (success) {
                const stolen = Math.floor(victim.wallet * (Math.random() * 0.3 + 0.1));
                victim.wallet -= stolen;
                robber.wallet += stolen;
                await victim.save();
                await robber.save();
                return ctx.reply(`🥷 **Heist Successful!** You stole **$${stolen.toLocaleString()}** from ${target.username}!`);
            } else {
                const fine = 100;
                robber.wallet -= fine;
                victim.wallet += fine;
                await robber.save();
                await victim.save();
                return ctx.reply(`🚨 **Busted!** You were caught and paid a **$${fine}** fine to ${target.username}.`);
            }
        }
    },

    // 15. SHOP
    {
        name: 'shop',
        category: 'Economy',
        description: 'Open the server shop with 1-Year interactive buy buttons.',
        usage: ',shop',
        async execute(ctx) {
            const embed = new EmbedBuilder()
                .setColor(config.EMBED_COLORS.ECONOMY)
                .setTitle(`🛍️ ${ctx.guild.name} Official Server Shop`)
                .setDescription('Use your earned credits to purchase exclusive perks and vanity roles!\n*Buttons remain active with 1-Year lifetime.*')
                .addFields(
                    { name: '⭐ VIP Supporter Role', value: 'Cost: **$5,000** credits | Access to VIP voice channels', inline: false },
                    { name: '👑 Server Noble Role', value: 'Cost: **$15,000** credits | Exclusive embed & color perks', inline: false },
                    { name: '🔥 Custom Server Booster Role', value: 'Cost: **$50,000** credits | Top hierarchy vanity color', inline: false }
                )
                .setFooter({ text: 'Use ,buy <item> • Prefix: ,' })
                .setTimestamp();

            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('shop_buy_vip').setLabel('Buy VIP ($5k)').setStyle(ButtonStyle.Success).setEmoji('⭐'),
                new ButtonBuilder().setCustomId('shop_buy_noble').setLabel('Buy Noble ($15k)').setStyle(ButtonStyle.Primary).setEmoji('👑'),
                new ButtonBuilder().setCustomId('shop_buy_booster').setLabel('Buy Booster ($50k)').setStyle(ButtonStyle.Danger).setEmoji('🔥')
            );

            const replyMsg = await ctx.reply({ embeds: [embed], components: [row] });

            // 1-Year Component Collector
            const collector = replyMsg.createMessageComponentCollector({ time: ONE_YEAR_MS });
            collector.on('collect', async (i) => {
                const buyer = await getOrCreateEcoUser(i.user.id, ctx.guild.id);
                let price = 5000;
                let roleName = 'VIP Supporter';

                if (i.customId === 'shop_buy_noble') { price = 15000; roleName = 'Server Noble'; }
                else if (i.customId === 'shop_buy_booster') { price = 50000; roleName = 'Custom Booster'; }

                if (buyer.wallet < price) {
                    return i.reply({ content: `❌ Insufficient wallet funds! You need **$${price.toLocaleString()}** credits.`, ephemeral: true });
                }

                buyer.wallet -= price;
                await buyer.save();
                await i.reply({ content: `🎉 **Purchase Successful!** You bought **${roleName}** for **$${price.toLocaleString()}**!`, ephemeral: true });
            });
        }
    },

    // 16. BUY
    {
        name: 'buy',
        category: 'Economy',
        description: 'Purchase an item from the server shop.',
        usage: ',buy <item name>',
        async execute(ctx) {
            const item = ctx.args.join(' ').toLowerCase();
            if (!item) return ctx.reply('❌ Specify item to buy: `,buy vip` or view `,shop`');
            return ctx.reply(`🛍️ Processing purchase for **${item}**... Use \`,shop\` for instant 1-click buy buttons!`);
        }
    }
];

module.exports = commands;
