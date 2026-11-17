'use strict';

const test = require('node:test');
const { EventEmitter } = require('node:events');
const assert = require('node:assert/strict');
const { ChannelType, PermissionFlagsBits } = require('discord.js');
const confession = require('../src/modules/confession');

const GUILD_ID = '12345678901234567';
const PUBLIC_CHANNEL_ID = '12345678901234568';
const STAFF_CHANNEL_ID = '12345678901234569';
const STAFF_ROLE_ID = '12345678901234570';
const OTHER_ROLE_ID = '12345678901234571';
const BOT_ID = '12345678901234572';
const MESSAGE_ID = '12345678901234573';

function permissionSet(...flags) {
    const enabled = new Set(flags);
    return { has: flag => enabled.has(flag) };
}

function makePrivacyFixture(overrides = {}) {
    const everyone = { id: GUILD_ID, permissions: permissionSet() };
    const staffRole = { id: STAFF_ROLE_ID, guild: { id: GUILD_ID }, permissions: permissionSet() };
    const otherRole = { id: OTHER_ROLE_ID, permissions: permissionSet() };
    const botMember = { id: BOT_ID };
    const guild = {
        id: GUILD_ID,
        roles: {
            everyone,
            cache: new Map([[GUILD_ID, everyone], [STAFF_ROLE_ID, staffRole], [OTHER_ROLE_ID, otherRole]])
        }
    };
    const publicChannel = {
        id: PUBLIC_CHANNEL_ID,
        guildId: GUILD_ID,
        type: ChannelType.GuildText,
        isTextBased: () => true,
        permissionsFor: member => member.id === BOT_ID
            ? permissionSet(PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.EmbedLinks)
            : permissionSet(PermissionFlagsBits.ViewChannel)
    };
    const staffChannel = {
        id: STAFF_CHANNEL_ID,
        guildId: GUILD_ID,
        type: ChannelType.GuildText,
        isTextBased: () => true,
        permissionOverwrites: { cache: new Map() },
        permissionsFor: member => {
            if (member.id === GUILD_ID) return overrides.everyone || permissionSet();
            if (member.id === STAFF_ROLE_ID) return overrides.staff || permissionSet(PermissionFlagsBits.ViewChannel);
            if (member.id === BOT_ID) return overrides.bot || permissionSet(
                PermissionFlagsBits.ViewChannel,
                PermissionFlagsBits.SendMessages,
                PermissionFlagsBits.EmbedLinks
            );
            if (member.id === OTHER_ROLE_ID) return overrides.other || permissionSet();
            return permissionSet();
        }
    };
    return { guild, everyone, staffRole, otherRole, botMember, publicChannel, staffChannel };
}

test('confession panel uses a stable persistent button custom ID', () => {
    const rows = confession.buildPanelComponents();
    assert.equal(rows.length, 1);
    assert.equal(rows[0].components[0].data.custom_id, 'starry:confession:open');
});

test('confession cards have stable reply and report actions', () => {
    const rows = confession.buildConfessionActions(true);
    const ids = rows[0].components.map(component => component.data.custom_id);
    assert.ok(ids.includes('starry:confession:reply'));
    assert.ok(ids.includes('starry:confession:report'));
});

test('reply action can be disabled without removing reports', () => {
    const rows = confession.buildConfessionActions(false);
    const ids = rows[0].components.map(component => component.data.custom_id);
    assert.deepEqual(ids, ['starry:confession:report']);
});

test('submission modal is private and enforces bounded input lengths', () => {
    const modal = confession.buildConfessionModal().toJSON();
    assert.equal(modal.custom_id, 'starry:confession:submit');
    assert.equal(modal.components[0].components[0].custom_id, 'topic');
    assert.equal(modal.components[1].components[0].custom_id, 'body');
    assert.equal(modal.components[1].components[0].max_length, 1000);
});

test('reply and report modals bind both source channel and message IDs', () => {
    const reply = confession.buildReplyModal(PUBLIC_CHANNEL_ID, MESSAGE_ID).toJSON();
    const report = confession.buildReportModal(PUBLIC_CHANNEL_ID, MESSAGE_ID).toJSON();
    assert.equal(reply.custom_id, 'starry:confession:reply-submit:' + PUBLIC_CHANNEL_ID + ':' + MESSAGE_ID);
    assert.equal(report.custom_id, 'starry:confession:report-submit:' + PUBLIC_CHANNEL_ID + ':' + MESSAGE_ID);
});

test('panel and confession embeds are valid Discord embed payloads', () => {
    assert.equal(confession.buildPanelEmbed().toJSON().title, '💌  Starry Confession Box');
    const card = confession.buildConfessionEmbed(12, 'Late night thoughts', 'A sample confession').toJSON();
    assert.match(card.author.name, /#12$/);
    assert.equal(card.title, '✦ Late night thoughts');
});

test('public confession embeds escape mass mentions', () => {
    const card = confession.buildConfessionEmbed(13, '', '@everyone please read this').toJSON();
    assert.equal(card.description.includes('@everyone'), false);
});

test('publish channel validation requires same-server text channel and bot permissions', () => {
    const f = makePrivacyFixture();
    assert.deepEqual(confession.validatePublishChannel(f.guild, f.publicChannel, f.botMember), { ok: true });
    const denied = { ...f.publicChannel, permissionsFor: () => permissionSet(PermissionFlagsBits.ViewChannel) };
    assert.equal(confession.validatePublishChannel(f.guild, denied, f.botMember).ok, false);
    assert.equal(confession.validatePublishChannel(f.guild, { ...f.publicChannel, guildId: '12345678901234599' }, f.botMember).ok, false);
});

test('staff report validation requires a distinct channel hidden from @everyone', () => {
    const f = makePrivacyFixture();
    assert.equal(confession.validateStaffChannel(f.guild, f.publicChannel, f.staffChannel, f.staffRole, f.botMember).ok, true);
    const publicReports = { ...f.staffChannel, permissionsFor: member => member.id === GUILD_ID
        ? permissionSet(PermissionFlagsBits.ViewChannel)
        : f.staffChannel.permissionsFor(member) };
    assert.equal(confession.validateStaffChannel(f.guild, f.publicChannel, publicReports, f.staffRole, f.botMember).ok, false);
    assert.equal(confession.validateStaffChannel(f.guild, f.publicChannel, f.publicChannel, f.staffRole, f.botMember).ok, false);
});

test('staff report validation rejects other roles with view access', () => {
    const f = makePrivacyFixture({ other: permissionSet(PermissionFlagsBits.ViewChannel) });
    assert.equal(confession.validateStaffChannel(f.guild, f.publicChannel, f.staffChannel, f.staffRole, f.botMember).ok, false);
});

test('staff report validation rejects explicit non-staff member view overwrites', () => {
    const f = makePrivacyFixture();
    f.staffChannel.permissionOverwrites.cache.set('12345678901234574', {
        id: '12345678901234574',
        type: 1,
        allow: permissionSet(PermissionFlagsBits.ViewChannel)
    });
    assert.equal(confession.validateStaffChannel(f.guild, f.publicChannel, f.staffChannel, f.staffRole, f.botMember).ok, false);
});

test('only Starry-authored confession embeds are eligible for reply or reports', () => {
    const card = {
        author: { id: BOT_ID },
        embeds: [{ author: { name: 'ANONYMOUS CONFESSION  ·  #42' } }]
    };
    assert.equal(confession.isConfessionMessage(card, BOT_ID), true);
    assert.equal(confession.isConfessionMessage({ ...card, author: { id: '12345678901234580' } }, BOT_ID), false);
    assert.equal(confession.isConfessionMessage({ ...card, embeds: [{ author: { name: 'ordinary message' } }] }, BOT_ID), false);
});

test('reply and report buttons derive their source from the actual message context', () => {
    const reply = confession.getButtonSource({
        customId: 'starry:confession:reply',
        channelId: PUBLIC_CHANNEL_ID,
        message: { id: MESSAGE_ID }
    });
    const report = confession.getButtonSource({
        customId: 'starry:confession:report',
        channelId: PUBLIC_CHANNEL_ID,
        message: { id: MESSAGE_ID }
    });
    assert.deepEqual(reply, { action: 'reply', channelId: PUBLIC_CHANNEL_ID, messageId: MESSAGE_ID });
    assert.deepEqual(report, { action: 'report', channelId: PUBLIC_CHANNEL_ID, messageId: MESSAGE_ID });
});

test('legacy reply and report buttons use their attached message instead of stale encoded IDs', () => {
    const reply = confession.getButtonSource({
        customId: 'confess_btn_reply_123',
        channelId: PUBLIC_CHANNEL_ID,
        message: { id: MESSAGE_ID }
    });
    const report = confession.getButtonSource({
        customId: 'confess_btn_report_123',
        channelId: PUBLIC_CHANNEL_ID,
        message: { id: MESSAGE_ID }
    });
    assert.deepEqual(reply, { action: 'reply', channelId: PUBLIC_CHANNEL_ID, messageId: MESSAGE_ID });
    assert.deepEqual(report, { action: 'report', channelId: PUBLIC_CHANNEL_ID, messageId: MESSAGE_ID });
});

test('modal source validation rejects malformed or mismatched legacy sources', () => {
    const config = { channelId: PUBLIC_CHANNEL_ID };
    assert.deepEqual(
        confession.getModalSource('starry:confession:reply-submit:' + PUBLIC_CHANNEL_ID + ':' + MESSAGE_ID, 'reply', config),
        { channelId: PUBLIC_CHANNEL_ID, messageId: MESSAGE_ID }
    );
    assert.equal(confession.getModalSource('starry:confession:reply-submit:bad:' + MESSAGE_ID, 'reply', config), null);
    assert.deepEqual(
        confession.getModalSource('starry:confession:report:' + MESSAGE_ID, 'report', config),
        { channelId: PUBLIC_CHANNEL_ID, messageId: MESSAGE_ID }
    );
});


test('primary confession module registers its interaction handler on worker clients', async () => {
    const hooks = [];
    const primary = {
        isPrimary: true,
        on() {},
        __starryConfessionHandlerInstalled: false
    };
    const manager = {
        registerEventHook(callback) {
            hooks.push(callback);
        }
    };

    assert.equal(confession.registerWorkerInteractionHook(primary, manager), true);
    assert.equal(confession.registerWorkerInteractionHook(primary, manager), false);
    assert.equal(hooks.length, 1);

    const worker = new EventEmitter();
    worker.isPrimary = false;
    hooks[0](worker);
    assert.equal(worker.listenerCount('interactionCreate'), 1);

    let shownModalId = null;
    const interaction = {
        guild: {},
        customId: 'confess_btn_open',
        isChatInputCommand: () => false,
        isButton: () => true,
        showModal: async modal => {
            shownModalId = modal.toJSON().custom_id;
        }
    };
    await worker.listeners('interactionCreate')[0](interaction);
    assert.equal(shownModalId, 'starry:confession:submit');
});
