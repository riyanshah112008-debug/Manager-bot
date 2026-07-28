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

// --- SERVER LISTING SCHEMA (For Web Directory & Bumps) ---
const serverListingSchema = new mongoose.Schema({
    guildId: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    description: { type: String, default: "A mysterious server with no description." },
    iconUrl: { type: String, default: null },
    inviteLink: { type: String, default: "Not generated yet (Run /bump)" },
    memberCount: { type: Number, default: 0 },
    ownerId: { type: String, default: null },
    tags: { type: [String], default: [] },
    bumps: { type: Number, default: 0 },
    lastBump: { type: Date, default: null },
    isNsfw: { type: Boolean, default: false },
    isListed: { type: Boolean, default: true }
});

const ServerListing = mongoose.models.ServerListing || mongoose.model('ServerListing', serverListingSchema);

// --- BUMP SYSTEM CONFIG SCHEMA (For Auto Reminders) ---
const bumpSchema = new mongoose.Schema({
    guildId: { type: String, required: true, unique: true },
    reminderChannelId: { type: String, default: null }, 
    pingRoleId: { type: String, default: null },        
    nextBump: { type: Date, default: null },            
    isReady: { type: Boolean, default: true }           
});

const BumpSystem = mongoose.models.BumpSystem || mongoose.model('BumpSystem', bumpSchema);

// ==========================================
// 2. SLASH COMMAND DEFINITIONS
// ==========================================
const setListingCommand = new SlashCommandBuilder()
    .setName('set-listing')
    .setDescription('Configure how your server appears on the Starry Server Web List!')
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
    .setDescription('Configure the auto-bump reminder system.')
    .addRoleOption(option => 
        option.setName('ping_role')
            .setDescription('The role to ping when the 2-hour cooldown is over.')
            .setRequired(false))
    .addChannelOption(option =>
        option.setName('channel')
            .setDescription('The channel to send the reminder in.')
            .setRequired(false))
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator);

const bumpCommand = new SlashCommandBuilder()
    .setName('bump')
    .setDescription('Bump this server to the top of the Starry Global Web List!');

// ==========================================
// 🌐 3. REST API ENDPOINTS FOR MIKE'S WEB APP
// ==========================================
function setupWebDirectoryAPI(app) {
    if (!app) return;

    // GET /api/servers - Fetch top bumped servers for directory front-page
    app.get('/api/servers', async (req, res) => {
        try {
            const { tag, search, limit = 20, page = 1 } = req.query;
            const query = { isListed: true };

            if (tag) query.tags = { $in: [tag.toLowerCase()] };
            if (search) query.name = { $regex: search, $options: 'i' };

            const servers = await ServerListing.find(query)
                .sort({ lastBump: -1, bumps: -1 })
                .skip((page - 1) * limit)
                .limit(parseInt(limit));

            const total = await ServerListing.countDocuments(query);
            res.json({ success: true, total, page: parseInt(page), servers });
        } catch (err) {
            res.status(500).json({ success: false, error: err.message });
        }
    });

    // GET /api/servers/:guildId - Fetch single server details
    app.get('/api/servers/:guildId', async (req, res) => {
        try {
            const server = await ServerListing.findOne({ guildId: req.params.guildId });
            if (!server) return res.status(404).json({ success: false, message: 'Server not found' });
            res.json({ success: true, server });
        } catch (err) {
            res.status(500).json({ success: false, error: err.message });
        }
    });

    // GET /api/user-guilds/:userId - Fetch all servers where user is Owner/Admin for Mike's Web Dashboard
    app.get('/api/user-guilds/:userId', async (req, res) => {
        try {
            const userServers = await ServerListing.find({ ownerId: req.params.userId });
            res.json({ success: true, count: userServers.length, servers: userServers });
        } catch (err) {
            res.status(500).json({ success: false, error: err.message });
        }
    });
}
// ==========================================
// 4. MAIN ENGINE MODULE FUNCTION
// ==========================================
const bumpEngineModule = (client, expressApp) => {

    // Attach REST API to Express Server if provided
    if (expressApp) setupWebDirectoryAPI(expressApp);

    // Register Commands in client memory
    if (client.commands && typeof client.commands.set === 'function') {
        client.commands.set('set-listing', { data: setListingCommand, execute: handleSetListing });
        client.commands.set('bump-setup', { data: bumpSetupCommand, execute: handleBumpSetup });
        client.commands.set('bump', { data: bumpCommand, execute: handleBump });
    }

    // ==========================================
    // 🔄 AUTOMATIC DISBOARD-STYLE SERVER SYNC
    // ==========================================
    async function syncGuildData(guild) {
        try {
            if (!guild) return;
            const owner = await guild.fetchOwner().catch(() => null);

            let inviteUrl = "Not generated yet (Run /bump)";
            if (guild.members.me.permissions.has(PermissionFlagsBits.CreateInstantInvite)) {
                const defaultChannel = guild.systemChannel || guild.channels.cache.find(c => c.isTextBased() && c.permissionsFor(guild.members.me).has(PermissionFlagsBits.CreateInstantInvite));
                if (defaultChannel) {
                    const invite = await defaultChannel.createInvite({ maxAge: 0, maxUses: 0, reason: 'Starry Web Directory Auto-Sync' }).catch(() => null);
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
                        description: "A mysterious server with no description.",
                        tags: ['discord', 'community']
                    }
                },
                { upsert: true, new: true }
            );
        } catch (e) {
            console.error(`[Directory Sync Error] Failed to sync ${guild.name}:`, e);
        }
    }

    // Sync all joined servers on bot startup
    client.once('ready', async () => {
        console.log('🌐 Synchronizing server directory metadata for Mike\'s website...');
        for (const [id, guild] of client.guilds.cache) {
            await syncGuildData(guild);
        }
        console.log('✅ Disboard-Style Directory Auto-Sync Completed.');
    });

    // Auto-sync when bot joins a new server or member counts change
    client.on('guildCreate', async (guild) => await syncGuildData(guild));
    client.on('guildUpdate', async (oldG, newG) => await syncGuildData(newG));
    client.on('guildMemberAdd', async (m) => await syncGuildData(m.guild));
    client.on('guildMemberRemove', async (m) => await syncGuildData(m.guild));

    // ==========================================
    // ⏰ BACKGROUND COOLDOWN & REMINDER TIMER
    // ==========================================
    setInterval(async () => {
        try {
            const dueBumps = await BumpSystem.find({ nextBump: { $lte: new Date() }, isReady: false });

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
                    .setDescription('The 2-hour cooldown is over! Please run `/bump` (for Starry) and `/bump` (for Disboard) to help our server grow on the global web directory!')
                    .setThumbnail('https://cdn-icons-png.flaticon.com/512/2852/2852825.png') 
                    .setFooter({ text: 'Starry Global Web Bumper' });

                await channel.send({ content: pingText, embeds: [embed] }).catch(() => {});
            }
        } catch (error) {
            console.error('Bump Engine Timer Error:', error);
        }
    }, 60000);
    // ==========================================
    // 📡 DISBOARD & DISCADIA BUMP DETECTORS
    // ==========================================
    client.on('messageCreate', async (message) => {
        if (!message.guild) return;

        let isBump = false;

        // --- 1. DISBOARD BUMP DETECTION ---
        if (message.author.id === '302050872383242240') { 
            if (message.embeds.length > 0 && message.embeds[0].description?.toLowerCase().includes('bump done')) {
                isBump = true;
            }
        }

        // --- 2. DISCADIA BUMP DETECTION ---
        const lowerName = message.author.username.toLowerCase();
        if (lowerName.includes('discardia') || lowerName.includes('discadia') || message.author.id === '839211028308426762') {
            const embed = message.embeds[0];
            if (embed && ((embed.description?.toLowerCase().includes('bump')) || (embed.title?.toLowerCase().includes('bump')))) {
                isBump = true;
            }
        }

        // --- 3. REGISTER COOLDOWN TIMER ---
        if (isBump) {
            const nextTime = new Date(Date.now() + 2 * 60 * 60 * 1000);

            let bumpData = await BumpSystem.findOne({ guildId: message.guild.id });
            if (!bumpData) bumpData = new BumpSystem({ guildId: message.guild.id });

            if (!bumpData.reminderChannelId) bumpData.reminderChannelId = message.channel.id;

            bumpData.nextBump = nextTime;
            bumpData.isReady = false;
            await bumpData.save();

            const embed = new EmbedBuilder()
                .setColor('#3498db')
                .setTitle('✅ Disboard/Discadia Bump Registered!')
                .setDescription(`Thank you for bumping! Starry will remind you here in exactly 2 hours (<t:${Math.floor(nextTime.getTime() / 1000)}:R>).`);

            await message.channel.send({ embeds: [embed] }).catch(() => {});
        }
    });

    // ==========================================
    // ⚙️ COMMAND HANDLERS
    // ==========================================
    
    // --- 1. /set-listing HANDLER ---
    async function handleSetListing(interaction) {
        await interaction.deferReply();

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
        listing.tags = tags;
        listing.iconUrl = interaction.guild.iconURL({ extension: 'png', size: 256 }) || null;
        listing.memberCount = interaction.guild.memberCount;
        await listing.save();

        const embed = new EmbedBuilder()
            .setColor('#5865F2')
            .setTitle('🌐 Server Directory Profile Updated!')
            .setDescription('Your server card has been synced with the Starry Global Web Directory.')
            .addFields(
                { name: 'Description', value: description },
                { name: 'Tags', value: tags.length > 0 ? tags.map(t => `\`${t}\``).join(' ') : 'None' }
            )
            .setThumbnail(listing.iconUrl)
            .setFooter({ text: 'Mike\'s Starry Directory App Ready' });

        return interaction.editReply({ embeds: [embed] });
    }

    // --- 2. /bump-setup HANDLER ---
    async function handleBumpSetup(interaction) {
        await interaction.deferReply();

        const pingRole = interaction.options.getRole('ping_role');
        const channel = interaction.options.getChannel('channel');

        let bumpData = await BumpSystem.findOne({ guildId: interaction.guild.id });
        if (!bumpData) bumpData = new BumpSystem({ guildId: interaction.guild.id });

        if (pingRole) bumpData.pingRoleId = pingRole.id;
        if (channel) bumpData.reminderChannelId = channel.id;

        await bumpData.save();

        const embed = new EmbedBuilder()
            .setColor('#5865F2')
            .setTitle('⚙️ Auto-Bump Reminders Configured')
            .setDescription('The bump reminder engine preferences have been saved!')
            .addFields(
                { name: 'Reminder Channel', value: bumpData.reminderChannelId ? `<#${bumpData.reminderChannelId}>` : '`Not Set (Defaults to current channel)`', inline: true },
                { name: 'Role to Ping', value: bumpData.pingRoleId ? `<@&${bumpData.pingRoleId}>` : '`None`', inline: true }
            );

        return interaction.editReply({ embeds: [embed] });
    }
    // --- 3. /bump HANDLER ---
    async function handleBump(interaction) {
        await interaction.deferReply();
        const guild = interaction.guild;

        if (!guild.members.me.permissions.has(PermissionFlagsBits.CreateInstantInvite)) {
            return interaction.editReply('❌ I need the **Create Invites** permission in this channel to list this server on the web directory!');
        }

        let listing = await ServerListing.findOne({ guildId: guild.id });
        const cooldown = 2 * 60 * 60 * 1000; // 2 hours

        if (listing && listing.lastBump && (Date.now() - listing.lastBump.getTime() < cooldown)) {
            const nextBump = Math.floor((listing.lastBump.getTime() + cooldown) / 1000);
            return interaction.editReply(`⏳ **Cooldown Active!** You can bump Starry's directory again <t:${nextBump}:R>.`);
        }

        let invite;
        try {
            invite = await interaction.channel.createInvite({ maxAge: 0, maxUses: 0, reason: 'Starry Server Web Directory Listing' });
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

        // Update Bump System reminder state
        let bumpData = await BumpSystem.findOne({ guildId: guild.id });
        if (!bumpData) bumpData = new BumpSystem({ guildId: guild.id });

        bumpData.reminderChannelId = interaction.channel.id;
        bumpData.nextBump = new Date(Date.now() + cooldown);
        bumpData.isReady = false;
        await bumpData.save();

        const embed = new EmbedBuilder()
            .setColor('#3BA55C')
            .setTitle('🚀 Server Bumped!')
            .setDescription(`**${guild.name}** has been pushed to the top of the Global Web List!`)
            .addFields(
                { name: 'Total Bumps', value: `📈 \`${listing.bumps}\``, inline: true },
                { name: 'Next Bump', value: `⏳ <t:${Math.floor((Date.now() + cooldown) / 1000)}:R>`, inline: true }
            )
            .setThumbnail(listing.iconUrl)
            .setFooter({ text: 'Starry Global Web Directory' });

        return interaction.editReply({ embeds: [embed] });
    }

    // Unified Slash Listener Fallback
    client.on('interactionCreate', async (interaction) => {
        if (!interaction.isChatInputCommand()) return;
        if (interaction.commandName === 'set-listing') await handleSetListing(interaction);
        if (interaction.commandName === 'bump-setup') await handleBumpSetup(interaction);
        if (interaction.commandName === 'bump') await handleBump(interaction);
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

bumpEngineModule.commands = [setListingCommand, bumpSetupCommand, bumpCommand];

module.exports = bumpEngineModule;
