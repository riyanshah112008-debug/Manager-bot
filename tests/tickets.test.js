// ==========================================
// 🧪 STARRY TICKETS & SUPPORT SUITE UNIT TESTS
// File: tests/tickets.test.js
// ==========================================
const assert = require('assert');
const { PermissionsBitField, ChannelType } = require('discord.js');

console.log('🧪 Starting Starry Tickets & Support Engine Test Suite...\n');

(async () => {
    // ----------------------------------------------------
    // TEST 1: Tickets Module Exports & Helpers
    // ----------------------------------------------------
    console.log('▶ Test 1: Tickets Module Exports & Functions');
    const ticketsModule = require('../src/modules/tickets');

    assert.strictEqual(typeof ticketsModule, 'function', 'ticketsModule must be an initializer function');
    assert.strictEqual(typeof ticketsModule.isStaff, 'function', 'isStaff helper must be exported');
    assert.strictEqual(typeof ticketsModule.setupTicketPanel, 'function', 'setupTicketPanel must be exported');
    assert.strictEqual(typeof ticketsModule.createTicketChannel, 'function', 'createTicketChannel must be exported');
    assert.strictEqual(typeof ticketsModule.closeTicketChannel, 'function', 'closeTicketChannel must be exported');
    assert.strictEqual(typeof ticketsModule.claimTicketChannel, 'function', 'claimTicketChannel must be exported');
    assert.strictEqual(typeof ticketsModule.addMemberToTicket, 'function', 'addMemberToTicket must be exported');
    assert.strictEqual(typeof ticketsModule.removeMemberFromTicket, 'function', 'removeMemberFromTicket must be exported');
    assert.strictEqual(typeof ticketsModule.generateTranscript, 'function', 'generateTranscript must be exported');
    assert.strictEqual(typeof ticketsModule.getOrCreateTicketCategory, 'function', 'getOrCreateTicketCategory must be exported');
    console.log('  ✅ All 10 tickets helper functions exported and verified!');

    // ----------------------------------------------------
    // TEST 2: isStaff Permission Checks
    // ----------------------------------------------------
    console.log('\n▶ Test 2: isStaff Permission & Role Logic');

    // Admin member
    const adminMember = {
        permissions: new PermissionsBitField(PermissionsBitField.Flags.Administrator),
        roles: { cache: new Map() },
        id: '111111111111111111'
    };
    assert.strictEqual(ticketsModule.isStaff(adminMember), true, 'Administrator must be recognized as staff');

    // Manage Channels member
    const manageChannelsMember = {
        permissions: new PermissionsBitField(PermissionsBitField.Flags.ManageChannels),
        roles: { cache: new Map() },
        id: '222222222222222222'
    };
    assert.strictEqual(ticketsModule.isStaff(manageChannelsMember), true, 'Manage Channels must be recognized as staff');

    // Role named "Staff"
    const staffRoleMember = {
        permissions: new PermissionsBitField(),
        roles: { cache: new Map([['r1', { name: 'Support' }]]) },
        id: '333333333333333333'
    };
    assert.strictEqual(ticketsModule.isStaff(staffRoleMember), true, 'Role named Support must be recognized as staff');

    // Ordinary user
    const normalMember = {
        permissions: new PermissionsBitField(),
        roles: { cache: new Map([['r2', { name: 'Member' }]]) },
        id: '444444444444444444'
    };
    assert.strictEqual(ticketsModule.isStaff(normalMember), false, 'Regular member must not be recognized as staff');
    console.log('  ✅ isStaff permission, hierarchy, and role checks passed!');

    // ----------------------------------------------------
    // TEST 3: System Commands Bundle Registration
    // ----------------------------------------------------
    console.log('\n▶ Test 3: System Commands Bundle Registration');
    const systemCommands = require('../src/commands/bundles/systemCommands');

    const ticketSetupCmd = systemCommands.find(c => c.name === 'ticketsetup');
    assert.ok(ticketSetupCmd, 'ticketsetup command must be registered');
    assert.ok(ticketSetupCmd.aliases.includes('ticketpanel'), 'ticketsetup must include alias ticketpanel');
    assert.ok(ticketSetupCmd.aliases.includes('setuptickets'), 'ticketsetup must include alias setuptickets');
    assert.ok(ticketSetupCmd.aliases.includes('ticket-setup'), 'ticketsetup must include alias ticket-setup');
    assert.strictEqual(typeof ticketSetupCmd.execute, 'function', 'ticketsetup must have execute function');

    const ticketMasterCmd = systemCommands.find(c => c.name === 'ticket');
    assert.ok(ticketMasterCmd, 'ticket master command must be registered');
    assert.strictEqual(typeof ticketMasterCmd.execute, 'function', 'ticket must have execute function');

    const ticketCloseCmd = systemCommands.find(c => c.name === 'ticketclose');
    assert.ok(ticketCloseCmd, 'ticketclose command must be registered');
    assert.ok(ticketCloseCmd.aliases.includes('close'), 'ticketclose must include alias close');

    const ticketClaimCmd = systemCommands.find(c => c.name === 'ticketclaim');
    assert.ok(ticketClaimCmd, 'ticketclaim command must be registered');
    assert.ok(ticketClaimCmd.aliases.includes('claim'), 'ticketclaim must include alias claim');

    const ticketTranscriptCmd = systemCommands.find(c => c.name === 'tickettranscript');
    assert.ok(ticketTranscriptCmd, 'tickettranscript command must be registered');
    assert.ok(ticketTranscriptCmd.aliases.includes('transcript'), 'tickettranscript must include alias transcript');

    const applySetupCmd = systemCommands.find(c => c.name === 'applysetup');
    assert.ok(applySetupCmd, 'applysetup command must be registered');
    console.log('  ✅ ticketsetup, ticket, close, claim, transcript, applysetup commands verified in systemCommands!');

    // ----------------------------------------------------
    // TEST 4: Deploy Commands Registration & Limit Check
    // ----------------------------------------------------
    console.log('\n▶ Test 4: Deploy Commands Audit');
    const { commands } = require('../deploy-commands');

    const slashTicketSetup = commands.find(c => c.name === 'ticketsetup');
    const slashTicket = commands.find(c => c.name === 'ticket');
    const slashApplySetup = commands.find(c => c.name === 'applysetup');

    assert.ok(slashTicketSetup, '/ticketsetup slash command must be registered in deploy-commands');
    assert.ok(slashTicket, '/ticket slash command must be registered in deploy-commands');
    assert.ok(slashApplySetup, '/applysetup slash command must be registered in deploy-commands');

    const chatInputs = commands.filter(c => !c.type || c.type === 1);
    assert.ok(chatInputs.length <= 100, `Chat inputs (${chatInputs.length}) must not exceed Discord hard limit of 100`);
    console.log(`  ✅ deploy-commands.js verified: ${chatInputs.length}/100 chat inputs (Headroom: ${100 - chatInputs.length} slots)`);

    // ----------------------------------------------------
    // TEST 5: Mock Ticket Lifecycle (Setup, Create, Claim, Add/Remove, Close, Transcript)
    // ----------------------------------------------------
    console.log('\n▶ Test 5: Full Mock Ticket Lifecycle Execution');

    // Mock Guild & Channel
    let sentMessages = [];
    const mockChannel = {
        id: '999888777666',
        name: 'open-a-ticket',
        guild: null,
        send: async (payload) => {
            sentMessages.push(payload);
            return { id: 'msg_1', ...payload };
        }
    };

    const mockGuild = {
        id: '123456789012345678',
        name: 'Starry Test Guild',
        roles: {
            cache: new Map([
                ['role_support', { id: 'role_support', name: 'Support' }],
                ['role_everyone', { id: '123456789012345678', name: '@everyone' }]
            ]),
            fetch: async (id) => mockGuild.roles.cache.get(id) || null
        },
        channels: {
            cache: new Map([
                ['999888777666', mockChannel]
            ]),
            fetch: async () => mockGuild.channels.cache,
            create: async (opts) => {
                const newCh = {
                    id: 'ch_' + Math.floor(Math.random() * 100000),
                    name: opts.name,
                    topic: opts.topic || '',
                    parent: opts.parent ? { name: opts.name.includes('closed') ? 'CLOSED TICKETS' : 'OPENED TICKETS' } : null,
                    guild: mockGuild,
                    permissionOverwrites: opts.permissionOverwrites || [],
                    setParent: async () => {},
                    setName: async (n) => { newCh.name = n; },
                    permissionOverwrites: {
                        edit: async (targetId, perms) => {},
                        delete: async (targetId) => {}
                    },
                    send: async (p) => {
                        sentMessages.push(p);
                        return { id: 'msg_' + Math.floor(Math.random() * 10000), ...p };
                    },
                    messages: {
                        fetch: async () => new Map([
                            ['m1', { createdTimestamp: Date.now() - 5000, author: { tag: 'User#0001', id: 'u1' }, content: 'Help please!', attachments: new Map(), embeds: [] }],
                            ['m2', { createdTimestamp: Date.now(), author: { tag: 'Staff#0001', id: 's1' }, content: 'How can I assist?', attachments: new Map(), embeds: [] }]
                        ])
                    },
                    delete: async () => { newCh.deleted = true; }
                };
                mockGuild.channels.cache.set(newCh.id, newCh);
                return newCh;
            }
        },
        roles: {
            everyone: { id: '123456789012345678' },
            cache: new Map([
                ['role_support', { id: 'role_support', name: 'Support' }],
                ['123456789012345678', { id: '123456789012345678', name: '@everyone' }]
            ]),
            fetch: async (id) => mockGuild.roles.cache.get(id) || null
        }
    };
    mockChannel.guild = mockGuild;

    const mockClient = {
        user: { id: 'bot_0000001', tag: 'StarryBot#0001' }
    };

    // A. Setup Panel
    const setupResult = await ticketsModule.setupTicketPanel({
        guild: mockGuild,
        channel: mockChannel,
        client: mockClient,
        supportRole: { id: 'role_support', name: 'Support' }
    });
    assert.strictEqual(setupResult.success, true, 'setupTicketPanel must return success: true');
    assert.ok(sentMessages.length > 0, 'Panel embed must be sent to channel');
    const panelMsg = sentMessages[0];
    assert.ok(panelMsg.embeds[0].data.title.includes('Support'), 'Panel title must mention support');
    assert.strictEqual(panelMsg.components[0].components[0].data.custom_id, 'sys_create_ticket', 'Create button ID must be sys_create_ticket');
    console.log('  ✅ setupTicketPanel deployed panel embed and sys_create_ticket button');

    // B. Create Ticket Channel
    const mockUser = { id: '987654321098765432', username: 'TestGamer' };
    const ticketChannel = await ticketsModule.createTicketChannel({
        guild: mockGuild,
        user: mockUser,
        client: mockClient,
        reason: 'Payment issue'
    });
    assert.ok(ticketChannel, 'createTicketChannel must return new channel');
    assert.ok(ticketChannel.name.startsWith('ticket-testgamer-'), `Channel name must start with ticket-testgamer-: ${ticketChannel.name}`);
    assert.ok(ticketChannel.topic.includes(mockUser.id), 'Channel topic must contain ticket owner ID');
    console.log(`  ✅ createTicketChannel spawned: #${ticketChannel.name}`);

    // C. Claim Ticket Channel
    const mockStaff = { id: '112233445566778899', username: 'ModMaster' };
    const claimResult = await ticketsModule.claimTicketChannel({
        channel: ticketChannel,
        staffMember: mockStaff
    });
    assert.strictEqual(claimResult.success, true, 'claimTicketChannel must succeed');
    assert.ok(ticketChannel.name.startsWith('claimed-'), `Channel name must now start with claimed-: ${ticketChannel.name}`);
    console.log(`  ✅ claimTicketChannel updated name to: #${ticketChannel.name}`);

    // D. Add & Remove Member
    const targetMember = { id: '556677889900112233' };
    const addResult = await ticketsModule.addMemberToTicket({ channel: ticketChannel, member: targetMember });
    assert.strictEqual(addResult.success, true, 'addMemberToTicket must succeed');

    const removeResult = await ticketsModule.removeMemberFromTicket({ channel: ticketChannel, member: targetMember });
    assert.strictEqual(removeResult.success, true, 'removeMemberFromTicket must succeed');
    console.log('  ✅ addMemberToTicket and removeMemberFromTicket passed');

    // E. Generate Transcript
    const transcriptResult = await ticketsModule.generateTranscript({
        channel: ticketChannel,
        guild: mockGuild,
        user: mockStaff
    });
    assert.ok(transcriptResult.attachment, 'Transcript must produce AttachmentBuilder');
    assert.ok(transcriptResult.transcriptEmbed, 'Transcript must produce EmbedBuilder');
    console.log('  ✅ generateTranscript successfully generated text archive');

    // F. Close Ticket Channel
    const closeResult = await ticketsModule.closeTicketChannel({
        channel: ticketChannel,
        closedBy: mockStaff,
        client: mockClient,
        reason: 'Resolved successfully'
    });
    assert.strictEqual(closeResult.success, true, 'closeTicketChannel must succeed');
    assert.ok(ticketChannel.name.startsWith('closed-'), `Channel name must now start with closed-: ${ticketChannel.name}`);
    console.log(`  ✅ closeTicketChannel marked channel as: #${ticketChannel.name}`);

    console.log('\n✨ ALL TICKETS & SUPPORT ENGINE UNIT TESTS PASSED WITH 100% SUCCESS RATE!\n');
    process.exit(0);
})().catch(err => {
    console.error('❌ Ticket Unit Test Failed:', err);
    process.exit(1);
});
