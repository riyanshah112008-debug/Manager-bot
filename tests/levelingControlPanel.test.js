'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const deploy = fs.readFileSync('deploy-commands.js', 'utf8');
const leveling = fs.readFileSync('src/modules/leveling.js', 'utf8');
const dashboard = fs.readFileSync('public/workspace.js', 'utf8');
const api = fs.readFileSync('src/modules/dashboardServer.js', 'utf8');

const includes = (source, fragment, message) => assert.ok(source.includes(fragment), message || `Expected source to include: ${fragment}`);

test('one /leveling command opens the full interactive leveling panel', () => {
  includes(deploy, ".setName('leveling')");
  assert.ok(!deploy.includes(".setName('levelpanel')"));
  includes(leveling, "interaction.commandName === 'leveling'");
  includes(leveling, 'getLevelControlPanel(interaction.guildId, client)');
});

test('AI and code slash commands are explicitly excluded from global deployment', () => {
  for (const command of ['ai', 'vision', 'image', 'summarize', 'codebot', 'code-studio', 'setup-starry', 'ask', 'gemini', 'gpt', 'dev-council', 'catchup', 'pulse', 'spark', 'gazette']) {
    includes(deploy, `'${command}'`, `AI/code command exclusion missing: ${command}`);
  }
  for (const moduleName of ['catchupModule', 'pulseModule', 'sparkModule', 'gazetteModule', 'codeStudioModule']) {
    assert.ok(!deploy.includes(`const ${moduleName} = safeRequire`), `unexpected module registration: ${moduleName}`);
  }
});

test('leveling panel exposes activity, channel, exclusions, reward and announcement controls', () => {
  for (const button of ['toggle', 'xp', 'channel', 'ignore', 'rewards', 'text', 'media', 'style', 'ping', 'preview', 'reset']) {
    includes(leveling, `setCustomId('lvl_btn_${button}')`);
  }
  for (const field of ['messageXpMin', 'messageXpMax', 'messageCooldownSeconds', 'voiceXpPerMinute', 'ignoredChannelIds', 'ignoredRoleIds', 'roleRewards']) {
    includes(leveling, field);
  }
});

test('XP awarding reads configured ranges, cooldowns and exclusions', () => {
  includes(leveling, 'messageXpMin ?? 15');
  includes(leveling, 'messageXpMax ?? 25');
  includes(leveling, 'messageCooldownSeconds ?? 60');
  includes(leveling, 'voiceXpPerMinute ?? 5');
  includes(leveling, 'ignoredChannelIds');
  includes(leveling, 'ignoredRoleIds');
  includes(leveling, 'randomInt(minXp, maxXp + 1)');
  assert.ok(!leveling.includes('Math.random()'), 'XP awards must not use a weak random generator');
});

test('leveling configuration modals validate user-supplied IDs and numeric ranges', () => {
  includes(leveling, 'function parseSnowflakeList');
  includes(leveling, 'min < 0 || max < min || max > 100');
  includes(leveling, 'cooldown < 5 || cooldown > 3600');
  includes(leveling, 'rewards.length > 20');
  includes(leveling, 'interaction.member?.permissions?.has(PermissionFlagsBits.ManageGuild)');
});

test('activation never posts a level-up embed or setup test to public channels', () => {
  assert.ok(!leveling.includes('Leveling System Setup Test'));
  includes(leveling, 'Leveling enabled.');
  includes(leveling, 'Reopen this control panel anytime with `/leveling`.');
  assert.ok(!leveling.includes('/levelpanel'), 'legacy /levelpanel guidance must be removed');
  includes(leveling, 'const payload = { content: pingMsg, allowedMentions:');
});

test('custom level-up embeds are opt-in and configurable in Discord and dashboard', () => {
  includes(leveling, 'embedEnabled: { type: Boolean, default: false }');
  includes(leveling, "setCustomId('lvl_btn_embed')");
  includes(leveling, "settings.embedEnabled === true ? 'Disable Embeds' : 'Enable Custom Embeds'");
  includes(leveling, 'if (guildSettings.embedEnabled === true) payload.embeds = [buildLevelUpEmbed');
  includes(leveling, 'if (latest.embedEnabled === true) previewPayload.embeds = [previewEmbed]');
  includes(leveling, 'const userLabel = mentionUser ?');
  includes(leveling, 'if (guildSettings.embedEnabled === true) payload.embeds');
  assert.ok(!leveling.includes("✨ <@{user}> just hit **Level {level}**!"), 'default template must not nest a mention');
  includes(dashboard, 'levelEmbedEnabled');
  includes(dashboard, 'embedEnabled:$("#levelEmbedEnabled").checked');
  includes(api, "if (typeof body.embedEnabled === 'boolean') updates.embedEnabled = body.embedEnabled;");
});

test('level-up announcements are atomically claimed to prevent duplicate spam', () => {
  includes(leveling, 'async function claimLevelUp');
  includes(leveling, 'level: { $lt: newLevel }');
  includes(leveling, 'if (!claimed) return');
  includes(leveling, 'if (claimed) {');
});

test('dashboard exposes the same XP, exclusion, announcement and reward settings', () => {
  for (const field of ['messageXpMin','messageXpMax','messageCooldownSeconds','voiceXpPerMinute','ignoredChannelIds','ignoredRoleIds','roleRewards']) {
    includes(api, field, `dashboard API missing ${field}`);
  }
  for (const field of ['messageXpMin','messageXpMax','messageCooldownSeconds','voiceXpPerMinute','ignoredLevelChannels','ignoredLevelRoles','levelPingContent']) {
    includes(dashboard, field, `dashboard UI missing ${field}`);
  }
  includes(dashboard, 'levelThumbnail:d.settings?.thumbnail||"avatar"', 'saved thumbnail selection must load');
  includes(api, 'isValidationError = /^Invalid /', 'invalid numeric settings should return a client validation response');
});
