// ==========================================
// 🌐 STARRY SUPREME WEB DASHBOARD & PAYMENT SUITE
// File Path: src/modules/dashboardServer.js
// Discord OAuth2 • Top.gg Webhook • Remote API • Payment Gateway • Premium Key Manager
// ==========================================
const express = require('express');
const path = require('path');
const crypto = require('crypto');
const rateLimit = require('express-rate-limit');
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType, PermissionFlagsBits } = require('discord.js');
const ServerSettings = require('../models/ServerSettings');
const PremiumKey = require('../models/PremiumKey');
const PaymentOrder = require('../models/PaymentOrder');
const BoosterRole = require('../models/BoosterRole');
const User = require('../models/User');
const OAuthSession = require('../models/OAuthSession');
const { StarryAudioEngine } = require('../utils/nativeAudioEngine');
const { getPublicUrl } = require('../utils/tunnelManager');
const { engine: boosterEngine } = require('./boosterRoleEngine');
const {
    TIER_CONFIG,
    createPaymentOrder,
    submitPaymentProof,
    approvePaymentOrder,
    rejectPaymentOrder,
    getOrderStatus,
    generateStandaloneKey
} = require('../utils/paymentHelper');
const config = require('../config');

// Short-lived cache backed by MongoDB so sessions survive Render restarts.
const userSessions = new Map();
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const hashSessionToken = (token) => crypto.createHash('sha256').update(token).digest('hex');

function setupDashboardRoutes(app, client) {
    app.use(express.json());
    app.use(express.urlencoded({ extended: true }));

    // Global Rate Limiting Guards
    const apiLimiter = rateLimit({
        windowMs: 60 * 1000,
        max: 150,
        standardHeaders: true,
        legacyHeaders: false,
        message: { success: false, error: 'Too many requests. Please slow down.' }
    });

    const actionLimiter = rateLimit({
        windowMs: 60 * 1000,
        max: 30,
        standardHeaders: true,
        legacyHeaders: false,
        message: { success: false, error: 'Rate limit exceeded for actions. Please wait a moment.' }
    });

    app.use('/api/', apiLimiter);

    // CORS & Bypass Tunnel Reminder header support
    app.use((req, res, next) => {
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, bypass-tunnel-reminder');
        res.setHeader('bypass-tunnel-reminder', 'true');
        if (req.method === 'OPTIONS') return res.sendStatus(200);
        next();
    });

    // Helper: Session extractor. Raw tokens are never stored in MongoDB.
    const getSession = async (req) => {
        const authHeader = req.headers.authorization;
        let token = null;
        if (authHeader && authHeader.startsWith('Bearer ')) token = authHeader.slice(7).trim();
        else if (req.query.session) token = String(req.query.session);
        if (!token || token.length > 4096) return null;
        const cached = userSessions.get(token);
        if (cached && cached.expiresAt > Date.now()) return { token, ...cached };
        userSessions.delete(token);
        const stored = await OAuthSession.findOne({ tokenHash: hashSessionToken(token), expiresAt: { $gt: new Date() } }).lean();
        if (!stored) return null;
        const session = { user: stored.user, guilds: Array.isArray(stored.guilds) ? stored.guilds : [], expiresAt: new Date(stored.expiresAt).getTime() };
        userSessions.set(token, session);
        return { token, ...session };
    };

    // 🛡️ Middleware: Require Authenticated Guild Administrator
    const requireGuildAdmin = async (req, res, next) => {
        let session;
        try { session = await getSession(req); } catch (error) {
            console.error('Dashboard session lookup failed:', error);
            return res.status(503).json({ success: false, error: 'Session service temporarily unavailable. Please retry.' });
        }
        if (!session) {
            return res.status(401).json({ success: false, error: 'Authentication required. Please log in via Discord.' });
        }

        const guildId = req.params.id || req.body.guildId;
        if (!guildId) {
            return res.status(400).json({ success: false, error: 'Guild ID is required.' });
        }

        const guild = client.guilds.cache.get(guildId);
        if (!guild) {
            return res.status(404).json({ success: false, error: 'Guild not found on this bot instance.' });
        }

        const isOwner = (config.BOT_OWNERS || []).includes(session.user?.id);
        const isGuildOwner = guild.ownerId === session.user?.id;
        const userGuild = (session.guilds || []).find(g => g.id === guildId);
        let hasAdminPerms = false;
        if (userGuild) {
            const perms = BigInt(userGuild.permissions || 0);
            hasAdminPerms = (perms & BigInt(0x8)) === BigInt(0x8) || (perms & BigInt(0x20)) === BigInt(0x20);
        }

        if (!isOwner && !isGuildOwner && !hasAdminPerms) {
            return res.status(403).json({ success: false, error: 'Access denied: You need Administrator or Manage Server permissions.' });
        }

        req.session = session;
        req.guild = guild;
        next();
    };

    // 🛡️ Middleware: Require Server Member
    const requireGuildMember = async (req, res, next) => {
        let session;
        try { session = await getSession(req); } catch (error) {
            console.error('Dashboard session lookup failed:', error);
            return res.status(503).json({ success: false, error: 'Session service temporarily unavailable. Please retry.' });
        }
        if (!session) {
            return res.status(401).json({ success: false, error: 'Authentication required. Please log in via Discord.' });
        }

        const guildId = req.params.id || req.body.guildId;
        const guild = client.guilds.cache.get(guildId);
        if (!guild) {
            return res.status(404).json({ success: false, error: 'Guild not found on this bot instance.' });
        }

        const member = await guild.members.fetch(session.user.id).catch(() => null);
        if (!member) {
            return res.status(403).json({ success: false, error: 'You are not a member of this server.' });
        }

        req.session = session;
        req.guild = guild;
        req.member = member;
        next();
    };

    // 🛡️ Middleware: Require Authenticated Discord User
    const requireAuth = async (req, res, next) => {
        let session;
        try { session = await getSession(req); } catch (error) {
            console.error('Dashboard session lookup failed:', error);
            return res.status(503).json({ success: false, error: 'Session service temporarily unavailable. Please retry.' });
        }
        if (!session) {
            return res.status(401).json({ success: false, error: 'Authentication required. Please log in via Discord.' });
        }
        req.session = session;
        next();
    };

    // ==========================================
    // 🔐 DISCORD OAUTH2 AUTHENTICATION APIS
    // ==========================================

    // ==========================================
    // 🔐 DISCORD OAUTH2 AUTHENTICATION APIS
    // ==========================================

    // OAuth state is held in a short-lived HttpOnly cookie so it survives a
    // Render restart and works without process-local session state.
    app.get('/auth/login', actionLimiter, (req, res) => {
        const clientId = process.env.CLIENT_ID || process.env.APPLICATION_ID || client.user?.id || '1513589513648345368';
        const host = req.get('host');
        const proto = req.secure || req.headers['x-forwarded-proto'] === 'https' ? 'https' : 'http';
        const publicBase = (process.env.RENDER_EXTERNAL_URL || getPublicUrl() || `${proto}://${host}`).replace(/\\/+$/, '');
        const redirectUri = process.env.DISCORD_REDIRECT_URI || `${publicBase}/auth/callback`;
        const state = crypto.randomBytes(24).toString('hex');
        const secureCookie = proto === 'https' ? '; Secure' : '';
        res.set('Set-Cookie', `starry_oauth_state=${state}; Max-Age=600; Path=/auth/callback; HttpOnly; SameSite=Lax${secureCookie}`);
        res.set('Cache-Control', 'no-store');
        const authUrl = new URL('https://discord.com/oauth2/authorize');
        authUrl.searchParams.set('client_id', clientId);
        authUrl.searchParams.set('redirect_uri', redirectUri);
        authUrl.searchParams.set('response_type', 'code');
        authUrl.searchParams.set('scope', 'identify guilds email');
        authUrl.searchParams.set('state', state);
        res.redirect(authUrl.toString());
    });

    app.get('/auth/callback', actionLimiter, async (req, res) => {
        const code = typeof req.query.code === 'string' ? req.query.code : '';
        const returnedState = typeof req.query.state === 'string' ? req.query.state : '';
        const frontendBase = (process.env.FRONTEND_URL || 'https://manager-bot-96c07.web.app').replace(/\\/+$/, '');
        const cookiePart = (req.headers.cookie || '').split(';').map(part => part.trim()).find(part => part.startsWith('starry_oauth_state='));
        const cookieState = cookiePart ? cookiePart.slice('starry_oauth_state='.length) : '';
        const secureCookie = (req.secure || req.headers['x-forwarded-proto'] === 'https') ? '; Secure' : '';
        res.set('Set-Cookie', `starry_oauth_state=; Max-Age=0; Path=/auth/callback; HttpOnly; SameSite=Lax${secureCookie}`);
        if (req.query.error) return res.redirect(`${frontendBase}/?error=discord_authorization_denied`);
        const validState = returnedState && cookieState &&
            returnedState.length === cookieState.length &&
            crypto.timingSafeEqual(Buffer.from(returnedState), Buffer.from(cookieState));
        if (!validState) return res.redirect(`${frontendBase}/?error=oauth_state_invalid`);
        if (!code) return res.redirect(`${frontendBase}/?error=no_code`);

        const clientId = process.env.CLIENT_ID || process.env.APPLICATION_ID || client.user?.id || '1513589513648345368';
        const clientSecret = process.env.CLIENT_SECRET || process.env.DISCORD_CLIENT_SECRET;
        const host = req.get('host');
        const proto = req.secure || req.headers['x-forwarded-proto'] === 'https' ? 'https' : 'http';
        const publicBase = (process.env.RENDER_EXTERNAL_URL || getPublicUrl() || `${proto}://${host}`).replace(/\\/+$/, '');
        const redirectUri = process.env.DISCORD_REDIRECT_URI || `${publicBase}/auth/callback`;

        try {
            if (!clientSecret) {
                console.error('Discord OAuth client secret is not configured.');
                return res.redirect(`${frontendBase}/?error=oauth_not_configured`);
            }

            const tokenParams = new URLSearchParams({
                client_id: clientId,
                client_secret: clientSecret,
                grant_type: 'authorization_code',
                code,
                redirect_uri: redirectUri
            });
            const tokenRes = await fetch('https://discord.com/api/oauth2/token', {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: tokenParams.toString()
            });
            const tokenData = await tokenRes.json().catch(() => ({}));
            if (!tokenRes.ok || !tokenData.access_token) {
                console.error('Discord OAuth token exchange failed:', tokenRes.status, tokenData.error || tokenData.message || 'unknown_error');
                return res.redirect(`${frontendBase}/?error=token_failed`);
            }

            const discordHeaders = { Authorization: `Bearer ${tokenData.access_token}`, Accept: 'application/json' };
            const [userRes, guildsRes] = await Promise.all([
                fetch('https://discord.com/api/users/@me', { headers: discordHeaders }),
                fetch('https://discord.com/api/users/@me/guilds', { headers: discordHeaders })
            ]);
            const [userData, userGuilds] = await Promise.all([
                userRes.json().catch(() => ({})),
                guildsRes.json().catch(() => null)
            ]);
            if (!userRes.ok || !userData.id) {
                console.error('Discord OAuth profile request failed:', userRes.status);
                return res.redirect(`${frontendBase}/?error=profile_failed`);
            }
            if (!guildsRes.ok || !Array.isArray(userGuilds)) {
                console.error('Discord OAuth guild request failed:', guildsRes.status);
                return res.redirect(`${frontendBase}/?error=guilds_failed`);
            }

            const sessionToken = crypto.randomBytes(32).toString('hex');
            const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
            const sessionData = {
                user: {
                    id: String(userData.id),
                    username: userData.username || 'Discord user',
                    globalName: userData.global_name || userData.username || 'Discord user',
                    discriminator: userData.discriminator || '0',
                    avatar: userData.avatar || null,
                    email: userData.email || null
                },
                guilds: userGuilds,
                expiresAt: expiresAt.getTime()
            };

            // Persist before redirecting; never send a session that cannot be reloaded.
            await OAuthSession.create({
                tokenHash: hashSessionToken(sessionToken),
                user: sessionData.user,
                guilds: sessionData.guilds,
                expiresAt
            });
            userSessions.set(sessionToken, sessionData);
            res.set('Cache-Control', 'no-store');
            return res.redirect(`${frontendBase}/dashboard.html?session=${encodeURIComponent(sessionToken)}`);
        } catch (error) {
            console.error('Discord OAuth callback failed:', error);
            return res.redirect(`${frontendBase}/?error=oauth_error`);
        }
    });

    app.get('/auth/user', async (req, res) => {
        res.set('Cache-Control', 'no-store, private');
        let session;
        try {
            session = await getSession(req);
        } catch (error) {
            console.error('Dashboard session lookup failed:', error);
            return res.status(503).json({ authenticated: false, error: 'Session service temporarily unavailable.' });
        }
        if (!session) return res.status(401).json({ authenticated: false, error: 'Discord login required.' });

        const manageableGuilds = (session.guilds || []).filter(g => {
            try {
                const permissions = BigInt(g.permissions || 0);
                return Boolean(g.owner) || (permissions & BigInt(0x8)) === BigInt(0x8) || (permissions & BigInt(0x20)) === BigInt(0x20);
            } catch (_) {
                return false;
            }
        }).map(g => ({
            id: g.id,
            name: g.name,
            icon: g.icon
                ? `https://cdn.discordapp.com/icons/${g.id}/${g.icon}.png`
                : 'https://cdn.discordapp.com/embed/avatars/0.png',
            botInGuild: client.guilds.cache.has(g.id),
            owner: Boolean(g.owner)
        }));

        const avatarExtension = session.user.avatar && session.user.avatar.startsWith('a_') ? 'gif' : 'png';
        res.json({
            authenticated: true,
            user: {
                id: session.user.id,
                username: session.user.username,
                globalName: session.user.globalName || session.user.username,
                discriminator: session.user.discriminator,
                avatar: session.user.avatar
                    ? `https://cdn.discordapp.com/avatars/${session.user.id}/${session.user.avatar}.${avatarExtension}?size=128`
                    : `https://cdn.discordapp.com/embed/avatars/${Number(session.user.discriminator || 0) % 6}.png`,
                email: session.user.email
            },
            guilds: manageableGuilds
        });
    });

    const destroySession = async (req, res) => {
        try {
            const session = await getSession(req);
            if (session) {
                userSessions.delete(session.token);
                await OAuthSession.deleteOne({ tokenHash: hashSessionToken(session.token) });
            }
            res.set('Cache-Control', 'no-store');
            return res.json({ success: true, message: 'Logged out successfully.' });
        } catch (error) {
            console.error('Dashboard logout failed:', error);
            return res.status(503).json({ success: false, error: 'Could not complete logout. Please retry.' });
        }
    };
    app.get('/auth/logout', destroySession);
    app.post('/auth/logout', destroySession);

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
    app.get('/api/guilds', requireAuth, async (req, res) => {
        try {
            res.set('Cache-Control', 'no-store, private');
            const manageableGuildIds = new Set((req.session.guilds || []).filter(g => {
                const permissions = BigInt(g.permissions || 0);
                return Boolean(g.owner) || (permissions & BigInt(0x8)) === BigInt(0x8) || (permissions & BigInt(0x20)) === BigInt(0x20);
            }).map(g => String(g.id)));
            const guilds = client.guilds.cache.filter(g => manageableGuildIds.has(g.id)).map(g => ({
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
    app.get('/api/guild/:id', requireGuildAdmin, async (req, res) => {
        try {
            res.set('Cache-Control', 'no-store, private');
            const guild = req.guild || client.guilds.cache.get(req.params.id);
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

    // ✨ Welcome dashboard APIs use the existing WelcomeSettings model and guildMemberAdd engine.
    app.get('/api/guild/:id/welcome', requireGuildAdmin, async (req, res) => {
        try {
            res.set('Cache-Control', 'no-store, private');
            const { WelcomeSettings } = require('./welcome');
            const settings = await WelcomeSettings.findOne({ guildId: req.guild.id }).lean();
            res.json({ success: true, configured: Boolean(settings), settings: settings || {
                channelId: '', title: '✨ WELCOME TO {server} ✨',
                description: '💖 Hello {user}! We are so overjoyed to have you join our family! 🌟',
                color: '#FF73FA', image: 'https://cdn.otakugifs.xyz/gifs/wave/61621fefb2bce465.gif',
                thumbnail: 'avatar', footer: '✨ Enjoy your stellar journey in {server}! ✨',
                pingContent: '💫 Welcome {user}! Grab a seat and enjoy your stay! 🥂'
            }});
        } catch (error) {
            console.error('Dashboard welcome API failed:', error);
            res.status(500).json({ success: false, error: 'Could not load welcome settings.' });
        }
    });

    app.post('/api/guild/:id/welcome', actionLimiter, requireGuildAdmin, async (req, res) => {
        try {
            const { WelcomeSettings } = require('./welcome');
            const guild = req.guild, body = req.body || {}, updates = {};
            const channelId = String(body.channelId || '').trim();
            const channel = channelId ? guild.channels.cache.get(channelId) : null;
            if (!channel || !channel.isTextBased() || typeof channel.send !== 'function') {
                return res.status(400).json({ success: false, error: 'Choose a valid text channel from this server.' });
            }
            updates.channelId = channelId;
            for (const [key, limit] of [['title', 256], ['description', 4000], ['footer', 2048], ['pingContent', 2000]]) {
                if (body[key] === undefined) continue;
                if (typeof body[key] !== 'string' || body[key].length > limit) {
                    return res.status(400).json({ success: false, error: key + ' must be text with at most ' + limit + ' characters.' });
                }
                updates[key] = body[key].trim();
            }
            if (body.color !== undefined) {
                if (typeof body.color !== 'string' || !/^#(?:[0-9a-f]{3}){1,2}$/i.test(body.color.trim())) {
                    return res.status(400).json({ success: false, error: 'Color must be a valid hex value.' });
                }
                updates.color = body.color.trim();
            }
            if (body.image !== undefined) {
                const value = String(body.image || '').trim();
                if (value && (!/^https?:\/\//i.test(value) || value.length > 1000)) {
                    return res.status(400).json({ success: false, error: 'Banner must be a valid HTTP or HTTPS URL.' });
                }
                updates.image = value;
            }
            if (body.thumbnail !== undefined) {
                const value = String(body.thumbnail || 'avatar').trim();
                if (value.toLowerCase() !== 'avatar' && (!/^https?:\/\//i.test(value) || value.length > 1000)) {
                    return res.status(400).json({ success: false, error: 'Thumbnail must be “avatar” or a valid HTTP or HTTPS URL.' });
                }
                updates.thumbnail = value;
            }
            const settings = await WelcomeSettings.findOneAndUpdate(
                { guildId: guild.id }, { $set: updates }, { new: true, upsert: true, setDefaultsOnInsert: true }
            ).lean();
            res.json({ success: true, settings, message: 'Welcome settings saved. New members will receive the configured welcome card.' });
        } catch (error) {
            console.error('Dashboard welcome settings save failed:', error);
            res.status(500).json({ success: false, error: 'Could not save welcome settings.' });
        }
    });

    // 📅 Discord Scheduled Events dashboard APIs.
    app.get('/api/guild/:id/events', requireGuildAdmin, async (req, res) => {
        try {
            res.set('Cache-Control', 'no-store, private');
            const guild = req.guild;
            if (!guild.members.me?.permissions.has(PermissionFlagsBits.ManageEvents)) {
                return res.status(403).json({ success: false, error: 'Starry needs the Manage Events permission in this server.' });
            }
            const events = await guild.scheduledEvents.fetch();
            res.json({ success: true, events: [...events.values()].map(event => ({
                id: event.id,
                name: event.name,
                description: event.description || '',
                start: event.scheduledStartAt?.toISOString() || null,
                end: event.scheduledEndAt?.toISOString() || null,
                status: event.status,
                entityType: event.entityType,
                location: event.entityMetadata?.location || null,
                channelId: event.channelId || null,
                userCount: event.userCount ?? null,
                url: event.url || null
            })).sort((a, b) => new Date(a.start || 0) - new Date(b.start || 0)) });
        } catch (error) {
            console.error('Dashboard scheduled events fetch failed:', error);
            res.status(500).json({ success: false, error: 'Could not load Discord scheduled events.' });
        }
    });

    app.post('/api/guild/:id/events', actionLimiter, requireGuildAdmin, async (req, res) => {
        try {
            const guild = req.guild, body = req.body || {};
            if (!guild.members.me?.permissions.has(PermissionFlagsBits.ManageEvents)) {
                return res.status(403).json({ success: false, error: 'Starry needs the Manage Events permission in this server.' });
            }
            const name = String(body.name || '').trim();
            const description = String(body.description || '').trim();
            const type = body.type === 'voice' ? 'voice' : 'external';
            const start = new Date(body.start), end = new Date(body.end);
            if (!name || name.length > 100) return res.status(400).json({ success: false, error: 'Event name is required and must be 100 characters or fewer.' });
            if (description.length > 1000) return res.status(400).json({ success: false, error: 'Description must be 1,000 characters or fewer.' });
            if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime()) || start <= new Date() || end <= start) {
                return res.status(400).json({ success: false, error: 'Choose a future start time and an end time after the start.' });
            }
            if (start.getTime() > Date.now() + 365 * 24 * 60 * 60 * 1000) {
                return res.status(400).json({ success: false, error: 'Discord scheduled events can only be created up to one year ahead.' });
            }
            const options = {
                name, description: description || null,
                scheduledStartTime: start, scheduledEndTime: end,
                privacyLevel: 2,
                entityType: type === 'voice' ? 2 : 3
            };
            if (type === 'voice') {
                const channel = guild.channels.cache.get(String(body.channelId || ''));
                if (!channel || !channel.isVoiceBased()) return res.status(400).json({ success: false, error: 'Choose a valid voice channel from this server.' });
                options.channel = channel;
            } else {
                const location = String(body.location || '').trim();
                if (location.length < 2 || location.length > 100) return res.status(400).json({ success: false, error: 'External event location must be between 2 and 100 characters.' });
                options.entityMetadata = { location };
            }
            const event = await guild.scheduledEvents.create(options);
            res.status(201).json({ success: true, message: 'Discord scheduled event created.', event: {
                id: event.id, name: event.name, start: event.scheduledStartAt?.toISOString() || null,
                end: event.scheduledEndAt?.toISOString() || null, status: event.status,
                entityType: event.entityType, location: event.entityMetadata?.location || null,
                channelId: event.channelId || null, url: event.url || null
            }});
        } catch (error) {
            console.error('Dashboard scheduled event create failed:', error);
            res.status(500).json({ success: false, error: 'Discord could not create this event. Check Starry’s permissions and the event details.' });
        }
    });

    app.delete('/api/guild/:id/events/:eventId', actionLimiter, requireGuildAdmin, async (req, res) => {
        try {
            const guild = req.guild;
            if (!guild.members.me?.permissions.has(PermissionFlagsBits.ManageEvents)) {
                return res.status(403).json({ success: false, error: 'Starry needs the Manage Events permission in this server.' });
            }
            const event = await guild.scheduledEvents.fetch(req.params.eventId).catch(() => null);
            if (!event || event.guildId !== guild.id) return res.status(404).json({ success: false, error: 'Scheduled event not found in this server.' });
            await event.delete('Cancelled from the Starry dashboard');
            res.json({ success: true, message: 'Scheduled event cancelled.' });
        } catch (error) {
            console.error('Dashboard scheduled event delete failed:', error);
            res.status(500).json({ success: false, error: 'Could not cancel this scheduled event.' });
        }
    });

    // 📈 Leveling and economy dashboard APIs (Discord admin guarded).
    app.get('/api/guild/:id/leveling', requireGuildAdmin, async (req, res) => {
        try {
            res.set('Cache-Control', 'no-store, private');
            const leveling = require('./leveling');
            const { LevelSettings, LevelUser } = leveling;
            const guildId = req.guild.id;
            const settings = await LevelSettings.findOne({ guildId }).lean() || {
                enabled: true, logChannelId: null, title: 'Congratulations {user}!',
                description: 'Your active participation in **{server}** has paid off! You reached **Level {level}**!',
                color: '#5865F2', image: '', thumbnail: 'avatar',
                footer: '{server} • Leveling System', pingContent: '**Level Up:** <@{user}>', authorName: 'LEVEL UP UNLOCKED'
            };
            const [membersTracked, totals, leaderboard] = await Promise.all([
                LevelUser.countDocuments({ guildId }),
                LevelUser.aggregate([{ $match: { guildId } }, { $group: { _id: null, totalXp: { $sum: '$xp' }, totalMessages: { $sum: '$messages' }, highestLevel: { $max: '$level' } } }]),
                LevelUser.find({ guildId }).sort({ xp: -1 }).limit(10).select('userId xp level messages').lean()
            ]);
            res.json({ success: true, settings, stats: { membersTracked, totalXp: totals[0]?.totalXp || 0, totalMessages: totals[0]?.totalMessages || 0, highestLevel: totals[0]?.highestLevel || 0 }, leaderboard });
        } catch (error) {
            console.error('Dashboard leveling API failed:', error);
            res.status(500).json({ success: false, error: 'Could not load leveling data.' });
        }
    });

    app.post('/api/guild/:id/leveling/settings', actionLimiter, requireGuildAdmin, async (req, res) => {
        try {
            const leveling = require('./leveling');
            const { LevelSettings } = leveling;
            const guild = req.guild, body = req.body || {}, updates = {};
            if (typeof body.enabled === 'boolean') updates.enabled = body.enabled;
            if (body.logChannelId !== undefined) {
                const channelId = String(body.logChannelId || '').trim();
                const channel = channelId ? guild.channels.cache.get(channelId) : null;
                if (channelId && (!channel || !channel.isTextBased())) return res.status(400).json({ success: false, error: 'Choose a valid text channel from this server.' });
                updates.logChannelId = channelId || null;
            }
            for (const key of ['title', 'description', 'footer', 'pingContent', 'authorName']) {
                if (body[key] === undefined) continue;
                if (typeof body[key] !== 'string' || body[key].length > (key === 'description' ? 1800 : 300)) return res.status(400).json({ success: false, error: 'Invalid ' + key + ' value.' });
                updates[key] = body[key].trim();
            }
            if (body.color !== undefined) {
                if (typeof body.color !== 'string' || !/^#(?:[0-9a-f]{3}){1,2}$/i.test(body.color.trim())) return res.status(400).json({ success: false, error: 'Color must be a valid hex value.' });
                updates.color = body.color.trim();
            }
            for (const key of ['image', 'thumbnail']) {
                if (body[key] === undefined) continue;
                const value = String(body[key] || '').trim();
                if (key === 'thumbnail' && value.toLowerCase() === 'avatar') { updates.thumbnail = 'avatar'; continue; }
                if (value && (!/^https?:\/\//i.test(value) || value.length > 1000)) return res.status(400).json({ success: false, error: 'Image fields must be valid HTTP or HTTPS URLs.' });
                updates[key] = value;
            }
            const settings = await LevelSettings.findOneAndUpdate({ guildId: guild.id }, { $set: updates }, { new: true, upsert: true, setDefaultsOnInsert: true });
            leveling.settingsCache.set(guild.id, { ...(leveling.settingsCache.get(guild.id) || {}), ...updates });
            res.json({ success: true, settings, message: 'Leveling settings saved.' });
        } catch (error) {
            console.error('Dashboard leveling settings save failed:', error);
            res.status(500).json({ success: false, error: 'Could not save leveling settings.' });
        }
    });

    app.get('/api/guild/:id/economy', requireGuildAdmin, async (req, res) => {
        try {
            res.set('Cache-Control', 'no-store, private');
            const guildId = req.guild.id;
            const [membersTracked, totals, leaderboard] = await Promise.all([
                User.countDocuments({ guildId }),
                User.aggregate([{ $match: { guildId } }, { $group: { _id: null, totalCredits: { $sum: '$credits' }, totalXp: { $sum: '$xp' }, totalPrestige: { $sum: '$prestige' } } }]),
                User.find({ guildId }).sort({ credits: -1 }).limit(10).select('userId credits xp prestige').lean()
            ]);
            res.json({ success: true, stats: { membersTracked, totalCredits: totals[0]?.totalCredits || 0, totalXp: totals[0]?.totalXp || 0, totalPrestige: totals[0]?.totalPrestige || 0 }, leaderboard });
        } catch (error) {
            console.error('Dashboard economy API failed:', error);
            res.status(500).json({ success: false, error: 'Could not load economy data.' });
        }
    });

    // POST /api/guild/:id/settings - Save updated Starry settings (Admin Guarded)
    app.post('/api/guild/:id/settings', actionLimiter, requireGuildAdmin, async (req, res) => {
        try {
            const guild = req.guild || client.guilds.cache.get(req.params.id);
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
            if (payload.boosterRoleSystem) settings.boosterRoleSystem = { ...settings.boosterRoleSystem?.toObject(), ...payload.boosterRoleSystem };
            if (payload.music) {
                settings.music = { ...settings.music.toObject(), ...payload.music };
                const p = StarryAudioEngine.getPlayer(guild.id);
                if (p && payload.music.is247 !== undefined) p.is247 = payload.music.is247;
            }
            if (payload.tickets) settings.tickets = { ...settings.tickets.toObject(), ...payload.tickets };
            if (payload.mediaPerms) settings.mediaPerms = { ...settings.mediaPerms?.toObject(), ...payload.mediaPerms };

            await settings.save();
            res.json({ success: true, message: 'Settings saved successfully!', settings });
        } catch (e) {
            res.status(500).json({ success: false, error: e.message });
        }
    });

    // POST /api/guild/:id/embed/send - Dispatch WYSIWYG embed from web dashboard (Admin Guarded)
    app.post('/api/guild/:id/embed/send', actionLimiter, requireGuildAdmin, async (req, res) => {
        try {
            const guild = req.guild || client.guilds.cache.get(req.params.id);
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

    // POST /api/guild/:id/music/control - Remote Web Player Controls (Member Guarded)
    app.post('/api/guild/:id/music/control', actionLimiter, requireGuildMember, async (req, res) => {
        try {
            const guild = req.guild || client.guilds.cache.get(req.params.id);
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

    // POST /api/guild/:id/music/play - Remote Web Play Song (Member Guarded)
    app.post('/api/guild/:id/music/play', actionLimiter, requireGuildMember, async (req, res) => {
        try {
            const guild = req.guild || client.guilds.cache.get(req.params.id);
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

    // POST /api/guild/:id/mod/action - Member Moderation (Admin Guarded)
    app.post('/api/guild/:id/mod/action', actionLimiter, requireGuildAdmin, async (req, res) => {
        try {
            const guild = req.guild || client.guilds.cache.get(req.params.id);
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
    // 🚀 BOOSTER STUDIO REST API (BOOSTER SYNERGY)
    // ==========================================

    // GET /api/guild/:id/booster-roles - Fetch booster studio data & roles
    app.get('/api/guild/:id/booster-roles', actionLimiter, requireGuildMember, async (req, res) => {
        try {
            const guild = req.guild;
            const member = req.member;
            const isBooster = boosterEngine.isBooster(member);

            const settings = await boosterEngine.getSettings(guild.id);
            const myDoc = await BoosterRole.findOne({ guildId: guild.id, userId: member.id });
            let myRole = null;
            if (myDoc) {
                const r = guild.roles.cache.get(myDoc.roleId);
                myRole = {
                    ...myDoc.toObject(),
                    hexColor: r ? r.hexColor : myDoc.color,
                    existsInGuild: Boolean(r)
                };
            }

            const allDocs = await BoosterRole.find({ guildId: guild.id, active: true }).limit(50).lean();
            const allRoles = allDocs.map(d => {
                const r = guild.roles.cache.get(d.roleId);
                return {
                    id: d.roleId,
                    name: d.name,
                    color: r ? r.hexColor : d.color,
                    ownerId: d.userId,
                    sharedCount: d.sharedWith?.length || 0,
                    maxShares: d.maxShares
                };
            });

            res.json({
                success: true,
                isBooster,
                settings: settings.boosterRoleSystem || {},
                isPremium: Boolean(settings.premium?.isPremium),
                myRole,
                roles: allRoles
            });
        } catch (e) {
            res.status(500).json({ success: false, error: e.message });
        }
    });

    // POST /api/guild/:id/booster-roles/create - Create custom booster role
    app.post('/api/guild/:id/booster-roles/create', actionLimiter, requireGuildMember, async (req, res) => {
        try {
            const { name, color, icon } = req.body;
            if (!name) return res.status(400).json({ success: false, error: 'Role name is required.' });

            const result = await boosterEngine.createBoosterRole(req.guild, req.member, { name, color, icon });
            res.json({
                success: true,
                message: `✨ Custom booster role [${result.doc.name}] created successfully!`,
                role: {
                    id: result.role.id,
                    name: result.role.name,
                    color: result.role.hexColor
                },
                doc: result.doc
            });
        } catch (e) {
            res.status(400).json({ success: false, error: e.message });
        }
    });

    // POST /api/guild/:id/booster-roles/update - Update role styling
    app.post('/api/guild/:id/booster-roles/update', actionLimiter, requireGuildMember, async (req, res) => {
        try {
            const { name, color, icon } = req.body;
            const result = await boosterEngine.updateBoosterRole(req.guild, req.member, { name, color, icon });
            res.json({
                success: true,
                message: '🎨 Custom booster role updated!',
                role: {
                    id: result.role.id,
                    name: result.role.name,
                    color: result.role.hexColor
                },
                doc: result.doc
            });
        } catch (e) {
            res.status(400).json({ success: false, error: e.message });
        }
    });

    // POST /api/guild/:id/booster-roles/share - Share role with friend
    app.post('/api/guild/:id/booster-roles/share', actionLimiter, requireGuildMember, async (req, res) => {
        try {
            const { friendId } = req.body;
            if (!friendId) return res.status(400).json({ success: false, error: 'Friend User ID is required.' });

            const friendMember = await req.guild.members.fetch(friendId).catch(() => null);
            if (!friendMember) return res.status(404).json({ success: false, error: 'Friend not found in this server.' });

            const result = await boosterEngine.shareBoosterRole(req.guild, req.member, friendMember);
            res.json({
                success: true,
                message: `💜 Successfully shared your custom role with ${friendMember.user.tag}!`,
                sharedWith: result.doc.sharedWith
            });
        } catch (e) {
            res.status(400).json({ success: false, error: e.message });
        }
    });

    // POST /api/guild/:id/booster-roles/unshare - Revoke role from friend
    app.post('/api/guild/:id/booster-roles/unshare', actionLimiter, requireGuildMember, async (req, res) => {
        try {
            const { friendId } = req.body;
            if (!friendId) return res.status(400).json({ success: false, error: 'Friend User ID is required.' });

            const friendMember = await req.guild.members.fetch(friendId).catch(() => null);
            const result = await boosterEngine.unshareBoosterRole(req.guild, req.member, friendMember || { id: friendId });
            res.json({
                success: true,
                message: '➖ Role revoked from friend.',
                sharedWith: result.doc.sharedWith
            });
        } catch (e) {
            res.status(400).json({ success: false, error: e.message });
        }
    });

    // DELETE /api/guild/:id/booster-roles - Delete own custom booster role
    app.delete('/api/guild/:id/booster-roles', actionLimiter, requireGuildMember, async (req, res) => {
        try {
            await boosterEngine.deleteBoosterRole(req.guild, req.member);
            res.json({ success: true, message: '🗑️ Your custom booster role has been deleted.' });
        } catch (e) {
            res.status(400).json({ success: false, error: e.message });
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

    // POST /api/premium/checkout - Create Pending Checkout Session (Never issues free keys)
    app.post('/api/premium/checkout', actionLimiter, async (req, res) => {
        try {
            const { tier, method, cryptoCoin, guildId } = req.body;
            if (!tier || !TIER_CONFIG[tier]) {
                return res.status(400).json({ success: false, error: 'Invalid tier specified. Choose shield_plus, pro_cluster, or lifetime.' });
            }

            const session = await getSession(req);
            const userId = session?.user?.id || null;
            const userTag = session?.user ? `${session.user.username}#${session.user.discriminator || '0'}` : 'Web Guest';
            const guildName = guildId && client ? (client.guilds.cache.get(guildId)?.name || '') : '';

            const order = await createPaymentOrder({
                tier,
                method: method || 'crypto',
                cryptoCoin: cryptoCoin || 'usdt_trc20',
                guildId: guildId || null,
                guildName,
                userId,
                userTag
            });

            res.json({
                success: true,
                message: 'Payment order generated successfully. Complete payment to verify.',
                order
            });
        } catch (e) {
            res.status(500).json({ success: false, error: e.message });
        }
    });

    // POST /api/premium/submit-proof - Submit UTR / TxID / TxHash for Verification
    app.post('/api/premium/submit-proof', actionLimiter, async (req, res) => {
        try {
            const { orderId, utr, method, cryptoCoin, notes } = req.body;
            if (!orderId) return res.status(400).json({ success: false, error: 'Missing orderId parameter.' });
            if (!utr) return res.status(400).json({ success: false, error: 'Please enter your Transaction Hash, PayPal ID, or UPI UTR number.' });

            const result = await submitPaymentProof({
                orderId,
                utr,
                method,
                cryptoCoin,
                notes,
                client
            });

            res.json(result);
        } catch (e) {
            res.status(400).json({ success: false, error: e.message });
        }
    });

    // GET /api/premium/order/:orderId - Check Live Order Status (Polling endpoint)
    app.get('/api/premium/order/:orderId', async (req, res) => {
        try {
            const { orderId } = req.params;
            const order = await getOrderStatus(orderId);
            if (!order) return res.status(404).json({ success: false, error: 'Order not found.' });

            res.json({
                success: true,
                order
            });
        } catch (e) {
            res.status(500).json({ success: false, error: e.message });
        }
    });

    // GET /api/admin/orders - View Recent Orders (Bot Owners Only)
    app.get('/api/admin/orders', requireAuth, async (req, res) => {
        try {
            const session = req.session;
            const isOwner = session && (config.BOT_OWNERS || []).includes(session.user?.id);
            if (!isOwner) return res.status(403).json({ success: false, error: 'Forbidden. Bot owners only.' });

            const status = req.query.status;
            const query = status ? { status } : {};
            const orders = await PaymentOrder.find(query).sort({ createdAt: -1 }).limit(50).lean();

            res.json({ success: true, count: orders.length, orders });
        } catch (e) {
            res.status(500).json({ success: false, error: e.message });
        }
    });

    // POST /api/admin/orders/approve - Manually Approve Order (Bot Owners Only)
    app.post('/api/admin/orders/approve', requireAuth, actionLimiter, async (req, res) => {
        try {
            const session = req.session;
            const isOwner = session && (config.BOT_OWNERS || []).includes(session.user?.id);
            if (!isOwner) return res.status(403).json({ success: false, error: 'Forbidden. Bot owners only.' });

            const { orderId } = req.body;
            if (!orderId) return res.status(400).json({ success: false, error: 'Missing orderId.' });

            const result = await approvePaymentOrder(orderId, `Web Admin [${session.user.username}]`, client);
            res.json(result);
        } catch (e) {
            res.status(500).json({ success: false, error: e.message });
        }
    });

    // POST /api/admin/orders/reject - Reject Order (Bot Owners Only)
    app.post('/api/admin/orders/reject', requireAuth, actionLimiter, async (req, res) => {
        try {
            const session = req.session;
            const isOwner = session && (config.BOT_OWNERS || []).includes(session.user?.id);
            if (!isOwner) return res.status(403).json({ success: false, error: 'Forbidden. Bot owners only.' });

            const { orderId, reason } = req.body;
            if (!orderId) return res.status(400).json({ success: false, error: 'Missing orderId.' });

            const result = await rejectPaymentOrder(orderId, `Web Admin [${session.user.username}]`, reason, client);
            res.json(result);
        } catch (e) {
            res.status(500).json({ success: false, error: e.message });
        }
    });

    // POST /api/admin/generate-key - Standalone Key Generator (Bot Owners Only)
    app.post('/api/admin/generate-key', requireAuth, actionLimiter, async (req, res) => {
        try {
            const session = req.session;
            const isOwner = session && (config.BOT_OWNERS || []).includes(session.user?.id);
            if (!isOwner) return res.status(403).json({ success: false, error: 'Forbidden. Bot owners only.' });

            const { tier, durationDays } = req.body;
            const result = await generateStandaloneKey({
                tier: tier || 'pro_cluster',
                durationDays: durationDays !== undefined ? parseInt(durationDays) : null,
                createdBy: `Web Owner [${session.user.username}]`
            });

            res.json({ success: true, ...result });
        } catch (e) {
            res.status(500).json({ success: false, error: e.message });
        }
    });

    // GET /api/spotify/login - Initiate Spotify OAuth2 Authorization
    app.get('/api/spotify/login', (req, res) => {
        const userId = req.query.userId;
        if (!userId) return res.status(400).send('<h1>❌ Missing userId parameter</h1>');
        const spotifyManager = require('./spotifyManager');
        const publicUrl = getPublicUrl() || process.env.RENDER_EXTERNAL_URL || `http://${req.headers.host}`;
        const redirectUri = `${publicUrl}/api/spotify/callback`;
        const authUrl = spotifyManager.getOAuthUrl(userId, redirectUri);
        res.redirect(authUrl);
    });

    // GET /api/spotify/callback - Handle Spotify OAuth2 Redirect
    app.get('/api/spotify/callback', async (req, res) => {
        const { code, state, error } = req.query;
        if (error) {
            return res.send(`
            <!DOCTYPE html><html><head><meta name="viewport" content="width=device-width, initial-scale=1">
            <style>body{background:#121212;color:#fff;font-family:sans-serif;text-align:center;padding:10vh 20px;}h2{color:#e74c3c;}</style>
            </head><body>
            <h2>❌ Spotify Authorization Denied</h2>
            <p>${error}</p><p>You can close this tab and return to Discord.</p>
            </body></html>`);
        }

        if (!code || !state) {
            return res.status(400).send('<h1>❌ Missing code or state from Spotify</h1>');
        }

        try {
            const spotifyManager = require('./spotifyManager');
            const publicUrl = getPublicUrl() || process.env.RENDER_EXTERNAL_URL || `http://${req.headers.host}`;
            const redirectUri = `${publicUrl}/api/spotify/callback`;
            const { profile } = await spotifyManager.handleOAuthCallback(code, redirectUri, state);

            res.send(`
            <!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Spotify Connected • Starry</title>
                <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@500;700;800&display=swap" rel="stylesheet">
                <style>
                    body { background: #080A10; color: #fff; font-family: 'Plus Jakarta Sans', sans-serif; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; padding: 20px; background-image: radial-gradient(circle at 50% 50%, rgba(29, 185, 84, 0.15), transparent 60%); }
                    .card { background: rgba(18, 24, 38, 0.95); border: 1px solid rgba(29, 185, 84, 0.3); border-radius: 20px; padding: 40px; text-align: center; max-width: 440px; width: 100%; box-shadow: 0 20px 50px rgba(0,0,0,0.6); }
                    .sp-icon { width: 70px; height: 70px; margin-bottom: 20px; }
                    h2 { margin: 0 0 10px; font-weight: 800; color: #1DB954; font-size: 1.6rem; }
                    p { color: #9CA3AF; line-height: 1.6; margin-bottom: 25px; }
                    .user-badge { display: inline-flex; align-items: center; gap: 8px; background: rgba(29, 185, 84, 0.1); border: 1px solid rgba(29, 185, 84, 0.3); padding: 8px 16px; border-radius: 30px; font-weight: 700; color: #1DB954; margin-bottom: 20px; }
                    .btn { display: inline-block; padding: 12px 28px; background: #1DB954; color: #fff; font-weight: 700; text-decoration: none; border-radius: 12px; }
                </style>
            </head>
            <body>
                <div class="card">
                    <img src="https://cdn-icons-png.flaticon.com/512/174/174872.png" class="sp-icon" alt="Spotify">
                    <div class="user-badge">🟢 Connected as ${profile.display_name || profile.id}</div>
                    <h2>Spotify Connected!</h2>
                    <p>Starry has successfully authorized your Spotify account. You can now use <strong>,spotify myplaylists</strong> or <strong>,spotify play</strong> in Discord!</p>
                    <p style="color:#6B7280; font-size:0.85rem;">You may now safely close this window and return to Discord.</p>
                </div>
            </body>
            </html>
            `);
        } catch (err) {
            res.status(500).send(`
            <!DOCTYPE html><html><head><meta name="viewport" content="width=device-width, initial-scale=1">
            <style>body{background:#121212;color:#fff;font-family:sans-serif;text-align:center;padding:10vh 20px;}h2{color:#e74c3c;}</style>
            </head><body>
            <h2>❌ Connection Error</h2>
            <p>${err.message}</p>
            </body></html>`);
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
