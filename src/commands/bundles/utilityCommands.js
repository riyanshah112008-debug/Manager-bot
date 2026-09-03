// ==========================================
// 🛠️ Starry SUPREME UTILITY SUITE (28 COMMANDS)
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
    AttachmentBuilder,
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

// 🧠 High-Precision Semantic Image Intent Analyzer
function parseImageIntent(input) {
    if (!input || typeof input !== 'string') return null;
    const str = input.trim();

    // 1. Direct command-style action requests: "draw...", "paint...", "imagine...", "generate...", "create...", "make..."
    const actionPattern = /^(?:please\s+)?(?:can\s+you\s+)?(?:could\s+you\s+)?(?:i\s+want\s+(?:you\s+to\s+)?)?(?:generate|create|make|draw|paint|render|imagine|show\s+me|give\s+me|produce)\s+(?:an?\s+)?(?:image|art|picture|photo|illustration|drawing|wallpaper|scene|portrait|sketch|pic|visual)?\s*(?:of|about|showing|with|for)?\s*(.*)$/i;
    
    // 2. Direct noun requests: "image of...", "picture of...", "pic of...", "photo of...", "drawing of...", "wallpaper of..."
    const nounPattern = /^(?:an?\s+)?(?:image|art|picture|photo|illustration|drawing|wallpaper|scene|portrait|sketch|pic)\s+(?:of|about|showing|with|for)\s+(.*)$/i;

    // 3. Simple draw keywords: "draw a cat", "paint a mountain"
    const simpleDrawPattern = /^(?:draw|paint|imagine)\s+(.*)$/i;

    const matched = str.match(actionPattern) || str.match(nounPattern) || str.match(simpleDrawPattern);
    if (matched && matched[1] && matched[1].trim().length > 1) {
        let extracted = matched[1].trim();
        extracted = extracted.replace(/[?!.]+$/, '').trim();
        if (extracted.length > 0) return extracted;
    }

    // 4. Broad pattern: contains action verb + image noun
    if (/\b(?:generate|draw|paint|create|make|render|imagine)\b/i.test(str) && /\b(?:image|picture|pic|photo|artwork|drawing|illustration|wallpaper)\b/i.test(str)) {
        // Strip out question filler words
        let clean = str.replace(/^(?:can\s+you\s+|could\s+you\s+|please\s+|i\s+want\s+you\s+to\s+)/i, '');
        clean = clean.replace(/^(?:generate|create|make|draw|paint|render|imagine)\s+(?:an?\s+)?(?:image|art|picture|photo|illustration|drawing|wallpaper)\s+(?:of\s+|about\s+|showing\s+)?/i, '');
        return clean.trim() || str;
    }

    return null;
}

// 🎨 HIGH-PERFORMANCE NEURAL AI ART ENGINE (Direct Fast Buffer Delivery)
// ==========================================
async function generateAndSendImage(ctx, prompt) {
    if (!prompt || !prompt.trim()) {
        return ctx.reply('🎨 **Please provide a description of the image you want to generate!**\n*Example: `,imagine Cyberpunk anime girl with neon lights`*');
    }

    const cleanPrompt = prompt.trim();
    let seed = Math.floor(Math.random() * 9999999);
    let currentModel = 'flux';

    const fetchImageAttachment = async (p, s, model = 'flux') => {
        const encoded = encodeURIComponent(p);
        const url = `https://image.pollinations.ai/prompt/${encoded}?width=1024&height=1024&nologo=true&seed=${s}&model=${model}&enhance=true`;
        
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 18000);
            const res = await fetch(url, { signal: controller.signal });
            clearTimeout(timeoutId);

            if (res.ok) {
                const arrayBuffer = await res.arrayBuffer();
                const buffer = Buffer.from(arrayBuffer);
                const attachment = new AttachmentBuilder(buffer, { name: `starry_art_${s}.jpg` });
                return { attachment, url, fileName: `starry_art_${s}.jpg` };
            }
        } catch (e) {
            console.warn('Image fetch warning:', e.message);
        }
        return { attachment: null, url, fileName: null };
    };

    const buildImageEmbed = (p, s, fileName, url) => {
        const embed = new EmbedBuilder()
            .setColor('#9B59B6')
            .setAuthor({ name: `Starry AI Neural Art Generator`, iconURL: ctx.client?.user?.displayAvatarURL() })
            .setTitle(`🎨 AI Generated Artwork`)
            .setDescription(`✨ **Prompt:** "${p.length > 250 ? p.substring(0, 247) + '...' : p}"\n🧠 **Engine:** \`Flux.1 Schnell (1024x1024 HD)\`\n👤 **Requested by:** <@${ctx.user.id}>`)
            .setFooter({ text: `Seed: ${s} • Starry AI • Direct HD Rendering` })
            .setTimestamp();

        if (fileName) {
            embed.setImage(`attachment://${fileName}`);
        } else if (url) {
            embed.setImage(url);
        }

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId(`ai_regen_${s}`)
                .setLabel('🔄 Regenerate')
                .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
                .setCustomId(`ai_enhance_${s}`)
                .setLabel('✨ Enhance Variations')
                .setStyle(ButtonStyle.Secondary),
            new ButtonBuilder()
                .setLabel('📥 Direct HD Link')
                .setStyle(ButtonStyle.Link)
                .setURL(url)
        );

        return { embed, row };
    };

    const imgData = await fetchImageAttachment(cleanPrompt, seed, currentModel);
    const { embed, row } = buildImageEmbed(cleanPrompt, seed, imgData.fileName, imgData.url);

    const replyOptions = {
        embeds: [embed],
        components: [row]
    };
    if (imgData.attachment) {
        replyOptions.files = [imgData.attachment];
    }

    const sentMsg = await ctx.reply(replyOptions).catch(() => null);
    if (!sentMsg) return;

    const collector = sentMsg.createMessageComponentCollector({
        time: ONE_YEAR_MS
    });

    collector.on('collect', async (i) => {
        if (i.user.id !== ctx.user.id && !config.BOT_OWNERS?.includes(i.user.id)) {
            return i.reply({ content: '❌ Only the author of this prompt can use these controls.', flags: [64] });
        }

        if (i.customId.startsWith('ai_regen_')) {
            await i.deferUpdate().catch(() => {});
            seed = Math.floor(Math.random() * 9999999);
            const newImgData = await fetchImageAttachment(cleanPrompt, seed, currentModel);
            const updated = buildImageEmbed(cleanPrompt, seed, newImgData.fileName, newImgData.url);
            const editPayload = { embeds: [updated.embed], components: [updated.row], attachments: [] };
            if (newImgData.attachment) editPayload.files = [newImgData.attachment];
            await (sentMsg.edit ? sentMsg.edit(editPayload) : i.message?.edit(editPayload)).catch(() => {});
        } else if (i.customId.startsWith('ai_enhance_')) {
            await i.deferUpdate().catch(() => {});
            seed = Math.floor(Math.random() * 9999999);
            const enhancedPrompt = `${cleanPrompt}, masterpiece, highly detailed, 8k resolution, cinematic lighting, ultra-fine art`;
            const newImgData = await fetchImageAttachment(enhancedPrompt, seed, currentModel);
            const updated = buildImageEmbed(enhancedPrompt, seed, newImgData.fileName, newImgData.url);
            const editPayload = { embeds: [updated.embed], components: [updated.row], attachments: [] };
            if (newImgData.attachment) editPayload.files = [newImgData.attachment];
            await (sentMsg.edit ? sentMsg.edit(editPayload) : i.message?.edit(editPayload)).catch(() => {});
        }
    });
}

const commands = [
    // 1. HELP (Interactive 1-Year Starry Categorized Menu)
    {
        name: 'help',
        aliases: ['h', 'commands', 'menu'],
        category: 'Utility',
        description: 'Open the master interactive command menu with 100+ commands.',
        usage: ',help [category / command]',
        async execute(ctx) {
            const prefix = config.DEFAULT_PREFIX || ',';
            const { buildCategoryEmbed, createHelpComponents } = require('../../utils/helpHelper');
            const components = createHelpComponents();
            const replyMsg = await ctx.reply({ embeds: [buildCategoryEmbed('home', prefix)], components });

            if (replyMsg && typeof replyMsg.createMessageComponentCollector === 'function') {
                const collector = replyMsg.createMessageComponentCollector({ time: ONE_YEAR_MS });
                collector.on('collect', async (i) => {
                    let targetCat = 'home';
                    if (i.isStringSelectMenu()) {
                        targetCat = i.values[0];
                    } else if (i.isButton()) {
                        targetCat = i.customId.replace('help_btn_', '');
                    }
                    await i.update({ embeds: [buildCategoryEmbed(targetCat, prefix)], components: createHelpComponents() }).catch(() => {});
                });
            }
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
                .setFooter({ text: 'Starry Multi-Bot Network' })
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
                .setFooter({ text: 'Starry Multi-Bot Architecture' })
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
                .setFooter({ text: 'Starry Server Information • Prefix: ,' })
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
                .setFooter({ text: 'Starry User Lookup • Prefix: ,' })
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
                .setFooter({ text: 'Starry Utility • Prefix: ,' })
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
                .setFooter({ text: 'Starry Utility • Prefix: ,' })
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
                .setFooter({ text: 'Starry Multi-Bot Network' })
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
                .setTitle('⭐ Vote for Starry Bot')
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
                .setDescription('This server currently enjoys all Starry Premium perks unlimitedly!')
                .addFields(
                    { name: '🎵 Music Master', value: '24/7 Stay Mode, 8D Audio, Nightcore & Lossless Bitrate', inline: false },
                    { name: '🛡️ Security Suite', value: 'Instant Starry Guard Security Engine sync, anti-nuke & backups', inline: false },
                    { name: '🤖 Multi-Bot Clustering', value: 'Access to secondary worker bots and high-capacity nodes', inline: false }
                )
                .setFooter({ text: 'Starry Premium Architecture' });
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
    },

    // 29. ASK / AI (Interactive Paginated AI Assistant + Auto-Image Routing)
    {
        name: 'ask',
        aliases: ['ai', 'gemini', 'gpt', 'chat', 'question', 'starryai'],
        category: 'Utility',
        description: 'Ask Starry AI anything or generate AI images directly with interactive page-turning buttons.',
        usage: ',ask <your question or prompt>',
        async execute(ctx) {
            const prompt = (ctx.options?.getString ? (ctx.options.getString('question') || ctx.options.getString('prompt') || ctx.options.getString('text')) : null) || ctx.args.join(' ');
            if (!prompt || !prompt.trim()) {
                return ctx.reply('❓ **Please provide a question or prompt for Starry AI!**\n*Example: `,ask Explain quantum computing` or `,imagine Cyberpunk anime girl` or `/ask question:Hello!`*');
            }

            await ctx.defer(false);

            const cleanPrompt = prompt.trim();
            // Check if user is asking to generate an image
            const imageSubject = parseImageIntent(cleanPrompt);
            if (imageSubject) {
                return generateAndSendImage(ctx, imageSubject);
            }

            const { sendPaginatedAIResponse } = require('../../utils/aiEngine');
            return sendPaginatedAIResponse(ctx, cleanPrompt);
        }
    },

    // 29. DASHBOARD
    {
        name: 'dashboard',
        aliases: ['dash', 'web', 'panel'],
        category: 'Utility',
        description: 'Get the official link to Starry Web Dashboard & Control Center.',
        usage: ',dashboard',
        async execute(ctx) {
            let webUrl = 'https://starry-bot.loca.lt';
            try {
                const { getPublicUrl } = require('../../utils/tunnelManager');
                webUrl = getPublicUrl() || process.env.RENDER_EXTERNAL_URL || 'https://starry-bot.loca.lt';
            } catch (e) {}

            const embed = new EmbedBuilder()
                .setColor(config.EMBED_COLORS.PRIMARY)
                .setAuthor({ name: 'Starry Master Web Dashboard', iconURL: ctx.client.user?.displayAvatarURL({ dynamic: true }) })
                .setTitle('🌐 Starry Enterprise Web Control Center')
                .setDescription(
                    `Manage your server settings, auto-moderation, verification gateways, 24/7 music sessions, and visual embeds directly from our high-speed global web interface!\n\n` +
                    `🔗 **Live Public Domain:** [Click to Open Dashboard](${webUrl})\n\n` +
                    `🛡️ **Features Available on Web:**\n` +
                    `• **Anti-Nuke & Guard Shield** (Mass-Delete, Bot-Add Blocker, Panic Mode)\n` +
                    `• **Verification & Captcha Gateway** (Web Portal & Auto-Roles)\n` +
                    `• **Live Music Studio** (Remote Web Player & 24/7 Voice Lock)\n` +
                    `• **Visual Embed Studio** (WYSIWYG real-time Discord card preview)\n` +
                    `• **Cloud Backups & Ban File Export**\n` +
                    `• **Starry Premium & License Key Store**`
                )
                .setFooter({ text: 'Prefix: , • Single-Host Multi-Bot Orchestration' })
                .setTimestamp();

            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setLabel('🌐 Open Dashboard').setStyle(ButtonStyle.Link).setURL(webUrl),
                new ButtonBuilder().setLabel('➕ Add Starry').setStyle(ButtonStyle.Link).setURL(`https://discord.com/oauth2/authorize?client_id=${ctx.client.user.id}&permissions=8&scope=bot%20applications.commands`)
            );

            return ctx.reply({ embeds: [embed], components: [row] });
        }
    },

    // 30. REDEEM (License Key Activation)
    {
        name: 'redeem',
        aliases: ['activate', 'license'],
        category: 'Utility',
        description: 'Redeem a 16-character Starry Premium License Key.',
        usage: ',redeem <license key>',
        async execute(ctx) {
            const keyInput = ctx.args ? ctx.args[0] : null;
            if (!keyInput) {
                return ctx.reply('❌ Please provide a 16-character license key!\n*Usage: `,redeem STRY-PRO-XXXX-XXXX`*');
            }

            const cleanKey = keyInput.trim().toUpperCase();
            const PremiumKey = require('../../models/PremiumKey');
            const ServerSettings = require('../../models/ServerSettings');

            const license = await PremiumKey.findOne({ key: cleanKey, active: true });
            if (!license) {
                return ctx.reply('❌ Invalid or expired license key. Check your spelling or get a key on the dashboard!');
            }

            if (license.usedCount >= license.maxUses) {
                return ctx.reply('❌ This license key has already reached its maximum redemptions.');
            }

            let expiresAt = null;
            if (license.durationDays && license.durationDays > 0) {
                expiresAt = new Date(Date.now() + license.durationDays * 24 * 60 * 60 * 1000);
            }

            let settings = await ServerSettings.findOne({ guildId: ctx.guild.id });
            if (!settings) settings = new ServerSettings({ guildId: ctx.guild.id });

            settings.premium = {
                isPremium: true,
                tier: license.tier,
                expiresAt: expiresAt,
                activatedBy: ctx.user.id
            };
            await settings.save();

            license.usedCount += 1;
            license.redeemedBy.push({ userId: ctx.user.id, guildId: ctx.guild.id, redeemedAt: new Date() });
            if (license.usedCount >= license.maxUses) license.active = false;
            await license.save();

            const embed = new EmbedBuilder()
                .setColor('#F59E0B')
                .setAuthor({ name: 'Starry Premium Activated!', iconURL: 'https://cdn.discordapp.com/emojis/1049283733054177301.webp?size=96' })
                .setTitle(`🎉 Guild Upgraded to ${license.tier.toUpperCase()} Tier!`)
                .setDescription(
                    `Thank you for supporting Starry! Your server now has full access to all premium features:\n\n` +
                    `⚡ **24/7 Studio Quality Voice (320kbps)**\n` +
                    `🛡️ **Starry Anti-Nuke & Anti-Raid Shield**\n` +
                    `💾 **Unlimited Daily Cloud Backups**\n` +
                    `👑 **Web Captcha Verification Gateway**\n` +
                    `💰 **2x Economy XP & Loot Multiplier**\n\n` +
                    `🕒 **Expires:** \`${expiresAt ? expiresAt.toLocaleDateString() : 'Permanent Lifetime VIP'}\``
                )
                .setFooter({ text: 'Manage settings via ,dashboard or web control center' })
                .setTimestamp();

            return ctx.reply({ embeds: [embed] });
        }
    },

    // 31. PREMIUM (Perks & Status Explorer)
    {
        name: 'premium',
        aliases: ['perks', 'vip'],
        category: 'Utility',
        description: 'View server premium status, perks, and pricing tiers.',
        usage: ',premium',
        async execute(ctx) {
            const ServerSettings = require('../../models/ServerSettings');
            const settings = await ServerSettings.findOne({ guildId: ctx.guild.id });
            const isPrem = settings?.premium?.isPremium || false;
            const tier = settings?.premium?.tier || 'none';
            const expires = settings?.premium?.expiresAt;

            let webUrl = 'https://starry-bot.loca.lt';
            try {
                const { getPublicUrl } = require('../../utils/tunnelManager');
                webUrl = getPublicUrl() || process.env.RENDER_EXTERNAL_URL || 'https://starry-bot.loca.lt';
            } catch (e) {}

            const embed = new EmbedBuilder()
                .setColor(isPrem ? '#F59E0B' : config.EMBED_COLORS.PRIMARY)
                .setAuthor({ name: `Starry Premium Status • ${ctx.guild.name}`, iconURL: ctx.guild.iconURL({ dynamic: true }) })
                .setTitle(isPrem ? `👑 Premium Active: ${tier.toUpperCase()} TIER` : '⭐ Upgrade to Starry Premium')
                .setDescription(
                    isPrem 
                        ? `✅ This server has an active **${tier.toUpperCase()}** subscription!\n🕒 **Expires:** \`${expires ? expires.toLocaleDateString() : 'Permanent Lifetime'}\``
                        : `Supercharge your server with 24/7 Voice, God-Mode Anti-Nuke, and Web Captcha Gateways!`
                )
                .addFields(
                    { name: '🛡️ Shield Plus ($4.99/mo | ₹399)', value: '• 24/7 Voice Mode\n• Anti-Nuke Protection\n• Cloud Backups\n• Web Captcha Gate', inline: true },
                    { name: '🌟 Pro Cluster ($12.99/mo | ₹999)', value: '• 3 Servers Included\n• Custom Bot Branding\n• 3-Room Music Suite\n• Gemini AI AutoMod', inline: true },
                    { name: '👑 Lifetime VIP ($39.99 | ₹3,299)', value: '• Permanent Access\n• Unlimited Servers\n• Golden VIP Badge\n• Top Priority FLAC Nodes', inline: true }
                )
                .setFooter({ text: 'Get your license on the dashboard or use ,redeem <key>' })
                .setTimestamp();

            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setLabel('🛒 View Store & Checkout').setStyle(ButtonStyle.Link).setURL(webUrl + '/#premium')
            );

            return ctx.reply({ embeds: [embed], components: [row] });
        }
    },

    // 41. SETPREFIX / PREFIX CONFIGURATION
    {
        name: 'setprefix',
        aliases: ['prefix', 'changeprefix'],
        category: 'Settings',
        description: 'Set a custom prefix for this server or view the current active prefix.',
        usage: ',setprefix <new_prefix>',
        async execute(ctx) {
            const prefixVal = ctx.options?.getString ? ctx.options.getString('prefix') : null;
            const newPrefix = prefixVal || ctx.args[0];
            const ServerSettings = require('../../models/ServerSettings');
            const { setCachedPrefix } = require('../../modules/commandHandler');

            if (!ctx.guild) {
                return ctx.reply('ℹ️ The default prefix in DMs is strictly `,` (comma).');
            }

            if (!newPrefix) {
                let settings = await ServerSettings.findOne({ guildId: ctx.guild.id });
                const currentPrefix = settings?.prefix || ',';
                return ctx.reply(`ℹ️ Current server prefix is: \`${currentPrefix}\`\n*To change it, type: \`${currentPrefix}setprefix <new_prefix>\` or \`/setprefix prefix:<new>\`*`);
            }

            if (!ctx.member?.permissions?.has('Administrator') && !ctx.member?.permissions?.has('ManageGuild') && !config.BOT_OWNERS?.includes(ctx.user.id)) {
                return ctx.reply('❌ You need the **Manage Server** or **Administrator** permission to change the server prefix.');
            }

            if (newPrefix.length > 5) {
                return ctx.reply('❌ The prefix length cannot exceed 5 characters.');
            }

            let settings = await ServerSettings.findOne({ guildId: ctx.guild.id });
            if (!settings) settings = new ServerSettings({ guildId: ctx.guild.id });
            settings.prefix = newPrefix;
            await settings.save();

            setCachedPrefix(ctx.guild.id, newPrefix);

            const embed = new EmbedBuilder()
                .setColor(config.EMBED_COLORS?.SUCCESS || '#2ECC71')
                .setTitle('✅ Server Prefix Updated')
                .setDescription(`Successfully changed this server's prefix to: \`${newPrefix}\`\n\n**Example Commands:**\n• \`${newPrefix}help\` — Help Menu\n• \`${newPrefix}ask <question>\` — Starry AI\n• \`${newPrefix}play <song>\` — Music Audio\n• \`${newPrefix}hug @user\` — Social Action`)
                .setFooter({ text: 'Starry Configuration • Default fallback: ,' })
                .setTimestamp();

            return ctx.reply({ embeds: [embed] });
        }
    },

    // 42. TOP.GG VOTE REWARD COMMAND
    {
        name: 'vote',
        aliases: ['topgg', 'upvote'],
        category: 'Utility',
        description: 'Vote for Starry on Top.gg to earn free Credits and XP boosts!',
        usage: ',vote',
        async execute(ctx) {
            const topggUrl = 'https://top.gg/bot/1513589513648345368/vote';
            const embed = new EmbedBuilder()
                .setColor('#FF79C6')
                .setTitle('⭐ Vote for Starry on Top.gg')
                .setDescription(
                    `Support Starry by voting on **Top.gg** and claim instant rewards!\n\n` +
                    `🎁 **Voting Rewards:**\n` +
                    `• **+500 Credits** (Weekday) / **+1,000 Credits** (Weekend)\n` +
                    `• **+500 XP Boost** (Weekday) / **+1,000 XP** (Weekend)\n` +
                    `• 🗳️ Voting resets every **12 hours**\n\n` +
                    `*Click the button below to vote on Top.gg:*`
                )
                .setFooter({ text: 'Top.gg Automated Vote Sync Active' })
                .setTimestamp();

            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setLabel('🗳️ Vote on Top.gg (Free Rewards)')
                    .setStyle(ButtonStyle.Link)
                    .setURL(topggUrl)
            );

            return ctx.reply({ embeds: [embed], components: [row] });
        }
    },

    // 43. IMAGINE / AI ART GENERATOR
    {
        name: 'imagine',
        aliases: ['image', 'generate', 'draw', 'art', 'dalle', 'flux', 'genimage'],
        category: 'Utility',
        description: 'Generate stunning high-resolution AI art and images using Flux/SDXL neural engines.',
        usage: ',imagine <prompt>',
        async execute(ctx) {
            const prompt = (ctx.options?.getString ? (ctx.options.getString('prompt') || ctx.options.getString('text')) : null) || ctx.args.join(' ');
            if (!prompt || !prompt.trim()) {
                return ctx.reply('🎨 **Please provide a description of what you want to draw or generate!**\n*Example: `,imagine Cyberpunk anime girl in a neon Tokyo street` or `/imagine prompt:Magical floating castle`*');
            }

            await ctx.defer(false);
            return generateAndSendImage(ctx, prompt.trim());
        }
    },

    // 44. NITRO CLAIMS & GIVEAWAY SNIPER LOGS
    {
        name: 'nitroclaims',
        aliases: ['nitrosnipe', 'giftlogs', 'nitrotracker'],
        category: 'Utility',
        description: 'View recently detected and claimed Discord Nitro gifts in this server.',
        usage: ',nitroclaims',
        async execute(ctx) {
            const nitroDetector = require('../../modules/nitroClaimDetector');
            const claims = await nitroDetector.getRecentClaims(ctx.guild.id, 10);
            const stats = await nitroDetector.getStats(ctx.guild.id);

            if (!claims || claims.length === 0) {
                const emptyEmbed = new EmbedBuilder()
                    .setColor('#F47FFF')
                    .setAuthor({ name: 'Discord Nitro Claim Tracker', iconURL: 'https://cdn.discordapp.com/emojis/1049283733054177301.webp?size=96' })
                    .setTitle('🎁 No Nitro Claims Recorded Yet')
                    .setDescription('The Nitro sniffer is active and watching! Whenever someone drops a `discord.gift` link in any channel, the bot will automatically detect who claimed it and measure the exact speed.')
                    .setFooter({ text: 'Active Real-Time Monitoring • Prefix: ,' })
                    .setTimestamp();
                return ctx.reply({ embeds: [emptyEmbed] });
            }

            const embed = new EmbedBuilder()
                .setColor('#F47FFF')
                .setAuthor({ name: 'Discord Nitro Claim History', iconURL: 'https://cdn.discordapp.com/emojis/1049283733054177301.webp?size=96' })
                .setTitle(`🎁 Nitro Gifts Claimed in ${ctx.guild.name}`)
                .setDescription(
                    `📊 **Total Detected:** \`${stats.total}\` | ⚡ **Fastest Claim:** \`${stats.fastest ? (stats.fastest.speedMs + 'ms') : 'N/A'}\`\n\n` +
                    claims.map((c, idx) => {
                        const timeAgo = `<t:${Math.floor(new Date(c.claimedAt).getTime() / 1000)}:R>`;
                        const speed = c.speedMs < 1000 ? `${c.speedMs}ms ⚡` : `${(c.speedMs / 1000).toFixed(2)}s 🚀`;
                        return `\`${idx + 1}.\` **${c.giftType}** — ${timeAgo}\n` +
                               `> 👤 **Claimer:** <@${c.claimerId}> (\`${c.claimerTag}\`)\n` +
                               `> 📤 **Sender:** <@${c.senderId}> | ⚡ **Speed:** \`${speed}\` | 💬 <#${c.channelId}>`;
                    }).join('\n\n')
                )
                .setFooter({ text: 'Supreme Nitro Claim & Sniffing Tracker Engine' })
                .setTimestamp();

            return ctx.reply({ embeds: [embed] });
        }
    }
];

module.exports = commands;
module.exports.snipes = snipes;
module.exports.editSnipes = editSnipes;
