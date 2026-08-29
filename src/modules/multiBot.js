// ==========================================
// 🤖 MULTI-BOT CLUSTER ARCHITECTURE
// Flavi-Style Secondary & Clone Bot Management
// File Path: src/modules/multiBot.js
// ==========================================
const { Client, GatewayIntentBits, Partials, Collection, Events } = require('discord.js');
const mongoose = require('mongoose');
const config = require('../config');

let MultiBotToken;
try {
    MultiBotToken = require('../models/MultiBotToken');
} catch (e) {
    const schema = new mongoose.Schema({
        token: { type: String, required: true, unique: true },
        name: { type: String, default: 'Secondary Worker Bot' },
        addedBy: { type: String, default: 'System' },
        enabled: { type: Boolean, default: true },
        createdAt: { type: Date, default: Date.now }
    });
    MultiBotToken = mongoose.models.MultiBotToken || mongoose.model('MultiBotToken', schema);
}

class MultiBotManager {
    constructor() {
        this.instances = new Map(); // token or id -> { client, name, isPrimary, readyAt, startedAt }
        this.primaryClient = null;
        this.primaryToken = null;
        this.sharedCommands = new Collection();
        this.sharedPrefixCommands = new Collection();
        this.sharedAliases = new Collection();
        this.eventHooks = [];
    }

    registerEventHook(fn) {
        this.eventHooks.push(fn);
    }

    createClientInstance(token, name = 'Worker Bot', isPrimary = false) {
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
            partials: [Partials.Message, Partials.Channel, Partials.Reaction, Partials.User, Partials.GuildMember]
        });

        client.setMaxListeners(50);
        client.commands = this.sharedCommands;
        client.prefixCommands = this.sharedPrefixCommands;
        client.aliases = this.sharedAliases;
        client.multiBot = this;
        client.verifyMap = new Map();
        client.voiceCalls = new Map();
        client.vcLocks = new Map();

        // Bind multi-bot cluster event hooks
        for (const hook of this.eventHooks) {
            try { hook(client); } catch (e) { console.error('MultiBot Hook Error:', e); }
        }

        return client;
    }

    async initAll(primaryClient, primaryToken) {
        this.primaryClient = primaryClient;
        this.primaryToken = primaryToken;
        primaryClient.multiBot = this;

        // Register Primary Client
        const primaryId = primaryClient.user ? primaryClient.user.id : 'primary';
        this.instances.set(primaryId, {
            client: primaryClient,
            name: 'Primary Main Bot',
            isPrimary: true,
            startedAt: Date.now(),
            token: primaryToken
        });

        // 1. Gather tokens from environment variables
        const envTokens = [];
        if (process.env.BOT_TOKENS) {
            const rawTokens = process.env.BOT_TOKENS.split(',').map(t => t.trim()).filter(Boolean);
            envTokens.push(...rawTokens);
        }

        // Additional numbered tokens like TOKEN_2, TOKEN_3, etc.
        for (let i = 2; i <= 20; i++) {
            const tok = process.env[`TOKEN_${i}`] || process.env[`BOT_TOKEN_${i}`] || process.env[`DISCORD_TOKEN_${i}`];
            if (tok && tok.trim() && !envTokens.includes(tok.trim())) {
                envTokens.push(tok.trim());
            }
        }

        // 2. Gather tokens from MongoDB MultiBotToken collection
        let dbTokens = [];
        try {
            if (mongoose.connection.readyState === 1) {
                dbTokens = await MultiBotToken.find({ enabled: true }).lean();
            }
        } catch (err) {
            console.warn('⚠️ Could not fetch MultiBot tokens from MongoDB:', err.message);
        }

        const allExtraTokens = new Set();
        envTokens.forEach(t => { if (t !== primaryToken) allExtraTokens.add(t); });
        dbTokens.forEach(doc => { if (doc.token && doc.token !== primaryToken) allExtraTokens.add(doc.token); });

        console.log(`🤖 [Multi-Bot Cluster] Found ${allExtraTokens.size} secondary worker bot tokens.`);

        let workerIndex = 1;
        for (const token of allExtraTokens) {
            try {
                await this.spawnWorker(token, `Worker Bot #${workerIndex++}`);
            } catch (err) {
                console.error(`❌ Failed to spawn secondary bot instance:`, err.message);
            }
        }
    }

    async spawnWorker(token, name = 'Worker Bot') {
        if (!token || token === this.primaryToken) return null;
        if (this.instances.has(token)) return this.instances.get(token);

        const workerClient = this.createClientInstance(token, name, false);

        return new Promise((resolve) => {
            workerClient.once(Events.ClientReady, () => {
                const info = {
                    client: workerClient,
                    name: `${workerClient.user.username} (${name})`,
                    isPrimary: false,
                    startedAt: Date.now(),
                    token: token
                };
                this.instances.set(workerClient.user.id, info);
                console.log(`✅ [Multi-Bot Online] Secondary Bot Connected: ${workerClient.user.tag} (Serving ${workerClient.guilds.cache.size} servers)`);
                resolve(info);
            });

            workerClient.login(token).catch(err => {
                console.error(`❌ Secondary Bot Login Failed for [${name}]:`, err.message);
                resolve(null);
            });
        });
    }

    async addToken(token, name = 'Worker Bot', addedBy = 'Admin') {
        if (!token) throw new Error('Token is required.');
        if (token === this.primaryToken) throw new Error('Cannot add primary bot token as secondary.');

        await MultiBotToken.updateOne({ token }, { token, name, addedBy, enabled: true }, { upsert: true });
        const spawned = await this.spawnWorker(token, name);
        return spawned;
    }

    async removeToken(tokenIdOrUserId) {
        let removed = false;
        for (const [id, info] of this.instances.entries()) {
            if (id === tokenIdOrUserId || info.token === tokenIdOrUserId) {
                if (info.isPrimary) throw new Error('Cannot remove primary bot.');
                try { info.client.destroy(); } catch (e) {}
                this.instances.delete(id);
                removed = true;
                break;
            }
        }
        await MultiBotToken.deleteOne({ $or: [{ token: tokenIdOrUserId }, { _id: tokenIdOrUserId }] }).catch(() => {});
        return removed;
    }

    getClusterStats() {
        const bots = [];
        let totalGuilds = 0;
        let totalUsers = 0;

        for (const [id, info] of this.instances.entries()) {
            const client = info.client;
            if (!client || !client.user) continue;

            const guildCount = client.guilds.cache.size;
            const userCount = client.guilds.cache.reduce((acc, g) => acc + (g.memberCount || 0), 0);
            const ping = Math.round(client.ws.ping) || 0;
            const uptime = client.uptime || 0;

            totalGuilds += guildCount;
            totalUsers += userCount;

            bots.push({
                id: client.user.id,
                tag: client.user.tag,
                name: info.name,
                isPrimary: info.isPrimary,
                guilds: guildCount,
                users: userCount,
                ping: ping,
                uptime: uptime,
                status: client.ws.status === 0 ? 'READY 🟢' : 'CONNECTING 🟡'
            });
        }

        return {
            totalBots: bots.length,
            totalGuilds,
            totalUsers,
            bots
        };
    }
}

const multiBotSingleton = new MultiBotManager();

module.exports = multiBotSingleton;
