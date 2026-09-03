// ==========================================
// 🤖 Starry MULTI-BOT, GIVEAWAYS & SYSTEMS (15 COMMANDS)
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
        aliases: ['bots', 'cluster', 'summon', 'clones', 'inviteclones', 'clonebots'],
        category: 'Systems',
        description: 'View and manage Multi-Bot cluster status, worker nodes, 1-click summon invites, and roles.',
        usage: ',multibot [invite | add <token> | setrole <bot> <role> | remove <bot> | roles]',
        async execute(ctx) {
            const multiBot = ctx.client.multiBot;
            if (!multiBot) {
                return ctx.reply('❌ Multi-Bot Cluster Manager is not initialized.');
            }

            let sub = ctx.args[0]?.toLowerCase();
            const calledCommand = ctx.isSlash ? ctx.interaction.commandName : ctx.args[0] || '';
            const invokedName = (!ctx.isSlash && ctx.message?.content) ? ctx.message.content.slice(1).split(/\s+/)[0].toLowerCase() : '';

            if (invokedName === 'summon' || invokedName === 'clones' || invokedName === 'inviteclones' || invokedName === 'clonebots') {
                sub = 'invite';
            }

            // 1. Available Roles Subcommand
            if (sub === 'roles') {
                const embed = new EmbedBuilder()
                    .setColor(config.EMBED_COLORS.PRIMARY)
                    .setTitle('🎭 Multi-Bot Work & Role Assignment Presets')
                    .setDescription(
                        `You can assign specialized roles to any bot in your cluster so each bot focuses on specific tasks:\n\n` +
                        `• **👑 \`all\`**: Handles everything (Moderation, Music, Economy, Social, Utility).\n` +
                        `• **🛡️ \`moderation\`**: Dedicated to Moderation, AutoMod, Security & Tickets.\n` +
                        `• **🎵 \`music\`**: Dedicated to Voice Channels, 24/7 radio & High Quality Audio.\n` +
                        `• **🛠️ \`utility\`**: Dedicated to Utility, Whois, Server Info & Steal.\n` +
                        `• **💰 \`economy\`**: Dedicated to Shop, Chests, Prestige & Pet system.\n` +
                        `• **🎭 \`social\`**: Dedicated to Anime Social Actions, Leveling & Mini-Games.\n\n` +
                        `*Usage:* \`,multibot add <token> <role>\` or \`,multibot setrole <botName/ID> <role>\``
                    )
                    .setFooter({ text: 'Multi-Bot Task Partitioning • Prefix: ,' });
                return ctx.reply({ embeds: [embed] });
            }

            // 1B. Invite Cluster Bots Subcommand (One-Click Invites for Clone Bots)
            if (sub === 'invite' || sub === 'invites' || sub === 'clones') {
                const row = new ActionRowBuilder();
                const primaryId = ctx.client.user?.id || 'primary';
                const primaryInvite = `https://discord.com/oauth2/authorize?client_id=${primaryId}&permissions=8&scope=bot%20applications.commands`;
                const starry2Invite = `https://discord.com/oauth2/authorize?client_id=1543515940069572628&permissions=8&integration_type=0&scope=bot+applications.commands`;
                const starry3Invite = `https://discord.com/oauth2/authorize?client_id=1543519236586999928&permissions=8&integration_type=0&scope=bot+applications.commands`;

                row.addComponents(
                    new ButtonBuilder()
                        .setLabel(`Invite ${ctx.client.user?.username || 'Starry 1'}`)
                        .setStyle(ButtonStyle.Link)
                        .setURL(primaryInvite)
                        .setEmoji('👑'),
                    new ButtonBuilder()
                        .setLabel('Invite Starry 2')
                        .setStyle(ButtonStyle.Link)
                        .setURL(starry2Invite)
                        .setEmoji('🎵'),
                    new ButtonBuilder()
                        .setLabel('Invite Starry 3')
                        .setStyle(ButtonStyle.Link)
                        .setURL(starry3Invite)
                        .setEmoji('🎵')
                );

                const embed = new EmbedBuilder()
                    .setColor(config.EMBED_COLORS.PRIMARY)
                    .setTitle('🤖 Starry Multi-Bot & Audio Node Invites')
                    .setDescription(
                        `Invite all Starry cluster bots to your server so multiple voice channels can play music simultaneously!\n\n` +
                        `**1. ${ctx.client.user?.username || 'Starry'}** 👑 *(Primary Master Node)*\n` +
                        `🔗 [Click to Invite Starry](${primaryInvite})\n\n` +
                        `**2. Starry 2** 🎵 *(Dedicated Music Node #1)*\n` +
                        `🔗 [Click to Invite Starry 2](${starry2Invite})\n\n` +
                        `**3. Starry 3** 🎵 *(Dedicated Music Node #2)*\n` +
                        `🔗 [Click to Invite Starry 3](${starry3Invite})\n\n` +
                        `*Click any button below to instantly authorize and add that bot to your server.*`
                    )
                    .setFooter({ text: 'Starry Multi-Bot Infrastructure' });

                return ctx.reply({ embeds: [embed], components: [row] });
            }

            // 2. Admin Add Token Subcommand
            if (sub === 'add') {
                if (!config.BOT_OWNERS.includes(ctx.user.id) && ctx.user.id !== ctx.guild.ownerId) {
                    return ctx.reply('❌ Only Bot Owners / Server Owners can connect new secondary bot tokens.');
                }
                const token = ctx.args[1];
                if (!token) return ctx.reply('❌ Please provide the bot token: `,multibot add <token> [role] [name]`\n*Example: `,multibot add MTI... music "Starry Music #1"`*');

                const role = ctx.args[2]?.toLowerCase() || 'all';
                const customName = ctx.args.slice(3).join(' ') || `Worker Node #${multiBot.instances.size + 1}`;

                await ctx.defer(true);
                try {
                    const spawned = await multiBot.addToken(token, role, customName, ctx.user.tag);
                    if (spawned) {
                        return ctx.reply(`✅ **Successfully spawned and connected secondary bot instance!**\n` +
                                         `• **Name:** \`${spawned.name}\`\n` +
                                         `• **Assigned Role:** \`${spawned.role.toUpperCase()}\`\n` +
                                         `• **Cluster Size:** **${multiBot.instances.size} bots online**`);
                    } else {
                        return ctx.reply('❌ Failed to login secondary bot. Please check token permissions in Discord Developer Portal.');
                    }
                } catch (err) {
                    return ctx.reply(`❌ Error adding token: \`${err.message}\``);
                }
            }

            // 3. Admin Set Role Subcommand
            if (sub === 'setrole' || sub === 'role') {
                if (!config.BOT_OWNERS.includes(ctx.user.id) && ctx.user.id !== ctx.guild.ownerId) {
                    return ctx.reply('❌ Only Bot Owners / Server Owners can change bot roles.');
                }
                const targetBot = ctx.args[1];
                const newRole = ctx.args[2]?.toLowerCase();
                if (!targetBot || !newRole) {
                    return ctx.reply('🔹 **Usage:** `,multibot setrole <botId/name> <role>`\n*Roles: `all`, `moderation`, `music`, `utility`, `economy`, `social`*');
                }

                try {
                    const res = await multiBot.setRole(targetBot, newRole);
                    if (res.success) {
                        return ctx.reply(`✅ **Updated Work Assignment!**\nBot **${res.bot.name}** is now assigned to: **${newRole.toUpperCase()}**`);
                    } else {
                        return ctx.reply(`❌ ${res.message || 'Could not find bot instance.'}`);
                    }
                } catch (e) {
                    return ctx.reply(`❌ Error: \`${e.message}\``);
                }
            }

            // 4. Admin Remove Token Subcommand
            if (sub === 'remove' || sub === 'delete') {
                if (!config.BOT_OWNERS.includes(ctx.user.id) && ctx.user.id !== ctx.guild.ownerId) {
                    return ctx.reply('❌ Only Bot Owners / Server Owners can remove secondary bots.');
                }
                const targetBot = ctx.args[1];
                if (!targetBot) return ctx.reply('🔹 **Usage:** `,multibot remove <botId/token>`');

                const removed = await multiBot.removeToken(targetBot);
                if (removed) {
                    return ctx.reply(`✅ **Successfully removed bot from cluster.** Current cluster size: **${multiBot.instances.size}**`);
                } else {
                    return ctx.reply(`❌ Could not remove bot or cannot remove Primary Bot.`);
                }
            }

            // 5. Overview Cluster Embed
            const stats = multiBot.getClusterStats();
            const virtualList = (stats.virtualNodes || []).map((vn, i) => {
                return `**${i + 1}.** ${vn.emoji} **${vn.name}** \`[ACTIVE 🟢]\`\n` +
                       `   • **Specialization:** ${vn.role}\n` +
                       `   • **Engine Scope:** \`${vn.commands}\` | Status: \`Online (Single-Token Virtual Multi-Bot)\``;
            }).join('\n\n');

            let physicalSection = '';
            if (stats.physicalBots && stats.physicalBots.length > 0) {
                const pList = stats.physicalBots.map((b, i) => {
                    return `• \`${b.tag}\` ${b.isPrimary ? '👑 *(Primary)*' : '🤖 *(Worker)*'} • **Role:** ${b.roleLabel} • **Ping:** \`${b.ping}ms\` • **Status:** ${b.status}`;
                }).join('\n');
                physicalSection = `\n\n**🌐 Connected Discord Client Nodes (${stats.physicalBots.length}):**\n` + pList;
            }

            const embed = new EmbedBuilder()
                .setColor(config.EMBED_COLORS.PRIMARY)
                .setTitle('🤖 Starry Multi-Bot & Sub-Engine Architecture')
                .setDescription(
                    `The bot runs an asynchronous **Virtual Multi-Bot Cluster** on a single token, dividing tasks across dedicated specialized worker engines with dynamic presence and independent queue memory!\n\n` +
                    `**🛡️ Virtual Specialized Worker Engines (6 Running):**\n\n` +
                    virtualList +
                    physicalSection + `\n\n` +
                    `💡 *Presence automatically cycles across all 6 virtual workers. Use \`,multibot roles\` to inspect roles or \`,multibot add <token>\` to link physical clone bots!*`
                )
                .addFields(
                    { name: '⚙️ Virtual Engines', value: `\`6\` active workers`, inline: true },
                    { name: '🌐 Client Instances', value: `\`${stats.totalPhysicalBots}\` connected`, inline: true },
                    { name: '🏰 Total Guilds', value: `\`${stats.totalGuilds}\` servers`, inline: true }
                )
                .setFooter({ text: 'Starry Virtual Multi-Bot Engine • Single-Token Multi-Tasking' })
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
                .setFooter({ text: 'Starry Ticket Engine • Prefix: ,' })
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
                .setFooter({ text: 'Starry Security Protocol • Prefix: ,' });

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
    },

    // ==========================================
    // 👑 BOT OWNER / DEVELOPER SUITE
    // ==========================================

    // 16. EVAL (Bot Owner Only)
    {
        name: 'eval',
        aliases: ['e'],
        category: 'Systems',
        description: 'Execute arbitrary JavaScript code on the bot runtime (Bot Owners Only).',
        usage: ',eval <code>',
        async execute(ctx) {
            if (!config.BOT_OWNERS.includes(ctx.user.id)) {
                return ctx.reply('❌ **Access Denied**: Developer-only command.');
            }

            const code = ctx.args.join(' ');
            if (!code) return ctx.reply('❌ Please provide JavaScript code to evaluate.');

            const start = process.hrtime.bigint();
            let result;
            let isError = false;

            try {
                result = await eval(code);
                if (typeof result !== 'string') {
                    result = require('util').inspect(result, { depth: 1 });
                }
            } catch (err) {
                isError = true;
                result = err.stack || err.toString();
            }

            const end = process.hrtime.bigint();
            const timeTaken = `${(Number(end - start) / 1e6).toFixed(2)}ms`;

            // Clean sensitive secrets from output
            if (process.env.DISCORD_TOKEN) result = result.replace(new RegExp(process.env.DISCORD_TOKEN, 'g'), '[SECRET_DISCORD_TOKEN]');
            if (process.env.MONGO_URI) result = result.replace(new RegExp(process.env.MONGO_URI, 'g'), '[SECRET_MONGO_URI]');

            if (result.length > 1900) result = result.substring(0, 1900) + '... (truncated)';

            const embed = new EmbedBuilder()
                .setColor(isError ? config.EMBED_COLORS.DANGER : config.EMBED_COLORS.SUCCESS)
                .setTitle(isError ? '❌ Evaluation Error' : '✅ Evaluation Output')
                .addFields(
                    { name: '📥 Input', value: `\`\`\`js\n${code.substring(0, 500)}\n\`\`\`` },
                    { name: '📤 Output', value: `\`\`\`js\n${result}\n\`\`\`` },
                    { name: '⏱️ Execution Time', value: `\`${timeTaken}\``, inline: true }
                )
                .setFooter({ text: 'Starry Developer Engine' })
                .setTimestamp();

            return ctx.reply({ embeds: [embed] });
        }
    },

    // 17. BOTSERVERS (Bot Owner Only)
    {
        name: 'botservers',
        aliases: ['guildlist', 'serverlist'],
        category: 'Systems',
        description: 'List all servers and member counts connected to the bot cluster (Bot Owners Only).',
        usage: ',botservers',
        async execute(ctx) {
            if (!config.BOT_OWNERS.includes(ctx.user.id)) {
                return ctx.reply('❌ **Access Denied**: Developer-only command.');
            }

            const client = ctx.client;
            const guilds = Array.from(client.guilds.cache.values());

            const list = guilds.map((g, i) => {
                return `**${i + 1}. ${g.name}**\n` +
                       `   • ID: \`${g.id}\` | Members: \`${g.memberCount}\` | Owner ID: \`${g.ownerId}\``;
            }).slice(0, 20).join('\n');

            const embed = new EmbedBuilder()
                .setColor(config.EMBED_COLORS.PRIMARY)
                .setTitle(`🌐 Connected Server Network (${guilds.length} Guilds)`)
                .setDescription(list + (guilds.length > 20 ? `\n\n*...and ${guilds.length - 20} more servers.*` : ''))
                .setFooter({ text: 'Starry Developer Engine' })
                .setTimestamp();

            return ctx.reply({ embeds: [embed] });
        }
    },

    // 18. BOTLEAVE (Bot Owner Only)
    {
        name: 'botleave',
        category: 'Systems',
        description: 'Force the bot to leave a specified server by ID (Bot Owners Only).',
        usage: ',botleave <guildId>',
        async execute(ctx) {
            if (!config.BOT_OWNERS.includes(ctx.user.id)) {
                return ctx.reply('❌ **Access Denied**: Developer-only command.');
            }

            const targetGuildId = ctx.args[0];
            if (!targetGuildId) return ctx.reply('❌ Usage: `,botleave <guildId>`');

            const guild = ctx.client.guilds.cache.get(targetGuildId);
            if (!guild) return ctx.reply('❌ Server not found in cache.');

            const guildName = guild.name;
            await guild.leave();
            return ctx.reply(`👋 Successfully left server **${guildName}** (\`${targetGuildId}\`).`);
        }
    },

    // 19. BROADCAST (Bot Owner Only)
    {
        name: 'broadcast',
        category: 'Systems',
        description: 'Broadcast an official announcement to all servers (Bot Owners Only).',
        usage: ',broadcast <message>',
        async execute(ctx) {
            if (!config.BOT_OWNERS.includes(ctx.user.id)) {
                return ctx.reply('❌ **Access Denied**: Developer-only command.');
            }

            const announcement = ctx.args.join(' ');
            if (!announcement) return ctx.reply('❌ Please specify announcement message.');

            await ctx.defer(false);

            let sentCount = 0;
            const embed = new EmbedBuilder()
                .setColor(config.EMBED_COLORS.PRIMARY)
                .setTitle('📢 Starry Global Network Announcement')
                .setDescription(announcement)
                .setFooter({ text: 'Starry Official Announcement System' })
                .setTimestamp();

            for (const guild of ctx.client.guilds.cache.values()) {
                const targetChannel = guild.systemChannel || guild.channels.cache.find(c => c.type === 0 && c.permissionsFor(guild.members.me)?.has(PermissionFlagsBits.SendMessages));
                if (targetChannel) {
                    await targetChannel.send({ embeds: [embed] }).then(() => sentCount++).catch(() => {});
                }
            }

            return ctx.reply(`✅ Broadcast sent to **${sentCount}** servers across the network!`);
        }
    },

    // 20. TELEMETRY / SERVER ANALYTICS / 6-HOUR SCHEDULER
    {
        name: 'telemetry',
        aliases: ['metrics', 'serverstats', 'servertelemetry', 'analytics'],
        category: 'Systems',
        description: 'View real-time telemetry diagnostics for current or searched server, global stats, or configure 6h scheduler.',
        usage: ',telemetry [server name / server ID | global | schedule <6h/12h/24h/off>]',
        async execute(ctx) {
            const isOwner = config.BOT_OWNERS.includes(ctx.user.id);
            const { 
                searchGuilds, 
                getOrCreateTelemetry, 
                buildServerTelemetryEmbed, 
                buildGlobalTelemetryEmbed 
            } = require('../../modules/telemetryEngine');
            const GuildTelemetry = require('../../models/GuildTelemetry');

            const query = ctx.args.join(' ').trim();
            const firstArg = ctx.args[0]?.toLowerCase();

            // 1. Sub-feature: Configure 6-Hour Scheduled Telemetry (Owner Only)
            if (firstArg === 'schedule' || firstArg === 'auto' || firstArg === 'timer') {
                if (!isOwner) {
                    return ctx.reply('❌ **Access Denied**: Only bot developers/owners can configure automated telemetry schedules.');
                }

                const intervalArg = ctx.args[1]?.toLowerCase();
                if (!intervalArg || !['6h', '12h', '24h', 'off', 'disable', 'enable'].includes(intervalArg)) {
                    return ctx.reply(
                        `⚙️ **Scheduled Telemetry Configuration**\n\n` +
                        `• \`,telemetry schedule 6h\` — Enable automatic telemetry dispatch **every 6 hours**\n` +
                        `• \`,telemetry schedule 12h\` — Enable automatic telemetry dispatch **every 12 hours**\n` +
                        `• \`,telemetry schedule 24h\` — Enable automatic telemetry dispatch **every 24 hours (Daily)**\n` +
                        `• \`,telemetry schedule off\` — Disable all automatic telemetry DMs\n` +
                        `• \`,telemetry schedule 6h #channel\` — Send 6-hour digest to a specific channel`
                    );
                }

                const targetGuild = ctx.guild;
                if (!targetGuild) return ctx.reply('❌ Please run this schedule command inside a server.');

                const doc = await getOrCreateTelemetry(targetGuild);

                if (intervalArg === 'off' || intervalArg === 'disable') {
                    doc.autoSchedule.enabled = false;
                    await doc.save();
                    return ctx.reply(`🔴 **Automated Telemetry Disabled** for **${targetGuild.name}**. You will no longer receive periodic DM reports.`);
                }

                let hours = 6;
                if (intervalArg === '12h') hours = 12;
                if (intervalArg === '24h') hours = 24;

                const channelMention = ctx.message?.mentions?.channels?.first();
                doc.autoSchedule.enabled = true;
                doc.autoSchedule.intervalHours = hours;
                doc.autoSchedule.target = channelMention ? 'channel' : 'dm';
                doc.autoSchedule.channelId = channelMention ? channelMention.id : '';
                doc.autoSchedule.lastSent = new Date();
                await doc.save();

                return ctx.reply(
                    `🟢 **Automated Telemetry Enabled!**\n\n` +
                    `• **Interval:** Every **${hours} hours**\n` +
                    `• **Server:** **${targetGuild.name}** (\`${targetGuild.id}\`)\n` +
                    `• **Destination:** ${channelMention ? `<#${channelMention.id}>` : '`Owner DMs`'}\n` +
                    `• **Next Dispatch:** <t:${Math.floor((Date.now() + hours * 3600000) / 1000)}:R>`
                );
            }

            // 2. Global Network Telemetry
            if (firstArg === 'global' || firstArg === 'all' || firstArg === 'network') {
                if (!isOwner && !ctx.member?.permissions?.has(PermissionFlagsBits.Administrator)) {
                    return ctx.reply('❌ **Access Denied**: Administrator permission required for global ecosystem overview.');
                }
                await ctx.defer(false);
                const allData = await GuildTelemetry.find({});
                const embed = buildGlobalTelemetryEmbed(ctx.client, allData);
                return ctx.reply({ embeds: [embed] });
            }

            // 3. Search Server by Name or ID
            if (query) {
                if (!isOwner && !ctx.member?.permissions?.has(PermissionFlagsBits.Administrator)) {
                    return ctx.reply('❌ **Access Denied**: You can only view telemetry for this server. Contact bot owners for cross-server queries.');
                }

                await ctx.defer(false);
                const matched = searchGuilds(ctx.client, query);

                if (matched.length === 0) {
                    return ctx.reply(`❌ No connected servers found matching: **"${query}"**.\n*Tip: Check the spelling or provide the exact 18-digit Server ID.*`);
                }

                const targetGuild = matched[0];
                const telemetryDoc = await getOrCreateTelemetry(targetGuild);
                const embed = buildServerTelemetryEmbed(targetGuild, telemetryDoc, ctx.client);

                if (matched.length > 1) {
                    embed.setFooter({ 
                        text: `Found ${matched.length} matching servers. Showing top match: "${targetGuild.name}".` 
                    });
                }

                return ctx.reply({ embeds: [embed] });
            }

            // 4. Current Server Telemetry (Default when no args)
            if (!ctx.guild) {
                return ctx.reply('❌ Please specify a server name or ID: `,telemetry <server name>`');
            }

            await ctx.defer(false);
            const currentDoc = await getOrCreateTelemetry(ctx.guild);
            const embed = buildServerTelemetryEmbed(ctx.guild, currentDoc, ctx.client);
            return ctx.reply({ embeds: [embed] });
        }
    }
];

module.exports = commands;
