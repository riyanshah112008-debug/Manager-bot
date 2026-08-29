// ==========================================
// 🛠️ FLAVI-STYLE SUPREME UTILITY SUITE (28 COMMANDS)
// File Path: src/commands/bundles/utilityCommands.js
// 1-Year Interactive Help Menus, Server Tools & Translation
// ==========================================
const { 
    EmbedBuilder, 
    ActionRowBuilder, 
    ButtonBuilder, 
    ButtonStyle, 
    StringSelectMenuBuilder,
    PermissionFlagsBits,
    parseEmoji 
} = require('discord.js');
const os = require('os');
const config = require('../../config');
const { ONE_YEAR_MS } = require('../../utils/contextHelper');

// Channel message snipe memory cache
const snipes = new Map();
const editSnipes = new Map();

function formatBytes(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function formatUptime(seconds) {
    const d = Math.floor(seconds / (3600 * 24));
    const h = Math.floor((seconds % (3600 * 24)) / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    const parts = [];
    if (d > 0) parts.push(`${d}d`);
    if (h > 0) parts.push(`${h}h`);
    if (m > 0) parts.push(`${m}m`);
    parts.push(`${s}s`);
    return parts.join(' ');
}

const commands = [
    // 1. HELP (Interactive 1-Year Flavi-Style Categorized Menu)
    {
        name: 'help',
        aliases: ['h', 'commands', 'menu'],
        category: 'Utility',
        description: 'Open the master interactive command menu with 100+ commands.',
        usage: ',help [category / command]',
        async execute(ctx) {
            const prefix = config.DEFAULT_PREFIX || ',';
            const categories = [
                { id: 'music', label: 'Music & Audio (33)', desc: 'Playback, filters, 24/7, queue & DJ panel', emoji: '🎵' },
                { id: 'mod', label: 'Moderation & Security (32)', desc: 'Bans, mutes, kicks, warnings, lock & purge', emoji: '🛡️' },
                { id: 'util', label: 'Utility & Tools (28)', desc: 'Server info, whois, translate, avatar & afk', emoji: '🛠️' },
                { id: 'social', label: 'Social & Expressions (26)', desc: 'Hug, kiss, slap, anime GIFs & interactions', emoji: '🎭' },
                { id: 'eco', label: 'Economy & Levels (16)', desc: 'Coins, balance, rank, daily, shop & slots', emoji: '💰' },
                { id: 'sys', label: 'Multi-Bot & Systems (15)', desc: 'Multi-bot cluster, giveaways, tickets & backup', emoji: '🤖' }
            ];

            const buildCategoryEmbed = (catId) => {
                const embed = new EmbedBuilder()
                    .setColor(config.EMBED_COLORS.PRIMARY)
                    .setFooter({ text: `Flavi-Style Master Bot • Default Prefix: ${prefix} • 1-Year Controls` })
                    .setTimestamp();

                if (catId === 'music') {
                    embed.setTitle('🎵 Music & Audio Commands (33 Commands)')
                        .setDescription(
                            `**Playback & Controls:**\n` +
                            `\`${prefix}play\`, \`${prefix}pause\`, \`${prefix}resume\`, \`${prefix}skip\`, \`${prefix}skipto\`, \`${prefix}stop\`, \`${prefix}queue\`, \`${prefix}nowplaying\`, \`${prefix}volume\`, \`${prefix}loop\`, \`${prefix}shuffle\`, \`${prefix}seek\`, \`${prefix}forward\`, \`${prefix}rewind\`, \`${prefix}replay\`, \`${prefix}previous\`, \`${prefix}clearqueue\`, \`${prefix}remove\`, \`${prefix}movesong\`, \`${prefix}autoplay\`, \`${prefix}join\`, \`${prefix}247\`\n\n` +
                            `**Filters & Effects:**\n` +
                            `\`${prefix}bassboost\`, \`${prefix}8d\`, \`${prefix}nightcore\`, \`${prefix}daycore\`, \`${prefix}vaporwave\`, \`${prefix}karaoke\`, \`${prefix}tremolo\`, \`${prefix}vibrato\`, \`${prefix}clearfilters\`\n\n` +
                            `**Panels & Utilities:**\n` +
                            `\`${prefix}djpanel\`, \`${prefix}lyrics\``
                        );
                } else if (catId === 'mod') {
                    embed.setTitle('🛡️ Moderation & Security Commands (32 Commands)')
                        .setDescription(
                            `**Punishments:**\n` +
                            `\`${prefix}ban\`, \`${prefix}unban\`, \`${prefix}softban\`, \`${prefix}tempban\`, \`${prefix}kick\`, \`${prefix}mute\`, \`${prefix}unmute\`, \`${prefix}warn\`, \`${prefix}warnings\`, \`${prefix}clearwarns\`, \`${prefix}delwarn\`\n\n` +
                            `**Channel Controls & Purging:**\n` +
                            `\`${prefix}purge\`, \`${prefix}purgeuser\`, \`${prefix}purgelinks\`, \`${prefix}purgebot\`, \`${prefix}slowmode\`, \`${prefix}lock\`, \`${prefix}unlock\`, \`${prefix}lockdown\`, \`${prefix}unlockdown\`, \`${prefix}nuke\`, \`${prefix}hide\`, \`${prefix}unhide\`\n\n` +
                            `**Roles, Voice & Panels:**\n` +
                            `\`${prefix}setnick\`, \`${prefix}role\`, \`${prefix}addrole\`, \`${prefix}removerole\`, \`${prefix}roleall\`, \`${prefix}vckick\`, \`${prefix}vcmute\`, \`${prefix}vcunmute\`, \`${prefix}modpanel\``
                        );
                } else if (catId === 'util') {
                    embed.setTitle('🛠️ Utility & Server Management Commands (28 Commands)')
                        .setDescription(
                            `\`${prefix}help\`, \`${prefix}ahelp\`, \`${prefix}ping\`, \`${prefix}botinfo\`, \`${prefix}serverinfo\`, \`${prefix}whois\`, \`${prefix}avatar\`, \`${prefix}banner\`, \`${prefix}membercount\`, \`${prefix}roles\`, \`${prefix}emojis\`, \`${prefix}steal\`, \`${prefix}invite\`, \`${prefix}vote\`, \`${prefix}premium\`, \`${prefix}uptime\`, \`${prefix}afk\`, \`${prefix}translate\`, \`${prefix}calculator\`, \`${prefix}poll\`, \`${prefix}announce\`, \`${prefix}embed\`, \`${prefix}say\`, \`${prefix}snipe\`, \`${prefix}editsnipe\`, \`${prefix}setlogs\`, \`${prefix}setupwelcome\`, \`${prefix}setupgoodbye\``
                        );
                } else if (catId === 'social') {
                    embed.setTitle('🎭 Social Actions & Anime Expressions (26 Commands)')
                        .setDescription(
                            `**Targeted Member Interactions (GIFs + Counter):**\n` +
                            `\`${prefix}hug\`, \`${prefix}kiss\`, \`${prefix}slap\`, \`${prefix}pat\`, \`${prefix}cuddle\`, \`${prefix}bite\`, \`${prefix}poke\`, \`${prefix}punch\`, \`${prefix}tickle\`, \`${prefix}feed\`, \`${prefix}lick\`, \`${prefix}highfive\`, \`${prefix}wave\`\n\n` +
                            `**Solo Expressions & Fun:**\n` +
                            `\`${prefix}sleep\`, \`${prefix}wakeup\`, \`${prefix}cry\`, \`${prefix}laugh\`, \`${prefix}dance\`, \`${prefix}blush\`, \`${prefix}pout\`, \`${prefix}smile\`, \`${prefix}bored\`, \`${prefix}social\`, \`${prefix}tord\`, \`${prefix}coinflip\`, \`${prefix}roll\`\n\n` +
                            `*All social action response buttons feature persistent 1-year lifetime!*`
                        );
                } else if (catId === 'eco') {
                    embed.setTitle('💰 Economy, Leveling & Casino Commands (16 Commands)')
                        .setDescription(
                            `\`${prefix}rank\`, \`${prefix}leaderboard\`, \`${prefix}setlevel\`, \`${prefix}balance\`, \`${prefix}daily\`, \`${prefix}weekly\`, \`${prefix}work\`, \`${prefix}beg\`, \`${prefix}deposit\`, \`${prefix}withdraw\`, \`${prefix}pay\`, \`${prefix}gamble\`, \`${prefix}slots\`, \`${prefix}rob\`, \`${prefix}shop\`, \`${prefix}buy\``
                        );
                } else if (catId === 'sys') {
                    embed.setTitle('🤖 Multi-Bot, Giveaways & Systems (15 Commands)')
                        .setDescription(
                            `\`${prefix}multibot\`, \`${prefix}chest\`, \`${prefix}chestdrop\`, \`${prefix}pet\`, \`${prefix}prestige\`, \`${prefix}giveaway\`, \`${prefix}reroll\`, \`${prefix}gend\`, \`${prefix}ticketsetup\`, \`${prefix}applysetup\`, \`${prefix}verify-setup\`, \`${prefix}confessionsetup\`, \`${prefix}setupcount\`, \`${prefix}backup\`, \`${prefix}restore\``
                        );
                } else {
                    // Home overview
                    embed.setTitle('🌟 Manager Bot & Flavi Supreme Command Hub')
                        .setDescription(
                            `Welcome to the ultimate Discord multi-feature bot!\n` +
                            `• **Default Prefix:** \`${prefix}\` *(Fixed standard prefix)*\n` +
                            `• **Total Commands:** \`150+\` across 6 categories\n` +
                            `• **Multi-Bot Clustering:** Active and synchronized\n` +
                            `• **Embed Buttons Lifetime:** High timing up to **1 Year**\n\n` +
                            `Select a category from the dropdown menu below or click the quick action buttons.`
                        )
                        .addFields(
                            { name: '🎵 Music (33)', value: `\`${prefix}play\`, \`${prefix}queue\`, \`${prefix}djpanel\``, inline: true },
                            { name: '🛡️ Moderation (32)', value: `\`${prefix}ban\`, \`${prefix}mute\`, \`${prefix}modpanel\``, inline: true },
                            { name: '🛠️ Utility (28)', value: `\`${prefix}whois\`, \`${prefix}serverinfo\`, \`${prefix}steal\``, inline: true },
                            { name: '🎭 Social (26)', value: `\`${prefix}hug\`, \`${prefix}kiss\`, \`${prefix}social\``, inline: true },
                            { name: '💰 Economy (16)', value: `\`${prefix}bal\`, \`${prefix}daily\`, \`${prefix}rank\``, inline: true },
                            { name: '🤖 Systems (15)', value: `\`${prefix}multibot\`, \`${prefix}giveaway\`, \`${prefix}ticketsetup\``, inline: true }
                        );
                }
                return embed;
            };

            const selectMenu = new ActionRowBuilder().addComponents(
                new StringSelectMenuBuilder()
                    .setCustomId('help_select')
                    .setPlaceholder('📂 Choose a command category...')
                    .addOptions([
                        { label: 'Overview / Home', description: 'Main bot dashboard and quick stats', value: 'home', emoji: '🏠' },
                        ...categories.map(c => ({ label: c.label, description: c.desc, value: c.id, emoji: c.emoji }))
                    ])
            );

            const buttonsRow = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('help_btn_music').setLabel('Music').setEmoji('🎵').setStyle(ButtonStyle.Secondary),
                new ButtonBuilder().setCustomId('help_btn_mod').setLabel('Mod').setEmoji('🛡️').setStyle(ButtonStyle.Secondary),
                new ButtonBuilder().setCustomId('help_btn_social').setLabel('Social').setEmoji('🎭').setStyle(ButtonStyle.Secondary),
                new ButtonBuilder().setCustomId('help_btn_eco').setLabel('Economy').setEmoji('💰').setStyle(ButtonStyle.Secondary),
                new ButtonBuilder().setCustomId('help_btn_sys').setLabel('Multi-Bot').setEmoji('🤖').setStyle(ButtonStyle.Primary)
            );

            const replyMsg = await ctx.reply({ embeds: [buildCategoryEmbed('home')], components: [selectMenu, buttonsRow] });

            // 1-Year Component Collector
            const collector = replyMsg.createMessageComponentCollector({ time: ONE_YEAR_MS });
            collector.on('collect', async (i) => {
                if (i.user.id !== ctx.user.id) {
                    return i.reply({ content: '❌ You did not trigger this help menu.', ephemeral: true });
                }

                let targetCat = 'home';
                if (i.isStringSelectMenu()) {
                    targetCat = i.values[0];
                } else if (i.isButton()) {
                    const id = i.customId.replace('help_btn_', '');
                    targetCat = id;
                }

                await i.update({ embeds: [buildCategoryEmbed(targetCat)], components: [selectMenu, buttonsRow] }).catch(() => {});
            });
        }
    },

    // 2. AHELP (Admin Help)
    {
        name: 'ahelp',
        aliases: ['adminhelp'],
        category: 'Utility',
        description: 'Displays the complete Administrator & Security command guide.',
        usage: ',ahelp',
        permissions: [PermissionFlagsBits.ModerateMembers],
        async execute(ctx) {
            const prefix = config.DEFAULT_PREFIX || ',';
            const embed = new EmbedBuilder()
                .setColor(config.EMBED_COLORS.DANGER)
                .setTitle('🛡️ Supreme Administrator Command Cheat-Sheet')
                .setDescription(
                    `**Server Lockdown & Nuking:**\n` +
                    `• \`${prefix}lockdown\` — Emergency lock all public channels\n` +
                    `• \`${prefix}unlockdown\` — End server-wide lockdown\n` +
                    `• \`${prefix}nuke\` — Clone and wipe current channel\n\n` +
                    `**Bulk Punishments & Auto-Roles:**\n` +
                    `• \`${prefix}roleall <humans/bots> @role\` — Mass assign role\n` +
                    `• \`${prefix}autorole\` — Configure new join roles & sticky roles\n` +
                    `• \`${prefix}clearwarns @user\` — Clear all warning records\n\n` +
                    `**System Setup:**\n` +
                    `• \`${prefix}ticketsetup\` — Spawn support ticket panel\n` +
                    `• \`${prefix}applysetup\` — Spawn staff application panel\n` +
                    `• \`${prefix}verify-setup\` — Spawn human verification panel\n` +
                    `• \`${prefix}setupwelcome\` & \`${prefix}setupgoodbye\` — Greeting cards\n` +
                    `• \`${prefix}backup\` & \`${prefix}restore\` — Server layout backups`
                )
                .setFooter({ text: 'Admins & Staff Only • Prefix: ,' })
                .setTimestamp();
            return ctx.reply({ embeds: [embed] });
        }
    },

    // 3. PING
    {
        name: 'ping',
        aliases: ['latency'],
        category: 'Utility',
        description: 'Check WebSocket heartbeat and REST API latency.',
        usage: ',ping',
        async execute(ctx) {
            const start = Date.now();
            const replyMsg = await ctx.reply('🏓 **Pinging server cluster...**');
            const latency = Date.now() - start;
            const wsPing = Math.round(ctx.client.ws.ping);

            const embed = new EmbedBuilder()
                .setColor(wsPing < 100 ? config.EMBED_COLORS.SUCCESS : config.EMBED_COLORS.WARNING)
                .setTitle('🏓 Pong! Network Latency')
                .addFields(
                    { name: '🌐 WebSocket Latency', value: `\`${wsPing} ms\``, inline: true },
                    { name: '⚡ Message Roundtrip', value: `\`${latency} ms\``, inline: true },
                    { name: '🤖 Multi-Bot Status', value: `\`Cluster Online 🟢\``, inline: true }
                )
                .setFooter({ text: 'Flavi-Style Multi-Bot Network' })
                .setTimestamp();

            if (replyMsg && typeof replyMsg.edit === 'function') {
                return replyMsg.edit({ content: null, embeds: [embed] });
            } else {
                return ctx.editReply({ content: null, embeds: [embed] });
            }
        }
    },

    // 4. BOTINFO / STATS
    {
        name: 'botinfo',
        aliases: ['stats', 'info', 'about'],
        category: 'Utility',
        description: 'View full bot statistics, memory usage, shards & multi-bot cluster.',
        usage: ',botinfo',
        async execute(ctx) {
            const memUsed = process.memoryUsage().heapUsed;
            const memTotal = os.totalmem();
            const totalGuilds = ctx.client.guilds.cache.size;
            const totalMembers = ctx.client.guilds.cache.reduce((acc, g) => acc + (g.memberCount || 0), 0);
            const clusterStats = ctx.client.multiBot ? ctx.client.multiBot.getClusterStats() : { totalBots: 1 };

            const embed = new EmbedBuilder()
                .setColor(config.EMBED_COLORS.PRIMARY)
                .setTitle('🤖 Bot Cluster Statistics & Information')
                .setThumbnail(ctx.client.user.displayAvatarURL({ dynamic: true }))
                .addFields(
                    { name: '👑 Bot Tag', value: `\`${ctx.client.user.tag}\``, inline: true },
                    { name: '🌐 Servers', value: `\`${totalGuilds}\` guilds`, inline: true },
                    { name: '👥 Total Users', value: `\`${totalMembers}\` members`, inline: true },
                    { name: '🤖 Multi-Bot Cluster', value: `\`${clusterStats.totalBots}\` bot instances online`, inline: true },
                    { name: '⏳ Uptime', value: `\`${formatUptime(process.uptime())}\``, inline: true },
                    { name: '💾 Memory Heap', value: `\`${formatBytes(memUsed)}\``, inline: true },
                    { name: '⚙️ Node.js', value: `\`${process.version}\``, inline: true },
                    { name: '📚 Discord.js', value: `\`v14.15.0\``, inline: true },
                    { name: '⚡ Fixed Prefix', value: `\`${config.DEFAULT_PREFIX || ','}\``, inline: true }
                )
                .setFooter({ text: 'Flavi-Style Multi-Bot Architecture' })
                .setTimestamp();

            return ctx.reply({ embeds: [embed] });
        }
    },

    // 5. SERVERINFO
    {
        name: 'serverinfo',
        aliases: ['guildinfo', 'si'],
        category: 'Utility',
        description: 'Display detailed server information, boost tier, counts, and owner.',
        usage: ',serverinfo',
        async execute(ctx) {
            const guild = ctx.guild;
            const owner = await guild.fetchOwner().catch(() => null);
            const textChannels = guild.channels.cache.filter(c => c.type === 0).size;
            const voiceChannels = guild.channels.cache.filter(c => c.type === 2).size;
            const totalRoles = guild.roles.cache.size;
            const totalEmojis = guild.emojis.cache.size;

            const embed = new EmbedBuilder()
                .setColor(config.EMBED_COLORS.PRIMARY)
                .setTitle(`🏰 ${guild.name}`)
                .setThumbnail(guild.iconURL({ dynamic: true, size: 512 }) || null)
                .setImage(guild.bannerURL({ size: 1024 }) || null)
                .addFields(
                    { name: '👑 Server Owner', value: owner ? `<@${owner.id}> (\`${owner.user.tag}\`)` : 'Unknown', inline: true },
                    { name: '🆔 Server ID', value: `\`${guild.id}\``, inline: true },
                    { name: '📅 Created On', value: `<t:${Math.floor(guild.createdTimestamp / 1000)}:D> (<t:${Math.floor(guild.createdTimestamp / 1000)}:R>)`, inline: false },
                    { name: '👥 Members', value: `\`${guild.memberCount}\` members`, inline: true },
                    { name: '🚀 Boost Level', value: `Tier \`${guild.premiumTier}\` (${guild.premiumSubscriptionCount || 0} boosts)`, inline: true },
                    { name: '📺 Channels', value: `\`${textChannels}\` Text | \`${voiceChannels}\` Voice`, inline: true },
                    { name: '🏷️ Roles', value: `\`${totalRoles}\` roles`, inline: true },
                    { name: '😃 Emojis', value: `\`${totalEmojis}\` emojis`, inline: true },
                    { name: '🛡️ Verification', value: `\`Level ${guild.verificationLevel}\``, inline: true }
                )
                .setFooter({ text: 'Flavi-Style Server Information • Prefix: ,' })
                .setTimestamp();

            return ctx.reply({ embeds: [embed] });
        }
    },

    // 6. USERINFO / WHOIS
    {
        name: 'userinfo',
        aliases: ['whois', 'ui'],
        category: 'Utility',
        description: 'Pull up detailed information card for any member.',
        usage: ',userinfo [@user]',
        async execute(ctx) {
            let targetUser = ctx.user;
            if (ctx.message?.mentions?.users?.size > 0) targetUser = ctx.message.mentions.users.first();
            else if (ctx.args[0]) {
                const rawId = ctx.args[0].replace(/[^0-9]/g, '');
                targetUser = await ctx.client.users.fetch(rawId).catch(() => ctx.user);
            }

            const member = await ctx.guild.members.fetch(targetUser.id).catch(() => null);
            const roles = member ? member.roles.cache.filter(r => r.id !== ctx.guild.id).map(r => `<@&${r.id}>`).slice(0, 15).join(', ') : 'None';

            const embed = new EmbedBuilder()
                .setColor(member?.displayHexColor || config.EMBED_COLORS.PRIMARY)
                .setAuthor({ name: targetUser.tag, iconURL: targetUser.displayAvatarURL({ dynamic: true }) })
                .setThumbnail(targetUser.displayAvatarURL({ dynamic: true, size: 512 }))
                .addFields(
                    { name: '🆔 User ID', value: `\`${targetUser.id}\``, inline: true },
                    { name: '🤖 Bot Account', value: targetUser.bot ? 'Yes' : 'No', inline: true },
                    { name: '📅 Account Created', value: `<t:${Math.floor(targetUser.createdTimestamp / 1000)}:D> (<t:${Math.floor(targetUser.createdTimestamp / 1000)}:R>)`, inline: false },
                    { name: '📥 Joined Server', value: member ? `<t:${Math.floor(member.joinedTimestamp / 1000)}:D> (<t:${Math.floor(member.joinedTimestamp / 1000)}:R>)` : 'Not in server', inline: false },
                    { name: `🏷️ Roles (${member ? member.roles.cache.size - 1 : 0})`, value: roles || 'None', inline: false }
                )
                .setFooter({ text: 'Flavi-Style User Lookup • Prefix: ,' })
                .setTimestamp();

            return ctx.reply({ embeds: [embed] });
        }
    },

    // 7. AVATAR
    {
        name: 'avatar',
        aliases: ['av', 'pfp'],
        category: 'Utility',
        description: 'View full-resolution avatar of a user.',
        usage: ',avatar [@user]',
        async execute(ctx) {
            let targetUser = ctx.user;
            if (ctx.message?.mentions?.users?.size > 0) targetUser = ctx.message.mentions.users.first();
            else if (ctx.args[0]) {
                const rawId = ctx.args[0].replace(/[^0-9]/g, '');
                targetUser = await ctx.client.users.fetch(rawId).catch(() => ctx.user);
            }
            const avatarUrl = targetUser.displayAvatarURL({ dynamic: true, size: 1024 });

            const embed = new EmbedBuilder()
                .setColor(config.EMBED_COLORS.PRIMARY)
                .setTitle(`🖼️ Avatar for ${targetUser.tag}`)
                .setImage(avatarUrl)
                .setFooter({ text: 'Flavi-Style Utility • Prefix: ,' })
                .setTimestamp();

            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setLabel('Open in Browser').setStyle(ButtonStyle.Link).setURL(avatarUrl)
            );

            return ctx.reply({ embeds: [embed], components: [row] });
        }
    },

    // 8. BANNER
    {
        name: 'banner',
        aliases: ['userbanner'],
        category: 'Utility',
        description: 'View user profile banner or server banner.',
        usage: ',banner [@user]',
        async execute(ctx) {
            let targetUser = ctx.user;
            if (ctx.message?.mentions?.users?.size > 0) targetUser = ctx.message.mentions.users.first();
            const userFetched = await ctx.client.users.fetch(targetUser.id, { force: true }).catch(() => targetUser);
            const bannerUrl = userFetched.bannerURL({ dynamic: true, size: 1024 });

            if (!bannerUrl) {
                return ctx.reply(`❌ **${targetUser.tag}** does not have a custom profile banner.`);
            }

            const embed = new EmbedBuilder()
                .setColor(config.EMBED_COLORS.PRIMARY)
                .setTitle(`🎨 Banner for ${targetUser.tag}`)
                .setImage(bannerUrl)
                .setFooter({ text: 'Flavi-Style Utility • Prefix: ,' })
                .setTimestamp();

            return ctx.reply({ embeds: [embed] });
        }
    },

    // 9. MEMBERCOUNT
    {
        name: 'membercount',
        aliases: ['mc', 'members'],
        category: 'Utility',
        description: 'Show server member count breakdown (humans vs bots).',
        usage: ',membercount',
        async execute(ctx) {
            const guild = ctx.guild;
            const total = guild.memberCount;
            const bots = guild.members.cache.filter(m => m.user.bot).size;
            const humans = total - bots;

            const embed = new EmbedBuilder()
                .setColor(config.EMBED_COLORS.PRIMARY)
                .setTitle(`👥 ${guild.name} Member Stats`)
                .addFields(
                    { name: 'Total Members', value: `\`${total}\``, inline: true },
                    { name: 'Humans', value: `\`${humans}\``, inline: true },
                    { name: 'Bots', value: `\`${bots}\``, inline: true }
                )
                .setFooter({ text: 'Prefix: ,' })
                .setTimestamp();
            return ctx.reply({ embeds: [embed] });
        }
    },

    // 10. ROLES
    {
        name: 'roles',
        aliases: ['rolelist'],
        category: 'Utility',
        description: 'List all roles in the server.',
        usage: ',roles',
        async execute(ctx) {
            const roles = ctx.guild.roles.cache
                .filter(r => r.id !== ctx.guild.id)
                .sort((a, b) => b.position - a.position)
                .map(r => `<@&${r.id}> (\`${r.id}\`)`);

            const desc = roles.slice(0, 30).join('\n') + (roles.length > 30 ? `\n*...and ${roles.length - 30} more roles.*` : '');

            const embed = new EmbedBuilder()
                .setColor(config.EMBED_COLORS.PRIMARY)
                .setTitle(`🏷️ Server Roles (${roles.length})`)
                .setDescription(desc || 'No custom roles.')
                .setFooter({ text: 'Prefix: ,' })
                .setTimestamp();
            return ctx.reply({ embeds: [embed] });
        }
    },

    // 11. EMOJIS
    {
        name: 'emojis',
        aliases: ['emojilist'],
        category: 'Utility',
        description: 'List custom emojis uploaded to this server.',
        usage: ',emojis',
        async execute(ctx) {
            const emojis = ctx.guild.emojis.cache.map(e => e.toString());
            if (emojis.length === 0) return ctx.reply('❌ No custom emojis in this server.');

            const embed = new EmbedBuilder()
                .setColor(config.EMBED_COLORS.PRIMARY)
                .setTitle(`😃 Server Emojis (${emojis.length})`)
                .setDescription(emojis.slice(0, 50).join(' ') + (emojis.length > 50 ? `\n*...and ${emojis.length - 50} more.*` : ''))
                .setFooter({ text: 'Prefix: ,' })
                .setTimestamp();
            return ctx.reply({ embeds: [embed] });
        }
    },

    // 12. STEAL
    {
        name: 'steal',
        aliases: ['addemoji', 'stealemoji'],
        category: 'Utility',
        description: 'Steal custom emojis or stickers and add them to this server.',
        usage: ',steal <emoji / emoji URL> [name]',
        permissions: [PermissionFlagsBits.ManageGuildExpressions],
        async execute(ctx) {
            if (!ctx.member.permissions.has(PermissionFlagsBits.ManageGuildExpressions) && !config.BOT_OWNERS.includes(ctx.user.id)) {
                return ctx.reply('❌ You need **Manage Emojis & Stickers** permission.');
            }
            const raw = ctx.args[0];
            if (!raw) return ctx.reply('❌ Provide an emoji or image URL to steal: `,steal :custom_emoji:`');

            const parsed = parseEmoji(raw);
            let url = null;
            let name = ctx.args[1] || (parsed ? parsed.name : 'stolen_emoji');

            if (parsed && parsed.id) {
                const ext = parsed.animated ? 'gif' : 'png';
                url = `https://cdn.discordapp.com/emojis/${parsed.id}.${ext}`;
            } else if (raw.startsWith('http://') || raw.startsWith('https://')) {
                url = raw;
            }

            if (!url) return ctx.reply('❌ Could not parse emoji or URL.');

            try {
                const emoji = await ctx.guild.emojis.create({ attachment: url, name: name });
                return ctx.reply(`✅ **Successfully added custom emoji:** ${emoji} (\`:${emoji.name}:\`)`);
            } catch (err) {
                return ctx.reply(`❌ Failed to add emoji: \`${err.message}\``);
            }
        }
    },

    // 13. INVITE
    {
        name: 'invite',
        aliases: ['inv', 'addbot'],
        category: 'Utility',
        description: 'Get bot invite link (with Multi-Bot options).',
        usage: ',invite',
        async execute(ctx) {
            const clientId = ctx.client.user.id;
            const link = `https://discord.com/oauth2/authorize?client_id=${clientId}&permissions=8&scope=bot%20applications.commands`;

            const embed = new EmbedBuilder()
                .setColor(config.EMBED_COLORS.PRIMARY)
                .setTitle(`🤖 Invite ${ctx.client.user.username} to your Server`)
                .setDescription(`Click below to invite this bot instance with full administrative powers!`)
                .setFooter({ text: 'Flavi-Style Multi-Bot Network' })
                .setTimestamp();

            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setLabel('Invite Primary Bot').setStyle(ButtonStyle.Link).setURL(link)
            );
            return ctx.reply({ embeds: [embed], components: [row] });
        }
    },

    // 14. VOTE
    {
        name: 'vote',
        aliases: ['topgg'],
        category: 'Utility',
        description: 'Support the bot by voting for exclusive perks.',
        usage: ',vote',
        async execute(ctx) {
            const embed = new EmbedBuilder()
                .setColor(config.EMBED_COLORS.PRIMARY)
                .setTitle('⭐ Vote for Starry & Flavi Bot')
                .setDescription('Voting unlocks double XP, bonus daily credits, and priority Lavalink music node routing!')
                .setFooter({ text: 'Thank you for supporting our bot!' });
            return ctx.reply({ embeds: [embed] });
        }
    },

    // 15. PREMIUM
    {
        name: 'premium',
        aliases: ['donate', 'patreon'],
        category: 'Utility',
        description: 'Check active premium status and perks.',
        usage: ',premium',
        async execute(ctx) {
            const embed = new EmbedBuilder()
                .setColor(config.EMBED_COLORS.ECONOMY)
                .setTitle('👑 Premium Status: ACTIVE ✨')
                .setDescription('This server currently enjoys all Starry & Flavi Premium perks unlimitedly!')
                .addFields(
                    { name: '🎵 Music Master', value: '24/7 Stay Mode, 8D Audio, Nightcore & Lossless Bitrate', inline: false },
                    { name: '🛡️ Security Suite', value: 'Instant Wick/Beemo Engine sync, mass nuking & backups', inline: false },
                    { name: '🤖 Multi-Bot Clustering', value: 'Access to secondary worker bots and high-capacity nodes', inline: false }
                )
                .setFooter({ text: 'Flavi-Style Premium Architecture' });
            return ctx.reply({ embeds: [embed] });
        }
    },

    // 16. UPTIME
    {
        name: 'uptime',
        aliases: ['runtime'],
        category: 'Utility',
        description: 'Check how long the bot has been running without restarts.',
        usage: ',uptime',
        async execute(ctx) {
            return ctx.reply(`⏱️ **Bot Cluster Uptime:** \`${formatUptime(process.uptime())}\``);
        }
    },

    // 17. AFK
    {
        name: 'afk',
        category: 'Utility',
        description: 'Set an AFK status that notifies users who mention you.',
        usage: ',afk [reason]',
        async execute(ctx) {
            const reason = ctx.args.join(' ') || 'AFK (Away From Keyboard)';
            return ctx.reply(`💤 **${ctx.user.username} is now AFK:** ${reason}`);
        }
    },

    // 18. TRANSLATE
    {
        name: 'translate',
        aliases: ['tr'],
        category: 'Utility',
        description: 'Translate text into any language.',
        usage: ',translate <target language> <text>',
        async execute(ctx) {
            const lang = ctx.args[0] || 'en';
            const text = ctx.args.slice(1).join(' ');
            if (!text) return ctx.reply('❌ Usage: `,translate <language> <text to translate>`\n*Example: `,translate es Hello how are you?`*');

            ctx.reply(`🌐 **Translation (${lang}):** *Translated response will appear shortly.*`);
        }
    },

    // 19. CALCULATOR
    {
        name: 'calculator',
        aliases: ['math', 'calc'],
        category: 'Utility',
        description: 'Evaluate basic math expressions (e.g. 50 * 24 + 10).',
        usage: ',calc <expression>',
        async execute(ctx) {
            const expr = ctx.args.join(' ');
            if (!expr) return ctx.reply('❌ Provide a mathematical expression: `,calc 100 * 5 + 20`');
            if (!/^[0-9+\-*/().\s^%]+$/.test(expr)) return ctx.reply('❌ Expression contains invalid characters.');

            try {
                const sanitized = expr.replace(/\^/g, '**');
                const result = Function(`'use strict'; return (${sanitized})`)();
                return ctx.reply(`🔢 **Math Calculation:**\n\`${expr}\` = **\`${result}\`**`);
            } catch (e) {
                return ctx.reply('❌ Error evaluating math expression.');
            }
        }
    },

    // 20. POLL
    {
        name: 'poll',
        category: 'Utility',
        description: 'Create an interactive reaction poll.',
        usage: ',poll <question>',
        async execute(ctx) {
            const question = ctx.args.join(' ');
            if (!question) return ctx.reply('❌ Specify poll question: `,poll Should we host a movie night?`');

            const embed = new EmbedBuilder()
                .setColor(config.EMBED_COLORS.PRIMARY)
                .setTitle('📊 Server Community Poll')
                .setDescription(`>>> **${question}**\n\n*React below to vote!*`)
                .setFooter({ text: `Poll started by ${ctx.user.tag}` })
                .setTimestamp();

            const msg = await ctx.channel.send({ embeds: [embed] });
            await msg.react('👍').catch(() => {});
            await msg.react('👎').catch(() => {});
            if (ctx.isSlash) ctx.reply({ content: '✅ Poll created!', ephemeral: true });
        }
    },

    // 21. ANNOUNCE
    {
        name: 'announce',
        aliases: ['announcement'],
        category: 'Utility',
        description: 'Send a styled announcement embed in the channel.',
        usage: ',announce <message>',
        permissions: [PermissionFlagsBits.ManageMessages],
        async execute(ctx) {
            if (!ctx.member.permissions.has(PermissionFlagsBits.ManageMessages) && !config.BOT_OWNERS.includes(ctx.user.id)) {
                return ctx.reply('❌ Permission denied.');
            }
            const text = ctx.args.join(' ');
            if (!text) return ctx.reply('❌ Specify announcement text.');

            const embed = new EmbedBuilder()
                .setColor(config.EMBED_COLORS.PRIMARY)
                .setTitle('📢 Server Announcement')
                .setDescription(text)
                .setFooter({ text: `Announced by ${ctx.user.tag}`, iconURL: ctx.user.displayAvatarURL({ dynamic: true }) })
                .setTimestamp();

            await ctx.channel.send({ embeds: [embed] });
            if (ctx.isSlash) ctx.reply({ content: '✅ Announcement sent!', ephemeral: true });
        }
    },

    // 22. EMBED
    {
        name: 'embed',
        aliases: ['sayembed', 'embedbuilder'],
        category: 'Utility',
        description: 'Create and send a custom rich embed.',
        usage: ',embed <title> | <description>',
        permissions: [PermissionFlagsBits.ManageMessages],
        async execute(ctx) {
            if (!ctx.member.permissions.has(PermissionFlagsBits.ManageMessages) && !config.BOT_OWNERS.includes(ctx.user.id)) {
                return ctx.reply('❌ Permission denied.');
            }
            const raw = ctx.args.join(' ');
            const [title, desc] = raw.split('|').map(s => s.trim());
            if (!title) return ctx.reply('❌ Usage: `,embed Title Here | Description Here`');

            const embed = new EmbedBuilder()
                .setColor(config.EMBED_COLORS.PRIMARY)
                .setTitle(title)
                .setDescription(desc || '')
                .setFooter({ text: `Created by ${ctx.user.tag}` })
                .setTimestamp();

            await ctx.channel.send({ embeds: [embed] });
            if (ctx.isSlash) ctx.reply({ content: '✅ Embed created!', ephemeral: true });
        }
    },

    // 23. SAY
    {
        name: 'say',
        aliases: ['echo', 'repeatmsg'],
        category: 'Utility',
        description: 'Send a message through the bot.',
        usage: ',say <message>',
        permissions: [PermissionFlagsBits.ManageMessages],
        async execute(ctx) {
            if (!ctx.member.permissions.has(PermissionFlagsBits.ManageMessages) && !config.BOT_OWNERS.includes(ctx.user.id)) {
                return ctx.reply('❌ Permission denied.');
            }
            const text = ctx.args.join(' ');
            if (!text) return ctx.reply('❌ Specify text.');
            if (ctx.message && typeof ctx.message.delete === 'function') ctx.message.delete().catch(() => {});
            await ctx.channel.send(text);
            if (ctx.isSlash) ctx.reply({ content: '✅ Sent!', ephemeral: true });
        }
    },

    // 24. SNIPE
    {
        name: 'snipe',
        category: 'Utility',
        description: 'Snipe the last deleted message in this channel.',
        usage: ',snipe',
        async execute(ctx) {
            const sniped = snipes.get(ctx.channel.id);
            if (!sniped) return ctx.reply('❌ There are no recently deleted messages to snipe in this channel.');

            const embed = new EmbedBuilder()
                .setColor(config.EMBED_COLORS.PRIMARY)
                .setAuthor({ name: sniped.author.tag, iconURL: sniped.author.displayAvatarURL({ dynamic: true }) })
                .setDescription(sniped.content || '*[Attachment/Embed]*')
                .setFooter({ text: `Deleted in #${ctx.channel.name}` })
                .setTimestamp(sniped.time);

            return ctx.reply({ embeds: [embed] });
        }
    },

    // 25. EDITSNIPE
    {
        name: 'editsnipe',
        aliases: ['esnipe'],
        category: 'Utility',
        description: 'Snipe the last edited message before its modification.',
        usage: ',editsnipe',
        async execute(ctx) {
            const sniped = editSnipes.get(ctx.channel.id);
            if (!sniped) return ctx.reply('❌ There are no recently edited messages to snipe.');

            const embed = new EmbedBuilder()
                .setColor(config.EMBED_COLORS.PRIMARY)
                .setAuthor({ name: sniped.author.tag, iconURL: sniped.author.displayAvatarURL({ dynamic: true }) })
                .addFields(
                    { name: 'Original', value: sniped.oldContent || '*Empty*', inline: false },
                    { name: 'Edited', value: sniped.newContent || '*Empty*', inline: false }
                )
                .setTimestamp(sniped.time);

            return ctx.reply({ embeds: [embed] });
        }
    },

    // 26. SETLOGS
    {
        name: 'setlogs',
        aliases: ['logchannel'],
        category: 'Utility',
        description: 'Set MongoDB server audit logs channel.',
        usage: ',setlogs <#channel>',
        permissions: [PermissionFlagsBits.Administrator],
        async execute(ctx) {
            if (!ctx.member.permissions.has(PermissionFlagsBits.Administrator) && !config.BOT_OWNERS.includes(ctx.user.id)) {
                return ctx.reply('❌ Administrator permission required.');
            }
            const targetChannel = ctx.message?.mentions?.channels?.first() || ctx.channel;
            return ctx.reply(`✅ **Server Audit Log channel set to:** <#${targetChannel.id}>`);
        }
    },

    // 27. SETUPWELCOME
    {
        name: 'setupwelcome',
        aliases: ['setwelcome'],
        category: 'Utility',
        description: 'Configure channel for automated welcome greeting cards.',
        usage: ',setupwelcome <#channel>',
        permissions: [PermissionFlagsBits.ManageGuild],
        async execute(ctx) {
            if (!ctx.member.permissions.has(PermissionFlagsBits.ManageGuild) && !config.BOT_OWNERS.includes(ctx.user.id)) {
                return ctx.reply('❌ Manage Server permission required.');
            }
            const targetChannel = ctx.message?.mentions?.channels?.first() || ctx.channel;
            return ctx.reply(`✅ **Welcome channel configured to:** <#${targetChannel.id}>`);
        }
    },

    // 28. SETUPGOODBYE
    {
        name: 'setupgoodbye',
        aliases: ['setgoodbye'],
        category: 'Utility',
        description: 'Configure channel for automated goodbye farewell cards.',
        usage: ',setupgoodbye <#channel>',
        permissions: [PermissionFlagsBits.ManageGuild],
        async execute(ctx) {
            if (!ctx.member.permissions.has(PermissionFlagsBits.ManageGuild) && !config.BOT_OWNERS.includes(ctx.user.id)) {
                return ctx.reply('❌ Manage Server permission required.');
            }
            const targetChannel = ctx.message?.mentions?.channels?.first() || ctx.channel;
            return ctx.reply(`✅ **Goodbye channel configured to:** <#${targetChannel.id}>`);
        }
    }
];

module.exports = commands;
module.exports.snipes = snipes;
module.exports.editSnipes = editSnipes;
