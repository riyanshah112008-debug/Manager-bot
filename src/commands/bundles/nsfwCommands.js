// ==========================================
// 🔞 STARRY MATURE & ANIME NSFW COMMAND SUITE (14 COMMANDS)
// File Path: src/commands/bundles/nsfwCommands.js
// 100% Default OFF • Hidden in Help When Inactive • Strict Channel & DM Age Checks
// Anime Waifus, Nekos, Romantic Gifs & NSFW Social Interactions
// ==========================================
const { 
    EmbedBuilder, 
    ActionRowBuilder, 
    ButtonBuilder, 
    ButtonStyle, 
    PermissionFlagsBits 
} = require('discord.js');
const ServerSettings = require('../../models/ServerSettings');
const User = require('../../models/User');
const { isNsfwAllowed, fetchAnimeImage, explainNsfwWithAI, dmNsfwUsers } = require('../../modules/nsfwModule');
const { buildStarryCharacterCard, STARRY_MASCOT } = require('../../utils/aiEngine');
const config = require('../../config');

// In-memory social action counter for NSFW commands: action_user1_user2 -> count
const nsfwSocialCounts = new Map();

function getActionCount(action, u1, u2) {
    const key = `${action}_${[u1, u2].sort().join('_')}`;
    const count = (nsfwSocialCounts.get(key) || 0) + 1;
    nsfwSocialCounts.set(key, count);
    return count;
}

// Verified anime action GIFs
const NSFW_ACTION_GIFS = {
    kiss: [
        'https://media.giphy.com/media/G3va31oEEnIkM/giphy.gif',
        'https://media.giphy.com/media/wO4cyRJ70KVtwSTKE3/giphy.gif',
        'https://media.giphy.com/media/jR22gdcPiOLaE/giphy.gif',
        'https://media.giphy.com/media/nyGFcsP0kAobm/giphy.gif'
    ],
    hug: [
        'https://media.giphy.com/media/od5H3PmEG5EVq/giphy.gif',
        'https://media.giphy.com/media/lrr9rHuoJOE0w/giphy.gif',
        'https://media.giphy.com/media/wnsgren9NtITS/giphy.gif',
        'https://media.giphy.com/media/k95625LKWXPP2/giphy.gif'
    ],
    spank: [
        'https://media.giphy.com/media/Zau0yrl15oqdKURRnv/giphy.gif',
        'https://media.giphy.com/media/Gf3AUz3eBNbTW/giphy.gif',
        'https://media.giphy.com/media/mEtSQlxqBtWWA/giphy.gif'
    ],
    lick: [
        'https://media.giphy.com/media/134BfF8UiBiVUc/giphy.gif',
        'https://media.giphy.com/media/43Bbg5S2wTfQ145vpa/giphy.gif'
    ],
    cuddle: [
        'https://media.giphy.com/media/k95625LKWXPP2/giphy.gif',
        'https://media.giphy.com/media/49mdjsMrH7oze/giphy.gif',
        'https://media.giphy.com/media/4N1wOi78ZGzSB6aWm9/giphy.gif'
    ],
    touch: [
        'https://media.giphy.com/media/ARSp9T7wwxNcs/giphy.gif',
        'https://media.giphy.com/media/5tmRHwTlHAA9WkVxTU/giphy.gif'
    ]
};

function getRandomNsfwGif(action) {
    const list = NSFW_ACTION_GIFS[action] || NSFW_ACTION_GIFS.hug;
    return list[Math.floor(Math.random() * list.length)];
}

const commands = [
    // 1. NSFW MASTER CONTROLLER & AI EXPLAINER
    {
        name: 'nsfw',
        aliases: ['nsfwtoggle', 'mature', '18plus', 'nsfwconfig'],
        category: 'NSFW',
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

                return ctx.reply(`🔒 **NSFW Module DISABLED for ${ctx.guild.name}.** No mature commands can be executed and commands are hidden in help.`);
            }

            // 4. Default: Show Current Status & Interactive Control Panel
            const currentStatus = settings.nsfw?.enabled || false;
            const embed = new EmbedBuilder()
                .setColor(currentStatus ? '#FF69B4' : '#2B2D31')
                .setAuthor({ name: `${ctx.guild.name} • NSFW Settings`, iconURL: ctx.guild.iconURL({ dynamic: true }) })
                .setTitle('🔞 Mature & Anime NSFW System')
                .setDescription(
                    `**Current Server Status:** \`${currentStatus ? '🟢 ACTIVE (Age-Restricted Channels Only)' : '🔴 DISABLED (Default for all servers)'}\`\n\n` +
                    `The mature anime module is **100% disabled by default** to ensure server safety and family friendliness.\n\n` +
                    `**Commands Available:**\n` +
                    `• \`,nsfw on\` — Enable NSFW module for this server (Admin Only)\n` +
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
        category: 'NSFW',
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
        category: 'NSFW',
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

    // 5. TRAP (Anime Character Art)
    {
        name: 'trap',
        category: 'NSFW',
        description: 'Get an anime trap character artwork (NSFW aware).',
        usage: ',trap',
        async execute(ctx) {
            const nsfwStatus = await isNsfwAllowed(ctx);
            if (nsfwStatus === 'CHANNEL_NOT_NSFW') {
                return ctx.reply('🔞 **This channel is not marked as Age-Restricted (NSFW)!** Please use an NSFW channel.');
            }

            const isMature = nsfwStatus === true;
            const imgUrl = await fetchAnimeImage('trap', isMature);

            const embed = new EmbedBuilder()
                .setColor('#9B59B6')
                .setTitle(`✨ Anime Trap Gallery ${isMature ? '(18+ Mature)' : '(SFW)'}`)
                .setImage(imgUrl)
                .setFooter({ text: `Requested by ${ctx.user.username} • Starry Anime Suite` })
                .setTimestamp();

            return ctx.reply({ embeds: [embed] });
        }
    },

    // 6. BLOWKISS / KISS (Anime Romance Gifs)
    {
        name: 'blowkiss',
        aliases: ['kiss2'],
        category: 'NSFW',
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

    // 7. ECCHI (Anime Artwork - Strict NSFW Channel Only)
    {
        name: 'ecchi',
        category: 'NSFW',
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
    },

    // 8. NSFW KISS (Passionate Romantic Anime Kiss)
    {
        name: 'nsfwkiss',
        aliases: ['frenchkiss', 'deepkiss'],
        category: 'NSFW',
        description: 'Share an intensely passionate anime kiss with someone special (NSFW Only).',
        usage: ',nsfwkiss <@user>',
        async execute(ctx) {
            const nsfwStatus = await isNsfwAllowed(ctx);
            if (!nsfwStatus || nsfwStatus === 'CHANNEL_NOT_NSFW') {
                return ctx.reply('🔞 **NSFW Required:** This mature social command is only available in Age-Restricted channels when NSFW is enabled (\`,nsfw on\`).');
            }

            const target = ctx.message?.mentions?.users?.first();
            if (!target || target.id === ctx.user.id) {
                return ctx.reply('💋 **Please mention someone special to kiss!** *Example: `,nsfwkiss @user`*');
            }

            const count = getActionCount('nsfwkiss', ctx.user.id, target.id);
            const gif = getRandomNsfwGif('kiss');

            const embed = new EmbedBuilder()
                .setColor('#FF1493')
                .setAuthor({ name: '🔞 Mature Anime Romance', iconURL: ctx.user.displayAvatarURL({ dynamic: true }) })
                .setDescription(`💋 **${ctx.user.username}** passionately kisses **<@${target.id}>** on the lips!\n*They have shared ${count} passionate kisses!* ✨`)
                .setImage(gif)
                .setFooter({ text: 'Starry Mature Social • Prefix: ,' })
                .setTimestamp();

            return ctx.reply({ embeds: [embed] });
        }
    },

    // 9. NSFW HUG (Tight Romantic Anime Embrace)
    {
        name: 'nsfwhug',
        aliases: ['warmhug', 'intimatehug'],
        category: 'NSFW',
        description: 'Hold someone in a deeply intimate and tight romantic embrace (NSFW Only).',
        usage: ',nsfwhug <@user>',
        async execute(ctx) {
            const nsfwStatus = await isNsfwAllowed(ctx);
            if (!nsfwStatus || nsfwStatus === 'CHANNEL_NOT_NSFW') {
                return ctx.reply('🔞 **NSFW Required:** This mature social command is only available in Age-Restricted channels when NSFW is enabled.');
            }

            const target = ctx.message?.mentions?.users?.first();
            if (!target || target.id === ctx.user.id) {
                return ctx.reply('🫂 **Please mention someone to hug closely!** *Example: `,nsfwhug @user`*');
            }

            const count = getActionCount('nsfwhug', ctx.user.id, target.id);
            const gif = getRandomNsfwGif('hug');

            const embed = new EmbedBuilder()
                .setColor('#FF69B4')
                .setAuthor({ name: '🔞 Mature Anime Romance', iconURL: ctx.user.displayAvatarURL({ dynamic: true }) })
                .setDescription(`🫂 **${ctx.user.username}** pulls **<@${target.id}>** into a deeply intimate, tight embrace...\n*They have embraced warmly ${count} times!* 💖`)
                .setImage(gif)
                .setFooter({ text: 'Starry Mature Social • Prefix: ,' })
                .setTimestamp();

            return ctx.reply({ embeds: [embed] });
        }
    },

    // 10. SPANK (Playful Anime Spank)
    {
        name: 'spank',
        aliases: ['nsfwspank'],
        category: 'NSFW',
        description: 'Give a playful anime spank to a naughty member (NSFW Only).',
        usage: ',spank <@user>',
        async execute(ctx) {
            const nsfwStatus = await isNsfwAllowed(ctx);
            if (!nsfwStatus || nsfwStatus === 'CHANNEL_NOT_NSFW') {
                return ctx.reply('🔞 **NSFW Required:** This mature social command is only available in Age-Restricted channels when NSFW is enabled.');
            }

            const target = ctx.message?.mentions?.users?.first();
            if (!target || target.id === ctx.user.id) {
                return ctx.reply('👋 **Please mention someone to playfully spank!** *Example: `,spank @user`*');
            }

            const count = getActionCount('spank', ctx.user.id, target.id);
            const gif = getRandomNsfwGif('spank');

            const embed = new EmbedBuilder()
                .setColor('#E91E63')
                .setAuthor({ name: '🔞 Mature Anime Interaction', iconURL: ctx.user.displayAvatarURL({ dynamic: true }) })
                .setDescription(`👋 **${ctx.user.username}** playfully spanks **<@${target.id}>** for being naughty! 💢\n*Total spanks given: ${count} times!*`)
                .setImage(gif)
                .setFooter({ text: 'Starry Mature Social • Prefix: ,' })
                .setTimestamp();

            return ctx.reply({ embeds: [embed] });
        }
    },

    // 11. NSFW LICK (Teasing Sensual Anime Lick)
    {
        name: 'nsfwlick',
        aliases: ['sensuallick'],
        category: 'NSFW',
        description: 'Sensually lick someone in chat (NSFW Only).',
        usage: ',nsfwlick <@user>',
        async execute(ctx) {
            const nsfwStatus = await isNsfwAllowed(ctx);
            if (!nsfwStatus || nsfwStatus === 'CHANNEL_NOT_NSFW') {
                return ctx.reply('🔞 **NSFW Required:** This mature social command is only available in Age-Restricted channels when NSFW is enabled.');
            }

            const target = ctx.message?.mentions?.users?.first();
            if (!target || target.id === ctx.user.id) {
                return ctx.reply('👅 **Please mention someone to lick!** *Example: `,nsfwlick @user`*');
            }

            const count = getActionCount('nsfwlick', ctx.user.id, target.id);
            const gif = getRandomNsfwGif('lick');

            const embed = new EmbedBuilder()
                .setColor('#FF4081')
                .setAuthor({ name: '🔞 Mature Anime Interaction', iconURL: ctx.user.displayAvatarURL({ dynamic: true }) })
                .setDescription(`👅 **${ctx.user.username}** sensually licks **<@${target.id}>** on the neck! 💕\n*Total licks shared: ${count} times!*`)
                .setImage(gif)
                .setFooter({ text: 'Starry Mature Social • Prefix: ,' })
                .setTimestamp();

            return ctx.reply({ embeds: [embed] });
        }
    },

    // 12. NSFW TOUCH (Sensory Anime Touch)
    {
        name: 'nsfwtouch',
        aliases: ['caress'],
        category: 'NSFW',
        description: 'Sensually caress and touch someone in chat (NSFW Only).',
        usage: ',nsfwtouch <@user>',
        async execute(ctx) {
            const nsfwStatus = await isNsfwAllowed(ctx);
            if (!nsfwStatus || nsfwStatus === 'CHANNEL_NOT_NSFW') {
                return ctx.reply('🔞 **NSFW Required:** This mature social command is only available in Age-Restricted channels when NSFW is enabled.');
            }

            const target = ctx.message?.mentions?.users?.first();
            if (!target || target.id === ctx.user.id) {
                return ctx.reply('👉 **Please mention someone to caress!** *Example: `,nsfwtouch @user`*');
            }

            const count = getActionCount('nsfwtouch', ctx.user.id, target.id);
            const gif = getRandomNsfwGif('touch');

            const embed = new EmbedBuilder()
                .setColor('#BA68C8')
                .setAuthor({ name: '🔞 Mature Anime Interaction', iconURL: ctx.user.displayAvatarURL({ dynamic: true }) })
                .setDescription(`✨ **${ctx.user.username}** gently and sensually caresses **<@${target.id}>**...\n*Total touches shared: ${count} times!* 💫`)
                .setImage(gif)
                .setFooter({ text: 'Starry Mature Social • Prefix: ,' })
                .setTimestamp();

            return ctx.reply({ embeds: [embed] });
        }
    },

    // 13. NSFW CUDDLE (Warm Bedtime Romance Cuddle)
    {
        name: 'nsfwcuddle',
        aliases: ['bedcuddle', 'cozycuddle'],
        category: 'NSFW',
        description: 'Snuggle up and cuddle closely in bed with someone special (NSFW Only).',
        usage: ',nsfwcuddle <@user>',
        async execute(ctx) {
            const nsfwStatus = await isNsfwAllowed(ctx);
            if (!nsfwStatus || nsfwStatus === 'CHANNEL_NOT_NSFW') {
                return ctx.reply('🔞 **NSFW Required:** This mature social command is only available in Age-Restricted channels when NSFW is enabled.');
            }

            const target = ctx.message?.mentions?.users?.first();
            if (!target || target.id === ctx.user.id) {
                return ctx.reply('🛏️ **Please mention someone to cuddle with!** *Example: `,nsfwcuddle @user`*');
            }

            const count = getActionCount('nsfwcuddle', ctx.user.id, target.id);
            const gif = getRandomNsfwGif('cuddle');

            const embed = new EmbedBuilder()
                .setColor('#F06292')
                .setAuthor({ name: '🔞 Mature Anime Romance', iconURL: ctx.user.displayAvatarURL({ dynamic: true }) })
                .setDescription(`🛏️ **${ctx.user.username}** cuddles up warmly and snugly with **<@${target.id}>** under the starry blankets... 🌌\n*They have cuddled intimately ${count} times!* 💖`)
                .setImage(gif)
                .setFooter({ text: 'Starry Mature Social • Prefix: ,' })
                .setTimestamp();

            return ctx.reply({ embeds: [embed] });
        }
    },

    // 14. NSFW HELP (Dedicated Help Menu for Mature Commands)
    {
        name: 'nsfwhelp',
        aliases: ['maturehelp', '18plushelp'],
        category: 'NSFW',
        description: 'View the complete list of mature and anime NSFW commands.',
        usage: ',nsfwhelp',
        async execute(ctx) {
            const nsfwStatus = await isNsfwAllowed(ctx);
            if (!nsfwStatus || nsfwStatus === 'CHANNEL_NOT_NSFW') {
                return ctx.reply(
                    '🔒 **Mature Commands are Hidden:**\n' +
                    'The NSFW module is currently disabled. To view and use these commands:\n' +
                    '1. In a Server: An Admin must run `,nsfw on` in an Age-Restricted (NSFW) channel.\n' +
                    '2. In DMs: Run `,nsfw dms on`.\n' +
                    '3. Ask AI: Run `,nsfw info` to learn more.'
                );
            }

            const embed = new EmbedBuilder()
                .setColor('#FF1493')
                .setAuthor({ name: '🔞 Starry Mature & Anime NSFW Commands', iconURL: 'https://cdn.discordapp.com/emojis/1049283733054177301.webp?size=96' })
                .setTitle('🔞 Complete Mature Anime & Social Suite (14 Commands)')
                .setDescription(
                    `**⚙️ Configuration & AI:**\n` +
                    `\`${config.DEFAULT_PREFIX}nsfw on/off\`, \`${config.DEFAULT_PREFIX}nsfw info\`, \`${config.DEFAULT_PREFIX}nsfw dms on/off\`\n\n` +
                    `**🌸 Anime & Waifu Art Galleries:**\n` +
                    `\`${config.DEFAULT_PREFIX}waifu\`, \`${config.DEFAULT_PREFIX}neko\`, \`${config.DEFAULT_PREFIX}trap\`, \`${config.DEFAULT_PREFIX}ecchi\`, \`${config.DEFAULT_PREFIX}blowkiss\`\n\n` +
                    `**💋 Mature Anime Social Interactions:**\n` +
                    `\`${config.DEFAULT_PREFIX}nsfwkiss\`, \`${config.DEFAULT_PREFIX}nsfwhug\`, \`${config.DEFAULT_PREFIX}spank\`, \`${config.DEFAULT_PREFIX}nsfwlick\`, \`${config.DEFAULT_PREFIX}nsfwtouch\`, \`${config.DEFAULT_PREFIX}nsfwcuddle\`\n\n` +
                    `*All commands strictly enforce Discord Age-Restricted channel verification.*`
                )
                .setFooter({ text: 'Starry Mature Suite • Prefix: ,' })
                .setTimestamp();

            return ctx.reply({ embeds: [embed] });
        }
    }
];

module.exports = commands;
