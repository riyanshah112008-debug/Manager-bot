'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { createDjRecommendations, normalizeRecommendations, fallbackRecommendations } = require('../src/utils/aiMusicDj');

test('normalizes, trims, bounds and deduplicates recommendations', () => {
    const result = normalizeRecommendations([
        { query: ' Artist - Song ', reason: 'Good fit' },
        { title: 'artist - song' },
        { query: '' },
        { query: 'B'.repeat(161) }
    ], 8);
    assert.deepEqual(result, [{ query: 'Artist - Song', reason: 'Good fit' }]);
});

test('uses deterministic fallback when no OpenAI key is configured', async () => {
    const result = await createDjRecommendations('late night synthwave', { apiKey: '', limit: 3 });
    assert.equal(result.length, 3);
    assert.match(result[0].query, /late night synthwave/i);
    assert.deepEqual(fallbackRecommendations('', 5), []);
});

test('sends bounded prompt to OpenAI and parses structured recommendations', async () => {
    let request;
    const fetchImpl = async (url, options) => {
        request = { url, options };
        return {
            ok: true,
            json: async () => ({ choices: [{ message: { content: JSON.stringify({ tracks: [{ query: 'Artist - Track', reason: 'Fits the mood' }] }) } }] })
        };
    };
    const result = await createDjRecommendations('focus music', { apiKey: 'test-key', fetchImpl, limit: 1 });
    assert.equal(request.url, 'https://api.openai.com/v1/chat/completions');
    assert.equal(request.options.headers.Authorization, 'Bearer test-key');
    assert.equal(result[0].query, 'Artist - Track');
});

test('rejects blank prompts and malformed AI responses', async () => {
    await assert.rejects(() => createDjRecommendations('  ', { apiKey: '' }), /Describe a mood/);
    await assert.rejects(() => createDjRecommendations('focus', {
        apiKey: 'test-key',
        fetchImpl: async () => ({ ok: true, json: async () => ({ choices: [{ message: { content: 'not json' } }] }) })
    }), /invalid recommendation data/i);
});
