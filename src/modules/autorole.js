const { PermissionsBitField, ActionRowBuilder, RoleSelectMenuBuilder } = require('discord.js');
const { AutoroleConfig, StickyRole } = require('../../models/AutoroleSchema');

module.exports = (client) => {
    // ==========================================
    // 1. AUTOMATIC BACKGROUND BACKUP (ON LEAVE)
    // ==========================================
    client.on('guildMemberRemove', async (member) => {
        if (member.user.bot) return;

        try {
            const config = await AutoroleConfig.findOne({ guildId: member.guild.id });
            if (config && config.stickyRolesEnabled === false) return;

            const roleIds = member.roles.cache
                .filter(role => role.id !== member.guild.id)
                .map(role => role.id);

            if (roleIds.length === 0) return;

            await StickyRole.findOneAndUpdate(
                { guildId: member.guild.id, userId: member.user.id },
                { roles: roleIds },
                { upsert: true }
            );
        } catch (error) {
            console.error(`❌ Sticky Role Auto-Save Error:`, error);
        }
    });

    // ==========================================
    // 2. AUTOMATIC RESTORE & ASSIGN (ON JOIN)
    // ==========================================
    client.on('guildMemberAdd', async (member) => {
        if (member.user.bot) return; 

        try {
            const config = await AutoroleConfig.findOne({ guildId: member.guild.id });
            let rolesToApply = [];
            
            // Wait for cache to ensure bot role position is accurate
            const botHighestRole = member.guild.members.me.roles.highest.position;

            if (!config || config.stickyRolesEnabled !== false) {
                const previousData = await StickyRole.findOne({ guildId: member.guild.id, userId: member.user.id });

                if (previousData && previousData.roles.length > 0) {
                    const validStickyRoles = previousData.roles.filter(roleId => {
                        const role = member.guild.roles.cache.get(roleId);
                        return role && role.position < botHighestRole;
                    });
                    rolesToApply.push(...validStickyRoles);
                }
            }

            if (config && config.roleIds && config.roleIds.length > 0) {
                for (const rId of config.roleIds) {
                    const autoRole = member.guild.roles.cache.get(rId);
                    if (autoRole && autoRole.position < botHighestRole && !rolesToApply.includes(rId)) {
                        rolesToApply.push(rId);
                    }
                }
            }

            if (rolesToApply.length > 0) {
                await member.roles.add(rolesToApply, "Starry Automod: Restored previous roles & assigned default roles").catch(() => {});
            }

        } catch (error) {
            console.error(`❌ Role Assign Error:`, error);
        }
    });

    // ==========================================
    // 3. ADMIN SETUP COMMAND (DROPDOWN MENU)
    // ==========================================
    client.on('interactionCreate', async (interaction) => {
        
        // --- A. Handle the initial /autorole command ---
        if (interaction.isChatInputCommand() && interaction.commandName === 'autorole') {
            if (!interaction.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
                return interaction.reply({ content: '❌ You need **Administrator** permissions to use this.', ephemeral: true });
            }

            const sticky = interaction.options.getBoolean('sticky_roles');

            // If they only want to toggle sticky roles, update and return
            if (sticky !== null) {
                await AutoroleConfig.findOneAndUpdate(
                    { guildId: interaction.guild.id }, 
                    { stickyRolesEnabled: sticky }, 
                    { upsert: true }
                );
                return interaction.reply({ content: `✅ Sticky Roles is now **${sticky ? 'Enabled' : 'Disabled'}**.`, ephemeral: true });
            }

            // If no option is provided, send the Role Select Menu!
            const row = new ActionRowBuilder().addComponents(
                new RoleSelectMenuBuilder()
                    .setCustomId('autorole_menu')
                    .setPlaceholder('Select all your autoroles here...')
                    .setMinValues(0) // 0 allows them to clear the list if they want
                    .setMaxValues(25) // Strictly caps at Discord's 25 limit
            );

            await interaction.reply({ 
                content: 'Use the dropdown below to select up to **25 roles** you want to assign when a member joins:', 
                components: [row], 
                ephemeral: true 
            });
        }

        // --- B. Handle the Dropdown Menu Selection ---
        if (interaction.isRoleSelectMenu() && interaction.customId === 'autorole_menu') {
            const selectedRoleIds = interaction.values; // This is an array of up to 25 role IDs
            const botHighestRole = interaction.guild.members.me.roles.highest.position;
            
            const validRoleIds = [];
            const invalidRoles = [];

            // Double check hierarchy so the bot doesn't crash trying to assign roles above it
            for (const roleId of selectedRoleIds) {
                const role = interaction.guild.roles.cache.get(roleId);
                if (role && role.position >= botHighestRole) {
                    invalidRoles.push(role.name);
                } else {
                    validRoleIds.push(roleId);
                }
            }

            // Save the array to the database instantly
            await AutoroleConfig.findOneAndUpdate(
                { guildId: interaction.guild.id },
                { roleIds: validRoleIds },
                { upsert: true }
            );

            // Give feedback
            let replyMessage = `✅ Successfully saved **${validRoleIds.length}** autoroles!`;
            
            if (invalidRoles.length > 0) {
                replyMessage += `\n⚠️ **Skipped roles (higher than my bot role):** ${invalidRoles.join(', ')}. Please drag my bot role higher in your server settings and try again.`;
            }

            // Update the message so the dropdown menu goes away
            await interaction.update({ content: replyMessage, components: [] });
        }
    });
};
