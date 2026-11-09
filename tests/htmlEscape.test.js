'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const escapeHtml = require('../src/utils/htmlEscape');

assert.equal(
    escapeHtml('<script>alert("x")</script>&\\''),
    '&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;&amp;&#39;'
);
assert.equal(escapeHtml(null), '');
assert.equal(escapeHtml(undefined), '');
assert.equal(escapeHtml(42), '42');
assert.equal(escapeHtml('already &amp;'), 'already &amp;amp;');

const dashboardSource = fs.readFileSync(
    path.join(__dirname, '../src/modules/dashboardServer.js'),
    'utf8'
);
assert.ok(dashboardSource.includes('<p>${escapeHtml(error)}</p>'));
assert.ok(dashboardSource.includes('Connected as ${escapeHtml(profile.display_name || profile.id)}'));
assert.ok(dashboardSource.includes('<p>${escapeHtml(err.message)}</p>'));
assert.ok(dashboardSource.includes("const guildName = escapeHtml(guild ? guild.name : 'Discord Server');"));
assert.ok(dashboardSource.includes('<img src="${escapeHtml(guildIcon)}" class="icon"'));
assert.equal((dashboardSource.match(/\\$\\{guildName\\}/g) || []).length, 2);

process.stdout.write('Dashboard HTML escaping tests passed.\\n');
