const { PermissionsBitField } = require('discord.js');
const { AutoroleConfig, StickyRole } = require('../../models/AutoroleSchema');

module.exports = (client) => {
    // ==========================================
    // 1. AUTOMATIC BACKGROUND BACKUP (ON LEAVE)
    // ==========================================
    client.on('guildMemberRemove', async (member) => {
        if (member.user.bot) return; // We don't need to save bot roles

        try {
            const config = await AutoroleConfig.findOne({ guildId: member.guild.id });
            if (config && config.stickyRolesEnabled === false) return; // Skip if disabled

            // Automatically fetch all roles the user had (ignoring the @everyone role)
            const roleIds = member.roles.cache
                .filter(role => role.id !== member.guild.id)
                .map(role => role.id);

            if (roleIds.length === 0) return;

            // Silently store the role data in MongoDB
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

            // A. Fetch from MongoDB and restore previous roles
            if (!config || config.stickyRolesEnabled !== false) {
                const previousData = await StickyRole.findOne({ guildId: member.guild.id, userId: member.user.id });
                
                if (previousData && previousData.roles.length > 0) {
                    const validStickyRoles = previousData.roles.filter(roleId => {
                        const role = member.guild.roles.cache.get(roleId);
                        return role && role.position < botHighestRole; // Only restore roles the bot can actually give
                    });
                    rolesToApply.push(...validStickyRoles);
                }
            }

            // B. Add the Default Autorole (e.g., @Member)
            if (config && config.roleId) {
                const autoRole = member.guild.roles.cache.get(config.roleId);
                if (autoRole && autoRole.position < botHighestRole && !rolesToApply.includes(config.roleId)) {
                    rolesToApply.push(config.roleId);
                }
            }

            // C. Apply all roles instantly
            if (rolesToApply.length > 0) {
                await member.roles.add(rolesToApply, "Starry Automod: Restored previous roles & assigned default role").catch(() => {});
            }

        } catch (error) {
            console.error(`❌ Role Assign Error:`, error);
        }
    });

    // ==========================================
    // 3. ADMIN SETUP COMMAND
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
            replyMessage += `✅ Autorole set to ${role}. New members will get this automatically.\n`;
        }

        if (sticky !== null) {
            updateData.stickyRolesEnabled = sticky;
            replyMessage += `✅ Sticky Roles (auto-restoring old roles from database) is now **${sticky ? 'Enabled' : 'Disabled'}**.`;
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
            
