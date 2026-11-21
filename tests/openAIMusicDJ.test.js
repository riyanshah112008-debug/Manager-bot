'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
    createMusicDJPlan,
    extractResponseText,
    normalizePlan
} = require('../src/utils/openAIMusicDJ');

test('Music DJ normalizes only bounded, searchable recommendations', () => {
    const plan = normalizePlan({
        mood: 'Late-night electronic',
        summary: 'A smooth, low-key mix.',
        recommendations: [
            { title: 'Track One', artist: 'Artist One', search_query: 'Track One Artist One', reason: 'Matches the mood.' },
            { title: '', artist: '', search_query: '', reason: '' },
            { title: 'Track Two', artist: 'Artist Two', search_query: 'Track Two Artist Two', reason: 'Keeps the flow.' }
        ]
    }, 5);
    assert.equal(plan.recommendations.length, 2);
    assert.equal(plan.recommendations[0].search_query, 'Track One Artist One');
    assert.ok(plan.summary.length <= 240);
});

test('Music DJ extracts text from Responses API output items', () => {
    assert.equal(extractResponseText({
        output: [{ type: 'message', content: [{ type: 'output_text', text: '{"mood":"focus"}' }] }]
    }), '{"mood":"focus"}');
});

test('Music DJ stays disabled without OPENAI_API_KEY and makes no network request', async () => {
    let called = false;
    const result = await createMusicDJPlan({
        request: 'focus music',
        apiKey: '',
        fetchImpl: async () => { called = true; throw new Error('must not be called'); }
    });
    assert.equal(result, null);
    assert.equal(called, false);
});

test('Music DJ uses the Responses API structured-output contract', async () => {
    let requestUrl = '';
    let body;
    const result = await createMusicDJPlan({
        request: 'bright synthwave for a night drive',
        currentTrack: { title: 'Nightcall', author: 'Kavinsky' },
        apiKey: 'test-key',
        model: 'gpt-5.4-mini',
        fetchImpl: async (url, options) => {
            requestUrl = url;
            body = JSON.parse(options.body);
            return {
                ok: true,
                json: async () => ({
                    output_text: JSON.stringify({
                        mood: 'Night drive',
                        summary: 'Melodic electronic tracks with a steady pace.',
                        recommendations: [{
                            title: 'Odd Look',
                            artist: 'Kavinsky',
                            search_query: 'Odd Look Kavinsky',
                            reason: 'Keeps the synthwave atmosphere.'
                        }]
                    })
                })
            };
        }
    });
    assert.equal(requestUrl, 'https://api.openai.com/v1/responses');
    assert.equal(body.model, 'gpt-5.4-mini');
    assert.equal(body.store, false);
    assert.equal(body.text.format.type, 'json_schema');
    assert.equal(result.recommendations[0].search_query, 'Odd Look Kavinsky');
});
