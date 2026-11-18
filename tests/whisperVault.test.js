'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const whisper = require('../src/modules/confession');
const { ChannelType, PermissionFlagsBits } = require('discord.js');

test('Whisper Vault panel has one persistent open action', () => {
 const rows = whisper.buildPanelComponents();
 assert.equal(rows.length, 1);
 assert.equal(rows[0].components.length, 1);
 assert.equal(rows[0].components[0].data.custom_id, 'whisper:open');
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
 assert.equal(json.author.name, 'WHISPER VAULT  /  ANONYMOUS ENTRY');
 assert.equal(json.fields.some(field => /user|author|member/i.test(field.name)), false);
});
test('report action uses a stable custom ID and reads source from the clicked message', () => {
 const rows = whisper.buildConfessionComponents();
 assert.equal(rows[0].components[0].data.custom_id, 'whisper:report');
});
test('staff report provides remove and dismiss actions bound to the confession message', () => {
 const rows = whisper.buildStaffComponents('123456789012345678');
 assert.deepEqual(rows[0].components.map(button => button.data.custom_id), [
  'whisper:staff:remove:123456789012345678',
  'whisper:staff:dismiss:123456789012345678'
 ]);
});
test('staff embed has a structured red review layout and escapes mentions', () => {
 const json = whisper.buildReportEmbed(12, 'Threats @here', 'https://discord.com/channels/1/2/3').toJSON();
 assert.equal(json.color, 0xD64545);
 assert.equal(json.title, 'WHISPER VAULT  /  STAFF REVIEW');
 assert.match(json.fields.find(field => field.name === 'REASON').value, /@\u200Bhere/);
 assert.match(json.fields.find(field => field.name === 'SOURCE').value, /Open published confession/);
});
test('only bot-authored Whisper Vault entries are recognized', () => {
 const message = { author: { id: 'bot' }, embeds: [{ title: 'CONFESSION  #0001' }] };
 assert.equal(whisper.isWhisperPost(message, 'bot'), true);
 assert.equal(whisper.isWhisperPost(message, 'other'), false);
 assert.equal(whisper.isWhisperPost({ ...message, embeds: [{ title: 'Other message' }] }, 'bot'), false);
});
test('the single module handler opens the submission modal exactly once', async () => {
 let modalCalls = 0;
 const client = { user: { id: 'bot' }, guilds: { fetch: async () => null } };
 const handler = whisper.createInteractionHandler(client);
 const interaction = {
  guildId: '123456789012345678',
  customId: 'whisper:open',
  isChatInputCommand: () => false,
  isButton: () => true,
  isModalSubmit: () => false,
  showModal: async modal => { modalCalls += 1; assert.equal(modal.toJSON().custom_id, 'whisper:submit'); }
 };
 await handler(interaction);
 assert.equal(modalCalls, 1);
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
test('module registration is idempotent and installs one interaction listener', () => {
 let listeners = 0;
 const client = { isPrimary: false, on: (event, fn) => { if (event === 'interactionCreate') listeners += 1; } };
 whisper(client);
 whisper(client);
 assert.equal(listeners, 1);
});

test('setup requires public-channel Read Message History for persistent staff review', () => {
 const everyoneRole = { id: 'everyone', permissions: { has: () => false } };
 const staffRole = { id: 'staff', guild: { id: 'guild' }, permissions: { has: () => false } };
 const botRole = { id: 'bot-role', managed: true, permissions: { has: () => false } };
 const botMember = { id: 'bot', roles: { cache: new Map([[botRole.id, botRole]]) } };
 const permissionSet = new Set([PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.EmbedLinks]);
 const makePerms = values => ({ has: permission => values.has(permission) });
 const publicChannel = {
  id: 'public', guildId: 'guild', type: ChannelType.GuildText,
  permissionsFor: () => makePerms(new Set([...permissionSet, PermissionFlagsBits.ReadMessageHistory]))
 };
 const staffChannel = {
  id: 'staff-channel', guildId: 'guild', type: ChannelType.GuildText,
  permissionsFor: target => target === everyoneRole ? makePerms(new Set()) : makePerms(new Set([PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.EmbedLinks])),
  permissionOverwrites: { cache: new Map() }
 };
 const guild = {
  id: 'guild',
  roles: { everyone: everyoneRole, cache: new Map([[everyoneRole.id, everyoneRole], [staffRole.id, staffRole], [botRole.id, botRole]]) }
 };
 assert.equal(whisper.validateChannels(guild, publicChannel, staffChannel, staffRole, botMember), null);
 publicChannel.permissionsFor = () => makePerms(permissionSet);
 assert.match(whisper.validateChannels(guild, publicChannel, staffChannel, staffRole, botMember), /Read Message History/);
});
