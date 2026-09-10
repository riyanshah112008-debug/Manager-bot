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
}

// Tracker Payload
const trackerModule = safeRequire(['./src/modules/tracker', './modules/tracker']);
if (trackerModule && trackerModule.data) {
    masterPayloads.push(trackerModule.data.toJSON ? trackerModule.data.toJSON() : trackerModule.data);
}

// AFK Command Payload
const afkModule = safeRequire(['./src/modules/afk', './modules/afk']);
if (afkModule && afkModule.afkPayload) {
    masterPayloads.push(afkModule.afkPayload);
}

// Bump Engine Payload (Server Promotion)
const bumpModule = safeRequire(['./src/modules/bumpEngine', './modules/bumpEngine']);
if (bumpModule && bumpModule.bumpPayload) {
    masterPayloads.push(bumpModule.bumpPayload);
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
const vcmodModule = safeRequire(['./src/commands/moderation/vcmod', './commands/moderation/vcmod']);
if (vcmodModule && vcmodModule.data) {
    masterPayloads.push(vcmodModule.data.toJSON ? vcmodModule.data.toJSON() : vcmodModule.data);
}

const portalModule = safeRequire(['./src/commands/utility/portal', './commands/utility/portal']);
if (portalModule && portalModule.data) {
    masterPayloads.push(portalModule.data.toJSON ? portalModule.data.toJSON() : portalModule.data);
}

const pulseModule = safeRequire(['./src/commands/utility/pulse', './commands/utility/pulse']);
if (pulseModule && pulseModule.data) {
    masterPayloads.push(pulseModule.data.toJSON ? pulseModule.data.toJSON() : pulseModule.data);
}

const sparkModule = safeRequire(['./src/commands/utility/spark', './commands/utility/spark']);
if (sparkModule && sparkModule.data) {
    masterPayloads.push(sparkModule.data.toJSON ? sparkModule.data.toJSON() : sparkModule.data);
}

const raidModule = safeRequire(['./src/commands/game/raid', './commands/game/raid']);
if (raidModule && raidModule.data) {
    masterPayloads.push(raidModule.data.toJSON ? raidModule.data.toJSON() : raidModule.data);
}

const catchupModule = safeRequire(['./src/commands/utility/catchup', './commands/utility/catchup']);
if (catchupModule && catchupModule.data) {
    masterPayloads.push(catchupModule.data.toJSON ? catchupModule.data.toJSON() : catchupModule.data);
}

const pentestModule = safeRequire(['./src/commands/utility/pentest', './commands/utility/pentest']);
if (pentestModule && pentestModule.data) {
    masterPayloads.push(pentestModule.data.toJSON ? pentestModule.data.toJSON() : pentestModule.data);
}

const chronosModule = safeRequire(['./src/commands/utility/chronos', './commands/utility/chronos']);
if (chronosModule && chronosModule.data) {
    masterPayloads.push(chronosModule.data.toJSON ? chronosModule.data.toJSON() : chronosModule.data);
}

const gazetteModule = safeRequire(['./src/commands/utility/gazette', './commands/utility/gazette']);
if (gazetteModule && gazetteModule.data) {
    masterPayloads.push(gazetteModule.data.toJSON ? gazetteModule.data.toJSON() : gazetteModule.data);
}

const commands = [
    ...masterPayloads,

    // VOICE HUB
    { name: 'djpanel', description: '🎛️ Post the ultimate interactive Starry DJ & Voice Control Hub', default_member_permissions: '16' },

    // MUSIC COMMANDS
    { name: 'play', description: 'Play a song from SoundCloud or Spotify', options: [{ name: 'song', type: 3, required: true, description: 'Song name, SoundCloud URL, or Spotify URL' }] },
    { name: 'skip', description: 'Skip the current song' },
    { name: 'stop', description: 'Stop the music and clear the queue' },
    { name: 'queue', description: 'View and interactively manage the current music queue' },
    { name: 'volume', description: 'Change the music volume', options: [{ name: 'amount', type: 4, required: true, description: 'Volume from 1 to 100', min_value: 1, max_value: 100 }] },

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

    // 🎨 MASTER EMBED VISUALITY STUDIO
    new SlashCommandBuilder()
        .setName('customize')
        .setDescription('Universal Embed Visuality Studio - Customize welcome, goodbye, levels & server theme')
        .addStringOption(option =>
            option.setName('feature')
                .setDescription('Select specific feature visualizer to open')
                .setRequired(false)
                .addChoices(
                    { name: '🌸 Welcome Embeds', value: 'welcome' },
                    { name: '🥀 Goodbye Embeds', value: 'goodbye' },
                    { name: '📊 Level-Up Cards', value: 'levels' },
                    { name: '🎨 Server Embed Theme', value: 'theme' }
                )
        )
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
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


    // 🎨 AI IMAGE GENERATION SLASH COMMANDS (Usable in Guilds, DMs, & Group Chats)
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

// Direct Social Action Slash Commands (All 43 Top-Level User-Installable Actions)
if (socialModule && socialModule.ACTION_CONFIG) {
    for (const [act, conf] of Object.entries(socialModule.ACTION_CONFIG)) {
        const isTargeted = conf.requiresTarget !== false;
        const desc = isTargeted
            ? `${conf.verb.charAt(0).toUpperCase() + conf.verb.slice(1)} a member with an animated anime GIF!`
            : `${conf.verb.charAt(0).toUpperCase() + conf.verb.slice(1)} (Anime Reaction)`;
        
        commands.push(
            new SlashCommandBuilder()
                .setName(act)
                .setDescription(desc.slice(0, 100))
                .setContexts([0, 1, 2])
                .setIntegrationTypes([0, 1])
                .addUserOption(opt => 
                    opt.setName('target')
                       .setDescription(isTargeted ? 'Target member' : 'Optional target member')
                       .setRequired(isTargeted)
                )
                .toJSON()
        );
    }
}

// ✨ AI, SETPREFIX & TOP.GG VOTE SLASH COMMANDS
commands.push(
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
        .toJSON()
);

commands.push(
    { 
        name: 'setup-starry', 
        description: '🧠 AI MASTER COMMAND: Scans, builds, & configures custom server layout + infrastructure.', 
        default_member_permissions: '8',
        options: [{ name: 'prompt', type: 3, required: false, description: 'Describe your server theme' }]
    },
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
    { name: 'avatar', description: '🖼️ Display user profile avatar in high resolution', options: [{ name: 'user', type: 6, required: false, description: 'Target user' }] },
    { name: 'banner', description: '🎨 Display user or server profile banner', options: [{ name: 'user', type: 6, required: false, description: 'Target user' }] },
    { name: 'rank', description: '👑 Check user level and XP ranking', options: [{ name: 'user', type: 6, required: false, description: 'Target user' }] },
    { name: 'leaderboard', description: '🏆 Display top server members by level and wealth' },
    { name: 'balance', description: '💰 View your cash wallet and bank balance' },
    { name: 'daily', description: '🎁 Claim daily bonus credits ($500)' },
    { name: 'work', description: '💼 Work and earn money' },
    { name: 'inventory', description: '🎒 View items and treasures stored in your backpack', options: [{ name: 'user', type: 6, required: false, description: 'Target user' }] },
    { name: 'profile', description: '👤 View complete anime profile card, marriage, badges, and wealth', options: [{ name: 'user', type: 6, required: false, description: 'Target member' }] },
    { name: 'marry', description: '💍 Propose marriage to another member', options: [{ name: 'user', type: 6, required: true, description: 'Member to marry' }] },
    { name: 'divorce', description: '💔 End your current marriage' },
    { name: 'ship', description: '💘 Calculate love compatibility between two members', options: [{ name: 'user', type: 6, required: true, description: 'First user' }, { name: 'user2', type: 6, required: false, description: 'Second user' }] },
    { name: 'pet', description: '🐾 Manage, adopt, feed, and play with your companion pet', options: [{ name: 'action', type: 3, required: false, description: 'Action (adopt, feed, play)' }, { name: 'name', type: 3, required: false, description: 'Pet name or species' }] },
    { name: 'anime', description: '📺 Search anime synopsis, scores, and episodes on AniList', options: [{ name: 'title', type: 3, required: true, description: 'Anime title' }] },
    {
        name: 'setlanguage',
        description: '🌐 Change the server language or view the active language across 14 languages',
        default_member_permissions: ADMIN,
        options: [
            {
                name: 'language',
                type: 3,
                required: false,
                description: 'Select server language',
                choices: [
                    { name: '🇬🇧 English', value: 'en' },
                    { name: '🇪🇸 Español (Spanish)', value: 'es' },
                    { name: '🇧🇷 Português (Portuguese)', value: 'pt' },
                    { name: '🇯🇵 日本語 (Japanese)', value: 'ja' },
                    { name: '🇮🇳 हिन्दी (Hindi)', value: 'hi' },
                    { name: '🇫🇷 Français (French)', value: 'fr' },
                    { name: '🇩🇪 Deutsch (German)', value: 'de' },
                    { name: '🇷🇺 Русский (Russian)', value: 'ru' },
                    { name: '🇮🇩 Bahasa Indonesia', value: 'id' },
                    { name: '🇮🇹 Italiano (Italian)', value: 'it' },
                    { name: '🇻🇳 Tiếng Việt (Vietnamese)', value: 'vi' },
                    { name: '🇹🇷 Türkçe (Turkish)', value: 'tr' },
                    { name: '🇸🇦 العربية (Arabic)', value: 'ar' },
                    { name: '🇰🇷 한국어 (Korean)', value: 'ko' }
                ]
            }
        ]
    }
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
    const rawToken = process.env.DISCORD_TOKEN || process.env.BOT_TOKEN || process.env.TOKEN || '';
    const token = rawToken.replace(/[\r\n\t]/g, '').trim().replace(/^[\"\']|[\"\']$/g, '').replace(/^Bot\s+/i, '');
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
