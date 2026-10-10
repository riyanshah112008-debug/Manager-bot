const assert = require('assert');

async function runTests() {
    console.log('=========================================');
    console.log('🌟 Running Starry Pic & GIF Perms, Automod & Leveling Test Suite');
    console.log('=========================================\n');

    let passed = 0;
    let failed = 0;

    function it(name, fn) {
        try {
            fn();
            console.log(`  ✅ PASS: ${name}`);
            passed++;
        } catch (err) {
            console.error(`  ❌ FAIL: ${name}`);
            console.error(`     Error: ${err.message}`);
            failed++;
        }
    }

    async function asyncIt(name, fn) {
        try {
            await fn();
            console.log(`  ✅ PASS: ${name}`);
            passed++;
        } catch (err) {
            console.error(`  ❌ FAIL: ${name}`);
            console.error(`     Error: ${err.message}`);
            failed++;
        }
    }

    // 1. MediaPermsEngine Verification
    console.log('📁 1. Media Permissions Engine & In-Memory Logic');
    await asyncIt('Retrieves default media perms settings and persists updates', async () => {
        const { engine: mediaEngine } = require('../src/modules/mediaPermsEngine');
        assert.ok(mediaEngine, 'MediaPermsEngine must be exported');

        const testGuildId = 'test_guild_starry_' + Date.now();
        const settings = await mediaEngine.getGuildSettings(testGuildId);
        assert.strictEqual(settings.enabled, true, 'Media perms must default to enabled');
        assert.strictEqual(settings.boosterPerk, true, 'Booster perk must default to enabled');
        assert.strictEqual(settings.requireOnline, true, 'Require online must default to true');

        await mediaEngine.updateGuildSettings(testGuildId, { inviteUrl: 'discord.gg/starry' });
        const updated = await mediaEngine.getGuildSettings(testGuildId);
        assert.strictEqual(updated.inviteUrl, 'discord.gg/starry');
    });

    await asyncIt('Verifies member eligibility for Server Boosters and Status Supporters', async () => {
        const { engine: mediaEngine } = require('../src/modules/mediaPermsEngine');
        const testGuildId = 'test_starry_eval_' + Date.now();
        await mediaEngine.updateGuildSettings(testGuildId, { inviteUrl: 'discord.gg/starry' });

        const mockGuild = {
            id: testGuildId,
            name: 'Starry Server',
            vanityURLCode: 'starry',
            roles: { cache: new Map() }
        };

        // Case A: Booster is unconditionally eligible
        const booster = {
            id: 'booster_user',
            user: { id: 'booster_user', bot: false },
            guild: mockGuild,
            premiumSince: new Date(),
            roles: { cache: new Map() }
        };
        const resBooster = await mediaEngine.checkMemberEligibility(booster, { status: 'offline', activities: [] });
        assert.strictEqual(resBooster.eligible, true, 'Server Booster must be eligible');
        assert.strictEqual(resBooster.isBooster, true);

        // Case B: Online member with invite in status is eligible
        const statusSupporter = {
            id: 'supporter_user',
            user: { id: 'supporter_user', bot: false },
            guild: mockGuild,
            premiumSince: null,
            roles: { cache: new Map() }
        };
        const onlinePresence = {
            status: 'online',
            activities: [{ type: 4, name: 'Custom Status', state: 'Come join discord.gg/starry' }]
        };
        const resSupporter = await mediaEngine.checkMemberEligibility(statusSupporter, onlinePresence);
        assert.strictEqual(resSupporter.eligible, true, 'Online member with invite must be eligible');
        assert.strictEqual(resSupporter.hasInvite, true);
        assert.strictEqual(resSupporter.isOnline, true);

        // Case C: Offline member with invite is NOT eligible
        const offlinePresence = {
            status: 'offline',
            activities: [{ type: 4, name: 'Custom Status', state: 'Come join discord.gg/starry' }]
        };
        const resOffline = await mediaEngine.checkMemberEligibility(statusSupporter, offlinePresence);
        assert.strictEqual(resOffline.eligible, false, 'Offline member must not be eligible');

        // Case D: Online member without invite is NOT eligible
        const noInvitePresence = {
            status: 'online',
            activities: [{ type: 4, name: 'Custom Status', state: 'Vibing to music' }]
        };
        const resNoInvite = await mediaEngine.checkMemberEligibility(statusSupporter, noInvitePresence);
        assert.strictEqual(resNoInvite.eligible, false, 'Member without invite must not be eligible');
    });

    // 2. AutoMod Server Controls
    console.log('\n📁 2. AutoMod Server-Wide Controls & Helpers');
    it('Validates AutoMod server toggle and status methods', () => {
        const automodHelper = require('../src/utils/automodHelper');
        assert.strictEqual(typeof automodHelper.getGuildStatus, 'function');
        assert.strictEqual(typeof automodHelper.setGuildStatus, 'function');
        assert.strictEqual(typeof automodHelper.createServerAutomodButtons, 'function');
        assert.strictEqual(typeof automodHelper.createChannelAutomodButtons, 'function');

        const testGuildId = 'test_am_guild_' + Date.now();
        automodHelper.setGuildStatus(testGuildId, false);
        assert.strictEqual(automodHelper.getGuildStatus(testGuildId), false);

        automodHelper.setGuildStatus(testGuildId, true);
        assert.strictEqual(automodHelper.getGuildStatus(testGuildId), true);
    });

    // 3. Leveling System Controls
    console.log('\n📁 3. Leveling System State Toggles & Clean Embeds');
    await asyncIt('Validates leveling toggles and channel assignments', async () => {
        const levelingModule = require('../src/modules/leveling');
        assert.strictEqual(typeof levelingModule.toggleLeveling, 'function');
        assert.strictEqual(typeof levelingModule.enableLeveling, 'function');
        assert.strictEqual(typeof levelingModule.disableLeveling, 'function');
        assert.strictEqual(typeof levelingModule.setLevelingChannel, 'function');
        assert.strictEqual(typeof levelingModule.buildRankEmbed, 'function');

        const testGuildId = 'test_lvl_guild_' + Date.now();
        const disabled = await levelingModule.disableLeveling(testGuildId);
        assert.strictEqual(disabled.enabled, false);

        const enabled = await levelingModule.enableLeveling(testGuildId);
        assert.strictEqual(enabled.enabled, true);

        const switched = await levelingModule.toggleLeveling(testGuildId);
        assert.strictEqual(switched.enabled, false);
    });

    // 4. Command Registrations
    console.log('\n📁 4. Command Registrations & Media Perms Bundle');
    it('Validates picperms and leveling command definitions', () => {
        const mediaCommands = require('../src/commands/bundles/mediaCommands');
        const picPermsCmd = mediaCommands.find(c => c.name === 'picperms');
        assert.ok(picPermsCmd, 'picperms command must exist in mediaCommands bundle');
        assert.ok(picPermsCmd.aliases.includes('mediaperms'));
        assert.ok(picPermsCmd.aliases.includes('invitestatus'));
        assert.strictEqual(typeof picPermsCmd.execute, 'function');

        const systemCommands = require('../src/commands/bundles/systemCommands');
        const levelingCmd = systemCommands.find(c => c.name === 'leveling');
        assert.ok(levelingCmd, 'leveling command must exist in systemCommands bundle');
        assert.strictEqual(typeof levelingCmd.execute, 'function');
    });

    console.log('\n=========================================');
    console.log(`🌟 Starry Test Suite Finished: ${passed} Passed, ${failed} Failed`);
    console.log('=========================================\n');

    if (failed > 0) process.exit(1);
    process.exit(0);
}

runTests().catch(err => {
    console.error('Unhandled test suite error:', err);
    process.exit(1);
});
