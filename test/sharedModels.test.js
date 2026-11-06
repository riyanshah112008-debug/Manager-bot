'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');

const models = {
    ChestGuild: require('../src/models/ChestGuild'),
    WelcomeSettings: require('../src/models/WelcomeSettings'),
    GoodbyeSettings: require('../src/models/GoodbyeSettings'),
    MasterSecurity: require('../src/models/MasterSecurity'),
    PolicyVote: require('../src/models/PolicyVote')
};

test('canonical models register once with their expected names', () => {
    for (const [name, model] of Object.entries(models)) {
        assert.equal(model.modelName, name);
        assert.equal(mongoose.models[name], model);
    }
});

test('guild-scoped models retain their unique guild keys', () => {
    for (const name of ['ChestGuild', 'WelcomeSettings', 'GoodbyeSettings', 'MasterSecurity']) {
        const path = models[name].schema.path('guildId');
        assert.ok(path, name + ' must define guildId');
        assert.equal(path.options.unique, true, name + '.guildId must remain unique');
    }
});

test('welcome and goodbye models expose the full configurable fields', () => {
    for (const name of ['WelcomeSettings', 'GoodbyeSettings']) {
        const schema = models[name].schema;
        for (const field of ['channelId', 'title', 'description', 'color', 'image', 'thumbnail', 'footer', 'pingContent']) {
            assert.ok(schema.path(field), name + ' must define ' + field);
        }
    }
});

test('master security model retains its security configuration fields', () => {
    const schema = models.MasterSecurity.schema;
    for (const field of ['autoKick', 'autoBan', 'ownerBypass', 'modules', 'userInfractions']) {
        assert.ok(schema.path(field), 'MasterSecurity must define ' + field);
    }
});

test('policy vote model retains its vote fields', () => {
    const schema = models.PolicyVote.schema;
    for (const field of ['guildId', 'messageId', 'title', 'description', 'yesVotes', 'noVotes', 'createdAt']) {
        assert.ok(schema.path(field), 'PolicyVote must define ' + field);
    }
});
