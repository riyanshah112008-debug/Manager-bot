'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { AutomodGuild } = require('../src/models/AutomodSchema');
const automodHelper = require('../src/utils/automodHelper');
const systemCommands = require('../src/commands/bundles/systemCommands');
const { isLoggingAllowed } = require('../src/utils/loggingPolicy');

test('AutoMod schema exposes persistent parent and child module switches', () => {
    assert.equal(AutomodGuild.schema.path('enabled').options.default, true);
    assert.equal(AutomodGuild.schema.path('linksEnabled').options.default, true);
    assert.equal(AutomodGuild.schema.path('emojisEnabled').options.default, true);
});

test('AutoMod helpers expose safe server and submodule controls', () => {
    assert.equal(typeof automodHelper.getGuildStatus, 'function');
    assert.equal(typeof automodHelper.setGuildStatus, 'function');
    assert.equal(typeof automodHelper.getGuildSubmoduleStatus, 'function');
    assert.equal(typeof automodHelper.setGuildSubmoduleStatus, 'function');
    assert.equal(typeof automodHelper.buildServerAutomodEmbed, 'function');
    assert.equal(typeof automodHelper.createServerAutomodButtons, 'function');
    assert.equal(typeof automodHelper.buildChannelAutomodEmbed, 'function');
    assert.equal(typeof automodHelper.createChannelAutomodButtons, 'function');
    assert.equal(automodHelper.getGuildSubmoduleStatus('123456789012345678', 'links'), true);
    assert.equal(automodHelper.getGuildSubmoduleStatus('123456789012345678', 'emojis'), true);
});

test('module control center is registered with Manage Server metadata', () => {
    const command = systemCommands.find(item => item.name === 'modules');
    assert.ok(command, 'modules command is registered');
    assert.deepEqual(command.aliases, ['features', 'modulepanel']);
    assert.equal(typeof command.execute, 'function');
    assert.equal(command.data.toJSON().name, 'modules');
    assert.match(command.data.toJSON().description, /Enable or disable/);
});

test('logging policy applies both parent and category switches used by the module panel', () => {
    assert.equal(isLoggingAllowed({ enabled: false, messagesEnabled: true }, 'messages'), false);
    assert.equal(isLoggingAllowed({ enabled: true, messagesEnabled: false }, 'messages'), false);
    assert.equal(isLoggingAllowed({ enabled: true, messagesEnabled: true }, 'messages'), true);
    assert.equal(isLoggingAllowed({ enabled: true, aiEnabled: false }, 'ai'), false);
    assert.equal(isLoggingAllowed({ enabled: true, aiEnabled: true }, 'ai'), true);
});
