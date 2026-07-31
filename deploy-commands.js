// ==========================================
// 🚀 STARRY SUPREME GLOBAL DEPLOY ENGINE
// ==========================================
require('dotenv').config();
const { 
    REST, 
    Routes, 
    PermissionFlagsBits, 
    SlashCommandBuilder, 
    ChannelType 
} = require('discord.js');

const ADMIN = PermissionFlagsBits.Administrator.toString();
const MANAGE_ROLES = PermissionFlagsBits.ManageRoles.toString();
const MANAGE_CHANNELS = PermissionFlagsBits.ManageChannels.toString();
const MODERATE_MEMBERS = PermissionFlagsBits.ModerateMembers.toString();

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

// Master Systems Payloads
try {
    const masterModule = require('./src/modules/masterChannelSystems');
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
} catch (err) {
    console.warn('⚠️ Could not load masterChannelSystems payloads:', err.message);
}

// Tracker Payload
try {
    const trackerModule = require('./src/modules/tracker');
    if (trackerModule && trackerModule.data) {
        masterPayloads.push(trackerModule.data.toJSON());
    }
} catch (err) {
    console.warn('⚠️ Could not load tracker module payload:', err.message);
}

// AFK Command Payload with Subcommands (/afk set, clear, list, status)
try {
    let afkModule = null;
    try { afkModule = require('./src/modules/afk'); } catch (e) { afkModule = require('./modules/afk'); }
    
    if (afkModule && afkModule.afkPayload) {
        masterPayloads.push(afkModule.afkPayload);
    }
} catch (err) {
    console.warn('⚠️ Could not load AFK module payload:', err.message);
}

// Bump Engine Payloads
try {
    let bumpModule = null;
    try { bumpModule = require('./src/modules/bumpEngine'); } catch (e) { bumpModule = require('./modules/bumpEngine'); }
    
    if (bumpModule && bumpModule.bumpSlashCommands) {
        masterPayloads.push(...bumpModule.bumpSlashCommands);
    }
} catch (err) {
    console.warn('⚠️ Could not load bumpEngine payloads:', err.message);
}

// Backup Engine Payload
try {
    const backupModule = require('./src/modules/serverBackupManager');
    if (backupModule && backupModule.backupCommandPayload) {
        masterPayloads.push(backupModule.backupCommandPayload);
    }
} catch (err) {
    try {
        const altBackupModule = require('./src/modules/backupEngine');
        if (altBackupModule && altBackupModule.backupCommandPayload) {
            masterPayloads.push(altBackupModule.backupCommandPayload);
        }
    } catch (e) {}
}

const commands = [
    ...masterPayloads,

    // TELEMETRY
    { name: 'telemetry', description: '📡 Bot Owner Only: Receive an immediate telemetry report in your DMs.', default_member_permissions: '8' },

    // MUSIC & VOICE AI ENGINE
    { name: 'callstarry', description: '📞 Call Starry for a private 1-on-1 human-like AI voice call! (Premium Only)' },
    { name: 'djpanel', description: '🎛️ Post the ultimate interactive Starry DJ & Voice Control Hub', default_member_permissions: '16' },
    { name: 'play', description: 'Play a song from SoundCloud or Spotify', options: [{ name: 'song', type: 3, required: true, description: 'Song name, SoundCloud URL, or Spotify URL' }] },
    { name: 'pause', description: 'Pause the currently playing song' },
    { name: 'resume', description: 'Resume the paused song' },
    { name: 'skip', description: 'Skip the current song' },
    { name: 'stop', description: 'Stop the music and clear the queue' },
    { name: 'queue', description: 'View and interactively manage the current music queue' },
    { name: 'volume', description: 'Change the music volume', options: [{ name: 'amount', type: 4, required: true, description: 'Volume from 1 to 100', min_value: 1, max_value: 100 }] },
    { name: 'autoplay', description: 'Toggles automatic music playback (Premium Only)' }
];

try {
    const { socialCommandPayload } = require('./src/modules/socialActions');
    if (socialCommandPayload) commands.push(socialCommandPayload);
} catch (err) {}

commands.push(
    new SlashCommandBuilder()
        .setName('giveaway')
        .setDescription('🎉 Start a supreme giveaway with animated media banners!')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addStringOption(option => option.setName('duration').setDescription('Duration of the giveaway').setRequired(true))
        .addStringOption(option => option.setName('prize').setDescription('The prize being given away').setRequired(true))
        .addIntegerOption(option => option.setName('winners').setDescription('Number of winners').setRequired(false))
        .addChannelOption(option => option.setName('channel').setDescription('Target channel').addChannelTypes(ChannelType.GuildText).setRequired(false))
        .toJSON(),

    new SlashCommandBuilder()
        .setName('reroll')
        .setDescription('🔄 Reroll a new winner for a concluded giveaway!')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addStringOption(option => option.setName('message_id').setDescription('The Message ID of the giveaway').setRequired(true))
        .addIntegerOption(option => option.setName('winners').setDescription('Number of winners').setRequired(false))
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
    autoroleCommandDef
);

commands.push(
    { name: 'role', description: 'Manage server roles', default_member_permissions: MANAGE_ROLES, options: [{ name: 'create', type: 1, description: 'Create role', options: [{ name: 'name', type: 3, required: true, description: 'Role name' }] }] },
    { name: 'rr', description: 'Manage reaction-role panels', default_member_permissions: ADMIN, options: [{ name: 'spawn', type: 1, description: 'Create panel', options: [{ name: 'channel', type: 7, required: true, description: 'Channel' }, { name: 'title', type: 3, required: true, description: 'Title' }, { name: 'text', type: 3, required: true, description: 'Text' }] }] },
    { name: 'setlogs', description: 'Set server log channel', default_member_permissions: ADMIN, options: [{ name: 'channel', type: 7, required: true, description: 'Channel' }] },
    { name: 'setupvc', description: 'Configure join-to-create voice channel', default_member_permissions: MANAGE_CHANNELS, options: [{ name: 'channel', type: 7, required: true, description: 'Voice channel' }] },
    { name: 'help', description: 'Show bot command list' },
    { name: 'ping', description: 'Check bot latency' },
    { name: 'activatepremium', description: 'Activate Premium', options: [{ name: 'server_id', type: 3, required: false, description: 'Server/User ID' }] }
);

// 3. STRICT DEDUPLICATION ENGINE
const commandMap = new Map();
commands.forEach(cmd => { 
    if (cmd && cmd.name) commandMap.set(cmd.name, cmd); 
});
const finalPayload = Array.from(commandMap.values());

// 4. GLOBAL DEPLOYMENT FUNCTION
async function deployCommands() {
    const token = process.env.DISCORD_TOKEN || process.env.BOT_TOKEN || process.env.TOKEN;
    let clientId = process.env.CLIENT_ID || process.env.APPLICATION_ID;

    if (!token) throw new Error('🛑 CRITICAL: DISCORD_TOKEN, BOT_TOKEN, or TOKEN environment variable must be set.');

    if (!clientId) {
        try { clientId = Buffer.from(token.split('.')[0], 'base64').toString('utf-8'); } catch (e) {
            throw new Error('🛑 Could not parse CLIENT_ID from TOKEN.');
        }
    }
    
    const rest = new REST({ version: '10' }).setToken(token);

    try {
        console.log(`🌍 [GLOBAL SYNC] Registering ${finalPayload.length} application commands globally across all servers...`);
        
        const result = await rest.put(Routes.applicationCommands(clientId), { body: finalPayload });
        
        console.log(`✅ Successfully deployed ${result.length} commands globally!`);
        console.log(`⏳ Global commands sync across Discord can take up to 1 hour. Restart your Discord app to check local client status.`);

        return result;
    } catch (error) {
        console.error('❌ Discord API Rejected Command Payload:', error);
        throw error;
    }
}

if (require.main === module) deployCommands().catch(() => process.exitCode = 1);

module.exports = { commands: finalPayload, deployCommands };
