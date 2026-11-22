'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { withPrefixReplyPolicy } = require('../src/utils/prefixReplyPolicy');

const basic = withPrefixReplyPolicy('Command completed.');
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

const contextSource = fs.readFileSync(
    path.join(__dirname, '..', 'src', 'utils', 'contextHelper.js'),
    'utf8'
);
assert.match(contextSource, /withPrefixReplyPolicy\(payload\)/);
assert.ok(contextSource.includes('if (!this.isSlash)'));
assert.ok(contextSource.includes('payload = withPrefixReplyPolicy(payload);'));


for (const clientPath of [
    'src/index.js',
    'src/modules/multiBot.js',
    'src/modules/botStudio.js'
]) {
    const clientSource = fs.readFileSync(
        path.join(__dirname, '..', clientPath),
        'utf8'
    );
    assert.match(
        clientSource,
        /allowedMentions:\s*\{\s*parse:\s*\['users',\s*'roles',\s*'everyone'\],\s*repliedUser:\s*false\s*\}/,
        clientPath + ' must suppress reply-author notifications by default'
    );
}

console.log('Prefix reply notification policy regression tests passed.');
