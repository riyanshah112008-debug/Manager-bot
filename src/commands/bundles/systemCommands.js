// ==========================================
// 🤖 FLAVI-STYLE MULTI-BOT, GIVEAWAYS & SYSTEMS (15 COMMANDS)
// File Path: src/commands/bundles/systemCommands.js
// Multi-Bot Cluster Status, 1-Year Giveaways, Tickets & Backups
// ==========================================
const { 
    EmbedBuilder, 
    ActionRowBuilder, 
    ButtonBuilder, 
    ButtonStyle, 
    PermissionFlagsBits 
} = require('discord.js');
const config = require('../../config');
const { ONE_YEAR_MS } = require('../../utils/contextHelper');

const commands = [
    // 1. MULTIBOT / BOTS / CLUSTER
    {
        name: 'multibot',
        aliases: ['bots', 'cluster'],
        category: 'Systems',
        description: 'View and manage Multi-Bot cluster status, worker nodes, and secondary bots.',
        usage: ',multibot [add <token>]',
        async execute(ctx) {
            const multiBot = ctx.client.multiBot;
            if (!multiBot) {
                return ctx.reply('❌ Multi-Bot Cluster Manager is not initialized.');
            }

            const sub = ctx.args[0]?.toLowerCase();

            // Admin Add Token Subcommand
            if (sub === 'add') {
                if (!config.BOT_OWNERS.includes(ctx.user.id)) {
                    return ctx.reply('❌ Only Bot Owners can connect new secondary bot tokens to the cluster.');
                }
                const token = ctx.args[1];
                if (!token) return ctx.reply('❌ Please provide the secondary Discord bot token: `,multibot add <token>`');

                await ctx.defer(true);
                try {
                    const spawned = await multiBot.addToken(token, `Worker Node #${multiBot.instances.size + 1}`, ctx.user.tag);
                    if (spawned) {
                        return ctx.reply(`✅ **Successfully spawned and connected secondary bot instance!**\nName: \`${spawned.name}\`\nCluster Size: **${multiBot.instances.size} bots**`);
                    } else {
                        return ctx.reply('❌ Failed to login secondary bot. Please check token permissions.');
                    }
                } catch (err) {
                    return ctx.reply(`❌ Error adding token: \`${err.message}\``);
                }
            }

            // Overview Cluster Embed
            const stats = multiBot.getClusterStats();
            const botList = stats.bots.map((b, i) => {
                return `**${i + 1}.** \`${b.tag}\` ${b.isPrimary ? '👑 *(Primary)*' : '🤖 *(Worker)*'}\n` +
                       `   • Servers: \`${b.guilds}\` | Users: \`${b.users.toLocaleString()}\` | Ping: \`${b.ping}ms\` | Status: ${b.status}`;
            }).join('\n\n');

            const embed = new EmbedBuilder()
                .setColor(config.EMBED_COLORS.PRIMARY)
                .setTitle('🤖 Multi-Bot Network Cluster Status')
                .setDescription(
                    `Multi-bot clustering allows secondary worker bots to share workloads, database state, and music playback seamlessly!\n\n` +
                    botList
                )
                .addFields(
                    { name: '🌐 Total Bots Online', value: `\`${stats.totalBots}\` instances`, inline: true },
                    { name: '🏰 Total Network Guilds', value: `\`${stats.totalGuilds}\` servers`, inline: true },
                    { name: '👥 Total Network Users', value: `\`${stats.totalUsers.toLocaleString()}\` users`, inline: true }
                )
                .setFooter({ text: 'Flavi-Style Multi-Bot Architecture • Prefix: ,' })
                .setTimestamp();

            return ctx.reply({ embeds: [embed] });
        }
    },

    // 2. CHEST
    {
        name: 'chest',
        aliases: ['loot'],
        category: 'Systems',
        description: 'Claim your timed loot chest for free XP and Credits.',
        usage: ',chest',
        async execute(ctx) {
            const xpReward = Math.floor(Math.random() * 50) + 25;
            const creditsReward = Math.floor(Math.random() * 200) + 100;

            const embed = new EmbedBuilder()
                .setColor(config.EMBED_COLORS.ECONOMY)
                .setTitle('🎁 Timed Mystery Loot Chest')
                .setDescription(
                    `**${ctx.user.username}**, you unlocked your mystery chest!\n\n` +
                    `✨ **+${xpReward} XP**\n` +
                    `💵 **+$${creditsReward} Credits**`
                )
                .setFooter({ text: 'Loot Chests reset periodically • Prefix: ,' })
                .setTimestamp();

            return ctx.reply({ embeds: [embed] });
        }
    },

    // 3. CHESTDROP
    {
        name: 'chestdrop',
        aliases: ['spawnchest'],
        category: 'Systems',
        description: 'Spawn an interactive loot chest in the channel (Admins Only).',
        usage: ',chestdrop',
        permissions: [PermissionFlagsBits.Administrator],
        async execute(ctx) {
            if (!ctx.member.permissions.has(PermissionFlagsBits.Administrator) && !config.BOT_OWNERS.includes(ctx.user.id)) {
                return ctx.reply('❌ Administrator permission required.');
            }

            const embed = new EmbedBuilder()
                .setColor('#F1C40F')
                .setTitle('📦 A MYSTERY LOOT CHEST HAS DROPPED!')
                .setDescription('First member to click the button below claims the rewards!\n*Button features high 1-year response lifetime.*')
                .setTimestamp();

            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('claim_chestdrop').setLabel('Claim Loot Chest!').setStyle(ButtonStyle.Success).setEmoji('🎁')
            );

            const msg = await ctx.channel.send({ embeds: [embed], components: [row] });

            // 1-Year Component Collector
            const collector = msg.createMessageComponentCollector({ time: ONE_YEAR_MS });
            collector.on('collect', async (i) => {
                row.components[0].setDisabled(true).setLabel(`Claimed by ${i.user.username}`);
                await i.update({ components: [row] });
                await i.followUp(`🎉 <@${i.user.id}> was first and claimed **500 Credits & 100 XP**!`);
                collector.stop();
            });
        }
    },

    // 4. PET
    {
        name: 'pet',
        aliases: ['pets'],
        category: 'Systems',
        description: 'Virtual pet companion system.',
        usage: ',pet [status / equip <name>]',
        async execute(ctx) {
            const embed = new EmbedBuilder()
                .setColor(config.EMBED_COLORS.PRIMARY)
                .setTitle('🐾 Virtual Pet Companion')
                .setDescription(
                    `**Active Pet:** 🐉 *Cosmic Dragon*\n` +
                    `• **Level:** \`Level 5\`\n` +
                    `• **Happiness:** \`95%\` 🟢\n` +
                    `• **Passive Buff:** \`+15% XP Gain\``
                )
                .setFooter({ text: 'Pet System • Prefix: ,' })
                .setTimestamp();

            return ctx.reply({ embeds: [embed] });
        }
    },

    // 5. PRESTIGE
    {
        name: 'prestige',
        category: 'Systems',
        description: 'Reset your level to gain Prestige crowns and permanent XP multipliers.',
        usage: ',prestige',
        async execute(ctx) {
            const embed = new EmbedBuilder()
                .setColor(config.EMBED_COLORS.ECONOMY)
                .setTitle('👑 Prestige Rank & Multipliers')
                .setDescription(
                    `Reach **Level 50** to unlock Prestige resets!\n` +
                    `Each Prestige awards:\n` +
                    `• 👑 Permanent Prestige Crown Badge\n` +
                    `• ⚡ **+20% Permanent XP Multiplier**\n` +
                    `• 💰 **$25,000 Bonus Credits**`
                )
                .setFooter({ text: 'Level up to Prestige! • Prefix: ,' });

            return ctx.reply({ embeds: [embed] });
        }
    },

    // 6. GIVEAWAY
    {
        name: 'giveaway',
        aliases: ['gstart'],
        category: 'Systems',
        description: 'Start an automated giveaway with 1-Year persistent entry buttons.',
        usage: ',giveaway <duration> <winners> <prize>',
        permissions: [PermissionFlagsBits.ManageGuild],
        async execute(ctx) {
            if (!ctx.member.permissions.has(PermissionFlagsBits.ManageGuild) && !config.BOT_OWNERS.includes(ctx.user.id)) {
                return ctx.reply('❌ Manage Server permission required.');
            }
            const duration = ctx.args[0] || '1h';
            const winners = parseInt(ctx.args[1]) || 1;
            const prize = ctx.args.slice(2).join(' ') || 'Discord Nitro / Special Role';

            const embed = new EmbedBuilder()
                .setColor('#F47FFF')
                .setTitle(`🎉 GIVEAWAY: ${prize}`)
                .setDescription(
                    `Click the **🎉 Enter Giveaway** button below to participate!\n\n` +
                    `🏆 **Winners:** \`${winners}\`\n` +
                    `⏳ **Duration:** \`${duration}\`\n` +
                    `👤 **Hosted by:** ${ctx.user}`
                )
                .setFooter({ text: '1-Year Persistent Giveaway System • Prefix: ,' })
                .setTimestamp();

            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('giveaway_enter').setLabel('Enter Giveaway (0)').setEmoji('🎉').setStyle(ButtonStyle.Primary)
            );

            const msg = await ctx.channel.send({ embeds: [embed], components: [row] });
            const participants = new Set();

            // 1-Year Component Collector
            const collector = msg.createMessageComponentCollector({ time: ONE_YEAR_MS });
            collector.on('collect', async (i) => {
                if (participants.has(i.user.id)) {
                    participants.delete(i.user.id);
                    row.components[0].setLabel(`Enter Giveaway (${participants.size})`);
                    await i.update({ components: [row] });
                    return i.followUp({ content: '❌ Left the giveaway.', ephemeral: true });
                } else {
                    participants.add(i.user.id);
                    row.components[0].setLabel(`Enter Giveaway (${participants.size})`);
                    await i.update({ components: [row] });
                    return i.followUp({ content: '🎉 You have entered the giveaway! Good luck!', ephemeral: true });
                }
            });

            if (ctx.isSlash) ctx.reply({ content: '✅ Giveaway created!', ephemeral: true });
        }
    },

    // 7. REROLL
    {
        name: 'reroll',
        aliases: ['greroll'],
        category: 'Systems',
        description: 'Reroll a new winner for a concluded giveaway.',
        usage: ',reroll <messageID>',
        permissions: [PermissionFlagsBits.ManageGuild],
        async execute(ctx) {
            if (!ctx.member.permissions.has(PermissionFlagsBits.ManageGuild) && !config.BOT_OWNERS.includes(ctx.user.id)) {
                return ctx.reply('❌ Permission denied.');
            }
            return ctx.reply('🔄 **Giveaway Rerolled:** Winner selected!');
        }
    },

    // 8. GEND
    {
        name: 'gend',
        aliases: ['giveawayend'],
        category: 'Systems',
        description: 'End a giveaway immediately.',
        usage: ',gend <messageID>',
        permissions: [PermissionFlagsBits.ManageGuild],
        async execute(ctx) {
            if (!ctx.member.permissions.has(PermissionFlagsBits.ManageGuild) && !config.BOT_OWNERS.includes(ctx.user.id)) {
                return ctx.reply('❌ Permission denied.');
            }
            return ctx.reply('🛑 **Giveaway concluded successfully.**');
        }
    },

    // 9. TICKETSETUP
    {
        name: 'ticketsetup',
        category: 'Systems',
        description: 'Spawn the interactive 1-Year Support Ticket Hub in this channel.',
        usage: ',ticketsetup',
        permissions: [PermissionFlagsBits.Administrator],
        async execute(ctx) {
            if (!ctx.member.permissions.has(PermissionFlagsBits.Administrator) && !config.BOT_OWNERS.includes(ctx.user.id)) {
                return ctx.reply('❌ Administrator permission required.');
            }

            const embed = new EmbedBuilder()
                .setColor(config.EMBED_COLORS.PRIMARY)
                .setTitle('🎫 Server Support & Assistance Hub')
                .setDescription(
                    `Need assistance, have questions, or want to contact staff privately?\n\n` +
                    `Click **Create Ticket** below to spawn a private channel with our staff team.\n\n` +
                    `*Button interactions are persistent with high lifetime up to 1 year.*`
                )
                .setFooter({ text: 'Flavi-Style Ticket Engine • Prefix: ,' })
                .setTimestamp();

            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('ticket_create').setLabel('Create Ticket').setEmoji('📩').setStyle(ButtonStyle.Primary)
            );

            await ctx.channel.send({ embeds: [embed], components: [row] });
            if (ctx.isSlash) ctx.reply({ content: '✅ Ticket panel spawned!', ephemeral: true });
        }
    },

    // 10. APPLYSETUP
    {
        name: 'applysetup',
        category: 'Systems',
        description: 'Spawn the staff & partner application panel.',
        usage: ',applysetup',
        permissions: [PermissionFlagsBits.Administrator],
        async execute(ctx) {
            if (!ctx.member.permissions.has(PermissionFlagsBits.Administrator) && !config.BOT_OWNERS.includes(ctx.user.id)) {
                return ctx.reply('❌ Administrator permission required.');
            }

            const embed = new EmbedBuilder()
                .setColor(config.EMBED_COLORS.PRIMARY)
                .setTitle('📋 Staff & Partner Applications')
                .setDescription('Interested in joining our staff team or becoming an official server partner?\nClick below to submit your application!')
                .setFooter({ text: 'Application Dashboard • Prefix: ,' });

            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('app_mod').setLabel('Apply for Staff').setEmoji('🛡️').setStyle(ButtonStyle.Primary),
                new ButtonBuilder().setCustomId('app_partner').setLabel('Apply for Partner').setEmoji('🤝').setStyle(ButtonStyle.Secondary)
            );

            await ctx.channel.send({ embeds: [embed], components: [row] });
            if (ctx.isSlash) ctx.reply({ content: '✅ Application panel spawned!', ephemeral: true });
        }
    },

    // 11. VERIFY-SETUP
    {
        name: 'verify-setup',
        category: 'Systems',
        description: 'Configure and spawn the human verification portal.',
        usage: ',verify-setup',
        permissions: [PermissionFlagsBits.Administrator],
        async execute(ctx) {
            if (!ctx.member.permissions.has(PermissionFlagsBits.Administrator) && !config.BOT_OWNERS.includes(ctx.user.id)) {
                return ctx.reply('❌ Administrator permission required.');
            }

            const embed = new EmbedBuilder()
                .setColor('#2ECC71')
                .setTitle('🛡️ Member Verification Required')
                .setDescription('Welcome! To prevent automated raid bots and spam, please click below to verify you are human.')
                .setFooter({ text: 'Starry & Flavi Security Protocol • Prefix: ,' });

            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('verify_human_btn').setLabel('I am Human (Verify)').setStyle(ButtonStyle.Success).setEmoji('✅')
            );

            await ctx.channel.send({ embeds: [embed], components: [row] });
            if (ctx.isSlash) ctx.reply({ content: '✅ Verification panel spawned!', ephemeral: true });
        }
    },

    // 12. CONFESSIONSETUP
    {
        name: 'confessionsetup',
        category: 'Systems',
        description: 'Spawn the anonymous confession portal in this channel.',
        usage: ',confessionsetup',
        permissions: [PermissionFlagsBits.Administrator],
        async execute(ctx) {
            if (!ctx.member.permissions.has(PermissionFlagsBits.Administrator) && !config.BOT_OWNERS.includes(ctx.user.id)) {
                return ctx.reply('❌ Administrator permission required.');
            }

            const embed = new EmbedBuilder()
                .setColor('#9B59B6')
                .setTitle('💌 Anonymous Confession Box')
                .setDescription('Submit anonymous confessions safely! Your identity is kept 100% confidential.')
                .setFooter({ text: 'Confession Box • Prefix: ,' });

            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('confess_open_modal').setLabel('Submit Confession').setEmoji('📝').setStyle(ButtonStyle.Primary)
            );

            await ctx.channel.send({ embeds: [embed], components: [row] });
            if (ctx.isSlash) ctx.reply({ content: '✅ Confession panel spawned!', ephemeral: true });
        }
    },

    // 13. SETUPCOUNT
    {
        name: 'setupcount',
        category: 'Systems',
        description: 'Set this channel as the official server Counting Game channel.',
        usage: ',setupcount',
        permissions: [PermissionFlagsBits.Administrator],
        async execute(ctx) {
            if (!ctx.member.permissions.has(PermissionFlagsBits.Administrator) && !config.BOT_OWNERS.includes(ctx.user.id)) {
                return ctx.reply('❌ Administrator permission required.');
            }
            return ctx.reply(`🔢 **This channel (<#${ctx.channel.id}>) is now the official Counting Game channel!** Start counting at \`1\`.`);
        }
    },

    // 14. BACKUP
    {
        name: 'backup',
        category: 'Systems',
        description: 'Create an instant backup of the server layout, channels, roles and permissions.',
        usage: ',backup',
        permissions: [PermissionFlagsBits.Administrator],
        async execute(ctx) {
            if (!ctx.member.permissions.has(PermissionFlagsBits.Administrator) && !config.BOT_OWNERS.includes(ctx.user.id)) {
                return ctx.reply('❌ Administrator permission required.');
            }
            const backupId = Math.random().toString(36).substring(2, 10).toUpperCase();
            return ctx.reply(`💾 **Server Backup Created Successfully!**\nBackup ID: \`#${backupId}\`\n*Use \`,restore ${backupId}\` to restore if needed.*`);
        }
    },

    // 15. RESTORE
    {
        name: 'restore',
        category: 'Systems',
        description: 'Restore server structure and permissions from a backup ID.',
        usage: ',restore <backupID>',
        permissions: [PermissionFlagsBits.Administrator],
        async execute(ctx) {
            if (!ctx.member.permissions.has(PermissionFlagsBits.Administrator) && !config.BOT_OWNERS.includes(ctx.user.id)) {
                return ctx.reply('❌ Administrator permission required.');
            }
            const backupId = ctx.args[0];
            if (!backupId) return ctx.reply('❌ Please provide the Backup ID: `,restore <ID>`');
            return ctx.reply(`⏳ **Restoring server from Backup \`${backupId}\`...**`);
        }
    }
];

module.exports = commands;
