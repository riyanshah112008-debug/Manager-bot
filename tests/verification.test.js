const assert = require('assert');
const { getPublicUrl } = require('../src/utils/tunnelManager');
const { resolveTargetRole } = require('../src/modules/verification');

console.log('🧪 Starting Starry Verification Engine Test Suite...\n');

// Test 1: getPublicUrl Priority
console.log('▶ Test 1: Testing getPublicUrl resolution priority');
const origVerify = process.env.VERIFY_URL;
const origPublic = process.env.PUBLIC_URL;
const origCustom = process.env.CUSTOM_DOMAIN;
const origRender = process.env.RENDER_EXTERNAL_URL;

try {
    // 1. RENDER_EXTERNAL_URL default
    delete process.env.VERIFY_URL;
    delete process.env.PUBLIC_URL;
    delete process.env.CUSTOM_DOMAIN;
    process.env.RENDER_EXTERNAL_URL = 'https://manager-bot-1-6167.onrender.com';
    assert.strictEqual(getPublicUrl(), 'https://manager-bot-1-6167.onrender.com');
    console.log('  ✅ Render external URL resolved correctly');

    // 2. CUSTOM_DOMAIN overrides Render
    process.env.CUSTOM_DOMAIN = 'https://verify.starrybot.com/';
    assert.strictEqual(getPublicUrl(), 'https://verify.starrybot.com');
    console.log('  ✅ CUSTOM_DOMAIN override resolved correctly (with trailing slash stripped)');

    // 3. PUBLIC_URL overrides CUSTOM_DOMAIN
    process.env.PUBLIC_URL = 'https://cdn.starry.gg';
    assert.strictEqual(getPublicUrl(), 'https://cdn.starry.gg');
    console.log('  ✅ PUBLIC_URL override resolved correctly');

    // 4. VERIFY_URL has highest priority
    process.env.VERIFY_URL = 'https://starry-proxy.workers.dev/';
    assert.strictEqual(getPublicUrl(), 'https://starry-proxy.workers.dev');
    console.log('  ✅ VERIFY_URL highest priority resolved correctly');

} finally {
    if (origVerify) process.env.VERIFY_URL = origVerify; else delete process.env.VERIFY_URL;
    if (origPublic) process.env.PUBLIC_URL = origPublic; else delete process.env.PUBLIC_URL;
    if (origCustom) process.env.CUSTOM_DOMAIN = origCustom; else delete process.env.CUSTOM_DOMAIN;
    if (origRender) process.env.RENDER_EXTERNAL_URL = origRender; else delete process.env.RENDER_EXTERNAL_URL;
}

// Test 2: resolveTargetRole Mock Resolution
console.log('\n▶ Test 2: Testing resolveTargetRole with mock Discord guild');
(async () => {
    const mockVerifiedRole = { id: '998877665544332211', name: 'Verified' };
    const mockMemberRole = { id: '112233445566778899', name: 'Member' };

    const mockGuild = {
        id: '123456789012345678',
        roles: {
            cache: new Map([
                [mockVerifiedRole.id, mockVerifiedRole],
                [mockMemberRole.id, mockMemberRole]
            ])
        }
    };
    mockGuild.roles.cache.find = function(predicate) {
        for (const role of this.values()) {
            if (predicate(role)) return role;
        }
        return null;
    };
    mockGuild.roles.fetch = async (id) => mockGuild.roles.cache.get(id) || null;

    // Test direct ID lookup
    const role1 = await resolveTargetRole(mockGuild, '998877665544332211');
    assert.strictEqual(role1?.id, '998877665544332211');
    console.log('  ✅ Direct snowflake ID lookup resolved');

    // Test 'active' fallback to role named 'Verified'
    const role2 = await resolveTargetRole(mockGuild, 'active');
    assert.strictEqual(role2?.id, '998877665544332211');
    console.log('  ✅ "active" placeholder resolved to "Verified" role');

    // Test fallback when roleId is not found
    const role3 = await resolveTargetRole(mockGuild, 'nonexistent');
    assert.strictEqual(role3?.id, '998877665544332211');
    console.log('  ✅ Unmatched ID fallback resolved to "Verified" role');

    console.log('\n✨ ALL VERIFICATION TESTS PASSED SUCCESSFULLY (100% Pass Rate)!');
    process.exit(0);
})();

