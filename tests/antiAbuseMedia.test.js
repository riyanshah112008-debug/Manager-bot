'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const antiAbuse = require('../src/modules/antiAbuse');

test('image attachments are excluded from rapid-text-spam counting', () => {
    const message = {
        content: '',
        attachments: new Map([['1', { contentType: 'image/png', name: 'photo.png' }]]),
        embeds: []
    };
    assert.equal(antiAbuse.hasMediaAttachment(message), true);
    assert.equal(antiAbuse.shouldCountForRateLimit(message), false);
});

test('GIF attachments and GIF embeds are excluded from rapid-text-spam counting', () => {
    const attachmentMessage = {
        content: '',
        attachments: new Map([['1', { contentType: 'image/gif', name: 'reaction.gif' }]]),
        embeds: []
    };
    const embedMessage = {
        content: 'https://tenor.com/view/reaction',
        attachments: new Map(),
        embeds: [{ type: 'gifv', thumbnail: { url: 'https://media.tenor.com/reaction.gif' } }]
    };
    assert.equal(antiAbuse.shouldCountForRateLimit(attachmentMessage), false);
    assert.equal(antiAbuse.shouldCountForRateLimit(embedMessage), false);
});

test('normal text remains eligible for spam detection', () => {
    const message = { content: 'hello everyone', attachments: new Map(), embeds: [] };
    assert.equal(antiAbuse.hasMediaAttachment(message), false);
    assert.equal(antiAbuse.shouldCountForRateLimit(message), true);
});

test('rapid message windows are isolated by guild and user', () => {
    antiAbuse.userMessageLog.clear();
    assert.equal(antiAbuse.recordTextMessage('guild-a', 'user-a', 1000), 1);
    assert.equal(antiAbuse.recordTextMessage('guild-a', 'user-a', 2000), 2);
    assert.equal(antiAbuse.recordTextMessage('guild-b', 'user-a', 2000), 1);
    assert.equal(antiAbuse.recordTextMessage('guild-a', 'user-b', 2000), 1);
});

test('expired timestamps are discarded from the rolling window', () => {
    antiAbuse.userMessageLog.clear();
    antiAbuse.recordTextMessage('guild-a', 'user-a', 1000);
    assert.equal(antiAbuse.recordTextMessage('guild-a', 'user-a', 7000), 1);
});
