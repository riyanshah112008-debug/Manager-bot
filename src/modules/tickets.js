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

    // Helper: Get or Create Ticket Categories
    async function getOrCreateTicketCategory(guild, name) {
        let cat = guild.channels.cache.find(c => c.type === ChannelType.GuildCategory && c.name.toLowerCase() === name.toLowerCase());
        if (!cat) {
            cat = await guild.channels.create({
                name: name,
                type: ChannelType.GuildCategory
            }).catch(() => null);
        }
        return cat;
    }

    client.on('interactionCreate', async (interaction) => {
        // ==========================================
        // 1. SLASH COMMANDS SETUP (/ticketsetup & /applysetup)
        // ==========================================
        if (interaction.isChatInputCommand()) {
            if (interaction.commandName === 'ticketsetup') {
                if (!isStaff(interaction.member)) {
                    return interaction.reply({ content: '❌ You lack permissions to set up the ticket panel.', ephemeral: true });
                }

                const embed = new EmbedBuilder()
                    .setColor('#00F2FE')
                    .setTitle('🎫 Support & Application Portal')
                    .setDescription('• **Open Support Ticket:** Opens a private communication channel with staff.\n• **Apply for Staff:** Opens an interactive form to apply for moderator positions.')
                    .setFooter({ text: 'Starry Support Engine' });

                const buttons = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId('sys_create_ticket').setLabel('Open Support Ticket').setStyle(ButtonStyle.Primary).setEmoji('📩'),
                    new ButtonBuilder().setCustomId('sys_apply_staff').setLabel('Apply for Staff').setStyle(ButtonStyle.Success).setEmoji('📝')
                );

                await interaction.reply({ content: '✅ Ticket system panel created!', ephemeral: true });
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
                    new ButtonBuilder().setCustomId('sys_apply_staff').setLabel('🛡️ Apply for Staff').setStyle(ButtonStyle.Primary),
                    new ButtonBuilder().setCustomId('sys_apply_partner').setLabel('🤝 Request Partnership').setStyle(ButtonStyle.Success)
                );

                await interaction.reply({ content: '✅ Application Dashboard created!', ephemeral: true });
                await interaction.channel.send({ embeds: [embed], components: [buttons] });
            }
        }

        // ==========================================
        // 2. BUTTON INTERACTIONS
        // ==========================================
        if (interaction.isButton()) {
            // 📩 CREATE TICKET
            if (interaction.customId === 'sys_create_ticket' || interaction.customId === 'create_ticket') {
                const guild = interaction.guild;
                const user = interaction.user;

                const existingChannel = guild.channels.cache.find(c => c.topic === user.id && c.name.includes('ticket-'));
                if (existingChannel) {
                    return interaction.reply({ content: `❌ You already have an open ticket in <#${existingChannel.id}>!`, ephemeral: true });
                }

                // Automatically get or create the "OPENED TICKETS" category
                const openedCategory = await getOrCreateTicketCategory(guild, 'OPENED TICKETS');
                let staffRole = guild.roles.cache.find(r => ['staff', 'moderator', 'admin'].includes(r.name.toLowerCase()));

                const ticketChannel = await guild.channels.create({
                    name: `ticket-${user.username.toLowerCase()}`,
                    type: ChannelType.GuildText,
                    topic: user.id,
                    parent: openedCategory ? openedCategory.id : null,
                    permissionOverwrites: [
                        { id: guild.roles.everyone.id, deny: [PermissionsBitField.Flags.ViewChannel] },
                        { id: user.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.AttachFiles] },
                        { id: client.user.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.ManageChannels] },
                        ...(staffRole ? [{ id: staffRole.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] }] : [])
                    ]
                });

                const ticketEmbed = new EmbedBuilder()
                    .setColor('#00F2FE')
                    .setTitle(`🎫 Support Ticket | ${user.username}`)
                    .setDescription(`Hello <@${user.id}>! Staff has been notified and will assist you shortly.\n\nPlease describe your issue or inquiry in detail below.`)
                    .addFields({ name: '📌 Status', value: '`UNCLAIMED 🟡`', inline: true })
                    .setTimestamp();

                // Initial embed includes both Claim and Close buttons for staff/users
                const actionRow = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId('sys_claim_ticket').setLabel('Claim Ticket').setStyle(ButtonStyle.Success).setEmoji('✋'),
                    new ButtonBuilder().setCustomId('sys_close_ticket').setLabel('Close Ticket').setStyle(ButtonStyle.Danger).setEmoji('🔒')
                );

                await ticketChannel.send({ content: `<@${user.id}> ${staffRole ? `<@&${staffRole.id}>` : ''}`, embeds: [ticketEmbed], components: [actionRow] });
                await interaction.reply({ content: `✅ Ticket created: <#${ticketChannel.id}>`, ephemeral: true });
            }

            // ✋ CLAIM TICKET (STAFF ONLY)
            if (interaction.customId === 'sys_claim_ticket' || interaction.customId === 'claim_ticket') {
                if (!isStaff(interaction.member)) {
                    return interaction.reply({ content: '❌ Only staff members can claim tickets.', ephemeral: true });
                }

                await interaction.deferUpdate();

                const channel = interaction.channel;
                const staffMember = interaction.user;

                const cleanName = channel.name.replace('ticket-', '').replace('claimed-', '');
                await channel.setName(`claimed-${cleanName}`).catch(() => {});

                await channel.permissionOverwrites.edit(staffMember.id, {
                    ViewChannel: true,
                    SendMessages: true,
                    ManageChannels: true
                }).catch(() => {});

                const claimedEmbed = new EmbedBuilder()
                    .setColor('#2ecc71')
                    .setTitle('✋ Ticket Claimed')
                    .setDescription(`This ticket is now being handled by <@${staffMember.id}>.`)
                    .setTimestamp();

                const updatedRow = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId('sys_claim_ticket').setLabel(`Claimed by ${staffMember.username}`).setStyle(ButtonStyle.Secondary).setDisabled(true).setEmoji('✅'),
                    new ButtonBuilder().setCustomId('sys_close_ticket').setLabel('Close Ticket').setStyle(ButtonStyle.Danger).setEmoji('🔒')
                );

                await interaction.editReply({ components: [updatedRow] });
                await channel.send({ embeds: [claimedEmbed] });
            }

            // 🔒 CLOSE TICKET (MOVES TO CLOSED TICKETS CATEGORY)
            if (interaction.customId === 'sys_close_ticket' || interaction.customId === 'close_ticket') {
                await interaction.deferUpdate().catch(() => {});

                const channel = interaction.channel;
                const guild = interaction.guild;
                const ticketOwnerId = channel.topic;

                // Move channel to "CLOSED TICKETS" category
                const closedCategory = await getOrCreateTicketCategory(guild, 'CLOSED TICKETS');
                if (closedCategory) {
                    await channel.setParent(closedCategory.id).catch(() => {});
                }

                if (ticketOwnerId) {
                    await channel.permissionOverwrites.edit(ticketOwnerId, { SendMessages: false }).catch(() => {});
                }

                const closedEmbed = new EmbedBuilder()
                    .setColor('#ED4245')
                    .setTitle('🔒 Ticket Closed')
                    .setDescription(`Ticket closed by <@${interaction.user.id}>.\nMoved to **CLOSED TICKETS**. Use the options below to save a transcript or delete this channel manually.`)
                    .setTimestamp();

                const managementRow = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId('sys_transcript_ticket').setLabel('Save Transcript').setStyle(ButtonStyle.Primary).setEmoji('📝'),
                    new ButtonBuilder().setCustomId('sys_delete_ticket').setLabel('Delete Ticket').setStyle(ButtonStyle.Danger).setEmoji('🗑️')
                );

                await channel.send({ embeds: [closedEmbed], components: [managementRow] });
            }

            // 📝 SAVE TRANSCRIPT
            if (interaction.customId === 'sys_transcript_ticket' || interaction.customId === 'transcript_ticket') {
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

            // 🗑️ MANUALLY DELETE TICKET (NO AUTOMATIC TIMERS)
            if (interaction.customId === 'sys_delete_ticket' || interaction.customId === 'delete_ticket') {
                if (!isStaff(interaction.member)) {
                    return interaction.reply({ content: '❌ Only staff members can delete tickets.', ephemeral: true });
                }

                // Deletes channel immediately upon click without delays
                await interaction.channel.delete().catch(() => {});
            }

            // 📝 STAFF & PARTNER APPLICATIONS
            if (interaction.customId === 'sys_apply_staff' || interaction.customId === 'apply_staff' || interaction.customId === 'sys_apply_partner' || interaction.customId === 'apply_partner') {
                const isStaffApp = interaction.customId.includes('staff');
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

            // ✅ / ❌ ACCEPT OR REJECT APPLICATION
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

                await interaction.channel.delete().catch(() => {});
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
