// ==========================================
// 1. IMPORTS & GIF DATA ARRAYS
// ==========================================
const { 
    SlashCommandBuilder, 
    EmbedBuilder, 
    ActionRowBuilder, 
    ButtonBuilder, 
    ButtonStyle 
} = require('discord.js');
const mongoose = require('mongoose');

// Fallback User Schema in case models/User.js is loaded dynamically
const User = mongoose.models.User || require('../models/User');

const GIF_DATABASE = {
    kiss: [
        'https://cdn.nekos.life/kiss/kiss_001.gif', 'https://cdn.nekos.life/kiss/kiss_002.gif',
        'https://cdn.nekos.life/kiss/kiss_003.gif', 'https://cdn.nekos.life/kiss/kiss_004.gif',
        'https://purrbot.site/img/sfw/kiss/gif/kiss_001.gif', 'https://purrbot.site/img/sfw/kiss/gif/kiss_002.gif'
    ],
    pat: [
        'https://cdn.nekos.life/pat/pat_001.gif', 'https://cdn.nekos.life/pat/pat_002.gif',
        'https://purrbot.site/img/sfw/pat/gif/pat_001.gif', 'https://purrbot.site/img/sfw/pat/gif/pat_002.gif'
    ],
    hug: [
        'https://cdn.nekos.life/hug/hug_001.gif', 'https://cdn.nekos.life/hug/hug_002.gif',
        'https://purrbot.site/img/sfw/hug/gif/hug_001.gif', 'https://purrbot.site/img/sfw/hug/gif/hug_002.gif'
    ],
    slap: [
        'https://cdn.nekos.life/slap/slap_001.gif', 'https://cdn.nekos.life/slap/slap_002.gif',
        'https://purrbot.site/img/sfw/slap/gif/slap_001.gif', 'https://purrbot.site/img/sfw/slap/gif/slap_002.gif'
    ],
    cuddle: [
        'https://cdn.nekos.life/cuddle/cuddle_001.gif', 'https://cdn.nekos.life/cuddle/cuddle_002.gif',
        'https://purrbot.site/img/sfw/cuddle/gif/cuddle_001.gif'
    ],
    bite: [
        'https://purrbot.site/img/sfw/bite/gif/bite_001.gif', 'https://purrbot.site/img/sfw/bite/gif/bite_002.gif'
    ],
    poke: [
        'https://cdn.nekos.life/poke/poke_001.gif', 'https://purrbot.site/img/sfw/poke/gif/poke_001.gif'
    ],
    punch: [
        'https://purrbot.site/img/sfw/punch/gif/punch_001.gif'
    ],
    tickle: [
        'https://cdn.nekos.life/tickle/tickle_001.gif', 'https://purrbot.site/img/sfw/tickle/gif/tickle_001.gif'
    ],
    feed: [
        'https://cdn.nekos.life/feed/feed_001.gif', 'https://purrbot.site/img/sfw/feed/gif/feed_001.gif'
    ],
    lick: [
        'https://cdn.nekos.life/lick/lick_001.gif', 'https://purrbot.site/img/sfw/lick/gif/lick_001.gif'
    ],
    highfive: [
        'https://purrbot.site/img/sfw/highfive/gif/highfive_001.gif'
    ],
    wave: [
        'https://purrbot.site/img/sfw/wave/gif/wave_001.gif'
    ],
    sleep: [
        'https://media.tenor.com/7L3f6n4I5e8AAAAC/anime-sleep.gif', 'https://purrbot.site/img/sfw/sleep/gif/sleep_001.gif'
    ],
    wakeup: [
        'https://media.tenor.com/yFzN-d8C_jMAAAAC/anime-wakeup.gif'
    ],
    cry: [
        'https://purrbot.site/img/sfw/cry/gif/cry_001.gif', 'https://media.tenor.com/m40fH9PZ1JkAAAAC/anime-cry.gif'
    ],
    laugh: [
        'https://purrbot.site/img/sfw/laugh/gif/laugh_001.gif', 'https://media.tenor.com/8Q_a4Kqf8jAAAAAC/anime-laugh.gif'
    ],
    dance: [
        'https://purrbot.site/img/sfw/dance/gif/dance_001.gif', 'https://media.tenor.com/x8mR9xK6K8AAAAAC/anime-dance.gif'
    ],
    blush: [
        'https://purrbot.site/img/sfw/blush/gif/blush_001.gif'
    ],
    pout: [
        'https://purrbot.site/img/sfw/pout/gif/pout_001.gif'
    ],
    smile: [
        'https://purrbot.site/img/sfw/smile/gif/smile_001.gif'
    ],
    bored: [
        'https://media.tenor.com/6Uq4vA5C_mUAAAAC/anime-bored.gif'
    ]
};

// Full Action Configuration Master Table
const ACTION_CONFIG = {
    kiss: { verb: 'kisses', emoji: '💋', color: '#FFB6C1', dbField: 'kisses', allowsSelf: false, requiresTarget: true },
    pat: { verb: 'pets', emoji: '⭐', color: '#A7C7E7', dbField: 'pats', allowsSelf: false, requiresTarget: true },
    hug: { verb: 'hugs', emoji: '🤗', color: '#FF9494', dbField: 'hugs', allowsSelf: false, requiresTarget: true },
    slap: { verb: 'slaps', emoji: '✋', color: '#E74C3C', dbField: 'slaps', allowsSelf: false, requiresTarget: true },
    cuddle: { verb: 'cuddles with', emoji: '🥺', color: '#F39C12', dbField: 'cuddles', allowsSelf: false, requiresTarget: true },
    bite: { verb: 'bites', emoji: '🦷', color: '#9B59B6', dbField: 'bites', allowsSelf: false, requiresTarget: true },
    poke: { verb: 'pokes', emoji: '👉', color: '#3498DB', dbField: 'pokes', allowsSelf: false, requiresTarget: true },
    punch: { verb: 'punches', emoji: '🥊', color: '#C0392B', dbField: 'punches', allowsSelf: false, requiresTarget: true },
    tickle: { verb: 'tickles', emoji: '🤏', color: '#1ABC9C', dbField: 'tickles', allowsSelf: false, requiresTarget: true },
    feed: { verb: 'feeds', emoji: '🍱', color: '#2ECC71', dbField: 'feeds', allowsSelf: false, requiresTarget: true },
    lick: { verb: 'licks', emoji: '👅', color: '#E91E63', dbField: 'licks', allowsSelf: false, requiresTarget: true },
    highfive: { verb: 'highfives', emoji: '🙌', color: '#F1C40F', dbField: 'highfives', allowsSelf: false, requiresTarget: true },
    wave: { verb: 'waves at', emoji: '👋', color: '#34495E', dbField: 'waves', allowsSelf: false, requiresTarget: true },
    
    // Solo Emotions / Actions
    sleep: { verb: 'is sleeping zzz...', emoji: '😴', color: '#2C3E50', allowsSelf: true, requiresTarget: false },
    wakeup: { verb: 'just woke up!', emoji: '⏰', color: '#E67E22', allowsSelf: true, requiresTarget: false },
    cry: { verb: 'is crying...', emoji: '😭', color: '#3498DB', allowsSelf: true, requiresTarget: false },
    laugh: { verb: 'is laughing hysterically!', emoji: '😆', color: '#F1C40F', allowsSelf: true, requiresTarget: false },
    dance: { verb: 'is dancing happily!', emoji: '💃', color: '#9B59B6', allowsSelf: true, requiresTarget: false },
    blush: { verb: 'is blushing deeply...', emoji: '😳', color: '#FFB6C1', allowsSelf: true, requiresTarget: false },
    pout: { verb: 'is pouting!', emoji: '😤', color: '#E74C3C', allowsSelf: true, requiresTarget: false },
    smile: { verb: 'smiles warmly!', emoji: '😊', color: '#2ECC71', allowsSelf: true, requiresTarget: false },
    bored: { verb: 'is feeling super bored...', emoji: '🥱', color: '#95A5A6', allowsSelf: true, requiresTarget: false }
};
// ==========================================
// 2. CORE ACTION EXECUTOR ENGINE
// ==========================================
async function executeSocialAction(actionKey, context, isSlash) {
    const config = ACTION_CONFIG[actionKey];
    if (!config) return;

    const guildId = context.guildId || 'DM';
    const authorId = isSlash ? context.user.id : context.author.id;
    const authorName = isSlash ? context.user.username : context.author.username;

    let target = null;

    if (config.requiresTarget) {
        if (isSlash) {
            target = context.options.getUser('target');
        } else {
            if (context.reference && context.reference.messageId) {
                try {
                    const refMsg = await context.channel.messages.fetch(context.reference.messageId);
                    target = refMsg.author;
                } catch (err) {}
            } else if (context.mentions && context.mentions.users.size > 0) {
                target = context.mentions.users.first();
            }
        }

        if (!target) {
            const reqMsg = `❌ Please reply to a message or mention a user to ${actionKey} them!`;
            return isSlash ? context.reply({ content: reqMsg, ephemeral: true }) : context.reply(reqMsg);
        }

        if (target.id === authorId && !config.allowsSelf) {
            const errReply = `❌ You can't ${actionKey} yourself!`;
            return isSlash ? (context.deferred || context.replied ? context.editReply(errReply) : context.reply({ content: errReply, ephemeral: true })) : context.reply(errReply);
        }
    }

    if (isSlash && !context.deferred && !context.replied) {
        await context.deferReply();
    }

    let mutualCount = 1;
    const pairKey = target ? [authorId, target.id].sort().join('_') : null;

    if (target && config.dbField && User) {
        try {
            const givenKey = `${config.dbField}Given`;
            const receivedKey = `${config.dbField}Received`;
            const sharedKey = `${config.dbField}Shared`;

            await User.updateOne({ userId: authorId, guildId }, { $inc: { [givenKey]: 1 } }, { upsert: true, strict: false });
            await User.updateOne({ userId: target.id, guildId }, { $inc: { [receivedKey]: 1 } }, { upsert: true, strict: false });

            await User.updateOne({ userId: pairKey, guildId }, { $inc: { [sharedKey]: 1 } }, { upsert: true, strict: false });
            const pairDoc = await User.findOne({ userId: pairKey, guildId }).lean();
            if (pairDoc && pairDoc[sharedKey]) mutualCount = pairDoc[sharedKey];
        } catch (err) {
            console.error(`DB ${actionKey} Error:`, err);
        }
    }

    const gifList = GIF_DATABASE[actionKey] || GIF_DATABASE.hug;
    const randomGif = gifList[Math.floor(Math.random() * gifList.length)];

    let descriptionText = `**${authorName}** ${config.verb}`;
    if (target) {
        descriptionText += ` **${target.username}**!\n*You two have shared ${mutualCount} ${actionKey}s.*`;
    }

    const embed = new EmbedBuilder()
        .setColor(config.color)
        .setDescription(descriptionText)
        .setImage(randomGif);

    const components = [];
    if (target && !target.bot) {
        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId(`social_${actionKey}_back`)
                .setLabel(`${actionKey.charAt(0).toUpperCase() + actionKey.slice(1)} back`)
                .setStyle(ButtonStyle.Secondary)
                .setEmoji(config.emoji)
        );
        components.push(row);
    }

    let response = isSlash ? await context.editReply({ embeds: [embed], components }) : await context.reply({ embeds: [embed], components });

    if (components.length === 0) return;

    // --- Interactive Action-Back Collector ---
    const collector = response.createMessageComponentCollector({ time: 300000 });

    collector.on('collect', async (i) => {
        if (i.user.id === authorId) {
            return i.reply({ content: `You can't ${actionKey} yourself back!`, ephemeral: true });
        }

        await i.deferReply();
        let backMutualCount = 1;

        if (config.dbField && User) {
            try {
                const givenKey = `${config.dbField}Given`;
                const receivedKey = `${config.dbField}Received`;
                const sharedKey = `${config.dbField}Shared`;

                await User.updateOne({ userId: i.user.id, guildId }, { $inc: { [givenKey]: 1 } }, { upsert: true, strict: false });
                await User.updateOne({ userId: authorId, guildId }, { $inc: { [receivedKey]: 1 } }, { upsert: true, strict: false });

                await User.updateOne({ userId: pairKey, guildId }, { $inc: { [sharedKey]: 1 } }, { upsert: true, strict: false });
                const backPairDoc = await User.findOne({ userId: pairKey, guildId }).lean();
                if (backPairDoc && backPairDoc[sharedKey]) backMutualCount = backPairDoc[sharedKey];
            } catch (err) {}
        }

        const returnGif = gifList[Math.floor(Math.random() * gifList.length)];
        const returnEmbed = new EmbedBuilder()
            .setColor(config.color)
            .setDescription(`**${i.user.username}** ${config.verb} **${authorName}** back!\n*You two have shared ${backMutualCount} ${actionKey}s.*`)
            .setImage(returnGif);

        components[0].components[0].setDisabled(true);
        if (isSlash) await context.editReply({ components: [components[0]] }).catch(() => {});
        else await response.edit({ components: [components[0]] }).catch(() => {});

        await i.editReply({ embeds: [returnEmbed] });
    });

    collector.on('end', () => {
        if (components[0] && !components[0].components[0].data.disabled) {
            components[0].components[0].setDisabled(true);
            if (isSlash) context.editReply({ components: [components[0]] }).catch(() => {});
            else response.edit({ components: [components[0]] }).catch(() => {});
        }
    });
}
// ==========================================
// 3. SLASH COMMAND BUILDERS & EXPORTS
// ==========================================
const exportedCommands = [];

Object.keys(ACTION_CONFIG).forEach(actionKey => {
    const config = ACTION_CONFIG[actionKey];
    
    const builder = new SlashCommandBuilder()
        .setName(actionKey)
        .setDescription(`${actionKey.charAt(0).toUpperCase() + actionKey.slice(1)} action expression`)
        .setContexts([0, 1, 2])
        .setIntegrationTypes([0, 1]);

    if (config.requiresTarget) {
        builder.addUserOption(option => 
            option.setName('target')
                .setDescription(`The user to ${actionKey}`)
                .setRequired(true)
        );
    }

    const commandObj = {
        data: builder,
        name: actionKey,
        aliases: [`.${actionKey}`, actionKey],
        description: builder.description,
        async execute(...args) {
            const arg1 = args[0];
            const arg2 = args[1];
            if (arg1 && typeof arg1.isChatInputCommand === 'function' && arg1.isChatInputCommand()) {
                return await executeSocialAction(actionKey, arg1, true);
            }
            const message = (arg1 && arg1.author) ? arg1 : ((arg2 && arg2.author) ? arg2 : null);
            if (message) return await executeSocialAction(actionKey, message, false);
        },
        async run(...args) {
            return this.execute(...args);
        }
    };

    exportedCommands.push(commandObj);
});
// ==========================================
// 4. CLIENT LISTENER MODULE INITIALIZER
// ==========================================
module.exports = (client) => {
    // Register prefix and slash listeners directly into client memory collections
    exportedCommands.forEach(cmd => {
        if (client.commands && typeof client.commands.set === 'function') {
            client.commands.set(cmd.name, cmd);
        }
        if (client.prefixCommands && typeof client.prefixCommands.set === 'function') {
            client.prefixCommands.set(cmd.name, cmd);
            cmd.aliases.forEach(alias => client.prefixCommands.set(alias, cmd));
        }
    });

    // Dedicated Prefix Listener Fallback for Social Actions (.hug, .kiss, .slap, etc.)
    client.on('messageCreate', async (message) => {
        if (message.author.bot || !message.content) return;

        const content = message.content.toLowerCase().trim();
        const firstWord = content.split(' ')[0];

        Object.keys(ACTION_CONFIG).forEach(async (actionKey) => {
            if (firstWord === `.${actionKey}` || firstWord === actionKey) {
                const cmdObj = exportedCommands.find(c => c.name === actionKey);
                if (cmdObj) await cmdObj.execute(message);
            }
        });
    });
};

// Export individual commands for deploy-commands.js or command handlers
exportedCommands.forEach(cmd => {
    module.exports[cmd.name] = cmd;
});

module.exports.socialCommandsPayload = exportedCommands.map(c => c.data.toJSON());
