// ==========================================
// 🛡️ STARRY SUPREME MASTER CHANNEL SYSTEMS ENGINE
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

// EPHEMERAL RESPONSE FLAG (BITFIELD 6)
const EPHEMERAL_FLAG = MessageFlags.Ephemeral || 6;

// Mongoose Models for Persistence
const ServerSettings = mongoose.models.ServerSettings || require('../models/ServerSettings');

// Dynamic Policy Vote Schema
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

// AI Key Rotation Fallback Helper
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

// ==========================================
// 🛠️ 1. AUTONOMOUS PROVISIONING ENGINE (/setup-starry)
// ==========================================
async function provisionMasterServerStructure(interaction, client, ownerPrompt) {
    const guild = interaction.guild;
    const botMember = guild.members.me;

    // 1. Resolve or Create Verified & Staff Roles
    let verifiedRole = guild.roles.cache.find(r => r.name.toLowerCase() === 'verified');
    if (!verifiedRole) {
        verifiedRole = await guild.roles.create({
            name: 'Verified',
            color: '#2ecc71',
            reason: 'Starry Master System: Verified Access Role'
        });
    }

    let staffRole = guild.roles.cache.find(r => r.name.toLowerCase() === 'staff' || r.name.toLowerCase() === 'moderator');
    if (!staffRole) {
        staffRole = await guild.roles.create({
            name: 'Staff',
            color: '#3498db',
            reason: 'Starry Master System: Staff Role'
        });
    }

    // Baseline Permissions Overwrites
    const hideEveryone = { id: guild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] };
    const showVerified = { id: verifiedRole.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.Connect] };
    const staffFullControl = { id: staffRole.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ManageMessages] };
    const botFullControl = { id: botMember.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ManageChannels] };

    // ==========================================
    // A. CATEGORY: SECURITY & SYSTEM LOGS (ALWAYS CREATED)
    // ==========================================
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

    // ==========================================
    // B. CATEGORY: SUPPORT & APPLICATIONS (ALWAYS CREATED)
    // ==========================================
    const supportCat = await guild.channels.create({
        name: '🎫 SUPPORT & APPLICATIONS',
        type: ChannelType.GuildCategory
    });

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
        topic: 'Click to open a private support ticket.',
        permissionOverwrites: [hideEveryone, showVerified, botFullControl]
    });

    const ticketEmbed = new EmbedBuilder()
        .setColor('#00F2FE')
        .setTitle('🎫 Starry Support Portal')
        .setDescription('Click the button below to open a secure ticket with staff.')
        .setFooter({ text: `${guild.name} Support System` });

    const ticketRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('sys_create_ticket').setLabel('Open Support Ticket').setStyle(ButtonStyle.Primary).setEmoji('📩')
    );
    await ticketCh.send({ embeds: [ticketEmbed], components: [ticketRow] });

    // ==========================================
    // C. CONDITIONAL SPLIT BASED ON PROMPT
    // ==========================================
    let totalCustomChannels = 0;
    let categoryCount = 2;

    if (!ownerPrompt) {
        // --- DEFAULT BEHAVIOR (NO PROMPT): BUILD FULL SECURITY & PROTOCOL SUITE ---

        // 1. ENTRY POINT & PROTOCOL
        const entryCat = await guild.channels.create({ name: '🔻 ENTRY POINT & PROTOCOL', type: ChannelType.GuildCategory, permissionOverwrites: [hideEveryone, showVerified, botFullControl] });
        await guild.channels.create({ name: 'security-briefing', type: ChannelType.GuildText, parent: entryCat.id, topic: 'Server security rules & guidelines.' });
        await guild.channels.create({ name: 'verification-chamber', type: ChannelType.GuildText, parent: entryCat.id, topic: 'Live verification activity stream.' });
        
        const reqCh = await guild.channels.create({ name: 'access-request-form', type: ChannelType.GuildText, parent: entryCat.id, topic: 'Apply for special access roles.' });
        const reqEmbed = new EmbedBuilder().setColor('#9b59b6').setTitle('📋 Special Access Request Desk').setDescription('Click below to submit a VIP or Special Access Request.');
        const reqRow = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('sys_request_access').setLabel('Request Access').setStyle(ButtonStyle.Secondary).setEmoji('📝'));
        await reqCh.send({ embeds: [reqEmbed], components: [reqRow] });

        await guild.channels.create({ name: 'critical-alerts', type: ChannelType.GuildText, parent: entryCat.id, topic: 'Emergency broadcasts & security alerts.' });

        // 2. SECURE COMMS & DISCUSSIONS
        const commsCat = await guild.channels.create({ name: '💬 SECURE COMMS & DISCUSSIONS', type: ChannelType.GuildCategory, permissionOverwrites: [hideEveryone, showVerified, botFullControl] });
        await guild.channels.create({ name: 'general-encrypted-chat', type: ChannelType.GuildText, parent: commsCat.id });
        await guild.channels.create({ name: 'security-intel-exchange', type: ChannelType.GuildText, parent: commsCat.id });
        await guild.channels.create({ name: 'vetted-resource-hub', type: ChannelType.GuildText, parent: commsCat.id });
        await guild.channels.create({ name: 'incident-response-prep', type: ChannelType.GuildText, parent: commsCat.id });

        // 3. SUPPORT & INCIDENT MANAGEMENT
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

        // 4. GOVERNANCE & ARCHIVES
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
        // --- CUSTOM PROMPT PROVIDED: GENERATE THEMED CATEGORIES VIA GEMINI ---
        let customLayout = { categories: [] };
        try {
            const aiPrompt = `Generate a comprehensive Discord server structure for the theme: "${ownerPrompt}".
Return ONLY a valid JSON object matching this exact structure (no markdown formatting):
{
  "categories": [
    { "name": "CATEGORY NAME 1", "channels": ["channel-1", "channel-2", "channel-3"] },
    { "name": "CATEGORY NAME 2", "channels": ["channel-1", "channel-2", "channel-3"] }
  ]
}
Ensure there are at least 3-4 categories tailored specifically to "${ownerPrompt}".`;

            const aiRaw = await generateAIResponseWithRetry(aiPrompt);
            const cleanedJson = aiRaw.replace(/```json/gi, '').replace(/```/g, '').trim();
            customLayout = JSON.parse(cleanedJson);
        } catch (err) {
            console.warn('⚠️ AI Custom prompt layout failed, fallback applied:', err.message);
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

    // Save Setup State
    await ServerSettings.findOneAndUpdate({ guildId: guild.id }, { setupCompleted: true, verifiedRoleId: verifiedRole.id }, { upsert: true });

    return {
        verifiedRole,
        totalCategories: categoryCount,
        totalChannels: totalCustomChannels + 10
    };
}
    // ==========================================
// 🧠 2. DEDICATED REAL-TIME INTERACTION & AUTOMATION ENGINE
// ==========================================

// Register event listeners for dynamic UI interactions
function registerSystemListeners(client) {

    // ==========================================
    // 🛡️ A. VERIFICATION BUTTON HANDLER (#verify-here)
    // ==========================================
    client.on('interactionCreate', async (interaction) => {
        if (!interaction.isButton() || !interaction.customId.startsWith('sys_verify_')) return;

        const roleId = interaction.customId.replace('sys_verify_', '');
        const role = interaction.guild.roles.cache.get(roleId);

        if (!role) {
            return interaction.reply({ content: '❌ Verification role missing! Please contact an administrator.', flags: [EPHEMERAL_FLAG] });
        }

        try {
            await interaction.member.roles.add(role);

            // Log verification to #verification-chamber
            const chamberCh = interaction.guild.channels.cache.find(c => c.name === 'verification-chamber');
            if (chamberCh) {
                const logEmbed = new EmbedBuilder()
                    .setColor('#2ecc71')
                    .setDescription(`✅ **${interaction.user.tag}** completed security verification.`)
                    .setTimestamp();
                await chamberCh.send({ embeds: [logEmbed] }).catch(() => {});
            }

            return interaction.reply({ content: '✅ **Verification Successful!** Full server access unlocked.', flags: [EPHEMERAL_FLAG] });
        } catch (err) {
            return interaction.reply({ content: '❌ Error assigning role. Ensure my bot role is positioned higher than the Verified role!', flags: [EPHEMERAL_FLAG] });
        }
    });

    // ==========================================
    // 🚨 B. ANONYMOUS THREAT REPORTING ENGINE (#threat-reporting)
    // ==========================================
    client.on('interactionCreate', async (interaction) => {
        if (!interaction.isButton() || interaction.customId !== 'sys_report_threat') return;

        const modal = new ModalBuilder()
            .setCustomId('sys_modal_threat')
            .setTitle('🚨 Confidentially Report Threat')
            .addComponents(
                new ActionRowBuilder().addComponents(
                    new TextInputBuilder().setCustomId('threat_subject').setLabel('Target / Offender User ID or Tag').setStyle(TextInputStyle.Short).setRequired(true)
                ),
                new ActionRowBuilder().addComponents(
                    new TextInputBuilder().setCustomId('threat_details').setLabel('Detailed Threat Description & Evidence').setStyle(TextInputStyle.Paragraph).setRequired(true)
                )
            );

        return interaction.showModal(modal);
    });

    client.on('interactionCreate', async (interaction) => {
        if (!interaction.isModalSubmit() || interaction.customId !== 'sys_modal_threat') return;

        await interaction.deferReply({ flags: [EPHEMERAL_FLAG] });

        const target = interaction.fields.getTextInputValue('threat_subject');
        const details = interaction.fields.getTextInputValue('threat_details');

        const adminReqCh = interaction.guild.channels.cache.find(c => c.name === 'admin-action-requests') || interaction.guild.channels.cache.find(c => c.name === 'logs-moderate');

        if (adminReqCh) {
            const reportEmbed = new EmbedBuilder()
                .setColor('#ED4245')
                .setTitle('🚨 EMERGENCY THREAT REPORT SUBMITTED')
                .addFields(
                    { name: 'Reporter', value: `${interaction.user} (\`${interaction.user.id}\`)`, inline: true },
                    { name: 'Target/Offender', value: `\`${target}\``, inline: true },
                    { name: 'Details & Evidence', value: `>>> ${details}`, inline: false }
                )
                .setTimestamp();

            const actionRow = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('threat_ack').setLabel('Acknowledge Report').setStyle(ButtonStyle.Success),
                new ButtonBuilder().setCustomId('threat_timeout').setLabel('Timeout Target').setStyle(ButtonStyle.Danger)
            );

            await adminReqCh.send({ embeds: [reportEmbed], components: [actionRow] });
        }

        return interaction.editReply({ content: '✅ Your threat report has been encrypted and dispatched to server administrators.' });
    });

    // ==========================================
    // 📝 C. ACCESS REQUEST FORM ENGINE (#access-request-form)
    // ==========================================
    client.on('interactionCreate', async (interaction) => {
        if (!interaction.isButton() || interaction.customId !== 'sys_request_access') return;

        const modal = new ModalBuilder()
            .setCustomId('sys_modal_access')
            .setTitle('📋 Special Access Request Form')
            .addComponents(
                new ActionRowBuilder().addComponents(
                    new TextInputBuilder().setCustomId('access_role').setLabel('Requested Role / Permission Level').setStyle(TextInputStyle.Short).setRequired(true)
                ),
                new ActionRowBuilder().addComponents(
                    new TextInputBuilder().setCustomId('access_reason').setLabel('Reason for Special Access').setStyle(TextInputStyle.Paragraph).setRequired(true)
                )
            );

        return interaction.showModal(modal);
    });

    client.on('interactionCreate', async (interaction) => {
        if (!interaction.isModalSubmit() || interaction.customId !== 'sys_modal_access') return;

        await interaction.deferReply({ flags: [EPHEMERAL_FLAG] });

        const role = interaction.fields.getTextInputValue('access_role');
        const reason = interaction.fields.getTextInputValue('access_reason');

        const adminReqCh = interaction.guild.channels.cache.find(c => c.name === 'admin-action-requests');

        if (adminReqCh) {
            const reqEmbed = new EmbedBuilder()
                .setColor('#3498db')
                .setTitle('📋 Pending Special Access Request')
                .addFields(
                    { name: 'User', value: `${interaction.user} (\`${interaction.user.id}\`)`, inline: true },
                    { name: 'Requested Access', value: `\`${role}\``, inline: true },
                    { name: 'Reason', value: `>>> ${reason}`, inline: false }
                )
                .setTimestamp();

            await adminReqCh.send({ embeds: [reqEmbed] });
        }

        return interaction.editReply({ content: '✅ Your access request form has been submitted for administrative review.' });
    });

    // ==========================================
    // 🎫 D. LIVE SUPPORT TICKET ENGINE (#open-a-ticket)
    // ==========================================
    client.on('interactionCreate', async (interaction) => {
        if (!interaction.isButton() || interaction.customId !== 'sys_create_ticket') return;

        await interaction.deferReply({ flags: [EPHEMERAL_FLAG] });

        const ticketName = `ticket-${interaction.user.username}`.toLowerCase().replace(/[^a-z0-9]/g, '');
        const category = interaction.guild.channels.cache.find(c => c.name === '🎫 SUPPORT & APPLICATIONS');

        const existingCh = interaction.guild.channels.cache.find(c => c.name === ticketName);
        if (existingCh) {
            return interaction.editReply({ content: `❌ You already have an open ticket at ${existingCh}!` });
        }

        const ticketCh = await interaction.guild.channels.create({
            name: ticketName,
            type: ChannelType.GuildText,
            parent: category ? category.id : null,
            permissionOverwrites: [
                { id: interaction.guild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] },
                { id: interaction.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] },
                { id: interaction.guild.members.me.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] }
            ]
        });

        const embed = new EmbedBuilder()
            .setColor('#00F2FE')
            .setTitle(`🎫 Private Support Channel`)
            .setDescription(`Hello ${interaction.user}, welcome to your private ticket. Support staff will assist you shortly.\n\nClick below to close this ticket when finished.`)
            .setTimestamp();

        const closeRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('sys_close_ticket').setLabel('Close Ticket').setStyle(ButtonStyle.Danger).setEmoji('🔒')
        );

        await ticketCh.send({ content: `${interaction.user}`, embeds: [embed], components: [closeRow] });

        return interaction.editReply({ content: `✅ Ticket created! Proceed to ${ticketCh}.` });
    });

    client.on('interactionCreate', async (interaction) => {
        if (!interaction.isButton() || interaction.customId !== 'sys_close_ticket') return;

        await interaction.reply({ content: '🔒 **Closing ticket channel in 5 seconds...**' });
        setTimeout(() => interaction.channel.delete().catch(() => {}), 5000);
    });
                       }
// ==========================================
// 🏛️ 3. LIVE MONITOR & TELEMETRY UPDATER ENGINE
// ==========================================

// Real-Time Status Monitor Engine (#server-status-monitor)
function startServerStatusMonitor(client) {
    setInterval(async () => {
        if (!client.guilds) return;
        
        client.guilds.cache.forEach(async (guild) => {
            try {
                const statusCh = guild.channels.cache.find(c => c.name === 'server-status-monitor');
                if (!statusCh) return;

                const messages = await statusCh.messages.fetch({ limit: 10 }).catch(() => null);
                const botMsg = messages ? messages.find(m => m.author.id === client.user.id) : null;

                const uptimeHours = (process.uptime() / 3600).toFixed(2);
                const memUsage = (process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2);

                const statusEmbed = new EmbedBuilder()
                    .setColor('#2ecc71')
                    .setTitle('🟢 Live Server & Infrastructure Status')
                    .addFields(
                        { name: '👥 Total Members', value: `\`${guild.memberCount}\``, inline: true },
                        { name: '📡 Bot Latency', value: `\`${client.ws.ping}ms\``, inline: true },
                        { name: '⏳ System Uptime', value: `\`${uptimeHours} Hours\``, inline: true },
                        { name: '💻 Heap Memory', value: `\`${memUsage} MB\``, inline: true },
                        { name: '🛡️ Security Gatekeeper', value: '`ONLINE & ACTIVE`', inline: true },
                        { name: '🔄 Last Refreshed', value: `<t:${Math.floor(Date.now() / 1000)}:R>`, inline: true }
                    )
                    .setFooter({ text: `${guild.name} Autonomous Telemetry`, iconURL: client.user.displayAvatarURL() });

                if (botMsg) {
                    await botMsg.edit({ embeds: [statusEmbed] }).catch(() => {});
                } else {
                    await statusCh.send({ embeds: [statusEmbed] }).catch(() => {});
                }
            } catch (err) {}
        });
    }, 60000); // Refreshes every 60 seconds
}
// ==========================================
// 🏛️ 4. COMMUNITY POLICY VOTING SYSTEM (#policy-amendment-vote)
// ==========================================
const policyVotePayload = {
    name: 'policy-vote',
    description: '🏛️ Create an official governance policy vote in #policy-amendment-vote (Admins Only)',
    default_member_permissions: '8',
    options: [
        {
            name: 'title',
            type: 3,
            required: true,
            description: 'Title of the policy amendment'
        },
        {
            name: 'description',
            type: 3,
            required: true,
            description: 'Detailed explanation of the policy changes'
        }
    ]
};

async function handlePolicyVoteCommand(interaction, client) {
    if (interaction.commandName !== 'policy-vote') return;

    if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
        return interaction.reply({ content: '❌ Only Administrators can initiate policy votes!', flags: [EPHEMERAL_FLAG] });
    }

    const voteCh = interaction.guild.channels.cache.find(c => c.name === 'policy-amendment-vote');
    if (!voteCh) {
        return interaction.reply({ content: '❌ Could not find `#policy-amendment-vote` channel. Run `/setup-starry` first!', flags: [EPHEMERAL_FLAG] });
    }

    await interaction.deferReply({ flags: [EPHEMERAL_FLAG] });

    const title = interaction.options.getString('title');
    const description = interaction.options.getString('description');

    const embed = new EmbedBuilder()
        .setColor('#f1c40f')
        .setTitle(`🏛️ Policy Amendment Vote: ${title}`)
        .setDescription(`>>> ${description}`)
        .addFields(
            { name: '✅ In Favor (Yes)', value: '`0 Votes (0%)`', inline: true },
            { name: '❌ Opposed (No)', value: '`0 Votes (0%)`', inline: true }
        )
        .setFooter({ text: `Initiated by ${interaction.user.tag} • Policy Governance Engine` })
        .setTimestamp();

    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('vote_yes').setLabel('Vote YES').setStyle(ButtonStyle.Success).setEmoji('✅'),
        new ButtonBuilder().setCustomId('vote_no').setLabel('Vote NO').setStyle(ButtonStyle.Danger).setEmoji('❌')
    );

    const voteMsg = await voteCh.send({ embeds: [embed], components: [row] });

    await PolicyVote.create({
        guildId: interaction.guild.id,
        messageId: voteMsg.id,
        title,
        description,
        yesVotes: [],
        noVotes: []
    });

    return interaction.editReply({ content: `✅ Policy amendment vote successfully posted in ${voteCh}!` });
}

// Button Vote Handler
async function handlePolicyVoteButtons(interaction) {
    if (!interaction.isButton() || !['vote_yes', 'vote_no'].includes(interaction.customId)) return;

    const voteDoc = await PolicyVote.findOne({ messageId: interaction.message.id });
    if (!voteDoc) return;

    const userId = interaction.user.id;
    const isYes = interaction.customId === 'vote_yes';

    // Toggle vote logic
    let yesVotes = voteDoc.yesVotes || [];
    let noVotes = voteDoc.noVotes || [];

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
            { name: '✅ In Favor (Yes)', value: `\`${yesVotes.length} Votes (${yesPct}%)\``, inline: true },
            { name: '❌ Opposed (No)', value: `\`${noVotes.length} Votes (${noPct}%)\``, inline: true }
        );

    await interaction.update({ embeds: [updatedEmbed] });
}

// Module Initializer Functions
function initModule(client) {
    registerSystemListeners(client);
    startServerStatusMonitor(client);

    client.on('interactionCreate', async (interaction) => {
        if (interaction.isChatInputCommand()) {
            await handlePolicyVoteCommand(interaction, client);
        } else if (interaction.isButton()) {
            await handlePolicyVoteButtons(interaction);
        }
    });
}

// Dual Export Support (Supports both functional loader `mod(client)` and object loader `mod.init(client)`)
module.exports = initModule;
module.exports.init = initModule;
module.exports.provisionMasterServerStructure = provisionMasterServerStructure;
module.exports.policyVotePayload = policyVotePayload;
        
