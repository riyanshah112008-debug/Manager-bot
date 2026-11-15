'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const deploy = read('deploy-commands.js');
const leveling = read('src/modules/leveling.js');

test('one /enableleveling command opens the full interactive leveling panel', () => {
  assert.ok(deploy.includes(".setName('enableleveling')"));
  assert.ok(!deploy.includes(".setName('levelpanel')"));
  assert.ok(leveling.includes("interaction.commandName === 'enableleveling'"));
  assert.ok(leveling.includes('getLevelControlPanel(interaction.guildId, client)'));
});

test('AI and code slash commands are explicitly excluded from global deployment', () => {
  for (const command of ['ai', 'vision', 'image', 'summarize', 'codebot', 'code-studio', 'setup-starry', 'ask', 'gemini', 'gpt', 'dev-council', 'catchup', 'pulse', 'spark', 'gazette']) {
    assert.match(deploy, new RegExp("'" + command.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + "'"));
  }
  for (const moduleName of ['catchupModule', 'pulseModule', 'sparkModule', 'gazetteModule', 'codeStudioModule']) {
    assert.doesNotMatch(deploy, new RegExp('const ' + moduleName + ' = safeRequire'));
  }
});

test('leveling panel exposes activity, channel, exclusions, reward and announcement controls', () => {
  for (const button of ['toggle', 'xp', 'channel', 'ignore', 'rewards', 'text', 'media', 'style', 'ping', 'preview', 'reset']) {
    assert.match(leveling, new RegExp("setCustomId\\('lvl_btn_" + button + "'\\)"));
  }
  for (const field of ['messageXpMin', 'messageXpMax', 'messageCooldownSeconds', 'voiceXpPerMinute', 'ignoredChannelIds', 'ignoredRoleIds', 'roleRewards']) {
    assert.match(leveling, new RegExp(field));
  }
});

test('XP awarding reads configured ranges, cooldowns and exclusions', () => {
  assert.match(leveling, /messageXpMin \?\? 15/);
  assert.match(leveling, /messageXpMax \?\? 25/);
  assert.match(leveling, /messageCooldownSeconds \?\? 60/);
  assert.match(leveling, /voiceXpPerMinute \?\? 5/);
  assert.match(leveling, /ignoredChannelIds/);
  assert.match(leveling, /ignoredRoleIds/);
  assert.match(leveling, /Math\.random\(\) \* \(maxXp - minXp \+ 1\)/);
});

test('leveling configuration modals validate user-supplied IDs and numeric ranges', () => {
  assert.match(leveling, /function parseSnowflakeList/);
  assert.match(leveling, /min < 0 \|\| max < min \|\| max > 100/);
  assert.match(leveling, /cooldown < 5 \|\| cooldown > 3600/);
  assert.match(leveling, /rewards\.length > 20/);
  assert.match(leveling, /interaction\.member\?\.permissions\?\.has\(PermissionFlagsBits\.ManageGuild\)/);
});


test('activation never posts a level-up embed or setup test to public channels', () => {
  assert.doesNotMatch(leveling, /Leveling System Setup Test/);
  assert.ok(leveling.includes('Leveling enabled.'));
  assert.ok(leveling.includes('Reopen this control panel anytime with `/enableleveling`.'));
  assert.ok(!leveling.includes('/levelpanel'), 'legacy /levelpanel guidance must be removed');
  assert.match(leveling, /const payload = \{ content: pingMsg, allowedMentions:/);
});

test('level-up announcements are atomically claimed to prevent duplicate spam', () => {
  assert.match(leveling, /async function claimLevelUp/);
  assert.match(leveling, /level: \{ \$lt: newLevel \}/);
  assert.match(leveling, /if \(!claimed\) return/);
  assert.match(leveling, /if \(claimed\) \{/);
});


test('dashboard exposes the same XP, exclusion, announcement and reward settings', () => {
  const dashboard = read('public/workspace.js');
  const api = read('src/modules/dashboardServer.js');
  for (const field of ['messageXpMin','messageXpMax','messageCooldownSeconds','voiceXpPerMinute','ignoredChannelIds','ignoredRoleIds','roleRewards']) {
    assert.ok(api.includes(field), 'dashboard API missing ' + field);
  }
  for (const field of ['messageXpMin','messageXpMax','messageCooldownSeconds','voiceXpPerMinute','ignoredLevelChannels','ignoredLevelRoles','levelPingContent']) {
    assert.ok(dashboard.includes(field), 'dashboard UI missing ' + field);
  }
  assert.ok(dashboard.includes('levelThumbnail:d.settings?.thumbnail||"avatar"'), 'saved thumbnail selection must load');
  assert.ok(api.includes('isValidationError = /^Invalid /'), 'invalid numeric settings should return a client validation response');
});
