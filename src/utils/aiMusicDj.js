'use strict';

const DEFAULT_MODEL = 'gpt-4o-mini';
const MAX_PROMPT_LENGTH = 240;
const MAX_TRACKS = 8;

function normalizeRecommendations(value, limit = 5) {
    const max = Math.max(1, Math.min(MAX_TRACKS, Number(limit) || 5));
    const items = Array.isArray(value) ? value : [];
    const seen = new Set();
    return items.map(item => {
        if (typeof item === 'string') return { query: item.trim(), reason: '' };
        return {
            query: String(item?.query || item?.title || '').trim(),
            reason: String(item?.reason || '').trim().slice(0, 140)
        };
    }).filter(item => {
        const key = item.query.toLowerCase();
        if (!key || key.length > 160 || seen.has(key)) return false;
        seen.add(key);
        return true;
    }).slice(0, max);
}

function fallbackRecommendations(prompt, limit = 5) {
    const mood = String(prompt || '').trim().slice(0, MAX_PROMPT_LENGTH);
    if (!mood) return [];
    const seeds = [
        { query: mood, reason: 'A close match to your request' },
        { query: mood + ' popular songs', reason: 'Popular picks in this sound' },
        { query: mood + ' chill mix', reason: 'A smoother variation' },
        { query: mood + ' upbeat mix', reason: 'A higher-energy variation' },
        { query: mood + ' similar artists', reason: 'Discover related artists' }
    ];
    return normalizeRecommendations(seeds, limit);
}

async function createDjRecommendations(prompt, { limit = 5, apiKey = process.env.OPENAI_API_KEY, model = process.env.OPENAI_MUSIC_MODEL || DEFAULT_MODEL, fetchImpl = global.fetch } = {}) {
    const cleanPrompt = String(prompt || '').trim().slice(0, MAX_PROMPT_LENGTH);
    if (!cleanPrompt) throw new TypeError('Describe a mood, genre, activity, or artist for the AI DJ.');
    if (!apiKey || typeof fetchImpl !== 'function') return fallbackRecommendations(cleanPrompt, limit);

    const response = await fetchImpl('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
            Authorization: 'Bearer ' + apiKey,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            model,
            temperature: 0.7,
            max_tokens: 450,
            response_format: { type: 'json_object' },
            messages: [
                {
                    role: 'system',
                    content: 'You are a music curator. Return JSON only in the shape {"tracks":[{"query":"Artist - Track","reason":"short reason"}]}. Recommend real, searchable released songs. Never invent streaming URLs. Vary artists and avoid duplicates.'
                },
                {
                    role: 'user',
                    content: 'Create ' + Math.max(1, Math.min(MAX_TRACKS, Number(limit) || 5)) + ' song recommendations for this listening brief: ' + cleanPrompt
                }
            ]
        }),
        signal: AbortSignal.timeout(9000)
    });

    if (!response.ok) {
        const error = new Error('OpenAI music recommendation request failed (' + response.status + ').');
        error.status = response.status;
        throw error;
    }
    const payload = await response.json();
    const content = payload?.choices?.[0]?.message?.content;
    if (typeof content !== 'string') throw new Error('AI DJ returned an empty recommendation response.');
    let parsed;
    try { parsed = JSON.parse(content); } catch (_) { throw new Error('AI DJ returned invalid recommendation data.'); }
    const tracks = normalizeRecommendations(parsed.tracks || parsed.recommendations, limit);
    if (!tracks.length) throw new Error('AI DJ could not find suitable recommendations. Try a more specific mood or genre.');
    return tracks;
}

module.exports = { createDjRecommendations, normalizeRecommendations, fallbackRecommendations };
