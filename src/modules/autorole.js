const { PermissionsBitField } = require('discord.js');
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
    // 3. ADMIN SETUP COMMAND (ROLE1, ROLE2...)
    // ==========================================
    client.on('interactionCreate', async (interaction) => {
        if (!interaction.isChatInputCommand() || interaction.commandName !== 'autorole') return;

        if (!interaction.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
            return interaction.reply({ content: '❌ You need **Administrator** permissions to use this.', ephemeral: true });
        }

        let config = await AutoroleConfig.findOne({ guildId: interaction.guild.id });
        if (!config) config = new AutoroleConfig({ guildId: interaction.guild.id, roleIds: [] });

        let replyMessage = "";
        let rolesAdded = 0;
        const invalidRoles = [];
        const botHighestRole = interaction.guild.members.me.roles.highest.position;

        // Loop through role1 up to role24 to see which ones were filled out
        for (let i = 1; i <= 24; i++) {
            const role = interaction.options.getRole(`role${i}`);
            
            if (role) {
                if (role.position >= botHighestRole) {
                    invalidRoles.push(role.name);
                } else if (!config.roleIds.includes(role.id)) {
                    // Check if we hit the limit before adding
                    if (config.roleIds.length >= 25) {
                        replyMessage += `\n⚠️ **Limit Reached:** Stopped adding roles because the 25 limit was hit.`;
                        break; 
                    }
                    config.roleIds.push(role.id);
                    rolesAdded++;
                }
            }
        }

        const sticky = interaction.options.getBoolean('sticky_roles');

        if (rolesAdded > 0) {
            replyMessage += `✅ Successfully added **${rolesAdded}** new roles to the autorole list! (Total: ${config.roleIds.length}/25)\n`;
        }
        
        if (invalidRoles.length > 0) {
            replyMessage += `⚠️ **Skipped roles (higher than bot):** ${invalidRoles.join(', ')}.\n`;
        }

        if (sticky !== null) {
            config.stickyRolesEnabled = sticky;
            replyMessage += `✅ Sticky Roles is now **${sticky ? 'Enabled' : 'Disabled'}**.\n`;
        }

        if (rolesAdded === 0 && invalidRoles.length === 0 && sticky === null) {
            return interaction.reply({ content: "⚠️ You didn't provide any valid settings or roles to change!", ephemeral: true });
        }

        await config.save();
        await interaction.reply({ content: replyMessage.trim(), ephemeral: true });
    });
};
