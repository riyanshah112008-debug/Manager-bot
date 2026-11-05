// Starry After Dark: original, non-graphic social games and interactions.
// Server: owner activation + Discord age-restricted channel. DMs: individual opt-in.
// Targeted interactions and pair scores require both users to opt in.
const { EmbedBuilder } = require('discord.js');
const ServerSettings = require('../../models/ServerSettings');
const {
    canManageServerNsfw, isNsfwAllowed, isNsfwDmEnabled,
    setNsfwDmEnabled, isSocialConsentEnabled, setSocialConsent, isStarryOwner
} = require('../../modules/nsfwModule');
const config = require('../../config');
const PREFIX = config.DEFAULT_PREFIX || ',';
const COLOR = '#D946A6';

const PROMPTS = {
    truth: [
        'What quality makes someone instantly more attractive?',
        'What is your idea of a perfect late-night date?',
        'Have you ever had a crush you never confessed to?',
        'What small gesture makes you feel appreciated?',
        'What is your biggest green flag in a relationship?'
    ],
    dare: [
        'Give someone a sincere, non-explicit compliment.',
        'Describe your ideal date using only three emojis.',
        'Write a dramatic one-line love confession.',
        'Share a song that matches your romantic mood.',
        'Give someone a harmless nickname, but only if they are comfortable with it.'
    ],
    fantasy: [
        'A rooftop date under a meteor shower.',
        'A quiet midnight drive with your favourite playlist.',
        'A candlelit dinner where the conversation never ends.',
        'A spontaneous weekend trip somewhere beautiful.',
        'Watching the sunrise together after an all-night conversation.'
    ],
    secret: [
        'A little-known thing that instantly makes you smile.',
        'A harmless romantic opinion you will defend forever.',
        'The sweetest compliment you still remember.',
        'Your most unexpected green flag.',
        'A song that reminds you of someone special.'
    ]
};

function pick(list) { return list[Math.floor(Math.random() * list.length)]; }
function targetOf(ctx) { return ctx.options?.getUser('user') || ctx.message?.mentions?.users?.first() || null; }

async function allowed(ctx) {
    const result = await isNsfwAllowed(ctx);
    if (result === true) return true;
    if (result === 'CHANNEL_NOT_NSFW') await ctx.reply('🔞 This command only works in a Discord age-restricted channel.');
    else if (!ctx.guild) await ctx.reply('🔒 Your private NSFW mode is off. Use ,nsfw dms on to opt in.');
    else await ctx.reply('🔒 This server has not enabled Starry NSFW. The server owner can use ,nsfw on.');
    return false;
}

async function mutualConsent(ctx, target) {
    // The configured Starry owner is exempt from personal opt-in; target opt-in remains mandatory.
    if (!isStarryOwner(ctx.user.id) && !(await isSocialConsentEnabled(ctx.user.id))) {
        await ctx.reply('🔐 Enable your own social consent first with ' + PREFIX + 'nsfwconsent on. You can turn it off at any time.');
        return false;
    }
    if (!(await isSocialConsentEnabled(target.id))) {
        await ctx.reply('<@' + target.id + '> has not opted in. They must enable ' + PREFIX + 'nsfwconsent on themselves first.');
        return false;
    }
    return true;
}

const commands = [
    {
        name: 'nsfw', aliases: ['mature', '18plus', 'nsfwconfig'], category: 'NSFW',
        description: 'Manage Starry mature social features and personal preferences.',
        usage: ',nsfw [on|off|dms on|dms off]',
        async execute(ctx) {
            const sub = String(ctx.args[0] || '').toLowerCase();
            const choice = String(ctx.args[1] || '').toLowerCase();
            if (sub === 'dms' || sub === 'dm') {
                if (choice === 'on' || choice === 'enable') {
                    await setNsfwDmEnabled(ctx.user.id, true);
                    return ctx.reply('🔞 Private NSFW mode enabled for your DMs. Social consent is a separate setting.');
                }
                if (choice === 'off' || choice === 'disable') {
                    await setNsfwDmEnabled(ctx.user.id, false);
                    return ctx.reply('🔒 Private NSFW mode disabled for your DMs.');
                }
                return ctx.reply('Your private NSFW mode is ' + ((await isNsfwDmEnabled(ctx.user.id)) ? 'ON' : 'OFF') + '. Use ,nsfw dms on/off.');
            }
            if (!ctx.guild) {
                if (sub === 'on' || sub === 'enable') { await setNsfwDmEnabled(ctx.user.id, true); return ctx.reply('🔞 Private NSFW mode enabled.'); }
                if (sub === 'off' || sub === 'disable') { await setNsfwDmEnabled(ctx.user.id, false); return ctx.reply('🔒 Private NSFW mode disabled.'); }
                return ctx.reply('Private NSFW mode: ' + ((await isNsfwDmEnabled(ctx.user.id)) ? 'ON' : 'OFF') + '. Use ,nsfw dms on/off and ,nsfwconsent on/off.');
            }
            let settings = await ServerSettings.findOne({ guildId: ctx.guild.id });
            if (!settings) settings = await ServerSettings.create({ guildId: ctx.guild.id });
            if (['on', 'enable', 'off', 'disable'].includes(sub)) {
                if (!canManageServerNsfw(ctx.user.id, ctx.guild)) return ctx.reply('❌ Only this server owner or a Starry bot owner can change the server NSFW setting.');
                settings.nsfw.enabled = sub === 'on' || sub === 'enable';
                await settings.save();
                return ctx.reply(settings.nsfw.enabled ? '🔞 Starry social suite enabled. Commands still work only in age-restricted channels.' : '🔒 Starry social suite disabled for this server.');
            }
            return ctx.reply('**Starry Mature Social Suite**\nServer status: **' + (settings.nsfw?.enabled ? 'ON' : 'OFF') + '**\n' +
                PREFIX + 'nsfw on/off — server owner control\n' +
                PREFIX + 'nsfw dms on/off — your private DM setting\n' +
                PREFIX + 'nsfwconsent on/off — targeted interaction opt-in\n' +
                PREFIX + 'nsfwhelp — command list');
        }
    },
    {
        name: 'nsfwserver', category: 'NSFW', description: 'Enable or disable Starry NSFW for this server.',
        async execute(ctx) {
            if (!ctx.guild) return ctx.reply('This setting is available only in a server.');
            if (!canManageServerNsfw(ctx.user.id, ctx.guild)) return ctx.reply('Only the server owner or a Starry bot owner can change this setting.');
            const choice = String(ctx.args[0] || '').toLowerCase();
            if (!['on', 'off'].includes(choice)) return ctx.reply('Choose on or off.');
            let settings = await ServerSettings.findOne({ guildId: ctx.guild.id });
            if (!settings) settings = await ServerSettings.create({ guildId: ctx.guild.id });
            settings.nsfw.enabled = choice === 'on';
            await settings.save();
            return ctx.reply(choice === 'on' ? '🔞 Starry social suite enabled. Commands remain restricted to age-restricted channels.' : '🔒 Starry social suite disabled.');
        }
    },
    {
        name: 'nsfwdm', category: 'NSFW', description: 'Enable or disable your personal NSFW commands in DMs.',
        async execute(ctx) {
            const choice = String(ctx.args[0] || '').toLowerCase();
            if (!['on', 'off'].includes(choice)) return ctx.reply('Choose on or off.');
            await setNsfwDmEnabled(ctx.user.id, choice === 'on');
            return ctx.reply(choice === 'on' ? '🔞 Your private NSFW mode is enabled.' : '🔒 Your private NSFW mode is disabled.');
        }
    },
    {
        name: 'nsfwconsent', aliases: ['socialconsent'], category: 'NSFW',
        description: 'Opt in or out of being included in Starry social interactions.',
        usage: ',nsfwconsent on|off|status',
        async execute(ctx) {
            const choice = String(ctx.args[0] || 'status').toLowerCase();
            if (choice === 'on' || choice === 'enable') {
                await setSocialConsent(ctx.user.id, true);
                return ctx.reply('✅ You opted in to Starry social interactions. Opt out any time with ,nsfwconsent off.');
            }
            if (choice === 'off' || choice === 'disable') {
                await setSocialConsent(ctx.user.id, false);
                return ctx.reply('🔒 You opted out. Starry will not target you in social interactions.');
            }
            return ctx.reply('Your social interaction consent is ' + ((await isSocialConsentEnabled(ctx.user.id)) ? 'ON' : 'OFF') + '.');
        }
    },
    {
        name: 'nsfwhelp', aliases: ['maturehelp'], category: 'NSFW',
        description: 'Show all commands in Starry After Dark.',
        usage: ',nsfwhelp',
        async execute(ctx) {
            return ctx.reply('**🌙 Starry After Dark — One Command, Full Suite**\n' +
                '`/nsfw` or `,nsfw` → choose a sub-option: server, dms, consent, flirt, tease, makeout, date, compliment, chemistry, tension, ship, couple, rate, truth, dare, fantasy, secret, confess, afterdark, help.\n\n' +
                '**Safety:** Server owner activation and age-restricted channel required. DMs are individually opt-in. Targeted commands require the target member to opt in; the configured Starry owner is exempt from personal opt-in. All content is non-graphic.');
        }
    }
];

const targeted = {
    nsfwflirt: ['Flirtation', ['sends a charming wink to', 'drops a smooth compliment for', 'tries a little celestial charm on']],
    nsfwtease: ['Playful teasing', ['starts a harmless teasing match with', 'sends a mischievous grin to', 'challenges']],
    nsfwmakeout: ['Romantic moment', []],
    nsfwdate: ['Date invitation', []],
    nsfwcompliment: ['A bold compliment', []]
};
for (const [name, action] of Object.entries(targeted)) {
    commands.push({
        name, category: 'NSFW', description: action[0] + ' with another opted-in member.',
        usage: ',' + name + ' <@user>',
        async execute(ctx) {
            if (!(await allowed(ctx))) return;
            const target = targetOf(ctx);
            if (!target || target.bot || target.id === ctx.user.id) return ctx.reply('Mention another member. Example: ' + PREFIX + name + ' @user.');
            if (!(await mutualConsent(ctx, target))) return;
            let line;
            if (name === 'nsfwmakeout') line = 'asks <@' + target.id + '> if they would be comfortable with a fictional, movie-style romantic kiss. No pressure either way.';
            else if (name === 'nsfwdate') line = 'invites <@' + target.id + '> on an imaginary starlit date. The invitation is just for fun.';
            else if (name === 'nsfwcompliment') line = 'has a little starry compliment for <@' + target.id + '>: “Your presence makes this place brighter.” ✨';
            else line = pick(action[1]) + ' <@' + target.id + '>.';
            const embed = new EmbedBuilder().setColor(COLOR).setTitle(action[0])
                .setDescription('✨ <@' + ctx.user.id + '> ' + line)
                .setFooter({ text: 'Both members have opted in • Starry Social' }).setTimestamp();
            return ctx.reply({ embeds: [embed], allowedMentions: { users: [ctx.user.id, target.id] } });
        }
    });
}

const scored = [
    ['nsfwchemistry', 'Chemistry check'], ['nsfwtension', 'Starry tension'],
    ['nsfwship', 'Ship meter'], ['nsfwcouple', 'Couple energy'], ['nsfwrate', 'Charm rating']
];
for (const [name, title] of scored) {
    commands.push({
        name, category: 'NSFW', description: title + ' — a playful score between opted-in members.',
        usage: ',' + name + ' <@user>',
        async execute(ctx) {
            if (!(await allowed(ctx))) return;
            const target = targetOf(ctx);
            if (!target || target.bot || target.id === ctx.user.id) return ctx.reply('Mention another member to get a score.');
            if (!(await mutualConsent(ctx, target))) return;
            const score = Math.floor(Math.random() * 101);
            const vibe = score >= 85 ? 'Cosmic-level chemistry ✨' : score >= 60 ? 'There might be a spark 💫' : score >= 35 ? 'A fun friendship vibe 🌙' : 'The stars are keeping it mysterious ⭐';
            const embed = new EmbedBuilder().setColor(COLOR).setTitle(title)
                .setDescription('<@' + ctx.user.id + '> + <@' + target.id + '>\n\n**' + score + '%**\n' + vibe)
                .setFooter({ text: 'For entertainment only • Both users opted in' }).setTimestamp();
            return ctx.reply({ embeds: [embed], allowedMentions: { users: [ctx.user.id, target.id] } });
        }
    });
}

for (const [name, title, pool] of [
    ['nsfwtruth', 'Truth prompt', PROMPTS.truth], ['nsfwdare', 'Dare prompt', PROMPTS.dare],
    ['nsfwfantasy', 'Date-night daydream', PROMPTS.fantasy], ['nsfwsecret', 'After-dark icebreaker', PROMPTS.secret]
]) {
    commands.push({
        name, category: 'NSFW', description: title + ' — a non-graphic social prompt.', usage: ',' + name,
        async execute(ctx) {
            if (!(await allowed(ctx))) return;
            return ctx.reply({ embeds: [new EmbedBuilder().setColor(COLOR).setTitle(title).setDescription(pick(pool)).setFooter({ text: 'Keep it respectful • Passing is always okay' })] });
        }
    });
}

commands.push(
    {
        name: 'nsfwconfess', category: 'NSFW', description: 'Share a short, non-explicit confession.',
        usage: ',nsfwconfess <message>',
        async execute(ctx) {
            if (!(await allowed(ctx))) return;
            const message = String(ctx.args.join(' ') || '').trim();
            if (!message) return ctx.reply('Add a confession after the command. Keep it non-explicit and respectful.');
            if (message.length > 400) return ctx.reply('Keep the confession under 400 characters.');
            return ctx.reply({ embeds: [new EmbedBuilder().setColor(COLOR).setTitle('💌 A Starry Confession').setDescription(message).setFooter({ text: 'Shared by request • Keep it respectful' })], allowedMentions: { parse: [] } });
        }
    },
    {
        name: 'nsfwafterdark', category: 'NSFW', description: 'Start a late-night, non-graphic conversation prompt.',
        usage: ',nsfwafterdark',
        async execute(ctx) {
            if (!(await allowed(ctx))) return;
            const prompt = pick([
                'What makes a late-night conversation unforgettable?',
                'Would you choose a midnight rooftop date or a quiet beach walk?',
                'What is the most thoughtful romantic gesture?',
                'What song belongs on a perfect after-dark playlist?',
                'What is one green flag people often overlook?'
            ]);
            return ctx.reply({ embeds: [new EmbedBuilder().setColor(COLOR).setTitle('🌙 After Dark').setDescription(prompt).setFooter({ text: 'A relaxed, non-explicit conversation starter' })] });
        }
    }
);

// Expose one public prefix command. Individual handlers remain private implementation details.
const internalCommands = new Map(commands.map(command => [command.name, command]));
const nsfwSubcommands = {
    server: 'nsfwserver', dms: 'nsfwdm', consent: 'nsfwconsent',
    flirt: 'nsfwflirt', tease: 'nsfwtease', makeout: 'nsfwmakeout',
    date: 'nsfwdate', compliment: 'nsfwcompliment',
    chemistry: 'nsfwchemistry', tension: 'nsfwtension', ship: 'nsfwship',
    couple: 'nsfwcouple', rate: 'nsfwrate',
    truth: 'nsfwtruth', dare: 'nsfwdare', fantasy: 'nsfwfantasy',
    secret: 'nsfwsecret', confess: 'nsfwconfess', afterdark: 'nsfwafterdark',
    help: 'nsfwhelp'
};
const unifiedNsfwCommand = {
    name: 'nsfw', aliases: ['mature', '18plus', 'nsfwconfig'],
    category: 'NSFW',
    description: 'Starry After Dark: all mature social settings, games and interactions.',
    usage: ',nsfw <server|dms|consent|flirt|tease|makeout|date|compliment|chemistry|tension|ship|couple|rate|truth|dare|fantasy|secret|confess|afterdark|help>',
    async execute(ctx) {
        const slash = ctx.isSlash;
        const sub = String(slash ? (ctx.interaction.options.getSubcommand(false) || 'help') : (ctx.args[0] || 'help')).toLowerCase();
        const internalName = nsfwSubcommands[sub];
        if (!internalName) return ctx.reply('Unknown NSFW option. Use /nsfw help or ,nsfw help.');
        const handler = internalCommands.get(internalName);
        if (!handler) return ctx.reply('That NSFW option is temporarily unavailable.');
        if (slash) {
            const option = ctx.interaction.options;
            if (['server', 'dms', 'consent'].includes(sub)) ctx.args = [option.getString('choice') || 'status'];
            else if (sub === 'confess') ctx.args = [option.getString('message') || ''];
            else ctx.args = [];
        } else ctx.args = ctx.args.slice(1);
        return handler.execute(ctx);
    }
};
module.exports = [unifiedNsfwCommand];
