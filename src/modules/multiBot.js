// ==========================================
// 🤖 VIRTUAL & PHYSICAL MULTI-BOT CLUSTER ENGINE
// Full Multi-Bot Effect on Single & Multi-Token Deployments
// File Path: src/modules/multiBot.js
// ==========================================
const { Client, GatewayIntentBits, Partials, Collection, Events, ActivityType } = require('discord.js');
const mongoose = require('mongoose');
const crypto = require('crypto');
const config = require('../config');
const { createMusicManager } = require('../utils/musicManager');
const { cleanToken, maskToken, verifyDiscordToken } = require('../utils/tokenSanitizer');

let MultiBotToken;
try {
    MultiBotToken = require('../models/MultiBotToken');
} catch (e) {
    const schema = new mongoose.Schema({
        token: { type: String, required: true, unique: true },
        tokenHash: { type: String, unique: true, sparse: true, index: true },
        name: { type: String, default: 'Secondary Worker Bot' },
        role: { type: String, default: 'all' },
        addedBy: { type: String, default: 'System' },
        enabled: { type: Boolean, default: true },
        createdAt: { type: Date, default: Date.now }
    });
    MultiBotToken = mongoose.models.MultiBotToken || mongoose.model('MultiBotToken', schema);
}

const WORKER_TOKEN_PREFIX = 'enc:v1:';

function getWorkerTokenKey() {
    const encoded = process.env.MULTIBOT_TOKEN_ENCRYPTION_KEY;
    if (!encoded) return null;
    const key = Buffer.from(encoded.trim(), 'base64');
    if (key.length !== 32) {
        throw new Error('MULTIBOT_TOKEN_ENCRYPTION_KEY must be a base64-encoded 32-byte key.');
    }
    return key;
}

function hashWorkerToken(token) {
    return crypto.createHash('sha256').update(token).digest('hex');
}

function encryptWorkerToken(token, key = getWorkerTokenKey()) {
    if (!key) throw new Error('Configure MULTIBOT_TOKEN_ENCRYPTION_KEY before storing worker bot tokens.');
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
    const ciphertext = Buffer.concat([cipher.update(token, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return WORKER_TOKEN_PREFIX + [
        iv.toString('base64url'),
        tag.toString('base64url'),
        ciphertext.toString('base64url')
    ].join(':');
}

function decryptWorkerToken(value, key = getWorkerTokenKey()) {
    if (typeof value !== 'string' || !value.startsWith(WORKER_TOKEN_PREFIX)) {
        throw new Error('Worker token is not encrypted.');
    }
    if (!key) throw new Error('MULTIBOT_TOKEN_ENCRYPTION_KEY is not configured.');
    const parts = value.slice(WORKER_TOKEN_PREFIX.length).split(':');
    if (parts.length !== 3) throw new Error('Encrypted worker token has an invalid format.');
    const [ivText, tagText, ciphertextText] = parts;
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(ivText, 'base64url'));
    decipher.setAuthTag(Buffer.from(tagText, 'base64url'));
    return Buffer.concat([
        decipher.update(Buffer.from(ciphertextText, 'base64url')),
        decipher.final()
    ]).toString('utf8');
}

async function loadEncryptedWorkerTokens() {
    const key = getWorkerTokenKey();
    if (!key) {
        console.warn('⚠️ Multi-Bot: MongoDB worker tokens are disabled until MULTIBOT_TOKEN_ENCRYPTION_KEY is configured. Environment-defined worker tokens remain available.');
        return [];
    }

    const documents = await MultiBotToken.find({}).lean();
    const activeTokens = [];
    for (const document of documents) {
        try {
            let plaintext;
            let encrypted = document.token;
            if (typeof encrypted === 'string' && encrypted.startsWith(WORKER_TOKEN_PREFIX)) {
                plaintext = decryptWorkerToken(encrypted, key);
            } else {
                plaintext = cleanToken(encrypted);
                if (!plaintext) continue;
                encrypted = encryptWorkerToken(plaintext, key);
            }

            const tokenHash = hashWorkerToken(plaintext);
            if (document.token !== encrypted || document.tokenHash !== tokenHash) {
                await MultiBotToken.updateOne(
                    { _id: document._id },
                    { $set: { token: encrypted, tokenHash } }
                );
            }
            if (document.enabled) activeTokens.push({ ...document, token: plaintext, tokenHash });
        } catch (error) {
            console.error('⚠️ Multi-Bot: A stored worker token could not be decrypted or migrated; it was skipped.');
        }
    }
    return activeTokens;
}

// 🛡️ VIRTUAL SUB-BOT WORKER NODES (Single Token Virtual Cluster)
const VIRTUAL_WORKER_NODES = [
    {
        id: 'node-master',
        name: 'Starry Master Core',
        emoji: '👑',
        role: 'Central Dispatcher & AI Architect',
        color: '#5865F2',
        activity: 'over all server systems | ,help',
        type: ActivityType.Watching,
        commands: '150+ Commands Active'
    },
    {
        id: 'node-mod',
        name: 'Starry Moderation Engine',
        emoji: '🛡️',
        role: 'AutoMod, Anti-Nuke, Warns & ModPanel',
        color: '#E74C3C',
        activity: 'server safety & modpanel | ,modpanel',
        type: ActivityType.Watching,
        commands: '32 Security Commands'
    },
    {
        id: 'node-music',
        name: 'Starry Hi-Fi Audio Engine',
        emoji: '🎵',
        role: 'Lavalink v4 Cluster & 24/7 Radio',
        color: '#9B59B6',
        activity: 'Hi-Fi 320kbps Audio | ,play',
        type: ActivityType.Listening,
        commands: '33 Audio Commands'
    },
    {
        id: 'node-eco',
        name: 'Starry Economy & RPG Engine',
        emoji: '💰',
        role: 'Timed Chests, Pets, Shop & Prestige',
        color: '#F1C40F',
        activity: 'economy & timed chests | ,shop',
        type: ActivityType.Playing,
        commands: '16 RPG Commands'
    },
    {
        id: 'node-util',
        name: 'Starry Systems & Utility Engine',
        emoji: '🛠️',
        role: 'Server Backups, Tickets & Whois',
        color: '#1ABC9C',
        activity: 'backups & server tools | ,help utility',
        type: ActivityType.Playing,
        commands: '28 Utility Commands'
    },
    {
        id: 'node-social',
        name: 'Starry Social & Community Engine',
        emoji: '🎭',
        role: '26 Anime Social Gifs & Leveling',
        color: '#E91E63',
        activity: 'anime actions & fun | ,social',
        type: ActivityType.Playing,
        commands: '26 Social Commands'
    }
];

const ROLE_PRESETS = {
    all: { name: 'All-in-One Master', emoji: '👑', activity: ',help | Master Hub', type: ActivityType.Watching },
    moderation: { name: 'Moderation & Security', emoji: '🛡️', activity: ',modpanel | Server Safety', type: ActivityType.Watching },
    music: { name: 'Music & Audio Node', emoji: '🎵', activity: ',play | High Quality Audio', type: ActivityType.Listening },
    utility: { name: 'Utility & Tools', emoji: '🛠️', activity: ',help utility | Tools', type: ActivityType.Playing },
    economy: { name: 'Economy & Rewards', emoji: '💰', activity: ',shop | Server Economy', type: ActivityType.Playing },
    social: { name: 'Social & Fun', emoji: '🎭', activity: ',social | Anime Actions', type: ActivityType.Playing }
};

class MultiBotManager {
    constructor() {
        this.instances = new Map(); // id -> { client, name, role, isPrimary, startedAt, token }
        this.primaryClient = null;
        this.primaryToken = null;
        this.sharedCommands = new Collection();
        this.sharedPrefixCommands = new Collection();
        this.sharedAliases = new Collection();
        this.eventHooks = [];
        this.virtualNodes = VIRTUAL_WORKER_NODES;
        this.presenceInterval = null;
        this.currentPresenceIndex = 0;
    }

    registerEventHook(fn) {
        if (typeof fn !== 'function') return;
        this.eventHooks.push(fn);
        for (const [id, info] of this.instances.entries()) {
            if (info.client && !info.isPrimary) {
                if (!info.client._appliedHooks) info.client._appliedHooks = new Set();
                if (!info.client._appliedHooks.has(fn)) {
                    info.client._appliedHooks.add(fn);
                    try { fn(info.client); } catch (e) { console.error('MultiBot Hook Run Error:', e); }
                }
            }
        }
    }

    createClientInstance(token, name = 'Worker Bot', isPrimary = false, role = 'all') {
        const client = new Client({
            intents: [
                GatewayIntentBits.Guilds,
                GatewayIntentBits.GuildMessages,
                GatewayIntentBits.MessageContent,
                GatewayIntentBits.GuildMembers,
                GatewayIntentBits.GuildVoiceStates,
                GatewayIntentBits.GuildModeration,
                GatewayIntentBits.GuildMessageReactions,
                GatewayIntentBits.DirectMessages
            ],
            partials: [Partials.Message, Partials.Channel, Partials.Reaction, Partials.User, Partials.GuildMember],
            failIfNotExists: false,
            rest: {
                timeout: 30000,
                retries: 5
            },
            ws: {
                large_threshold: 50
            }
        });

        client.setMaxListeners(50);
        client.commands = this.sharedCommands;
        client.prefixCommands = this.sharedPrefixCommands;
        client.aliases = this.sharedAliases;
        client.multiBot = this;
        client.verifyMap = new Map();
        client.voiceCalls = new Map();
        client.vcLocks = new Map();
        client.botRole = role;
        client.isPrimary = Boolean(isPrimary);

        client.on(Events.Error, err => console.error(`❌ [${name}] Discord Error:`, err?.message || err));
        client.on(Events.Warn, warn => console.warn(`⚠️ [${name}] Warning:`, warn));
        client.on(Events.ShardError, err => console.error(`❌ [${name}] Network/Shard Error:`, err?.message || err));
        client.on(Events.ShardDisconnect, (evt, id) => console.warn(`⚠️ [${name}] Shard #${id} Disconnected. Auto-reconnecting...`));
        client.on(Events.ShardReconnecting, (id) => console.log(`🔄 [${name}] Shard #${id} Reconnecting...`));
        client.on(Events.ShardResume, (id) => console.log(`✅ [${name}] Shard #${id} Resumed.`));

        if (!client._appliedHooks) client._appliedHooks = new Set();
        for (const hook of this.eventHooks) {
            if (!client._appliedHooks.has(hook)) {
                client._appliedHooks.add(hook);
                try { hook(client); } catch (e) { console.error('MultiBot Hook Error:', e); }
            }
        }

        return client;
    }

    async initAll(primaryClient, primaryToken) {
        this.primaryClient = primaryClient;
        this.primaryToken = primaryToken;
        primaryClient.multiBot = this;
        primaryClient.isPrimary = true;
        primaryClient.botRole = process.env.PRIMARY_BOT_ROLE || 'all';

        // Initialize Primary Music Manager
        try {
            createMusicManager(primaryClient);
        } catch (e) {
            console.error('Primary Music Init Error:', e.message);
        }

        // Register Primary Client in cluster map
        const primaryId = primaryClient.user ? primaryClient.user.id : 'primary';
        this.instances.set(primaryId, {
            client: primaryClient,
            name: 'Primary Main Bot',
            role: primaryClient.botRole,
            isPrimary: true,
            startedAt: Date.now(),
            token: primaryToken
        });

        // Start Virtual Multi-Bot Presence Rotation (Cycles through all 6 virtual workers)
        this.startVirtualPresenceRotator(primaryClient);

        // 1. Gather tokens from MongoDB MultiBotToken collection
        let dbTokens = [];
        try {
            if (mongoose.connection.readyState === 1) {
                dbTokens = await loadEncryptedWorkerTokens();
            }
        } catch (e) {
            console.error('⚠️ Multi-Bot encrypted token store unavailable; database workers were not loaded:', e.message);
        }

        // 2. Gather tokens from .env
        const envTokens = [];
        if (process.env.BOT_TOKENS) {
            const rawTokens = process.env.BOT_TOKENS.split(',').map(t => cleanToken(t)).filter(Boolean);
            envTokens.push(...rawTokens);
        }
        for (let i = 2; i <= 20; i++) {
            const tok = process.env[`TOKEN_${i}`] || process.env[`BOT_TOKEN_${i}`] || process.env[`DISCORD_TOKEN_${i}`];
            const cleanTok = cleanToken(tok);
            if (cleanTok && !envTokens.includes(cleanTok)) {
                envTokens.push(cleanTok);
            }
        }

        // 3. Deduplicate candidate tokens across DB and Environment
        const candidateMap = new Map(); // token -> role
        envTokens.forEach((t, i) => {
            if (t && t !== primaryToken) {
                const envRole = process.env[`TOKEN_${i + 2}_ROLE`] || 'all';
                candidateMap.set(t, envRole);
            }
        });
        dbTokens.forEach(doc => {
            const cleanDocTok = cleanToken(doc.token);
            if (cleanDocTok && cleanDocTok !== primaryToken) {
                candidateMap.set(cleanDocTok, doc.role || 'all');
            }
        });

        console.log(`🤖 [Multi-Bot Cluster] Activated 6 Virtual Worker Sub-Bots on Primary Token + ${candidateMap.size} unique candidate physical worker tokens.`);

        // 4. Validate and Spawn each candidate physical worker
        for (const [token, role] of candidateMap.entries()) {
            try {
                const check = await verifyDiscordToken(token);
                if (!check.valid) {
                    console.warn(`⚠️ [Multi-Bot Worker] Skipped invalid candidate token (${maskToken(token)}): ${check.error || check.status || 'Unauthorized'}`);
                    continue;
                }
                const botId = check.bot.id;
                if (botId === primaryClient.user?.id) continue;
                if (this.instances.has(botId)) continue; // Avoid duplicate instance

                console.log(`🚀 [Multi-Bot Worker] Pre-verified: ${check.bot.username}#${check.bot.discriminator || '0'} (ID: ${botId}). Spawning worker...`);
                await this.spawnWorker(token, check.bot.username, role);
            } catch (err) {
                console.error(`❌ Failed to spawn secondary bot instance:`, err.message);
            }
        }
    }

    startVirtualPresenceRotator(client) {
        if (this.presenceInterval) clearInterval(this.presenceInterval);

        const updateStatus = () => {
            if (!client || !client.user) return;
            const node = this.virtualNodes[this.currentPresenceIndex % this.virtualNodes.length];
            this.currentPresenceIndex++;

            try {
                client.user.setPresence({
                    activities: [{
                        name: `${node.emoji} [${node.name.split(' ')[1]}] ${node.activity}`,
                        type: node.type
                    }],
                    status: 'online'
                });
            } catch (e) {}
        };

        updateStatus();
        this.presenceInterval = setInterval(updateStatus, 90000); // Rotates safely every 90 seconds (Discord rate limit compliant)
    }

    applyPresence(client, role = 'all') {
        const preset = ROLE_PRESETS[role] || ROLE_PRESETS.all;
        try {
            if (client.user) {
                client.user.setPresence({
                    activities: [{ name: preset.activity, type: preset.type }],
                    status: 'online'
                });
            }
        } catch (e) {}
    }

    async spawnWorker(token, name = 'Worker Bot', role = 'all') {
        if (!token || token === this.primaryToken) return null;
        const existing = Array.from(this.instances.values()).find(i => i.token === token);
        if (existing) return existing;

        const workerClient = this.createClientInstance(token, name, false, role);

        return new Promise((resolve) => {
            let settled = false;
            const timer = setTimeout(() => {
                if (!settled) {
                    settled = true;
                    console.warn(`⚠️ Secondary Bot [${name}] login timed out after 25s.`);
                    resolve(null);
                }
            }, 25000);

            workerClient.once(Events.ClientReady, async () => {
                if (settled) return;
                settled = true;
                clearTimeout(timer);

                const info = {
                    client: workerClient,
                    name: `${workerClient.user.username} (${name})`,
                    role: role,
                    isPrimary: false,
                    startedAt: Date.now(),
                    token: token
                };
                this.instances.set(workerClient.user.id, info);

                // Run any newly registered event hooks safely
                if (!workerClient._appliedHooks) workerClient._appliedHooks = new Set();
                for (const hook of this.eventHooks) {
                    if (!workerClient._appliedHooks.has(hook)) {
                        workerClient._appliedHooks.add(hook);
                        try { hook(workerClient); } catch (e) { console.error('MultiBot Ready Hook Error:', e); }
                    }
                }

                this.applyPresence(workerClient, role);

                try {
                    createMusicManager(workerClient);
                    if (workerClient.manager && typeof workerClient.manager.init === 'function') {
                        await workerClient.manager.init(workerClient.user.id);
                    }
                } catch (lavalinkErr) {
                    console.warn(`⚠️ Multi-Bot Worker Music Init (${workerClient.user.tag}):`, lavalinkErr.message);
                }

                console.log(`✅ [Physical Bot Online] Connected: ${workerClient.user.tag} | Role: [${ROLE_PRESETS[role]?.emoji || '🤖'} ${role.toUpperCase()}]`);
                resolve(info);
            });

            workerClient.login(token).catch(err => {
                if (!settled) {
                    settled = true;
                    clearTimeout(timer);
                    console.error(`❌ Secondary Bot Login Failed for [${name}]:`, err.message);
                    resolve(null);
                }
            });
        });
    }

    async addToken(token, role = 'all', name = 'Worker Bot', addedBy = 'Admin') {
        const clean = cleanToken(token);
        if (!clean) throw new Error('A Discord bot token is required.');
        if (clean === this.primaryToken) throw new Error('The primary Starry bot cannot be added as a worker.');
        // Validate encryption configuration before connecting a worker or writing credentials.
        getWorkerTokenKey();
        const validRole = ROLE_PRESETS[role] ? role : 'all';
        const verification = await verifyDiscordToken(clean);
        if (!verification.valid || !verification.bot?.id) {
            throw new Error('Discord rejected this bot token. Check that it belongs to a bot account and try again.');
        }
        if (String(verification.bot.id) === String(this.primaryClient?.user?.id || '')) {
            throw new Error('The primary Starry bot cannot be added as a worker.');
        }
        const existing = this.instances.get(String(verification.bot.id));
        if (existing) throw new Error('This bot is already connected to the Starry cluster.');
        const safeName = String(name || verification.bot.username || 'Worker Bot').trim().slice(0, 64) || 'Worker Bot';
        const spawned = await this.spawnWorker(clean, safeName, validRole);
        if (!spawned) throw new Error('The bot token was valid, but the worker could not finish connecting. Check its gateway status and try again.');
        try {
            const tokenHash = hashWorkerToken(clean);
            const encryptedToken = encryptWorkerToken(clean);
            await MultiBotToken.updateOne(
                { tokenHash },
                { $set: { token: encryptedToken, tokenHash, name: safeName, role: validRole, addedBy: String(addedBy || 'Admin'), enabled: true } },
                { upsert: true }
            );
        } catch (error) {
            try { spawned.client.destroy(); } catch (_) {}
            this.instances.delete(String(spawned.client?.user?.id || verification.bot.id));
            throw new Error('Worker connected but could not be saved to the cluster database. Please retry.');
        }
        return spawned;
    }

    async setRole(botIdOrName, newRole) {
        if (!ROLE_PRESETS[newRole]) throw new Error(`Invalid role. Valid roles: ${Object.keys(ROLE_PRESETS).join(', ')}`);

        for (const [id, info] of this.instances.entries()) {
            if (id === botIdOrName || info.name.toLowerCase().includes(botIdOrName.toLowerCase()) || info.client.user?.username.toLowerCase() === botIdOrName.toLowerCase()) {
                info.role = newRole;
                info.client.botRole = newRole;
                this.applyPresence(info.client, newRole);

                if (!info.isPrimary && info.token) {
                    await MultiBotToken.updateOne({ tokenHash: hashWorkerToken(info.token) }, { $set: { role: newRole } }).catch(() => {});
                }
                return { success: true, bot: info };
            }
        }
        return { success: false, message: 'Bot instance not found in active cluster.' };
    }

    async removeToken(tokenIdOrUserId) {
        let removed = false;
        let storedToken = null;
        for (const [id, info] of this.instances.entries()) {
            if (id === String(tokenIdOrUserId) || info.token === tokenIdOrUserId) {
                if (info.isPrimary) throw new Error('Cannot remove the primary Starry bot.');
                storedToken = info.token || null;
                try { info.client.destroy(); } catch (_) {}
                this.instances.delete(id);
                removed = true;
                break;
            }
        }
        const lookup = storedToken || tokenIdOrUserId;
        await MultiBotToken.deleteOne({ $or: [{ tokenHash: hashWorkerToken(lookup) }, { _id: lookup }] }).catch(() => {});
        return removed;
    }

    // 🎵 Intelligent Multi-VC Music Router
    getMusicWorker(guild, voiceChannel) {
        if (!guild || !voiceChannel) return null;
        const guildId = guild.id;
        const voiceChannelId = voiceChannel.id;

        // Step 1: Check if any bot in the cluster is ALREADY connected to this exact voice channel
        for (const [id, info] of this.instances.entries()) {
            const client = info.client;
            if (!client || !client.user) continue;

            const clientGuild = client.guilds.cache.get(guildId) || guild;
            const member = clientGuild.members.me || clientGuild.members.cache.get(client.user.id);
            if (member && member.voice && member.voice.channelId === voiceChannelId) {
                return {
                    client,
                    name: info.name,
                    role: info.role,
                    botMember: member,
                    isAvailable: true,
                    alreadyInChannel: true
                };
            }
        }

        // Step 2: Prioritize bots that are free
        const candidateBots = Array.from(this.instances.values()).sort((a, b) => {
            if (a.role === 'music' && b.role !== 'music') return -1;
            if (b.role === 'music' && a.role !== 'music') return 1;
            return 0;
        });

        for (const info of candidateBots) {
            const client = info.client;
            if (!client || !client.user) continue;

            const clientGuild = client.guilds.cache.get(guildId) || guild;
            const member = clientGuild.members.me || clientGuild.members.cache.get(client.user.id);
            if (member) {
                const currentVc = member.voice ? member.voice.channelId : null;
                if (!currentVc) {
                    return {
                        client,
                        name: info.name,
                        role: info.role,
                        botMember: member,
                        isAvailable: true,
                        alreadyInChannel: false
                    };
                }
            }
        }

        // Step 3: If single token or all bots occupied, check if current VC has no active human members
        const primaryBotMember = guild.members.me;
        if (primaryBotMember && primaryBotMember.voice && primaryBotMember.voice.channel) {
            const currentChannel = primaryBotMember.voice.channel;
            const nonBots = currentChannel.members.filter(m => !m.user.bot).size;

            if (nonBots === 0) {
                // Auto-relocate single token bot to the new channel since previous VC is empty
                return {
                    client: this.primaryClient,
                    player: this.primaryClient.manager?.getPlayer(guildId),
                    name: 'Primary Audio Engine (Auto-Relocated)',
                    role: 'music',
                    botMember: primaryBotMember,
                    isAvailable: true,
                    alreadyInChannel: false,
                    autoRelocate: true
                };
            }
        }

        return {
            isAvailable: false,
            totalBots: this.instances.size,
            currentVcId: primaryBotMember?.voice?.channelId
        };
    }

    getPlayerForChannel(guildId, voiceChannelId) {
        const { StarryAudioEngine } = require('../utils/nativeAudioEngine');
        for (const [id, info] of this.instances.entries()) {
            const client = info.client;
            if (!client) continue;

            if (client.manager) {
                const player = client.manager.getPlayer(guildId);
                if (player && player.voiceId === voiceChannelId) {
                    return player;
                }
            }

            const nPlayer = StarryAudioEngine?.getPlayer(guildId, client);
            if (nPlayer && !nPlayer.destroyed && nPlayer.voiceChannel?.id === voiceChannelId) {
                return nPlayer;
            }
        }
        return null;
    }

    getPlayerForGuild(guildId) {
        const { StarryAudioEngine } = require('../utils/nativeAudioEngine');
        for (const [id, info] of this.instances.entries()) {
            const client = info.client;
            if (!client) continue;

            if (client.manager) {
                const player = client.manager.getPlayer(guildId);
                if (player) return player;
            }

            const nPlayer = StarryAudioEngine?.getPlayer(guildId, client);
            if (nPlayer && !nPlayer.destroyed && (nPlayer.currentTrack || nPlayer.queue.length > 0)) {
                return nPlayer;
            }
        }
        return null;
    }

    getClusterStats() {
        const physicalBots = [];
        let totalGuilds = 0;
        let totalUsers = 0;

        for (const [id, info] of this.instances.entries()) {
            const client = info.client;
            if (!client || !client.user) continue;

            const guildCount = client.guilds.cache.size;
            const userCount = client.guilds.cache.reduce((acc, g) => acc + (g.memberCount || 0), 0);
            const ping = Math.round(client.ws.ping) || 0;
            const uptime = client.uptime || 0;
            const rolePreset = ROLE_PRESETS[info.role] || ROLE_PRESETS.all;

            let activeVCSessions = 0;
            if (client.manager) {
                activeVCSessions = client.manager.players ? client.manager.players.size : 0;
            }

            totalGuilds += guildCount;
            totalUsers += userCount;

            physicalBots.push({
                id: client.user.id,
                tag: client.user.tag,
                name: info.name,
                role: info.role,
                roleLabel: `${rolePreset.emoji} ${rolePreset.name}`,
                isPrimary: info.isPrimary,
                guilds: guildCount,
                users: userCount,
                ping: ping,
                uptime: uptime,
                activeMusicPlayers: activeVCSessions,
                status: client.ws.status === 0 ? 'ONLINE 🟢' : 'CONNECTING 🟡'
            });
        }

        return {
            totalPhysicalBots: physicalBots.length,
            totalVirtualNodes: this.virtualNodes.length,
            totalGuilds,
            totalUsers,
            physicalBots,
            virtualNodes: this.virtualNodes
        };
    }
}

const multiBotSingleton = new MultiBotManager();

module.exports = multiBotSingleton;
module.exports.ROLE_PRESETS = ROLE_PRESETS;
module.exports.VIRTUAL_WORKER_NODES = VIRTUAL_WORKER_NODES;
