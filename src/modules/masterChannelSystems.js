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
                            { name: '⏳ Bot Uptime', value: `\`${uptimeHours} Hours\``, inline: true },
                            { name: '💻 Memory Heap', value: `\`${memUsage} MB\``, inline: true },
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
// 3. LISTENERS & NOSQL CLEAN POLICY VOTING
// ==========================================
function registerSystemListeners(client) {
    client.on('interactionCreate', async (interaction) => {
        if (!interaction.isButton()) return;

        if (interaction.customId === 'sys_apply_staff') {
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
    });

    client.on('interactionCreate', async (interaction) => {
        if (!interaction.isModalSubmit() || interaction.customId !== 'sys_modal_staff_app') return;

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
                    { name: 'Age & Timezone', value: `\`${age}\``, inline: true },
                    { name: 'Prior Experience', value: `>>> ${exp}`, inline: false },
                    { name: 'Motivation / Reason', value: `>>> ${reason}`, inline: false }
                )
                .setTimestamp();

            await adminReqCh.send({ embeds: [appLogEmbed] });
        }

        return interaction.editReply({ content: '✅ Your staff application has been submitted to management for review!' });
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

async function handlePolicyVoteButtons(interaction) {
    if (!interaction.isButton() || !['vote_yes', 'vote_no'].includes(interaction.customId)) return;

    // CODACY LINE 644 FIX: Strict Primitive Numeric Coercion
    const rawMsgId = interaction.message ? interaction.message.id : '';
    const cleanMsgId = String(rawMsgId || '').replace(/[^0-9]/g, '');

    if (!cleanMsgId) return;

    // Isolated Query Filter Variable
    const voteQueryFilter = { messageId: String(cleanMsgId) };
    const voteDoc = await PolicyVote.findOne(voteQueryFilter);
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
            { name: '✅ In Favor (Yes)', value: `\`${yesVotes.length} Votes (${yesPct}%)\``, inline: true },
            { name: '❌ Opposed (No)', value: `\`${noVotes.length} Votes (${noPct}%)\``, inline: true }
        );

    await interaction.update({ embeds: [updatedEmbed] });
}

function initModule(client) {
    registerSystemListeners(client);
    start60sChannelTelemetryLoop(client);

    client.on('interactionCreate', async (interaction) => {
        if (interaction.isButton()) {
            await handlePolicyVoteButtons(interaction);
        }
    });
}

module.exports = initModule;
module.exports.init = initModule;
module.exports.provisionMasterServerStructure = provisionMasterServerStructure;
module.exports.policyVotePayload = policyVotePayload;
