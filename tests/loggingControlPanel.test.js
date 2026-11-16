'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { isLoggingAllowed, getLogChannelField } = require('../src/utils/loggingPolicy');

test('master logging switch disables every category', () => {
 assert.equal(isLoggingAllowed({ enabled: false, aiEnabled: true }, 'ai'), false);
 assert.equal(isLoggingAllowed({ enabled: false, moderationEnabled: true }, 'moderate'), false);
});
test('category switches are independent while the master switch is enabled', () => {
 assert.equal(isLoggingAllowed({ enabled: true, moderationEnabled: false }, 'moderate'), false);
 assert.equal(isLoggingAllowed({ enabled: true, moderationEnabled: true }, 'moderate'), true);
 assert.equal(isLoggingAllowed({ enabled: true, messagesEnabled: false }, 'messages'), false);
});
test('AI logging is opt-in', () => {
 assert.equal(isLoggingAllowed({ enabled: true }, 'ai'), false);
 assert.equal(isLoggingAllowed({ enabled: true, aiEnabled: true }, 'ai'), true);
});
test('each category resolves to its dedicated channel setting', () => {
 assert.equal(getLogChannelField('ai'), 'aiLogChannel');
 assert.equal(getLogChannelField('moderate'), 'modLogChannel');
 assert.equal(getLogChannelField('messages'), 'messageLogChannel');
 assert.equal(getLogChannelField('voice'), 'voiceLogChannel');
 assert.equal(getLogChannelField('members'), 'memberLogChannel');
 assert.equal(getLogChannelField('channels'), 'serverLogChannel');
});
