const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType, PermissionsBitField, AttachmentBuilder, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');

module.exports = (client) => {
    // ==========================================
    // 1. HELPERS
    // ==========================================
    const hasAdmin = (member) => member.permissions.has(PermissionsBitField.Flags.ManageChannels);

    client.on('interactionCreate', async (interaction) => {
        // --- SETUP COMMANDS ---
        if (interaction.isChatInputCommand()) {
            if (interaction.commandName === 'ticketsetup') {
                const embed = new EmbedBuilder()
                    .setColor('#0099ff')
                    .setTitle('🎫 Support Tickets')
                    .setDescription('Need help? Click the button below to open a private ticket with the staff team.');

                const button = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId('create_ticket').setLabel('📩 Open a Ticket').setStyle(ButtonStyle.Primary)
                );

                await interaction.reply({ content: '✅ Ticket system panel created!', ephemeral: true });
                await interaction.channel.send({ embeds: [embed], components: [button] });
            }

            if (interaction.commandName === 'applysetup') {
                const embed = new EmbedBuilder()
                    .setColor('#FFD700')
                    .setTitle('📋 Server Applications')
                    .setDescription('We are looking for new staff and partners!\n\nChoose an option below.');

                const buttons = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId('apply_staff').setLabel('🛡️ Apply for Staff').setStyle(ButtonStyle.Primary),
                    new ButtonBuilder().setCustomId('apply_partner').setLabel('🤝 Request Partnership').setStyle(ButtonStyle.Success)
                );

                await interaction.reply({ content: '✅ Application Dashboard created!', ephemeral: true });
                await interaction.channel.send({ embeds: [embed], components: [buttons] });
            }
        }

        // --- BUTTON HANDLING ---
        if (interaction.isButton()) {
            // 🔒 PREMIUM CHECK (Block tickets/apps in non-premium servers)
            if (['create_ticket', 'apply_staff', 'apply_partner'].includes(interaction.customId)) {
                if (client.isPremium && !client.isPremium(interaction.guildId)) {
                    return interaction.reply({ content: '❌ **Tickets/Applications are a Premium feature!** Use `.premium` to upgrade.', ephemeral: true });
                }
            }

            // Ticket Creation
            if (interaction.customId === 'create_ticket') {
                const existing = interaction.guild.channels.cache.find(c => c.topic === interaction.user.id);
                if (existing) return interaction.reply({ content: `❌ You already have a ticket at <#${existing.id}>!`, ephemeral: true });

                const ticketChannel = await interaction.guild.channels.create({
                    name: `ticket-${interaction.user.username}`,
                    type: ChannelType.GuildText,
                    topic: interaction.user.id,
                    permissionOverwrites: [
                        { id: interaction.guild.id, deny: [PermissionsBitField.Flags.ViewChannel] },
                        { id: interaction.user.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] },
                        { id: client.user.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.ManageChannels] }
                    ]
                });

                const row = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId('claim_ticket').setLabel('✋ Claim').setStyle(ButtonStyle.Success),
                    new ButtonBuilder().setCustomId('close_ticket').setLabel('🔒 Close').setStyle(ButtonStyle.Danger)
                );

                await ticketChannel.send({ content: `<@${interaction.user.id}>`, embeds: [new EmbedBuilder().setTitle('🎫 Ticket Opened').setDescription('Explain your issue. Staff will assist shortly.')], components: [row] });
                await interaction.reply({ content: `✅ Ticket created: <#${ticketChannel.id}>`, ephemeral: true });
            }

            // Application Modals
            if (interaction.customId === 'apply_staff' || interaction.customId === 'apply_partner') {
                const modal = new ModalBuilder().setCustomId(interaction.customId === 'apply_staff' ? 'modal_staff' : 'modal_partner').setTitle('Application');
                modal.addComponents(
                    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('q1').setLabel('Q1').setStyle(TextInputStyle.Short).setRequired(true)),
                    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('q2').setLabel('Q2').setStyle(TextInputStyle.Paragraph).setRequired(true)),
                    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('q3').setLabel('Q3').setStyle(TextInputStyle.Paragraph).setRequired(true))
                );
                await interaction.showModal(modal);
            }
            // Management Buttons
            if (['claim_ticket', 'close_ticket', 'transcript_ticket', 'delete_ticket', 'app_accept', 'app_reject'].includes(interaction.customId)) {
                if (!hasAdmin(interaction.member) && interaction.user.id !== process.env.OWNER_ID) return interaction.reply({ content: '❌ Staff only.', ephemeral: true });

                if (interaction.customId === 'claim_ticket') {
                    await interaction.channel.setName(`claimed-${interaction.channel.name.split('-')[1]}`);
                    await interaction.update({ components: [new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('close_ticket').setLabel('🔒 Close').setStyle(ButtonStyle.Danger))] });
                    await interaction.channel.send(`✋ Claimed by ${interaction.user.username}`);
                }

                if (interaction.customId === 'close_ticket') {
                    await interaction.channel.permissionOverwrites.edit(interaction.channel.topic, { SendMessages: false });
                    const row = new ActionRowBuilder().addComponents(
                        new ButtonBuilder().setCustomId('transcript_ticket').setLabel('📝 Transcript').setStyle(ButtonStyle.Primary),
                        new ButtonBuilder().setCustomId('delete_ticket').setLabel('🗑️ Delete').setStyle(ButtonStyle.Danger)
                    );
                    await interaction.update({ components: [] });
                    await interaction.channel.send({ embeds: [new EmbedBuilder().setTitle('🔒 Ticket Closed')], components: [row] });
                }

                if (interaction.customId === 'transcript_ticket') {
                    await interaction.deferReply();
                    const msgs = await interaction.channel.messages.fetch({ limit: 100 });
                    const txt = msgs.reverse().map(m => `[${m.author.tag}]: ${m.content}`).join('\n');
                    await interaction.editReply({ files: [new AttachmentBuilder(Buffer.from(txt), { name: 'transcript.txt' })] });
                }

                if (interaction.customId === 'delete_ticket') {
                    await interaction.reply('🗑️ Deleting in 5s...');
                    setTimeout(() => interaction.channel.delete().catch(() => {}), 5000);
                }

                if (interaction.customId === 'app_accept' || interaction.customId === 'app_reject') {
                    const isAcc = interaction.customId === 'app_accept';
                    const target = await client.users.fetch(interaction.channel.topic).catch(() => null);
                    if (target) await target.send(`Your application was **${isAcc ? 'ACCEPTED' : 'REJECTED'}**.`).catch(() => {});
                    await interaction.reply(`Application ${isAcc ? 'accepted' : 'rejected'}. Deleting channel...`);
                    setTimeout(() => interaction.channel.delete(), 10000);
                }
            }
        }

        // --- MODAL SUBMISSIONS ---
        if (interaction.isModalSubmit()) {
            // SECURITY CHECK: Only process modals created by this specific file
            const validModals = ['modal_staff', 'modal_partner'];
            if (!validModals.includes(interaction.customId)) return;

            const isStaff = interaction.customId === 'modal_staff';
            const channel = await interaction.guild.channels.create({ name: `app-${interaction.user.username}`, type: ChannelType.GuildText, topic: interaction.user.id });
            const embed = new EmbedBuilder().setTitle(`New ${isStaff ? 'Staff' : 'Partner'} App`).addFields(
                { name: 'Q1', value: interaction.fields.getTextInputValue('q1') },
                { name: 'Q2', value: interaction.fields.getTextInputValue('q2') },
                { name: 'Q3', value: interaction.fields.getTextInputValue('q3') }
            );
            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('app_accept').setLabel('✅ Accept').setStyle(ButtonStyle.Success),
                new ButtonBuilder().setCustomId('app_reject').setLabel('❌ Reject').setStyle(ButtonStyle.Danger)
            );
            await channel.send({ embeds: [embed], components: [row] });
            await interaction.reply({ content: `✅ Application sent to <#${channel.id}>`, ephemeral: true });
        }
    });
};
