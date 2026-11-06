'use strict';

const express = require('express');
const router = express.Router();

const CLIENT_ID = () => process.env.CLIENT_ID || process.env.APPLICATION_ID || '1513589513648345368';
const CLIENT_SECRET = () => process.env.DISCORD_CLIENT_SECRET || process.env.CLIENT_SECRET || '';
const REDIRECT_URI = 'https://127.0.0.1';
const rooms = new Map();
const tokenCache = new Map();
const ROOM_TTL_MS = 2 * 60 * 60 * 1000;
const MAX_ROOMS = 500;
const MAX_QUEUE = 50;

function cleanRoomId(value) {
    const id = String(value || '');
    return /^[A-Za-z0-9_-]{1,128}$/.test(id) ? id : null;
}

function getRoom(id, userId) {
    const now = Date.now();
    let room = rooms.get(id);
    if (!room || now - room.touchedAt > ROOM_TTL_MS) {
        room = {
            queue: [],
            index: -1,
            playing: false,
            position: 0,
            updatedAt: now,
            touchedAt: now,
            hostId: userId
        };
        rooms.set(id, room);
    }
    room.touchedAt = now;
    if (rooms.size > MAX_ROOMS) {
        const oldest = Array.from(rooms.entries()).sort((a, b) => a[1].touchedAt - b[1].touchedAt)[0];
        if (oldest) rooms.delete(oldest[0]);
    }
    return room;
}

function snapshot(room) {
    const elapsed = room.playing ? Math.max(0, (Date.now() - room.updatedAt) / 1000) : 0;
    return {
        queue: room.queue,
        index: room.index,
        playing: room.playing,
        position: Math.max(0, room.position + elapsed),
        updatedAt: room.updatedAt,
        hostId: room.hostId
    };
}

async function verifyDiscordToken(req, res, next) {
    const match = String(req.headers.authorization || '').match(/^Bearer\s+(.+)$/i);
    const token = match && match[1].trim();
    if (!token || token.length > 4096) return res.status(401).json({ error: 'Discord sign-in is required.' });

    const cached = tokenCache.get(token);
    if (cached && cached.expiresAt > Date.now()) {
        req.mediaUser = cached.user;
        return next();
    }

    try {
        const response = await fetch('https://discord.com/api/v10/users/@me', {
            headers: { Authorization: 'Bearer ' + token }
        });
        if (!response.ok) return res.status(401).json({ error: 'Discord authorization expired. Reopen the Activity.' });
        const user = await response.json();
        if (!user || !/^\d{15,22}$/.test(String(user.id || ''))) {
            return res.status(401).json({ error: 'Discord returned an invalid user identity.' });
        }
        tokenCache.set(token, { user: { id: user.id, username: user.global_name || user.username, avatar: user.avatar || null }, expiresAt: Date.now() + 4 * 60 * 1000 });
        req.mediaUser = { id: user.id, username: user.global_name || user.username, avatar: user.avatar || null };
        return next();
    } catch (error) {
        return res.status(502).json({ error: 'Unable to verify your Discord session right now.' });
    }
}

router.get('/config', (req, res) => {
    res.set('Cache-Control', 'no-store');
    res.json({ clientId: CLIENT_ID(), oauthConfigured: Boolean(CLIENT_SECRET()) });
});

router.post('/token', express.json(), async (req, res) => {
    const code = String(req.body?.code || '');
    const secret = CLIENT_SECRET();
    if (!secret) return res.status(503).json({ error: 'Activity OAuth is not configured. Add DISCORD_CLIENT_SECRET to the bot host.' });
    if (!code || code.length > 1024) return res.status(400).json({ error: 'A valid Discord authorization code is required.' });

    try {
        const body = new URLSearchParams({
            client_id: CLIENT_ID(),
            client_secret: secret,
            grant_type: 'authorization_code',
            code,
            redirect_uri: REDIRECT_URI
        });
        const response = await fetch('https://discord.com/api/v10/oauth2/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body
        });
        const data = await response.json();
        if (!response.ok || !data.access_token) {
            return res.status(401).json({ error: 'Discord OAuth exchange failed. Check the Activity OAuth configuration.' });
        }
        return res.json({ access_token: data.access_token, token_type: data.token_type || 'Bearer', expires_in: data.expires_in || 3600 });
    } catch (error) {
        return res.status(502).json({ error: 'Unable to complete Discord sign-in.' });
    }
});

router.get('/rooms/:roomId', verifyDiscordToken, (req, res) => {
    const id = cleanRoomId(req.params.roomId);
    if (!id) return res.status(400).json({ error: 'Invalid Activity room ID.' });
    const room = getRoom(id, req.mediaUser.id);
    return res.json({ ...snapshot(room), user: req.mediaUser });
});

router.post('/rooms/:roomId', express.json(), verifyDiscordToken, (req, res) => {
    const id = cleanRoomId(req.params.roomId);
    if (!id) return res.status(400).json({ error: 'Invalid Activity room ID.' });
    const room = getRoom(id, req.mediaUser.id);
    const action = String(req.body?.action || '');
    const now = Date.now();

    if (action === 'add') {
        const videoId = String(req.body?.videoId || '');
        const title = String(req.body?.title || 'YouTube video').trim().slice(0, 120) || 'YouTube video';
        if (!/^[A-Za-z0-9_-]{11}$/.test(videoId)) return res.status(400).json({ error: 'Please use a valid YouTube video URL.' });
        if (room.queue.length >= MAX_QUEUE) return res.status(400).json({ error: 'The shared queue is full (50 items).' });
        room.queue.push({ videoId, title, addedBy: req.mediaUser.username });
        if (room.index < 0) room.index = 0;
        room.position = 0;
        room.playing = false;
    } else if (action === 'play') {
        if (room.index < 0 || !room.queue[room.index]) return res.status(409).json({ error: 'Add a video before pressing play.' });
        room.playing = true;
    } else if (action === 'pause') {
        room.position = snapshot(room).position;
        room.playing = false;
    } else if (action === 'seek') {
        const position = Number(req.body?.position);
        if (!Number.isFinite(position) || position < 0 || position > 86400) return res.status(400).json({ error: 'Invalid playback position.' });
        room.position = position;
    } else if (action === 'next') {
        if (room.index + 1 < room.queue.length) {
            room.index += 1;
            room.position = 0;
            room.playing = true;
        } else {
            room.playing = false;
            room.position = 0;
        }
    } else if (action === 'sync') {
        if (room.hostId !== req.mediaUser.id) return res.status(403).json({ error: 'Only the room host can publish playback position.' });
        const position = Number(req.body?.position);
        if (Number.isFinite(position) && position >= 0 && position <= 86400) room.position = position;
    } else {
        return res.status(400).json({ error: 'Unknown media room action.' });
    }

    room.updatedAt = now;
    room.touchedAt = now;
    return res.json({ ...snapshot(room), user: req.mediaUser });
});

module.exports = router;
