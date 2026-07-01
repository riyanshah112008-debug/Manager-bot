const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType, PermissionsBitField } = require('discord.js');

module.exports = (client) => {
    client.on('clientReady', async () => {
        try {
            await client.application.commands.create({
                name: 'ticketsetup',
                description: 'Set up the support ticket button (Admin Only)',
                default_member_permissions: '8' 
            });
            console.log('✅ Ticket Slash Command Added');
        } catch (err) {}
    });

    client.on('interactionCreate', async (interaction) => {
        // 1. Handle the /ticketsetup command
        if (interaction.isChatInputCommand() && interaction.commandName === 'ticketsetup') {
            const embed = new EmbedBuilder()
                .setColor('Blue')
                .setTitle('🎫 Support Tickets')
                .setDescription('Need help? Click the button below to open a private ticket with the staff team.')
                .setFooter({ text: interaction.guild.name, iconURL: interaction.guild.iconURL() });

            const button = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId('create_ticket')
                    .setLabel('📩 Open a Ticket')
                    .setStyle(ButtonStyle.Primary)
            );

            await interaction.reply({ content: '✅ Ticket system panel created successfully!', ephemeral: true }).catch(() => {});
            await interaction.channel.send({ embeds: [embed], components: [button] }).catch(() => {});
        }

        // 2. Handle the "Open Ticket" button
        if (interaction.isButton() && interaction.customId === 'create_ticket') {
            const guild = interaction.guild;
            const user = interaction.user;

            const existingChannel = guild.channels.cache.find(c => c.name === `ticket-${user.username.toLowerCase()}`);
            if (existingChannel) {
                return interaction.reply({ content: `❌ You already have a ticket open at <#${existingChannel.id}>!`, ephemeral: true }).catch(() => {});
            }

            try {
                const ticketChannel = await guild.channels.create({
                    name: `ticket-${user.username}`,
                    type: ChannelType.GuildText,
                    permissionOverwrites: [
                        { id: guild.id, deny: [PermissionsBitField.Flags.ViewChannel] }, 
                        { id: user.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] }, 
                        { id: client.user.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] }
                    ]
                });

                const closeButton = new ActionRowBuilder().addComponents(
                    new ButtonBuilder()
                        .setCustomId('close_ticket')
                        .setLabel('🔒 Close Ticket')
                        .setStyle(ButtonStyle.Danger)
                );

                const ticketEmbed = new EmbedBuilder()
                    .setColor('Green')
                    .setTitle('🎫 Ticket Opened')
                    .setDescription(`Welcome <@${user.id}>!\n\nPlease explain your issue here. A staff member will be with you shortly.`)
                    .setTimestamp();

                await ticketChannel.send({ content: `<@${user.id}>`, embeds: [ticketEmbed], components: [closeButton] }).catch(() => {});
                await interaction.reply({ content: `✅ Ticket created! Head over to <#${ticketChannel.id}>`, ephemeral: true }).catch(() => {});
            } catch (error) {
                await interaction.reply({ content: '❌ Error: I lack permissions to create channels.', ephemeral: true }).catch(() => {});
            }
        }

        // 3. Handle the "Close Ticket" button
        if (interaction.isButton() && interaction.customId === 'close_ticket') {
            if (!interaction.member.permissions.has(PermissionsBitField.Flags.ManageChannels)) {
                 return interaction.reply({ content: '❌ Only staff members can close tickets!', ephemeral: true }).catch(() => {});
            }

            await interaction.reply({ content: '🔒 Ticket will be deleted in 5 seconds...' }).catch(() => {});
            setTimeout(() => {
                interaction.channel.delete().catch(() => {});
            }, 5000);
        }
    });
};
