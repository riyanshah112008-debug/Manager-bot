// ==========================================
// 🚀 MASTER COMMAND REGISTRY & UNIFIED DISPATCHER
// File Path: src/modules/commandHandler.js
// 150+ Commands, Fixed Comma Prefix (,), 1-Year Persistent Interaction Engine
// ==========================================
const { Collection, Events, EmbedBuilder } = require('discord.js');
const config = require('../config');
const { CommandContext, ONE_YEAR_MS, EPHEMERAL_FLAG } = require('../utils/contextHelper');

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

class CommandRegistry {
    constructor() {
        this.commands = new Collection();
        this.aliases = new Collection();
    }

    init(client) {
        // Clear collections
        this.commands.clear();
        this.aliases.clear();

        if (!client.commands) client.commands = new Collection();
        if (!client.prefixCommands) client.prefixCommands = new Collection();
        if (!client.aliases) client.aliases = new Collection();

        // Load all 150+ commands from bundles
        for (const cmd of allBundles) {
            if (!cmd.name) continue;
            this.commands.set(cmd.name.toLowerCase(), cmd);
            client.commands.set(cmd.name.toLowerCase(), cmd);
            client.prefixCommands.set(cmd.name.toLowerCase(), cmd);

            if (cmd.aliases && Array.isArray(cmd.aliases)) {
                for (const alias of cmd.aliases) {
                    this.aliases.set(alias.toLowerCase(), cmd.name.toLowerCase());
                    client.aliases.set(alias.toLowerCase(), cmd.name.toLowerCase());
                    client.prefixCommands.set(alias.toLowerCase(), cmd);
                }
            }
        }

        console.log(`✅ [Master Command Registry] Loaded ${this.commands.size} base commands (${this.commands.size + this.aliases.size} with aliases) across 6 categories!`);

        // Register Unified Prefix Dispatcher on client
        this.registerPrefixDispatcher(client);

        // Register Unified Slash & 1-Year Persistent Interaction Dispatcher on client
        this.registerInteractionDispatcher(client);
    }

    registerPrefixDispatcher(client) {
        client.on(Events.MessageCreate, async (message) => {
            if (message.author.bot || !message.guild || !message.content) return;

            const prefix = config.DEFAULT_PREFIX || ',';

            // Check for fixed comma prefix
            if (!message.content.startsWith(prefix)) return;
            // Ignore custom emoji start like ,<: or ,<a:
            if (message.content.startsWith(`${prefix}<:`) || message.content.startsWith(`${prefix}<a:`)) return;

            const rawContent = message.content.slice(prefix.length).trim();
            const args = rawContent.split(/\s+/);
            const commandKey = args.shift()?.toLowerCase();
            if (!commandKey) return;

            // Resolve command name or alias
            const resolvedName = this.aliases.get(commandKey) || commandKey;
            const command = this.commands.get(resolvedName);

            if (!command) return;

            const ctx = new CommandContext(message, client, args);

            try {
                // Permission guard
                if (command.permissions && Array.isArray(command.permissions)) {
                    if (!config.BOT_OWNERS.includes(message.author.id)) {
                        for (const perm of command.permissions) {
                            if (!message.member.permissions.has(perm)) {
                                return ctx.reply('❌ You do not have sufficient permissions to execute this command.');
                            }
                        }
                    }
                }

                await command.execute(ctx);
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
                const command = this.commands.get(commandName);

                if (command) {
                    const ctx = new CommandContext(interaction, client, []);
                    try {
                        await command.execute(ctx);
                    } catch (err) {
                        console.error(`❌ Slash Command Error (/${commandName}):`, err);
                        if (!interaction.replied && !interaction.deferred) {
                            await interaction.reply({ content: `⚠️ Error executing command: \`${err.message}\``, flags: [EPHEMERAL_FLAG] }).catch(() => {});
                        } else {
                            await interaction.followUp({ content: `⚠️ Error executing command: \`${err.message}\``, flags: [EPHEMERAL_FLAG] }).catch(() => {});
                        }
                    }
                }
                return;
            }

            // 2. Handle Global 1-Year Persistent Button & Select Menu Interactions
            if (interaction.isButton() || interaction.isStringSelectMenu()) {
                const customId = interaction.customId;

                // A. Social Action Back Buttons (1-Year Global Handler)
                if (customId.startsWith('social_') && customId.includes('_back_')) {
                    const parts = customId.split('_');
                    // Format: social_[actionKey]_back_[targetId]_[authorId]
                    const actionKey = parts[1];
                    const allowedTargetId = parts[3];
                    const originalAuthorId = parts[4];

                    if (interaction.user.id !== allowedTargetId) {
                        return interaction.reply({
                            content: `❌ Only <@${allowedTargetId}> can use this button to action back!`,
                            flags: [EPHEMERAL_FLAG]
                        }).catch(() => {});
                    }

                    await interaction.deferReply().catch(() => {});

                    const fetchRes = await fetch(`https://api.otakugifs.xyz/gif?reaction=${actionKey}`).catch(() => null);
                    let gifUrl = 'https://media.tenor.com/0PIf-R3635AAAAAC/hug-anime.gif';
                    if (fetchRes && fetchRes.ok) {
                        const data = await fetchRes.json().catch(() => null);
                        if (data && data.url) gifUrl = data.url;
                    }

                    const embed = new EmbedBuilder()
                        .setColor(config.EMBED_COLORS.SOCIAL)
                        .setDescription(`**${interaction.user.username}** ${actionKey}s **<@${originalAuthorId}>** back!`)
                        .setImage(gifUrl)
                        .setFooter({ text: 'Social Engine • 1-Year Responsive Interaction' })
                        .setTimestamp();

                    return interaction.editReply({ embeds: [embed] }).catch(() => {});
                }

                // B. Music & DJ Panel Global Controls (1-Year Global Handler)
                if (customId.startsWith('dj_') || customId.startsWith('music_')) {
                    const player = client.manager ? client.manager.getPlayer(interaction.guild.id) : null;
                    const voiceChannel = interaction.member?.voice?.channel;

                    if (!voiceChannel && customId !== 'dj_refresh_panel') {
                        return interaction.reply({ content: '❌ You must be connected to a voice channel to use audio controls!', flags: [EPHEMERAL_FLAG] }).catch(() => {});
                    }

                    if (!player) {
                        return interaction.reply({ content: '❌ No active music session in this server.', flags: [EPHEMERAL_FLAG] }).catch(() => {});
                    }

                    await interaction.deferUpdate().catch(() => {});

                    try {
                        if (customId === 'music_pause') {
                            player.pause(!player.paused);
                        } else if (customId === 'music_skip') {
                            player.skip();
                        } else if (customId === 'music_stop') {
                            player.destroy();
                        } else if (customId === 'dj_loop' || customId === 'music_loop') {
                            const modes = ['none', 'track', 'queue'];
                            const next = modes[(modes.indexOf(player.loop) + 1) % modes.length];
                            player.setLoop(next);
                        } else if (customId === 'dj_shuffle') {
                            player.queue.shuffle();
                        } else if (customId === 'dj_vol_down') {
                            player.setVolume(Math.max(0, player.volume - 10));
                        } else if (customId === 'dj_vol_up') {
                            player.setVolume(Math.min(100, player.volume + 10));
                        } else if (customId === 'dj_clear_queue') {
                            player.queue.clear();
                        } else if (customId === 'dj_lock' && voiceChannel) {
                            await voiceChannel.permissionOverwrites.edit(interaction.guild.roles.everyone, { Connect: false }).catch(() => {});
                        } else if (customId === 'dj_unlock' && voiceChannel) {
                            await voiceChannel.permissionOverwrites.edit(interaction.guild.roles.everyone, { Connect: null }).catch(() => {});
                        } else if (customId === 'music_filter' && interaction.isStringSelectMenu()) {
                            const val = interaction.values[0];
                            if (val === 'clear') await player.shoukaku.clearFilters();
                            else if (val === 'bassboost') await player.shoukaku.setEqualizer([{ band: 0, gain: 0.25 }, { band: 1, gain: 0.15 }]);
                            else if (val === '8d') await player.shoukaku.setRotation({ rotationHz: 0.2 });
                            else if (val === 'nightcore') await player.shoukaku.setTimescale({ speed: 1.25, pitch: 1.25, rate: 1.0 });
                            else if (val === 'daycore') await player.shoukaku.setTimescale({ speed: 0.85, pitch: 0.85, rate: 1.0 });
                            else if (val === 'vaporwave') await player.shoukaku.setTimescale({ speed: 0.8, pitch: 0.75, rate: 1.0 });
                        }
                    } catch (e) {
                        console.error('Persistent Audio Control Error:', e);
                    }
                }
            }
        });
    }
}

const registrySingleton = new CommandRegistry();
module.exports = registrySingleton;
