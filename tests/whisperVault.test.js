'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const whisper = require('../src/modules/confession');

test('Confessions panel has one persistent open action', () => {
 const rows = whisper.buildPanelComponents();
 assert.equal(rows.length, 1);
 assert.equal(rows[0].components.length, 1);
 assert.equal(rows[0].components[0].data.custom_id, 'whisper:open');
});
test('setup options remain optional for existing no-argument /confessionsetup commands', () => {
 const payload = whisper.setupPayload;
 assert.equal(payload.name, 'confessionsetup');
 assert.equal(payload.options.every(option => option.required !== true), true);
});

test('submission modal bounds topic and body lengths', () => {
 const modal = whisper.buildSubmissionModal().toJSON();
 assert.equal(modal.custom_id, 'whisper:submit');
 assert.equal(modal.components.length, 2);
 const [topic, body] = modal.components.map(row => row.components[0]);
 assert.equal(topic.custom_id, 'topic');
 assert.equal(topic.max_length, 60);
 assert.equal(body.custom_id, 'body');
 assert.equal(body.min_length, 3);
 assert.equal(body.max_length, 1000);
});
test('public confession embed contains no author identity and escapes mass mentions', () => {
 const json = whisper.buildConfessionEmbed(7, 'A thought', 'Hello @everyone').toJSON();
 assert.equal(json.title, 'CONFESSION  #0007');
 assert.match(json.description, /@\u200Beveryone/);
 assert.equal(json.author.name, 'ANONYMOUS CONFESSION');
 assert.equal(json.fields.some(field => /user|author|member/i.test(field.name)), false);
});
test('every confession has reply, new confession, and report buttons', () => {
 const rows = whisper.buildConfessionComponents();
 assert.deepEqual(rows[0].components.map(button => button.data.custom_id), ['confession:reply', 'whisper:open', 'whisper:report']);
 assert.deepEqual(rows[0].components.map(button => button.data.label), ['Reply', 'New Confession', 'Report']);
});
test('reply modal is bound to the exact source confession', () => {
 const modal = whisper.buildReplyModal('123456789012345678').toJSON();
 assert.equal(modal.custom_id, 'confession:reply-submit:123456789012345678');
 assert.equal(modal.components[0].components[0].max_length, 1000);
});
test('anonymous replies keep the source confession number and are valid confession posts', () => {
 const embed = whisper.buildReplyEmbed(42, 'A thoughtful reply').toJSON();
 assert.match(embed.title, /^CONFESSION  #0042/);
 assert.equal(embed.author.name, 'ANONYMOUS REPLY');
 assert.equal(whisper.isWhisperPost({author:{id:'bot'},embeds:[embed]},'bot'), true);
});
test('staff report provides remove and dismiss actions bound to the confession message', () => {
 const rows = whisper.buildStaffComponents('123456789012345678');
 assert.deepEqual(rows[0].components.map(button => button.data.custom_id), [
  'whisper:staff:remove:123456789012345678',
  'whisper:staff:dismiss:123456789012345678'
 ]);
 assert.equal(rows[0].components[1].data.emoji, undefined, 'dismiss button must not send an invalid Unicode emoji');
});
test('public channel validation requires Read Message History for persistent review', () => {
 const { PermissionFlagsBits } = require('discord.js');
 const guild = { id: '1', roles: { everyone: { id: '1' }, cache: new Map() } };
 const publicChannel = {
  id: '2', guildId: '1', type: 0,
  permissionsFor: () => ({ has: permission => permission !== PermissionFlagsBits.ReadMessageHistory })
 };
 const staffChannel = {
  id: '3', guildId: '1', type: 0,
  permissionsFor: role => ({ has: permission => role.id !== '1' || permission !== PermissionFlagsBits.ViewChannel }),
  permissionOverwrites: { cache: new Map() }
 };
 const staffRole = { id: '4', guild };
 const botMember = { id: '5', roles: { cache: new Map() } };
 assert.match(whisper.validateChannels(guild, publicChannel, staffChannel, staffRole, botMember), /Read Message History/);
});
test('staff embed has a structured red review layout and escapes mentions', () => {
 const json = whisper.buildReportEmbed(12, 'Threats @here', 'https://discord.com/channels/123456789012345678/234567890123456789/345678901234567890').toJSON();
 assert.equal(json.color, 0xD64545);
 assert.equal(json.title, 'ANONYMOUS CONFESSIONS / STAFF REVIEW');
 assert.match(json.fields.find(field => field.name === 'REASON').value, /@\u200Bhere/);
 assert.match(json.fields.find(field => field.name === 'SOURCE').value, /https:\/\/discord\.com\/channels\//);
});
test('only bot-authored Confessions entries are recognized', () => {
 const message = { author: { id: 'bot' }, embeds: [{ title: 'CONFESSION  #0001' }] };
 assert.equal(whisper.isWhisperPost(message, 'bot'), true);
 assert.equal(whisper.isWhisperPost(message, 'other'), false);
 assert.equal(whisper.isWhisperPost({ ...message, embeds: [{ title: 'Other message' }] }, 'bot'), false);
});
test('the registered shared handler opens new and legacy panel buttons', async () => {
 const client = new EventEmitter();
 client.isPrimary = false;
 client.user = { id: 'bot' };
 client.guilds = { fetch: async () => null };
 whisper(client);
 let modalCalls = 0;
 for (const customId of ['whisper:open', 'confess_open_modal', 'starry:confession:open', 'confess_btn_open']) {
  const interaction = {
   guildId: '123456789012345678', customId,
   deferred: false, replied: false,
   isChatInputCommand: () => false, isButton: () => true, isModalSubmit: () => false,
   showModal: async modal => {
    modalCalls += 1;
    assert.equal(modal.toJSON().custom_id, 'whisper:submit');
    interaction.replied = true;
   }
  };
  client.emit('interactionCreate', interaction);
  await new Promise(resolve => setImmediate(resolve));
 }
 assert.equal(modalCalls, 4);
});
test('report button opens a modal bound to the clicked confession message', async () => {
 let modalId = '';
 const client = { user: { id: 'bot' }, guilds: { fetch: async () => null } };
 const handler = whisper.createInteractionHandler(client);
 await handler({
  guildId: '123456789012345678',
  customId: 'whisper:report',
  message: { id: '123456789012345678' },
  isChatInputCommand: () => false,
  isButton: () => true,
  isModalSubmit: () => false,
  showModal: async modal => { modalId = modal.toJSON().custom_id; }
 });
 assert.equal(modalId, 'whisper:report-submit:123456789012345678');
});
test('module registration is idempotent and uses the shared client listener', () => {
 const client = new EventEmitter();
 client.isPrimary = false;
 client.user = { id: 'bot' };
 whisper(client);
 whisper(client);
 assert.equal(client.listenerCount('interactionCreate'), 1);
});

test('unsafe selected staff-channel permissions trigger secure-channel fallback instead of blocking panel setup', () => {
 assert.equal(whisper.isStaffChannelPermissionIssue('Another non-staff role can view the report channel. Remove its View Channel access first.'), true);
 assert.equal(whisper.isStaffChannelPermissionIssue('A direct member permission grants access to the report channel.'), true);
 assert.equal(whisper.isStaffChannelPermissionIssue('Starry needs View Channel, Send Messages, and Embed Links in the staff channel.'), true);
 assert.equal(whisper.isStaffChannelPermissionIssue('Starry needs View Channel, Send Messages, Embed Links, and Read Message History in the public channel.'), false);
});

test('report embed sanitizes unsafe text and accepts only canonical Discord message links', () => {
 const url = 'https://discord.com/channels/123456789012345678/234567890123456789/345678901234567890';
 const embed = whisper.buildReportEmbed(7, 'Bad\u0000 text @everyone', url).toJSON();
 assert.match(embed.fields.find(field => field.name === 'REASON').value, /Bad text @\u200Beveryone/);
 assert.equal(embed.fields.find(field => field.name === 'SOURCE').value, url);
 assert.throws(() => whisper.buildReportEmbed(7, 'reason', 'not-a-url'), /Invalid URL|valid Discord message URL/);
 assert.throws(() => whisper.buildReportEmbed(7, 'reason', 'https://example.com/channels/123456789012345678/234567890123456789/345678901234567890'), /valid Discord message URL/);
});

test('report delivery distinguishes permission, access, and invalid-payload failures', () => {
 const { PermissionFlagsBits } = require('discord.js');
 const allRequired = { has: () => true, toArray: () => ['ViewChannel', 'SendMessages', 'EmbedLinks'] };
 const channel = { permissionsFor: () => allRequired };
 const bot = { id: '123456789012345678' };
 assert.match(whisper.getReportDeliveryFailure({ code: 50013 }, channel, bot), /cached channel permissions show the required access/i);
 assert.match(whisper.getReportDeliveryFailure({ code: 50001 }, channel, bot), /denied Starry access/i);
 assert.match(whisper.getReportDeliveryFailure({ code: 50035 }, channel, bot), /not a channel-permission problem/i);
 const missingChannel = { permissionsFor: () => ({ has: flag => flag !== PermissionFlagsBits.EmbedLinks }) };
 assert.match(whisper.getReportDeliveryFailure({ code: 50013 }, missingChannel, bot), /Embed Links/);
});

test('report modal is bound to the exact confession and enforces a bounded reason', () => {
 const modal = whisper.buildReportModal('123456789012345678').toJSON();
 assert.equal(modal.custom_id, 'whisper:report-submit:123456789012345678');
 assert.equal(modal.components.length, 1);
 const reason = modal.components[0].components[0];
 assert.equal(reason.custom_id, 'reason');
 assert.equal(reason.min_length, 3);
 assert.equal(reason.max_length, 500);
});
