'use strict';

const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

const repoRoot = path.resolve(__dirname, '..');
const publicRoot = path.join(repoRoot, 'public');

function collectWebSources(directory) {
    return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
        const fullPath = path.join(directory, entry.name);
        if (entry.isDirectory()) return collectWebSources(fullPath);
        return /\.(?:html|js)$/i.test(entry.name) ? [fullPath] : [];
    });
}

test('website invite links do not request Administrator permission by default', () => {
    const sources = [
        ...collectWebSources(publicRoot),
        path.join(repoRoot, 'dashboard.js')
    ];

    for (const filePath of sources) {
        const source = fs.readFileSync(filePath, 'utf8');
        assert.doesNotMatch(
            source,
            /permissions=8(?:&|&amp;|["'])/i,
            path.relative(repoRoot, filePath) + ' must not request Administrator permission'
        );
    }
});
