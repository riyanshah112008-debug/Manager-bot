// ==========================================
// 🎨 STARRY COLOR ROLE SYNERGY ENGINE
// File Path: src/modules/colorRoleEngine.js
// High-Performance Multi-Tenant Name Color & Hex Blend Orchestrator
// Features: Zero-Boost Fallback, Gamma-Corrected Blends, Hierarchy Safeguard, Anti-Bloat
// ==========================================
const { 
    Events, 
    PermissionFlagsBits 
} = require('discord.js');
const ColorRole = require('../models/ColorRole');
const ServerSettings = require('../models/ServerSettings');
const colorBlendEngine = require('../utils/colorBlendEngine');

// Fallback anchor role names for optimal hierarchy positioning
const ANCHOR_CANDIDATE_NAMES = [
    '--- Color Roles ---',
    '--- Booster Roles ---',
    '--- Vanity Roles ---'
];

class ColorRoleEngine {
    constructor() {
        this.client = null;
    }

    /**
     * Initialize event handlers to safeguard against role bloat
     * @param {import('discord.js').Client} client 
     */
    init(client) {
        this.client = client;

        // 1. Clean up role when member leaves server to prevent orphan role accumulation
        client.on(Events.GuildMemberRemove, async (member) => {
            try {
                await this.handleMemberRemove(member);
            } catch (err) {
                console.error('[ColorRoleEngine] Error in GuildMemberRemove:', err);
            }
        });

        // 2. Clean up database record if role is manually deleted by staff
        client.on(Events.GuildRoleDelete, async (role) => {
            try {
                await this.handleRoleDelete(role);
            } catch (err) {
                console.error('[ColorRoleEngine] Error in GuildRoleDelete:', err);
            }
        });

        console.log('🎨 [ColorRoleEngine] Hex Blend & Name Color Engine successfully initialized!');
    }

    /**
     * Retrieve server configuration with safe defaults
     * @param {string} guildId 
     */
    async getSettings(guildId) {
        let settings = await ServerSettings.findOne({ guildId }).lean();
        if (!settings) {
            settings = {
                colorRoleSystem: {
                    enabled: true,
                    anchorRoleId: '',
                    allowEveryone: true,
                    allowedRoles: []
                }
            };
        }
        return settings;
    }

    /**
     * Calculate optimal role hierarchy position
     * Ensures color role sits below bot role/anchor, but above regular roles so color renders
     * @param {import('discord.js').Guild} guild 
     * @param {string} [configuredAnchorId] 
     */
    async calculateSafeRolePosition(guild, configuredAnchorId) {
        const botMember = guild.members.me || await guild.members.fetchMe().catch(() => null);
        if (!botMember) return 1;

        let anchorRole = null;
        if (configuredAnchorId) {
            anchorRole = guild.roles.cache.get(configuredAnchorId);
        }

        if (!anchorRole) {
            for (const name of ANCHOR_CANDIDATE_NAMES) {
                const found = guild.roles.cache.find(r => r.name.toLowerCase() === name.toLowerCase());
                if (found) {
                    anchorRole = found;
                    break;
                }
            }
        }

        // If an anchor role is located below the bot's highest role, place immediately below it
        if (anchorRole && botMember.roles.highest.position > anchorRole.position) {
            return Math.max(1, anchorRole.position - 1);
        }

        // Otherwise place 1 position below the bot's highest role
        return Math.max(1, botMember.roles.highest.position - 1);
    }

    /**
     * Verify if a member is authorized to use color role commands
     * @param {import('discord.js').GuildMember} member 
     * @param {object} settings 
     */
    isAuthorized(member, settings) {
        if (!member || !member.guild) return false;
        if (member.id === member.guild.ownerId) return true;
        if (member.permissions.has(PermissionFlagsBits.Administrator)) return true;

        const config = settings?.colorRoleSystem || {};
        if (config.enabled === false) return false;
        if (config.allowEveryone !== false) return true;

        if (Array.isArray(config.allowedRoles) && config.allowedRoles.length > 0) {
            return config.allowedRoles.some(rId => member.roles.cache.has(rId));
        }

        return true;
    }

    /**
     * Apply or update a personal color role for a member
     * Seamlessly handles native gradients (3 boosts) and gamma-corrected hex blends (0 boosts)
     * 
     * @param {import('discord.js').Guild} guild 
     * @param {import('discord.js').GuildMember} member 
     * @param {object} options 
     * @param {'blend'|'solid'|'gradient'|'preset'|'random'} options.colorType 
     * @param {string} options.primaryColor 
     * @param {string} [options.secondaryColor] 
     * @param {number} [options.ratio=50] 
     * @param {string} [options.presetName] 
     */
    async applyColorRole(guild, member, options) {
        const settings = await this.getSettings(guild.id);
        const config = settings?.colorRoleSystem || {};

        if (config.enabled === false) {
            throw new Error('The Name Color & Hex Blend system is currently disabled in this server.');
        }

        if (!this.isAuthorized(member, settings)) {
            throw new Error('You do not have permission to use the custom color role command in this server.');
        }

        const botMember = guild.members.me || await guild.members.fetchMe().catch(() => null);
        if (!botMember || !botMember.permissions.has(PermissionFlagsBits.ManageRoles)) {
            throw new Error('Starry requires the `Manage Roles` permission to create and assign color roles.');
        }

        const primaryHex = colorBlendEngine.parseHex(options.primaryColor);
        if (!primaryHex) {
            throw new Error(`Invalid primary hex color: \`${options.primaryColor}\`. Example: \`#FF0055\``);
        }

        let secondaryHex = null;
        if (options.secondaryColor) {
            secondaryHex = colorBlendEngine.parseHex(options.secondaryColor);
            if (!secondaryHex) {
                throw new Error(`Invalid secondary hex color: \`${options.secondaryColor}\`. Example: \`#00E5FF\``);
            }
        }

        // Calculate blended hex code
        const ratio = typeof options.ratio === 'number' ? Math.max(0, Math.min(100, options.ratio)) : 50;
        const blendedHex = secondaryHex 
            ? colorBlendEngine.blendColors(primaryHex, secondaryHex, ratio)
            : primaryHex;

        // Check if guild has native Enhanced Role Colors capability
        const hasNativeEnhancedFeature = guild.features?.includes('ENHANCED_ROLE_COLORS');

        // Check if user already owns a ColorRole document
        let doc = await ColorRole.findOne({ guildId: guild.id, userId: member.id });
        let role = null;
        let isNew = false;
        let appliedNativeGradient = false;

        if (doc) {
            role = guild.roles.cache.get(doc.roleId);
        }

        const roleName = `🎨・${member.displayName || member.user.username}`.slice(0, 100);

        if (role) {
            // Check hierarchy before editing
            if (botMember.roles.highest.position <= role.position) {
                // If existing role is above bot, reposition below bot
                const safePos = await this.calculateSafeRolePosition(guild, config.anchorRoleId);
                await role.setPosition(safePos).catch(() => {});
            }

            // Attempt to apply colors
            if (secondaryHex && hasNativeEnhancedFeature) {
                try {
                    await role.setColors({ primaryColor: primaryHex, secondaryColor: secondaryHex });
                    appliedNativeGradient = true;
                } catch (e) {
                    // Fallback to vibrant blend
                    await role.setColor(blendedHex);
                }
            } else {
                await role.setColor(blendedHex);
            }

            if (role.name !== roleName) {
                await role.setName(roleName).catch(() => {});
            }

            if (!member.roles.cache.has(role.id)) {
                await member.roles.add(role, 'Starry Color Engine: Re-equipped custom color role').catch(() => {});
            }

            // Update document
            doc.colorType = options.colorType || (secondaryHex ? 'blend' : 'solid');
            doc.primaryColor = primaryHex;
            doc.secondaryColor = secondaryHex;
            doc.blendedColor = blendedHex;
            doc.ratio = ratio;
            doc.presetName = options.presetName || null;
            doc.isNativeGradient = appliedNativeGradient;
            doc.active = true;
            await doc.save();
        } else {
            // If doc existed but role was deleted, clean stale record
            if (doc) await doc.deleteOne().catch(() => {});

            // Guard against Discord 250 guild roles limit
            if (guild.roles.cache.size >= 249) {
                throw new Error('This Discord server has reached its maximum role limit (250 roles). An administrator must remove unused roles.');
            }

            const targetPosition = await this.calculateSafeRolePosition(guild, config.anchorRoleId);

            // Create fresh vanity role with strictly 0 permissions
            role = await guild.roles.create({
                name: roleName,
                color: blendedHex,
                permissions: 0n,
                hoist: false,
                mentionable: false,
                position: targetPosition,
                reason: `Starry Name Color: Custom role for ${member.user.tag} (${member.id})`
            });

            // If secondary color provided and native perk available, try applying gradient
            if (secondaryHex && hasNativeEnhancedFeature) {
                try {
                    await role.setColors({ primaryColor: primaryHex, secondaryColor: secondaryHex });
                    appliedNativeGradient = true;
                } catch (e) {
                    // Native gradient not accepted by API, remains on clean blendedHex
                }
            }

            // Reposition role high enough so user name color is displayed
            if (role.position < targetPosition) {
                await role.setPosition(targetPosition).catch(() => {});
            }

            // Assign to member
            await member.roles.add(role, 'Starry Color Engine: Assigned custom color role');

            // Save in database
            doc = await ColorRole.create({
                guildId: guild.id,
                userId: member.id,
                roleId: role.id,
                colorType: options.colorType || (secondaryHex ? 'blend' : 'solid'),
                primaryColor: primaryHex,
                secondaryColor: secondaryHex,
                blendedColor: blendedHex,
                ratio: ratio,
                presetName: options.presetName || null,
                isNativeGradient: appliedNativeGradient,
                active: true
            });

            isNew = true;
        }

        return {
            role,
            doc,
            primaryHex,
            secondaryHex,
            blendedHex,
            ratio,
            isNew,
            appliedNativeGradient,
            readability: colorBlendEngine.analyzeDiscordReadability(blendedHex)
        };
    }

    /**
     * Remove and delete a member's custom color role
     * @param {import('discord.js').Guild} guild 
     * @param {import('discord.js').GuildMember} member 
     */
    async removeColorRole(guild, member) {
        const doc = await ColorRole.findOne({ guildId: guild.id, userId: member.id });
        let deletedRoleName = null;

        if (doc) {
            const role = guild.roles.cache.get(doc.roleId);
            if (role) {
                deletedRoleName = role.name;
                await role.delete('Starry Color Engine: User requested role reset').catch(() => {});
            }
            await doc.deleteOne();
            return { success: true, roleName: deletedRoleName || 'Custom Color Role' };
        }

        // Fallback cleanup if user has an untracked 🎨 role
        const untrackedRole = member.roles.cache.find(r => r.name.startsWith('🎨・'));
        if (untrackedRole) {
            deletedRoleName = untrackedRole.name;
            await untrackedRole.delete('Starry Color Engine: Cleanup untracked color role').catch(() => {});
            return { success: true, roleName: deletedRoleName };
        }

        return { success: false, message: 'You do not currently have an active custom color role.' };
    }

    /**
     * Get member's current color role status
     * @param {import('discord.js').Guild} guild 
     * @param {string} userId 
     */
    async getColorRoleStatus(guild, userId) {
        const doc = await ColorRole.findOne({ guildId: guild.id, userId }).lean();
        if (!doc) return null;

        const role = guild.roles.cache.get(doc.roleId);
        return {
            doc,
            role: role || null,
            readability: colorBlendEngine.analyzeDiscordReadability(doc.blendedColor)
        };
    }

    /**
     * Handle member departure: automatically remove role to preserve role quota
     */
    async handleMemberRemove(member) {
        if (!member || !member.guild) return;
        const doc = await ColorRole.findOne({ guildId: member.guild.id, userId: member.id });
        if (!doc) return;

        const role = member.guild.roles.cache.get(doc.roleId);
        if (role) {
            await role.delete('Starry Color Engine: Member departed from server').catch(() => {});
        }
        await doc.deleteOne().catch(() => {});
    }

    /**
     * Handle external role deletion by staff: purge stale database record
     */
    async handleRoleDelete(role) {
        if (!role || !role.guild) return;
        await ColorRole.deleteOne({ guildId: role.guild.id, roleId: role.id }).catch(() => {});
    }
}

const colorRoleEngine = new ColorRoleEngine();

const initExport = (client, app) => {
    colorRoleEngine.init(client);
    return colorRoleEngine;
};

for (const key of Object.getOwnPropertyNames(Object.getPrototypeOf(colorRoleEngine))) {
    if (key !== 'constructor' && typeof colorRoleEngine[key] === 'function') {
        initExport[key] = colorRoleEngine[key].bind(colorRoleEngine);
    }
}
initExport.engine = colorRoleEngine;
initExport.init = colorRoleEngine.init.bind(colorRoleEngine);

module.exports = initExport;
