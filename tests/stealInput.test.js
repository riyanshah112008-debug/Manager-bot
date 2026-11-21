'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { parseStealCommand, extractStealItems, normalizeAssetName } = require('../src/modules/steal');

test('steal command accepts configured comma and legacy exclamation prefixes', () => {
    assert.equal(parseStealCommand(',steal'), '');
    assert.equal(parseStealCommand(',steal <:staff:123456789012345678>'), '<:staff:123456789012345678>');
    assert.equal(parseStealCommand('!steal <:staff:123456789012345678>'), '<:staff:123456789012345678>');
    assert.equal(parseStealCommand('!steal https://cdn.example.com/image.png'), 'https://cdn.example.com/image.png');
    assert.equal(parseStealCommand(',stealer'), null);
    assert.equal(parseStealCommand('steal <:staff:123456789012345678>'), null);
});

test('steal extracts static and animated custom emoji with de-duplication', () => {
    const items = extractStealItems('<:staff:123456789012345678> <a:dance:223456789012345678> <:staff:123456789012345678>');
    assert.equal(items.length, 2);
    assert.equal(items[0].type, 'emoji');
    assert.match(items[0].url, /123456789012345678\.png$/);
    assert.match(items[1].url, /223456789012345678\.gif$/);
});

test('steal extracts reply stickers, image attachments and direct image URLs', () => {
    const stickers = new Map([['sticker-1', { id: 'sticker-1', name: 'wave', url: 'https://cdn.example.com/wave.png' }]]);
    const attachments = new Map([['attachment-1', { id: 'attachment-1', name: 'photo.png', contentType: 'image/png', url: 'https://cdn.example.com/photo.png' }]]);
    const items = extractStealItems('https://cdn.example.com/direct.gif', stickers, attachments);
    assert.deepEqual(items.map(item => item.type), ['sticker', 'emoji', 'emoji']);
    assert.equal(items.length, 3);
});

test('asset names are safe for Discord uploads', () => {
    assert.equal(normalizeAssetName('bad name!'), 'bad_name_');
    assert.equal(normalizeAssetName('x'), 'x_');
    assert.equal(normalizeAssetName('a'.repeat(40)).length, 32);
});
