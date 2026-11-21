const { registerInteractionHandler } = require('../utils/interactionHandler');
// ==========================================
// 📥 GLOBAL EMOJI & STICKER STEALER MODULE (PART 1 OF 2)
// File Path: modules/steal.js
// ==========================================
const { 
    PermissionsBitField, 
    EmbedBuilder, 
    ActionRowBuilder, 
    ButtonBuilder, 
    ButtonStyle, 
    ComponentType,
    MessageFlags
} = require('discord.js');

const EPHEMERAL_FLAG = MessageFlags ? MessageFlags.Ephemeral : 6;

const config = require('../config');

const COMMAND_PREFIXES = Array.from(new Set([config.DEFAULT_PREFIX || ',', ',', '!']));
const CUSTOM_EMOJI_REGEX = /<(a?):([a-zA-Z0-9_]+):(\d+)>/g;

function parseStealCommand(content = '') {
    const input = String(content).trim();
    for (const prefix of COMMAND_PREFIXES) {
        if (!input.toLowerCase().startsWith(prefix.toLowerCase() + 'steal')) continue;
        const boundary = input.charAt(prefix.length + 5);
        if (boundary && !/\s/.test(boundary)) continue;
        return input.slice(prefix.length + 5).trim();
    }
    return null;
}

function extractStealItems(text = '', stickers = null, attachments = null) {
    const items = [];
    const seen = new Set();
    const add = item => {
        const key = item.id || item.url;
        if (!key || seen.has(key)) return;
        seen.add(key);
        items.push(item);
    };

    if (stickers && typeof stickers.forEach === 'function') {
        stickers.forEach(sticker => add({
            id: sticker.id,
            name: sticker.name,
            url: sticker.url,
            type: 'sticker'
        }));
    }

    let match;
    const content = String(text || '');
    CUSTOM_EMOJI_REGEX.lastIndex = 0;
    while ((match = CUSTOM_EMOJI_REGEX.exec(content)) !== null) {
        add({
            id: match[3],
            name: match[2],
            url: `https://cdn.discordapp.com/emojis/${match[3]}.${match[1] === 'a' ? 'gif' : 'png'}`,
            type: 'emoji'
        });
    }

    const urls = content.match(/https?:\/\/[^\s<>]+/gi) || [];
    for (const rawUrl of urls) {
        const url = rawUrl.replace(/[),.!?]+$/, '');
        try {
            const parsed = new URL(url);
            if (!['http:', 'https:'].includes(parsed.protocol)) continue;
            add({
                id: url,
                name: decodeURIComponent(parsed.pathname.split('/').pop() || 'stolen_image').replace(/\.[^.]+$/, '').replace(/[^a-zA-Z0-9_]/g, '_').slice(0, 32) || 'stolen_image',
                url,
                type: 'emoji'
            });
        } catch (_) {
            // Ignore malformed URLs; valid custom emoji and sticker items remain usable.
        }
    }

    if (attachments && typeof attachments.forEach === 'function') {
        attachments.forEach(file => {
            const isImage = String(file.contentType || '').startsWith('image/') || /\.(png|jpe?g|gif|webp)(?:\?|$)/i.test(file.url || '');
            if (isImage) {
                add({
                    id: file.id || file.url,
                    name: String(file.name || 'stolen_image').replace(/\.[^.]+$/, '').replace(/[^a-zA-Z0-9_]/g, '_').slice(0, 32) || 'stolen_image',
                    url: file.url,
                    type: 'emoji'
                });
            }
        });
    }

    return items;
}

function normalizeAssetName(name, fallback = 'stolen_emoji') {
    let value = String(name || fallback).replace(/[^a-zA-Z0-9_]/g, '_').slice(0, 32);
    if (value.length < 2) value = (value + '_').slice(0, 2);
    return value;
}

module.exports = (client) => {
    const PREFIX = config.DEFAULT_PREFIX || ',';

    const runStealUI = async (textToScan, stickers, member, guild, replyFunction, user, attachments = null) => {
        // 1. External / DM Context Check
        if (!guild) {
            return replyFunction({ 
                content: '❌ **Cannot upload emoji here:** You must run this command inside a server where Starry is present to upload stolen emojis/stickers!', 
                flags: [EPHEMERAL_FLAG] 
            });
        }

        // 2. Premium Lock
        if (typeof client.isPremium === 'function' && !client.isPremium(guild.id)) {
            return replyFunction({ 
                content: '❌ **Steal Emojis** is a Premium feature! Use `.premium` to learn how to upgrade your server.', 
                flags: [EPHEMERAL_FLAG] 
            });
        }

        // 3. Permissions Validation
        const managePerms = PermissionsBitField.Flags.ManageGuildExpressions || PermissionsBitField.Flags.ManageEmojisAndStickers;
        
        if (member && !member.permissions.has(managePerms)) {
            return replyFunction({ content: '❌ You need `Manage Emojis and Stickers` permission in this server.', flags: [EPHEMERAL_FLAG] });
        }

        const botMember = guild.members.me || await guild.members.fetch(client.user.id).catch(() => null);
        if (!botMember || !botMember.permissions.has(managePerms)) {
            return replyFunction({ content: '❌ I need `Manage Emojis and Stickers` permission in this server to upload emojis.', flags: [EPHEMERAL_FLAG] });
        }

        // 4. Extract custom emojis, stickers and direct image URLs.
        const itemsToSteal = extractStealItems(textToScan, stickers, attachments);
        
        if (itemsToSteal.length === 0) {
            return replyFunction({ content: 'ℹ️ Nothing to import was found. Reply to a message containing a custom emoji/sticker, or use `,steal <:name:id>` / `,steal https://image-url`.', flags: [EPHEMERAL_FLAG] });
        }

        // 5. Build Interactive UI
        let currentIndex = 0;
        const generateEmbed = (index) => new EmbedBuilder()
            .setColor('#2b2d31')
            .setTitle(`📥 Emoji/Sticker Stealer (${index + 1}/${itemsToSteal.length})`)
            .setDescription(`**Name:** \`${itemsToSteal[index].name}\`\n**Type:** \`${itemsToSteal[index].type.toUpperCase()}\``)
            .setImage(itemsToSteal[index].url)
            .setFooter({ text: `Target Server: ${guild.name}` });

        const generateButtons = (index) => new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('steal_prev').setLabel('◀').setStyle(ButtonStyle.Secondary).setDisabled(index === 0),
            new ButtonBuilder().setCustomId('steal_add').setLabel('📥 Upload to Server').setStyle(ButtonStyle.Success),
            new ButtonBuilder().setCustomId('steal_next').setLabel('▶').setStyle(ButtonStyle.Secondary).setDisabled(index === itemsToSteal.length - 1)
        );

        const activeUser = member?.user || user;
        const replyMsg = await replyFunction({ embeds: [generateEmbed(0)], components: [generateButtons(0)], fetchReply: true });
        const collector = replyMsg.createMessageComponentCollector({ componentType: ComponentType.Button, });

        collector.on('collect', async (i) => {
            if (i.user.id !== activeUser.id) {
                return i.reply({ content: '❌ You cannot control this session.', flags: [EPHEMERAL_FLAG] });
            }

            if (i.customId === 'steal_prev') { 
                currentIndex--; 
                await i.update({ embeds: [generateEmbed(currentIndex)], components: [generateButtons(currentIndex)] }); 
            } else if (i.customId === 'steal_next') { 
                currentIndex++; 
                await i.update({ embeds: [generateEmbed(currentIndex)], components: [generateButtons(currentIndex)] }); 
            } else if (i.customId === 'steal_add') {
                const item = itemsToSteal[currentIndex];
                try {
                    if (item.type === 'emoji') {
                        const createdEmoji = await guild.emojis.create({ attachment: item.url, name: normalizeAssetName(item.name) });
                        await i.reply({ content: `✅ Successfully uploaded emoji ${createdEmoji} (\`:${item.name}:\`) to **${guild.name}**!`, flags: [EPHEMERAL_FLAG] });
                    } else {
                        const createdSticker = await guild.stickers.create({ file: item.url, name: normalizeAssetName(item.name, 'stolen_sticker').slice(0, 30), tags: '⭐' });
                        await i.reply({ content: `✅ Successfully uploaded sticker **${createdSticker.name}** to **${guild.name}**!`, flags: [EPHEMERAL_FLAG] });
                    }
                } catch (e) { 
                    console.error('Steal Upload Error:', e);
                    await i.reply({ content: '❌ Upload failed: Server emoji/sticker slots are full or file size exceeds Discord limit.', flags: [EPHEMERAL_FLAG] }); 
                }
            }
        });
    };
    // Prefix Trigger (.steal) - Works in servers where bot is present
    client.on('messageCreate', async message => {
        if (message.author.bot) return;
        const commandInput = parseStealCommand(message.content);
        if (commandInput === null) return;
        if (!config.isBotOwner(message.author.id, client)) return;

        const target = message.reference?.messageId
            ? await message.channel.messages.fetch(message.reference.messageId).catch(() => null)
            : null;
        const scanText = [target?.content || '', commandInput].filter(Boolean).join(' ');
        const stickers = target?.stickers || message.stickers;
        const attachments = target?.attachments || message.attachments;

        await runStealUI(
            scanText,
            stickers,
            message.member,
            message.guild,
            payload => message.reply(payload),
            message.author,
            attachments
        );
    });

    // Interaction Listener (Slash Command & Context Menu) - Works EVERYWHERE via User App!
    registerInteractionHandler(client, 'steal:1', async interaction => {
        // Message Context Menu: Long press message -> Apps -> "Steal Emojis"
        if (interaction.isMessageContextMenuCommand() && interaction.commandName === 'Steal Emojis') {
            await runStealUI(
                interaction.targetMessage.content, 
                interaction.targetMessage.stickers, 
                interaction.member, 
                interaction.guild, 
                (p) => interaction.reply(p), 
                interaction.user,
                interaction.targetMessage.attachments
            );
        }

        // Slash Command: "/steal"
        if (interaction.isChatInputCommand() && interaction.commandName === 'steal') {
            await runStealUI(
                interaction.options.getString('emojis'), 
                null, 
                interaction.member, 
                interaction.guild, 
                (p) => interaction.reply(p), 
                interaction.user,
                null
            );
        }
    });
};

module.exports.parseStealCommand = parseStealCommand;
module.exports.extractStealItems = extractStealItems;
module.exports.normalizeAssetName = normalizeAssetName;
