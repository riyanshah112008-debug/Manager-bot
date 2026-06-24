const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

module.exports = (client) => {
    // 1. Listen for the dynamic setup command
    client.on('messageCreate', async (message) => {
        if (message.author.bot || !message.guild) return;

        // Command: .setup-role @RoleName
        if (message.content.startsWith('.setup-role')) {
            
            // Protect this command so only Admins can spawn panels
            if (!message.member.permissions.has('Administrator')) {
                return message.reply('❌ You need Administrator permissions to use this.');
            }

            // Grab the role they mentioned in the command
            const role = message.mentions.roles.first();
            
            if (!role) {
                return message.reply('❌ **Usage:** `.setup-role @RoleName`\nPlease tag the role you want to create a button for!');
            }

            // Safety Check: Ensure the bot is physically allowed to give this role
            if (message.guild.members.me.roles.highest.position <= role.position) {
                return message.reply(`❌ I cannot give out the **${role.name}** role because it is higher than (or equal to) my own bot role! Move my role higher in the server settings.`);
            }

            // Create the Button, hiding the role.id directly inside the customId!
            const button = new ButtonBuilder()
                .setCustomId(`rr_${role.id}`) // e.g., 'rr_123456789'
                .setLabel(`Get ${role.name}`)
                .setStyle(ButtonStyle.Primary)
                .setEmoji('✨');

            const row = new ActionRowBuilder().addComponents(button);

            // Send the panel to the chat
            await message.channel.send({
                content: `**Role Menu**\nClick the button below to get or remove the <@&${role.id}> role!`,
                components: [row]
            });
            
            // Delete the Admin's setup message to keep the channel clean
            await message.delete().catch(() => {});
        }
    });

    // 2. Listen for button clicks dynamically
    client.on('interactionCreate', async (interaction) => {
        if (!interaction.isButton()) return;

        // Check if the button they clicked is one of our dynamic Reaction Roles ('rr_')
        if (interaction.customId.startsWith('rr_')) {
            
            // Extract the role ID from the hidden customId (rr_123456789 -> 123456789)
            const roleId = interaction.customId.split('_')[1];
            const member = interaction.member;
            const role = interaction.guild.roles.cache.get(roleId);

            // If an admin deleted the role from the server, but the button still exists
            if (!role) {
                return interaction.reply({ content: '❌ This role no longer exists in the server!', ephemeral: true });
            }

            try {
                // Toggle the role
                if (member.roles.cache.has(roleId)) {
                    await member.roles.remove(roleId);
                    await interaction.reply({ content: `❌ I have removed the **${role.name}** role from you!`, ephemeral: true });
                } else {
                    await member.roles.add(roleId);
                    await interaction.reply({ content: `✅ I have given you the **${role.name}** role!`, ephemeral: true });
                }
            } catch (error) {
                console.error('Role Toggle Error:', error);
                await interaction.reply({ content: '❌ I failed to update your roles. Please check my permissions!', ephemeral: true });
            }
        }
    });
};
              
