'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const server = fs.readFileSync('src/modules/dashboardServer.js', 'utf8');
const workspace = fs.readFileSync('public/workspace.js', 'utf8');
const helper = fs.readFileSync('src/utils/automodHelper.js', 'utf8');

test('AutoMod dashboard routes require live guild-admin authorization', () => {
    assert.match(server, /app\.get\('\/api\/guild\/:id\/automod',\s*requireGuildAdmin/);
    assert.match(server, /app\.patch\('\/api\/guild\/:id\/automod',\s*actionLimiter,\s*requireGuildAdmin/);
});

test('AutoMod dashboard rejects unknown fields and non-boolean switches', () => {
    assert.match(server, /const allowed = new Set\(\['enabled', 'channelId', 'linksActive', 'emojisActive'\]\)/);
    assert.match(server, /typeof body\.enabled !== 'boolean'/);
    assert.match(server, /typeof body\[key\] !== 'boolean'/);
});

test('AutoMod channel updates are restricted to text channels in the authorized guild', () => {
    assert.match(server, /req\.guild\.channels\.cache\.get\(channelId\)/);
    assert.match(server, /!channel\.isTextBased\(\)/);
    assert.match(server, /AutomodChannel\.findOne\(\{\s*channelId,\s*guildId: req\.guild\.id\s*\}\)/);
});

test('AutoMod writes confirm persisted server and channel settings before success', () => {
    assert.match(server, /stored\.enabled !== body\.enabled/);
    assert.match(server, /stored\?\.links !== expectedLinks/);
    assert.match(server, /stored\?\.emojis !== expectedEmojis/);
    assert.match(server, /mongoose\.connection\.readyState !== 1/);
});

test('AutoMod dashboard exposes only live link and emoji controls and calls its API', () => {
    assert.match(workspace, /function renderAutomod\(\)[\s\S]*?automodEnabled[\s\S]*?automodLinks[\s\S]*?automodEmojis/);
    assert.match(workspace, /request\("\/api\/guild\/"\+guildId\+"\/automod"\)/);
    assert.match(workspace, /method:"PATCH"/);
    assert.match(workspace, /if\(page==="automod"\)loadAutomod\(\)/);
});

test('AutoMod helper preserves the inverse storage semantics used by the dashboard', () => {
    assert.match(helper, /linksActive: !raw\.links/);
    assert.match(helper, /emojisActive: !raw\.emojis/);
    assert.match(helper, /newLinks = !shouldEnable/);
    assert.match(helper, /newEmojis = !shouldEnable/);
});
