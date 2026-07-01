const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType, PermissionsBitField, AttachmentBuilder } = require('discord.js');

module.exports = (client) => {
    client.on('clientReady', async () => {
        try {
            await client.application.commands.create({
                name: 'ticketsetup',
                description: 'Set up the support ticket button (Admin Only)',
                default_member_permissions: '8' 
            });
            console.log('✅ Advanced Ticket Slash Command Added');
        } catch (err) {}
    });

    client.on('interactionCreate', async (interaction) => {
        // ==========================================
        // 1. TICKET PANEL SETUP
        // ==========================================
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

        // ==========================================
        // 2. CREATE TICKET
        // ==========================================
        if (interaction.isButton() && interaction.customId === 'create_ticket') {
            const guild = interaction.guild;
            const user = interaction.user;

            const existingChannel = guild.channels.cache.find(c => c.name === `ticket-${user.username.toLowerCase()}`);
            if (existingChannel) {
                return interaction.reply({ content: `❌ You already have a ticket open at <#${existingChannel.id}>!`, ephemeral: true }).catch(() => {});
            }

            try {
                // Find or create the TICKETS category
                let category = guild.channels.cache.find(c => c.name === 'TICKETS' && c.type === ChannelType.GuildCategory);
                if (!category) {
                    category = await guild.channels.create({ name: 'TICKETS', type: ChannelType.GuildCategory }).catch(() => null);
                }

                // Create the channel and store the user ID in the topic so we can lock them out later!
                const ticketChannel = await guild.channels.create({
                    name: `ticket-${user.username}`,
                    type: ChannelType.GuildText,
                    parent: category ? category.id : null,
                    topic: user.id, 
                    permissionOverwrites: [
                        { id: guild.id, deny: [PermissionsBitField.Flags.ViewChannel] }, 
                        { id: user.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] }, 
                        { id: client.user.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] }
                    ]
                });

                const buttons = new ActionRowBuilder().addComponents(
                    new ButtonBuilder()
                        .setCustomId('claim_ticket')
                        .setLabel('✋ Claim')
                        .setStyle(ButtonStyle.Success),
                    new ButtonBuilder()
                        .setCustomId('close_ticket')
                        .setLabel('🔒 Close')
                        .setStyle(ButtonStyle.Danger)
                );

                const ticketEmbed = new EmbedBuilder()
                    .setColor('Green')
                    .setTitle('🎫 Ticket Opened')
                    .setDescription(`Welcome <@${user.id}>!\n\nPlease explain your issue here. A staff member will claim this ticket shortly.`)
                    .setTimestamp();

                await ticketChannel.send({ content: `<@${user.id}>`, embeds: [ticketEmbed], components: [buttons] }).catch(() => {});
                await interaction.reply({ content: `✅ Ticket created! Head over to <#${ticketChannel.id}>`, ephemeral: true }).catch(() => {});
            } catch (error) {
                await interaction.reply({ content: '❌ Error: I lack permissions to create channels.', ephemeral: true }).catch(() => {});
            }
        }

        // ==========================================
        // 3. CLAIM TICKET
        // ==========================================
        if (interaction.isButton() && interaction.customId === 'claim_ticket') {
            if (!interaction.member.permissions.has(PermissionsBitField.Flags.ManageChannels)) {
                 return interaction.reply({ content: '❌ Only staff members can claim tickets!', ephemeral: true }).catch(() => {});
            }

            const embed = EmbedBuilder.from(interaction.message.embeds[0])
                .setColor('Yellow')
                .addFields({ name: 'Assigned To:', value: `<@${interaction.user.id}>` });

            // Disable the claim button after it's claimed
            const row = ActionRowBuilder.from(interaction.message.components[0]);
            row.components[0].setDisabled(true);

            await interaction.channel.setName(`claimed-${interaction.channel.name.split('-')[1]}`).catch(() => {});
            await interaction.update({ embeds: [embed], components: [row] }).catch(() => {});
            await interaction.channel.send(`✋ This ticket has been claimed by **${interaction.user.username}**!`).catch(() => {});
        }

        // ==========================================
        // 4. CLOSE TICKET
        // ==========================================
        if (interaction.isButton() && interaction.customId === 'close_ticket') {
            if (!interaction.member.permissions.has(PermissionsBitField.Flags.ManageChannels)) {
                 return interaction.reply({ content: '❌ Only staff members can close tickets!', ephemeral: true }).catch(() => {});
            }

            // Remove the user's ability to see/type in the ticket
            const targetUserId = interaction.channel.topic;
            if (targetUserId) {
                await interaction.channel.permissionOverwrites.edit(targetUserId, { 
                    ViewChannel: false 
                }).catch(() => {});
            }

            await interaction.channel.setName(`closed-${interaction.channel.name.split('-')[1] || 'ticket'}`).catch(() => {});

            const embed = new EmbedBuilder()
                .setColor('Red')
                .setTitle('🔒 Ticket Closed')
                .setDescription(`This ticket was closed by <@${interaction.user.id}>. You can now generate a transcript or delete the channel permanently.`);

            const adminButtons = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId('transcript_ticket')
                    .setLabel('📝 Generate Transcript')
                    .setStyle(ButtonStyle.Primary),
                new ButtonBuilder()
                    .setCustomId('delete_ticket')
                    .setLabel('🗑️ Delete Channel')
                    .setStyle(ButtonStyle.Danger)
            );

            // Disable all original buttons
            const disabledRow = ActionRowBuilder.from(interaction.message.components[0]);
            disabledRow.components.forEach(c => c.setDisabled(true));
            
            await interaction.update({ components: [disabledRow] }).catch(() => {});
            await interaction.channel.send({ embeds: [embed], components: [adminButtons] }).catch(() => {});
        }

        // ==========================================
        // 5. GENERATE TRANSCRIPT
        // ==========================================
        if (interaction.isButton() && interaction.customId === 'transcript_ticket') {
            if (!interaction.member.permissions.has(PermissionsBitField.Flags.ManageChannels)) return;

            await interaction.deferReply().catch(() => {});

            // Fetch the last 100 messages in the ticket
            const messages = await interaction.channel.messages.fetch({ limit: 100 }).catch(() => null);
            if (!messages) return interaction.editReply('❌ Failed to fetch messages for transcript.').catch(() => {});

            let transcriptText = `--- Transcript for ${interaction.channel.name} ---\n\n`;
            
            messages.reverse().forEach(msg => {
                const time = new Date(msg.createdTimestamp).toLocaleString();
                transcriptText += `[${time}] ${msg.author.tag}: ${msg.content || '[Attachment/Embed]'}\n`;
            });

            const attachment = new AttachmentBuilder(Buffer.from(transcriptText, 'utf-8'), { name: `${interaction.channel.name}-transcript.txt` });

            await interaction.editReply({ content: '✅ Transcript generated successfully!', files: [attachment] }).catch(() => {});
        }

        // ==========================================
        // 6. DELETE TICKET
        // ==========================================
        if (interaction.isButton() && interaction.customId === 'delete_ticket') {
            if (!interaction.member.permissions.has(PermissionsBitField.Flags.ManageChannels)) return;

            await interaction.reply({ content: '🗑️ Ticket channel will be permanently deleted in 5 seconds...' }).catch(() => {});
            setTimeout(() => {
                interaction.channel.delete().catch(() => {});
            }, 5000);
        }
    });
};
