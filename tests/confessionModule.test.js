'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const confession = require('../src/modules/confession');

test('confession panel uses a stable persistent button custom ID', () => {
    const rows = confession.buildPanelComponents();
    assert.equal(rows.length, 1);
    assert.equal(rows[0].components[0].data.custom_id, 'starry:confession:open');
});

test('confession cards expose the configured reply and report actions', () => {
    const rows = confession.buildConfessionActions(true);
    const ids = rows[0].components.map(component => component.data.custom_id);
    assert.deepEqual(ids, ['starry:confession:reply', 'starry:confession:report']);
});

test('reply action can be disabled without removing reports', () => {
    const rows = confession.buildConfessionActions(false);
    const ids = rows[0].components.map(component => component.data.custom_id);
    assert.deepEqual(ids, ['starry:confession:report']);
});

test('submission modal is private and enforces bounded input lengths', () => {
    const modal = confession.buildConfessionModal().toJSON();
    assert.equal(modal.custom_id, 'starry:confession:submit');
    assert.equal(modal.components[0].components[0].custom_id, 'topic');
    assert.equal(modal.components[1].components[0].custom_id, 'body');
    assert.equal(modal.components[1].components[0].max_length, 1000);
});

test('reply and report modal IDs bind to the originating channel and message', () => {
    const channelId = '12345678901234567';
    const messageId = '12345678901234568';
    assert.equal(
        confession.buildReplyModal(channelId, messageId).toJSON().custom_id,
        'starry:confession:reply-submit:' + channelId + ':' + messageId
    );
    assert.equal(
        confession.buildReportModal(channelId, messageId).toJSON().custom_id,
        'starry:confession:report-submit:' + channelId + ':' + messageId
    );
});

test('panel and confession embeds are valid Discord embed payloads', () => {
    assert.equal(confession.buildPanelEmbed().toJSON().title, '💌  Starry Confession Box');
    const card = confession.buildConfessionEmbed(12, 'Late night thoughts', 'A sample confession').toJSON();
    assert.match(card.author.name, /#12$/);
    assert.equal(card.title, '✦ Late night thoughts');
});

test('staff report channel validation rejects public and shared destinations', () => {
    const guild = { id: 'guild', roles: { everyone: {} } };
    const publicChannel = {
        id: 'public', guildId: 'guild', type: 0,
        isTextBased: () => true,
        permissionsFor: () => ({ has: () => true })
    };
    const staffChannel = {
        id: 'staff', guildId: 'guild', type: 0,
        isTextBased: () => true,
        permissionsFor: role => ({ has: permission => role === guild.roles.everyone ? false : true })
    };
    const bot = {};
    assert.equal(confession.validateStaffChannel(guild, publicChannel, publicChannel, bot).ok, false);
    assert.equal(confession.validateStaffChannel(guild, publicChannel, staffChannel, bot).ok, true);
});

test('button source is bound to the actual Discord message, not user-supplied IDs', () => {
    const channelId = '12345678901234567';
    const messageId = '12345678901234568';
    const source = confession.getButtonSource({
        customId: 'starry:confession:reply',
        channelId,
        message: { id: messageId }
    });
    assert.deepEqual(source, { action: 'reply', channelId, messageId });
    assert.equal(confession.getButtonSource({
        customId: 'starry:confession:reply',
        channelId: 'not-a-snowflake',
        message: { id: messageId }
    }), null);
});
