'use strict';

const assert = require('node:assert/strict');
const { withPrefixReplyPolicy } = require('../src/utils/prefixReplyPolicy');

const basic = withPrefixReplyPolicy({ content: 'Command completed.' });
assert.equal(basic.content, 'Command completed.');
assert.deepEqual(basic.allowedMentions, { repliedUser: false });

const explicitMentions = withPrefixReplyPolicy({
    content: '<@123> <@&456>',
    allowedMentions: {
        parse: ['users'],
        users: ['123'],
        roles: ['456'],
        repliedUser: true
    }
});
assert.deepEqual(explicitMentions.allowedMentions, {
    parse: ['users'],
    users: ['123'],
    roles: ['456'],
    repliedUser: false
});

const original = {
    content: 'Keep the original payload unchanged.',
    allowedMentions: { parse: ['roles'], roles: ['456'] }
};
const safe = withPrefixReplyPolicy(original);
assert.notEqual(safe, original);
assert.notEqual(safe.allowedMentions, original.allowedMentions);
assert.deepEqual(original.allowedMentions, { parse: ['roles'], roles: ['456'] });
assert.equal(safe.allowedMentions.repliedUser, false);

console.log('Prefix reply notification policy regression tests passed.');
