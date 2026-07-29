// ==========================================
// 1. IMPORTS & MONGOOSE SCHEMAS
// ==========================================
const { 
    EmbedBuilder, 
    PermissionsBitField, 
    SlashCommandBuilder, 
    PermissionFlagsBits, 
    ActionRowBuilder, 
    ButtonBuilder, 
    ButtonStyle 
} = require('discord.js');
const mongoose = require('mongoose');

// Permanent Netlify Web URL
const STARRY_WEB_URL = 'https://stately-fox-454bb4.netlify.app';

// --- SERVER LISTING SCHEMA (For Web Directory & Bumps) ---
const serverListingSchema = new mongoose.Schema({
    guildId: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    description: { type: String, default: "A vibrant community on Starryboard!" },
    iconUrl: { type: String, default: null },
    inviteLink: { type: String, default: "Not generated yet (Run /bump)" },
    memberCount: { type: Number, default: 0 },
    ownerId: { type: String, default: null },
    tags: { type: [String], default: ['community', 'discord'] },
    bumps: { type: Number, default: 0 },
    lastBump: { type: Date, default: null },
    isNsfw: { type: Boolean, default: false },
    isListed: { type: Boolean, default: true }
});

const ServerListing = mongoose.models.ServerListing || mongoose.model('ServerListing', serverListingSchema);

// --- BUMP SYSTEM CONFIG SCHEMA ---
const bumpSchema = new mongoose.Schema({
    guildId: { type: String, required: true, unique: true },
    reminderChannelId: { type: String, default: null }, 
    pingRoleId: { type: String, default: null },        
    nextBump: { type: Date, default: null },            
    isReady: { type: Boolean, default: true },
    autoBumpEnabled: { type: Boolean, default: false }
});

const BumpSystem = mongoose.models.BumpSystem || mongoose.model('BumpSystem', bumpSchema);
// ==========================================
// 2. SLASH COMMAND DEFINITIONS
// ==========================================
const setListingCommand = new SlashCommandBuilder()
    .setName('set-listing')
    .setDescription('Configure how your server appears on the Starryboard Web Directory!')
    .addStringOption(option => 
        option.setName('description')
            .setDescription('A short description of your server (Max 150 chars)')
            .setRequired(true)
            .setMaxLength(150))
    .addStringOption(option => 
        option.setName('tags')
            .setDescription('Comma-separated tags (e.g., Gaming, Anime, Chill)')
            .setRequired(false))
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator);

const bumpSetupCommand = new SlashCommandBuilder()
    .setName('bump-setup')
    .setDescription('Configure the auto-bump reminder system & Premium Auto-Bumper.')
    .addRoleOption(option => 
        option.setName('ping_role')
            .setDescription('The role to ping when the 2-hour cooldown is over.')
            .setRequired(false))
    .addChannelOption(option =>
        option.setName('channel')
            .setDescription('The channel to send reminders and auto-bump logs in.')
            .setRequired(false))
    .addBooleanOption(option =>
        option.setName('auto_bump')
            .setDescription('💎 Premium Only: Enable 24/7 Automatic Bumping every 2 hours.')
            .setRequired(false))
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator);

const bumpCommand = new SlashCommandBuilder()
    .setName('bump')
    .setDescription('Bump this server to the top of the Starryboard Directory!');

const autoBumpCommand = new SlashCommandBuilder()
    .setName('autobump')
    .setDescription('💎 Premium: Enable or disable 24/7 automatic bumping every 2 hours!')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator);

// ==========================================
// 🌐 3. REST API ENDPOINTS FOR WEB APP
// ==========================================
function setupWebDirectoryAPI(app) {
    if (!app) return;

    // GET /api/v1/servers/recently-bumped - Homepage Feed
    app.get('/api/v1/servers/recently-bumped', async (req, res) => {
        try {
            const limit = parseInt(req.query.limit) || 6;
            const servers = await ServerListing.find({ isListed: true })
                .sort({ lastBump: -1, bumps: -1 })
                .limit(limit);

            const formatted = servers.map(s => ({
                id: s.guildId,
                name: s.name,
                icon: s.iconUrl || 'https://picsum.photos/100/100?blur=2',
                onlineCount: Math.floor(s.memberCount * 0.35) || 10,
                bumpedTime: s.lastBump ? getTimeAgo(s.lastBump) : 'recently',
                rating: 5.0,
                reviewCount: s.bumps,
                description: s.description,
                tags: s.tags,
                inviteUrl: s.inviteLink
            }));

            res.json({ success: true, data: formatted });
        } catch (err) {
            res.status(500).json({ success: false, error: err.message });
        }
    });

    // GET /api/v1/servers - Full Search & Directory Feed
    app.get('/api/v1/servers', async (req, res) => {
        try {
            const { q, sort = 'bumped', page = 1, limit = 12, nsfw = 0 } = req.query;
            const query = { isListed: true };

            if (nsfw === '0') query.isNsfw = false;
            if (q) {
                query.$or = [
                    { name: { $regex: q, $options: 'i' } },
                    { tags: { $in: [q.toLowerCase()] } },
                    { description: { $regex: q, $options: 'i' } }
                ];
            }

            let sortOption = { lastBump: -1 };
            if (sort === 'members') sortOption = { memberCount: -1 };
            if (sort === 'newest') sortOption = { _id: -1 };

            const skip = (parseInt(page) - 1) * parseInt(limit);
            const total = await ServerListing.countDocuments(query);
            const rawList = await ServerListing.find(query).sort(sortOption).skip(skip).limit(parseInt(limit));

            const list = rawList.map(s => ({
                id: s.guildId,
                name: s.name,
                icon: s.iconUrl || 'https://picsum.photos/100/100?blur=2',
                onlineCount: Math.floor(s.memberCount * 0.35) || 10,
                bumpedTime: s.lastBump ? getTimeAgo(s.lastBump) : 'recently',
                rating: 5.0,
                reviewCount: s.bumps,
                description: s.description,
                tags: s.tags,
                inviteUrl: s.inviteLink
            }));

            res.json({ success: true, data: { total, list } });
        } catch (err) {
            res.status(500).json({ success: false, error: err.message });
        }
    });
}

function getTimeAgo(date) {
    const seconds = Math.floor((new Date() - new Date(date)) / 1000);
    if (seconds < 60) return `${seconds}s ago`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    return `${Math.floor(hours / 24)}d ago`;
}
// ==========================================
// 4. MAIN ENGINE MODULE FUNCTION
// ==========================================
const bumpEngineModule = (client, expressApp) => {

    if (expressApp) setupWebDirectoryAPI(expressApp);

    if (client.commands && typeof client.commands.set === 'function') {
        client.commands.set('set-listing', { data: setListingCommand, execute: handleSetListing });
        client.commands.set('bump-setup', { data: bumpSetupCommand, execute: handleBumpSetup });
        client.commands.set('bump', { data: bumpCommand, execute: handleBump });
        client.commands.set('autobump', { data: autoBumpCommand, execute: handleAutoBump });
    }

    // --- AUTOMATIC SERVER SYNC ---
    async function syncGuildData(guild) {
        try {
            if (!guild) return;
            const owner = await guild.fetchOwner().catch(() => null);

            let inviteUrl = "Not generated yet (Run /bump)";
            if (guild.members.me.permissions.has(PermissionFlagsBits.CreateInstantInvite)) {
                const defaultChannel = guild.systemChannel || guild.channels.cache.find(c => c.isTextBased() && c.permissionsFor(guild.members.me).has(PermissionFlagsBits.CreateInstantInvite));
                if (defaultChannel) {
                    const invite = await defaultChannel.createInvite({ maxAge: 0, maxUses: 0, reason: 'Starryboard Directory Auto-Sync' }).catch(() => null);
                    if (invite) inviteUrl = invite.url;
                }
            }

            await ServerListing.findOneAndUpdate(
                { guildId: guild.id },
                {
                    guildId: guild.id,
                    name: guild.name,
                    iconUrl: guild.iconURL({ extension: 'png', size: 256 }) || null,
                    memberCount: guild.memberCount,
                    ownerId: owner ? owner.id : null,
                    $setOnInsert: {
                        inviteLink: inviteUrl,
                        description: "A vibrant community on Starryboard!",
                        tags: ['discord', 'community']
                    }
                },
                { upsert: true, new: true }
            );
        } catch (e) {
            console.error(`[Directory Sync Error] Failed to sync ${guild.name}:`, e);
        }
    }

    client.once('ready', async () => {
        console.log('🌐 Synchronizing server metadata for Starryboard...');
        for (const [id, guild] of client.guilds.cache) {
            await syncGuildData(guild);
        }
        console.log('✅ Starryboard Auto-Sync Completed.');
    });

    client.on('guildCreate', async (guild) => await syncGuildData(guild));
    client.on('guildUpdate', async (oldG, newG) => await syncGuildData(newG));
    client.on('guildMemberAdd', async (m) => await syncGuildData(m.guild));
    client.on('guildMemberRemove', async (m) => await syncGuildData(m.guild));

    // --- 💎 1. PREMIUM 24/7 AUTO-BUMP WORKER ---
    setInterval(async () => {
        try {
            const now = new Date();
            const twoHours = 2 * 60 * 60 * 1000;

            const autoBumpConfigs = await BumpSystem.find({ autoBumpEnabled: true });

            for (const config of autoBumpConfigs) {
                const guild = client.guilds.cache.get(config.guildId);
                if (!guild) continue;

                const isPremium = typeof client.isPremium === 'function' ? client.isPremium(guild.id) : false;
                if (!isPremium) {
                    config.autoBumpEnabled = false;
                    await config.save();
                    continue;
                }

                let listing = await ServerListing.findOne({ guildId: guild.id });
                if (!listing) listing = new ServerListing({ guildId: guild.id, name: guild.name });

                if (!listing.lastBump || (now.getTime() - listing.lastBump.getTime() >= twoHours)) {
                    
                    let inviteUrl = listing.inviteLink;
                    if (guild.members.me.permissions.has(PermissionFlagsBits.CreateInstantInvite)) {
                        const channel = guild.systemChannel || guild.channels.cache.find(c => c.isTextBased() && c.permissionsFor(guild.members.me).has(PermissionFlagsBits.CreateInstantInvite));
                        if (channel) {
                            const inv = await channel.createInvite({ maxAge: 0, maxUses: 0, reason: 'Starryboard Auto-Bump' }).catch(() => null);
                            if (inv) inviteUrl = inv.url;
                        }
                    }

                    listing.name = guild.name;
                    listing.iconUrl = guild.iconURL({ extension: 'png', size: 256 }) || null;
                    listing.memberCount = guild.memberCount;
                    listing.inviteLink = inviteUrl;
                    listing.bumps = (listing.bumps || 0) + 1;
                    listing.lastBump = now;
                    await listing.save();

                    config.nextBump = new Date(now.getTime() + twoHours);
                    config.isReady = false;
                    await config.save();

                    const logChannel = guild.channels.cache.get(config.reminderChannelId) || guild.systemChannel;
                    if (logChannel) {
                        const embed = new EmbedBuilder()
                            .setColor('#00F2FE')
                            .setTitle('💎 Premium Auto-Bump Executed!')
                            .setDescription(`**${guild.name}** was automatically bumped to the top of **[Starryboard](${STARRY_WEB_URL})**!\n\n📈 Total Bumps: \`${listing.bumps}\`\n⏳ Next Auto-Bump: <t:${Math.floor((now.getTime() + twoHours) / 1000)}:R>`)
                            .setThumbnail(listing.iconUrl)
                            .setFooter({ text: 'Starryboard Premium Engine' });

                        const row = new ActionRowBuilder().addComponents(
                            new ButtonBuilder()
                                .setLabel('View on Starryboard')
                                .setStyle(ButtonStyle.Link)
                                .setURL(STARRY_WEB_URL)
                        );

                        await logChannel.send({ embeds: [embed], components: [row] }).catch(() => {});
                    }
                }
            }
        } catch (error) {
            console.error('Premium Auto-Bump Worker Error:', error);
        }
    }, 2 * 60 * 1000);

    // --- ⏰ 2. COOLDOWN REMINDER TIMER ---
    setInterval(async () => {
        try {
            const dueBumps = await BumpSystem.find({ nextBump: { $lte: new Date() }, isReady: false, autoBumpEnabled: false });

            for (const data of dueBumps) {
                data.isReady = true;
                await data.save();

                const guild = client.guilds.cache.get(data.guildId);
                if (!guild) continue;

                const channel = guild.channels.cache.get(data.reminderChannelId) || guild.systemChannel;
                if (!channel) continue;

                const pingText = data.pingRoleId ? `<@&${data.pingRoleId}>` : '';

                const embed = new EmbedBuilder()
                    .setColor('#2ecc71')
                    .setTitle('🚀 It is time to Bump!')
                    .setDescription(`The 2-hour cooldown is over! Run \`/bump\` to push your server to the top of **[Starryboard](${STARRY_WEB_URL})**!`)
                    .setThumbnail(guild.iconURL({ extension: 'png' }) || 'https://cdn-icons-png.flaticon.com/512/2852/2852825.png') 
                    .setFooter({ text: 'Starryboard Global Bumper' });

                const row = new ActionRowBuilder().addComponents(
                    new ButtonBuilder()
                        .setLabel('View Starryboard')
                        .setStyle(ButtonStyle.Link)
                        .setURL(STARRY_WEB_URL)
                );

                await channel.send({ content: pingText, embeds: [embed], components: [row] }).catch(() => {});
            }
        } catch (error) {
            console.error('Bump Engine Timer Error:', error);
        }
    }, 60000);
    // --- ⚙️ COMMAND HANDLERS ---
    async function handleSetListing(interaction) {
        try {
            if (!interaction.deferred && !interaction.replied) await interaction.deferReply();
        } catch (e) { return; }

        const description = interaction.options.getString('description');
        const tagsInput = interaction.options.getString('tags') || '';
        const tags = tagsInput.split(',').map(tag => tag.trim().toLowerCase().substring(0, 15)).filter(t => t.length > 0).slice(0, 5);

        let listing = await ServerListing.findOne({ guildId: interaction.guild.id });

        if (!listing) {
            const owner = await interaction.guild.fetchOwner().catch(() => null);
            listing = new ServerListing({
                guildId: interaction.guild.id,
                name: interaction.guild.name,
                ownerId: owner ? owner.id : null,
                inviteLink: 'Not generated yet (Run /bump)'
            });
        }

        listing.description = description;
        listing.tags = tags.length > 0 ? tags : ['community'];
        listing.iconUrl = interaction.guild.iconURL({ extension: 'png', size: 256 }) || null;
        listing.memberCount = interaction.guild.memberCount;
        await listing.save();

        const embed = new EmbedBuilder()
            .setColor('#5865F2')
            .setTitle('🌐 Server Profile Synced!')
            .setDescription(`Your server card has been updated on **[Starryboard](${STARRY_WEB_URL})**!`)
            .addFields(
                { name: 'Description', value: description },
                { name: 'Tags', value: listing.tags.map(t => `\`${t}\``).join(' ') }
            )
            .setThumbnail(listing.iconUrl)
            .setFooter({ text: 'Starryboard Directory Engine' });

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setLabel('View on Starryboard')
                .setStyle(ButtonStyle.Link)
                .setURL(STARRY_WEB_URL)
        );

        return interaction.editReply({ embeds: [embed], components: [row] });
    }

    async function handleBumpSetup(interaction) {
        try {
            if (!interaction.deferred && !interaction.replied) await interaction.deferReply();
        } catch (e) { return; }

        const pingRole = interaction.options.getRole('ping_role');
        const channel = interaction.options.getChannel('channel');
        const autoBumpOpt = interaction.options.getBoolean('auto_bump');

        let bumpData = await BumpSystem.findOne({ guildId: interaction.guild.id });
        if (!bumpData) bumpData = new BumpSystem({ guildId: interaction.guild.id });

        if (pingRole) bumpData.pingRoleId = pingRole.id;
        if (channel) bumpData.reminderChannelId = channel.id;

        let autoBumpMsg = '`Disabled`';

        if (autoBumpOpt !== null) {
            const isPremium = typeof client.isPremium === 'function' ? client.isPremium(interaction.guildId, interaction.user.id) : false;

            if (autoBumpOpt && !isPremium) {
                return interaction.editReply({ 
                    content: '💎 **Premium Feature!** Auto-Bump is exclusive to Premium servers. Contact the bot owner to upgrade!' 
                });
            }

            bumpData.autoBumpEnabled = autoBumpOpt;
            autoBumpMsg = autoBumpOpt ? '💎 `Enabled (24/7 Bumping)`' : '`Disabled`';
        } else {
            autoBumpMsg = bumpData.autoBumpEnabled ? '💎 `Enabled (24/7 Bumping)`' : '`Disabled`';
        }

        await bumpData.save();

        const embed = new EmbedBuilder()
            .setColor('#5865F2')
            .setTitle('⚙️ Bump Preferences Saved')
            .setDescription('Your auto-bump notification preferences are ready!')
            .addFields(
                { name: 'Reminder Channel', value: bumpData.reminderChannelId ? `<#${bumpData.reminderChannelId}>` : '`Current Channel`', inline: true },
                { name: 'Ping Role', value: bumpData.pingRoleId ? `<@&${bumpData.pingRoleId}>` : '`None`', inline: true },
                { name: '24/7 Auto-Bump', value: autoBumpMsg, inline: false }
            );

        return interaction.editReply({ embeds: [embed] });
    }

    // --- 🚀 /bump HANDLER ---
    async function handleBump(interaction) {
        try {
            if (!interaction.deferred && !interaction.replied) await interaction.deferReply();
        } catch (e) { return; }

        const guild = interaction.guild;

        if (!guild.members.me.permissions.has(PermissionFlagsBits.CreateInstantInvite)) {
            return interaction.editReply('❌ I need **Create Invites** permission in this channel to feature your server on the web list!');
        }

        let listing = await ServerListing.findOne({ guildId: guild.id });
        const cooldown = 2 * 60 * 60 * 1000;

        if (listing && listing.lastBump && (Date.now() - listing.lastBump.getTime() < cooldown)) {
            const nextBump = Math.floor((listing.lastBump.getTime() + cooldown) / 1000);
            return interaction.editReply(`⏳ **Cooldown Active!** You can bump again <t:${nextBump}:R>.`);
        }

        let invite;
        try {
            invite = await interaction.channel.createInvite({ maxAge: 0, maxUses: 0, reason: 'Starryboard Web Listing' });
        } catch (e) {
            return interaction.editReply('❌ Could not create a permanent invite link for this channel.');
        }

        const owner = await guild.fetchOwner().catch(() => null);

        if (!listing) {
            listing = new ServerListing({ guildId: guild.id });
        }

        listing.name = guild.name;
        listing.iconUrl = guild.iconURL({ extension: 'png', size: 256 }) || null;
        listing.inviteLink = invite.url;
        listing.memberCount = guild.memberCount;
        listing.ownerId = owner ? owner.id : listing.ownerId;
        listing.bumps = (listing.bumps || 0) + 1;
        listing.lastBump = new Date();

        await listing.save();

        let bumpData = await BumpSystem.findOne({ guildId: guild.id });
        if (!bumpData) bumpData = new BumpSystem({ guildId: guild.id });

        bumpData.reminderChannelId = interaction.channel.id;
        bumpData.nextBump = new Date(Date.now() + cooldown);
        bumpData.isReady = false;
        await bumpData.save();

        const embed = new EmbedBuilder()
            .setColor('#00F2FE')
            .setTitle('🚀 Server Bumped Successfully!')
            .setDescription(`**${guild.name}** has been pushed to the top of **[Starryboard](${STARRY_WEB_URL})**!`)
            .addFields(
                { name: 'Total Bumps', value: `📈 \`${listing.bumps}\``, inline: true },
                { name: 'Next Bump', value: `⏳ <t:${Math.floor((Date.now() + cooldown) / 1000)}:R>`, inline: true }
            )
            .setThumbnail(listing.iconUrl)
            .setFooter({ text: 'Starryboard Global Bumper' });

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setLabel('View on Starryboard')
                .setStyle(ButtonStyle.Link)
                .setURL(STARRY_WEB_URL)
        );

        return interaction.editReply({ embeds: [embed], components: [row] });
    }

    async function handleAutoBump(interaction) {
        try {
            if (!interaction.deferred && !interaction.replied) await interaction.deferReply({ ephemeral: true });
        } catch (e) { return; }

        const isPremium = typeof client.isPremium === 'function' ? client.isPremium(interaction.guildId, interaction.user.id) : false;

        if (!isPremium) {
            return interaction.editReply({ 
                content: '💎 **Premium Feature!** Auto-Bump is exclusive to Premium servers. Contact the bot owner to upgrade!' 
            });
        }

        let bumpData = await BumpSystem.findOne({ guildId: interaction.guild.id });
        if (!bumpData) bumpData = new BumpSystem({ guildId: interaction.guild.id });

        bumpData.autoBumpEnabled = !bumpData.autoBumpEnabled;
        await bumpData.save();

        const statusText = bumpData.autoBumpEnabled ? 'ENABLED (24/7 Auto-Bumping Active 🚀)' : 'DISABLED';

        const embed = new EmbedBuilder()
            .setColor(bumpData.autoBumpEnabled ? '#00F2FE' : '#ED4245')
            .setTitle('💎 Auto-Bump Status Updated')
            .setDescription(`24/7 Auto-Bump is now **${statusText}** for **${interaction.guild.name}**!`)
            .setFooter({ text: 'Starryboard Premium Engine' });

        return interaction.editReply({ embeds: [embed] });
    }

    // Interaction Router
    client.on('interactionCreate', async (interaction) => {
        if (!interaction.isChatInputCommand()) return;
        if (interaction.commandName === 'set-listing') await handleSetListing(interaction);
        if (interaction.commandName === 'bump-setup') await handleBumpSetup(interaction);
        if (interaction.commandName === 'bump') await handleBump(interaction);
        if (interaction.commandName === 'autobump') await handleAutoBump(interaction);
    });
};

// ==========================================
// 5. HYBRID MODULE EXPORTS
// ==========================================
bumpEngineModule.ServerListing = ServerListing;
bumpEngineModule.BumpSystem = BumpSystem;

bumpEngineModule.setListingData = setListingCommand;
bumpEngineModule.bumpSetupData = bumpSetupCommand;
bumpEngineModule.bumpData = bumpCommand;
bumpEngineModule.autoBumpData = autoBumpCommand;

bumpEngineModule.commands = [setListingCommand, bumpSetupCommand, bumpCommand, autoBumpCommand];

module.exports = bumpEngineModule;
