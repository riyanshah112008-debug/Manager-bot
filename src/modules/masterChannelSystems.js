// ==========================================
// 🛡️ STARRY SUPREME MASTER CHANNEL SYSTEMS ENGINE (PART 1)
// ==========================================
const { 
    PermissionFlagsBits, 
    EmbedBuilder, 
    ActionRowBuilder, 
    ButtonBuilder, 
    ButtonStyle, 
    ModalBuilder, 
    TextInputBuilder, 
    TextInputStyle,
    ChannelType,
    MessageFlags
} = require('discord.js');
const mongoose = require('mongoose');
const { GoogleGenAI } = require('@google/genai');

const EPHEMERAL_FLAG = MessageFlags.Ephemeral || 6;
const ServerSettings = mongoose.models.ServerSettings || require('../models/ServerSettings');

const PolicyVoteSchema = new mongoose.Schema({
    guildId: String,
    messageId: String,
    title: String,
    description: String,
    yesVotes: { type: Array, default: [] },
    noVotes: { type: Array, default: [] },
    createdAt: { type: Date, default: Date.now }
});
const PolicyVote = mongoose.models.PolicyVote || mongoose.model('PolicyVote', PolicyVoteSchema);

const rawKeys = process.env.GEMINI_API_KEY || process.env.GOOGLE_AI_KEY || '';
const apiKeys = rawKeys.split(',').map(k => k.trim()).filter(Boolean);
let currentKeyIndex = 0;

function getNextAIClient() {
    if (apiKeys.length === 0) return null;
    const key = apiKeys[currentKeyIndex];
    currentKeyIndex = (currentKeyIndex + 1) % apiKeys.length;
    return new GoogleGenAI({ apiKey: key });
}

async function generateAIResponseWithRetry(prompt) {
    if (apiKeys.length === 0) throw new Error('Missing GEMINI_API_KEY environment variable.');
    const AI_MODELS = ['gemini-2.5-flash', 'gemini-1.5-flash', 'gemini-1.5-pro'];
    for (const modelName of AI_MODELS) {
        try {
            const ai = getNextAIClient();
            const response = await ai.models.generateContent({ model: modelName, contents: prompt });
            if (response && response.text) return response.text.trim();
        } catch (err) {
            continue;
        }
    }
    throw new Error('All AI models are currently busy.');
}

async function provisionMasterServerStructure(interaction, client, ownerPrompt) {
    const guild = interaction.guild;
    const botMember = guild.members.me;

    let verifiedRole = guild.roles.cache.find(r => r.name.toLowerCase() === 'verified');
    if (!verifiedRole) {
        verifiedRole = await guild.roles.create({ name: 'Verified', color: '#2ecc71', reason: 'Starry Master System: Verified Access Role' });
    }

    let staffRole = guild.roles.cache.find(r => r.name.toLowerCase() === 'staff' || r.name.toLowerCase() === 'moderator');
    if (!staffRole) {
        staffRole = await guild.roles.create({ name: 'Staff', color: '#3498db', reason: 'Starry Master System: Staff Role' });
    }

    const hideEveryone = { id: guild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] };
    const showVerified = { id: verifiedRole.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.Connect] };
    const staffFullControl = { id: staffRole.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ManageMessages] };
    const botFullControl = { id: botMember.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ManageChannels] };

    const sysCat = await guild.channels.create({
        name: '🛡️ SECURITY & SYSTEM LOGS',
        type: ChannelType.GuildCategory,
        permissionOverwrites: [hideEveryone, staffFullControl, botFullControl]
    });

    const sysChannels = [
        { name: 'logs-access', topic: 'User Joins, Leaves & Invites Tracking' },
        { name: 'logs-moderate', topic: 'Automod, Timeouts, Bans, Kicks & Warnings' },
        { name: 'logs-messages', topic: 'Deleted & Edited Message Audits' },
        { name: 'logs-voice', topic: 'Voice Channel Activity & Mute Audits' },
        { name: 'logs-channels', topic: 'Channel Updates & Permission Changes' },
        { name: 'logs-members', topic: 'Role Assignments & Nickname Changes' },
        { name: 'sus-account-tracker', topic: 'Flagged suspicious & newly created alt accounts' },
        { name: 'inactivity-tracker', topic: '14-Day Inactivity Audit Logs' }
    ];

    for (const item of sysChannels) {
        await guild.channels.create({ name: item.name, type: ChannelType.GuildText, parent: sysCat.id, topic: item.topic });
    }

    const supportCat = await guild.channels.create({ name: '🎫 SUPPORT & APPLICATIONS', type: ChannelType.GuildCategory });

    const verifyCh = await guild.channels.create({
        name: 'verify-here',
        type: ChannelType.GuildText,
        parent: supportCat.id,
        topic: 'Complete security verification to unlock server access.',
        permissionOverwrites: [
            { id: guild.roles.everyone.id, allow: [PermissionFlagsBits.ViewChannel], deny: [PermissionFlagsBits.SendMessages] },
            { id: verifiedRole.id, deny: [PermissionFlagsBits.ViewChannel] },
            botFullControl
        ]
    });

    const verifyEmbed = new EmbedBuilder()
        .setColor('#2ecc71')
        .setTitle('🛡️ Server Verification Protocol')
        .setDescription('Welcome! Click the button below to complete human verification and unlock full access to the server.')
        .setFooter({ text: `${guild.name} Security Gatekeeper` });

    const verifyRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`sys_verify_${verifiedRole.id}`).setLabel('Verify Account').setStyle(ButtonStyle.Success).setEmoji('✅')
    );
    await verifyCh.send({ embeds: [verifyEmbed], components: [verifyRow] });

    const ticketCh = await guild.channels.create({
        name: 'open-a-ticket',
        type: ChannelType.GuildText,
        parent: supportCat.id,
        topic: 'Click below to open a private support ticket or apply for staff position.',
        permissionOverwrites: [hideEveryone, showVerified, botFullControl]
    });

    const ticketEmbed = new EmbedBuilder()
        .setColor('#00F2FE')
        .setTitle('🎫 Starry Support Portal')
        .setDescription('Need help, have a question, or want to report a rule breaker? Click the button below to open a secure ticket with staff.')
        .setFooter({ text: `${guild.name} Support System` });

    const ticketRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('sys_create_ticket').setLabel('Open Support Ticket').setStyle(ButtonStyle.Primary).setEmoji('📩')
    );

    const staffAppEmbed = new EmbedBuilder()
        .setColor('#9b59b6')
        .setTitle('📋 Official Staff & Moderator Application')
        .setDescription('Interested in becoming a Moderator or Helper in our community?\nClick below to fill out our interactive modal application!')
        .setFooter({ text: `${guild.name} Staff Recruitment` });

    const staffAppRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('sys_apply_staff').setLabel('Apply for Staff').setStyle(ButtonStyle.Success).setEmoji('📝')
    );

    await ticketCh.send({ embeds: [ticketEmbed], components: [ticketRow] });
    await ticketCh.send({ embeds: [staffAppEmbed], components: [staffAppRow] });

    let totalCustomChannels = 0;
    let categoryCount = 2;
    if (!ownerPrompt) {
        const entryCat = await guild.channels.create({ name: '🔻 ENTRY POINT & PROTOCOL', type: ChannelType.GuildCategory, permissionOverwrites: [hideEveryone, showVerified, botFullControl] });
        await guild.channels.create({ name: 'security-briefing', type: ChannelType.GuildText, parent: entryCat.id, topic: 'Server security rules & guidelines.' });
        await guild.channels.create({ name: 'verification-chamber', type: ChannelType.GuildText, parent: entryCat.id, topic: 'Live verification activity stream.' });
        
        const reqCh = await guild.channels.create({ name: 'access-request-form', type: ChannelType.GuildText, parent: entryCat.id, topic: 'Apply for special access roles.' });
        const reqEmbed = new EmbedBuilder().setColor('#9b59b6').setTitle('📋 Special Access Request Desk').setDescription('Click below to submit a VIP or Special Access Request.');
        const reqRow = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('sys_request_access').setLabel('Request Access').setStyle(ButtonStyle.Secondary).setEmoji('📝'));
        await reqCh.send({ embeds: [reqEmbed], components: [reqRow] });

        await guild.channels.create({ name: 'critical-alerts', type: ChannelType.GuildText, parent: entryCat.id, topic: 'Emergency broadcasts & security alerts.' });

        const commsCat = await guild.channels.create({ name: '💬 SECURE COMMS & DISCUSSIONS', type: ChannelType.GuildCategory, permissionOverwrites: [hideEveryone, showVerified, botFullControl] });
        await guild.channels.create({ name: 'general-encrypted-chat', type: ChannelType.GuildText, parent: commsCat.id });
        await guild.channels.create({ name: 'security-intel-exchange', type: ChannelType.GuildText, parent: commsCat.id });
        await guild.channels.create({ name: 'vetted-resource-hub', type: ChannelType.GuildText, parent: commsCat.id });
        await guild.channels.create({ name: 'incident-response-prep', type: ChannelType.GuildText, parent: commsCat.id });

        const incidentCat = await guild.channels.create({ name: '🚨 SUPPORT & INCIDENT MANAGEMENT', type: ChannelType.GuildCategory, permissionOverwrites: [hideEveryone, showVerified, botFullControl] });
        
        const threatCh = await guild.channels.create({ name: 'threat-reporting', type: ChannelType.GuildText, parent: incidentCat.id });
        const threatEmbed = new EmbedBuilder().setColor('#e74c3c').setTitle('🚨 Anonymous Threat Reporting').setDescription('Report suspicious activity, scammers, or rule violations confidentially.');
        const threatRow = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('sys_report_threat').setLabel('Report Threat').setStyle(ButtonStyle.Danger).setEmoji('⚠️'));
        await threatCh.send({ embeds: [threatEmbed], components: [threatRow] });

        await guild.channels.create({ name: 'support-desk-private', type: ChannelType.GuildText, parent: incidentCat.id });
        
        const statusCh = await guild.channels.create({ name: 'server-status-monitor', type: ChannelType.GuildText, parent: incidentCat.id });
        const statusEmbed = new EmbedBuilder().setColor('#2ecc71').setTitle('🟢 Server Status Monitor').setDescription('All security systems operational.');
        await statusCh.send({ embeds: [statusEmbed] });

        await guild.channels.create({ name: 'admin-action-requests', type: ChannelType.GuildText, parent: incidentCat.id });

        const govCat = await guild.channels.create({ name: '🏛️ GOVERNANCE & ARCHIVES', type: ChannelType.GuildCategory, permissionOverwrites: [hideEveryone, showVerified, botFullControl] });
        
        const voteCh = await guild.channels.create({ name: 'policy-amendment-vote', type: ChannelType.GuildText, parent: govCat.id });
        const voteEmbed = new EmbedBuilder().setColor('#f1c40f').setTitle('🏛️ Community Governance Portal').setDescription('Admins can initiate votes using `/policy-vote`.');
        await voteCh.send({ embeds: [voteEmbed] });

        await guild.channels.create({ name: 'transparency-logs', type: ChannelType.GuildText, parent: govCat.id });
        await guild.channels.create({ name: 'trust-level-overview', type: ChannelType.GuildText, parent: govCat.id });
        await guild.channels.create({ name: 'security-knowledge-base', type: ChannelType.GuildText, parent: govCat.id });

        categoryCount += 4;
        totalCustomChannels = 16;
    } else {
        let customLayout = { categories: [] };
        try {
            const aiPrompt = `Generate a comprehensive Discord server structure for the theme: "${ownerPrompt}".
Return ONLY a valid JSON object matching this exact structure:
{
  "categories": [
    { "name": "CATEGORY NAME 1", "channels": ["channel-1", "channel-2", "channel-3"] },
    { "name": "CATEGORY NAME 2", "channels": ["channel-1", "channel-2", "channel-3"] }
  ]
}`;
            const aiRaw = await generateAIResponseWithRetry(aiPrompt);
            const cleanedJson = aiRaw.replace(/```json/gi, '').replace(/```/g, '').trim();
            customLayout = JSON.parse(cleanedJson);
        } catch (err) {
            console.warn('⚠️ AI Custom prompt layout failed:', err.message);
        }

        if (customLayout.categories && Array.isArray(customLayout.categories)) {
            for (const catData of customLayout.categories) {
                const createdCat = await guild.channels.create({
                    name: catData.name.toUpperCase(),
                    type: ChannelType.GuildCategory,
                    permissionOverwrites: [hideEveryone, showVerified, botFullControl]
                });
                categoryCount++;

                if (Array.isArray(catData.channels)) {
                    for (const chName of catData.channels) {
                        const isVoice = chName.toLowerCase().includes('vc') || chName.toLowerCase().includes('lounge');
                        await guild.channels.create({
                            name: chName.toLowerCase().replace(/[^a-z0-9\-_ ]/g, '-'),
                            type: isVoice ? ChannelType.GuildVoice : ChannelType.GuildText,
                            parent: createdCat.id
                        });
                        totalCustomChannels++;
                    }
                }
            }
        }
    }

    const safeGuildId = String(guild.id);
    await ServerSettings.findOneAndUpdate({ guildId: safeGuildId }, { setupCompleted: true, verifiedRoleId: verifiedRole.id }, { upsert: true });

    return { verifiedRole, totalCategories: categoryCount, totalChannels: totalCustomChannels + 10 };
}

function start60sChannelTelemetryLoop(client) {
    setInterval(async () => {
        if (!client.guilds) return;

        client.guilds.cache.forEach(async (guild) => {
            try {
                const statusCh = guild.channels.cache.find(c => c.name === 'server-status-monitor');
                if (statusCh) {
                    const uptimeHours = (process.uptime() / 3600).toFixed(2);
                    const memUsage = (process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2);

                    const statusEmbed = new EmbedBuilder()
                        .setColor('#2ecc71')
                        .setTitle('🟢 Live Server & Infrastructure Telemetry')
                        .addFields(
                            { name: '👥 Total Members', value: `\`${guild.memberCount}\``, inline: true },
                            { name: '📡 Gateway Ping', value: `\`${client.ws.ping}ms\``, inline: true },
                            { name: '⏳ Bot Uptime', value: `\`{uptimeHours} Hours\``, inline: true },
                            { name: '💻 Memory Heap', value: `\`{memUsage} MB\``, inline: true },
                            { name: '🛡️ Security Protocol', value: '`ENFORCED & ACTIVE`', inline: true },
                            { name: '🔄 Auto-Refreshed', value: `<t:${Math.floor(Date.now() / 1000)}:R>`, inline: true }
                        )
                        .setFooter({ text: `${guild.name} Autonomous System Monitor`, iconURL: client.user.displayAvatarURL() });

                    const msgs = await statusCh.messages.fetch({ limit: 5 }).catch(() => null);
                    const botMsg = msgs ? msgs.find(m => m.author.id === client.user.id) : null;
                    if (botMsg) await botMsg.edit({ embeds: [statusEmbed] }).catch(() => {});
                    else await statusCh.send({ embeds: [statusEmbed] }).catch(() => {});
                }
            } catch (err) {}
        });
    }, 60000);
                                     }
                             // ==========================================
// 🛡️ STARRY SUPREME MASTER CHANNEL SYSTEMS ENGINE (PART 2)
// ==========================================
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function handleEmergencyCommand(interaction, client) {
    if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
        return interaction.reply({ content: '❌ **Access Denied:** Only Administrators can execute emergency protocols!', flags: [EPHEMERAL_FLAG] });
    }

    const cmd = interaction.commandName;

    if (cmd === 'emergency-nuke') {
        const embed = new EmbedBuilder()
            .setColor('#FF0000')
            .setTitle('☢️ TOTAL EMERGENCY NUKE ☢️')
            .setDescription(
                '**WARNING: THIS ACTION IS COMPLETELY IRREVERSIBLE.**\n\n' +
                'Are you sure you want to vaporize channels and roles?\n' +
                '*Exceptions: Channels named `general`, the current channel, and roles higher than the bot.*'
            );

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId(`nuke_confirm_${interaction.user.id}`).setLabel('NUKE EVERYTHING').setStyle(ButtonStyle.Danger).setEmoji('☢️'),
            new ButtonBuilder().setCustomId(`nuke_cancel_${interaction.user.id}`).setLabel('CANCEL').setStyle(ButtonStyle.Secondary)
        );

        return interaction.reply({ embeds: [embed], components: [row], flags: [EPHEMERAL_FLAG] });
    }

    if (cmd === 'emergency-lockdown') {
        const embed = new EmbedBuilder()
            .setColor('#FFA500')
            .setTitle('🚨 INITIATE GLOBAL LOCKDOWN 🚨')
            .setDescription('Remove typing and voice access for `@everyone` in all channels?');

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId(`lock_confirm_${interaction.user.id}`).setLabel('LOCKDOWN SERVER').setStyle(ButtonStyle.Danger).setEmoji('🔒'),
            new ButtonBuilder().setCustomId(`lock_cancel_${interaction.user.id}`).setLabel('CANCEL').setStyle(ButtonStyle.Secondary)
        );

        return interaction.reply({ embeds: [embed], components: [row], flags: [EPHEMERAL_FLAG] });
    }

    if (cmd === 'emergency-secure') {
        const embed = new EmbedBuilder()
            .setColor('#3498db')
            .setTitle('🛡️ INITIATE SECURITY PROTOCOL 🛡️')
            .setDescription('Instantly remove Administrator and management permissions from all roles?');

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId(`secure_confirm_${interaction.user.id}`).setLabel('SECURE ROLES').setStyle(ButtonStyle.Danger).setEmoji('🛡️'),
            new ButtonBuilder().setCustomId(`secure_cancel_${interaction.user.id}`).setLabel('CANCEL').setStyle(ButtonStyle.Secondary)
        );

        return interaction.reply({ embeds: [embed], components: [row], flags: [EPHEMERAL_FLAG] });
    }

    if (cmd === 'emergency-unban') {
        const embed = new EmbedBuilder()
            .setColor('#2ecc71')
            .setTitle('🏥 INITIATE MASS UNBAN 🏥')
            .setDescription('Wipe the entire server ban list and unban everyone?');

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId(`unban_confirm_${interaction.user.id}`).setLabel('UNBAN EVERYONE').setStyle(ButtonStyle.Danger).setEmoji('🏥'),
            new ButtonBuilder().setCustomId(`unban_cancel_${interaction.user.id}`).setLabel('CANCEL').setStyle(ButtonStyle.Secondary)
        );

        return interaction.reply({ embeds: [embed], components: [row], flags: [EPHEMERAL_FLAG] });
    }
}

async function handlePersistentButtonInteractions(interaction, client) {
    if (!interaction.isButton()) return;
    const customId = interaction.customId;

    // 1. Verification Buttons (Persistent)
    if (customId.startsWith('sys_verify_')) {
        const roleId = customId.split('_')[2];
        try {
            await interaction.deferReply({ flags: [EPHEMERAL_FLAG] });
            const member = interaction.member;
            if (!member.roles.cache.has(roleId)) {
                await member.roles.add(roleId);
                return interaction.editReply({ content: '✅ **Verification Successful!** You have been granted access to the server.' });
            } else {
                return interaction.editReply({ content: 'ℹ️ You are already verified!' });
            }
        } catch (err) {
            return interaction.editReply({ content: '❌ Failed to assign verification role. Check bot permissions.' }).catch(() => {});
        }
    }

    // 2. Support Ticket Button (Persistent)
    if (customId === 'sys_create_ticket') {
        try {
            await interaction.deferReply({ flags: [EPHEMERAL_FLAG] });
            const guild = interaction.guild;
            const ticketChannel = await guild.channels.create({
                name: `ticket-${interaction.user.username}`.toLowerCase().replace(/[^a-z0-9]/g, '-'),
                type: ChannelType.GuildText,
                permissionOverwrites: [
                    { id: guild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] },
                    { id: interaction.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] },
                    { id: guild.members.me.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ManageChannels] }
                ]
            });
            const welcomeEmbed = new EmbedBuilder()
                .setColor('#00F2FE')
                .setTitle(`🎫 Support Ticket - ${interaction.user.username}`)
                .setDescription('Staff will be with you shortly. Please describe your issue or inquiry.');
            await ticketChannel.send({ content: `${interaction.user}`, embeds: [welcomeEmbed] });
            return interaction.editReply({ content: `✅ Support ticket created successfully: ${ticketChannel}` });
        } catch (err) {
            return interaction.editReply({ content: '❌ Failed to create support ticket channel.' }).catch(() => {});
        }
    }

    // 3. Staff Application Modal Button (Persistent)
    if (customId === 'sys_apply_staff') {
        const modal = new ModalBuilder()
            .setCustomId('sys_modal_staff_app')
            .setTitle('📋 Staff Application Form')
            .addComponents(
                new ActionRowBuilder().addComponents(
                    new TextInputBuilder().setCustomId('app_age').setLabel('Your Age & Timezone').setStyle(TextInputStyle.Short).setRequired(true)
                ),
                new ActionRowBuilder().addComponents(
                    new TextInputBuilder().setCustomId('app_experience').setLabel('Prior Moderation Experience').setStyle(TextInputStyle.Paragraph).setRequired(true)
                ),
                new ActionRowBuilder().addComponents(
                    new TextInputBuilder().setCustomId('app_reason').setLabel('Why do you want to join our staff team?').setStyle(TextInputStyle.Paragraph).setRequired(true)
                )
            );
        return interaction.showModal(modal);
    }

    // 4. Access Request & Threat Reporting Buttons (Persistent)
    if (customId === 'sys_request_access') {
        await interaction.reply({ content: '📝 Please detail your special access request in this channel or open a ticket.', flags: [EPHEMERAL_FLAG] });
        return;
    }
    if (customId === 'sys_report_threat') {
        await interaction.reply({ content: '⚠️ Threat report noted. Management has been alerted confidentially.', flags: [EPHEMERAL_FLAG] });
        return;
    }

    // 5. Emergency Action Confirmations (Persistent handling)
    if (customId.startsWith('nuke_confirm_') || customId.startsWith('nuke_cancel_') ||
        customId.startsWith('lock_confirm_') || customId.startsWith('lock_cancel_') ||
        customId.startsWith('secure_confirm_') || customId.startsWith('secure_cancel_') ||
        customId.startsWith('unban_confirm_') || customId.startsWith('unban_cancel_')) {
        
        const parts = customId.split('_');
        const actionType = parts[0]; // nuke, lock, secure, unban
        const actionDecision = parts[1]; // confirm, cancel
        const targetUserId = parts[2];

        if (interaction.user.id !== targetUserId) {
            return interaction.reply({ content: '❌ Only the administrator who initiated this command can click this button!', flags: [EPHEMERAL_FLAG] });
        }

        if (actionDecision === 'cancel') {
            return interaction.update({ content: '🚫 Emergency action cancelled.', embeds: [], components: [] });
        }

        const guild = interaction.guild;
        await interaction.update({ content: `⚡ **Executing emergency ${actionType} protocol...**`, embeds: [], components: [] });

        if (actionType === 'nuke') {
            let deletedChannels = 0;
            const channels = await guild.channels.fetch();
            for (const [id, channel] of channels) {
                if (id === interaction.channel.id || channel.name.toLowerCase().includes('general')) continue;
                try { await channel.delete('Emergency Nuke'); deletedChannels++; await delay(400); } catch (err) {}
            }
            let deletedRoles = 0;
            const roles = await guild.roles.fetch();
            const botRolePos = guild.members.me.roles.highest.position;
            for (const [id, role] of roles) {
                if (role.name === '@everyone' || role.managed || role.position >= botRolePos) continue;
                try { await role.delete('Emergency Nuke'); deletedRoles++; await delay(400); } catch (err) {}
            }
            await interaction.followUp({ content: `☢️ **Nuke Complete:** Wiped ${deletedChannels} channels and ${deletedRoles} roles.`, flags: [EPHEMERAL_FLAG] });
        } else if (actionType === 'lock') {
            let lockedCount = 0;
            const channels = await guild.channels.fetch();
            for (const [id, channel] of channels) {
                try { await channel.permissionOverwrites.edit(guild.id, { SendMessages: false, Connect: false }); lockedCount++; await delay(300); } catch (err) {}
            }
            await interaction.followUp({ content: `🔒 **Lockdown Complete:** Locked ${lockedCount} channels.`, flags: [EPHEMERAL_FLAG] });
        } else if (actionType === 'secure') {
            let strippedCount = 0;
            const roles = await guild.roles.fetch();
            const botRolePos = guild.members.me.roles.highest.position;
            for (const [id, role] of roles) {
                if (role.position >= botRolePos || role.name === '@everyone' || role.managed) continue;
                try {
                    await role.setPermissions(role.permissions.remove([
                        PermissionFlagsBits.Administrator, PermissionFlagsBits.BanMembers,
                        PermissionFlagsBits.KickMembers, PermissionFlagsBits.ManageChannels,
                        PermissionFlagsBits.ManageRoles, PermissionFlagsBits.ManageGuild,
                        PermissionFlagsBits.ManageWebhooks
                    ]));
                    strippedCount++; await delay(500);
                } catch (err) {}
            }
            await interaction.followUp({ content: `🛡️ **Security Protocol Complete:** Stripped dangerous permissions from ${strippedCount} roles.`, flags: [EPHEMERAL_FLAG] });
        } else if (actionType === 'unban') {
            const bans = await guild.bans.fetch();
            let unbannedCount = 0;
            for (const [userId] of bans) {
                try { await guild.members.unban(userId, 'Emergency Mass Unban'); unbannedCount++; await delay(300); } catch (err) {}
            }
            await interaction.followUp({ content: `🏥 **Mass Unban Complete:** Successfully unbanned ${unbannedCount} users.`, flags: [EPHEMERAL_FLAG] });
        }
        return;
    }
}

async function handlePolicyVoteButtons(interaction) {
    if (!interaction.isButton() || !['vote_yes', 'vote_no'].includes(interaction.customId)) return;

    const rawMsgId = interaction.message ? interaction.message.id : '';
    const cleanMsgId = String(rawMsgId || '').replace(/[^0-9]/g, '');
    if (!cleanMsgId) return;

    const voteDoc = await PolicyVote.findOne({ messageId: String(cleanMsgId) });
    if (!voteDoc) return;

    const userId = String(interaction.user.id);
    const isYes = interaction.customId === 'vote_yes';

    let yesVotes = Array.isArray(voteDoc.yesVotes) ? voteDoc.yesVotes : [];
    let noVotes = Array.isArray(voteDoc.noVotes) ? voteDoc.noVotes : [];

    if (isYes) {
        if (!yesVotes.includes(userId)) yesVotes.push(userId);
        noVotes = noVotes.filter(id => id !== userId);
    } else {
        if (!noVotes.includes(userId)) noVotes.push(userId);
        yesVotes = yesVotes.filter(id => id !== userId);
    }

    voteDoc.yesVotes = yesVotes;
    voteDoc.noVotes = noVotes;
    await voteDoc.save();

    const totalVotes = yesVotes.length + noVotes.length;
    const yesPct = totalVotes > 0 ? ((yesVotes.length / totalVotes) * 100).toFixed(1) : 0;
    const noPct = totalVotes > 0 ? ((noVotes.length / totalVotes) * 100).toFixed(1) : 0;

    const updatedEmbed = EmbedBuilder.from(interaction.message.embeds[0])
        .setFields(
            { name: '✅ In Favor (Yes)', value: `\`{yesVotes.length} Votes (${yesPct}%)\``, inline: true },
            { name: '❌ Opposed (No)', value: `\`{noVotes.length} Votes (${noPct}%)\``, inline: true }
        );

    await interaction.update({ embeds: [updatedEmbed] });
}

function initModule(client) {
    start60sChannelTelemetryLoop(client);

    client.on('interactionCreate', async (interaction) => {
        if (interaction.isChatInputCommand()) {
            const cmdName = interaction.commandName;
            if (['emergency-nuke', 'emergency-lockdown', 'emergency-secure', 'emergency-unban'].includes(cmdName)) {
                await handleEmergencyCommand(interaction, client);
            }
        } else if (interaction.isButton()) {
            await handlePersistentButtonInteractions(interaction, client);
            await handlePolicyVoteButtons(interaction);
        } else if (interaction.isModalSubmit() && interaction.customId === 'sys_modal_staff_app') {
            await interaction.deferReply({ flags: [EPHEMERAL_FLAG] });
            const age = interaction.fields.getTextInputValue('app_age');
            const exp = interaction.fields.getTextInputValue('app_experience');
            const reason = interaction.fields.getTextInputValue('app_reason');

            const adminReqCh = interaction.guild.channels.cache.find(c => c.name === 'admin-action-requests') || 
                               interaction.guild.channels.cache.find(c => c.name === 'logs-moderate');

            if (adminReqCh) {
                const appLogEmbed = new EmbedBuilder()
                    .setColor('#9b59b6')
                    .setTitle('📥 NEW STAFF APPLICATION SUBMITTED')
                    .addFields(
                        { name: 'Applicant', value: `${interaction.user} (\`${interaction.user.id}\`)`, inline: true },
                        { name: 'Age & Timezone', value: `\`{age}\``, inline: true },
                        { name: 'Prior Experience', value: `>>> {exp}`, inline: false },
                        { name: 'Motivation / Reason', value: `>>> {reason}`, inline: false }
                    )
                    .setTimestamp();
                await adminReqCh.send({ embeds: [appLogEmbed] });
            }
            await interaction.editReply({ content: '✅ Your staff application has been submitted to management for review!' });
        }
    });
}

const policyVotePayload = {
    name: 'policy-vote',
    description: '🏛️ Create an official governance policy vote in #policy-amendment-vote (Admins Only)',
    default_member_permissions: '8',
    options: [
        { name: 'title', type: 3, required: true, description: 'Title of the policy amendment' },
        { name: 'description', type: 3, required: true, description: 'Detailed explanation of the policy changes' }
    ]
};

module.exports = initModule;
module.exports.init = initModule;
module.exports.provisionMasterServerStructure = provisionMasterServerStructure;
module.exports.policyVotePayload = policyVotePayload;
module.exports.handleEmergencyCommand = handleEmergencyCommand;
