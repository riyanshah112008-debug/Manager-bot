const { 
    EmbedBuilder, 
    ActionRowBuilder, 
    ButtonBuilder, 
    ButtonStyle, 
    ChannelType, 
    PermissionsBitField, 
    AttachmentBuilder, 
    ModalBuilder, 
    TextInputBuilder, 
    TextInputStyle 
} = require('discord.js');

module.exports = (client) => {
    // Helper: Check if member is Staff or Admin
    const isStaff = (member) => {
        if (!member) return false;
        return member.permissions.has(PermissionsBitField.Flags.ManageChannels) ||
               member.permissions.has(PermissionsBitField.Flags.Administrator) ||
               member.roles.cache.some(r => ['staff', 'moderator', 'admin', 'support'].includes(r.name.toLowerCase()));
    };

    client.on('interactionCreate', async (interaction) => {
        // ==========================================
        // 1. SLASH COMMANDS SETUP
        // ==========================================
        if (interaction.isChatInputCommand()) {
            if (interaction.commandName === 'ticketsetup') {
                if (!isStaff(interaction.member)) {
                    return interaction.reply({ content: '❌ You lack permissions to set up the ticket panel.', ephemeral: true });
                }

                const embed = new EmbedBuilder()
                    .setColor('#00F2FE')
                    .setTitle('🎫 Support & Application Portal')
                    .setDescription('Need assistance or want to join our team? Click a button below to get started!')
                    .addFields(
                        { name: '📩 Support Ticket', value: 'Opens a private channel with server staff.', inline: false },
                        { name: '📝 Staff Application', value: 'Opens an interactive application form.', inline: false }
                    )
                    .setFooter({ text: 'Starry Ticket Engine • Select an option below' });

                const buttons = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId('create_ticket').setLabel('Open Support Ticket').setStyle(ButtonStyle.Primary).setEmoji('📩'),
                    new ButtonBuilder().setCustomId('apply_staff').setLabel('Apply for Staff').setStyle(ButtonStyle.Success).setEmoji('📝')
                );

                await interaction.reply({ content: '✅ Ticket setup panel created!', ephemeral: true });
                await interaction.channel.send({ embeds: [embed], components: [buttons] });
            }

            if (interaction.commandName === 'applysetup') {
                if (!isStaff(interaction.member)) {
                    return interaction.reply({ content: '❌ You lack permissions to set up the application panel.', ephemeral: true });
                }

                const embed = new EmbedBuilder()
                    .setColor('#FFD700')
                    .setTitle('📋 Server Applications')
                    .setDescription('We are looking for new staff and partners!\n\nChoose an option below to apply.')
                    .setFooter({ text: 'Starry Application Engine' });

                const buttons = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId('apply_staff').setLabel('🛡️ Apply for Staff').setStyle(ButtonStyle.Primary),
                    new ButtonBuilder().setCustomId('apply_partner').setLabel('🤝 Request Partnership').setStyle(ButtonStyle.Success)
                );

                await interaction.reply({ content: '✅ Application Dashboard created!', ephemeral: true });
                await interaction.channel.send({ embeds: [embed], components: [buttons] });
            }
        }

        // ==========================================
        // 2. BUTTON INTERACTIONS
        // ==========================================
        if (interaction.isButton()) {
            // Premium Check Fail-Safe
            if (['create_ticket', 'apply_staff', 'apply_partner'].includes(interaction.customId)) {
                if (client.isPremium && typeof client.isPremium === 'function' && !client.isPremium(interaction.guildId)) {
                    return interaction.reply({ content: '❌ **Tickets/Applications are a Premium feature!** Use `.premium` to upgrade.', ephemeral: true });
                }
            }

            // --------------------------------------
            // 📩 CREATE TICKET
            // --------------------------------------
            if (interaction.customId === 'create_ticket') {
                const guild = interaction.guild;
                const user = interaction.user;

                // Check for existing open ticket
                const existingChannel = guild.channels.cache.find(c => c.topic === user.id && c.name.startsWith('ticket-'));
                if (existingChannel) {
                    return interaction.reply({ content: `❌ You already have an open ticket in <#${existingChannel.id}>!`, ephemeral: true });
                }

                let supportCategory = guild.channels.cache.find(c => c.type === ChannelType.GuildCategory && c.name.toLowerCase().includes('support'));
                let staffRole = guild.roles.cache.find(r => ['staff', 'moderator', 'admin'].includes(r.name.toLowerCase()));

                const ticketChannel = await guild.channels.create({
                    name: `ticket-${user.username.toLowerCase()}`,
                    type: ChannelType.GuildText,
                    topic: user.id,
                    parent: supportCategory ? supportCategory.id : null,
                    permissionOverwrites: [
                        { id: guild.roles.everyone.id, deny: [PermissionsBitField.Flags.ViewChannel] },
                        { id: user.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.AttachFiles] },
                        { id: client.user.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.ManageChannels] },
                        ...(staffRole ? [{ id: staffRole.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] }] : [])
                    ]
                });

                const ticketEmbed = new EmbedBuilder()
                    .setColor('#00F2FE')
                    .setTitle(`🎫 Ticket Opened | ${user.username}`)
                    .setDescription(`Welcome <@${user.id}>! Please explain your issue in detail below.\n\nOur staff team will assist you shortly.`)
                    .addFields({ name: '📌 Status', value: '`UNCLAIMED 🟡`', inline: true })
                    .setTimestamp();

                const actionRow = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId('claim_ticket').setLabel('Claim Ticket').setStyle(ButtonStyle.Success).setEmoji('✋'),
                    new ButtonBuilder().setCustomId('close_ticket').setLabel('Close Ticket').setStyle(ButtonStyle.Danger).setEmoji('🔒')
                );

                await ticketChannel.send({ content: `<@${user.id}> ${staffRole ? `<@&${staffRole.id}>` : ''}`, embeds: [ticketEmbed], components: [actionRow] });
                await interaction.reply({ content: `✅ Ticket created: <#${ticketChannel.id}>`, ephemeral: true });
            }

            // --------------------------------------
            // ✋ CLAIM TICKET (STAFF ONLY)
            // --------------------------------------
            if (interaction.customId === 'claim_ticket') {
                if (!isStaff(interaction.member)) {
                    return interaction.reply({ content: '❌ Only staff members can claim tickets.', ephemeral: true });
                }

                await interaction.deferUpdate();

                const channel = interaction.channel;
                const staffMember = interaction.user;

                // Rename channel to claimed
                const cleanName = channel.name.replace('ticket-', '').replace('claimed-', '');
                await channel.setName(`claimed-${cleanName}`).catch(() => {});

                // Grant explicit Manage Channels permission to claiming staff member
                await channel.permissionOverwrites.edit(staffMember.id, {
                    ViewChannel: true,
                    SendMessages: true,
                    ManageChannels: true
                }).catch(() => {});

                const claimedEmbed = new EmbedBuilder()
                    .setColor('#2ecc71')
                    .setTitle('✋ Ticket Claimed')
                    .setDescription(`This ticket is now handled by <@${staffMember.id}>.`)
                    .setTimestamp();

                const updatedRow = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId('claim_ticket').setLabel(`Claimed by ${staffMember.username}`).setStyle(ButtonStyle.Secondary).setDisabled(true).setEmoji('✅'),
                    new ButtonBuilder().setCustomId('close_ticket').setLabel('Close Ticket').setStyle(ButtonStyle.Danger).setEmoji('🔒')
                );

                await interaction.editReply({ components: [updatedRow] });
                await channel.send({ embeds: [claimedEmbed] });
            }

            // --------------------------------------
            // 🔒 CLOSE TICKET
            // --------------------------------------
            if (interaction.customId === 'close_ticket') {
                if (!isStaff(interaction.member) && interaction.user.id !== interaction.channel.topic) {
                    return interaction.reply({ content: '❌ Only staff or the ticket owner can close this ticket.', ephemeral: true });
                }

                await interaction.deferUpdate();

                const channel = interaction.channel;
                const ticketOwnerId = channel.topic;

                // Revoke send permissions for ticket opener
                if (ticketOwnerId) {
                    await channel.permissionOverwrites.edit(ticketOwnerId, { SendMessages: false }).catch(() => {});
                }

                const closedEmbed = new EmbedBuilder()
                    .setColor('#ED4245')
                    .setTitle('🔒 Ticket Closed')
                    .setDescription(`Ticket closed by <@${interaction.user.id}>.\nUse the options below to generate a transcript or delete this ticket.`)
                    .setTimestamp();

                const managementRow = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId('transcript_ticket').setLabel('Save Transcript').setStyle(ButtonStyle.Primary).setEmoji('📝'),
                    new ButtonBuilder().setCustomId('delete_ticket').setLabel('Delete Ticket').setStyle(ButtonStyle.Danger).setEmoji('🗑️')
                );

                await interaction.editReply({ components: [] });
                await channel.send({ embeds: [closedEmbed], components: [managementRow] });
            }

            // --------------------------------------
            // 📝 GENERATE TRANSCRIPT
            // --------------------------------------
            if (interaction.customId === 'transcript_ticket') {
                await interaction.deferReply();

                try {
                    const channel = interaction.channel;
                    const messages = await channel.messages.fetch({ limit: 100 });
                    
                    let transcriptContent = `==================================================\n`;
                    transcriptContent += `TICKET TRANSCRIPT: #${channel.name}\n`;
                    transcriptContent += `SERVER: ${interaction.guild.name}\n`;
                    transcriptContent += `GENERATED BY: ${interaction.user.tag} (${interaction.user.id})\n`;
                    transcriptContent += `DATE: ${new Date().toLocaleString()}\n`;
                    transcriptContent += `==================================================\n\n`;

                    const sortedMessages = Array.from(messages.values()).reverse();

                    for (const msg of sortedMessages) {
                        const time = new Date(msg.createdTimestamp).toLocaleString();
                        const author = `${msg.author.tag} (${msg.author.id})`;
                        let content = msg.content || '[No Text Content]';

                        if (msg.attachments.size > 0) {
                            const attachments = msg.attachments.map(a => a.url).join(', ');
                            content += ` [Attachments: ${attachments}]`;
                        }

                        if (msg.embeds.length > 0) {
                            content += ` [Embedded Message Content]`;
                        }

                        transcriptContent += `[${time}] ${author}:\n${content}\n--------------------------------------------------\n`;
                    }

                    const attachment = new AttachmentBuilder(Buffer.from(transcriptContent, 'utf-8'), { name: `transcript-${channel.name}.txt` });

                    const transcriptEmbed = new EmbedBuilder()
                        .setColor('#5865F2')
                        .setTitle('📝 Ticket Transcript Generated')
                        .setDescription(`Transcript saved for **#${channel.name}**.`)
                        .setTimestamp();

                    await interaction.editReply({ embeds: [transcriptEmbed], files: [attachment] });
                } catch (err) {
                    console.error('Transcript Error:', err);
                    await interaction.editReply({ content: '❌ Failed to generate transcript.' });
                }
            }

            // --------------------------------------
            // 🗑️ MANUALLY DELETE TICKET
            // --------------------------------------
            if (interaction.customId === 'delete_ticket') {
                if (!isStaff(interaction.member)) {
                    return interaction.reply({ content: '❌ Only staff members can delete tickets.', ephemeral: true });
                }

                await interaction.reply('🗑️ Deleting ticket in **5 seconds**...');
                setTimeout(() => {
                    interaction.channel.delete().catch(() => {});
                }, 5000);
            }

            // --------------------------------------
            // 📝 APPLICATIONS MODALS LAUNCH
            // --------------------------------------
            if (interaction.customId === 'apply_staff' || interaction.customId === 'apply_partner') {
                const isStaffApp = interaction.customId === 'apply_staff';
                const modal = new ModalBuilder()
                    .setCustomId(isStaffApp ? 'modal_staff' : 'modal_partner')
                    .setTitle(isStaffApp ? '🛡️ Staff Application' : '🤝 Partnership Application');

                modal.addComponents(
                    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('q1').setLabel('Age & Timezone').setStyle(TextInputStyle.Short).setRequired(true)),
                    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('q2').setLabel('Previous Experience').setStyle(TextInputStyle.Paragraph).setRequired(true)),
                    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('q3').setLabel('Why should we pick you?').setStyle(TextInputStyle.Paragraph).setRequired(true))
                );

                await interaction.showModal(modal);
            }

            // --------------------------------------
            // ✅ / ❌ ACCEPT OR REJECT APPLICATION
            // --------------------------------------
            if (['app_accept', 'app_reject'].includes(interaction.customId)) {
                if (!isStaff(interaction.member)) {
                    return interaction.reply({ content: '❌ Staff permissions required.', ephemeral: true });
                }

                const isAccepted = interaction.customId === 'app_accept';
                const applicantId = interaction.channel.topic;
                const targetUser = await client.users.fetch(applicantId).catch(() => null);

                if (targetUser) {
                    const dmEmbed = new EmbedBuilder()
                        .setColor(isAccepted ? '#2ecc71' : '#ED4245')
                        .setTitle(`Application ${isAccepted ? 'Accepted ✅' : 'Rejected ❌'}`)
                        .setDescription(`Your application for **${interaction.guild.name}** has been **${isAccepted ? 'ACCEPTED' : 'REJECTED'}**.`)
                        .setTimestamp();

                    await targetUser.send({ embeds: [dmEmbed] }).catch(() => {});
                }

                await interaction.reply(`Application ${isAccepted ? '✅ accepted' : '❌ rejected'}. Deleting channel in **5 seconds**...`);
                setTimeout(() => interaction.channel.delete().catch(() => {}), 5000);
            }
        }

        // ==========================================
        // 3. MODAL SUBMISSIONS
        // ==========================================
        if (interaction.isModalSubmit()) {
            const validModals = ['modal_staff', 'modal_partner'];
            if (!validModals.includes(interaction.customId)) return;

            const isStaffApp = interaction.customId === 'modal_staff';
            const user = interaction.user;

            let logChannel = interaction.guild.channels.cache.find(c => c.name.includes('app-logs') || c.name.includes('staff-logs'));
            
            const appChannel = await interaction.guild.channels.create({
                name: `app-${user.username.toLowerCase()}`,
                type: ChannelType.GuildText,
                topic: user.id,
                permissionOverwrites: [
                    { id: interaction.guild.id, deny: [PermissionsBitField.Flags.ViewChannel] },
                    { id: client.user.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.ManageChannels] }
                ]
            });

            const embed = new EmbedBuilder()
                .setColor(isStaffApp ? '#2ecc71' : '#FFD700')
                .setTitle(`📝 New ${isStaffApp ? 'Staff' : 'Partner'} Application | ${user.username}`)
                .addFields(
                    { name: '👤 Applicant', value: `<@${user.id}> (\`${user.id}\`)`, inline: true },
                    { name: '📌 Age & Timezone', value: interaction.fields.getTextInputValue('q1') },
                    { name: '📜 Experience', value: interaction.fields.getTextInputValue('q2') },
                    { name: '💡 Reason', value: interaction.fields.getTextInputValue('q3') }
                )
                .setTimestamp();

            const actionRow = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('app_accept').setLabel('Accept').setStyle(ButtonStyle.Success).setEmoji('✅'),
                new ButtonBuilder().setCustomId('app_reject').setLabel('Reject').setStyle(ButtonStyle.Danger).setEmoji('❌')
            );

            await appChannel.send({ embeds: [embed], components: [actionRow] });
            if (logChannel) await logChannel.send({ embeds: [embed] }).catch(() => {});

            await interaction.reply({ content: `✅ Your application has been submitted! Staff will review it shortly in <#${appChannel.id}>.`, ephemeral: true });
        }
    });
};
