// ==========================================
// 🚀 MASTER COMMAND REGISTRY & UNIFIED DISPATCHER
// File Path: src/modules/commandHandler.js
// 165+ Master Commands • Dual Prefix (, & .) • Mention Support • 1-Year Persistent Interaction Engine
// Fully compatible with Android/Termux & PC (Windows/Linux/macOS)
// ==========================================
const { Collection, Events, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
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
        const ServerSettings = require('../models/ServerSettings');
        const settings = await ServerSettings.findOne({ guildId }).select('prefix');
        const p = settings?.prefix || ',';
        guildPrefixCache.set(guildId, p);
        return p;
    } catch (e) {
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
const systemCommands = require('../commands/bundles/systemCommands');

const allBundles = [
    ...musicCommands,
    ...moderationCommands,
    ...utilityCommands,
    ...socialCommands,
    ...economyCommands,
    ...systemCommands
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
                    let activePrefix = ',';
                    if (guildId) {
                        if (guildPrefixCache.has(guildId)) {
                            activePrefix = guildPrefixCache.get(guildId);
                        } else {
                            activePrefix = await getGuildPrefix(guildId);
                        }
                    }

                    if (content.startsWith(activePrefix)) {
                        matchedPrefix = activePrefix;
                        commandBody = content.slice(activePrefix.length).trim();
                    } else if (activePrefix !== ',' && content.startsWith(',')) {
                        // Comma always works as universal fallback
                        matchedPrefix = ',';
                        commandBody = content.slice(1).trim();
                    } else if (!message.guild) {
                        // In DMs, talk directly with Starry AI without needing a prefix (Nekotina-style)
                        matchedPrefix = '';
                        commandBody = 'ask ' + content;
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

            const ctx = new CommandContext(message, client, args);

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
                            await interaction.deferReply({ ephemeral: !!command.ephemeral }).catch(() => {});
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
                    const parts = customId.split('_');
                    const actionKey = parts[1];
                    const allowedTargetId = parts[3];
                    const originalAuthorId = parts[4];

                    if (interaction.user.id !== allowedTargetId) {
                        return interaction.reply({
                            content: `❌ Only <@${allowedTargetId}> can use this button to action back!`,
                            ephemeral: true
                        }).catch(() => {});
                    }

                    const { getSocialGif } = require('../utils/animeGifs');
                    const { incrementSocialCount } = require('../models/SocialStats');
                    const gifUrl = getSocialGif(actionKey);

                    const totalCount = await incrementSocialCount(interaction.user.id, originalAuthorId, actionKey);

                    const embed = new EmbedBuilder()
                        .setColor(config.EMBED_COLORS?.SOCIAL || '#FF9494')
                        .setDescription(`**${interaction.user.username}** ${actionKey}s **<@${originalAuthorId}>** back!\n\n✨ That's **${totalCount}** ${actionKey}s shared together!`)
                        .setImage(gifUrl)
                        .setFooter({ text: `Social Actions Engine • Total: ${totalCount} • Prefix: ,` })
                        .setTimestamp();

                    return interaction.reply({ embeds: [embed] }).catch(() => {
                        return interaction.followUp({ embeds: [embed] }).catch(() => {});
                    });
                }

                // D. Music & DJ Panel Global Controls (1-Year Global Handler)
                if (customId.startsWith('dj_') || customId.startsWith('music_')) {
                    const player = client.manager ? client.manager.getPlayer(interaction.guild.id) : null;
                    const voiceChannel = interaction.member?.voice?.channel;

                    if (!voiceChannel && customId !== 'dj_refresh_panel') {
                        return interaction.reply({ content: '❌ You must be connected to a voice channel to use audio controls!', ephemeral: true }).catch(() => {});
                    }

                    if (!player) {
                        return interaction.reply({ content: '❌ No active music session in this server.', ephemeral: true }).catch(() => {});
                    }

                    await interaction.deferUpdate().catch(() => {});

                    try {
                        if (customId === 'music_pause' || customId === 'dj_pause') {
                            if (player.paused) await player.pause(false);
                            else await player.pause(true);
                        } else if (customId === 'music_skip' || customId === 'dj_skip') {
                            await player.skip();
                        } else if (customId === 'music_stop' || customId === 'dj_stop') {
                            await player.destroy();
                        } else if (customId === 'music_loop' || customId === 'dj_loop') {
                            const nextLoop = player.loop === 'none' ? 'track' : player.loop === 'track' ? 'queue' : 'none';
                            player.setLoop(nextLoop);
                        } else if (customId === 'dj_shuffle') {
                            player.queue.shuffle();
                        } else if (customId === 'dj_vol_down') {
                            const newVol = Math.max(10, (player.volume || 100) - 10);
                            await player.setVolume(newVol);
                        } else if (customId === 'dj_vol_up') {
                            const newVol = Math.min(150, (player.volume || 100) + 10);
                            await player.setVolume(newVol);
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
