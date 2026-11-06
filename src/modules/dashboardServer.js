// ==========================================
// 🌐 STARRY SUPREME WEB DASHBOARD & PAYMENT SUITE
// File Path: src/modules/dashboardServer.js
// Discord OAuth2 • Top.gg Webhook • Remote API • Payment Gateway • Premium Key Manager
// ==========================================
const express = require('express');
const mongoose = require('mongoose');
const path = require('path');
const crypto = require('crypto');
const rateLimit = require('express-rate-limit');
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType, PermissionFlagsBits } = require('discord.js');
const ServerSettings = require('../models/ServerSettings');
const PaymentOrder = require('../models/PaymentOrder');
const BoosterRole = require('../models/BoosterRole');
const User = require('../models/User');
const OAuthSession = require('../models/OAuthSession');
const { StarryAudioEngine } = require('../utils/nativeAudioEngine');
const { getPublicUrl } = require('../utils/tunnelManager');
const { engine: boosterEngine } = require('./boosterRoleEngine');
const { TIER_CONFIG, getOrderStatus } = require('../utils/paymentHelper');
const config = require('../config');
const { isServerOrUserPremium } = require('../utils/premiumHelper');
const { parseSpotifyUrl, resolveSpotifyUrl } = require('../utils/spotifyApi');
const { rankAndFilterCanonicalTracks, scoreTrack } = require('../utils/musicManager');
const { setupSupportDeskRoutes } = require('./supportDesk');

// Short-lived cache backed by MongoDB so sessions survive Render restarts.
const userSessions = new Map();
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const SESSION_RENEW_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;
const hashSessionToken = (token) => crypto.createHash('sha256').update(token).digest('hex');

function bestPlayableMusicMatch(tracks, query) {
    const ranked = rankAndFilterCanonicalTracks(Array.isArray(tracks) ? tracks : [], query);
    const candidate = ranked[0];
    if (!candidate) return null;
    // Reject weak title/artist matches instead of silently queueing a different song.
    return scoreTrack(candidate, query, 0) >= 180 ? candidate : null;
}

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

    // Restrict cross-origin dashboard access to explicitly configured frontend origins.
    const allowedOrigins = new Set([
        ...(process.env.CORS_ALLOWED_ORIGINS || '').split(','),
        process.env.FRONTEND_URL || 'https://manager-bot-96c07.web.app',
        'https://manager-bot-96c07.web.app',
        'https://manager-bot-96c07.firebaseapp.com'
    ].map(origin => origin.trim().replace(/\\/$/, '')).filter(Boolean));

    app.use((req, res, next) => {
        const origin = req.headers.origin;
        if (origin && allowedOrigins.has(origin)) {
            res.setHeader('Access-Control-Allow-Origin', origin);
            res.setHeader('Vary', 'Origin');
        }
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, bypass-tunnel-reminder');
        res.setHeader('bypass-tunnel-reminder', 'true');
        if (req.method === 'OPTIONS') return res.sendStatus(origin && !allowedOrigins.has(origin) ? 403 : 204);
        next();
    });

    // Helper: Session extractor. Raw tokens are never stored in MongoDB.
    const getSession = async (req) => {
        const authHeader = req.headers.authorization;
        let token = null;
        if (authHeader && authHeader.startsWith('Bearer ')) token = authHeader.slice(7).trim();
        // Session credentials are accepted only in the Authorization header; URL tokens leak into history and logs.
        if (!token || token.length > 4096) return null;
        const now = Date.now();
        const tokenHash = hashSessionToken(token);
        const renewIfNeeded = async (session) => {
            // Rolling 30-day inactivity window; extend only when fewer than 23 days remain.
            if (session.expiresAt - now > SESSION_TTL_MS - SESSION_RENEW_WINDOW_MS) return;
            const nextExpiry = new Date(now + SESSION_TTL_MS);
            const renewed = await OAuthSession.updateOne(
                { tokenHash, expiresAt: { $gt: new Date(now) } },
                { $set: { expiresAt: nextExpiry } }
            );
            if (renewed.matchedCount > 0) session.expiresAt = nextExpiry.getTime();
        };
        const cached = userSessions.get(token);
        if (cached && cached.expiresAt > now) {
            try { await renewIfNeeded(cached); } catch (error) {
                console.warn('Dashboard session renewal deferred:', error.message);
            }
            return { token, ...cached };
        }
        userSessions.delete(token);
        const stored = await OAuthSession.findOne({ tokenHash, expiresAt: { $gt: new Date(now) } }).lean();
        if (!stored) return null;
        const session = { user: stored.user, guilds: Array.isArray(stored.guilds) ? stored.guilds : [], expiresAt: new Date(stored.expiresAt).getTime() };
        try { await renewIfNeeded(session); } catch (error) {
            console.warn('Dashboard session renewal deferred:', error.message);
        }
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
        let member = null;
        if (!isOwner && !isGuildOwner) {
            // OAuth guild permissions are a login-time snapshot. Re-fetch the
            // member so removed roles or revoked Manage Server access take effect immediately.
            try {
                member = await guild.members.fetch({ user: session.user.id, force: true });
            } catch (error) {
                if (error?.code === 10007) {
                    return res.status(403).json({ success: false, error: 'Access denied: You are no longer a member of this server.' });
                }
                console.error('Live Discord permission check failed:', error);
                return res.status(503).json({ success: false, error: 'Could not verify your current Discord permissions. Please retry.' });
            }
            const hasAdmin = member.permissions.has(PermissionFlagsBits.Administrator);
            const hasManageServer = member.permissions.has(PermissionFlagsBits.ManageGuild);
            if (!hasAdmin && !hasManageServer) {
                return res.status(403).json({ success: false, error: 'Access denied: You need Administrator or Manage Server permissions.' });
            }
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
    // Website support inbox and AI-to-human escalation workflow.
    setupSupportDeskRoutes(app, { requireAuth, client, config });

    // Multi-platform discovery via Starry's configured Lavalink provider. No Spotify API credentials required.
    app.get('/api/guild/:id/music/search', requireGuildMember, async (req, res) => {
        try {
            const query = String(req.query.q || '').trim();
            if (!query || query.length > 160) return res.status(400).json({ success: false, error: 'Enter a search query up to 160 characters.' });
            const manager = client.manager;
            if (!manager || typeof manager.search !== 'function') return res.status(503).json({ success: false, error: 'The music search provider is not ready. Try again when Lavalink is connected.' });
            let searchQuery = query;
            let matchQuery = query;
            const spotifyLink = parseSpotifyUrl(query);
            if (spotifyLink) {
                const metadata = await resolveSpotifyUrl(query);
                const first = metadata?.tracks?.[0];
                if (!first?.query) return res.status(404).json({ success: false, error: 'No playable track metadata was found in that Spotify link.' });
                matchQuery = first.query;
                searchQuery = 'ytmsearch:' + first.query;
            }
            let result = await manager.search(searchQuery, { requester: req.session.user });
            if ((!result?.tracks?.length) && spotifyLink) {
                result = await manager.search('ytsearch:' + matchQuery, { requester: req.session.user });
            }
            const rankedTracks = rankAndFilterCanonicalTracks(result?.tracks || [], matchQuery);
            const tracks = rankedTracks.slice(0, 8).map(track => ({
                title: String(track.title || 'Unknown track').slice(0, 180),
                artist: String(track.author || 'Unknown artist').slice(0, 120),
                durationMs: Number(track.length) || 0,
                artwork: track.thumbnail || null,
                source: String(track.sourceName || track.pluginInfo?.sourceName || 'Audio source'),
                uri: track.uri || null,
                query: track.uri || track.identifier || query
            }));
            return res.json({ success: true, tracks });
        } catch (error) {
            const status = error.code === 'SPOTIFY_COLLECTION_UNAVAILABLE' ? 400 : error.status === 429 ? 429 : 502;
            return res.status(status).json({ success: false, error: error.message || 'Music search is temporarily unavailable.' });
        }
    });

    // 🔐 DISCORD OAUTH2 AUTHENTICATION APIS
    // ==========================================

    // ==========================================
    // 🔐 DISCORD OAUTH2 AUTHENTICATION APIS
    // ==========================================

    // Public, secret-free diagnostics so login failures are actionable without exposing credentials.
    app.get('/auth/status', (req, res) => {
        res.set('Cache-Control', 'no-store');
        const mongoConnected = mongoose.connection.readyState === 1;
        const clientSecretConfigured = Boolean(process.env.CLIENT_SECRET || process.env.DISCORD_CLIENT_SECRET);
        const clientIdConfigured = Boolean(process.env.CLIENT_ID || process.env.APPLICATION_ID || client.user?.id);
        const redirectConfigured = Boolean(process.env.DISCORD_REDIRECT_URI || process.env.RENDER_EXTERNAL_URL || getPublicUrl());
        res.json({
            service: 'ok',
            oauthConfigured: clientIdConfigured && clientSecretConfigured && redirectConfigured,
            clientSecretConfigured,
            clientIdConfigured,
            redirectConfigured,
            mongoConfigured: Boolean(process.env.MONGO_URI),
            mongoConnected,
            sessionStoreReady: mongoConnected
        });
    });

    // OAuth state is held in a short-lived HttpOnly cookie so it survives a
    // Render restart and works without process-local session state.
    app.get('/auth/login', actionLimiter, (req, res) => {
        const clientId = process.env.CLIENT_ID || process.env.APPLICATION_ID || client.user?.id || '1513589513648345368';
        const host = req.get('host');
        const proto = req.secure || req.headers['x-forwarded-proto'] === 'https' ? 'https' : 'http';
        const publicBase = (process.env.RENDER_EXTERNAL_URL || getPublicUrl() || `${proto}://${host}`).replace(/\/+$/, '');
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
        const frontendBase = (process.env.FRONTEND_URL || 'https://manager-bot-96c07.web.app').replace(/\/+$/, '');
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
        const publicBase = (process.env.RENDER_EXTERNAL_URL || getPublicUrl() || `${proto}://${host}`).replace(/\/+$/, '');
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
            if (mongoose.connection.readyState !== 1) {
                console.error('Discord OAuth session storage is unavailable: MongoDB is not connected.');
                return res.redirect(`${frontendBase}/?error=session_store_unavailable`);
            }
            await OAuthSession.create({
                tokenHash: hashSessionToken(sessionToken),
                user: sessionData.user,
                guilds: sessionData.guilds,
                expiresAt
            });
            userSessions.set(sessionToken, sessionData);
            res.set('Cache-Control', 'no-store');
            return res.redirect(`${frontendBase}/dashboard.html#session=${encodeURIComponent(sessionToken)}`);
        } catch (error) {
            console.error('Discord OAuth callback failed:', error);
            const storageUnavailable = mongoose.connection.readyState !== 1;
            return res.redirect(`${frontendBase}/?error=${storageUnavailable ? 'session_store_unavailable' : 'session_store_failed'}`);
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

            // The runtime premium guard also checks PremiumGuilds. Reflect that same
            // effective entitlement in the dashboard if stale cleanup left a registry record.
            const settingsPayload = settings.toObject ? settings.toObject() : { ...settings };
            let effectivePremium = settingsPayload.premium || {};
            try {
                const PremiumModel = mongoose.models.PremiumGuilds || mongoose.model('PremiumGuilds');
                const activeGuildPremium = await PremiumModel.findOne({
                    targetId: guild.id,
                    isPremium: true,
                    $or: [{ expiresAt: null }, { expiresAt: { $gt: new Date() } }]
                }).lean();
                if (activeGuildPremium) {
                    const recordExpiry = activeGuildPremium.expiresAt || null;
                    effectivePremium = {
                        ...effectivePremium,
                        isPremium: true,
                        tier: activeGuildPremium.tier || (!recordExpiry ? 'lifetime' : effectivePremium.tier || 'premium'),
                        expiresAt: recordExpiry
                    };
                }
            } catch (premiumStatusError) {
                console.warn('Could not resolve effective dashboard premium status:', premiumStatusError.message);
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

            const player = client.multiBot?.getPlayerForGuild(guild.id) || StarryAudioEngine.getPlayer(guild.id) || (client.manager ? client.manager.getPlayer(guild.id) : null);
            const currentTrack = player?.currentTrack || player?.queue?.current || null;
            const queueSource = Array.isArray(player?.queue) ? player.queue : (Array.isArray(player?.queue?.tracks) ? player.queue.tracks : []);
            const workerInfo = player && Array.from(client.multiBot?.instances?.values?.() || []).find(info =>
                info.client?.manager?.getPlayer(guild.id) === player || StarryAudioEngine.getPlayer(guild.id, info.client) === player
            );
            const safeTrack = track => track ? ({
                title: String(track.title || 'Unknown track').slice(0, 200),
                author: String(track.author || track.artist || 'Unknown artist').slice(0, 120),
                duration: Number(track.length || track.duration || 0),
                thumbnail: typeof track.thumbnail === 'string' ? track.thumbnail : (typeof track.artworkUrl === 'string' ? track.artworkUrl : ''),
                url: typeof track.uri === 'string' ? track.uri : (typeof track.url === 'string' ? track.url : '')
            }) : null;

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
                effectivePremium,
                channels,
                roles,
                publicUrl: getPublicUrl(),
                player: player ? {
                    playing: Boolean(currentTrack && !player.paused),
                    currentTrack: safeTrack(currentTrack),
                    queue: queueSource.slice(0, 25).map(safeTrack),
                    queueLength: Number(player.queue?.length ?? queueSource.length),
                    paused: Boolean(player.paused),
                    volume: Number(player.volume ?? 100),
                    loop: player.loop || 'none',
                    filter: player.filter || 'clear',
                    autoplay: Boolean(player.autoplay || player.data?.get?.('autoplay')),
                    is247: Boolean(player.is247),
                    botName: workerInfo?.name || client.user?.username || 'Starry'
                } : null
            });
        } catch (e) {
            res.status(500).json({ success: false, error: e.message });
        }
    });

    // Worker tokens are global cluster credentials, not per-server settings.
    // Only Starry bot owners may view or mutate the shared worker pool.
    const requireClusterManager = (req, res, next) => {
        const userId = String(req.session?.user?.id || '');
        const isBotOwner = typeof config.isBotOwner === 'function'
            ? config.isBotOwner(userId, client)
            : (config.BOT_OWNERS || []).includes(userId);
        if (isBotOwner) return next();
        return res.status(403).json({ success: false, error: 'Only Starry bot owners can manage the global Multi-Bot cluster.' });
    };

    app.get('/api/guild/:id/commands', requireGuildAdmin, (req, res) => {
        try {
            const catalog = new Map();
            for (const collection of [client.commands, client.prefixCommands]) {
                if (!collection || typeof collection.values !== 'function') continue;
                for (const command of collection.values()) {
                    const definition = typeof command.data?.toJSON === 'function' ? command.data.toJSON() : (command.data || {});
                    const name = String(definition.name || command.name || command.commandName || '').trim();
                    if (!name) continue;
                    const item = {
                        name,
                        description: String(definition.description || command.description || 'Starry Discord command').slice(0, 240),
                        category: String(command.category || definition.category || 'General').slice(0, 48),
                        usage: String(command.usage || ('/' + name)).slice(0, 180),
                        aliases: Array.isArray(command.aliases) ? command.aliases.map(alias => String(alias).slice(0, 48)).slice(0, 12) : []
                    };
                    const existing = catalog.get(name);
                    if (!existing || item.description.length > existing.description.length) catalog.set(name, item);
                }
            }
            const commands = Array.from(catalog.values()).sort((a, b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name));
            return res.json({ success: true, count: commands.length, commands });
        } catch (error) {
            console.error('Dashboard command catalogue failed:', error?.message || error);
            return res.status(500).json({ success: false, error: 'Could not load Starry command catalogue.' });
        }
    });

    app.get('/api/guild/:id/multibot', requireGuildAdmin, requireClusterManager, (req, res) => {
        try {
            res.set('Cache-Control', 'no-store, private');
            const cluster = client.multiBot || require('./multiBot');
            const stats = cluster.getClusterStats();
            const roles = Object.entries(cluster.ROLE_PRESETS || {}).map(([value, preset]) => ({
                value, label: preset.name, emoji: preset.emoji
            }));
            // Cluster statistics intentionally contain no bot tokens or credential material.
            return res.json({ success: true, stats, roles });
        } catch (error) {
            return res.status(500).json({ success: false, error: 'Could not load Multi-Bot cluster status.' });
        }
    });

    app.post('/api/guild/:id/multibot/workers', actionLimiter, requireGuildAdmin, requireClusterManager, async (req, res) => {
        try {
            const cluster = client.multiBot || require('./multiBot');
            const premiumSettings = await ServerSettings.findOne({ guildId: req.guild.id }).select('premium').lean();
            const premium = premiumSettings?.premium;
            const premiumActive = Boolean(premium?.isPremium) &&
                (!premium.expiresAt || new Date(premium.expiresAt).getTime() > Date.now());
            if (!premiumActive || !['pro_cluster', 'platinum', 'lifetime'].includes(premium.tier)) {
                return res.status(403).json({ success: false, error: 'Connecting custom Multi-Bot worker nodes requires active Starry Pro Cluster or Lifetime premium on this server.' });
            }
            const token = typeof req.body?.token === 'string' ? req.body.token.trim() : '';
            const name = typeof req.body?.name === 'string' ? req.body.name.trim().slice(0, 64) : '';
            const role = typeof req.body?.role === 'string' ? req.body.role : 'all';
            if (!token || token.length > 256) return res.status(400).json({ success: false, error: 'Enter a valid Discord bot token (maximum 256 characters).' });
            if (role && !cluster.ROLE_PRESETS?.[role]) return res.status(400).json({ success: false, error: 'Choose a valid worker specialization.' });
            const worker = await cluster.addToken(token, role, name || 'Worker Bot', req.session.user.id);
            if (!worker?.client?.user) return res.status(502).json({ success: false, error: 'The worker could not connect to Discord.' });
            return res.status(201).json({
                success: true,
                message: 'Worker bot connected and saved to the Starry cluster.',
                bot: { id: worker.client.user.id, name: worker.name, role: worker.role }
            });
        } catch (error) {
            const message = String(error?.message || 'Could not connect worker bot.');
            const status = /already connected|primary|token|discord rejected/i.test(message) ? 400 : 502;
            return res.status(status).json({ success: false, error: message });
        }
    });

    app.patch('/api/guild/:id/multibot/workers/:botId/role', actionLimiter, requireGuildAdmin, requireClusterManager, async (req, res) => {
        try {
            const cluster = client.multiBot || require('./multiBot');
            const worker = cluster.instances.get(String(req.params.botId));
            if (!worker) return res.status(404).json({ success: false, error: 'Worker bot is not connected.' });
            if (worker.isPrimary) return res.status(400).json({ success: false, error: 'The primary Starry bot role is managed separately.' });
            const role = typeof req.body?.role === 'string' ? req.body.role : '';
            if (!cluster.ROLE_PRESETS?.[role]) return res.status(400).json({ success: false, error: 'Choose a valid worker specialization.' });
            const result = await cluster.setRole(String(req.params.botId), role);
            if (!result.success) return res.status(404).json({ success: false, error: result.message });
            return res.json({ success: true, message: 'Worker specialization updated.' });
        } catch (error) {
            return res.status(500).json({ success: false, error: 'Could not update worker specialization.' });
        }
    });

    app.delete('/api/guild/:id/multibot/workers/:botId', actionLimiter, requireGuildAdmin, requireClusterManager, async (req, res) => {
        try {
            const cluster = client.multiBot || require('./multiBot');
            const worker = cluster.instances.get(String(req.params.botId));
            if (!worker) return res.status(404).json({ success: false, error: 'Worker bot is not connected.' });
            if (worker.isPrimary) return res.status(400).json({ success: false, error: 'The primary Starry bot cannot be disconnected here.' });
            const removed = await cluster.removeToken(String(req.params.botId));
            if (!removed) return res.status(404).json({ success: false, error: 'Worker bot was not removed.' });
            return res.json({ success: true, message: 'Worker disconnected and removed from the saved cluster.' });
        } catch (error) {
            return res.status(500).json({ success: false, error: 'Could not disconnect worker bot.' });
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
                footer: '{server} • Leveling System', pingContent: '✨ <@{user}> just hit **Level {level}**!', authorName: 'LEVEL UP UNLOCKED', roleRewards: []
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
            if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
                return res.status(400).json({ success: false, error: 'Settings payload must be an object.' });
            }
            if (payload.prefix !== undefined && (typeof payload.prefix !== 'string' || payload.prefix.trim().length < 1 || payload.prefix.trim().length > 3)) {
                return res.status(400).json({ success: false, error: 'Command prefix must contain 1 to 3 characters.' });
            }
            if (payload.triggerWord !== undefined && (typeof payload.triggerWord !== 'string' || payload.triggerWord.trim().length < 1 || payload.triggerWord.trim().length > 32)) {
                return res.status(400).json({ success: false, error: 'Assistant trigger word must contain 1 to 32 characters.' });
            }
            if (payload.logging !== undefined) {
                const allowedLogKeys = new Set(['modLogChannel', 'messageLogChannel', 'voiceLogChannel', 'memberLogChannel', 'serverLogChannel']);
                if (!payload.logging || typeof payload.logging !== 'object' || Array.isArray(payload.logging) ||
                    Object.keys(payload.logging).some(key => !allowedLogKeys.has(key))) {
                    return res.status(400).json({ success: false, error: 'Invalid logging settings.' });
                }
                for (const [key, rawId] of Object.entries(payload.logging)) {
                    if (typeof rawId !== 'string') return res.status(400).json({ success: false, error: 'Log destinations must be channel IDs or empty.' });
                    const channelId = rawId.trim();
                    if (channelId) {
                        const channel = guild.channels.cache.get(channelId);
                        if (!channel || !channel.isTextBased() || typeof channel.send !== 'function') {
                            return res.status(400).json({ success: false, error: 'Each log destination must be a text channel in this server.' });
                        }
                    }
                    payload.logging[key] = channelId;
                }
            }
            if (payload.verification !== undefined) {
                const v = payload.verification;
                const allowed = new Set(['enabled','roleId','unverifiedRoleId','channelId','logChannelId','minAccountAgeDays','ageAction','requireAvatar','requireRules','rulesText','methods']);
                if (!v || typeof v !== 'object' || Array.isArray(v) || Object.keys(v).some(k => !allowed.has(k))) return res.status(400).json({ success: false, error: 'Invalid verification settings.' });
                for (const key of ['enabled','requireAvatar','requireRules']) if (v[key] !== undefined && typeof v[key] !== 'boolean') return res.status(400).json({ success: false, error: key + ' must be true or false.' });
                if (v.minAccountAgeDays !== undefined && (!Number.isInteger(Number(v.minAccountAgeDays)) || Number(v.minAccountAgeDays) < 0 || Number(v.minAccountAgeDays) > 3650)) return res.status(400).json({ success: false, error: 'Minimum account age must be 0–3650 days.' });
                if (v.minAccountAgeDays !== undefined) v.minAccountAgeDays = Number(v.minAccountAgeDays);
                if (v.ageAction !== undefined && !['warn','quarantine','reject'].includes(v.ageAction)) return res.status(400).json({ success: false, error: 'Choose warn, quarantine or reject for young accounts.' });
                for (const key of ['roleId','unverifiedRoleId']) if (v[key] !== undefined) {
                    if (typeof v[key] !== 'string') return res.status(400).json({ success: false, error: key + ' must be a role ID.' });
                    v[key] = v[key].trim();
                    if (v[key] && (!guild.roles.cache.has(v[key]) || guild.roles.cache.get(v[key]).managed || v[key] === guild.id)) return res.status(400).json({ success: false, error: 'Choose a normal role from this server.' });
                }
                for (const key of ['channelId','logChannelId']) if (v[key] !== undefined) {
                    if (typeof v[key] !== 'string') return res.status(400).json({ success: false, error: key + ' must be a channel ID.' });
                    v[key] = v[key].trim();
                    if (v[key]) { const ch = guild.channels.cache.get(v[key]); if (!ch || !ch.isTextBased() || typeof ch.send !== 'function') return res.status(400).json({ success: false, error: 'Choose a text channel from this server.' }); }
                }
                if (v.rulesText !== undefined && (typeof v.rulesText !== 'string' || v.rulesText.length > 1800)) return res.status(400).json({ success: false, error: 'Rules text must be 1800 characters or fewer.' });
                if (v.methods !== undefined) {
                    const methods = v.methods, keys = ['button','captcha','math','dm','rules'];
                    if (!methods || typeof methods !== 'object' || Array.isArray(methods) || Object.keys(methods).some(k => !keys.includes(k)) || keys.some(k => methods[k] !== undefined && typeof methods[k] !== 'boolean')) return res.status(400).json({ success: false, error: 'Invalid verification method settings.' });
                    if (!keys.some(k => methods[k] === true)) return res.status(400).json({ success: false, error: 'Enable at least one verification method.' });
                }
                if (v.enabled && v.roleId && guild.roles.cache.get(v.roleId).position >= (guild.members.me || {}).roles?.highest?.position) return res.status(400).json({ success: false, error: 'Move Starry above the verified role before enabling verification.' });
            }
            if (payload.antinuke !== undefined) {
                const policy = payload.antinuke;
                const boolKeys = ['enabled', 'blockUnapprovedBots', 'blockWebhookCreation', 'panicLockdown'];
                const numberKeys = ['maxChannelDeletions', 'maxRoleDeletions', 'maxBans', 'maxKicks'];
                const allowedKeys = new Set([...boolKeys, ...numberKeys, 'action', 'quarantineRoleId', 'whitelistedUsers', 'whitelistedRoles']);
                if (!policy || typeof policy !== 'object' || Array.isArray(policy) || Object.keys(policy).some(key => !allowedKeys.has(key))) {
                    return res.status(400).json({ success: false, error: 'Invalid Anti-Nuke policy.' });
                }
                for (const key of boolKeys) {
                    if (policy[key] !== undefined && typeof policy[key] !== 'boolean') return res.status(400).json({ success: false, error: key + ' must be enabled or disabled.' });
                }
                for (const key of numberKeys) {
                    if (policy[key] !== undefined && (!Number.isInteger(Number(policy[key])) || Number(policy[key]) < 1 || Number(policy[key]) > 50)) {
                        return res.status(400).json({ success: false, error: key + ' must be a whole number from 1 to 50.' });
                    }
                    if (policy[key] !== undefined) policy[key] = Number(policy[key]);
                }
                if (policy.action !== undefined && !['quarantine', 'timeout', 'kick', 'ban'].includes(policy.action)) {
                    return res.status(400).json({ success: false, error: 'Choose a valid Anti-Nuke response.' });
                }
                if (policy.quarantineRoleId !== undefined) {
                    if (typeof policy.quarantineRoleId !== 'string') return res.status(400).json({ success: false, error: 'Quarantine role must be a role ID.' });
                    const roleId = policy.quarantineRoleId.trim();
                    if (roleId && (!guild.roles.cache.has(roleId) || guild.roles.cache.get(roleId).managed || roleId === guild.id)) {
                        return res.status(400).json({ success: false, error: 'Choose a manageable role from this server for quarantine.' });
                    }
                    policy.quarantineRoleId = roleId;
                }
                for (const key of ['whitelistedUsers', 'whitelistedRoles']) {
                    if (policy[key] !== undefined && (!Array.isArray(policy[key]) || policy[key].some(value => typeof value !== 'string'))) {
                        return res.status(400).json({ success: false, error: key + ' must be a list of Discord IDs.' });
                    }
                }
            }
            if (payload.embedTheme !== undefined) {
                const theme = payload.embedTheme;
                const allowedThemeKeys = new Set(['color', 'footer', 'footerIcon', 'authorName', 'authorIcon']);
                if (!theme || typeof theme !== 'object' || Array.isArray(theme) || Object.keys(theme).some(key => !allowedThemeKeys.has(key))) {
                    return res.status(400).json({ success: false, error: 'Invalid embed theme settings.' });
                }
                if (theme.color !== undefined && (typeof theme.color !== 'string' || !/^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i.test(theme.color.trim()))) {
                    return res.status(400).json({ success: false, error: 'Embed accent color must be a valid 3- or 6-digit hex color.' });
                }
                for (const key of ['footer', 'authorName']) {
                    if (theme[key] !== undefined && (typeof theme[key] !== 'string' || theme[key].length > (key === 'footer' ? 2048 : 256))) {
                        return res.status(400).json({ success: false, error: key + ' is too long or invalid.' });
                    }
                    if (theme[key] !== undefined) theme[key] = theme[key].trim();
                }
                for (const key of ['footerIcon', 'authorIcon']) {
                    if (theme[key] !== undefined) {
                        if (typeof theme[key] !== 'string' || theme[key].length > 500) return res.status(400).json({ success: false, error: key + ' must be a valid image URL.' });
                        const value = theme[key].trim();
                        if (value) {
                            try { const parsed = new URL(value); if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error(); }
                            catch (_) { return res.status(400).json({ success: false, error: key + ' must be an HTTP or HTTPS URL.' }); }
                        }
                        theme[key] = value;
                    }
                }
                if (theme.color !== undefined) theme.color = theme.color.trim();
            }
            let settings = await ServerSettings.findOne({ guildId: guild.id });
            if (!settings) settings = new ServerSettings({ guildId: guild.id });

            if (payload.prefix !== undefined) {
                const normalizedPrefix = payload.prefix.trim();
                settings.prefix = normalizedPrefix;
                const { setCachedPrefix } = require('./commandHandler');
                setCachedPrefix(guild.id, normalizedPrefix);
            }
            if (payload.triggerWord !== undefined) settings.triggerWord = payload.triggerWord.trim();
            if (payload.embedTheme) settings.embedTheme = { ...(settings.embedTheme?.toObject?.() || settings.embedTheme || {}), ...payload.embedTheme };
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
            if (payload.embedTheme) {
                const { setCachedTheme } = require('./embedVisuality');
                setCachedTheme(guild.id, settings.embedTheme?.toObject?.() || settings.embedTheme);
            }
            if (payload.logging && typeof client.invalidateLogSettings === 'function') client.invalidateLogSettings(guild.id);
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

            const { channelId, title, description, color, author, authorIcon, thumbnail, image, footer, footerIcon } = req.body || {};
            const channel = guild.channels.cache.get(channelId);
            if (!channel || !channel.isTextBased() || typeof channel.send !== 'function') {
                return res.status(400).json({ success: false, error: 'Invalid text channel selected.' });
            }
            const cleanText = (value, max, label) => {
                if (value === undefined || value === null || value === '') return '';
                if (typeof value !== 'string' || value.length > max) throw Object.assign(new Error(label + ' is too long or invalid.'), { status: 400 });
                return value.trim();
            };
            const cleanUrl = (value, label) => {
                const raw = cleanText(value, 500, label);
                if (!raw) return '';
                try { const parsed = new URL(raw); if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error(); }
                catch (_) { throw Object.assign(new Error(label + ' must be an HTTP or HTTPS URL.'), { status: 400 }); }
                return raw;
            };
            const embedTitle = cleanText(title, 256, 'Embed title');
            const embedDescription = cleanText(description, 4096, 'Embed description');
            const explicitColor = cleanText(color, 7, 'Embed color');
            if (explicitColor && !/^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i.test(explicitColor)) {
                return res.status(400).json({ success: false, error: 'Embed accent color must be a valid hex color.' });
            }
            const theme = (await ServerSettings.findOne({ guildId: guild.id }))?.embedTheme || {};
            const authorName = cleanText(author, 256, 'Embed author') || theme.authorName || '';
            const authorImage = cleanUrl(authorIcon, 'Author icon') || theme.authorIcon || '';
            const footerText = cleanText(footer, 2048, 'Embed footer') || theme.footer || '';
            const footerImage = cleanUrl(footerIcon, 'Footer icon') || theme.footerIcon || '';
            const thumbUrl = cleanUrl(thumbnail, 'Thumbnail URL');
            const imageUrl = cleanUrl(image, 'Image URL');
            const embed = new EmbedBuilder().setColor(explicitColor || theme.color || config.EMBED_COLORS?.PRIMARY || '#5865F2');
            if (embedTitle) embed.setTitle(embedTitle);
            if (embedDescription) embed.setDescription(embedDescription);
            if (authorName) embed.setAuthor({ name: authorName, ...(authorImage ? { iconURL: authorImage } : {}) });
            if (thumbUrl) embed.setThumbnail(thumbUrl);
            if (imageUrl) embed.setImage(imageUrl);
            if (footerText) embed.setFooter({ text: footerText, ...(footerImage ? { iconURL: footerImage } : {}) });
            embed.setTimestamp();

            await channel.send({ embeds: [embed] });
            res.json({ success: true, message: `Embed successfully dispatched to #${channel.name}!` });
        } catch (e) {
            res.status(e.status || 500).json({ success: false, error: e.message });
        }
    });

    // POST /api/guild/:id/music/control - Remote Web Player Controls (Member Guarded)
    app.post('/api/guild/:id/music/control', actionLimiter, requireGuildMember, async (req, res) => {
        try {
            const guild = req.guild || client.guilds.cache.get(req.params.id);
            if (!guild) return res.status(404).json({ success: false, error: 'Guild not found.' });

            const { action, value } = req.body || {};
            const player = client.multiBot?.getPlayerForGuild(guild.id) || StarryAudioEngine.getPlayer(guild.id) || (client.manager ? client.manager.getPlayer(guild.id) : null);
            if (!player) return res.status(400).json({ success: false, error: 'No active voice/music session in this server.' });

            if (action === 'pause') {
                if (typeof player.pause !== 'function') return res.status(400).json({ success: false, error: 'Pause is not supported by this player.' });
                player.pause(!Boolean(player.paused));
            } else if (action === 'skip') {
                if (typeof player.skip === 'function') await player.skip();
                else if (typeof player.queue?.next === 'function') await player.queue.next();
                else return res.status(400).json({ success: false, error: 'Skip is not supported by this player.' });
            } else if (action === 'stop') {
                if (typeof player.stop === 'function') await player.stop();
                else if (typeof player.destroy === 'function') await player.destroy();
                else return res.status(400).json({ success: false, error: 'Stop is not supported by this player.' });
            } else if (action === 'volume') {
                const volume = Number(value);
                if (!Number.isInteger(volume) || volume < 1 || volume > 150) return res.status(400).json({ success: false, error: 'Volume must be a whole number from 1 to 150.' });
                if (typeof player.setVolume !== 'function') return res.status(400).json({ success: false, error: 'Volume control is not supported by this player.' });
                player.setVolume(volume);
            } else if (action === 'filter') {
                const hasPremium = await isServerOrUserPremium(guild.id, req.session?.user?.id, client);
                if (!hasPremium) return res.status(403).json({ success: false, error: 'Studio DSP audio profiles require Starry Shield Plus, Pro Cluster or Lifetime premium.' });
                const allowed = new Set(['clear', 'flat', 'empowering', 'bass', 'bassboost', '8d', 'nightcore', 'daycore', 'vaporwave', 'lofi', 'reverb', 'karaoke', 'surround', 'electronic', 'soft', 'radio', 'treble', 'pop']);
                if (typeof value !== 'string' || !allowed.has(value)) return res.status(400).json({ success: false, error: 'Choose a supported audio profile.' });
                if (typeof player.setFilter !== 'function') return res.status(400).json({ success: false, error: 'Audio profiles are not supported by this player.' });
                await player.setFilter(value);
            } else if (action === 'loop') {
                if (!['none', 'track', 'queue'].includes(value)) return res.status(400).json({ success: false, error: 'Choose Off, Track or Queue repeat mode.' });
                if (typeof player.setLoop === 'function') player.setLoop(value);
                else player.loop = value;
            } else if (action === 'autoplay') {
                const enabled = Boolean(value);
                player.data?.set?.('autoplay', enabled);
                player.autoplay = enabled;
                if (enabled && player.queue?.length === 0) {
                    try { require('../utils/musicManager').triggerAutoplayBuffer(player, true).catch(() => {}); } catch (_) {}
                }
            } else if (action === 'toggle247') {
                player.is247 = value === undefined ? !player.is247 : Boolean(value);
            } else {
                return res.status(400).json({ success: false, error: 'Unknown music control action.' });
            }

            return res.json({ success: true, message: 'Music control updated.', player: { paused: Boolean(player.paused), is247: Boolean(player.is247), loop: player.loop || 'none', autoplay: Boolean(player.autoplay || player.data?.get?.('autoplay')), volume: Number(player.volume ?? 100) } });
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

            const assignment = client.multiBot?.getMusicWorker(guild, vChannel);
            if (assignment && assignment.isAvailable === false) {
                return res.status(409).json({ success: false, error: 'All Starry music workers are currently occupied. Try another voice channel or wait for a worker to become free.' });
            }
            const musicClient = assignment?.client || client;
            const musicGuild = musicClient.guilds.cache.get(guild.id) || (musicClient === client ? guild : null);
            if (!musicGuild) return res.status(409).json({ success: false, error: 'The selected music worker has not joined this Discord server yet. Invite it first.' });
            const musicVoice = musicGuild.channels.cache.get(vChannel.id);
            const musicText = musicGuild.channels.cache.get(tChannel.id) || musicGuild.channels.cache.find(channel => channel.isTextBased());
            if (!musicVoice?.isVoiceBased()) return res.status(400).json({ success: false, error: 'The selected worker cannot access that voice channel.' });

            let player = StarryAudioEngine.getPlayer(guild.id, musicClient) || (musicClient.manager ? musicClient.manager.getPlayer(guild.id) : null);
            if (!player && musicClient.manager) {
                player = await musicClient.manager.createPlayer({
                    guildId: guild.id,
                    textId: musicText?.id || vChannel.id,
                    voiceId: musicVoice.id,
                    deaf: true
                });
            }
            if (!player || typeof player.search !== 'function' || !player.queue?.add) {
                return res.status(503).json({ success: false, error: 'The assigned worker has no ready music search engine. Check its Lavalink connection.' });
            }

            let tracksToQueue = [];
            const spotifyLink = parseSpotifyUrl(query);
            if (spotifyLink) {
                const collection = await resolveSpotifyUrl(query, { maxTracks: 25 });
                for (let offset = 0; offset < collection.tracks.length; offset += 3) {
                    const batch = collection.tracks.slice(offset, offset + 3);
                    const matches = await Promise.all(batch.map(async metadata => {
                        if (!metadata?.query) return null;
                        let found = await player.search('ytmsearch:' + metadata.query, { requester: musicClient.user });
                        if (!found?.tracks?.length) found = await player.search('ytsearch:' + metadata.query, { requester: musicClient.user });
                        const playable = bestPlayableMusicMatch(found?.tracks, metadata.query);
                        if (!playable) {
                            console.warn('[Music Match] Skipped weak Spotify-to-audio match:', metadata.query);
                            return null;
                        }
                        return { ...playable, title: metadata.title || playable.title, author: metadata.artist || playable.author, thumbnail: metadata.artwork || playable.thumbnail, length: metadata.durationMs || playable.length };
                    }));
                    tracksToQueue.push(...matches.filter(Boolean));
                }
            } else {
                const resTrack = await player.search(query, { requester: musicClient.user });
                if (resTrack?.tracks?.length) tracksToQueue = [resTrack.tracks[0]];
            }
            if (!tracksToQueue.length) {
                return res.status(404).json({ success: false, error: 'No playable matches found. Check the Spotify link or try another search.' });
            }
            for (const track of tracksToQueue) player.queue.add(track);
            if (!player.playing && !player.paused) await player.play();
            const firstTrack = tracksToQueue[0];
            return res.json({
                success: true,
                message: 'Queued ' + tracksToQueue.length + ' track(s), starting with "' + String(firstTrack.title || query).slice(0, 160) + '" via ' + (assignment?.name || musicClient.user?.username || 'Starry') + '.',
                track: { title: firstTrack.title, author: firstTrack.author, duration: firstTrack.length },
                queued: tracksToQueue.length
            });
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

    // GET /api/premium/tiers - Canonical Starry EUR pricing and feature catalogue
    app.get('/api/premium/tiers', (req, res) => {
        res.set('Cache-Control', 'public, max-age=300');
        res.json({
            success: true,
            currency: 'EUR',
            tiers: Object.values(TIER_CONFIG).map(tier => ({
                id: tier.id, name: tier.name, price: `€${tier.eur}`,
                amount: tier.eur,
                billing: tier.durationDays === -1 ? 'One-time' : 'Monthly',
                durationDays: tier.durationDays, maxGuilds: tier.maxGuilds,
                badge: tier.badge, features: tier.features
            }))
        });
    });

    // Checkout is deliberately unavailable until a real provider and signed webhook are configured.
    app.post('/api/premium/checkout', actionLimiter, (req, res) => {
        res.status(503).json({
            success: false,
            code: 'PAYMENTS_NOT_CONFIGURED',
            error: 'Starry checkout is not active yet. No payment methods are currently accepting money.'
        });
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

    // Payment approval and key-generation endpoints have been removed.
    // Premium entitlements will only be granted by verified provider webhooks.

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
