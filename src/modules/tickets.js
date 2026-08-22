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
    TextInputStyle,
    MessageFlags
} = require('discord.js');

const EPHEMERAL_FLAG = MessageFlags ? MessageFlags.Ephemeral : 6;

module.exports = (client) => {
    // Helper: Strict Staff Check
    const isStaff = (member) => {
        if (!member) return false;
        return member.permissions.has(PermissionsBitField.Flags.ManageChannels) ||
               member.permissions.has(PermissionsBitField.Flags.Administrator) ||
               member.roles.cache.some(r => ['staff', 'moderator', 'admin', 'support'].includes(r.name.toLowerCase()));
    };

    // Helper: Build Master 3-Option Action Row
    function getMasterPortalRow() {
        return new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('sys_create_ticket').setLabel('Open Support Ticket').setStyle(ButtonStyle.Primary).setEmoji('📩'),
            new ButtonBuilder().setCustomId('sys_apply_staff').setLabel('Apply for Staff').setStyle(ButtonStyle.Success).setEmoji('🛡️'),
            new ButtonBuilder().setCustomId('sys_apply_partner').setLabel('Request Partnership').setStyle(ButtonStyle.Secondary).setEmoji('🤝')
        );
    }

    // Helper: Ensures categories exist with proper permissions
    async function getOrCreateTicketCategory(guild, name) {
        try {
            const channels = await guild.channels.fetch().catch(() => guild.channels.cache);
            let cat = channels.find(c => c && c.type === ChannelType.GuildCategory && c.name.toUpperCase() === name.toUpperCase());
            let staffRole = guild.roles.cache.find(r => ['staff', 'moderator', 'admin'].includes(r.name.toLowerCase()));

            const categoryPermissions = [
                { 
                    id: guild.roles.everyone.id, 
                    allow: [PermissionsBitField.Flags.ViewChannel], 
                    deny: [PermissionsBitField.Flags.SendMessages] 
                },
                { 
                    id: client.user.id, 
                    allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.ManageChannels, PermissionsBitField.Flags.SendMessages] 
                },
                ...(staffRole ? [{ id: staffRole.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] }] : [])
            ];

            if (!cat) {
                cat = await guild.channels.create({
                    name: name.toUpperCase(),
                    type: ChannelType.GuildCategory,
                    permissionOverwrites: categoryPermissions
                });
            }
            return cat;
        } catch (err) {
            console.error(`❌ Category Creation Error (${name}):`, err);
            return null;
        }
    }

    client.on('interactionCreate', async (interaction) => {
        // ==========================================
        // 1. SLASH COMMANDS
        // ==========================================
        if (interaction.isChatInputCommand()) {
            if (['ticketsetup', 'applysetup', 'portalsetup'].includes(interaction.commandName)) {
                if (!isStaff(interaction.member)) {
                    return interaction.reply({ content: '❌ You lack permissions to set up the portal panel.', flags: [EPHEMERAL_FLAG] });
                }

                const embed = new EmbedBuilder()
                    .setColor('#00F2FE')
                    .setTitle('🎫 Support, Staff & Partnership Portal')
                    .setDescription(
                        'Welcome to our server portal! Please select an option below:\n\n' +
                        '• **📩 Open Support Ticket:** Opens a private communication channel with staff.\n' +
                        '• **🛡️ Apply for Staff:** Submit an application for staff & moderator positions.\n' +
                        '• **🤝 Request Partnership:** Submit server details for partner cross-promotion.'
                    )
                    .setFooter({ text: 'Starry Master Portal Engine' });

                await interaction.reply({ content: '✅ Master 3-in-1 portal panel deployed!', flags: [EPHEMERAL_FLAG] });
                return interaction.channel.send({ embeds: [embed], components: [getMasterPortalRow()] });
            }
        }
                // ==========================================
        // 2. TICKET BUTTON INTERACTIONS
        // ==========================================
        if (interaction.isButton()) {
            const customId = interaction.customId;

            // 📩 CREATE SUPPORT TICKET
            if (['sys_create_ticket', 'create_ticket'].includes(customId)) {
                try {
                    if (!interaction.deferred && !interaction.replied) {
                        await interaction.deferReply({ flags: [EPHEMERAL_FLAG] });
                    }

                    const guild = interaction.guild;
                    const user = interaction.user;
                    const openedCategory = await getOrCreateTicketCategory(guild, 'OPENED TICKETS');
                    let staffRole = guild.roles.cache.find(r => ['staff', 'moderator', 'admin'].includes(r.name.toLowerCase()));

                    const ticketNum = Math.floor(1000 + Math.random() * 9000);
                    const cleanUsername = user.username.toLowerCase().replace(/[^a-z0-9]/g, '');

                    const ticketChannel = await guild.channels.create({
                        name: `ticket-${cleanUsername}-${ticketNum}`,
                        type: ChannelType.GuildText,
                        topic: user.id,
                        parent: openedCategory ? openedCategory.id : undefined,
                        permissionOverwrites: [
                            { id: guild.roles.everyone.id, deny: [PermissionsBitField.Flags.ViewChannel] },
                            { 
                                id: user.id, 
                                allow: [
                                    PermissionsBitField.Flags.ViewChannel, 
                                    PermissionsBitField.Flags.SendMessages, 
                                    PermissionsBitField.Flags.ReadMessageHistory,
                                    PermissionsBitField.Flags.AttachFiles,
                                    PermissionsBitField.Flags.EmbedLinks
                                ] 
                            },
                            { 
                                id: client.user.id, 
                                allow: [
                                    PermissionsBitField.Flags.ViewChannel, 
                                    PermissionsBitField.Flags.SendMessages, 
                                    PermissionsBitField.Flags.ManageChannels,
                                    PermissionsBitField.Flags.ReadMessageHistory
                                ] 
                            },
                            ...(staffRole ? [{ id: staffRole.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ReadMessageHistory] }] : [])
                        ]
                    });

                    const ticketEmbed = new EmbedBuilder()
                        .setColor('#00F2FE')
                        .setTitle(`🎫 Support Ticket #${ticketNum} | ${user.username}`)
                        .setDescription(`Hello <@${user.id}>! Staff has been notified and will assist you shortly.\n\nPlease describe your inquiry in detail.`)
                        .addFields({ name: '📌 Status', value: '`UNCLAIMED 🟡`', inline: true })
                        .setTimestamp();

                    const actionRow = new ActionRowBuilder().addComponents(
                        new ButtonBuilder().setCustomId('sys_claim_ticket').setLabel('Claim Ticket').setStyle(ButtonStyle.Success).setEmoji('✋'),
                        new ButtonBuilder().setCustomId('sys_close_ticket').setLabel('Close Ticket').setStyle(ButtonStyle.Danger).setEmoji('🔒')
                    );

                    await ticketChannel.send({ content: `<@${user.id}> ${staffRole ? `<@&${staffRole.id}>` : ''}`, embeds: [ticketEmbed], components: [actionRow] });
                    return interaction.editReply({ content: `✅ Ticket created: <#${ticketChannel.id}>` });
                } catch (err) {
                    console.error('Error creating ticket:', err);
                    if (interaction.deferred || interaction.replied) {
                        return interaction.editReply({ content: '❌ Failed to create ticket due to missing bot permissions.' }).catch(() => {});
                    }
                }
            }

            // ✋ CLAIM TICKET
            if (['sys_claim_ticket', 'claim_ticket'].includes(customId)) {
                if (!isStaff(interaction.member)) {
                    return interaction.reply({ content: '❌ Only staff members can claim tickets.', flags: [EPHEMERAL_FLAG] });
                }

                await interaction.deferUpdate().catch(() => {});
                const channel = interaction.channel;
                const staffMember = interaction.user;

                const cleanName = channel.name.replace('ticket-', '').replace('claimed-', '');
                await channel.setName(`claimed-${cleanName}`).catch(() => {});

                const claimedEmbed = new EmbedBuilder()
                    .setColor('#2ecc71')
                    .setTitle('✋ Ticket Claimed')
                    .setDescription(`This ticket is now handled by <@${staffMember.id}>.`)
                    .setTimestamp();

                const updatedRow = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId('sys_claim_ticket').setLabel(`Claimed by ${staffMember.username}`).setStyle(ButtonStyle.Secondary).setDisabled(true).setEmoji('✅'),
                    new ButtonBuilder().setCustomId('sys_close_ticket').setLabel('Close Ticket').setStyle(ButtonStyle.Danger).setEmoji('🔒')
                );

                await interaction.editReply({ components: [updatedRow] }).catch(() => {});
                await channel.send({ embeds: [claimedEmbed] }).catch(() => {});
                return;
            }

            // 🔒 CLOSE TICKET
            if (['sys_close_ticket', 'close_ticket'].includes(customId)) {
                if (!isStaff(interaction.member)) {
                    return interaction.reply({ content: '❌ Only staff members can close tickets.', flags: [EPHEMERAL_FLAG] });
                }

                const channel = interaction.channel;
                if (channel.name.startsWith('closed-')) {
                    return interaction.reply({ content: '❌ This ticket is already closed!', flags: [EPHEMERAL_FLAG] });
                }

                await interaction.deferUpdate().catch(() => {});
                const ticketOwnerId = channel.topic;
                const cleanName = channel.name.replace('ticket-', '').replace('claimed-', '');
                await channel.setName(`closed-${cleanName}`).catch(() => {});

                const closedCategory = await getOrCreateTicketCategory(interaction.guild, 'CLOSED TICKETS');
                if (closedCategory) await channel.setParent(closedCategory.id, { lockPermissions: false }).catch(() => {});
                if (ticketOwnerId) await channel.permissionOverwrites.edit(ticketOwnerId, { SendMessages: false }).catch(() => {});

                const closedEmbed = new EmbedBuilder()
                    .setColor('#ED4245')
                    .setTitle('🔒 Ticket Closed')
                    .setDescription(`Ticket closed by <@${interaction.user.id}>.\nUse the options below to save a transcript or delete the channel.`)
                    .setTimestamp();

                const managementRow = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId('sys_transcript_ticket').setLabel('Save Transcript').setStyle(ButtonStyle.Primary).setEmoji('📝'),
                    new ButtonBuilder().setCustomId('sys_delete_ticket').setLabel('Delete Ticket').setStyle(ButtonStyle.Danger).setEmoji('🗑️')
                );

                await channel.send({ embeds: [closedEmbed], components: [managementRow] });
                return;
            }

            // 📝 TRANSCRIPT & DELETE
            if (['sys_transcript_ticket', 'transcript_ticket'].includes(customId)) {
                await interaction.deferReply();
                const messages = await interaction.channel.messages.fetch({ limit: 100 });
                let transcript = `TRANSCRIPT: #${interaction.channel.name} | GUILD: ${interaction.guild.name}\n\n`;
                Array.from(messages.values()).reverse().forEach(m => {
                    transcript += `[${new Date(m.createdTimestamp).toLocaleString()}] ${m.author.tag}: ${m.content || '[Embed/Attachment]'}\n`;
                });
                const file = new AttachmentBuilder(Buffer.from(transcript, 'utf-8'), { name: `transcript-${interaction.channel.name}.txt` });
                return interaction.editReply({ files: [file] });
            }

            if (['sys_delete_ticket', 'delete_ticket'].includes(customId)) {
                if (!isStaff(interaction.member)) return interaction.reply({ content: '❌ Staff only.', flags: [EPHEMERAL_FLAG] });
                return interaction.channel.delete().catch(() => {});
                        }
                                // ==========================================
            // 3. APPLICATIONS MODAL DISPATCHERS
            // ==========================================
            // 🛡️ STAFF APPLICATION MODAL
            if (['sys_apply_staff', 'apply_staff'].includes(customId)) {
                const modal = new ModalBuilder()
                    .setCustomId('modal_staff')
                    .setTitle('🛡️ Staff Application Form');

                modal.addComponents(
                    new ActionRowBuilder().addComponents(
                        new TextInputBuilder()
                            .setCustomId('staff_age_tz')
                            .setLabel('Age & Timezone')
                            .setPlaceholder('e.g. 18 | EST')
                            .setStyle(TextInputStyle.Short)
                            .setRequired(true)
                    ),
                    new ActionRowBuilder().addComponents(
                        new TextInputBuilder()
                            .setCustomId('staff_exp')
                            .setLabel('Previous Moderation Experience')
                            .setPlaceholder('List servers you have moderated and duties handled')
                            .setStyle(TextInputStyle.Paragraph)
                            .setRequired(true)
                    ),
                    new ActionRowBuilder().addComponents(
                        new TextInputBuilder()
                            .setCustomId('staff_why')
                            .setLabel('Why should we pick you?')
                            .setPlaceholder('What unique skills or activity level can you offer?')
                            .setStyle(TextInputStyle.Paragraph)
                            .setRequired(true)
                    )
                );

                return interaction.showModal(modal).catch(() => {});
            }

            // 🤝 PARTNERSHIP APPLICATION MODAL (CORRECTED QUESTIONS)
            if (['sys_apply_partner', 'apply_partner'].includes(customId)) {
                const modal = new ModalBuilder()
                    .setCustomId('modal_partner')
                    .setTitle('🤝 Partnership Application Form');

                modal.addComponents(
                    new ActionRowBuilder().addComponents(
                        new TextInputBuilder()
                            .setCustomId('partner_server')
                            .setLabel('Server Name & Invite Link')
                            .setPlaceholder('e.g. Starry Hangout | https://discord.gg/example')
                            .setStyle(TextInputStyle.Short)
                            .setRequired(true)
                    ),
                    new ActionRowBuilder().addComponents(
                        new TextInputBuilder()
                            .setCustomId('partner_members')
                            .setLabel('Member Count & Daily Activity Level')
                            .setPlaceholder('e.g. 850 Members | Active main chat & events')
                            .setStyle(TextInputStyle.Short)
                            .setRequired(true)
                    ),
                    new ActionRowBuilder().addComponents(
                        new TextInputBuilder()
                            .setCustomId('partner_pitch')
                            .setLabel('Partnership Proposal / Reason')
                            .setPlaceholder('Describe what type of partnership you are looking for (cross-promo, ping, event)')
                            .setStyle(TextInputStyle.Paragraph)
                            .setRequired(true)
                    ),
                    new ActionRowBuilder().addComponents(
                        new TextInputBuilder()
                            .setCustomId('partner_rep')
                            .setLabel('Your Position in the Server')
                            .setPlaceholder('e.g. Server Owner / Partnership Manager')
                            .setStyle(TextInputStyle.Short)
                            .setRequired(true)
                    )
                );

                return interaction.showModal(modal).catch(() => {});
            }

            // ✅ / ❌ ACCEPT OR REJECT APPLICATION
            if (['app_accept', 'app_reject'].includes(customId)) {
                if (!isStaff(interaction.member)) {
                    return interaction.reply({ content: '❌ Staff permissions required.', flags: [EPHEMERAL_FLAG] });
                }

                const isAccepted = customId === 'app_accept';
                const applicantId = interaction.channel.topic;
                const targetUser = await client.users.fetch(applicantId).catch(() => null);

                if (targetUser) {
                    const dmEmbed = new EmbedBuilder()
                        .setColor(isAccepted ? '#2ecc71' : '#ED4245')
                        .setTitle(`Application Update: ${isAccepted ? 'Accepted ✅' : 'Rejected ❌'}`)
                        .setDescription(`Your application for **${interaction.guild.name}** has been **${isAccepted ? 'ACCEPTED' : 'REJECTED'}** by staff.`)
                        .setTimestamp();

                    await targetUser.send({ embeds: [dmEmbed] }).catch(() => {});
                }

                await interaction.channel.delete().catch(() => {});
                return;
            }
                        }
                // ==========================================
        // 4. MODAL SUBMISSIONS PROCESSING
        // ==========================================
        if (interaction.isModalSubmit()) {
            if (!['modal_staff', 'modal_partner'].includes(interaction.customId)) return;

            const isStaffApp = interaction.customId === 'modal_staff';
            const user = interaction.user;
            const staffCategory = await getOrCreateTicketCategory(interaction.guild, 'APPLICATIONS');

            const appChannel = await interaction.guild.channels.create({
                name: `${isStaffApp ? 'staff' : 'partner'}-${user.username.toLowerCase().replace(/[^a-z0-9]/g, '')}`,
                type: ChannelType.GuildText,
                topic: user.id,
                parent: staffCategory ? staffCategory.id : undefined,
                permissionOverwrites: [
                    { id: interaction.guild.id, deny: [PermissionsBitField.Flags.ViewChannel] },
                    { id: client.user.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.ManageChannels] }
                ]
            });

            const embed = new EmbedBuilder().setTimestamp();

            if (isStaffApp) {
                const ageTz = interaction.fields.getTextInputValue('staff_age_tz');
                const exp = interaction.fields.getTextInputValue('staff_exp');
                const why = interaction.fields.getTextInputValue('staff_why');

                embed.setColor('#2ecc71')
                    .setTitle(`🛡️ New Staff Application | ${user.username}`)
                    .addFields(
                        { name: '👤 Applicant', value: `<@${user.id}> (\`${user.id}\`)`, inline: true },
                        { name: '📌 Age & Timezone', value: ageTz, inline: true },
                        { name: '📜 Previous Experience', value: `>>> ${exp}` },
                        { name: '💡 Why Choose Them', value: `>>> ${why}` }
                    );
            } else {
                const serverInfo = interaction.fields.getTextInputValue('partner_server');
                const members = interaction.fields.getTextInputValue('partner_members');
                const pitch = interaction.fields.getTextInputValue('partner_pitch');
                const rep = interaction.fields.getTextInputValue('partner_rep');

                embed.setColor('#FFD700')
                    .setTitle(`🤝 New Partnership Application | ${user.username}`)
                    .addFields(
                        { name: '👤 Representative', value: `<@${user.id}> (${rep})`, inline: true },
                        { name: '🌐 Server & Invite', value: serverInfo, inline: true },
                        { name: '📊 Member Count / Activity', value: members, inline: true },
                        { name: '📝 Proposal / Pitch', value: `>>> ${pitch}` }
                    );
            }

            const reviewRow = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('app_accept').setLabel('Accept').setStyle(ButtonStyle.Success).setEmoji('✅'),
                new ButtonBuilder().setCustomId('app_reject').setLabel('Reject').setStyle(ButtonStyle.Danger).setEmoji('❌')
            );

            await appChannel.send({ embeds: [embed], components: [reviewRow] });

            let logChannel = interaction.guild.channels.cache.find(c => c.name.includes('app-logs') || c.name.includes('staff-logs') || c.name.includes('partner-logs'));
            if (logChannel) await logChannel.send({ embeds: [embed] }).catch(() => {});

            return interaction.reply({ 
                content: `✅ Your **${isStaffApp ? 'Staff' : 'Partnership'}** application has been submitted! Staff will review it in <#${appChannel.id}>.`, 
                flags: [EPHEMERAL_FLAG] 
            });
        }
    });
};
