const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder } = require('discord.js');
const config = require('../config');

const BASE_HELP_CATEGORIES = [
    { id: 'music', label: 'Music & Audio (33)', desc: 'Playback, filters, 24/7, queue & DJ panel', emoji: '🎵' },
    { id: 'mod', label: 'Moderation & Security (32)', desc: 'Bans, mutes, kicks, warnings, lock & purge', emoji: '🛡️' },
    { id: 'util', label: 'Utility & Tools (36)', desc: 'Reminders, starboard, tempvoice, tags, sticky & whois', emoji: '🛠️' },
    { id: 'social', label: 'Social & Expressions (26)', desc: 'Hug, kiss, slap, anime GIFs & interactions', emoji: '🎭' },
    { id: 'eco', label: 'Economy & Adventure (21)', desc: 'Profile, beg, search, crime, crate, daily & shop', emoji: '💰' },
    { id: 'game', label: 'Cosmic Arcade & Games (11)', desc: 'Blackjack, Mines, Trivia, Wordle, RPS & TicTacToe', emoji: '🎮' },
    { id: 'sys', label: 'Multi-Bot & Systems (15)', desc: 'Multi-bot cluster, giveaways, tickets & backup', emoji: '🤖' }
];

const NSFW_CATEGORY_INFO = {
    id: 'nsfw',
    label: 'Mature & Anime NSFW (14)',
    desc: 'Anime waifus, nekos, ecchi art & mature social actions',
    emoji: '🔞'
};

function getHelpCategories(isNsfw = false) {
    if (isNsfw) {
        return [...BASE_HELP_CATEGORIES, NSFW_CATEGORY_INFO];
    }
    return BASE_HELP_CATEGORIES;
}

function buildCategoryEmbed(catId, customPrefix, isNsfw = false) {
    const prefix = customPrefix || config.DEFAULT_PREFIX || ',';
    const embed = new EmbedBuilder()
        .setColor(config.EMBED_COLORS.PRIMARY)
        .setFooter({ text: `Starry Master Bot • Default Prefix: ${prefix} • 1-Year Controls` })
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
        embed.setTitle('🛠️ Utility & Server Management Commands (36 Commands)')
            .setDescription(
                `**Server Tools & Utilities:**\n` +
                `\`${prefix}help\`, \`${prefix}ahelp\`, \`${prefix}ping\`, \`${prefix}botinfo\`, \`${prefix}serverinfo\`, \`${prefix}whois\`, \`${prefix}avatar\`, \`${prefix}banner\`, \`${prefix}membercount\`, \`${prefix}roles\`, \`${prefix}emojis\`, \`${prefix}steal\`, \`${prefix}invite\`, \`${prefix}vote\`, \`${prefix}premium\`, \`${prefix}uptime\`, \`${prefix}afk\`, \`${prefix}translate\`, \`${prefix}calculator\`, \`${prefix}poll\`, \`${prefix}announce\`, \`${prefix}embed\`, \`${prefix}say\`, \`${prefix}snipe\`, \`${prefix}editsnipe\`, \`${prefix}setlogs\`, \`${prefix}setupwelcome\`, \`${prefix}setupgoodbye\`, \`${prefix}imagine\`, \`${prefix}nitroclaims\`\n\n` +
                `**New Power Features:**\n` +
                `• **Reminders:** \`${prefix}remind\`, \`${prefix}reminders\`, \`${prefix}delreminder\`\n` +
                `• **Starboard:** \`${prefix}starboard\` (setup, stars, toggle)\n` +
                `• **Dynamic Voice:** \`${prefix}tempvoice\` (setup, toggle)\n` +
                `• **Custom Tags:** \`${prefix}tag\`, \`${prefix}tags\`\n` +
                `• **Sticky Notice:** \`${prefix}sticky\` (set, remove, list)`
            );
    } else if (catId === 'social') {
        embed.setTitle('🎭 Social Actions & Anime Expressions (26 Commands)')
            .setDescription(
                `**Targeted Member Interactions (GIFs + Counter):**\n` +
                `\`${prefix}hug\`, \`${prefix}kiss\`, \`${prefix}slap\`, \`${prefix}pat\`, \`${prefix}cuddle\`, \`${prefix}bite\`, \`${prefix}poke\`, \`${prefix}punch\`, \`${prefix}tickle\`, \`${prefix}feed\`, \`${prefix}lick\`, \`${prefix}highfive\`, \`${prefix}wave\`\n\n` +
                `**Solo Expressions & Fun:**\n` +
                `\`${prefix}sleep\`, \`${prefix}wakeup\`, \`${prefix}cry\`, \`${prefix}laugh\`, \`${prefix}dance\`, \`${prefix}blush\`, \`${prefix}pout\`, \`${prefix}smile\`, \`${prefix}bored\`, \`${prefix}social\`, \`${prefix}tord\`\n\n` +
                `*All social action response buttons feature persistent 1-year lifetime!*`
            );
    } else if (catId === 'eco') {
        embed.setTitle('💰 Economy & RPG Adventure Commands (21 Commands)')
            .setDescription(
                `**Starlight Passport & Balances:**\n` +
                `\`${prefix}profile\` (or \`${prefix}p\`), \`${prefix}balance\` (or \`${prefix}bal\`), \`${prefix}rank\`, \`${prefix}leaderboard\`, \`${prefix}deposit\`, \`${prefix}withdraw\`, \`${prefix}pay\`\n\n` +
                `**Adventure & Earnings:**\n` +
                `\`${prefix}beg\` — Beg traveling cosmic merchants\n` +
                `\`${prefix}search\` — Scavenge celestial locations (Orion, Satellites, Craters)\n` +
                `\`${prefix}crime\` — Attempt high-risk planetary heists\n` +
                `\`${prefix}crate\` — Unbox Cosmic Mystery Crates for rare gems & treats\n` +
                `\`${prefix}work\`, \`${prefix}daily\`, \`${prefix}weekly\`, \`${prefix}shop\`, \`${prefix}buy\`, \`${prefix}gamble\`, \`${prefix}slots\`, \`${prefix}rob\`, \`${prefix}setlevel\``
            );
    } else if (catId === 'game') {
        embed.setTitle('🎮 Cosmic Arcade & Mini-Games (11 Commands)')
            .setDescription(
                `**Card & Casino Games:**\n` +
                `• \`${prefix}blackjack\` (or \`${prefix}bj\`) — Full 21-card blackjack with Hit, Stand & Double Down buttons\n` +
                `• \`${prefix}highlow\` (or \`${prefix}hl\`) — Predict higher or lower for multiplying stardust\n` +
                `• \`${prefix}spin\` (or \`${prefix}wheel\`) — Animated celestial wheel of fortune\n\n` +
                `**Arcade & Logic Puzzles:**\n` +
                `• \`${prefix}mines\` — 3x3 interactive minefield grid: reveal stars, avoid black holes, cash out!\n` +
                `• \`${prefix}wordle\` — Secret 5-letter starlight word guessing challenge\n` +
                `• \`${prefix}trivia\` — Timed 4-choice trivia quiz with stardust rewards\n` +
                `• \`${prefix}tictactoe\` (or \`${prefix}ttt\`) — Interactive 3x3 button grid PvP duel\n` +
                `• \`${prefix}rps\` — Rock-Paper-Scissors against Starry AI or challenged players\n\n` +
                `**Casual & Mystic:**\n` +
                `• \`${prefix}coinflip\`, \`${prefix}roll\`, \`${prefix}8ball\``
            );
    } else if (catId === 'sys') {
        embed.setTitle('🤖 Multi-Bot, Giveaways & Systems (15 Commands)')
            .setDescription(
                `\`${prefix}multibot\`, \`${prefix}chest\`, \`${prefix}chestdrop\`, \`${prefix}chest-toggle\`, \`${prefix}pet\`, \`${prefix}prestige\`, \`${prefix}giveaway\`, \`${prefix}reroll\`, \`${prefix}gend\`, \`${prefix}ticketsetup\`, \`${prefix}applysetup\`, \`${prefix}verify-setup\`, \`${prefix}confessionsetup\`, \`${prefix}setupcount\`, \`${prefix}backup\`, \`${prefix}restore\``
            );
    } else if (catId === 'nsfw') {
        if (!isNsfw) {
            embed.setColor('#ED4245')
                .setTitle('🔒 Mature Commands are Hidden')
                .setDescription(
                    `The Mature & NSFW module is **disabled** in this server or channel.\n\n` +
                    `**How to Enable & View:**\n` +
                    `1. **In Servers:** An Administrator must run \`${prefix}nsfw on\` inside a channel marked as **Age-Restricted (NSFW)** in Discord settings.\n` +
                    `2. **In DMs:** Run \`${prefix}nsfw dms on\` in Direct Messages.\n` +
                    `3. **Ask AI:** Run \`${prefix}nsfw info\` for an AI breakdown of features.`
                );
            return embed;
        }

        embed.setColor('#FF1493')
            .setTitle('🔞 Mature & Anime NSFW Commands (14 Commands)')
            .setDescription(
                `**⚙️ Configuration & AI:**\n` +
                `\`${prefix}nsfw on/off\`, \`${prefix}nsfw info\`, \`${prefix}nsfw dms on/off\`, \`${prefix}nsfwhelp\`\n\n` +
                `**🌸 Anime & Waifu Art Galleries:**\n` +
                `\`${prefix}waifu\`, \`${prefix}neko\`, \`${prefix}trap\`, \`${prefix}ecchi\`, \`${prefix}blowkiss\`\n\n` +
                `**💋 Mature Anime Social Interactions:**\n` +
                `\`${prefix}nsfwkiss\`, \`${prefix}nsfwhug\`, \`${prefix}spank\`, \`${prefix}nsfwlick\`, \`${prefix}nsfwtouch\`, \`${prefix}nsfwcuddle\`\n\n` +
                `*Strict Discord Age-Restricted channel verification active!*`
            );
    } else {
        const totalCommands = isNsfw ? '190+' : '175+';
        embed.setTitle('🌟 Manager Bot & Starry Supreme Command Hub')
            .setDescription(
                `Welcome to the ultimate Discord multi-feature bot!\n` +
                `• **Default Prefix:** \`${prefix}\` *(Fixed standard prefix)*\n` +
                `• **Total Commands:** \`${totalCommands}\` across ${isNsfw ? '8' : '7'} categories\n` +
                `• **Multi-Bot Clustering:** Active and synchronized\n` +
                `• **Embed Buttons Lifetime:** High timing up to **1 Year**\n\n` +
                `Select a category from the dropdown menu below or click the quick action buttons.`
            )
            .addFields(
                { name: '🎵 Music (33)', value: `\`${prefix}play\`, \`${prefix}queue\`, \`${prefix}djpanel\``, inline: true },
                { name: '🛡️ Moderation (32)', value: `\`${prefix}ban\`, \`${prefix}mute\`, \`${prefix}modpanel\``, inline: true },
                { name: '🛠️ Utility (36)', value: `\`${prefix}remind\`, \`${prefix}starboard\`, \`${prefix}sticky\``, inline: true },
                { name: '🎮 Arcade (11)', value: `\`${prefix}blackjack\`, \`${prefix}mines\`, \`${prefix}trivia\``, inline: true },
                { name: '💰 Economy (21)', value: `\`${prefix}profile\`, \`${prefix}search\`, \`${prefix}crime\``, inline: true },
                { name: '🎭 Social (26)', value: `\`${prefix}hug\`, \`${prefix}kiss\`, \`${prefix}social\``, inline: true },
                { name: '🤖 Systems (15)', value: `\`${prefix}multibot\`, \`${prefix}giveaway\`, \`${prefix}backup\``, inline: true }
            );

        if (isNsfw) {
            embed.addFields({ name: '🔞 Mature & Anime (14)', value: `\`${prefix}nsfwkiss\`, \`${prefix}waifu\`, \`${prefix}nsfwhelp\``, inline: true });
        }
    }
    return embed;
}

function createHelpComponents(isNsfw = false) {
    const categories = getHelpCategories(isNsfw);

    const selectMenu = new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
            .setCustomId('help_select')
            .setPlaceholder('📂 Choose a command category...')
            .addOptions([
                { label: 'Overview / Home', description: 'Main bot dashboard and quick stats', value: 'home', emoji: '🏠' },
                ...categories.map(c => ({ label: c.label, description: c.desc, value: c.id, emoji: c.emoji }))
            ])
    );

    const buttons = [
        new ButtonBuilder().setCustomId('help_btn_music').setLabel('Music').setEmoji('🎵').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId('help_btn_mod').setLabel('Mod').setEmoji('🛡️').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId('help_btn_social').setLabel('Social').setEmoji('🎭').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId('help_btn_util').setLabel('Utility').setEmoji('🛠️').setStyle(ButtonStyle.Secondary)
    ];

    if (isNsfw) {
        buttons.push(new ButtonBuilder().setCustomId('help_btn_nsfw').setLabel('NSFW').setEmoji('🔞').setStyle(ButtonStyle.Danger));
    } else {
        buttons.push(new ButtonBuilder().setCustomId('help_btn_eco').setLabel('Economy').setEmoji('💰').setStyle(ButtonStyle.Secondary));
    }

    const buttonsRow = new ActionRowBuilder().addComponents(buttons);

    return [selectMenu, buttonsRow];
}

module.exports = {
    helpCategories: BASE_HELP_CATEGORIES,
    getHelpCategories,
    buildCategoryEmbed,
    createHelpComponents
};
