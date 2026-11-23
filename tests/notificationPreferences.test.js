'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { allowsReminderDm } = require('../src/utils/notificationPreferences');

test('reminder DMs are enabled by default for new and existing users', () => {
    assert.equal(allowsReminderDm(null), true);
    assert.equal(allowsReminderDm({}), true);
    assert.equal(allowsReminderDm({ notifications: true }), true);
});

test('users can disable direct-message reminder delivery', () => {
    assert.equal(allowsReminderDm({ notifications: false }), false);
});
