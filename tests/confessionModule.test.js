'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const confession = require('../src/modules/confession');

test('confession panel uses a stable persistent button custom ID', () => {
    const rows = confession.buildPanelComponents();
    assert.equal(rows.length, 1);
    assert.equal(rows[0].components[0].data.custom_id, 'starry:confession:open');
});

test('confession cards have report and anonymous reply actions', () => {
    const rows = confession.buildConfessionActions('12345678901234567', true);
    const ids = rows[0].components.map(component => component.data.custom_id);
    assert.ok(ids.includes('starry:confession:reply:12345678901234567'));
    assert.ok(ids.includes('starry:confession:report:12345678901234567'));
});

test('reply action can be disabled without removing reports', () => {
    const rows = confession.buildConfessionActions('12345678901234567', false);
    const ids = rows[0].components.map(component => component.data.custom_id);
    assert.equal(ids.length, 1);
    assert.equal(ids[0], 'starry:confession:report:12345678901234567');
});

test('submission modal is private and enforces bounded input lengths', () => {
    const modal = confession.buildConfessionModal().toJSON();
    assert.equal(modal.custom_id, 'starry:confession:submit');
    assert.equal(modal.components[0].components[0].custom_id, 'topic');
    assert.equal(modal.components[1].components[0].custom_id, 'body');
    assert.equal(modal.components[1].components[0].max_length, 1000);
});

test('reply and report modal IDs are bound to the source confession message', () => {
    const messageId = '12345678901234567';
    assert.equal(confession.buildReplyModal(messageId).toJSON().custom_id, 'starry:confession:reply:' + messageId);
    assert.equal(confession.buildReportModal(messageId).toJSON().custom_id, 'starry:confession:report:' + messageId);
});

test('panel and confession embeds are valid Discord embed payloads', () => {
    assert.equal(confession.buildPanelEmbed().toJSON().title, '💌  Starry Confession Box');
    const card = confession.buildConfessionEmbed(12, 'Late night thoughts', 'A sample confession').toJSON();
    assert.match(card.author.name, /#12$/);
    assert.equal(card.title, '✦ Late night thoughts');
});
