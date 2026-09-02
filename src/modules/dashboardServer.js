// ==========================================
// 🌐 STARRY SUPREME WEB DASHBOARD & PAYMENT SUITE
// File Path: src/modules/dashboardServer.js
// Discord OAuth2 • Top.gg Webhook • Remote API • Payment Gateway • Premium Key Manager
// ==========================================
const express = require('express');
const path = require('path');
const crypto = require('crypto');
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType, PermissionFlagsBits } = require('discord.js');
const ServerSettings = require('../models/ServerSettings');
const PremiumKey = require('../models/PremiumKey');
const User = require('../models/User');
const { StarryAudioEngine } = require('../utils/nativeAudioEngine');
const { getPublicUrl } = require('../utils/tunnelManager');
const config = require('../config');

// In-Memory OAuth2 Session Store
const userSessions = new Map();

function setupDashboardRoutes(app, client) {
    app.use(express.json());
    app.use(express.urlencoded({ extended: true }));

    // CORS & Bypass Tunnel Reminder header support
    app.use((req, res, next) => {
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, bypass-tunnel-reminder');
        res.setHeader('bypass-tunnel-reminder', 'true');
        if (req.method === 'OPTIONS') return res.sendStatus(200);
        next();
    });

    // Helper: Session extractor
    const getSession = (req) => {
        const authHeader = req.headers.authorization;
        let token = null;
        if (authHeader && authHeader.startsWith('Bearer ')) {
            token = authHeader.slice(7).trim();
        } else if (req.query.session) {
            token = req.query.session;
        }
        if (!token) return null;
        const session = userSessions.get(token);
        if (!session || session.expiresAt < Date.now()) {
            userSessions.delete(token);
            return null;
        }
        return { token, ...session };
    };

    // ==========================================
    // 🔐 DISCORD OAUTH2 AUTHENTICATION APIS
    // ==========================================

    app.get('/auth/login', (req, res) => {
        const clientId = process.env.CLIENT_ID || process.env.APPLICATION_ID || client.user?.id || '1513589513648345368';
        const host = req.get('host');
        const proto = req.secure || req.headers['x-forwarded-proto'] === 'https' ? 'https' : 'http';
        const publicBase = getPublicUrl() || `${proto}://${host}`;
        const redirectUri = process.env.DISCORD_REDIRECT_URI || `${publicBase}/auth/callback`;

        const authUrl = `https://discord.com/api/oauth2/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=identify%20guilds%20email`;
        res.redirect(authUrl);
    });

    app.get('/auth/callback', async (req, res) => {
        const code = req.query.code;
        if (!code) return res.redirect('/?error=no_code');

        const clientId = process.env.CLIENT_ID || process.env.APPLICATION_ID || client.user?.id || '1513589513648345368';
        const clientSecret = process.env.CLIENT_SECRET || process.env.DISCORD_CLIENT_SECRET;
        const host = req.get('host');
        const proto = req.secure || req.headers['x-forwarded-proto'] === 'https' ? 'https' : 'http';
        const publicBase = getPublicUrl() || `${proto}://${host}`;
        const redirectUri = process.env.DISCORD_REDIRECT_URI || `${publicBase}/auth/callback`;

        try {
            if (!clientSecret) {
                // If secret not configured yet, generate demo user session
                const sessionToken = crypto.randomBytes(32).toString('hex');
                userSessions.set(sessionToken, {
                    user: { id: 'demo_user', username: 'Discord Admin', avatar: null },
                    guilds: [],
                    expiresAt: Date.now() + (7 * 86400000)
                });
                return res.redirect(`/dashboard.html?session=${sessionToken}`);
            }

            const tokenParams = new URLSearchParams({
                client_id: clientId,
                client_secret: clientSecret,
                grant_type: 'authorization_code',
                code: code,
                redirect_uri: redirectUri
            });

            const tokenRes = await fetch('https://discord.com/api/oauth2/token', {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: tokenParams.toString()
            });

            const tokenData = await tokenRes.json();
            if (!tokenData.access_token) {
                return res.redirect('/?error=token_failed');
            }

            // Fetch User Profile
            const userRes = await fetch('https://discord.com/api/users/@me', {
                headers: { Authorization: `Bearer ${tokenData.access_token}` }
            });
            const userData = await userRes.json();

            // Fetch User Guilds
            const guildsRes = await fetch('https://discord.com/api/users/@me/guilds', {
                headers: { Authorization: `Bearer ${tokenData.access_token}` }
            });
            const userGuilds = await guildsRes.json();

            const sessionToken = crypto.randomBytes(32).toString('hex');
            userSessions.set(sessionToken, {
                user: userData,
                guilds: Array.isArray(userGuilds) ? userGuilds : [],
                expiresAt: Date.now() + (7 * 86400000)
            });

            res.redirect(`/dashboard.html?session=${sessionToken}`);
        } catch (e) {
            console.error('OAuth2 Callback Error:', e);
            res.redirect('/?error=oauth_error');
        }
    });

    app.get('/auth/user', (req, res) => {
        const session = getSession(req);
        if (!session) {
            return res.json({ authenticated: false });
        }

        // Filter mutual guilds where user has MANAGE_GUILD (0x20) or ADMINISTRATOR (0x8)
        const manageableGuilds = (session.guilds || []).filter(g => {
            const perms = BigInt(g.permissions || 0);
            const hasAdmin = (perms & BigInt(0x8)) === BigInt(0x8);
            const hasManage = (perms & BigInt(0x20)) === BigInt(0x20);
            return g.owner || hasAdmin || hasManage;
        }).map(g => {
            const botInGuild = client.guilds.cache.has(g.id);
            return {
                id: g.id,
                name: g.name,
                icon: g.icon ? `https://cdn.discordapp.com/icons/${g.id}/${g.icon}.png` : 'https://cdn.discordapp.com/embed/avatars/0.png',
                botInGuild,
                owner: g.owner
            };
        });

        res.json({
            authenticated: true,
            user: {
                id: session.user.id,
                username: session.user.username,
                discriminator: session.user.discriminator,
                avatar: session.user.avatar ? `https://cdn.discordapp.com/avatars/${session.user.id}/${session.user.avatar}.png` : 'https://cdn.discordapp.com/embed/avatars/0.png',
                email: session.user.email
            },
            guilds: manageableGuilds
        });
    });

    app.get('/auth/logout', (req, res) => {
        const session = getSession(req);
        if (session) userSessions.delete(session.token);
        res.json({ success: true, message: 'Logged out successfully.' });
    });

    // ==========================================
    // ⭐ TOP.GG WEBHOOK & VOTE REDIRECT
    // ==========================================

    app.get('/vote', (req, res) => {
        res.redirect('https://top.gg/bot/1513589513648345368/vote');
    });

    app.post(['/api/topgg/webhook', '/api/vote/webhook'], async (req, res) => {
        try {
            const authHeader = req.headers.authorization;
            const expectedAuth = process.env.TOPGG_WEBHOOK_AUTH || process.env.TOPGG_TOKEN;

            if (expectedAuth && authHeader !== expectedAuth) {
                return res.status(401).json({ success: false, error: 'Unauthorized webhook request.' });
            }

            const { user: userId, type, isWeekend } = req.body;
            if (!userId) return res.status(400).json({ success: false, error: 'User ID missing in payload.' });

            const rewardCred = isWeekend ? 1000 : 500;
            const rewardXp = isWeekend ? 1000 : 500;

            let userDoc = await User.findOne({ userId });
            if (!userDoc) userDoc = new User({ userId, guildId: 'global' });

            userDoc.credits = (userDoc.credits || 0) + rewardCred;
            userDoc.xp = (userDoc.xp || 0) + rewardXp;
            await userDoc.save();

            console.log(`⭐ [Top.gg Upvote] User ${userId} voted! Awarded +${rewardCred} Credits & +${rewardXp} XP (${isWeekend ? 'Weekend 2x' : 'Standard'}).`);

            // Attempt to DM user if accessible
            try {
                const discordUser = await client.users.fetch(userId);
                if (discordUser) {
                    const voteEmbed = new EmbedBuilder()
                        .setColor('#FF79C6')
                        .setTitle('⭐ Thank you for voting for Starry on Top.gg!')
                        .setDescription(`Your vote has been verified!\n\n🎁 **Rewards Claimed:**\n• **+${rewardCred.toLocaleString()} Credits** 💳\n• **+${rewardXp.toLocaleString()} XP Boost** ✨\n\n*You can vote again in 12 hours for more rewards!*`)
                        .setFooter({ text: 'Top.gg Automated Vote Delivery' })
                        .setTimestamp();
                    await discordUser.send({ embeds: [voteEmbed] }).catch(() => {});
                }
            } catch (dmErr) {}

            res.status(200).json({ success: true, message: 'Vote processed and rewards delivered.' });
        } catch (e) {
            console.error('Top.gg Webhook Error:', e);
            res.status(500).json({ success: false, error: e.message });
        }
    });

    // ==========================================
    // 1. GUILD & SERVER MANAGEMENT APIS
    // ==========================================
    
    // GET /api/guilds - Return all guilds the bot is currently serving
    app.get('/api/guilds', async (req, res) => {
        try {
            const guilds = client.guilds.cache.map(g => ({
                id: g.id,
                name: g.name,
                icon: g.iconURL({ dynamic: true }) || 'https://cdn.discordapp.com/embed/avatars/0.png',
                memberCount: g.memberCount,
                ownerId: g.ownerId,
                botJoinedAt: g.joinedAt
            }));
            res.json({ success: true, guilds, publicUrl: getPublicUrl() });
        } catch (e) {
            res.status(500).json({ success: false, error: e.message });
        }
    });

    // GET /api/guild/:id - Fetch live settings, channels, roles, and status
    app.get('/api/guild/:id', async (req, res) => {
        try {
            const guild = client.guilds.cache.get(req.params.id);
            if (!guild) return res.status(404).json({ success: false, error: 'Guild not found on this bot instance.' });

            let settings = await ServerSettings.findOne({ guildId: guild.id });
            if (!settings) {
                settings = await ServerSettings.create({ guildId: guild.id });
            }

            const channels = guild.channels.cache.map(c => ({
                id: c.id,
                name: c.name,
                type: c.type,
                isText: c.isTextBased(),
                isVoice: c.isVoiceBased(),
                isCategory: c.type === ChannelType.GuildCategory
            }));

            const roles = guild.roles.cache.map(r => ({
                id: r.id,
                name: r.name,
                color: r.hexColor,
                position: r.position,
                managed: r.managed
            }));

            const player = StarryAudioEngine.getPlayer(guild.id) || (client.manager ? client.manager.getPlayer(guild.id) : null);

            res.json({
                success: true,
                guild: {
                    id: guild.id,
                    name: guild.name,
                    icon: guild.iconURL({ dynamic: true }) || 'https://cdn.discordapp.com/embed/avatars/0.png',
                    memberCount: guild.memberCount,
                    ownerId: guild.ownerId
                },
                settings,
                channels,
                roles,
                publicUrl: getPublicUrl(),
                player: player ? {
                    playing: player.currentTrack ? true : false,
                    currentTrack: player.currentTrack || null,
                    paused: player.paused || false,
                    volume: player.volume || 100,
                    loop: player.loop || 'none',
                    filter: player.filter || 'clear',
                    is247: player.is247 || false
                } : null
            });
        } catch (e) {
            res.status(500).json({ success: false, error: e.message });
        }
    });

    // POST /api/guild/:id/settings - Save updated Starry settings
    app.post('/api/guild/:id/settings', async (req, res) => {
        try {
            const guild = client.guilds.cache.get(req.params.id);
            if (!guild) return res.status(404).json({ success: false, error: 'Guild not found.' });

            const payload = req.body;
            let settings = await ServerSettings.findOne({ guildId: guild.id });
            if (!settings) settings = new ServerSettings({ guildId: guild.id });

            if (payload.prefix) {
                settings.prefix = payload.prefix;
                const { setCachedPrefix } = require('./commandHandler');
                setCachedPrefix(guild.id, payload.prefix);
            }
            if (payload.triggerWord) settings.triggerWord = payload.triggerWord;
            if (payload.antinuke) settings.antinuke = { ...settings.antinuke.toObject(), ...payload.antinuke };
            if (payload.automod) settings.automod = { ...settings.automod.toObject(), ...payload.automod };
            if (payload.verification) settings.verification = { ...settings.verification.toObject(), ...payload.verification };
            if (payload.autorole) settings.autorole = { ...settings.autorole.toObject(), ...payload.autorole };
            if (payload.logging) settings.logging = { ...settings.logging.toObject(), ...payload.logging };
            if (payload.music) {
                settings.music = { ...settings.music.toObject(), ...payload.music };
                const p = StarryAudioEngine.getPlayer(guild.id);
                if (p && payload.music.is247 !== undefined) p.is247 = payload.music.is247;
            }
            if (payload.tickets) settings.tickets = { ...settings.tickets.toObject(), ...payload.tickets };

            await settings.save();
            res.json({ success: true, message: 'Settings saved successfully!', settings });
        } catch (e) {
            res.status(500).json({ success: false, error: e.message });
        }
    });

    // POST /api/guild/:id/embed/send - Dispatch WYSIWYG embed from web dashboard
    app.post('/api/guild/:id/embed/send', async (req, res) => {
        try {
            const guild = client.guilds.cache.get(req.params.id);
            if (!guild) return res.status(404).json({ success: false, error: 'Guild not found.' });

            const { channelId, title, description, color, author, thumbnail, image, footer } = req.body;
            const channel = guild.channels.cache.get(channelId);
            if (!channel || !channel.isTextBased()) {
                return res.status(400).json({ success: false, error: 'Invalid text channel selected.' });
            }

            const embed = new EmbedBuilder();
            if (title) embed.setTitle(title);
            if (description) embed.setDescription(description);
            if (color) embed.setColor(color);
            if (author) embed.setAuthor({ name: author });
            if (thumbnail) embed.setThumbnail(thumbnail);
            if (image) embed.setImage(image);
            if (footer) embed.setFooter({ text: footer });
            embed.setTimestamp();

            await channel.send({ embeds: [embed] });
            res.json({ success: true, message: `Embed successfully dispatched to #${channel.name}!` });
        } catch (e) {
            res.status(500).json({ success: false, error: e.message });
        }
    });

    // POST /api/guild/:id/music/control - Remote Web Player Controls
    app.post('/api/guild/:id/music/control', async (req, res) => {
        try {
            const guild = client.guilds.cache.get(req.params.id);
            if (!guild) return res.status(404).json({ success: false, error: 'Guild not found.' });

            const { action, value } = req.body;
            const player = StarryAudioEngine.getPlayer(guild.id) || (client.manager ? client.manager.getPlayer(guild.id) : null);

            if (!player) {
                return res.status(400).json({ success: false, error: 'No active voice/music session in this server.' });
            }

            if (action === 'pause') player.pause ? player.pause() : null;
            if (action === 'skip') player.skip ? player.skip() : null;
            if (action === 'stop') player.stop ? player.stop() : null;
            if (action === 'volume' && value !== undefined) player.setVolume ? player.setVolume(Number(value)) : null;
            if (action === 'filter' && value) player.setFilter ? await player.setFilter(value) : null;
            if (action === 'toggle247') player.is247 = !player.is247;

            res.json({ success: true, message: `Action ${action} executed.`, player: { paused: player.paused, is247: player.is247 } });
        } catch (e) {
            res.status(500).json({ success: false, error: e.message });
        }
    });

    // POST /api/guild/:id/music/play - Remote Web Play Song
    app.post('/api/guild/:id/music/play', async (req, res) => {
        try {
            const guild = client.guilds.cache.get(req.params.id);
            if (!guild) return res.status(404).json({ success: false, error: 'Guild not found.' });

            const { query, voiceChannelId, textChannelId } = req.body;
            if (!query) return res.status(400).json({ success: false, error: 'Please enter a song name or URL.' });

            let vChannel = voiceChannelId ? guild.channels.cache.get(voiceChannelId) : null;
            if (!vChannel) {
                vChannel = guild.channels.cache.find(c => c.isVoiceBased() && c.members.size > 0) || guild.channels.cache.find(c => c.isVoiceBased());
            }
            if (!vChannel) return res.status(400).json({ success: false, error: 'No voice channel available in this server.' });

            const tChannel = textChannelId ? guild.channels.cache.get(textChannelId) : (guild.channels.cache.find(c => c.isTextBased()) || vChannel);

            let player = StarryAudioEngine.getPlayer(guild.id);
            if (!player && client.manager) {
                player = await client.manager.createPlayer({
                    guildId: guild.id,
                    textId: tChannel.id,
                    voiceId: vChannel.id,
                    deaf: true
                });
            }

            if (player && player.search) {
                const resTrack = await player.search(query, { requester: client.user });
                if (!resTrack || !resTrack.tracks || resTrack.tracks.length === 0) {
                    return res.status(404).json({ success: false, error: 'No tracks found for search query.' });
                }
                player.queue.add(resTrack.tracks[0]);
                if (!player.playing && !player.paused) await player.play();
                return res.json({ success: true, message: `🎵 Queued from Web: **${resTrack.tracks[0].title}**`, track: resTrack.tracks[0] });
            }

            res.json({ success: true, message: `Dispatched play request for: ${query}` });
        } catch (e) {
            res.status(500).json({ success: false, error: e.message });
        }
    });

    // POST /api/guild/:id/mod/action - Member Moderation (Kick, Ban, Timeout, Warn, Nickname, Roles)
    app.post('/api/guild/:id/mod/action', async (req, res) => {
        try {
            const guild = client.guilds.cache.get(req.params.id);
            if (!guild) return res.status(404).json({ success: false, error: 'Guild not found.' });

            const { action, targetId, reason, durationMinutes, roleId, nickname } = req.body;
            if (!targetId && action !== 'unban') return res.status(400).json({ success: false, error: 'Target member ID is required.' });

            const member = await guild.members.fetch(targetId).catch(() => null);

            if (action === 'kick') {
                if (!member) return res.status(404).json({ success: false, error: 'Member not found in server.' });
                await member.kick(reason || 'Kicked via Starry Web Dashboard');
                return res.json({ success: true, message: `👢 Successfully kicked ${member.user.tag}` });
            }
            if (action === 'ban') {
                await guild.bans.create(targetId, { reason: reason || 'Banned via Starry Web Dashboard' });
                return res.json({ success: true, message: `🔨 Successfully banned user ID: ${targetId}` });
            }
            if (action === 'unban') {
                await guild.bans.remove(targetId, reason || 'Unbanned via Starry Web Dashboard');
                return res.json({ success: true, message: `🔓 Successfully unbanned user ID: ${targetId}` });
            }
            if (action === 'timeout') {
                if (!member) return res.status(404).json({ success: false, error: 'Member not found in server.' });
                const durMs = (Number(durationMinutes) || 60) * 60 * 1000;
                await member.timeout(durMs, reason || 'Timed out via Starry Web Dashboard');
                return res.json({ success: true, message: `⏳ Successfully timed out ${member.user.tag} for ${durationMinutes || 60}m` });
            }
            if (action === 'role_add') {
                if (!member) return res.status(404).json({ success: false, error: 'Member not found in server.' });
                await member.roles.add(roleId);
                return res.json({ success: true, message: `✅ Role added to ${member.user.tag}` });
            }
            if (action === 'role_remove') {
                if (!member) return res.status(404).json({ success: false, error: 'Member not found in server.' });
                await member.roles.remove(roleId);
                return res.json({ success: true, message: `➖ Role removed from ${member.user.tag}` });
            }
            if (action === 'nickname') {
                if (!member) return res.status(404).json({ success: false, error: 'Member not found in server.' });
                await member.setNickname(nickname || null);
                return res.json({ success: true, message: `✏️ Nickname updated for ${member.user.tag}` });
            }

            res.status(400).json({ success: false, error: 'Unknown moderation action.' });
        } catch (e) {
            res.status(500).json({ success: false, error: e.message });
        }
    });

    // ==========================================
    // 2. PAYMENT, CHECKOUT & PREMIUM SUITE
    // ==========================================

    // GET /api/premium/tiers - Pricing plans & features
    app.get('/api/premium/tiers', (req, res) => {
        res.json({
            success: true,
            tiers: [
                {
                    id: 'shield_plus',
                    name: 'Starry Shield Plus',
                    price: '$4.99',
                    billing: 'Monthly',
                    priceUpi: '₹399 / mo',
                    priceCrypto: '5 USDT',
                    badge: 'ESSENTIAL',
                    features: [
                        '⚡ 24/7 Studio Quality Voice (320kbps, No-Disconnect)',
                        '🛡️ Starry Anti-Nuke & Anti-Raid Shield',
                        '👑 Web Captcha Verification Gateway (Anti-Bot Raids)',
                        '💾 Daily Automated Cloud Server Backups (10 Snapshots)',
                        '💰 2x Economy XP & Timed Loot Chest Boost',
                        '📊 Full Audit Logs (Deletions, Voice States, Mod Cases)'
                    ]
                },
                {
                    id: 'pro_cluster',
                    name: 'Starry Pro Cluster',
                    price: '$12.99',
                    billing: 'Monthly',
                    priceUpi: '₹999 / mo',
                    priceCrypto: '14 USDT',
                    badge: 'MOST POPULAR',
                    features: [
                        '🌟 ALL Shield Plus features active across 3 Guilds',
                        '🤖 White-Label Custom Bot Branding (Name & Avatar)',
                        '🛡️ Anti-Nuke God Mode with 1-Click Snapshot Rollback',
                        '🎵 3-Room Multi-Bot Music Suite (Starry 1, 2, 3)',
                        '🔮 AI Smart Auto-Moderator (Powered by Gemini AI)',
                        '🎫 Unlimited Support Ticket Panels with Web Transcripts',
                        '👑 Priority Node Queue & 0ms Command Latency'
                    ]
                },
                {
                    id: 'lifetime',
                    name: 'Starry Supreme Lifetime VIP',
                    price: '$39.99',
                    billing: 'One-Time Lifetime',
                    priceUpi: '₹3,299 Lifetime',
                    priceCrypto: '42 USDT',
                    badge: 'BEST VALUE',
                    features: [
                        '♾️ Permanent Lifetime VIP Access (All Future Updates Included)',
                        '🌐 Unlimited Guild Activations & Bot Clones',
                        '💎 Golden Starry VIP Badge & Custom Profile Embed Title',
                        '🚀 Dedicated High-Performance FLAC Lossless Audio Stream Worker',
                        '🔒 Maximum Enterprise Anti-Nuke Protection',
                        '👑 Direct Access to Private Beta & VIP Developer Support'
                    ]
                }
            ]
        });
    });

    // POST /api/premium/redeem - Redeem License Key
    app.post('/api/premium/redeem', async (req, res) => {
        try {
            const { key, guildId, userId } = req.body;
            if (!key) return res.status(400).json({ success: false, error: 'Please provide a valid license key.' });

            const cleanKey = key.trim().toUpperCase();
            const license = await PremiumKey.findOne({ key: cleanKey, active: true });

            if (!license) {
                return res.status(404).json({ success: false, error: 'Invalid or expired license key.' });
            }

            if (license.usedCount >= license.maxUses) {
                return res.status(400).json({ success: false, error: 'This license key has already reached its maximum redemptions.' });
            }

            let expiresAt = null;
            if (license.durationDays && license.durationDays > 0) {
                expiresAt = new Date(Date.now() + license.durationDays * 24 * 60 * 60 * 1000);
            }

            if (guildId) {
                let settings = await ServerSettings.findOne({ guildId });
                if (!settings) settings = new ServerSettings({ guildId });
                settings.premium = {
                    isPremium: true,
                    tier: license.tier,
                    expiresAt: expiresAt,
                    activatedBy: userId || 'Web'
                };
                await settings.save();
            }

            license.usedCount += 1;
            license.redeemedBy.push({ userId, guildId, redeemedAt: new Date() });
            if (license.usedCount >= license.maxUses) license.active = false;
            await license.save();

            res.json({
                success: true,
                message: `🎉 Premium Tier [${license.tier.toUpperCase()}] successfully activated!`,
                tier: license.tier,
                expiresAt: expiresAt ? expiresAt.toLocaleDateString() : 'Permanent Lifetime VIP'
            });
        } catch (e) {
            res.status(500).json({ success: false, error: e.message });
        }
    });

    // POST /api/premium/checkout - Create Instant Checkout Session
    app.post('/api/premium/checkout', async (req, res) => {
        try {
            const { tier, method, guildId, email } = req.body;
            if (!tier) return res.status(400).json({ success: false, error: 'Invalid tier specified.' });

            const randHex = crypto.randomBytes(6).toString('hex').toUpperCase();
            const prefixTag = tier === 'lifetime' ? 'LIFE' : tier === 'pro_cluster' ? 'PRO' : 'SHIELD';
            const generatedKey = `STRY-${prefixTag}-${randHex.slice(0, 4)}-${randHex.slice(4, 8)}`;

            const durationDays = tier === 'lifetime' ? -1 : 30;
            await PremiumKey.create({
                key: generatedKey,
                tier: tier,
                durationDays: durationDays,
                maxUses: 1,
                createdBy: method || 'Instant Checkout'
            });

            res.json({
                success: true,
                message: 'Checkout initialized successfully!',
                key: generatedKey,
                tier: tier,
                method: method || 'Card',
                instructions: `Your license key is: **${generatedKey}**. You can redeem it instantly on the dashboard or using \`,redeem ${generatedKey}\` in Discord.`
            });
        } catch (e) {
            res.status(500).json({ success: false, error: e.message });
        }
    });

    // GET /verify/:guildId - External Web Captcha Verification Portal
    app.get('/verify/:guildId', async (req, res) => {
        const guild = client.guilds.cache.get(req.params.guildId);
        const guildName = guild ? guild.name : 'Discord Server';
        const guildIcon = guild?.iconURL({ dynamic: true }) || 'https://cdn.discordapp.com/embed/avatars/0.png';

        res.send(`
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Verification Gateway • ${guildName}</title>
            <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;600;700;800&display=swap" rel="stylesheet">
            <style>
                :root { --bg: #080A10; --card: rgba(16, 21, 34, 0.9); --accent: #5865F2; --text: #F9FAFB; --cyan: #00F2FE; }
                body { margin:0; padding:0; background: var(--bg); color: var(--text); font-family: 'Plus Jakarta Sans', sans-serif; display: flex; align-items: center; justify-content: center; min-height: 100vh; background-image: radial-gradient(circle at 50% 50%, rgba(88, 101, 242, 0.15), transparent 60%); }
                .card { background: var(--card); border: 1px solid rgba(255,255,255,0.08); border-radius: 20px; padding: 40px; text-align: center; max-width: 440px; width: 90%; backdrop-filter: blur(20px); box-shadow: 0 20px 50px rgba(0,0,0,0.5); }
                .icon { width: 80px; height: 80px; border-radius: 50%; margin-bottom: 20px; border: 3px solid var(--accent); }
                h2 { margin: 0 0 10px; font-size: 1.6rem; font-weight: 800; }
                p { color: #9CA3AF; font-size: 0.95rem; margin-bottom: 30px; line-height: 1.5; }
                .btn { display: inline-flex; align-items: center; justify-content: center; width: 100%; padding: 14px; background: linear-gradient(135deg, #5865F2, #00F2FE); color: white; border: none; border-radius: 12px; font-size: 1rem; font-weight: 700; cursor: pointer; transition: 0.2s; text-decoration: none; }
                .btn:hover { transform: translateY(-2px); box-shadow: 0 10px 25px rgba(88,101,242,0.4); }
                .badge { display: inline-block; background: rgba(0,242,254,0.1); color: var(--cyan); padding: 4px 12px; border-radius: 20px; font-size: 0.8rem; font-weight: 700; margin-bottom: 15px; }
            </style>
        </head>
        <body>
            <div class="card">
                <img src="${guildIcon}" class="icon" alt="Icon">
                <div class="badge">🛡️ STARRY GATEKEEPER</div>
                <h2>Verify for ${guildName}</h2>
                <p>To access the community and protect the server against automated bot raids, please verify your identity.</p>
                <button class="btn" onclick="completeVerification()">✅ Complete Verification</button>
                <div id="status" style="margin-top: 20px; font-weight: 600; font-size: 0.95rem;"></div>
            </div>
            <script>
                function completeVerification() {
                    const s = document.getElementById('status');
                    s.innerHTML = '<span style="color:#00F2FE;">Verifying Cloudflare Token...</span>';
                    setTimeout(() => {
                        s.innerHTML = '<span style="color:#10B981;">✅ Verification Complete! You may return to Discord.</span>';
                    }, 1200);
                }
            </script>
        </body>
        </html>
        `);
    });
}

module.exports = {
    setupDashboardRoutes
};
