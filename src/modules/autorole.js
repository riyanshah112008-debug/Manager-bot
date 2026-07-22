const { PermissionsBitField } = require('discord.js');
const { AutoroleConfig, StickyRole } = require('../../models/AutoroleSchema');

module.exports = (client) => {
    // ==========================================
    // 1. SAVE ROLES WHEN A MEMBER LEAVES
    // ==========================================
    client.on('guildMemberRemove', async (member) => {
        if (member.user.bot) return; // Ignore bots

        try {
            // Check if this server has sticky roles enabled
            const config = await AutoroleConfig.findOne({ guildId: member.guild.id });
            if (config && config.stickyRolesEnabled === false) return;

            // Get all role IDs they had, except the @everyone role
            const roleIds = member.roles.cache
                .filter(role => role.id !== member.guild.id)
                .map(role => role.id);

            if (roleIds.length === 0) return; // Nothing to save

            // Save to database
            await StickyRole.findOneAndUpdate(
                { guildId: member.guild.id, userId: member.user.id },
                { roles: roleIds },
                { upsert: true }
            );
        } catch (error) {
            console.error(`❌ Sticky Role Save Error:`, error);
        }
    });

    // ==========================================
    // 2. ASSIGN ROLES WHEN A MEMBER JOINS
    // ==========================================
    client.on('guildMemberAdd', async (member) => {
        if (member.user.bot) return; 

        try {
            const config = await AutoroleConfig.findOne({ guildId: member.guild.id });
            let rolesToApply = [];

            // A. Check for Sticky Roles (Previous roles)
            if (!config || config.stickyRolesEnabled !== false) {
                const previousData = await StickyRole.findOne({ guildId: member.guild.id, userId: member.user.id });
                
                if (previousData && previousData.roles.length > 0) {
                    const botHighestRole = member.guild.members.me.roles.highest.position;
                    
                    // Filter out deleted roles or roles higher than the bot
                    const validStickyRoles = previousData.roles.filter(roleId => {
                        const role = member.guild.roles.cache.get(roleId);
                        return role && role.position < botHighestRole;
                    });

                    rolesToApply.push(...validStickyRoles);
                }
            }

            // B. Add the Default Autorole (if configured)
            if (config && config.roleId) {
                const autoRole = member.guild.roles.cache.get(config.roleId);
                const botHighestRole = member.guild.members.me.roles.highest.position;
                
                // Make sure the role exists, the bot can assign it, and the user doesn't already have it queued
                if (autoRole && autoRole.position < botHighestRole && !rolesToApply.includes(config.roleId)) {
                    rolesToApply.push(config.roleId);
                }
            }

            // C. Apply all roles at once
            if (rolesToApply.length > 0) {
                await member.roles.add(rolesToApply, "Autorole / Sticky Role Restore").catch(() => {});
            }

        } catch (error) {
            console.error(`❌ Role Assign Error:`, error);
        }
    });

    // ==========================================
    // 3. SLASH COMMAND TO SET IT UP
    // ==========================================
    client.on('interactionCreate', async (interaction) => {
        if (!interaction.isChatInputCommand() || interaction.commandName !== 'autorole') return;
        
        if (!interaction.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
            return interaction.reply({ content: '❌ You need **Administrator** permissions to use this.', ephemeral: true });
        }

        const role = interaction.options.getRole('role');
        const sticky = interaction.options.getBoolean('sticky_roles');

        let updateData = {};
        let replyMessage = "";

        if (role) {
            const botHighestRole = interaction.guild.members.me.roles.highest.position;
            if (role.position >= botHighestRole) {
                return interaction.reply({ content: `❌ I cannot assign ${role} because it is higher than my own role! Move my role higher in the server settings.`, ephemeral: true });
            }
            updateData.roleId = role.id;
            replyMessage += `✅ Autorole set to ${role}.\n`;
        }

        if (sticky !== null) {
            updateData.stickyRolesEnabled = sticky;
            replyMessage += `✅ Sticky Roles (restoring old roles) is now **${sticky ? 'Enabled' : 'Disabled'}**.`;
        }

        if (Object.keys(updateData).length === 0) {
            return interaction.reply({ content: "⚠️ You didn't provide any settings to change!", ephemeral: true });
        }

        await AutoroleConfig.findOneAndUpdate(
            { guildId: interaction.guild.id }, 
            updateData, 
            { upsert: true }
        );

        await interaction.reply({ content: replyMessage, ephemeral: true });
    });
};
              
