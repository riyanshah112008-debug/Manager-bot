// ==========================================
// 🔞 STARRY MATURE, ANIME & MASCOT COMMANDS (7 COMMANDS)
// File Path: src/commands/bundles/nsfwCommands.js
// Default OFF • Server & DM Toggles • AI Explainer • Starry Mascot Persona
// ==========================================
const { 
    EmbedBuilder, 
    ActionRowBuilder, 
    ButtonBuilder, 
    ButtonStyle, 
    PermissionFlagsBits 
} = require('discord.js');
const ServerSettings = require('../../models/ServerSettings');
const { isNsfwAllowed, fetchAnimeImage, explainNsfwWithAI, dmNsfwUsers } = require('../../modules/nsfwModule');
const { buildStarryCharacterCard, STARRY_MASCOT } = require('../../utils/aiEngine');
const config = require('../../config');

const commands = [
    // 1. NSFW MASTER CONTROLLER & AI EXPLAINER
    {
        name: 'nsfw',
        aliases: ['nsfwtoggle', 'mature', '18plus', 'nsfwconfig'],
        category: 'Utility',
        description: 'Configure, toggle, or ask AI to explain the Mature / Anime NSFW module.',
        usage: ',nsfw [on | off | info | ai | dms on | dms off]',
        async execute(ctx) {
            const sub = ctx.args[0]?.toLowerCase();

            // 1. AI Explainer Subcommand
            if (sub === 'info' || sub === 'ai' || sub === 'explain' || sub === 'help' || sub === 'about') {
                await ctx.defer(false);
                const embed = await explainNsfwWithAI(ctx);
                return ctx.reply({ embeds: [embed] });
            }

            // 2. DM Opt-In Subcommands
            if (sub === 'dms' || sub === 'dm') {
                const dmChoice = ctx.args[1]?.toLowerCase();
                if (dmChoice === 'on' || dmChoice === 'enable') {
                    dmNsfwUsers.add(ctx.user.id);
                    return ctx.reply('🔞 **Mature Anime Mode Enabled in DMs!**\n*You have opted in to receive anime waifu and mature art in private DMs.*');
                } else if (dmChoice === 'off' || dmChoice === 'disable') {
                    dmNsfwUsers.delete(ctx.user.id);
                    return ctx.reply('🔒 **Mature Anime Mode Disabled in DMs.**');
                } else {
                    const status = dmNsfwUsers.has(ctx.user.id);
                    return ctx.reply(`🔞 **DM Mature Status:** \`${status ? '🟢 ENABLED' : '🔴 DISABLED (Default)'}\`\n*Use \`,nsfw dms on\` or \`,nsfw dms off\` to toggle.*`);
                }
            }

            // 3. Server Toggles (Requires Administrator)
            if (!ctx.guild) {
                return ctx.reply('💬 **You are in Direct Messages!**\n*Use `,nsfw dms on` or `,nsfw dms off` to toggle mature mode in DMs, or `,nsfw ai` to ask Starry AI about this module.*');
            }

            let settings = await ServerSettings.findOne({ guildId: ctx.guild.id });
            if (!settings) {
                settings = await ServerSettings.create({ guildId: ctx.guild.id });
            }

            const isAdmin = ctx.member?.permissions?.has(PermissionFlagsBits.Administrator) || config.BOT_OWNERS.includes(ctx.user.id);

            if (sub === 'on' || sub === 'enable') {
                if (!isAdmin) return ctx.reply('❌ **Administrator permission required** to enable NSFW module.');
                if (!settings.nsfw) settings.nsfw = {};
                settings.nsfw.enabled = true;
                await settings.save();

                return ctx.reply(
                    `🔞 **NSFW Module ENABLED for ${ctx.guild.name}!**\n\n` +
                    `> ⚠️ **Important:** Commands will **strictly execute in channels marked as Age-Restricted (NSFW)** in Discord channel settings.\n` +
                    `> 💡 *Ask AI about features:* \`,nsfw info\``
                );
            }

            if (sub === 'off' || sub === 'disable') {
                if (!isAdmin) return ctx.reply('❌ **Administrator permission required** to disable NSFW module.');
                if (!settings.nsfw) settings.nsfw = {};
                settings.nsfw.enabled = false;
                await settings.save();

                return ctx.reply(`🔒 **NSFW Module DISABLED for ${ctx.guild.name}.** No mature commands can be executed.`);
            }

            // 4. Default: Show Current Status & Interactive Control Panel
            const currentStatus = settings.nsfw?.enabled || false;
            const embed = new EmbedBuilder()
                .setColor(currentStatus ? '#FF69B4' : '#2B2D31')
                .setAuthor({ name: `${ctx.guild.name} • NSFW Settings`, iconURL: ctx.guild.iconURL({ dynamic: true }) })
                .setTitle('🔞 Mature & Anime NSFW System')
                .setDescription(
                    `**Current Server Status:** \`${currentStatus ? '🟢 ACTIVE (Age-Restricted Channels Only)' : '🔴 DISABLED (Default for all servers)'}\`\n\n` +
                    `The mature anime module is **100% disabled by default** to ensure server safety.\n\n` +
                    `**Commands Available:**\n` +
                    `• \`,nsfw on\` — Enable NSFW module (Admin Only)\n` +
                    `• \`,nsfw off\` — Disable NSFW module (Admin Only)\n` +
                    `• \`,nsfw info\` — **Ask Starry AI** to explain what features are in this module\n` +
                    `• \`,nsfw dms on/off\` — Toggle mature mode for your private DMs`
                )
                .setFooter({ text: 'Strict Age-Restricted Verification Active • Prefix: ,' })
                .setTimestamp();

            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('nsfw_ai_explain').setLabel('🤖 Ask AI About NSFW').setStyle(ButtonStyle.Primary).setEmoji('✨'),
                new ButtonBuilder().setCustomId('nsfw_toggle_server').setLabel(currentStatus ? 'Disable NSFW' : 'Enable NSFW').setStyle(currentStatus ? ButtonStyle.Danger : ButtonStyle.Success).setEmoji('🔞')
            );

            return ctx.reply({ embeds: [embed], components: [row] });
        }
    },

    // 2. STARRY MASCOT CHARACTER & PERSONA
    {
        name: 'starry',
        aliases: ['character', 'mascot', 'persona', 'astraea', 'starrychan'],
        category: 'Utility',
        description: 'View the official Starry anime mascot profile, lore, powers, and voice lines.',
        usage: ',starry',
        async execute(ctx) {
            const payload = buildStarryCharacterCard(ctx.user);
            return ctx.reply(payload);
        }
    },

    // 3. WAIFU (Anime Waifu Art)
    {
        name: 'waifu',
        category: 'Fun',
        description: 'Get a beautiful anime waifu artwork (SFW/NSFW aware).',
        usage: ',waifu',
        async execute(ctx) {
            const nsfwStatus = await isNsfwAllowed(ctx);
            if (nsfwStatus === 'CHANNEL_NOT_NSFW') {
                return ctx.reply('🔞 **This channel is not marked as Age-Restricted (NSFW)!** Please use an NSFW channel or run `,nsfw info`.');
            }

            const isMature = nsfwStatus === true;
            const imgUrl = await fetchAnimeImage('waifu', isMature);

            const embed = new EmbedBuilder()
                .setColor('#FF69B4')
                .setTitle(`🌸 Anime Waifu Gallery ${isMature ? '(18+ Mature)' : '(SFW)'}`)
                .setImage(imgUrl)
                .setFooter({ text: `Requested by ${ctx.user.username} • Starry Anime Suite` })
                .setTimestamp();

            return ctx.reply({ embeds: [embed] });
        }
    },

    // 4. NEKO (Anime Catgirl Art)
    {
        name: 'neko',
        category: 'Fun',
        description: 'Get a cute anime neko catgirl artwork.',
        usage: ',neko',
        async execute(ctx) {
            const nsfwStatus = await isNsfwAllowed(ctx);
            if (nsfwStatus === 'CHANNEL_NOT_NSFW') {
                return ctx.reply('🔞 **This channel is not marked as Age-Restricted (NSFW)!** Please use an NSFW channel.');
            }

            const isMature = nsfwStatus === true;
            const imgUrl = await fetchAnimeImage('neko', isMature);

            const embed = new EmbedBuilder()
                .setColor('#FF94D2')
                .setTitle(`🐱 Anime Neko Gallery ${isMature ? '(18+ Mature)' : '(SFW)'}`)
                .setImage(imgUrl)
                .setFooter({ text: `Requested by ${ctx.user.username} • Starry Anime Suite` })
                .setTimestamp();

            return ctx.reply({ embeds: [embed] });
        }
    },

    // 5. BLOWKISS / KISS (Anime Romance Gifs)
    {
        name: 'blowkiss',
        aliases: ['kiss2'],
        category: 'Social',
        description: 'Send an expressive anime blowkiss to someone special in chat.',
        usage: ',blowkiss [@user]',
        async execute(ctx) {
            const target = ctx.message?.mentions?.users?.first() || ctx.user;
            const imgUrl = await fetchAnimeImage('kiss', false);

            const embed = new EmbedBuilder()
                .setColor('#FF79C6')
                .setDescription(
                    target.id === ctx.user.id 
                        ? `**${ctx.user.username}** blows a sweet starlight kiss to everyone! ✨💋`
                        : `**${ctx.user.username}** blows a passionate kiss to **<@${target.id}>**! 💋✨`
                )
                .setImage(imgUrl)
                .setFooter({ text: 'Starry Romance Actions • Prefix: ,' })
                .setTimestamp();

            return ctx.reply({ embeds: [embed] });
        }
    },

    // 6. ECCHI (Anime Artwork - Strict NSFW Channel Only)
    {
        name: 'ecchi',
        category: 'Fun',
        description: 'Get mature anime artwork (Strictly NSFW Channels Only).',
        usage: ',ecchi',
        async execute(ctx) {
            const nsfwStatus = await isNsfwAllowed(ctx);
            if (!nsfwStatus || nsfwStatus === 'CHANNEL_NOT_NSFW') {
                return ctx.reply('🔞 **Access Denied**: The NSFW module is either disabled or this channel is not marked as Age-Restricted (NSFW) in Discord.\n*Ask an Admin to run `,nsfw on` in an NSFW channel.*');
            }

            const imgUrl = await fetchAnimeImage('waifu', true);

            const embed = new EmbedBuilder()
                .setColor('#ED4245')
                .setTitle('🔞 Anime Ecchi Artwork (18+)')
                .setImage(imgUrl)
                .setFooter({ text: `Requested by ${ctx.user.username} • Strict 18+ Verification` })
                .setTimestamp();

            return ctx.reply({ embeds: [embed] });
        }
    }
];

module.exports = commands;
