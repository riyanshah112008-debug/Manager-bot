const assert = require('assert');
const Module = require('module');

const enginePath = require.resolve('../src/modules/birthdayEngine');
const originalLoad = Module._load;
const birthdayModel = {
    updates: [],
    entries: [],
    async updateOne(filter, update) {
        this.updates.push({ filter, update });
        return { acknowledged: true };
    },
    find() {
        const model = this;
        return {
            limit() {
                return {
                    lean: async () => model.entries
                };
            }
        };
    }
};
const serverSettingsModel = {
    updates: [],
    async updateOne(filter, update) {
        this.updates.push({ filter, update });
        return { acknowledged: true };
    }
};

Module._load = function (request, parent, isMain) {
    if (parent?.filename === enginePath && request === '../models/Birthday') return birthdayModel;
    if (parent?.filename === enginePath && request === '../models/ServerSettings') return serverSettingsModel;
    return originalLoad.call(this, request, parent, isMain);
};

const birthdayEngine = require('../src/modules/birthdayEngine');
Module._load = originalLoad;

function makeGuild({ removeError = null, memberError = null, roleError = null, roleCached = true } = {}) {
    const role = { id: 'role-1' };
    const removed = [];
    const member = {
        roles: {
            cache: new Map([['role-1', role]]),
            async remove(target, reason) {
                if (removeError) throw removeError;
                removed.push({ roleId: target.id, reason });
                this.cache.delete(target.id);
            }
        }
    };
    const guild = {
        id: 'guild-1',
        roles: {
            cache: new Map(roleCached ? [['role-1', role]] : []),
            async fetch() {
                if (roleError) throw roleError;
                return role;
            }
        },
        members: {
            async fetch() {
                if (memberError) throw memberError;
                return member;
            }
        }
    };
    return { guild, member, role, removed };
}

function resetModel() {
    birthdayModel.updates.length = 0;
    birthdayModel.entries.length = 0;
}

async function run() {
    console.log('Running birthday role cleanup regression tests...');

    resetModel();
    {
        const { guild, removed } = makeGuild();
        await birthdayEngine.removeBirthdayRoleAssignment(guild, {
            _id: 'birthday-1', userId: 'user-1', birthdayRoleId: 'role-1'
        }, 'Member removed their birthday');
        assert.strictEqual(removed.length, 1, 'The tracked temporary role should be removed.');
        assert.strictEqual(birthdayModel.updates.length, 1, 'Tracking fields should clear after successful removal.');
        assert.deepStrictEqual(birthdayModel.updates[0].update.$set, {
            birthdayRoleGrantedDate: '',
            birthdayRoleId: ''
        });
    }

    resetModel();
    {
        const { guild } = makeGuild({ removeError: Object.assign(new Error('Missing Manage Roles'), { code: 50013 }) });
        await assert.rejects(
            birthdayEngine.removeBirthdayRoleAssignment(guild, {
                _id: 'birthday-2', userId: 'user-2', birthdayRoleId: 'role-1'
            }),
            /Missing Manage Roles/
        );
        assert.strictEqual(birthdayModel.updates.length, 0, 'Failed Discord removal must retain tracking fields for retry.');
    }

    resetModel();
    {
        const unknownMember = Object.assign(new Error('Unknown Member'), { code: 10007, status: 404 });
        const { guild } = makeGuild({ memberError: unknownMember });
        await birthdayEngine.removeBirthdayRoleAssignment(guild, {
            _id: 'birthday-3', userId: 'departed-user', birthdayRoleId: 'role-1'
        });
        assert.strictEqual(birthdayModel.updates.length, 1, 'A member who left the guild no longer needs role cleanup.');
    }

    resetModel();
    {
        const unknownRole = Object.assign(new Error('Unknown Role'), { code: 10011, status: 404 });
        const { guild } = makeGuild({ roleCached: false, roleError: unknownRole });
        await birthdayEngine.removeBirthdayRoleAssignment(guild, {
            _id: 'birthday-4', userId: 'user-4', birthdayRoleId: 'deleted-role'
        });
        assert.strictEqual(birthdayModel.updates.length, 1, 'A deleted Discord role can safely clear its tracking fields.');
    }

    resetModel();
    {
        const { guild } = makeGuild({ removeError: Object.assign(new Error('Temporary Discord API failure'), { status: 503 }) });
        birthdayModel.entries.push({
            _id: 'birthday-5', userId: 'user-5', birthdayRoleId: 'role-1'
        });
        const originalWarn = console.warn;
        console.warn = () => {};
        try {
            await birthdayEngine.removeExpiredBirthdayRoles(guild, '2026-11-14');
        } finally {
            console.warn = originalWarn;
        }
        assert.strictEqual(birthdayModel.updates.length, 0, 'The expiry scheduler must retain failed removals for its next pass.');
    }

    resetModel();
    await birthdayEngine.removeBirthdayRoleAssignment(makeGuild().guild, {
        _id: 'birthday-6', userId: 'user-6', birthdayRoleId: ''
    });
    assert.strictEqual(birthdayModel.updates.length, 0, 'Entries without an assigned role require no cleanup.');

    serverSettingsModel.updates.length = 0;
    {
        const existingPrivilegedRole = { id: 'existing-role', name: '🎂 Birthday Star', managed: false };
        const createdRole = { id: 'new-role', name: '🎂 Birthday Star' };
        let createOptions = null;
        const guild = {
            id: 'guild-2',
            roles: {
                cache: new Map([[existingPrivilegedRole.id, existingPrivilegedRole]]),
                async create(options) {
                    createOptions = options;
                    return createdRole;
                }
            },
            members: { me: { permissions: { has: () => true } } }
        };
        const settings = { autoRoleEnabled: true, roleName: '🎂 Birthday Star', roleColor: '#F472B6' };
        const result = await birthdayEngine.ensureBirthdayRole(guild, settings);
        assert.strictEqual(result, createdRole, 'Starry must create its own role instead of adopting an unrelated same-name role.');
        assert.strictEqual(createOptions.name, '🎂 Birthday Star');
        assert.strictEqual(settings.roleId, createdRole.id);
        assert.strictEqual(serverSettingsModel.updates.length, 1, 'The newly created role ID should be persisted.');
    }

    console.log('Birthday role cleanup regression tests passed.');
}

run().catch(error => {
    console.error('Birthday role cleanup regression tests failed:', error);
    process.exitCode = 1;
});
