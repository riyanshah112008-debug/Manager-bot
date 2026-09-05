// ==========================================
// 🚀 STARRY SUPREME GLOBAL DEPLOY ENGINE
// File Path: deploy-commands.js
// ==========================================
require('dotenv').config();
const { 
    REST, 
    Routes, 
    PermissionFlagsBits, 
    SlashCommandBuilder, 
    ContextMenuCommandBuilder,
    ApplicationCommandType,
    ApplicationIntegrationType,
    InteractionContextType,
    ChannelType 
} = require('discord.js');

const ADMIN = PermissionFlagsBits.Administrator.toString();
const MANAGE_ROLES = PermissionFlagsBits.ManageRoles.toString();
const MANAGE_CHANNELS = PermissionFlagsBits.ManageChannels.toString();
const MODERATE_MEMBERS = PermissionFlagsBits.ModerateMembers.toString();

// Helper to safely require modules across relative path variants
function safeRequire(paths) {
    for (const p of paths) {
        try {
            return require(p);
        } catch (e) {
            // Continue candidate search
        }
    }
    return null;
}

// 1. BUILD AUTOROLE COMMAND DEFINITION
const autoroleOptions = [
    { name: 'sticky_roles', type: 5, required: false, description: 'Enable or disable restoring previous roles on rejoin' }
];

for (let i = 1; i <= 24; i++) {
    autoroleOptions.push({ name: `role${i}`, type: 8, required: false, description: `Select role #${i} to add to the autorole list` });
}

const autoroleCommandDef = {
    name: 'autorole',
    description: 'Set up multiple autoroles for when members join',
    default_member_permissions: ADMIN,
    options: autoroleOptions
};

// 2. SAFELY IMPORT ALL MODULE PAYLOADS
let masterPayloads = [];

// Master Systems Payloads (Starry Module)
const masterModule = safeRequire(['./src/modules/starry', './modules/starry', './src/modules/masterChannelSystems', './modules/masterChannelSystems']);
if (masterModule) {
    if (masterModule.modMasterPayload) masterPayloads.push(masterModule.modMasterPayload);
    if (masterModule.autoModMasterPayload) masterPayloads.push(masterModule.autoModMasterPayload);
    if (masterModule.moderateMasterPayload) masterPayloads.push(masterModule.moderateMasterPayload);
    if (masterModule.verifySetupPayload) masterPayloads.push(masterModule.verifySetupPayload);
    if (masterModule.emergencyNukePayload) masterPayloads.push(masterModule.emergencyNukePayload);
    if (masterModule.emergencyLockdownPayload) masterPayloads.push(masterModule.emergencyLockdownPayload);
    if (masterModule.emergencySecurePayload) masterPayloads.push(masterModule.emergencySecurePayload);
    if (masterModule.emergencyUnbanPayload) masterPayloads.push(masterModule.emergencyUnbanPayload);
    if (masterModule.policyVotePayload) masterPayloads.push(masterModule.policyVotePayload);
}

// Tracker Payload
const trackerModule = safeRequire(['./src/modules/tracker', './modules/tracker']);
if (trackerModule && trackerModule.data) {
    masterPayloads.push(trackerModule.data.toJSON ? trackerModule.data.toJSON() : trackerModule.data);
}

// Counting Module
const countModule = safeRequire(['./src/modules/count', './modules/count']);
if (countModule && countModule.countSlashCommands) {
    masterPayloads.push(...countModule.countSlashCommands);
}

// AFK Command Payload
const afkModule = safeRequire(['./src/modules/afk', './modules/afk']);
if (afkModule && afkModule.afkPayload) {
    masterPayloads.push(afkModule.afkPayload);
}

// Bump Engine Payloads
const bumpModule = safeRequire(['./src/modules/bumpEngine', './modules/bumpEngine']);
if (bumpModule && bumpModule.bumpSlashCommands) {
    masterPayloads.push(...bumpModule.bumpSlashCommands);
}

// Backup Engine Payload
const backupModule = safeRequire([
    './src/modules/serverBackupManager', 
    './modules/serverBackupManager', 
    './src/modules/backupEngine', 
    './modules/backupEngine'
]);
if (backupModule && backupModule.backupCommandPayload) {
    masterPayloads.push(backupModule.backupCommandPayload);
}

// Confession Engine Payload
const confessionModule = safeRequire(['./src/modules/confession', './modules/confession']);
if (confessionModule && confessionModule.confessionSetupPayload) {
    masterPayloads.push(confessionModule.confessionSetupPayload);
}

// Translator Engine Payload
const translatorModule = safeRequire(['./src/modules/translator', './modules/translator']);
if (translatorModule) {
    if (translatorModule.translatorPayload) masterPayloads.push(translatorModule.translatorPayload);
    if (translatorModule.translateContextPayload) masterPayloads.push(translatorModule.translateContextPayload);
}

const socialModule = safeRequire(['./src/modules/socialActions', './modules/socialActions']);

const commands = [
    ...masterPayloads,

    // TELEMETRY & VOICE
    { name: 'telemetry', description: '📡 Bot Owner Only: Receive an immediate telemetry report in your DMs.', default_member_permissions: '8' },
    { name: 'callstarry', description: '📞 Call Starry for a private 1-on-1 human-like AI voice call! (Premium Only)' },
    { name: 'djpanel', description: '🎛️ Post the ultimate interactive Starry DJ & Voice Control Hub', default_member_permissions: '16' },

    // MUSIC COMMANDS
    { name: 'play', description: 'Play a song from SoundCloud or Spotify', options: [{ name: 'song', type: 3, required: true, description: 'Song name, SoundCloud URL, or Spotify URL' }] },
    { name: 'pause', description: 'Pause the currently playing song' },
    { name: 'resume', description: 'Resume the paused song' },
    { name: 'skip', description: 'Skip the current song' },
    { name: 'stop', description: 'Stop the music and clear the queue' },
    { name: 'queue', description: 'View and interactively manage the current music queue' },
    { name: 'volume', description: 'Change the music volume', options: [{ name: 'amount', type: 4, required: true, description: 'Volume from 1 to 100', min_value: 1, max_value: 100 }] },
    { name: 'autoplay', description: 'Toggles automatic music playback (Premium Only)' },

    // 🌟 SETUP WELCOME COMMAND
    new SlashCommandBuilder()
        .setName('setupwelcome')
        .setDescription('Set up the channel for automated server welcome messages')
        .addChannelOption(option => 
            option.setName('channel')
                .setDescription('The text channel to send welcome cards in')
                .addChannelTypes(ChannelType.GuildText)
                .setRequired(true)
        )
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
        .toJSON(),

    // 👋 SETUP GOODBYE COMMAND
    new SlashCommandBuilder()
        .setName('setupgoodbye')
        .setDescription('Set up the channel for automated server goodbye messages')
        .addChannelOption(option => 
            option.setName('channel')
                .setDescription('The text channel to send goodbye cards in')
                .addChannelTypes(ChannelType.GuildText)
                .setRequired(true)
        )
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
        .toJSON(),

    // 🔍 GLOBAL USER APP WHOIS COMMAND
    new SlashCommandBuilder()
        .setName('whois')
        .setDescription('🔍 Lookup detailed information and permissions for a user')
        .setIntegrationTypes(
            ApplicationIntegrationType.GuildInstall, 
            ApplicationIntegrationType.UserInstall
        )
        .setContexts(
            InteractionContextType.Guild, 
            InteractionContextType.BotDM, 
            InteractionContextType.PrivateChannel
        )
        .addUserOption(option => 
            option.setName('target')
                .setDescription('Select the member you want to look up')
                .setRequired(false)
        )
        .toJSON(),

    // 📊 SINGLE LEVELING SLASH COMMAND
    new SlashCommandBuilder()
        .setName('enableleveling')
        .setDescription('⚙️ Enable leveling system and select log channel')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addChannelOption(option =>
            option.setName('channel')
                .setDescription('Select channel for level-up notifications')
                .addChannelTypes(ChannelType.GuildText)
                .setRequired(false)
        )
        .toJSON(),

    // 🎫 TICKET & APPLICATION SETUP SLASH COMMANDS
    new SlashCommandBuilder()
        .setName('ticketsetup')
        .setDescription('🎫 Create the support ticket panel in this channel')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .toJSON(),

    new SlashCommandBuilder()
        .setName('applysetup')
        .setDescription('📋 Create the staff & partner application panel in this channel')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .toJSON(),

    // 🎨 AI IMAGE GENERATION SLASH COMMANDS (Usable in Guilds, DMs, & Group Chats)
    new SlashCommandBuilder()
        .setName('imagine')
        .setDescription('🎨 Generate stunning high-resolution AI art and images using Flux/SDXL neural engines')
        .setIntegrationTypes(
            ApplicationIntegrationType.GuildInstall, 
            ApplicationIntegrationType.UserInstall
        )
        .setContexts(
            InteractionContextType.Guild, 
            InteractionContextType.BotDM, 
            InteractionContextType.PrivateChannel
        )
        .addStringOption(option => 
            option.setName('prompt')
                .setDescription('Detailed text description of the image to generate')
                .setRequired(true)
        )
        .toJSON(),

    new SlashCommandBuilder()
        .setName('image')
        .setDescription('🎨 Generate AI images and artwork from text prompts')
        .setIntegrationTypes(
            ApplicationIntegrationType.GuildInstall, 
            ApplicationIntegrationType.UserInstall
        )
        .setContexts(
            InteractionContextType.Guild, 
            InteractionContextType.BotDM, 
            InteractionContextType.PrivateChannel
        )
        .addStringOption(option => 
            option.setName('prompt')
                .setDescription('Detailed text description of the image to generate')
                .setRequired(true)
        )
        .toJSON(),

    // 📥 GLOBAL EMOJI & STICKER STEALER COMMANDS
    new SlashCommandBuilder()
        .setName('steal')
        .setDescription('📥 Steal emojis or stickers from text or messages')
        .setIntegrationTypes(
            ApplicationIntegrationType.GuildInstall, 
            ApplicationIntegrationType.UserInstall
        )
        .setContexts(
            InteractionContextType.Guild, 
            InteractionContextType.BotDM, 
            InteractionContextType.PrivateChannel
        )
        .addStringOption(option => 
            option.setName('emojis')
                .setDescription('Paste emojis or text containing emojis to steal')
                .setRequired(true)
        )
        .toJSON(),

    new ContextMenuCommandBuilder()
        .setName('Steal Emojis')
        .setType(ApplicationCommandType.Message)
        .setIntegrationTypes(
            ApplicationIntegrationType.GuildInstall, 
            ApplicationIntegrationType.UserInstall
        )
        .setContexts(
            InteractionContextType.Guild, 
            InteractionContextType.BotDM, 
            InteractionContextType.PrivateChannel
        )
        .toJSON()
];

if (socialModule && socialModule.socialCommandPayload) {
    commands.push(socialModule.socialCommandPayload);
}

// Direct Social Action Slash Commands (Top-Level)
const directSocials = ['highfive', 'hug', 'kiss', 'pat', 'slap', 'cuddle', 'bite', 'poke', 'punch', 'tickle', 'feed', 'lick', 'wave', 'handhold', 'bonk'];
for (const act of directSocials) {
    commands.push(
        new SlashCommandBuilder()
            .setName(act)
            .setDescription(`${act.charAt(0).toUpperCase() + act.slice(1)} a member with an animated anime GIF!`)
            .setContexts([0, 1, 2])
            .setIntegrationTypes([0, 1])
            .addUserOption(opt => opt.setName('target').setDescription('Target member').setRequired(true))
            .toJSON()
    );
}

// ✨ AI, SETPREFIX & TOP.GG VOTE SLASH COMMANDS
commands.push(
    new SlashCommandBuilder()
        .setName('ask')
        .setDescription('✨ Ask Starry AI anything with interactive embed page-turning buttons!')
        .setContexts([0, 1, 2])
        .setIntegrationTypes([0, 1])
        .addStringOption(option => 
            option.setName('question')
                .setDescription('The question or prompt for Starry AI')
                .setRequired(true)
        )
        .toJSON(),

    new SlashCommandBuilder()
        .setName('ai')
        .setDescription('✨ Ask Starry AI anything with interactive embed page-turning buttons!')
        .setContexts([0, 1, 2])
        .setIntegrationTypes([0, 1])
        .addStringOption(option => 
            option.setName('question')
                .setDescription('The question or prompt for Starry AI')
                .setRequired(true)
        )
        .toJSON(),

    new SlashCommandBuilder()
        .setName('setprefix')
        .setDescription('⚙️ Set a custom prefix for this server')
        .setContexts([0])
        .setIntegrationTypes([0])
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
        .addStringOption(option => 
            option.setName('prefix')
                .setDescription('The new prefix (e.g. ! or ? or -)')
                .setRequired(true)
        )
        .toJSON(),

    new SlashCommandBuilder()
        .setName('vote')
        .setDescription('⭐ Vote for Starry on Top.gg to earn free Credits and XP boosts!')
        .setContexts([0, 1, 2])
        .setIntegrationTypes([0, 1])
        .toJSON()
);

commands.push(
    { name: 'chest', description: 'Claim your timed loot chest for free XP and Credits!' },
    { name: 'shop', description: 'Open the server shop to buy exclusive roles with your Credits!' },
    { name: 'prestige', description: 'Reset your level to gain Prestige 👑 and permanent bonus multipliers!' },
    { name: 'pet', description: 'Manage your virtual pets!', options: [{ name: 'status', description: 'Check active pet', type: 1 }, { name: 'equip', description: 'Equip a pet', type: 1, options: [{ name: 'name', description: 'Pet name', type: 3, required: true }] }] },
    { name: 'shop-admin', description: 'Manage the server economy shop (Admins Only)', default_member_permissions: '8', options: [{ name: 'add-role', description: 'Add role to shop', type: 1, options: [{ name: 'role', description: 'Role', type: 8, required: true }, { name: 'price', description: 'Price', type: 10, required: true }, { name: 'description', description: 'Description', type: 3, required: true }] }] },
    { name: 'chest-setup', description: 'Enable or disable automatic chest drops', default_member_permissions: '8', options: [{ name: 'enable', description: 'Enable chest drops', type: 1, options: [{ name: 'channel', description: 'Channel', type: 7, required: true }] }] },
    { 
        name: 'chest-toggle', 
        description: 'Toggle or configure automatic chest drops for your server or a channel', 
        default_member_permissions: '8', 
        options: [
            { 
                name: 'server', 
                description: 'Toggle chest drops across this server', 
                type: 1, 
                options: [
                    { 
                        name: 'action', 
                        description: 'Enable, disable or check status', 
                        type: 3, 
                        required: false, 
                        choices: [
                            { name: '🟢 Enable Everywhere', value: 'enable' },
                            { name: '🔴 Disable Everywhere', value: 'disable' },
                            { name: '📊 Check Status', value: 'status' }
                        ] 
                    }
                ] 
            },
            { 
                name: 'channel', 
                description: 'Toggle chest drops for a specific channel', 
                type: 1, 
                options: [
                    { name: 'target', description: 'Select the channel', type: 7, required: true },
                    { 
                        name: 'action', 
                        description: 'Enable or disable in this channel', 
                        type: 3, 
                        required: false, 
                        choices: [
                            { name: '🟢 Enable Channel', value: 'enable' },
                            { name: '🔴 Disable Channel', value: 'disable' }
                        ] 
                    }
                ] 
            }
        ] 
    },
    { 
        name: 'setup-starry', 
        description: '🧠 AI MASTER COMMAND: Scans, builds, & configures custom server layout + infrastructure.', 
        default_member_permissions: '8',
        options: [{ name: 'prompt', type: 3, required: false, description: 'Describe your server theme' }]
    },
    { name: 'ahelp', description: 'Displays the complete Admin & Moderation Command Menu', default_member_permissions: '8192' },
    { name: 'set-name', description: 'Change the bot trigger word/name for this server (Admins Only)', default_member_permissions: '8', options: [{ name: 'name', description: 'New trigger word', type: 3, required: true }] },
    { name: 'boost-setup', description: 'Set the channel for server boost announcements (Admins Only)', default_member_permissions: '8', options: [{ name: 'channel', type: 7, required: true, description: 'Channel' }] },
    { name: 'setup-server', description: 'Automatically generates a professional server layout!', default_member_permissions: '8' },
    { name: 'modpanel', description: 'Open the interactive moderation dashboard', default_member_permissions: MODERATE_MEMBERS, options: [{ name: 'user', type: 6, required: true, description: 'User' }] },
    { name: 'devpanel', description: '💻 Open the interactive developer control panel' },
    autoroleCommandDef,
    { name: 'role', description: 'Manage server roles', default_member_permissions: MANAGE_ROLES, options: [{ name: 'create', type: 1, description: 'Create role', options: [{ name: 'name', type: 3, required: true, description: 'Role name' }] }] },
    
    // UPDATED FULL REACTION ROLES COMMAND (SUBCOMMANDS: spawn, add, remove, list)
    {
        name: 'rr',
        description: 'Manage reaction-role panels',
        default_member_permissions: ADMIN,
        options: [
            {
                name: 'spawn',
                type: 1,
                description: 'Create a reaction role panel embed',
                options: [
                    { name: 'channel', type: 7, required: true, description: 'Target channel' },
                    { name: 'title', type: 3, required: true, description: 'Embed title' },
                    { name: 'text', type: 3, required: true, description: 'Embed description text' }
                ]
            },
            {
                name: 'add',
                type: 1,
                description: 'Attach a reaction role to an existing panel',
                options: [
                    { name: 'channel', type: 7, required: true, description: 'Channel containing the panel' },
                    { name: 'message_id', type: 3, required: true, description: 'Message ID of the panel embed' },
                    { name: 'role', type: 8, required: true, description: 'Role to grant on reaction' },
                    { name: 'emoji', type: 3, required: true, description: 'Emoji to use for reaction' }
                ]
            },
            {
                name: 'remove',
                type: 1,
                description: 'Remove a reaction role from a panel',
                options: [
                    { name: 'channel', type: 7, required: true, description: 'Channel containing the panel' },
                    { name: 'message_id', type: 3, required: true, description: 'Message ID of the panel embed' },
                    { name: 'emoji', type: 3, required: true, description: 'Emoji to remove' }
                ]
            },
            {
                name: 'list',
                type: 1,
                description: 'List all active reaction roles in this server'
            }
        ]
    },

    { name: 'setlogs', description: 'Set server log channel', default_member_permissions: ADMIN, options: [{ name: 'channel', type: 7, required: true, description: 'Channel' }] },
    { name: 'setupvc', description: 'Configure join-to-create voice channel', default_member_permissions: MANAGE_CHANNELS, options: [{ name: 'channel', type: 7, required: true, description: 'Voice channel' }] },
    { name: 'help', description: 'Show bot command list with 100+ commands' },
    { name: 'ping', description: 'Check bot latency and multi-bot cluster status' },
    { name: 'activatepremium', description: 'Activate Premium', options: [{ name: 'server_id', type: 3, required: false, description: 'Server/User ID' }] },
    { name: 'multibot', description: '🤖 View Multi-Bot cluster status, worker instances, and online nodes' },
    { name: 'avatar', description: '🖼️ Display user profile avatar in high resolution', options: [{ name: 'user', type: 6, required: false, description: 'Target user' }] },
    { name: 'banner', description: '🎨 Display user or server profile banner', options: [{ name: 'user', type: 6, required: false, description: 'Target user' }] },
    { name: 'rank', description: '👑 Check user level and XP ranking', options: [{ name: 'user', type: 6, required: false, description: 'Target user' }] },
    { name: 'leaderboard', description: '🏆 Display top server members by level and wealth' },
    { name: 'balance', description: '💰 View your cash wallet and bank balance' },
    { name: 'daily', description: '🎁 Claim daily bonus credits ($500)' },
    { name: 'work', description: '💼 Work and earn money' },
    { name: 'slots', description: '🎰 Spin the casino slot machine', options: [{ name: 'bet', type: 4, required: false, description: 'Bet amount' }] },
    { name: 'lyrics', description: '🎙️ Fetch lyrics for currently playing or specified song', options: [{ name: 'song', type: 3, required: false, description: 'Song title' }] },
    { name: 'fish', description: '🎣 Cast your fishing rod to catch fish and aquatic treasures' },
    { name: 'mine', description: '⛏️ Mine crystals, diamonds, and ores in the cavern' },
    { name: 'inventory', description: '🎒 View items and treasures stored in your backpack', options: [{ name: 'user', type: 6, required: false, description: 'Target user' }] },
    { name: 'sell', description: '💰 Sell gathered fish and minerals for cash credits', options: [{ name: 'item', type: 3, required: false, description: 'Item name or "all"' }] },
    { name: 'profile', description: '👤 View complete Nekotina-style anime profile, marriage, and wealth', options: [{ name: 'user', type: 6, required: false, description: 'Target member' }] },
    { name: 'marry', description: '💍 Propose marriage to another member', options: [{ name: 'user', type: 6, required: true, description: 'Member to marry' }] },
    { name: 'divorce', description: '💔 End your current marriage' },
    { name: 'ship', description: '💘 Calculate love compatibility between two members', options: [{ name: 'user', type: 6, required: true, description: 'First user' }, { name: 'user2', type: 6, required: false, description: 'Second user' }] },
    { name: 'pet', description: '🐾 Manage, adopt, feed, and play with your companion pet', options: [{ name: 'action', type: 3, required: false, description: 'Action (adopt, feed, play)' }, { name: 'name', type: 3, required: false, description: 'Pet name or species' }] },
    { name: 'anime', description: '📺 Search anime synopsis, scores, and episodes on AniList', options: [{ name: 'title', type: 3, required: true, description: 'Anime title' }] }
);

// 3. STRICT DEDUPLICATION ENGINE & USER APP ACTIVATION
const commandMap = new Map();
commands.forEach(cmd => { 
    if (cmd) {
        const jsonCmd = typeof cmd.toJSON === 'function' ? cmd.toJSON() : cmd;
        if (jsonCmd.name) {
            // Enable User Install (0 = Guild, 1 = User) and all Contexts (0 = Guild, 1 = Bot DM, 2 = Private Channel)
            // Allows commands to be used anywhere across Discord even if bot is not in that server!
            if (!jsonCmd.integration_types) {
                jsonCmd.integration_types = [0, 1];
            }
            if (!jsonCmd.contexts) {
                jsonCmd.contexts = [0, 1, 2];
            }
            commandMap.set(jsonCmd.name, jsonCmd);
        }
    }
});
const finalPayload = Array.from(commandMap.values());

// 4. GLOBAL DEPLOYMENT FUNCTION
async function deployCommands(client) {
    const token = process.env.DISCORD_TOKEN || process.env.BOT_TOKEN || process.env.TOKEN;
    let clientId = process.env.CLIENT_ID || process.env.APPLICATION_ID;

    if (!token) throw new Error('🛑 CRITICAL: DISCORD_TOKEN, BOT_TOKEN, or TOKEN environment variable must be set.');

    if (!clientId) {
        try { 
            clientId = Buffer.from(token.split('.')[0], 'base64').toString('utf-8'); 
        } catch (e) {
            throw new Error('🛑 Could not parse CLIENT_ID from TOKEN.');
        }
    }

    const rest = new REST({ version: '10' }).setToken(token);

    try {
        console.log(`🌍 [GLOBAL SYNC] Registering ${finalPayload.length} application commands globally across all servers...`);

        const result = await rest.put(Routes.applicationCommands(clientId), { body: finalPayload });
        console.log(`✅ Successfully deployed ${result.length} commands globally!`);

        // Instant Guild Sync (0-Second Appearance in Active Servers)
        if (client && client.guilds && client.guilds.cache.size > 0) {
            console.log(`⚡ [INSTANT GUILD SYNC] Deploying commands to ${client.guilds.cache.size} connected servers for instant 0s availability...`);
            for (const guild of client.guilds.cache.values()) {
                try {
                    await rest.put(Routes.applicationGuildCommands(clientId, guild.id), { body: finalPayload });
                } catch (gErr) {}
            }
            console.log(`⚡ [INSTANT GUILD SYNC] All connected servers synchronized instantly!`);
        }

        return result;
    } catch (error) {
        console.error('❌ Discord API Rejected Command Payload:', error);
        throw error;
    }
}

if (require.main === module) deployCommands().catch(() => process.exitCode = 1);

module.exports = { commands: finalPayload, deployCommands };
