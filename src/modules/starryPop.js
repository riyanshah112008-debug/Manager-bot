// ==========================================
// ✨ STARRY POP & MASCOT SIGNATURE PHRASE ENGINE
// File Path: src/modules/starryPop.js
// "Starry Starry" Signature Trigger • Expressive Anime Mascot GIFs • Voice Lines & Affection
// Nekotina-Style Mascot Pop Experience for Starry Bot
// ==========================================
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, Events } = require('discord.js');
const config = require('../config');

const STARRY_POP_GIFS = [
    'https://media.giphy.com/media/108M7gCS1JSoO4/giphy.gif', // anime sparkle magic
    'https://media.giphy.com/media/wO4cyRJ70KVtwSTKE3/giphy.gif', // cute anime wink & sparkle
    'https://media.giphy.com/media/ye7OTQgwmVuNTYSS07/giphy.gif', // anime cheer & stars
    'https://media.giphy.com/media/5tmRHwTlHAA9WkVxTU/giphy.gif', // cute anime heart sparkle
    'https://media.giphy.com/media/lrr9rHuoJOE0w/giphy.gif', // happy anime girl bounce
    'https://media.giphy.com/media/nyGFcsP0kAobm/giphy.gif', // anime stardust wave
    'https://media.giphy.com/media/ARSp9T7wwxNcs/giphy.gif', // anime sweet smile
    'https://media.giphy.com/media/wnsgren9NtITS/giphy.gif', // anime cosmic spin
    'https://media.giphy.com/media/k95625LKWXPP2/giphy.gif', // anime cuddly hug
    'https://media.giphy.com/media/G3va31oEEnIkM/giphy.gif', // anime loving kiss
    'https://media.giphy.com/media/134BfF8UiBiVUc/giphy.gif'  // anime cute blush
];

const STARRY_VOICE_LINES = [
    '“Kira-kira! ✨ Starry has arrived to shower your day with stardust, <@USER>!” 🌟',
    '“Starry Starry! ~ Sparkle burst! Did someone call for their cosmic guardian? 💫”',
    '“By the light of the Astraea Constellation, I\'m always right beside you, <@USER>! 💖✨”',
    '“Ehehe~ Starry heard you calling! Here is a handful of lucky starlight just for you! ⭐🌌”',
    '“Twinkle twinkle little star, Starry loves you just the way you are! 🌟💖”',
    '“Yaaay! <@USER> called Starry! Let\'s make today magical and full of good vibes! ✨🎶”',
    '“Celestial mode activated! Sending maximum warmth, protection, and starry hugs! 🌠💫”',
    '“Starry Starry! 🌟 Your wishes have reached the cosmos! Keep shining bright!” ✨'
];

const STARRY_AVATAR = 'https://cdn.discordapp.com/emojis/1049283733054177301.webp?size=128';

// Anti-spam cooldown cache: channelId -> timestamp
const cooldowns = new Map();

function buildStarryPopEmbed(user, client) {
    const randomGif = STARRY_POP_GIFS[Math.floor(Math.random() * STARRY_POP_GIFS.length)];
    const rawLine = STARRY_VOICE_LINES[Math.floor(Math.random() * STARRY_VOICE_LINES.length)];
    const voiceLine = rawLine.replace(/<@USER>/g, `<@${user.id}>`);

    const embed = new EmbedBuilder()
        .setColor('#FF94D2') // Starry Cosmic Blossom Pink
        .setAuthor({ 
            name: '✨ Starry Starry! ~ Cosmic Mascot ✨', 
            iconURL: STARRY_AVATAR 
        })
        .setTitle('🌟 Kira-Kira! Starry-chan is here! 🌟')
        .setDescription(`> *${voiceLine}*`)
        .setImage(randomGif)
        .setFooter({ 
            text: 'Type "starry starry" or ",starry" anytime to summon Starry-chan! ✨' 
        })
        .setTimestamp();

    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId('starry_pop_stardust')
            .setLabel('✨ Give Stardust')
            .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
            .setCustomId('starry_pop_headpat')
            .setLabel('💖 Headpat')
            .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
            .setCustomId('starry_pop_sing')
            .setLabel('🎵 Sing Melody')
            .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
            .setCustomId('starry_pop_chat')
            .setLabel('💬 Chat in DMs')
            .setStyle(ButtonStyle.Secondary)
    );

    return { embed, row };
}

module.exports = (client) => {
    console.log('✨ [Starry Pop Engine] Initialized "Starry Starry" Signature Mascot Trigger.');

    // 1. Sniff chat messages for "starry starry" triggers
    client.on(Events.MessageCreate, async (message) => {
        if (message.author.bot) return;

        const content = message.content.toLowerCase().trim();
        const cleanContent = content.replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, ' ').trim();

        // Exact match triggers
        const triggers = [
            'starry starry',
            'starry starry',
            'starrystarry',
            'hey starry',
            'starry chan',
            'starrychan',
            'kira kira',
            'kirakira',
            'astraea',
            'starlight starlight'
        ];

        const isTriggered = triggers.some(t => cleanContent === t || cleanContent.startsWith(t + ' ') || cleanContent.endsWith(' ' + t) || cleanContent === ',' + t);
        if (!isTriggered) return;

        // Channel cooldown (3 seconds) to prevent fast spam
        const channelKey = message.channel.id;
        const now = Date.now();
        if (cooldowns.has(channelKey) && (now - cooldowns.get(channelKey)) < 3000) {
            return;
        }
        cooldowns.set(channelKey, now);

        try {
            const { embed, row } = buildStarryPopEmbed(message.author, client);
            await message.channel.send({ embeds: [embed], components: [row] });
        } catch (err) {
            console.warn('[Starry Pop] Send Warning:', err.message);
        }
    });

    // 2. Global Button Interactions for Starry Pop Reactions
    client.on(Events.InteractionCreate, async (interaction) => {
        if (!interaction.isButton()) return;
        const id = interaction.customId;

        if (id === 'starry_pop_stardust') {
            const embed = new EmbedBuilder()
                .setColor('#FFD700')
                .setAuthor({ name: 'Starry-chan ✨ Stardust Blessing', iconURL: STARRY_AVATAR })
                .setDescription(
                    `✨ **<@${interaction.user.id}> gave Starry a handful of sparkling stardust!**\n\n` +
                    `Starry\'s golden eyes glow with excitement: *“Arigatou gozaimasu! ✨ My cosmic power is supercharged thanks to you! (+100 Stardust Affinity 💖)”*`
                )
                .setImage('https://media.giphy.com/media/5tmRHwTlHAA9WkVxTU/giphy.gif')
                .setFooter({ text: 'Starry Affection System • Prefix: ,' });
            return interaction.reply({ embeds: [embed] }).catch(() => {});
        }

        if (id === 'starry_pop_headpat') {
            const embed = new EmbedBuilder()
                .setColor('#FF94D2')
                .setAuthor({ name: 'Starry-chan 💖 Sweet Headpat', iconURL: STARRY_AVATAR })
                .setDescription(
                    `💖 **<@${interaction.user.id}> gently patted Starry\'s starlight hair!**\n\n` +
                    `Starry blushes happily and smiles: *“Ehehe~ your hands are so warm and gentle! Starry will protect you forever and ever!”* 🌟🌸`
                )
                .setImage('https://media.giphy.com/media/ARSp9T7wwxNcs/giphy.gif')
                .setFooter({ text: 'Starry Affection System • Prefix: ,' });
            return interaction.reply({ embeds: [embed] }).catch(() => {});
        }

        if (id === 'starry_pop_sing') {
            const melodies = [
                '♪ *Twinkle twinkle cosmic sky, we will soar so bright and high...* 🌌 ♪',
                '♪ *La-la-lu, under the stars, no matter how far, you are in my heart...* 💖 ♪',
                '♪ *Starlight, star bright, first star I see tonight, may all your wishes take flight...* ✨ ♪'
            ];
            const song = melodies[Math.floor(Math.random() * melodies.length)];

            const embed = new EmbedBuilder()
                .setColor('#9B59B6')
                .setAuthor({ name: 'Starry-chan 🎵 Celestial Melody', iconURL: STARRY_AVATAR })
                .setDescription(
                    `🎵 **Starry sings a soft cosmic melody for <@${interaction.user.id}>:**\n\n` +
                    `> *${song}*\n\n` +
                    `✨ *A soothing chime of starlight rings softly through the channel...*`
                )
                .setImage('https://media.giphy.com/media/wnsgren9NtITS/giphy.gif')
                .setFooter({ text: 'Starry Musical Starlight' });
            return interaction.reply({ embeds: [embed] }).catch(() => {});
        }

        if (id === 'starry_pop_chat') {
            try {
                const dm = await interaction.user.createDM();
                await dm.send(`✨ **Hello <@${interaction.user.id}>!** 🌟 I am Starry, your cosmic AI guardian! Feel free to ask me anything or chat with me right here in our private DMs without any prefix! 💫`);
                return interaction.reply({ content: '💌 **I opened our private DM chat!** Check your Direct Messages to talk with me.', ephemeral: true }).catch(() => {});
            } catch (e) {
                return interaction.reply({ content: '❌ Could not send you a DM. Please enable Direct Messages in your Discord privacy settings.', ephemeral: true }).catch(() => {});
            }
        }
    });
};

module.exports.buildStarryPopEmbed = buildStarryPopEmbed;
