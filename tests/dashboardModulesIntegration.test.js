'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

function read(path) {
    return fs.readFileSync(path, 'utf8');
}

test('Security, AutoMod, giveaway and notification dashboard pages call live APIs', () => {
    const dashboard = read('src/modules/dashboardServer.js');
    const workspace = read('public/workspace.js');

    for (const route of [
        "app.get('/api/guild/:id/automod'",
        "app.post('/api/guild/:id/automod'",
        "app.get('/api/guild/:id/giveaways'",
        "app.post('/api/guild/:id/giveaways'",
        "app.delete('/api/guild/:id/giveaways/:messageId'"
    ]) {
        assert.ok(dashboard.includes(route), 'Expected live dashboard route: ' + route);
    }

    for (const renderer of [
        'function renderSecurity()',
        'function renderAutomod()',
        'function renderGiveaways()',
        'function renderNotifications()',
        'function renderSpotify()'
    ]) {
        assert.ok(workspace.includes(renderer), 'Expected active dashboard renderer: ' + renderer);
    }

    assert.ok(workspace.includes('/api/guild/"+guildId+"/automod'));
    assert.ok(workspace.includes('/api/guild/"+guildId+"/giveaways'));
    assert.ok(workspace.includes('/api/spotify/connect'));
});

test('Anti-Nuke monitor and AutoMod dashboard share the existing runtime', () => {
    const automod = read('src/modules/automod.js');
    const antiNuke = read('src/modules/antiNuke.js');
    const index = read('src/index.js');

    assert.ok(automod.includes('client.automod = automodHelper'));
    assert.ok(antiNuke.includes('Events.ChannelDelete'));
    assert.ok(antiNuke.includes('Events.GuildRoleDelete'));
    assert.ok(antiNuke.includes('Events.GuildBanAdd'));
    assert.ok(antiNuke.includes('Events.WebhooksUpdate'));
    assert.ok(index.includes("require('./modules/antiNuke.js')(client, app)"));
    assert.ok(index.includes("require('./modules/notifications.js')(client, app)"));
});

test('Notification destinations and Spotify OAuth are bound to validated server-side state', () => {
    const schema = read('src/models/ServerSettings.js');
    const notifications = read('src/modules/notifications.js');
    const oauth = read('src/modules/dashboardServer.js');
    const spotify = read('src/modules/spotifyManager.js');
    const tokenVault = read('src/utils/spotifyTokenVault.js');

    assert.ok(schema.includes('notifications: {'));
    assert.ok(notifications.includes('Events.GuildMemberAdd'));
    assert.ok(notifications.includes('Events.GuildMemberRemove'));
    assert.ok(oauth.includes("app.post('/api/spotify/connect', actionLimiter, requireAuth"));
    assert.ok(oauth.includes('SpotifyOAuthState.findOneAndDelete'));
    assert.ok(spotify.includes('code_challenge_method: \'S256\''));
    assert.ok(spotify.includes('code_verifier: codeVerifier'));
    assert.ok(tokenVault.includes('aes-256-gcm'));
    assert.ok(read('public/spotify.html').includes('data-page="spotify"'));
});

test('Anti-Nuke is opt-in and giveaway outcomes are persisted before announcements', () => {
    const schema = read('src/models/ServerSettings.js');
    const antiNuke = read('src/modules/antiNuke.js');
    const giveawayModel = read('src/models/Giveaway.js');
    const giveaway = read('src/modules/giveaway.js');

    assert.ok(schema.includes('antinuke: {\n        enabled: { type: Boolean, default: false }'));
    assert.ok(antiNuke.includes('policy.enabled !== true'));
    assert.ok(giveawayModel.includes('outcomeCommitted: { type: Boolean, default: false }'));
    assert.ok(giveaway.includes('giveaway.outcomeCommitted === true'));
    assert.ok(giveaway.includes('never reroll on retry'));
});
