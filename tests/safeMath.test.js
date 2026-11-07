'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const safeEvaluateMath = require('../src/utils/safeMath');

test('evaluates arithmetic with standard precedence and parentheses', () => {
    assert.equal(safeEvaluateMath('2 + 3 * 4'), 14);
    assert.equal(safeEvaluateMath('(2 + 3) * 4'), 20);
    assert.equal(safeEvaluateMath('10 / 4 + 1.5'), 4);
    assert.equal(safeEvaluateMath('10 % 4'), 2);
    assert.equal(safeEvaluateMath('-2 + +5'), 3);
});

test('supports bounded exponentiation only when explicitly enabled', () => {
    assert.equal(safeEvaluateMath('2^3^2', { allowPower: true }), 512);
    assert.equal(safeEvaluateMath('-2^2', { allowPower: true }), -4);
    assert.equal(safeEvaluateMath('2^-2', { allowPower: true }), 0.25);
    assert.ok(Number.isNaN(safeEvaluateMath('2^3')));
});

test('rejects JavaScript syntax and non-arithmetic tokens', () => {
    for (const input of [
        'process.env.TOKEN',
        'globalThis.process.exit()',
        '1.constructor',
        '1;process.exit()',
        '2**3',
        '1e3',
        '2(3)',
        '1 +'
    ]) {
        assert.ok(Number.isNaN(safeEvaluateMath(input)), input);
    }
});

test('rejects division by zero, excessive input and out-of-range results', () => {
    assert.ok(Number.isNaN(safeEvaluateMath('1 / 0')));
    assert.ok(Number.isNaN(safeEvaluateMath('9'.repeat(81))));
    assert.ok(Number.isNaN(safeEvaluateMath('50000^2', { allowPower: true })));
    assert.ok(Number.isNaN(safeEvaluateMath('(-1)^0.5', { allowPower: true })));
});
