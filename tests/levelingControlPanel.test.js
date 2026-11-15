'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const deploy = read('deploy-commands.js');
const leveling = read('src/modules/leveling.js');

test('one /leveling command replaces the old one-off enable command', () => {
  assert.match(deploy, /\.setName\('leveling'\)/);
  assert.doesNotMatch(deploy, /\.setName\('enableleveling'\)/);
  assert.match(leveling, /interaction\.commandName === 'customizelevels' \|\| interaction\.commandName === 'leveling'/);
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
