// ==========================================
// 🚀 MASTER COMMAND REGISTRY & UNIFIED DISPATCHER
// File Path: src/modules/commandHandler.js
// 165+ Master Commands • Dual Prefix (, & .) • Mention Support • 1-Year Persistent Interaction Engine
// Fully compatible with Android/Termux & PC (Windows/Linux/macOS)
// ==========================================
const { 
    Collection, 
    Events, 
    EmbedBuilder, 
    PermissionFlagsBits,
    AttachmentBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle
} = require('discord.js');
const fs = require('fs');
const path = require('path');
const config = require('../config');
const { CommandContext, ONE_YEAR_MS, EPHEMERAL_FLAG } = require('../utils/contextHelper');
const { buildCategoryEmbed, createHelpComponents } = require('../utils/helpHelper');
const User = require('../models/User');

// Guild Prefix In-Memory Cache
const guildPrefixCache = new Map();

async function getGuildPrefix(guildId) {
    if (!guildId) return ',';
    if (guildPrefixCache.has(guildId)) return guildPrefixCache.get(guildId);
    try {
        const mongoose = require('mongoose');
        if (!mongoose.connection || mongoose.connection.readyState !== 1) {
            guildPrefixCache.set(guildId, ',');
            return ',';
        }
        const ServerSettings = require('../models/ServerSettings');
        const settings = await Promise.race([
            ServerSettings.findOne({ guildId }).select('prefix').lean(),
            new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 1000))
        ]);
        const p = settings?.prefix || ',';
        guildPrefixCache.set(guildId, p);
        return p;
    } catch (e) {
        guildPrefixCache.set(guildId, ',');
        return ',';
    }
}

function setCachedPrefix(guildId, prefix) {
    if (guildId) guildPrefixCache.set(guildId, prefix || ',');
}

// Load Master Bundles
const musicCommands = require('../commands/bundles/musicCommands');
const moderationCommands = require('../commands/bundles/moderationCommands');
const utilityCommands = require('../commands/bundles/utilityCommands');
const socialCommands = require('../commands/bundles/socialCommands');
const economyCommands = require('../commands/bundles/economyCommands');
const gameCommands = require('../commands/bundles/gameCommands');
const systemCommands = require('../commands/bundles/systemCommands');
const nsfwCommands = require('../commands/bundles/nsfwCommands');

const allBundles = [
    ...musicCommands,
    ...moderationCommands,
    ...utilityCommands,
    ...socialCommands,
    ...economyCommands,
    ...gameCommands,
    ...systemCommands,
    ...nsfwCommands
];

function getFilesRecursively(dir) {
    let results = [];
    if (!fs.existsSync(dir)) return results;
    const list = fs.readdirSync(dir);
    for (const file of list) {
        const fullPath = path.join(dir, file);
        const stat = fs.statSync(fullPath);
        if (stat && stat.isDirectory()) {
            if (file === 'bundles' || file === 'node_modules') continue;
            results = results.concat(getFilesRecursively(fullPath));
        } else if (file.endsWith('.js')) {
            results.push(fullPath);
        }
    }
    return results;
}

class CommandRegistry {
    constructor() {
        this.commands = new Collection();
        this.aliases = new Collection();
        this.categories = new Collection();
    }

    init(client) {
        this.commands.clear();
        this.aliases.clear();
        this.categories.clear();

        if (!client.commands) client.commands = new Collection();
        if (!client.prefixCommands) client.prefixCommands = new Collection();
        if (!client.aliases) client.aliases = new Collection();

        // 1. Register Master Bundled Commands (Primary Source of Truth)
        for (const cmd of allBundles) {
            if (!cmd.name) continue;
            const name = cmd.name.toLowerCase();
            this.commands.set(name, cmd);
            client.commands.set(name, cmd);
            client.prefixCommands.set(name, cmd);

            if (cmd.category) {
                if (!this.categories.has(cmd.category)) this.categories.set(cmd.category, []);
                this.categories.get(cmd.category).push(cmd);
            }

            if (cmd.aliases && Array.isArray(cmd.aliases)) {
                for (const alias of cmd.aliases) {
                    const cleanAlias = alias.toLowerCase();
                    this.aliases.set(cleanAlias, name);
                    client.aliases.set(cleanAlias, name);
                    client.prefixCommands.set(cleanAlias, cmd);
                }
            }
        }

        // 2. Load standalone commands only if not already present in master bundles
        const commandsRoot = path.join(__dirname, '..', 'commands');
        const standaloneFiles = getFilesRecursively(commandsRoot);
        for (const file of standaloneFiles) {
            try {
                const cmdModule = require(file);
                const name = (cmdModule?.data?.name || cmdModule?.name || path.basename(file, '.js')).toLowerCase();
                
                // Do not overwrite working master bundled commands with stubs
                if (!this.commands.has(name) && typeof cmdModule.execute === 'function') {
                    this.commands.set(name, cmdModule);
                    client.commands.set(name, cmdModule);
                }
            } catch (err) {
                // Ignore non-command utility scripts
            }
        }

        console.log(`✅ [Master Command Registry] Loaded ${this.commands.size} base commands (${this.commands.size + this.aliases.size} with aliases) across 6 categories!`);

        this.registerPrefixDispatcher(client);
        this.registerInteractionDispatcher(client);

        // Initialize Dedicated Music Controller System
        try {
            const musicController = require('./musicController');
            musicController.init(client);
        } catch (e) {}

        // Connect multi-bot worker nodes if cluster is enabled
        const multiBot = require('./multiBot');
        if (multiBot && typeof multiBot.registerEventHook === 'function') {
            multiBot.registerEventHook((workerClient) => {
                this.registerPrefixDispatcher(workerClient);
                this.registerInteractionDispatcher(workerClient);
            });
            for (const [id, info] of multiBot.instances.entries()) {
                if (info.client && !info.isPrimary) {
                    this.registerPrefixDispatcher(info.client);
                    this.registerInteractionDispatcher(info.client);
                }
            }
        }
    }

    registerPrefixDispatcher(client) {
        client.on(Events.MessageCreate, async (message) => {
            if (!message || message.author?.bot || !message.content) return;

            // Intercept Dedicated Music Controller Request Channel
            if (message.guild) {
                const musicController = require('./musicController');
                if (musicController.isRequestChannel(message.guild.id, message.channel.id)) {
                    const raw = message.content.trim();
                    if (!raw.startsWith(',') && !raw.startsWith('.')) {
                        return musicController.handleSongRequest(message, client);
                    }
                }
            }

            let content = message.content.trim();
            const multiBot = client.multiBot || require('./multiBot');
            const primaryId = multiBot?.primaryClient?.user?.id || client.user?.id;
            const isPrimary = (client.user?.id === primaryId) || (!multiBot?.primaryClient);

            let matchedPrefix = null;
            let commandBody = '';

            // A. Check Bot Mention (<@BOT_ID> command)
            const mentionMatch = content.match(/^<@!?(\d+)>\s*(.*)$/);
            if (mentionMatch) {
                const mentionedId = mentionMatch[1];
                if (client.user?.id !== mentionedId) return; // Only target bot responds
                commandBody = mentionMatch[2].trim();
                matchedPrefix = '@';
            }
            // B. Check Multi-Bot Cluster Prefixes (s1,, s2,, s3,, 1,, 2,, 3,, ,s1, ,s2, etc.)
            else {
                const clusterMatch = content.match(/^(?:s|S)?(\d+)[,](.*)$/i) || content.match(/^[,](\d+)(.*)$/i) || content.match(/^[,](?:s|S)(\d+)(.*)$/i);
                if (clusterMatch) {
                    const botIndex = parseInt(clusterMatch[1], 10);
                    const botArray = multiBot?.instances ? Array.from(multiBot.instances.values()) : [];
                    let targetId = null;

                    if (botIndex === 1) targetId = primaryId;
                    else if (botIndex === 2) targetId = '1543515940069572628' || botArray[1]?.client?.user?.id;
                    else if (botIndex === 3) targetId = '1543519236586999928' || botArray[2]?.client?.user?.id;
                    else if (botArray[botIndex - 1]) targetId = botArray[botIndex - 1].client?.user?.id;

                    if (client.user?.id !== targetId) return;
                    commandBody = clusterMatch[2].trim();
                    matchedPrefix = 's' + botIndex;
                } 
                // C. Single Comma (,) Default Prefix & Custom Server Prefix
                else {
                    if (content.startsWith('<@')) return;
                    if (!isPrimary) return; // Standard prefix handled exclusively by primary bot

                    const guildId = message.guild?.id;
                    if (content.startsWith(',')) {
                        matchedPrefix = ',';
                        commandBody = content.slice(1).trim();
                    } else if (guildId) {
                        const activePrefix = guildPrefixCache.has(guildId) 
                            ? guildPrefixCache.get(guildId) 
                            : await getGuildPrefix(guildId);

                        if (activePrefix && activePrefix !== ',' && content.startsWith(activePrefix)) {
                            matchedPrefix = activePrefix;
                            commandBody = content.slice(activePrefix.length).trim();
                        } else {
                            return; // Not a command
                        }
                    } else if (!message.guild) {
                        const firstWord = content.toLowerCase().split(/\s+/)[0];
                        const isCmd = this.commands.has(firstWord) || this.aliases.has(firstWord);
                        if (isCmd) {
                            matchedPrefix = '';
                            commandBody = content;
                        } else {
                            // In DMs, talk directly with Starry AI without needing a prefix (Nekotina-style)
                            matchedPrefix = '';
                            commandBody = 'ask ' + content;
                        }
                    } else {
                        return; // Not a command
                    }
                }
            }

            if (!commandBody) return;
            // Ignore custom emoji spam (e.g. ,<:emoji:id>)
            if (commandBody.startsWith('<:') || commandBody.startsWith('<a:')) return;

            const args = commandBody.split(/\s+/);
            const commandKey = args.shift()?.toLowerCase();
            if (!commandKey) return;

            const resolvedName = this.aliases.get(commandKey) || commandKey;
            const command = this.commands.get(resolvedName);
            if (!command) return;

            console.log(`⚡ [Command] Executing ,${resolvedName} for ${message.author.tag} in ${message.guild?.name || 'DM'}`);
            const ctx = new CommandContext(message, client, args);

            // Guard server-only commands when run in DMs
            if (!message.guild && (command.category === 'Moderation' || command.category === 'Economy' || command.guildOnly)) {
                return ctx.reply('❌ This command can only be used inside a Discord server.');
            }

            try {
                // Check permissions if in a guild
                if (message.guild && command.permissions && Array.isArray(command.permissions)) {
                    if (!config.BOT_OWNERS?.includes(message.author.id)) {
                        for (const perm of command.permissions) {
                            if (!message.member?.permissions?.has(perm)) {
                                return ctx.reply('❌ You do not have sufficient permissions to execute this command.');
                            }
                        }
                    }
                }

                if (typeof command.execute === 'function') {
                    await command.execute(ctx, client);
                }
            } catch (err) {
                console.error(`❌ Error executing prefix command ,${resolvedName}:`, err);
                await ctx.reply(`⚠️ An error occurred while executing \`,${resolvedName}\`: \`${err.message}\``).catch(() => {});
            }
        });
    }

    registerInteractionDispatcher(client) {
        client.on(Events.InteractionCreate, async (interaction) => {
            // 1. Handle Slash Commands
            if (interaction.isChatInputCommand()) {
                const commandName = interaction.commandName.toLowerCase();
                const resolvedName = this.aliases.get(commandName) || commandName;
                const command = this.commands.get(resolvedName) || client.commands?.get(resolvedName);

                if (command) {
                    try {
                        const ctx = new CommandContext(interaction, client, []);
                        
                        // Instant 0ms defer to guarantee Discord never shows "Application did not respond"
                        if (!interaction.deferred && !interaction.replied && command.autoDefer !== false) {
                            const deferOpts = command.ephemeral ? { flags: [MessageFlags.Ephemeral] } : {};
                            await interaction.deferReply(deferOpts).catch(() => {});
                            ctx.deferred = true;
                        }

                        if (typeof command.execute === 'function') {
                            await command.execute(ctx, client);
                        }
                    } catch (err) {
                        console.error(`❌ Slash Command Error (/${commandName}):`, err);
                        const msg = `⚠️ Error executing command: \`${err.message}\``;
                        if (!interaction.replied && !interaction.deferred) {
                            await interaction.reply({ content: msg, ephemeral: true }).catch(() => {});
                        } else {
                            await interaction.followUp({ content: msg, ephemeral: true }).catch(() => {});
                        }
                    }
                    return;
                }
                return;
            }

            // 2. Handle Global 1-Year Persistent Button & Select Menu Interactions
            if (interaction.isButton() || interaction.isStringSelectMenu()) {
                const customId = interaction.customId;

                // A. Help Menu Dropdown & Navigation
                if (customId === 'help_select' || customId.startsWith('help_btn_')) {
                    let targetCat = 'home';
                    if (interaction.isStringSelectMenu()) {
                        targetCat = interaction.values[0] || 'home';
                    } else if (interaction.isButton()) {
                        targetCat = customId.replace('help_btn_', '');
                    }

                    const prefix = config.DEFAULT_PREFIX || ',';
                    return await interaction.update({
                        embeds: [buildCategoryEmbed(targetCat, prefix)],
                        components: createHelpComponents()
                    }).catch(() => {});
                }

                // B. Chest Claim Buttons (1-Year Global Handler)
                if (customId === 'claim_chest' || customId === 'claim_wild_chest') {
                    await interaction.deferUpdate().catch(() => {});

                    const userId = interaction.user.id;
                    const guildId = interaction.guild?.id || interaction.guildId;

                    let userData = await User.findOne({ userId, guildId });
                    if (!userData) userData = new User({ userId, guildId });

                    const rarities = [
                        { name: 'Common', color: '#95a5a6', minXp: 100, maxXp: 300, minCred: 20, maxCred: 50, chance: 50 },
                        { name: 'Uncommon', color: '#2ecc71', minXp: 300, maxXp: 800, minCred: 50, maxCred: 120, chance: 30 },
                        { name: 'Rare', color: '#3498db', minXp: 800, maxXp: 1800, minCred: 120, maxCred: 250, chance: 13 },
                        { name: 'Epic', color: '#9b59b6', minXp: 1800, maxXp: 3500, minCred: 250, maxCred: 500, chance: 5 },
                        { name: 'Legendary', color: '#f1c40f', minXp: 3500, maxXp: 7000, minCred: 500, maxCred: 1200, chance: 2 }
                    ];

                    const roll = Math.random() * 100;
                    let cumulative = 0;
                    let selectedRarity = rarities[0];
                    for (const r of rarities) {
                        cumulative += r.chance;
                        if (roll <= cumulative) { selectedRarity = r; break; }
                    }

                    const prestigeBonus = 1 + ((userData.prestige || 0) * 0.15);
                    const rawXp = Math.floor(Math.random() * (selectedRarity.maxXp - selectedRarity.minXp + 1)) + selectedRarity.minXp;
                    const rawCred = Math.floor(Math.random() * (selectedRarity.maxCred - selectedRarity.minCred + 1)) + selectedRarity.minCred;

                    const finalXp = Math.floor(rawXp * prestigeBonus);
                    const baseCred = Math.floor(rawCred * prestigeBonus);

                    let petBonusCred = 0;
                    if (userData.activePet && userData.petHappiness > 0) {
                        petBonusCred = Math.floor(baseCred * (userData.petHappiness / 100) * 0.35);
                    }
                    const finalCred = baseCred + petBonusCred;

                    userData.xp = (userData.xp || 0) + finalXp;
                    userData.credits = (userData.credits || 0) + finalCred;
                    await userData.save();

                    const claimedEmbed = new EmbedBuilder()
                        .setColor(selectedRarity.color)
                        .setThumbnail('https://cdn-icons-png.flaticon.com/512/2852/2852825.png')
                        .setTitle(`💰 ${selectedRarity.name} Chest Claimed!`)
                        .setDescription(
                            `<@${userId}> claimed the chest!\n` +
                            `✨ **${finalXp.toLocaleString()} XP!**\n` +
                            `💳 **+${finalCred.toLocaleString()} Credits** ${petBonusCred > 0 ? `*(🐾 +${petBonusCred} from pet bonus)*` : ''}\n\n` +
                            `🛍️ *Spend your credits in the **/shop** for exclusive roles and pets!* 🛍️`
                        )
                        .setFooter({ text: 'Starry Loot Engine', iconURL: client.user.displayAvatarURL() });

                    return await interaction.message.edit({ embeds: [claimedEmbed], components: [] }).catch(() => {});
                }

                // C. Social Action Back Buttons (Instant 0ms Global Handler with DB tracking)
                if (customId.startsWith('social_') && customId.includes('_back_')) {
                    const { handleSocialBackButton } = require('./socialActions');
                    return await handleSocialBackButton(interaction);
                }

                // C2. Social Action Menu Selector Dropdown
                if (customId === 'social_select_action') {
                    const { handleSocialSelectMenu } = require('./socialActions');
                    return await handleSocialSelectMenu(interaction);
                }

                // C3. Marriage Accept / Decline Buttons (Instant Global Handler)
                if (customId.startsWith('marry_yes_') || customId.startsWith('marry_no_')) {
                    const parts = customId.split('_');
                    const proposerId = parts[2];
                    const targetId = parts[3];

                    if (interaction.user.id !== targetId) {
                        return interaction.reply({
                            content: `❌ Only <@${targetId}> can respond to this proposal!`,
                            ephemeral: true
                        }).catch(() => {});
                    }

                    const mongoose = require('mongoose');
                    const EcoUser = mongoose.models.EcoUser;

                    if (interaction.replied || interaction.deferred) return;

                    if (customId.startsWith('marry_yes_')) {
                        const now = new Date();
                        if (EcoUser) {
                            await EcoUser.updateMany({ userId: proposerId }, { $set: { marriedTo: targetId, marriedAt: now } }).catch(() => {});
                            await EcoUser.updateMany({ userId: targetId }, { $set: { marriedTo: proposerId, marriedAt: now } }).catch(() => {});
                        }

                        const { getAnimeAttachment, getRandomKissGif } = require('../utils/animeGifs');
                        const anim = getAnimeAttachment('kiss');
                        const unixTime = Math.floor(now.getTime() / 1000);

                        const acceptedEmbed = new EmbedBuilder()
                            .setColor('#FF69B4')
                            .setTitle('💍💖 JUST MARRIED! 💖💍')
                            .setDescription(
                                `✨ **<@${proposerId}>** & **<@${targetId}>** have officially tied the knot! ✨\n\n` +
                                `*“Two souls bound by love across the infinite cosmos. May your journey through the stars be filled with eternal romance, joy, and warmth!”* 🌌🥂\n\n` +
                                `💍 **Spouses:** <@${proposerId}> ❤️ <@${targetId}>\n` +
                                `📅 **Matrimony Date:** <t:${unixTime}:D> (<t:${unixTime}:R>)\n` +
                                `💫 **Status:** Official & Blessed in Starry Matrimony\n\n` +
                                `*Sealed with a passionate kiss!* 💕`
                            )
                            .setImage(anim ? anim.attachmentUrl : getRandomKissGif())
                            .setFooter({ text: 'Starry Matrimony Suite • Check with /profile or ,profile' })
                            .setTimestamp(now);

                        const updatePayload = { embeds: [acceptedEmbed], components: [] };
                        if (anim) updatePayload.files = [anim.attachment];
                        return interaction.update(updatePayload).catch(() => {});
                    } else {
                        const { getAnimeAttachment, getRandomSlapGif } = require('../utils/animeGifs');
                        const anim = getAnimeAttachment('slap');

                        const declinedEmbed = new EmbedBuilder()
                            .setColor('#ED4245')
                            .setTitle('💔 OUCH! PROPOSAL REJECTED! ✋💥')
                            .setDescription(
                                `💥 **<@${targetId}>** delivered a thunderous slap and rejected **<@${proposerId}>**'s proposal!\n\n` +
                                `*“Oof! That's gotta leave a mark... Not today, starry lover! Better luck next time!”* 🥀💔\n\n` +
                                `💔 **Declined By:** <@${targetId}>\n` +
                                `🩹 **Condition:** Emotional Damage (Critical Hit)\n\n` +
                                `✨ *Don't worry <@${proposerId}>, there are billions of other shining stars in the cosmos!*`
                            )
                            .setImage(anim ? anim.attachmentUrl : getRandomSlapGif())
                            .setFooter({ text: 'Starry Matrimony Suite • Proposal Declined' })
                            .setTimestamp();

                        const updatePayload = { embeds: [declinedEmbed], components: [] };
                        if (anim) updatePayload.files = [anim.attachment];
                        return interaction.update(updatePayload).catch(() => {});
                    }
                }

                // D. AI Image Regenerate & Enhance Variations (1-Year Global Handler)
                if (customId.startsWith('ai_regen_') || customId.startsWith('ai_enhance_')) {
                    await interaction.deferUpdate().catch(() => {});

                    const embed = interaction.message.embeds?.[0];
                    if (!embed) return;

                    // Extract prompt from embed description
                    let prompt = '';
                    const desc = embed.description || '';
                    const match = desc.match(/Prompt:\*\* "(.*?)"/s) || desc.match(/Prompt:\*\* (.*?)\n/s);
                    if (match && match[1]) {
                        prompt = match[1];
                    } else {
                        prompt = embed.title || 'Masterpiece artwork';
                    }

                    if (customId.startsWith('ai_enhance_')) {
                        if (!prompt.includes('masterpiece') && !prompt.includes('8k resolution')) {
                            prompt = `${prompt}, masterpiece, highly detailed, 8k resolution, cinematic lighting, ultra-fine art, photorealistic`;
                        }
                    }

                    const newSeed = Math.floor(Math.random() * 9999999);
                    const encoded = encodeURIComponent(prompt);
                    const imgUrl = `https://image.pollinations.ai/prompt/${encoded}?width=1024&height=1024&nologo=true&seed=${newSeed}&model=flux&enhance=true`;

                    try {
                        const fetch = require('node-fetch');
                        const controller = new AbortController();
                        const timeoutId = setTimeout(() => controller.abort(), 25000);
                        const res = await fetch(imgUrl, { signal: controller.signal });
                        clearTimeout(timeoutId);

                        if (res.ok) {
                            const arrayBuffer = await res.arrayBuffer();
                            const buffer = Buffer.from(arrayBuffer);
                            const attachment = new AttachmentBuilder(buffer, { name: `starry_art_${newSeed}.jpg` });

                            const updatedEmbed = EmbedBuilder.from(embed)
                                .setDescription(`✨ **Prompt:** "${prompt.length > 250 ? prompt.substring(0, 247) + '...' : prompt}"\n🧠 **Engine:** \`Flux.1 Schnell (1024x1024 HD)\`\n👤 **Requested by:** <@${interaction.user.id}>`)
                                .setImage(`attachment://starry_art_${newSeed}.jpg`)
                                .setFooter({ text: `Seed: ${newSeed} • Starry AI • Direct HD Rendering` })
                                .setTimestamp();

                            const updatedRow = new ActionRowBuilder().addComponents(
                                new ButtonBuilder()
                                    .setCustomId(`ai_regen_${newSeed}`)
                                    .setLabel('🔄 Regenerate')
                                    .setStyle(ButtonStyle.Primary),
                                new ButtonBuilder()
                                    .setCustomId(`ai_enhance_${newSeed}`)
                                    .setLabel('✨ Enhance Variations')
                                    .setStyle(ButtonStyle.Secondary),
                                new ButtonBuilder()
                                    .setLabel('📥 Direct HD Link')
                                    .setStyle(ButtonStyle.Link)
                                    .setURL(imgUrl)
                            );

                            await interaction.message.edit({
                                embeds: [updatedEmbed],
                                components: [updatedRow],
                                files: [attachment],
                                attachments: []
                            }).catch(() => {});
                        }
                    } catch (err) {
                        console.error('AI Image Regenerate Error:', err);
                    }
                    return;
                }

                // E. NSFW & Mature Anime Interactive Buttons (1-Year Global Handler)
                if (customId === 'nsfw_ai_explain') {
                    const { explainNsfwWithAI } = require('./nsfwModule');
                    const embed = await explainNsfwWithAI({ user: interaction.user, guild: interaction.guild });
                    return interaction.reply({ embeds: [embed], flags: [EPHEMERAL_FLAG] });
                }

                if (customId === 'nsfw_toggle_server') {
                    if (!interaction.guild) {
                        return interaction.reply({ content: '❌ Server toggles cannot be used in Direct Messages. Use "Toggle My DM NSFW" instead.', flags: [EPHEMERAL_FLAG] });
                    }
                    const { canManageServerNsfw } = require('./nsfwModule');
                    if (!canManageServerNsfw(interaction.user.id, interaction.guild)) {
                        return interaction.reply({ 
                            content: `❌ **Permission Denied:** Only the **Server Owner** (<@${interaction.guild.ownerId}>) or **Bot Owners** have authority to toggle the NSFW module for this server.`, 
                            flags: [EPHEMERAL_FLAG] 
                        });
                    }
                    const ServerSettings = require('../models/ServerSettings');
                    let settings = await ServerSettings.findOne({ guildId: interaction.guild.id });
                    if (!settings) settings = await ServerSettings.create({ guildId: interaction.guild.id });
                    if (!settings.nsfw) settings.nsfw = {};
                    settings.nsfw.enabled = !settings.nsfw.enabled;
                    await settings.save();

                    return interaction.reply({
                        content: settings.nsfw.enabled 
                            ? `🔞 **NSFW Module has been ENABLED for ${interaction.guild.name}!**\n*Commands will execute strictly in Age-Restricted (NSFW) channels.*` 
                            : `🔒 **NSFW Module has been DISABLED for ${interaction.guild.name}.**`,
                        flags: [EPHEMERAL_FLAG]
                    });
                }

                if (customId === 'nsfw_toggle_dm') {
                    const { toggleNsfwDm } = require('./nsfwModule');
                    const newState = await toggleNsfwDm(interaction.user.id);
                    return interaction.reply({
                        content: newState
                            ? '🔞 **Mature Anime Mode ENABLED in your DMs!**\n*You can now use mature anime commands and waifu/neko art in Direct Messages with Starry.*'
                            : '🔒 **Mature Anime Mode DISABLED in your DMs.**',
                        flags: [EPHEMERAL_FLAG]
                    });
                }

                // F. Starry Mascot Interactive Lore & Voice Buttons
                if (customId === 'starry_lore_btn') {
                    const { STARRY_MASCOT } = require('../utils/aiEngine');
                    const loreEmbed = new EmbedBuilder()
                        .setColor('#9B59B6')
                        .setTitle(`📖 The Celestial Lore of ${STARRY_MASCOT.name}`)
                        .setDescription(
                            `Born from the primordial stardust of the Astraea Constellation, **Starry** descended into the digital cosmos to protect communities, share high-res melodies, and illuminate Discord with celestial light.\n\n` +
                            `• **Origin:** Constellation of Astraea (Outer Cosmos)\n` +
                            `• **Relic:** Starlight Nebula Quill\n` +
                            `• **Mission:** Bring joy, musical harmony, and unbreakable security to Discord servers across the galaxy!\n\n` +
                            `*“Wherever there are friends gathered under the night sky, my stars will shine for you.”* ✨`
                        )
                        .setFooter({ text: 'Starry Official Mascot Lore' });
                    return interaction.reply({ embeds: [loreEmbed], flags: [EPHEMERAL_FLAG] });
                }

                if (customId === 'starry_voice_btn') {
                    const { STARRY_MASCOT } = require('../utils/aiEngine');
                    const phrase = STARRY_MASCOT.catchphrases[Math.floor(Math.random() * STARRY_MASCOT.catchphrases.length)];
                    return interaction.reply({ content: `🎙️ **Starry says:**\n>>> *${phrase}*`, flags: [EPHEMERAL_FLAG] });
                }

                if (customId === 'starry_dm_btn') {
                    try {
                        const dm = await interaction.user.createDM();
                        await dm.send(`✨ **Hello <@${interaction.user.id}>!** 🌟 I am Starry, your cosmic AI companion! Feel free to ask me anything or chat with me right here in our private DMs without any prefix! 💫`);
                        return interaction.reply({ content: '💌 **I sent you a greeting in your DMs!** Check your Direct Messages to chat with me.', flags: [EPHEMERAL_FLAG] });
                    } catch (e) {
                        return interaction.reply({ content: '❌ Could not open DMs with you. Please enable Direct Messages in your privacy settings.', flags: [EPHEMERAL_FLAG] });
                    }
                }

                // Dedicated Music Controller Channel Interactions
                if (customId.startsWith('ctrl_')) {
                    const musicController = require('./musicController');
                    return await musicController.handleButtonInteraction(interaction, client);
                }

                // G. Music & DJ Panel Global Controls (1-Year Global Handler)
                if (customId.startsWith('dj_') || customId.startsWith('music_')) {
                    const { StarryAudioEngine } = require('../utils/nativeAudioEngine');
                    const { applyKazagumoFilter } = require('../utils/musicManager');

                    const kPlayer = client.manager ? client.manager.getPlayer(interaction.guild.id) : null;
                    const nPlayer = StarryAudioEngine.getPlayer(interaction.guild.id);
                    const voiceChannel = interaction.member?.voice?.channel;

                    if (!voiceChannel && customId !== 'dj_refresh_panel' && customId !== 'music_queue') {
                        return interaction.reply({ 
                            content: '❌ You must be connected to a voice channel to use audio controls!', 
                            flags: [EPHEMERAL_FLAG] 
                        }).catch(() => {});
                    }

                    // 1. Voice Channel Locking & Unlocking
                    if (customId === 'dj_lock') {
                        if (!voiceChannel) {
                            return interaction.reply({ content: '❌ You are not in a voice channel.', flags: [EPHEMERAL_FLAG] }).catch(() => {});
                        }
                        await voiceChannel.permissionOverwrites.edit(interaction.guild.roles.everyone, { Connect: false }).catch(() => {});
                        return interaction.reply({ 
                            content: `🔒 **Locked voice channel:** <#${voiceChannel.id}>\n*Only existing members and moderators can join.*`, 
                            flags: [EPHEMERAL_FLAG] 
                        }).catch(() => {});
                    }

                    if (customId === 'dj_unlock') {
                        if (!voiceChannel) {
                            return interaction.reply({ content: '❌ You are not in a voice channel.', flags: [EPHEMERAL_FLAG] }).catch(() => {});
                        }
                        await voiceChannel.permissionOverwrites.edit(interaction.guild.roles.everyone, { Connect: null }).catch(() => {});
                        return interaction.reply({ 
                            content: `🔓 **Unlocked voice channel:** <#${voiceChannel.id}>\n*Everyone can now join.*`, 
                            flags: [EPHEMERAL_FLAG] 
                        }).catch(() => {});
                    }

                    // 2. Queue Viewer
                    if (customId === 'music_queue') {
                        if (kPlayer) {
                            const current = kPlayer.queue.current;
                            const tracks = kPlayer.queue.slice(0, 10);
                            let qList = tracks.map((t, idx) => `\`${idx + 1}.\` **${t.title?.substring(0, 60)}** \`(${t.isStream ? 'LIVE' : formatTime(t.length)})\``).join('\n');
                            if (!qList) qList = '*No upcoming tracks in queue.*';

                            const embed = new EmbedBuilder()
                                .setColor('#5865F2')
                                .setTitle(`🎵 Current Music Queue • ${kPlayer.queue.length} Tracks`)
                                .setDescription(`▶️ **Now Playing:**\n**${current ? current.title : 'None'}**\n\n📜 **Upcoming:**\n${qList}`)
                                .setFooter({ text: 'Starry Audio Intelligence Engine' });

                            return interaction.reply({ embeds: [embed], flags: [EPHEMERAL_FLAG] }).catch(() => {});
                        } else if (nPlayer) {
                            const current = nPlayer.currentTrack;
                            const tracks = nPlayer.queue.slice(0, 10);
                            let qList = tracks.map((t, idx) => `\`${idx + 1}.\` **${t.title?.substring(0, 60)}**`).join('\n');
                            if (!qList) qList = '*No upcoming tracks in queue.*';

                            const embed = new EmbedBuilder()
                                .setColor('#5865F2')
                                .setTitle(`🎵 Current Music Queue • ${nPlayer.queue.length} Tracks`)
                                .setDescription(`▶️ **Now Playing:**\n**${current ? current.title : 'None'}**\n\n📜 **Upcoming:**\n${qList}`)
                                .setFooter({ text: 'Starry Native Audio Engine' });

                            return interaction.reply({ embeds: [embed], flags: [EPHEMERAL_FLAG] }).catch(() => {});
                        } else {
                            return interaction.reply({ content: '❌ No active music session in this server.', flags: [EPHEMERAL_FLAG] }).catch(() => {});
                        }
                    }

                    // 3. Audio Filter Dropdown
                    if (customId === 'music_filter') {
                        const selectedFilter = interaction.values[0] || 'clear';
                        if (kPlayer) {
                            await applyKazagumoFilter(kPlayer, selectedFilter);
                        }
                        if (nPlayer) {
                            await nPlayer.setFilter(selectedFilter);
                        }
                        return interaction.reply({ 
                            content: `🎧 **Audio DSP Filter updated:** \`${selectedFilter.toUpperCase()}\``, 
                            flags: [EPHEMERAL_FLAG] 
                        }).catch(() => {});
                    }

                    // 4. Autoplay Smart Stream Toggle Button
                    if (customId === 'music_autoplay') {
                        if (kPlayer) {
                            kPlayer.autoplay = !kPlayer.autoplay;
                            return interaction.reply({
                                content: `📻 **Autoplay is now: ${kPlayer.autoplay ? '🟢 ON' : '🔴 OFF'}**`,
                                flags: [EPHEMERAL_FLAG]
                            }).catch(() => {});
                        }
                        if (nPlayer) {
                            nPlayer.autoplay = !nPlayer.autoplay;
                            if (nPlayer.currentTrack) {
                                await nPlayer.sendNowPlayingPanel(nPlayer.currentTrack, true).catch(() => {});
                            }
                            return interaction.reply({
                                content: `📻 **Autoplay is now: ${nPlayer.autoplay ? '🟢 ON' : '🔴 OFF'}**`,
                                flags: [EPHEMERAL_FLAG]
                            }).catch(() => {});
                        }
                    }

                    if (!kPlayer && !nPlayer) {
                        return interaction.reply({ content: '❌ No active music session in this server.', flags: [EPHEMERAL_FLAG] }).catch(() => {});
                    }

                    await interaction.deferUpdate().catch(() => {});

                    try {
                        if (customId === 'music_pause' || customId === 'dj_pause') {
                            if (kPlayer) {
                                if (kPlayer.paused) await kPlayer.pause(false);
                                else await kPlayer.pause(true);
                            }
                            if (nPlayer) {
                                nPlayer.pause();
                                if (nPlayer.currentTrack) {
                                    await nPlayer.sendNowPlayingPanel(nPlayer.currentTrack, true).catch(() => {});
                                }
                            }
                        } else if (customId === 'music_skip' || customId === 'dj_skip') {
                            if (kPlayer) await kPlayer.skip();
                            if (nPlayer) nPlayer.skip();
                        } else if (customId === 'music_stop' || customId === 'dj_stop') {
                            if (kPlayer) await kPlayer.destroy();
                            if (nPlayer) nPlayer.stop();
                        } else if (customId === 'music_loop' || customId === 'dj_loop') {
                            if (kPlayer) {
                                const nextLoop = kPlayer.loop === 'none' ? 'track' : kPlayer.loop === 'track' ? 'queue' : 'none';
                                kPlayer.setLoop(nextLoop);
                            }
                            if (nPlayer) {
                                nPlayer.loop = nPlayer.loop === 'none' ? 'track' : nPlayer.loop === 'track' ? 'queue' : 'none';
                                if (nPlayer.currentTrack) {
                                    await nPlayer.sendNowPlayingPanel(nPlayer.currentTrack, true).catch(() => {});
                                }
                            }
                        } else if (customId === 'dj_shuffle') {
                            if (kPlayer) kPlayer.queue.shuffle();
                            if (nPlayer) {
                                nPlayer.shuffle();
                            }
                        } else if (customId === 'dj_vol_down') {
                            if (kPlayer) {
                                const newVol = Math.max(10, (kPlayer.volume || 100) - 10);
                                await kPlayer.setVolume(newVol);
                            }
                            if (nPlayer) {
                                nPlayer.setVolume(Math.max(10, nPlayer.volume - 10));
                                if (nPlayer.currentTrack) {
                                    await nPlayer.sendNowPlayingPanel(nPlayer.currentTrack, true).catch(() => {});
                                }
                            }
                        } else if (customId === 'dj_vol_up') {
                            if (kPlayer) {
                                const newVol = Math.min(150, (kPlayer.volume || 100) + 10);
                                await kPlayer.setVolume(newVol);
                            }
                            if (nPlayer) {
                                nPlayer.setVolume(Math.min(150, nPlayer.volume + 10));
                                if (nPlayer.currentTrack) {
                                    await nPlayer.sendNowPlayingPanel(nPlayer.currentTrack, true).catch(() => {});
                                }
                            }
                        }
                    } catch (e) {}
                }
            }
        });
    }
}

const registryInstance = new CommandRegistry();
registryInstance.guildPrefixCache = guildPrefixCache;
registryInstance.getGuildPrefix = getGuildPrefix;
registryInstance.setCachedPrefix = setCachedPrefix;

module.exports = registryInstance;
module.exports.guildPrefixCache = guildPrefixCache;
module.exports.getGuildPrefix = getGuildPrefix;
module.exports.setCachedPrefix = setCachedPrefix;
