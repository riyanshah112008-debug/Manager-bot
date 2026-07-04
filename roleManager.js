const { PermissionsBitField } = require('discord.js');

module.exports = (client) => {
    // You can change this prefix to whatever your bot uses
    const PREFIX = '!'; 

    client.on('messageCreate', async (message) => {
        // Ignore bots and DMs
        if (message.author.bot || !message.guild) return;
        if (!message.content.startsWith(PREFIX)) return;

        const args = message.content.slice(PREFIX.length).trim().split(/ +/);
        const command = args.shift().toLowerCase();

        // Valid commands for this module
        const roleCommands = ['createrole', 'deleterole', 'giverole', 'removerole'];
        if (!roleCommands.includes(command)) return;

        // ---------------------------------------------------------
        // PERMISSION CHECKS
        // ---------------------------------------------------------
        const hasPerms = message.member.permissions.has(PermissionsBitField.Flags.ManageRoles);
        const botHasPerms = message.guild.members.me.permissions.has(PermissionsBitField.Flags.ManageRoles);

        if (!hasPerms) {
            return message.reply("❌ You need the `Manage Roles` permission to use this command.");
        }
        if (!botHasPerms) {
            return message.reply("❌ I need the `Manage Roles` permission to do this! Check my role settings.");
        }

        try {
            // ==========================================
            // 1. CREATE ROLE: !createrole <Name> [HexColor]
            // ==========================================
            if (command === 'createrole') {
                if (args.length < 1) return message.reply("Usage: `!createrole <Role Name> [HexColor]`\nExample: `!createrole VIP #ffD700`");
                
                let color = '#99aab5'; // Default Discord grey
                let roleName = args.join(' ');
                
                // If the last argument is a valid hex code, use it for color and remove it from the name
                const lastArg = args[args.length - 1];
                if (/^#[0-9A-F]{6}$/i.test(lastArg)) {
                    color = lastArg;
                    roleName = args.slice(0, -1).join(' ');
                }

                const newRole = await message.guild.roles.create({
                    name: roleName,
                    color: color,
                    reason: `Created by ${message.author.tag}`
                });

                return message.reply(`✅ Successfully created the role **${newRole.name}**!`);
            }

            // ==========================================
            // 2. DELETE ROLE: !deleterole <@Role or ID>
            // ==========================================
            if (command === 'deleterole') {
                if (args.length < 1) return message.reply("Usage: `!deleterole <@Role or ID>`");
                
                // Strip mention formatting to get raw ID
                const roleId = args[0].replace(/[<@&>]/g, '');
                const role = message.guild.roles.cache.get(roleId);

                if (!role) return message.reply("❌ Could not find that role. Ensure you mention it or provide a valid ID.");
                
                // Check role hierarchy (Bot cannot delete roles higher than its own highest role)
                if (message.guild.members.me.roles.highest.position <= role.position) {
                    return message.reply("❌ I cannot delete a role that is higher than or equal to my highest role.");
                }

                const roleName = role.name;
                await role.delete(`Deleted by ${message.author.tag}`);
                return message.reply(`✅ Successfully deleted the role **${roleName}**.`);
            }

            // ==========================================
            // 3. GIVE ROLE: !giverole <@User> <@Role or ID>
            // ==========================================
            if (command === 'giverole') {
                if (args.length < 2) return message.reply("Usage: `!giverole <@User> <@Role>`");

                const targetMember = message.mentions.members.first() || await message.guild.members.fetch(args[0].replace(/[<@!>]/g, '')).catch(() => null);
                if (!targetMember) return message.reply("❌ Could not find that user.");

                const roleId = args[1].replace(/[<@&>]/g, '');
                const role = message.guild.roles.cache.get(roleId);
                
                if (!role) return message.reply("❌ Could not find that role.");

                if (message.guild.members.me.roles.highest.position <= role.position) {
                    return message.reply("❌ I cannot assign a role that is higher than or equal to my highest role.");
                }

                if (targetMember.roles.cache.has(role.id)) {
                    return message.reply(`⚠️ **${targetMember.user.username}** already has the **${role.name}** role.`);
                }

                await targetMember.roles.add(role);
                return message.reply(`✅ Successfully gave the **${role.name}** role to **${targetMember.user.username}**.`);
            }

            // ==========================================
            // 4. REMOVE ROLE: !removerole <@User> <@Role or ID>
            // ==========================================
            if (command === 'removerole') {
                if (args.length < 2) return message.reply("Usage: `!removerole <@User> <@Role>`");

                const targetMember = message.mentions.members.first() || await message.guild.members.fetch(args[0].replace(/[<@!>]/g, '')).catch(() => null);
                if (!targetMember) return message.reply("❌ Could not find that user.");

                const roleId = args[1].replace(/[<@&>]/g, '');
                const role = message.guild.roles.cache.get(roleId);
                
                if (!role) return message.reply("❌ Could not find that role.");

                if (message.guild.members.me.roles.highest.position <= role.position) {
                    return message.reply("❌ I cannot remove a role that is higher than or equal to my highest role.");
                }

                if (!targetMember.roles.cache.has(role.id)) {
                    return message.reply(`⚠️ **${targetMember.user.username}** does not have the **${role.name}** role.`);
                }

                await targetMember.roles.remove(role);
                return message.reply(`✅ Successfully removed the **${role.name}** role from **${targetMember.user.username}**.`);
            }

        } catch (error) {
            console.error('Role Manager Error:', error);
            message.reply("❌ An error occurred. Ensure my role is dragged higher in the server settings than the roles you are trying to manage.");
        }
    });
};
