require('dotenv').config();
const { 
    REST, 
    Routes, 
    PermissionFlagsBits, 
    ApplicationCommandType, 
    SlashCommandBuilder, 
    ChannelType 
} = require('discord.js');

const ADMIN = PermissionFlagsBits.Administrator.toString();
const MANAGE_MESSAGES = PermissionFlagsBits.ManageMessages.toString();
const MANAGE_ROLES = PermissionFlagsBits.ManageRoles.toString();
const MANAGE_GUILD = PermissionFlagsBits.ManageGuild.toString();
const MANAGE_CHANNELS = PermissionFlagsBits.ManageChannels.toString();
const MODERATE_MEMBERS = PermissionFlagsBits.ModerateMembers.toString();

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

// ==========================================
// INITIALIZE COMPLETE COMMANDS ARRAY
// ==========================================
const commands = [
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
    { name: 'autoplay', description: 'Toggles automatic music playback (Premium Only)' },

    // SECURITY & VERIFICATION
    { name: 'verify-setup', description: 'Set up the server verification panel (Admins Only)', default_member_permissions: '8', options: [{ name: 'channel', type: 7, required: true, description: 'The channel to send the verification panel' }, { name: 'role', type: 8, required: true, description: 'The role to give users when they verify' }] }
];

// Safely Load Module Payloads from MasterChannelSystems (Merged Mod & Automod & Governance)
try {
    const { policyVotePayload, modMasterPayload, autoModMasterPayload } = require('./src/modules/masterChannelSystems');
    if (policyVotePayload) commands.push(policyVotePayload);
    if (modMasterPayload) commands.push(modMasterPayload);
    if (autoModMasterPayload) commands.push(autoModMasterPayload);
} catch (err) {
    console.warn('⚠️ Could not load policies or moderation payloads from masterChannelSystems:', err.message);
}

try {
    const { socialCommandPayload } = require('./src/modules/socialActions');
    if (socialCommandPayload) commands.push(socialCommandPayload);
} catch (err) {
    console.warn('⚠️ Could not load socialCommandPayload:', err.message);
}

// GIVEAWAYS
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

// ECONOMY, XP & MASTER MANAGEMENT
commands.push(
    { name: 'chest', description: 'Claim your timed loot chest for free XP and Credits!' },
    { name: 'shop', description: 'Open the server shop to buy exclusive roles with your Credits!' },
    { name: 'prestige', description: 'Reset your level to gain Prestige 👑 and permanent bonus multipliers!' },
    { name: 'pet', description: 'Manage your virtual pets!', options: [{ name: 'status', description: 'Check active pet', type: 1 }, { name: 'equip', description: 'Equip a pet', type: 1, options: [{ name: 'name', description: 'Pet name', type: 3, required: true }] }] },
    { name: 'shop-admin', description: 'Manage the server economy shop (Admins Only)', default_member_permissions: '8', options: [{ name: 'add-role', description: 'Add role to shop', type: 1, options: [{ name: 'role', description: 'Role', type: 8, required: true }, { name: 'price', description: 'Price', type: 10, required: true }, { name: 'description', description: 'Description', type: 3, required: true }] }] },
    { name: 'chest-setup', description: 'Enable or disable automatic chest drops', default_member_permissions: '8', options: [{ name: 'enable', description: 'Enable chest drops', type: 1, options: [{ name: 'channel', description: 'Channel', type: 7, required: true }] }] },
    
    // Setup Starry Command Definition
    { 
        name: 'setup-starry', 
        description: '🧠 AI MASTER COMMAND: Scans, builds, & configures custom server layout + infrastructure.', 
        default_member_permissions: '8',
        options: [
            {
                name: 'prompt',
                type: 3,
                required: false,
                description: 'Describe your server theme (e.g., "Anime Chill Server", "Cyberpunk Gaming Community")'
            }
        ]
    },
    
    { name: 'ahelp', description: 'Displays the complete Admin & Moderation Command Menu', default_member_permissions: '8192' },
    { name: 'emergency-lockdown', description: '🚨 EMERGENCY: Freezes the entire server. (Admins Only)', default_member_permissions: '8' },
    { name: 'emergency-secure', description: '🛡️ EMERGENCY: Strips all dangerous permissions from all roles. (Admins Only)', default_member_permissions: '8' },
    { name: 'emergency-unban', description: '🏥 EMERGENCY: Unbans every user in the server ban list. (Admins Only)', default_member_permissions: '8' },
    { name: 'emergency-nuke', description: '⚠️ EMERGENCY: Deletes all channels except General. (Admins Only)', default_member_permissions: '8' },
    { name: 'set-name', description: 'Change the bot trigger word/name for this server (Admins Only)', default_member_permissions: '8', options: [{ name: 'name', description: 'New trigger word', type: 3, required: true }] },
    { name: 'boost-setup', description: 'Set the channel for server boost announcements (Admins Only)', default_member_permissions: '8', options: [{ name: 'channel', type: 7, required: true, description: 'Channel' }] },
    { name: 'setup-server', description: 'Automatically generates a professional server layout!', default_member_permissions: '8' },
    { name: 'modpanel', description: 'Open the interactive moderation dashboard', default_member_permissions: MODERATE_MEMBERS, options: [{ name: 'user', type: 6, required: true, description: 'User' }] },
    { name: 'devpanel', description: '💻 Open the interactive developer control panel' },
    autoroleCommandDef
);

// ROLES, SETUP & UTILITIES
commands.push(
    { name: 'role', description: 'Manage server roles', default_member_permissions: MANAGE_ROLES, options: [{ name: 'create', type: 1, description: 'Create role', options: [{ name: 'name', type: 3, required: true, description: 'Role name' }] }] },
    { name: 'rr', description: 'Manage reaction-role panels', default_member_permissions: ADMIN, options: [{ name: 'spawn', type: 1, description: 'Create panel', options: [{ name: 'channel', type: 7, required: true, description: 'Channel' }, { name: 'title', type: 3, required: true, description: 'Title' }, { name: 'text', type: 3, required: true, description: 'Text' }] }] },
    { name: 'setlogs', description: 'Set server log channel', default_member_permissions: ADMIN, options: [{ name: 'channel', type: 7, required: true, description: 'Channel' }] },
    { name: 'setupvc', description: 'Configure join-to-create voice channel', default_member_permissions: MANAGE_CHANNELS, options: [{ name: 'channel', type: 7, required: true, description: 'Voice channel' }] },
    { name: 'help', description: 'Show bot command list' },
    { name: 'ping', description: 'Check bot latency' },

    // PREMIUM & DIRECTORY
    { name: 'activatepremium', description: 'Activate Premium', options: [{ name: 'server_id', type: 3, required: false, description: 'Server/User ID' }] },
    { name: 'bump', description: 'Bump server to global web list' }
);

// Deduplicate
const commandMap = new Map();
commands.forEach(cmd => { if (cmd && cmd.name) commandMap.set(cmd.name, cmd); });
const finalPayload = Array.from(commandMap.values());

async function deployCommands() {
    const token = process.env.TOKEN;
    let clientId = process.env.CLIENT_ID;

    if (!token) throw new Error('🛑 CRITICAL: TOKEN environment variable must be set.');

    if (!clientId) {
        try {
            clientId = Buffer.from(token.split('.')[0], 'base64').toString('utf-8');
        } catch (e) {
            throw new Error('🛑 Could not parse CLIENT_ID from TOKEN.');
        }
    }
    
    const rest = new REST({ version: '10' }).setToken(token);

    try {
        console.log(`🌍 [GLOBAL SYNC] Registering ${finalPayload.length} application commands globally across Discord...`);
        const result = await rest.put(Routes.applicationCommands(clientId), { body: finalPayload });
        console.log(`✅ Successfully deployed ${result.length} commands globally!`);
        return result;
    } catch (error) {
        console.error('❌ Discord API Rejected Command Payload:', error);
        throw error;
    }
}

if (require.main === module) {
    deployCommands().catch(() => process.exitCode = 1);
}

module.exports = { commands: finalPayload, deployCommands };
        
