const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType, PermissionsBitField, AttachmentBuilder, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');

module.exports = (client) => {
    // ==========================================
    // 1. REGISTER SLASH COMMANDS
    // ==========================================
    client.on('clientReady', async () => {
        try {
            await client.application.commands.create({
                name: 'ticketsetup',
                description: 'Set up the Support Ticket button (Admin Only)',
                default_member_permissions: '8' 
            });
            await client.application.commands.create({
                name: 'applysetup',
                description: 'Set up the Application Dashboard (Admin Only)',
                default_member_permissions: '8'
            });
            console.log('✅ Master Tickets & Applications Module Loaded');
        } catch (err) {}
    });

    client.on('interactionCreate', async (interaction) => {
        
        // ==========================================
        // 2. SPAWN THE DASHBOARDS (/ticketsetup & /applysetup)
        // ==========================================
        if (interaction.isChatInputCommand()) {
            if (interaction.commandName === 'ticketsetup') {
                const embed = new EmbedBuilder()
                    .setColor('Blue')
                    .setTitle('🎫 Support Tickets')
                    .setDescription('Need help? Click the button below to open a private ticket with the staff team.')
                    .setFooter({ text: interaction.guild.name, iconURL: interaction.guild.iconURL() });

                const button = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId('create_ticket').setLabel('📩 Open a Ticket').setStyle(ButtonStyle.Primary)
                );

                await interaction.reply({ content: '✅ Ticket system panel created!', ephemeral: true }).catch(() => {});
                await interaction.channel.send({ embeds: [embed], components: [button] }).catch(() => {});
            }

            if (interaction.commandName === 'applysetup') {
                const embed = new EmbedBuilder()
                    .setColor('Gold')
                    .setTitle('📋 Server Applications')
                    .setDescription('We are currently looking for new staff and partners!\n\nChoose an application type below to open the questionnaire.')
                    .setThumbnail(interaction.guild.iconURL({ dynamic: true }));

                const buttons = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId('apply_staff').setLabel('🛡️ Apply for Staff').setStyle(ButtonStyle.Primary),
                    new ButtonBuilder().setCustomId('apply_partner').setLabel('🤝 Request Partnership').setStyle(ButtonStyle.Success)
                );

                await interaction.reply({ content: '✅ Application Dashboard created!', ephemeral: true }).catch(() => {});
                await interaction.channel.send({ embeds: [embed], components: [buttons] }).catch(() => {});
            }
        }

        // ==========================================
        // 3. HANDLE BUTTON CLICKS (Create Ticket & Open Modals)
        // ==========================================
        if (interaction.isButton()) {
            
            // --- A. SUPPORT TICKET CREATION ---
            if (interaction.customId === 'create_ticket') {
                const guild = interaction.guild;
                const user = interaction.user;

                const existingChannel = guild.channels.cache.find(c => c.name === `ticket-${user.username.toLowerCase()}`);
                if (existingChannel) {
                    return interaction.reply({ content: `❌ You already have a ticket open at <#${existingChannel.id}>!`, ephemeral: true }).catch(() => {});
                }

                try {
                    let category = guild.channels.cache.find(c => c.name === 'TICKETS' && c.type === ChannelType.GuildCategory);
                    if (!category) category = await guild.channels.create({ name: 'TICKETS', type: ChannelType.GuildCategory }).catch(() => null);

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
                        new ButtonBuilder().setCustomId('claim_ticket').setLabel('✋ Claim').setStyle(ButtonStyle.Success),
                        new ButtonBuilder().setCustomId('close_ticket').setLabel('🔒 Close').setStyle(ButtonStyle.Danger)
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

            // --- B. APPLICATION MODALS ---
            if (interaction.customId === 'apply_staff') {
                const modal = new ModalBuilder().setCustomId('modal_staff').setTitle('Staff Application');
                const q1 = new TextInputBuilder().setCustomId('q1').setLabel('How old are you?').setStyle(TextInputStyle.Short).setRequired(true);
                const q2 = new TextInputBuilder().setCustomId('q2').setLabel('What is your past moderation experience?').setStyle(TextInputStyle.Paragraph).setRequired(true);
                const q3 = new TextInputBuilder().setCustomId('q3').setLabel('Why should we choose you for the team?').setStyle(TextInputStyle.Paragraph).setRequired(true);
                modal.addComponents(new ActionRowBuilder().addComponents(q1), new ActionRowBuilder().addComponents(q2), new ActionRowBuilder().addComponents(q3));
                await interaction.showModal(modal).catch(() => {});
            } 
            
            else if (interaction.customId === 'apply_partner') {
                const modal = new ModalBuilder().setCustomId('modal_partner').setTitle('Partnership Request');
                const q1 = new TextInputBuilder().setCustomId('q1').setLabel('What is your Server Name?').setStyle(TextInputStyle.Short).setRequired(true);
                const q2 = new TextInputBuilder().setCustomId('q2').setLabel('How many members do you have?').setStyle(TextInputStyle.Short).setRequired(true);
                const q3 = new TextInputBuilder().setCustomId('q3').setLabel('Why do you want to partner with us?').setStyle(TextInputStyle.Paragraph).setRequired(true);
                modal.addComponents(new ActionRowBuilder().addComponents(q1), new ActionRowBuilder().addComponents(q2), new ActionRowBuilder().addComponents(q3));
                await interaction.showModal(modal).catch(() => {});
            }
        }

        // ==========================================
        // 4. HANDLE MODAL SUBMISSIONS (Create Application Tickets)
        // ==========================================
        if (interaction.isModalSubmit() && (interaction.customId === 'modal_staff' || interaction.customId === 'modal_partner')) {
            const isStaff = interaction.customId === 'modal_staff';
            const typeName = isStaff ? 'Staff' : 'Partnership';

            const answer1 = interaction.fields.getTextInputValue('q1');
            const answer2 = interaction.fields.getTextInputValue('q2');
            const answer3 = interaction.fields.getTextInputValue('q3');

            try {
                let category = interaction.guild.channels.cache.find(c => c.name === 'APPLICATIONS' && c.type === ChannelType.GuildCategory);
                if (!category) category = await interaction.guild.channels.create({ name: 'APPLICATIONS', type: ChannelType.GuildCategory }).catch(() => null);

                const appChannel = await interaction.guild.channels.create({
                    name: `app-${interaction.user.username}`,
                    type: ChannelType.GuildText,
                    parent: category ? category.id : null,
                    topic: interaction.user.id, 
                    permissionOverwrites: [
                        { id: interaction.guild.id, deny: [PermissionsBitField.Flags.ViewChannel] },
                        { id: interaction.user.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] },
                        { id: client.user.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] }
                    ]
                });

                const embed = new EmbedBuilder()
                    .setColor(isStaff ? 'Blue' : 'Green')
                    .setTitle(`📝 New ${typeName} Application`)
                    .setAuthor({ name: interaction.user.tag, iconURL: interaction.user.displayAvatarURL() })
                    .addFields(
                        { name: isStaff ? 'Age' : 'Server Name', value: answer1 },
                        { name: isStaff ? 'Experience' : 'Member Count', value: answer2 },
                        { name: isStaff ? 'Reason for joining' : 'Reason for partnering', value: answer3 }
                    )
                    .setFooter({ text: `Review the answers and make a decision below.` });

                const decisionButtons = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId('app_accept').setLabel('✅ Accept').setStyle(ButtonStyle.Success),
                    new ButtonBuilder().setCustomId('app_reject').setLabel('❌ Reject').setStyle(ButtonStyle.Danger)
                );

                await appChannel.send({ content: `**<@${interaction.user.id}>, your application has been received!** Please wait while our management team reviews it.`, embeds: [embed], components: [decisionButtons] }).catch(() => {});
                await interaction.reply({ content: `✅ Application submitted! Head to <#${appChannel.id}>`, ephemeral: true }).catch(() => {});
            } catch (error) {
                await interaction.reply({ content: '❌ Failed to create application ticket.', ephemeral: true }).catch(() => {});
            }
        }

        // ==========================================
        // 5. HANDLE TICKET MANAGEMENT BUTTONS (Admin Actions)
        // ==========================================
        if (interaction.isButton()) {
            
            // --- A. CLAIM SUPPORT TICKET ---
            if (interaction.customId === 'claim_ticket') {
                if (!interaction.member.permissions.has(PermissionsBitField.Flags.ManageChannels)) return interaction.reply({ content: '❌ Only staff can claim tickets!', ephemeral: true }).catch(() => {});
                
                const embed = EmbedBuilder.from(interaction.message.embeds[0]).setColor('Yellow').addFields({ name: 'Assigned To:', value: `<@${interaction.user.id}>` });
                const row = ActionRowBuilder.from(interaction.message.components[0]);
                row.components[0].setDisabled(true);

                await interaction.channel.setName(`claimed-${interaction.channel.name.split('-')[1]}`).catch(() => {});
                await interaction.update({ embeds: [embed], components: [row] }).catch(() => {});
                await interaction.channel.send(`✋ This ticket has been claimed by **${interaction.user.username}**!`).catch(() => {});
            }

            // --- B. CLOSE SUPPORT TICKET ---
            if (interaction.customId === 'close_ticket') {
                if (!interaction.member.permissions.has(PermissionsBitField.Flags.ManageChannels)) return interaction.reply({ content: '❌ Only staff can close tickets!', ephemeral: true }).catch(() => {});
                
                const targetUserId = interaction.channel.topic;
                if (targetUserId) await interaction.channel.permissionOverwrites.edit(targetUserId, { ViewChannel: false }).catch(() => {});
                await interaction.channel.setName(`closed-${interaction.channel.name.split('-')[1] || 'ticket'}`).catch(() => {});

                const embed = new EmbedBuilder().setColor('Red').setTitle('🔒 Ticket Closed').setDescription(`Closed by <@${interaction.user.id}>.`);
                const adminButtons = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId('transcript_ticket').setLabel('📝 Generate Transcript').setStyle(ButtonStyle.Primary),
                    new ButtonBuilder().setCustomId('delete_ticket').setLabel('🗑️ Delete Channel').setStyle(ButtonStyle.Danger)
                );

                const disabledRow = ActionRowBuilder.from(interaction.message.components[0]);
                disabledRow.components.forEach(c => c.setDisabled(true));
                
                await interaction.update({ components: [disabledRow] }).catch(() => {});
                await interaction.channel.send({ embeds: [embed], components: [adminButtons] }).catch(() => {});
            }

            // --- C. TRANSCRIPT & DELETE SUPPORT TICKET ---
            if (interaction.customId === 'transcript_ticket') {
                if (!interaction.member.permissions.has(PermissionsBitField.Flags.ManageChannels)) return;
                await interaction.deferReply().catch(() => {});
                const messages = await interaction.channel.messages.fetch({ limit: 100 }).catch(() => null);
                if (!messages) return interaction.editReply('❌ Failed to fetch messages.').catch(() => {});

                let transcriptText = `--- Transcript for ${interaction.channel.name} ---\n\n`;
                messages.reverse().forEach(msg => {
                    const time = new Date(msg.createdTimestamp).toLocaleString();
                    transcriptText += `[${time}] ${msg.author.tag}: ${msg.content || '[Attachment/Embed]'}\n`;
                });

                const attachment = new AttachmentBuilder(Buffer.from(transcriptText, 'utf-8'), { name: `${interaction.channel.name}-transcript.txt` });
                await interaction.editReply({ content: '✅ Transcript generated!', files: [attachment] }).catch(() => {});
            }

            if (interaction.customId === 'delete_ticket') {
                if (!interaction.member.permissions.has(PermissionsBitField.Flags.ManageChannels)) return;
                await interaction.reply({ content: '🗑️ Deleting channel in 5 seconds...' }).catch(() => {});
                setTimeout(() => interaction.channel.delete().catch(() => {}), 5000);
            }

            // --- D. ACCEPT OR REJECT APPLICATION ---
            if (interaction.customId === 'app_accept' || interaction.customId === 'app_reject') {
                if (!interaction.member.permissions.has(PermissionsBitField.Flags.ManageChannels)) return interaction.reply({ content: '❌ Only admins can make this decision!', ephemeral: true }).catch(() => {});

                const isAccepted = interaction.customId === 'app_accept';
                const targetUserId = interaction.channel.topic; 
                const statusColor = isAccepted ? 'Green' : 'Red';
                const statusText = isAccepted ? 'ACCEPTED ✅' : 'REJECTED ❌';

                if (targetUserId) {
                    try {
                        const targetUser = await client.users.fetch(targetUserId);
                        const dmEmbed = new EmbedBuilder().setColor(statusColor).setTitle('Application Update').setDescription(`Your application in **${interaction.guild.name}** has been **${statusText}** by <@${interaction.user.id}>!`);
                        await targetUser.send({ embeds: [dmEmbed] }).catch(() => {});
                    } catch (e) {}
                }

                const updateEmbed = EmbedBuilder.from(interaction.message.embeds[0]).setColor(statusColor).setTitle(`📝 Application ${statusText}`);
                const disabledRow = ActionRowBuilder.from(interaction.message.components[0]);
                disabledRow.components.forEach(c => c.setDisabled(true));

                await interaction.update({ embeds: [updateEmbed], components: [disabledRow] }).catch(() => {});
                await interaction.channel.send(`This application was **${statusText}**.\n\n*Channel auto-deleting in 15 seconds.*`).catch(() => {});
                setTimeout(() => interaction.channel.delete().catch(() => {}), 15000);
            }
        }
    });
};
