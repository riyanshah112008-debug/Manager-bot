const assert = require('assert');
const config = require('../src/config');
const { CommandRegistry } = require('../src/modules/commandHandler');
const { EventEmitter } = require('events');

console.log('🧪 Starting Comprehensive Starry Owner-Only Prefix Policy Test Suite...\n');

// -------------------------------------------------------------
// Test 1: config.isBotOwner Verification (Static & Dynamic Env)
// -------------------------------------------------------------
console.log('▶ Test 1: Verifying config.isBotOwner & config.BOT_OWNERS logic');
const defaultOwner1 = '1465049039153135639';
const defaultOwner2 = '1257676837249617971';
const nonOwner = '999999999999999999';

assert.strictEqual(config.isBotOwner(defaultOwner1), true, 'Default owner 1 should be recognized as bot owner');
assert.strictEqual(config.isBotOwner(defaultOwner2), true, 'Default owner 2 should be recognized as bot owner');
assert.strictEqual(config.isBotOwner(nonOwner), false, 'Regular user should NOT be recognized as bot owner');
assert.strictEqual(config.isBotOwner(null), false, 'Null user should NOT be recognized as bot owner');
assert.strictEqual(config.isBotOwner(''), false, 'Empty user ID should NOT be recognized as bot owner');

// Dynamic OWNER_ID verification
process.env.OWNER_ID = '888888888888888888';
assert.strictEqual(config.isBotOwner('888888888888888888'), true, 'Dynamically added OWNER_ID should be recognized');
assert.strictEqual(config.isBotOwner(nonOwner), false, 'Regular user should still be false');
delete process.env.OWNER_ID;

// Dynamic OWNER_IDS verification (comma-separated)
process.env.OWNER_IDS = '777777777777777777, 666666666666666666';
assert.strictEqual(config.isBotOwner('777777777777777777'), true, 'OWNER_IDS first entry should be recognized');
assert.strictEqual(config.isBotOwner('666666666666666666'), true, 'OWNER_IDS second entry should be recognized');
assert.ok(config.BOT_OWNERS.includes('777777777777777777'), 'config.BOT_OWNERS must include OWNER_IDS entry');
delete process.env.OWNER_IDS;

// Dynamic Discord Application Owner (User)
const mockAppClientUser = {
    application: {
        owner: { id: '555555555555555555' }
    }
};
assert.strictEqual(config.isBotOwner('555555555555555555', mockAppClientUser), true, 'Discord Application Owner User should be recognized');

// Dynamic Discord Application Owner (Team with Collection)
const mockAppClientTeam = {
    application: {
        owner: {
            members: new Map([
                ['444444444444444444', { id: '444444444444444444' }],
                ['333333333333333333', { id: '333333333333333333' }]
            ])
        }
    }
};
assert.strictEqual(config.isBotOwner('444444444444444444', mockAppClientTeam), true, 'Discord Team Member 1 should be recognized');
assert.strictEqual(config.isBotOwner('333333333333333333', mockAppClientTeam), true, 'Discord Team Member 2 should be recognized');
assert.strictEqual(config.isBotOwner(nonOwner, mockAppClientTeam), false, 'Non-team member should NOT be recognized');
console.log('  ✅ config.isBotOwner and BOT_OWNERS accurately detect static, env, and Discord application owners');

// -------------------------------------------------------------
// Test 2: Unified Command Dispatcher Prefix Policy
// -------------------------------------------------------------
console.log('\n▶ Test 2: Verifying prefix dispatching (Owner Allowed vs Non-Owner Blocked & Guided)');
(async () => {
    const registry = new CommandRegistry();
    let executedCount = 0;

    // Register test commands
    registry.commands.set('testcmd', {
        name: 'testcmd',
        category: 'Utility',
        description: 'Test command for owner policy',
        async execute(ctx) {
            executedCount++;
        }
    });

    registry.commands.set('ask', {
        name: 'ask',
        category: 'AI',
        description: 'Starry AI Ask Command',
        async execute(ctx) {
            executedCount++;
        }
    });

    const mockClient = new EventEmitter();
    mockClient.isPrimary = true;
    mockClient.user = { id: '111111111111111111', displayAvatarURL: () => 'https://example.com/avatar.png' };
    mockClient.ws = { ping: 25 };

    registry.registerPrefixDispatcher(mockClient);

    // Case A: Non-Owner tries comma prefix (,testcmd)
    let noticeSent = false;
    let noticeText = '';
    const nonOwnerCommaMessage = {
        id: 'msg_non_owner_comma',
        content: ',testcmd arg1',
        author: { id: nonOwner, tag: 'RegularUser#0001', bot: false },
        guild: { id: 'guild_123', name: 'Test Guild' },
        member: { permissions: { has: () => true } },
        channel: { id: 'channel_123', isDMBased: () => false },
        reply: async (payload) => {
            noticeSent = true;
            if (payload.embeds && payload.embeds[0]) {
                noticeText = payload.embeds[0].data?.description || '';
            }
            return { delete: async () => {} };
        }
    };

    mockClient.emit('messageCreate', nonOwnerCommaMessage);
    await new Promise(r => setTimeout(r, 60));

    assert.strictEqual(executedCount, 0, 'Non-owner must NOT execute comma prefix command');
    assert.strictEqual(noticeSent, true, 'Non-owner must receive slash command migration notice');
    assert.ok(noticeText.includes('Slash Commands'), 'Migration notice must reference Slash Commands');
    assert.ok(noticeText.includes('Bot Owners'), 'Migration notice must state prefix commands are owner-only');
    console.log('  ✅ Non-owner comma prefix (,testcmd) was blocked and migration notice was delivered');

    // Case B: Non-Owner tries dot prefix (.testcmd)
    noticeSent = false;
    noticeText = '';
    const nonOwnerDotMessage = {
        id: 'msg_non_owner_dot',
        content: '.testcmd arg1',
        author: { id: '999999999999999998', tag: 'RegularUser2#0002', bot: false }, // different author to avoid user cooldown
        guild: { id: 'guild_123', name: 'Test Guild' },
        member: { permissions: { has: () => true } },
        channel: { id: 'channel_123', isDMBased: () => false },
        reply: async (payload) => {
            noticeSent = true;
            if (payload.embeds && payload.embeds[0]) {
                noticeText = payload.embeds[0].data?.description || '';
            }
            return { delete: async () => {} };
        }
    };

    mockClient.emit('messageCreate', nonOwnerDotMessage);
    await new Promise(r => setTimeout(r, 60));

    assert.strictEqual(executedCount, 0, 'Non-owner must NOT execute dot prefix command');
    assert.strictEqual(noticeSent, true, 'Non-owner must receive slash migration notice for dot prefix');
    console.log('  ✅ Non-owner dot prefix (.testcmd) was blocked and migration notice was delivered');

    // Case C: Bot Owner runs comma prefix (,testcmd)
    noticeSent = false;
    executedCount = 0;
    const ownerCommaMessage = {
        id: 'msg_owner_comma',
        content: ',testcmd arg1',
        author: { id: defaultOwner1, tag: 'StarryOwner#0001', bot: false },
        guild: { id: 'guild_123', name: 'Test Guild' },
        member: { permissions: { has: () => true } },
        channel: { id: 'channel_123', isDMBased: () => false },
        reply: async () => ({ delete: async () => {} })
    };

    mockClient.emit('messageCreate', ownerCommaMessage);
    await new Promise(r => setTimeout(r, 60));

    assert.strictEqual(executedCount, 1, 'Bot owner MUST be able to execute comma prefix command');
    assert.strictEqual(noticeSent, false, 'Bot owner must NOT receive migration notice');
    console.log('  ✅ Bot owner executed comma prefix (,testcmd) with full unrestricted access');

    // Case D: Bot Owner runs dot prefix (.testcmd)
    executedCount = 0;
    const ownerDotMessage = {
        id: 'msg_owner_dot',
        content: '.testcmd arg1',
        author: { id: defaultOwner2, tag: 'StarryOwner2#0002', bot: false },
        guild: { id: 'guild_123', name: 'Test Guild' },
        member: { permissions: { has: () => true } },
        channel: { id: 'channel_123', isDMBased: () => false },
        reply: async () => ({ delete: async () => {} })
    };

    mockClient.emit('messageCreate', ownerDotMessage);
    await new Promise(r => setTimeout(r, 60));

    assert.strictEqual(executedCount, 1, 'Bot owner MUST be able to execute dot prefix command');
    console.log('  ✅ Bot owner executed dot prefix (.testcmd) with full unrestricted access');

    // Case E: Regular user mentions bot (<@111111111111111111> ask what is 2+2)
    // Mentions are NOT prefix commands and must NOT be blocked by owner-only prefix policy!
    executedCount = 0;
    noticeSent = false;
    const mentionMessage = {
        id: 'msg_mention_regular',
        content: '<@111111111111111111> ask what is 2+2',
        author: { id: nonOwner, tag: 'RegularUser#0001', bot: false },
        guild: { id: 'guild_123', name: 'Test Guild' },
        member: { permissions: { has: () => true } },
        channel: { id: 'channel_123', isDMBased: () => false },
        reply: async () => ({ delete: async () => {} })
    };

    mockClient.emit('messageCreate', mentionMessage);
    await new Promise(r => setTimeout(r, 60));

    assert.strictEqual(executedCount, 1, 'Mentioning bot must execute successfully for regular users');
    assert.strictEqual(noticeSent, false, 'Mentioning bot must NOT trigger prefix owner block notice');
    console.log('  ✅ Regular user mentioning bot (<@BOT_ID> ask ...) executed without prefix block');

    // Case F: Regular user in DMs talking to Starry AI naturally (without prefix)
    executedCount = 0;
    noticeSent = false;
    const dmMessage = {
        id: 'msg_dm_natural',
        content: 'Hello Starry!',
        author: { id: nonOwner, tag: 'RegularUser#0001', bot: false },
        guild: null,
        channel: { id: 'dm_123', isDMBased: () => true },
        reply: async () => ({ delete: async () => {} })
    };

    mockClient.emit('messageCreate', dmMessage);
    await new Promise(r => setTimeout(r, 60));

    assert.strictEqual(executedCount, 1, 'DM natural conversation with Starry AI must execute for regular users');
    assert.strictEqual(noticeSent, false, 'DM natural conversation must NOT trigger prefix owner block notice');
    console.log('  ✅ Regular user natural AI conversation in DMs executed without prefix block');

    console.log('\n✨ ALL OWNER-ONLY PREFIX POLICY TESTS PASSED (100% Pass Rate)!');
    process.exit(0);
})();
