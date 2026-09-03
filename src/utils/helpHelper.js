const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder } = require('discord.js');
const config = require('../config');

const BASE_HELP_CATEGORIES = [
    { id: 'music', label: 'Music & Audio (33)', desc: 'Playback, filters, 24/7, queue & DJ panel', emoji: '🎵' },
    { id: 'mod', label: 'Moderation & Security (32)', desc: 'Bans, mutes, kicks, warnings, lock & purge', emoji: '🛡️' },
    { id: 'util', label: 'Utility & Tools (28)', desc: 'Server info, whois, translate, avatar & afk', emoji: '🛠️' },
    { id: 'social', label: 'Social & Expressions (26)', desc: 'Hug, kiss, slap, anime GIFs & interactions', emoji: '🎭' },
    { id: 'eco', label: 'Economy & Levels (16)', desc: 'Coins, balance, rank, daily, shop & slots', emoji: '💰' },
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
        const totalCommands = isNsfw ? '165+' : '150+';
        embed.setTitle('🌟 Manager Bot & Starry Supreme Command Hub')
            .setDescription(
                `Welcome to the ultimate Discord multi-feature bot!\n` +
                `• **Default Prefix:** \`${prefix}\` *(Fixed standard prefix)*\n` +
                `• **Total Commands:** \`${totalCommands}\` across ${isNsfw ? '7' : '6'} categories\n` +
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
