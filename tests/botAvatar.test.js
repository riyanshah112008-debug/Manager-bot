const assert = require('assert');
const { PermissionFlagsBits } = require('discord.js');
const botAvatarHelper = require('../src/utils/botAvatarHelper');

async function runBotAvatarTests() {
    console.log('🧪 Starting Bot Server Avatar Engine Test Suite...\n');

    // Test 1: Buffer to Data URI resolution
    console.log('▶ Test 1: Testing Buffer to Data URI resolution...');
    const dummyBuffer = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]); // PNG magic bytes
    const dataUri = await botAvatarHelper.resolveImageToDataUri(dummyBuffer, 'image/png');
    assert(dataUri.startsWith('data:image/png;base64,'), 'Data URI does not have correct png prefix');
    console.log('  ✅ Buffer successfully converted to Base64 Data URI');

    // Test 2: Existing Data URI passthrough
    console.log('\n▶ Test 2: Testing Data URI passthrough...');
    const existingUri = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/';
    const passedThrough = await botAvatarHelper.resolveImageToDataUri(existingUri);
    assert.strictEqual(passedThrough, existingUri, 'Data URI was not passed through untouched');
    console.log('  ✅ Existing Data URI passed through cleanly');

    // Test 3: Oversized image rejection (> 10MB)
    console.log('\n▶ Test 3: Testing oversized buffer rejection (> 10MB)...');
    const oversizedBuffer = Buffer.alloc(10 * 1024 * 1024 + 1024);
    let rejected = false;
    try {
        await botAvatarHelper.resolveImageToDataUri(oversizedBuffer);
    } catch (e) {
        rejected = true;
        assert(e.message.includes('exceeds the 10MB Discord limit'), 'Unexpected error message for oversized image');
    }
    assert(rejected, 'Oversized image was not rejected');
    console.log('  ✅ 10MB size limit enforcement verified');

    // Test 4: Invalid URL rejection
    console.log('\n▶ Test 4: Testing invalid URL rejection...');
    let urlRejected = false;
    try {
        await botAvatarHelper.resolveImageToDataUri('not-a-valid-url');
    } catch (e) {
        urlRejected = true;
        assert(e.message.includes('Invalid image URL'), 'Unexpected error message for invalid URL');
    }
    assert(urlRejected, 'Invalid URL string was not rejected');
    console.log('  ✅ Malformed image URL rejected with friendly message');

    // Test 5: Context Image Extraction Logic
    console.log('\n▶ Test 5: Testing context extraction (Slash & Prefix)...');
    // Case 5a: Slash with attachment
    const mockSlashContext = {
        isSlash: true,
        interaction: {
            options: {
                getAttachment: (name) => name === 'image' ? { url: 'https://example.com/bot.png' } : null,
                getString: () => null
            }
        },
        args: []
    };
    const extractedSlash = await botAvatarHelper.extractImageFromContext(mockSlashContext);
    assert.strictEqual(extractedSlash.imageUrl, 'https://example.com/bot.png');
    assert.strictEqual(extractedSlash.isReset, false);
    assert.strictEqual(extractedSlash.isView, false);

    // Case 5b: Prefix with 'reset'
    const mockPrefixResetContext = {
        isSlash: false,
        message: { attachments: new Map(), reference: null },
        args: ['reset']
    };
    const extractedReset = await botAvatarHelper.extractImageFromContext(mockPrefixResetContext);
    assert.strictEqual(extractedReset.isReset, true);
    assert.strictEqual(extractedReset.imageUrl, null);

    // Case 5c: Prefix with URL
    const mockPrefixUrlContext = {
        isSlash: false,
        message: { attachments: new Map(), reference: null },
        args: ['https://cdn.example.com/cool-bot-pfp.jpg']
    };
    const extractedUrl = await botAvatarHelper.extractImageFromContext(mockPrefixUrlContext);
    assert.strictEqual(extractedUrl.imageUrl, 'https://cdn.example.com/cool-bot-pfp.jpg');
    assert.strictEqual(extractedUrl.isReset, false);

    // Case 5d: View with no args
    const mockEmptyContext = {
        isSlash: false,
        message: { attachments: new Map(), reference: null },
        args: []
    };
    const extractedEmpty = await botAvatarHelper.extractImageFromContext(mockEmptyContext);
    assert.strictEqual(extractedEmpty.isView, true);
    console.log('  ✅ Context extraction for attachments, URLs, resets, and views passed');

    // Test 6: Permissions Guard
    console.log('\n▶ Test 6: Testing permission checks...');
    const guildOwner = { id: 'user_owner' };
    const dummyGuild = { id: 'g_123', ownerId: 'user_owner' };
    assert(botAvatarHelper.canManageBotAvatar(null, guildOwner, dummyGuild), 'Guild owner was denied permission');

    const adminMember = { permissions: { has: (p) => p === PermissionFlagsBits.Administrator || p === PermissionFlagsBits.ManageGuild } };
    assert(botAvatarHelper.canManageBotAvatar(adminMember, { id: 'user_admin' }, dummyGuild), 'Admin was denied permission');

    const regularMember = { permissions: { has: () => false } };
    assert(!botAvatarHelper.canManageBotAvatar(regularMember, { id: 'user_regular' }, dummyGuild), 'Regular user was granted permission inappropriately');
    console.log('  ✅ Permission checks correctly enforce Manage Server / Administrator / Owner');

    // Test 7: Embed Builders
    console.log('\n▶ Test 7: Testing Embed & Component Builders...');
    const dummyClient = { user: { username: 'StarryBot', displayAvatarURL: () => 'https://cdn.discordapp.com/embed/avatars/0.png' } };
    const dummyUser = { id: 'u_1', tag: 'User#1234', username: 'User' };
    const successPayload = botAvatarHelper.buildAvatarSuccessEmbed(dummyGuild, dummyClient, 'https://example.com/new.png', dummyUser);
    assert(successPayload.embeds && successPayload.embeds.length === 1, 'Success embed missing');
    assert(successPayload.components && successPayload.components.length === 1, 'Success button row missing');

    const resetPayload = botAvatarHelper.buildAvatarResetEmbed(dummyGuild, dummyClient, 'https://cdn.discordapp.com/embed/avatars/0.png', dummyUser);
    assert(resetPayload.embeds && resetPayload.embeds.length === 1, 'Reset embed missing');

    const viewPayload = botAvatarHelper.buildCurrentAvatarEmbed({ ...dummyGuild, name: 'Test Guild', members: { me: { avatar: 'hash', displayAvatarURL: () => 'https://cdn.discordapp.com/guilds/me.png' } } }, dummyClient, dummyUser);
    assert(viewPayload.embeds && viewPayload.embeds.length === 1, 'View embed missing');
    console.log('  ✅ Embeds and ActionRows verified');

    console.log('\n✨ ALL BOT AVATAR ENGINE TESTS PASSED (100% Pass Rate)!');
    process.exit(0);
}

runBotAvatarTests().catch((err) => {
    console.error('❌ Test Failure:', err);
    process.exit(1);
});
