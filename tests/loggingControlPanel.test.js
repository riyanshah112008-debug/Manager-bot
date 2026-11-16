const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const model = fs.readFileSync(require.resolve('../src/models/ServerSettings'), 'utf8');
const starry = fs.readFileSync(require.resolve('../src/modules/starry'), 'utf8');
const logs = fs.readFileSync(require.resolve('../src/modules/logs'), 'utf8');
const commands = fs.readFileSync(require.resolve('../src/commands/bundles/systemCommands'), 'utf8');
const aiEngine = fs.readFileSync(require.resolve('../src/utils/aiEngine'), 'utf8');

test('ServerSettings persists master, category, and dedicated AI logging controls', () => {
    for (const field of ['enabled', 'aiEnabled', 'moderationEnabled', 'messagesEnabled', 'membersEnabled', 'voiceEnabled', 'serverEnabled', 'aiLogChannel']) {
        assert.ok(model.includes(field + ':'), `Missing logging setting: ${field}`);
    }
});

test('central log resolver checks master/category switches before returning a channel', () => {
    const source = starry;
    assert.match(source, /logging\.enabled === false/);
    assert.match(source, /logging\[enabledField\] === false/);
    assert.match(source, /ai: 'aiEnabled'/);
    assert.match(source, /ai: 'aiLogChannel'/);
    assert.match(source, /type === 'ai' \? null/);
});

test('legacy audit logger cannot bypass an intentional master logging disable', () => {
    const source = logs;
    assert.match(source, /Never fall through to the legacy setlogs channel/);
    assert.match(source, /return await client\.getLogChannel\(guild, type\)/);
});

test('unified logging command exposes master-off, category controls, and channel routing', () => {
    const source = commands;
    assert.match(source, /setName\('logging'\)/);
    assert.match(source, /logging_master_off/);
    assert.match(source, /logging_master_on/);
    assert.match(source, /logging_toggle_/);
    assert.match(source, /ChannelSelectMenuBuilder/);
    assert.match(source, /aiLogChannel/);
    assert.match(source, /invalidateLogSettings/);
});

test('AI activity telemetry is privacy-safe and uses the dedicated AI route', () => {
    const source = starry;
    assert.match(source, /client\.logAIActivity = async/);
    assert.match(source, /client\.getLogChannel\(guild, 'ai'\)/);
    assert.match(source, /Prompt and response content are not stored/);
});

test('AI response pipeline emits success and failure telemetry without prompt content', () => {
    const source = aiEngine;
    assert.match(source, /ctx\.client\?\.logAIActivity/);
    assert.match(source, /status: 'completed'/);
    assert.match(source, /status: 'failed'/);
    assert.match(source, /Never send prompts, attachments, or AI response text/);
});
