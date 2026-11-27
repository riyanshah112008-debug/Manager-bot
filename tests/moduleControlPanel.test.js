'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const schema = fs.readFileSync(require.resolve('../src/models/AutomodSchema'), 'utf8');
const helper = fs.readFileSync(require.resolve('../src/utils/automodHelper'), 'utf8');
const automod = fs.readFileSync(require.resolve('../src/modules/automod'), 'utf8');
const commands = fs.readFileSync(require.resolve('../src/commands/bundles/systemCommands'), 'utf8');

test('AutoMod persists guild-wide link and emoji submodule settings', () => {
    assert.match(schema, /linksEnabled:\s*\{\s*type:\s*Boolean,\s*default:\s*true\s*\}/);
    assert.match(schema, /emojisEnabled:\s*\{\s*type:\s*Boolean,\s*default:\s*true\s*\}/);
    assert.match(helper, /async function setGuildSubmoduleStatus/);
    assert.match(helper, /AutomodGuild\.findOneAndUpdate/);
    assert.match(helper, /db\.updateGuildSettings\(guildId, \{ automod \}\)/);
    assert.match(helper, /if \(!persisted\) throw new Error/);
});

test('AutoMod runtime checks the saved parent and child module switches', () => {
    assert.match(automod, /if \(!isServerEnabled\) return/);
    assert.match(automod, /getGuildSubmoduleStatus\(message\.guild\.id, 'links'\)/);
    assert.match(automod, /getGuildSubmoduleStatus\(message\.guild\.id, 'emojis'\)/);
});

test('modules command exposes real AutoMod and Logging parent/submodule controls', () => {
    assert.match(commands, /name: 'modules'/);
    assert.match(commands, /aliases: \['features', 'modulepanel'\]/);
    for (const id of [
        'modules_automod', 'modules_logging', 'modules_links', 'modules_emojis',
        'modules_log_moderation', 'modules_log_messages', 'modules_log_members',
        'modules_log_voice', 'modules_log_server', 'modules_log_ai'
    ]) assert.ok(commands.includes(id), id);
    assert.match(commands, /PermissionFlagsBits\.ManageGuild/);
    assert.match(commands, /interaction\.update\(await render\(\)\)/);
    assert.match(commands, /guildId: \{ \$eq: guildId \}/);
});
