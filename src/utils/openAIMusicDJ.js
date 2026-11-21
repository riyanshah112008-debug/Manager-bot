'use strict';

const crypto = require('node:crypto');

const CACHE_TTL_MS = 90_000;
const REQUEST_TIMEOUT_MS = 8_000;
const MAX_RECOMMENDATIONS = 5;
const planCache = new Map();
const pendingPlans = new Map();

const PLAN_SCHEMA = {
    type: 'object',
    additionalProperties: false,
    properties: {
        mood: { type: 'string' },
        summary: { type: 'string' },
        recommendations: {
            type: 'array',
            items: {
                type: 'object',
                additionalProperties: false,
                properties: {
                    title: { type: 'string' },
                    artist: { type: 'string' },
                    search_query: { type: 'string' },
                    reason: { type: 'string' }
                },
                required: ['title', 'artist', 'search_query', 'reason']
            }
        }
    },
    required: ['mood', 'summary', 'recommendations']
};

function normalizePlan(value, limit = MAX_RECOMMENDATIONS) {
    if (!value || typeof value !== 'object') return null;
    const recommendations = Array.isArray(value.recommendations)
        ? value.recommendations.slice(0, Math.max(1, Math.min(MAX_RECOMMENDATIONS, limit)))
        : [];
    const clean = recommendations.map(item => ({
        title: String(item?.title || '').trim().slice(0, 100),
        artist: String(item?.artist || '').trim().slice(0, 80),
        search_query: String(item?.search_query || '').replace(/[\r\n]/g, ' ').trim().slice(0, 160),
        reason: String(item?.reason || '').replace(/[\r\n]/g, ' ').trim().slice(0, 180)
    })).filter(item => item.search_query.length >= 3);
    if (!clean.length) return null;
    return {
        mood: String(value.mood || 'Your mix').trim().slice(0, 60),
        summary: String(value.summary || 'A mix selected around your request.').trim().slice(0, 240),
        recommendations: clean
    };
}

function extractResponseText(payload) {
    if (typeof payload?.output_text === 'string' && payload.output_text.trim()) {
        return payload.output_text.trim();
    }
    const chunks = [];
    for (const item of payload?.output || []) {
        if (item?.type !== 'message' || !Array.isArray(item.content)) continue;
        for (const part of item.content) {
            if ((part?.type === 'output_text' || part?.type === 'text') && typeof part.text === 'string') {
                chunks.push(part.text);
            }
        }
    }
    return chunks.join('\n').trim();
}

function compactTrack(track) {
    if (!track) return null;
    return {
        title: String(track.title || track.name || '').slice(0, 100),
        artist: String(track.author || track.artist || track.channel?.name || '').slice(0, 80)
    };
}

function buildCacheKey({ request, currentTrack, recentTracks, limit }) {
    const serializable = {
        request: String(request || '').trim().toLowerCase(),
        current: compactTrack(currentTrack),
        recent: (recentTracks || []).slice(-8).map(compactTrack).filter(Boolean),
        limit
    };
    return crypto.createHash('sha256').update(JSON.stringify(serializable)).digest('hex');
}

async function createMusicDJPlan({
    request = '',
    currentTrack = null,
    recentTracks = [],
    limit = 5,
    apiKey = process.env.OPENAI_API_KEY,
    model = process.env.OPENAI_MUSIC_MODEL || 'gpt-5.4-mini',
    fetchImpl = globalThis.fetch
} = {}) {
    if (!apiKey || typeof fetchImpl !== 'function') return null;

    const safeLimit = Math.max(1, Math.min(MAX_RECOMMENDATIONS, Number(limit) || 5));
    const safeRequest = String(request || '').replace(/[\r\n]/g, ' ').trim().slice(0, 400);
    const current = compactTrack(currentTrack);
    const recent = (Array.isArray(recentTracks) ? recentTracks : []).slice(-8).map(compactTrack).filter(Boolean);
    const cacheKey = buildCacheKey({ request: safeRequest, currentTrack: current, recentTracks: recent, limit: safeLimit });
    const cached = planCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) return cached.plan;
    if (pendingPlans.has(cacheKey)) return pendingPlans.get(cacheKey);

    const task = (async () => {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
        if (typeof timeout.unref === 'function') timeout.unref();

        try {
            const response = await fetchImpl('https://api.openai.com/v1/responses', {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${apiKey}`,
                    'Content-Type': 'application/json'
                },
                signal: controller.signal,
                body: JSON.stringify({
                    model,
                    store: false,
                    instructions: [
                        'You are Starry DJ, a music curator. Recommend real, officially released songs that can be searched on mainstream music providers.',
                        'Never invent streaming URLs, audio files, albums or availability. Return search queries only; the application verifies every recommendation against live provider results.',
                        'Honor the requested mood, genre, era, energy and explicit constraints. Prefer a coherent mix with variety and smooth energy progression.',
                        'Do not repeat the current track or recent tracks. Avoid unofficial covers, lyric videos, slowed/reverb uploads, mashups and remixes unless specifically requested.',
                        'Return concise titles, artists, search_query values containing both song and artist where known, and short reasons.'
                    ].join(' '),
                    input: JSON.stringify({
                        user_request: safeRequest || 'Continue with music that naturally follows the current song.',
                        current_track: current,
                        recently_played: recent,
                        recommendation_count: safeLimit
                    }),
                    text: {
                        format: {
                            type: 'json_schema',
                            name: 'starry_music_dj_plan',
                            strict: true,
                            schema: PLAN_SCHEMA
                        }
                    },
                    max_output_tokens: 650
                })
            });

            if (!response.ok) {
                const detail = await response.text().catch(() => '');
                throw new Error(`OpenAI Responses API returned HTTP ${response.status}: ${detail.slice(0, 220)}`);
            }
            const payload = await response.json();
            const outputText = extractResponseText(payload);
            if (!outputText) throw new Error('OpenAI returned an empty music plan.');
            const parsed = JSON.parse(outputText);
            const plan = normalizePlan(parsed, safeLimit);
            if (!plan) throw new Error('OpenAI returned no usable song recommendations.');

            planCache.set(cacheKey, { plan, expiresAt: Date.now() + CACHE_TTL_MS });
            while (planCache.size > 100) planCache.delete(planCache.keys().next().value);
            return plan;
        } catch (error) {
            if (error?.name !== 'AbortError') {
                console.warn('[Starry AI DJ] Recommendation request unavailable:', error?.message || error);
            }
            return null;
        } finally {
            clearTimeout(timeout);
        }
    })();

    pendingPlans.set(cacheKey, task);
    try {
        return await task;
    } finally {
        pendingPlans.delete(cacheKey);
    }
}

module.exports = {
    createMusicDJPlan,
    extractResponseText,
    normalizePlan,
    CACHE_TTL_MS,
    REQUEST_TIMEOUT_MS
};
