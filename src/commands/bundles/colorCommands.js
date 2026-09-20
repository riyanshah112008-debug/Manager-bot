// ==========================================
// 🎨 STARRY HEX BLEND & NAME COLOR COMMANDS
// File Path: src/commands/bundles/colorCommands.js
// Multi-Tenant Personal Name Color & Blend Suite
// Zero-Boost Discord Name Color Customization Engine
// ==========================================
const { 
    EmbedBuilder, 
    ActionRowBuilder, 
    StringSelectMenuBuilder, 
    ButtonBuilder, 
    ButtonStyle, 
    PermissionFlagsBits,
    ComponentType
} = require('discord.js');
const colorBlendEngine = require('../../utils/colorBlendEngine');
const colorRoleEngine = require('../../modules/colorRoleEngine');
const ServerSettings = require('../../models/ServerSettings');

/**
 * Format a rich confirmation embed for applied color roles
 */
function buildAppliedColorEmbed(result, member, title = '🎨 Name Color Updated!') {
    const isBlend = Boolean(result.secondaryHex);
    const embed = new EmbedBuilder()
        .setColor(result.blendedHex)
        .setTitle(title)
        .setThumbnail(member.user.displayAvatarURL({ dynamic: true, size: 256 }))
        .setTimestamp()
        .setFooter({ text: 'Starry Hex Blend Studio • Zero-Boost Enabled' });

    let desc = `Successfully updated your custom name color role <@&${result.role.id}>!\n\n`;

    if (isBlend) {
        const boostBadge = result.appliedNativeGradient 
            ? '✨ **Native Gradient Active** *(Server has 3+ boosts unlocked)*' 
            : '⚡ **Optical Hex Blend Active** *(Vibrant luminous tone — No server boosts needed!)*';

        desc += `🎨 **Style:** Dual-Color Blend\n` +
                `🎯 **Color 1:** \`${result.primaryHex}\`\n` +
                `🎯 **Color 2:** \`${result.secondaryHex}\`\n` +
                `🔀 **Blend Ratio:** \`${result.ratio}% / ${100 - result.ratio}%\`\n` +
                `💎 **Rendered Hex:** \`${result.blendedHex}\`\n\n` +
                `🌈 **Gradient Swatch:**\n${colorBlendEngine.generateVisualBar(result.primaryHex, result.secondaryHex, result.blendedHex)}\n\n` +
                `${boostBadge}\n\n` +
                `👁️ **Readability:** ${result.readability.rating} (Dark: \`${result.readability.darkContrast}:1\`, Light: \`${result.readability.lightContrast}:1\`)`;
    } else {
        desc += `🎨 **Style:** Solid Hex Tone\n` +
                `💎 **Rendered Hex:** \`${result.blendedHex}\`\n\n` +
                `👁️ **Readability:** ${result.readability.rating} (Dark: \`${result.readability.darkContrast}:1\`, Light: \`${result.readability.lightContrast}:1\`)`;
    }

    embed.setDescription(desc);
    return embed;
}

const commands = [
    {
        name: 'color',
        aliases: ['colour', 'namecolor', 'mycolor', 'blendcolor', 'hexblend'],
        category: 'Utility',
        description: 'Customize your username color with optical hex blends, dual gradients, or solid tones without needing server boosts!',
        usage: ',color <blend|preset|random|preview|info|remove|#hex> [args]',
        permissions: [],
        async execute(ctx) {
            if (!ctx.guild) return ctx.reply('❌ This command can only be used inside a Discord server.');

            const prefix = ctx.prefix || ',';
            const member = ctx.member;
            const isSlash = Boolean(ctx.isSlash);
            const sub = (isSlash ? (ctx.options?.getSubcommand?.(false) || ctx.args[0] || 'info') : (ctx.args[0] || 'info')).toLowerCase();

            // ==========================================
            // SUBCOMMAND: SET (,color set #hex or /color set hex:)
            // ==========================================
            if (sub === 'set') {
                const hexRaw = isSlash ? (ctx.options?.getString?.('hex') || ctx.args[0]) : ctx.args[1];
                if (!hexRaw) {
                    return ctx.reply(`🔹 **Usage:** \`${prefix}color set <#HexCode>\`\n*Example:* \`${prefix}color set #FF73FA\``);
                }
                const parsedHex = colorBlendEngine.parseHex(hexRaw);
                if (!parsedHex) {
                    return ctx.reply(`❌ Invalid hex color code \`${hexRaw}\`. Example: \`#FF0055\``);
                }
                try {
                    const result = await colorRoleEngine.applyColorRole(ctx.guild, member, {
                        colorType: 'solid',
                        primaryColor: parsedHex
                    });
                    const embed = buildAppliedColorEmbed(result, member, '🎨 Solid Color Role Applied!');
                    return ctx.reply({ embeds: [embed] });
                } catch (err) {
                    return ctx.reply(`❌ **Could not apply color:** ${err.message}`);
                }
            }

            // ==========================================
            // SUBCOMMAND: BLEND (,color blend #hex1 #hex2 [ratio])
            // ==========================================
            if (sub === 'blend') {
                const hex1Raw = isSlash ? (ctx.options?.getString?.('color1') || ctx.args[0]) : ctx.args[1];
                const hex2Raw = isSlash ? (ctx.options?.getString?.('color2') || ctx.args[1]) : ctx.args[2];
                const ratioRaw = isSlash ? (ctx.options?.getInteger?.('ratio') ?? ctx.args[2]) : ctx.args[3];

                if (!hex1Raw || !hex2Raw) {
                    return ctx.reply(
                        `🔹 **Usage:** \`${prefix}color blend <#Hex1> <#Hex2> [Ratio%]\`\n` +
                        `*Examples:*\n` +
                        `• \`${prefix}color blend #FF0055 #00E5FF\` *(50/50 Vibrant Blend)*\n` +
                        `• \`${prefix}color blend red blue 75\` *(75% Blue / 25% Red)*\n` +
                        `• \`${prefix}color blend #FF512F #DD2476\` *(Sunset Magenta)*\n\n` +
                        `💡 *No server boosts are required! The bot calculates an optical gamma-corrected blend so your name looks stunning on any server.*`
                    );
                }

                const hex1 = colorBlendEngine.parseHex(hex1Raw);
                const hex2 = colorBlendEngine.parseHex(hex2Raw);

                if (!hex1) return ctx.reply(`❌ Invalid first color \`${hex1Raw}\`. Please provide a valid hex code (e.g. \`#FF0055\`) or color name.`);
                if (!hex2) return ctx.reply(`❌ Invalid second color \`${hex2Raw}\`. Please provide a valid hex code (e.g. \`#00E5FF\`) or color name.`);

                let ratio = 50;
                if (ratioRaw !== undefined && ratioRaw !== null && ratioRaw !== '') {
                    const parsedRatio = parseInt(ratioRaw, 10);
                    if (!isNaN(parsedRatio)) {
                        ratio = Math.max(0, Math.min(100, parsedRatio));
                    }
                }

                try {
                    const result = await colorRoleEngine.applyColorRole(ctx.guild, member, {
                        colorType: 'blend',
                        primaryColor: hex1,
                        secondaryColor: hex2,
                        ratio: ratio
                    });

                    const embed = buildAppliedColorEmbed(result, member, '✨ Hex Blend Color Applied!');
                    return ctx.reply({ embeds: [embed] });
                } catch (err) {
                    return ctx.reply(`❌ **Could not apply color:** ${err.message}`);
                }
            }

            // ==========================================
            // DIRECT HEX CODES: ,color #hex1 [#hex2]
            // ==========================================
            const directHex1 = colorBlendEngine.parseHex(ctx.args[0]);
            if (directHex1) {
                const directHex2 = colorBlendEngine.parseHex(ctx.args[1]);

                // If user passed two colors directly: ,color #FF0055 #00E5FF
                if (directHex2) {
                    try {
                        const result = await colorRoleEngine.applyColorRole(ctx.guild, member, {
                            colorType: 'blend',
                            primaryColor: directHex1,
                            secondaryColor: directHex2,
                            ratio: 50
                        });
                        const embed = buildAppliedColorEmbed(result, member, '✨ Hex Blend Color Applied!');
                        return ctx.reply({ embeds: [embed] });
                    } catch (err) {
                        return ctx.reply(`❌ **Could not apply color:** ${err.message}`);
                    }
                }

                // Single solid color: ,color #FF73FA
                try {
                    const result = await colorRoleEngine.applyColorRole(ctx.guild, member, {
                        colorType: 'solid',
                        primaryColor: directHex1
                    });
                    const embed = buildAppliedColorEmbed(result, member, '🎨 Solid Color Role Applied!');
                    return ctx.reply({ embeds: [embed] });
                } catch (err) {
                    return ctx.reply(`❌ **Could not apply color:** ${err.message}`);
                }
            }

            // ==========================================
            // SUBCOMMAND: PRESET / PRESETS / PALETTE / LIST
            // ==========================================
            if (sub === 'preset' || sub === 'presets' || sub === 'palette' || sub === 'list') {
                const presetQuery = (isSlash ? (ctx.options?.getString?.('name') || ctx.args[0] || '') : ctx.args.slice(1).join(' ')).trim();

                // If a specific preset was queried: ,color preset cyberpunk
                if (presetQuery) {
                    const preset = colorBlendEngine.getPreset(presetQuery);
                    if (!preset) {
                        return ctx.reply(
                            `❌ Preset \`${presetQuery}\` not found.\n` +
                            `👉 Use \`${prefix}color presets\` to browse all 26 aesthetic presets!`
                        );
                    }

                    try {
                        const result = await colorRoleEngine.applyColorRole(ctx.guild, member, {
                            colorType: 'preset',
                            primaryColor: preset.hex1,
                            secondaryColor: preset.hex2,
                            ratio: 50,
                            presetName: preset.name
                        });

                        const embed = buildAppliedColorEmbed(
                            result, 
                            member, 
                            `${preset.emoji} Preset Applied: ${preset.name}`
                        );
                        return ctx.reply({ embeds: [embed] });
                    } catch (err) {
                        return ctx.reply(`❌ **Could not apply preset:** ${err.message}`);
                    }
                }

                // Show interactive Preset Browser Menu
                const grouped = colorBlendEngine.getPresetsByCategory();
                const embed = new EmbedBuilder()
                    .setColor('#5865F2')
                    .setTitle('🎨 Starry Aesthetic Color Palette Studio')
                    .setDescription(
                        `Choose from **26 Hand-Crafted Master Presets** below!\n` +
                        `Use \`${prefix}color preset <name>\` or select an option from the menu below.\n\n` +
                        `*All presets work on any server without requiring 3 server boosts!*`
                    )
                    .setFooter({ text: 'Select a preset from the dropdown menu to apply instantly!' });

                for (const [catName, presetList] of Object.entries(grouped)) {
                    const listStr = presetList.map(p => 
                        `${p.emoji} **${p.name}** (\`${p.id}\`): \`${p.hex1}\` ➔ \`${p.hex2}\``
                    ).join('\n');
                    embed.addFields({ name: `━━ ${catName} Palette ━━`, value: listStr, inline: false });
                }

                // Build interactive select menu with top presets
                const selectOptions = Object.values(colorBlendEngine.PRESETS).slice(0, 25).map(p => ({
                    label: p.name,
                    value: p.id,
                    description: p.description.slice(0, 100),
                    emoji: p.emoji
                }));

                const selectRow = new ActionRowBuilder().addComponents(
                    new StringSelectMenuBuilder()
                        .setCustomId(`color_preset_select_${ctx.author.id}`)
                        .setPlaceholder('✨ Pick an aesthetic blend preset...')
                        .addOptions(selectOptions)
                );

                const responseMsg = await ctx.reply({ embeds: [embed], components: [selectRow] });

                // Attach interaction collector for direct menu selection
                const filter = i => i.customId === `color_preset_select_${ctx.author.id}` && i.user.id === ctx.author.id;
                const collector = responseMsg.createMessageComponentCollector?.({
                    filter,
                    componentType: ComponentType.StringSelect,
                    time: 120000
                });

                if (collector) {
                    collector.on('collect', async (i) => {
                        const selectedId = i.values[0];
                        const preset = colorBlendEngine.getPreset(selectedId);
                        if (!preset) return i.reply({ content: '❌ Preset not found.', ephemeral: true });

                        await i.deferUpdate().catch(() => {});
                        try {
                            const result = await colorRoleEngine.applyColorRole(ctx.guild, member, {
                                colorType: 'preset',
                                primaryColor: preset.hex1,
                                secondaryColor: preset.hex2,
                                ratio: 50,
                                presetName: preset.name
                            });

                            const updateEmbed = buildAppliedColorEmbed(
                                result, 
                                member, 
                                `${preset.emoji} Preset Applied: ${preset.name}`
                            );
                            await i.editReply({ embeds: [updateEmbed], components: [] });
                        } catch (err) {
                            await i.followUp({ content: `❌ Error: ${err.message}`, ephemeral: true }).catch(() => {});
                        }
                    });

                    collector.on('end', () => {
                        responseMsg.edit({ components: [] }).catch(() => {});
                    });
                }

                return;
            }

            // ==========================================
            // SUBCOMMAND: RANDOM (,color random)
            // ==========================================
            if (sub === 'random') {
                const randomChoice = colorBlendEngine.randomBlend();
                try {
                    const result = await colorRoleEngine.applyColorRole(ctx.guild, member, {
                        colorType: 'random',
                        primaryColor: randomChoice.hex1,
                        secondaryColor: randomChoice.hex2,
                        ratio: 50
                    });

                    const embed = buildAppliedColorEmbed(
                        result, 
                        member, 
                        '🎲 Random Vibrant Blend Applied!'
                    );
                    return ctx.reply({ embeds: [embed] });
                } catch (err) {
                    return ctx.reply(`❌ **Could not apply random color:** ${err.message}`);
                }
            }

            // ==========================================
            // SUBCOMMAND: PREVIEW (,color preview #hex1 [#hex2])
            // ==========================================
            if (sub === 'preview') {
                const hex1Raw = isSlash ? (ctx.options?.getString?.('color1') || ctx.args[0]) : ctx.args[1];
                const hex2Raw = isSlash ? (ctx.options?.getString?.('color2') || ctx.args[1]) : ctx.args[2];

                if (!hex1Raw) {
                    return ctx.reply(`🔹 **Usage:** \`${prefix}color preview <#Hex1> [#Hex2]\`\n*Example:* \`${prefix}color preview #FF0055 #00E5FF\``);
                }

                const hex1 = colorBlendEngine.parseHex(hex1Raw);
                if (!hex1) return ctx.reply(`❌ Invalid first color code \`${hex1Raw}\`.`);

                const hex2 = hex2Raw ? colorBlendEngine.parseHex(hex2Raw) : null;
                const blended = hex2 ? colorBlendEngine.blendColors(hex1, hex2, 0.5) : hex1;
                const readability = colorBlendEngine.analyzeDiscordReadability(blended);

                const embed = new EmbedBuilder()
                    .setColor(blended)
                    .setTitle('🔍 Color Blend Optical Preview')
                    .setDescription(
                        hex2 
                            ? `🎨 **Input 1:** \`${hex1}\`\n` +
                              `🎨 **Input 2:** \`${hex2}\`\n` +
                              `💎 **Resulting Hex Blend:** \`${blended}\`\n\n` +
                              `🌈 **Gradient Swatch:**\n${colorBlendEngine.generateVisualBar(hex1, hex2, blended)}\n\n` +
                              `👁️ **Readability:** ${readability.rating} (Dark: \`${readability.darkContrast}:1\`, Light: \`${readability.lightContrast}:1\`)\n\n` +
                              `👉 *To apply this color, run:* \`${prefix}color blend ${hex1} ${hex2}\``
                            : `💎 **Color Code:** \`${hex1}\`\n\n` +
                              `👁️ **Readability:** ${readability.rating} (Dark: \`${readability.darkContrast}:1\`, Light: \`${readability.lightContrast}:1\`)\n\n` +
                              `👉 *To apply this color, run:* \`${prefix}color ${hex1}\``
                    )
                    .setFooter({ text: 'Starry Hex Blend Studio • Zero-Boost Preview' });

                return ctx.reply({ embeds: [embed] });
            }

            // ==========================================
            // SUBCOMMAND: REMOVE / RESET / DELETE
            // ==========================================
            if (sub === 'remove' || sub === 'reset' || sub === 'delete' || sub === 'clear') {
                try {
                    const result = await colorRoleEngine.removeColorRole(ctx.guild, member);
                    if (result.success) {
                        const embed = new EmbedBuilder()
                            .setColor('#ED4245')
                            .setTitle('🗑️ Custom Name Color Removed')
                            .setDescription(`Your custom color role **${result.roleName}** has been completely removed.\nYour name color has returned to your server default!`)
                            .setFooter({ text: 'Use ,color blend to equip a new color anytime!' });
                        return ctx.reply({ embeds: [embed] });
                    } else {
                        return ctx.reply(`ℹ️ ${result.message}`);
                    }
                } catch (err) {
                    return ctx.reply(`❌ **Could not remove color role:** ${err.message}`);
                }
            }

            // ==========================================
            // SUBCOMMAND: INFO (,color info [@user])
            // ==========================================
            if (sub === 'info' || sub === 'mycolor' || sub === 'status') {
                const slashUser = isSlash ? (ctx.options?.getUser?.('user') || ctx.options?.getMember?.('user')) : null;
                const targetMember = slashUser 
                    ? (ctx.guild.members.cache.get(slashUser.id) || await ctx.guild.members.fetch(slashUser.id).catch(() => null))
                    : (ctx.message?.mentions?.members?.first() || member);
                if (!targetMember) return ctx.reply('❌ Could not find that member in this server.');
                const status = await colorRoleEngine.getColorRoleStatus(ctx.guild, targetMember.id);

                if (!status || !status.role) {
                    const isSelf = targetMember.id === member.id;
                    const msg = isSelf 
                        ? `ℹ️ You do not currently have an active custom color role.\n\n` +
                          `👉 **Get started right now:**\n` +
                          `• \`${prefix}color blend #FF0055 #00E5FF\` *(Custom Hex Blend)*\n` +
                          `• \`${prefix}color preset cyberpunk\` *(Aesthetic Preset)*\n` +
                          `• \`${prefix}color presets\` *(Browse 26 palettes)*\n` +
                          `• \`${prefix}color random\` *(Surprise blend)*`
                        : `ℹ️ <@${targetMember.id}> does not have a custom color role configured.`;

                    return ctx.reply(msg);
                }

                const doc = status.doc;
                const role = status.role;
                const embed = new EmbedBuilder()
                    .setColor(role.hexColor)
                    .setTitle(`🎨 Custom Color Status: ${targetMember.displayName}`)
                    .setThumbnail(targetMember.user.displayAvatarURL({ dynamic: true, size: 256 }))
                    .setDescription(
                        `**Active Role:** <@&${role.id}> (\`${role.name}\`)\n` +
                        `**Type:** \`${doc.colorType.toUpperCase()}\`\n` +
                        `**Active Hex:** \`${role.hexColor}\`\n` +
                        (doc.secondaryColor ? `**Primary Hex:** \`${doc.primaryColor}\`\n**Secondary Hex:** \`${doc.secondaryColor}\`\n**Blend Ratio:** \`${doc.ratio}% / ${100 - doc.ratio}%\`\n` : '') +
                        (doc.presetName ? `**Preset:** \`${doc.presetName}\`\n` : '') +
                        `**Hierarchy Level:** \`Position #${role.position}\`\n\n` +
                        `👁️ **Readability:** ${status.readability.rating} (Dark: \`${status.readability.darkContrast}:1\`, Light: \`${status.readability.lightContrast}:1\`)\n\n` +
                        `💡 *To change your color:* \`${prefix}color blend <hex1> <hex2>\`\n` +
                        `🗑️ *To remove:* \`${prefix}color remove\``
                    )
                    .setFooter({ text: 'Starry Hex Blend Studio' })
                    .setTimestamp();

                return ctx.reply({ embeds: [embed] });
            }

            // ==========================================
            // SUBCOMMAND: CONFIG / ADMIN (,color config ...)
            // ==========================================
            if (sub === 'config' || sub === 'admin' || sub === 'setup') {
                if (!member.permissions.has(PermissionFlagsBits.ManageGuild) && !member.permissions.has(PermissionFlagsBits.Administrator)) {
                    return ctx.reply('❌ You need the `Manage Server` permission to configure the color role system.');
                }

                const action = (ctx.args[1] || '').toLowerCase();
                const settings = await colorRoleEngine.getSettings(ctx.guild.id);
                const config = settings.colorRoleSystem || {};

                if (action === 'toggle') {
                    const newState = !config.enabled;
                    await ServerSettings.findOneAndUpdate(
                        { guildId: ctx.guild.id },
                        { $set: { 'colorRoleSystem.enabled': newState } },
                        { upsert: true }
                    );
                    return ctx.reply(`✅ Color role system is now **${newState ? 'ENABLED' : 'DISABLED'}**.`);
                }

                if (action === 'anchor') {
                    const roleMention = ctx.message?.mentions?.roles?.first() || ctx.guild.roles.cache.get(ctx.args[2]);
                    if (!roleMention && ctx.args[2] !== 'none' && ctx.args[2] !== 'clear') {
                        return ctx.reply(`🔹 **Usage:** \`${prefix}color config anchor <@Role|none>\`\n*Anchors color roles directly below this role in the hierarchy.*`);
                    }

                    const anchorId = roleMention ? roleMention.id : '';
                    await ServerSettings.findOneAndUpdate(
                        { guildId: ctx.guild.id },
                        { $set: { 'colorRoleSystem.anchorRoleId': anchorId } },
                        { upsert: true }
                    );

                    return ctx.reply(anchorId 
                        ? `✅ Hierarchy anchor role set to <@&${anchorId}>. New color roles will be created directly below it.`
                        : `✅ Anchor role cleared. Color roles will now be placed 1 position below Starry's highest role.`
                    );
                }

                // Show current configuration
                const embed = new EmbedBuilder()
                    .setColor('#5865F2')
                    .setTitle('⚙️ Starry Name Color System Settings')
                    .setDescription(
                        `**Status:** ${config.enabled !== false ? '🟢 Enabled' : '🔴 Disabled'}\n` +
                        `**Anchor Role:** ${config.anchorRoleId ? `<@&${config.anchorRoleId}>` : '*None (Defaults below Starry)*'}\n` +
                        `**Member Access:** ${config.allowEveryone !== false ? '🔓 Everyone' : '🔒 Restricted'}\n\n` +
                        `**Commands:**\n` +
                        `• \`${prefix}color config toggle\` — Enable or disable the color system\n` +
                        `• \`${prefix}color config anchor <@Role|none>\` — Set upper hierarchy boundary role`
                    )
                    .setFooter({ text: 'Starry Server Administration' });

                return ctx.reply({ embeds: [embed] });
            }

            // ==========================================
            // FALLBACK: HELP & OVERVIEW
            // ==========================================
            const helpEmbed = new EmbedBuilder()
                .setColor('#FF007F')
                .setTitle('🎨 Starry Hex Blend & Name Color Studio')
                .setDescription(
                    `Easily change your Discord username color to custom **Hex Blends**, **Dual Gradients**, or **Solid Colors** without needing 3 server boosts!\n\n` +
                    `**🚀 Available Commands:**\n` +
                    `• \`${prefix}color blend <#Hex1> <#Hex2> [Ratio%]\` — Blend two hex colors together seamlessly\n` +
                    `• \`${prefix}color <#HexCode>\` — Apply a solid hex color (e.g. \`${prefix}color #FF73FA\`)\n` +
                    `• \`${prefix}color <#Hex1> <#Hex2>\` — Quick dual-color blend\n` +
                    `• \`${prefix}color preset <name>\` — Apply an aesthetic preset (e.g. \`cyberpunk\`, \`sunset\`)\n` +
                    `• \`${prefix}color presets\` — Browse all 26 curated aesthetic presets\n` +
                    `• \`${prefix}color random\` — Generate and apply a random vibrant blend\n` +
                    `• \`${prefix}color preview <#Hex1> [#Hex2]\` — Preview colors without applying\n` +
                    `• \`${prefix}color info\` — View your active color role and WCAG contrast rating\n` +
                    `• \`${prefix}color remove\` — Remove your custom color role\n\n` +
                    `💡 *How does it work without boosts?*\n` +
                    `Discord locks native gradients behind 3 boosts. Starry solves this with **Photometric Gamma Blending**: mathematical optical color mixing that generates a pristine, luminous blend of your chosen colors that displays everywhere on Discord with 100% reliability!`
                )
                .setFooter({ text: `Type ${prefix}color presets to browse aesthetic palettes!` });

            return ctx.reply({ embeds: [helpEmbed] });
        }
    }
];

module.exports = commands;
