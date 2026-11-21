'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { safeEvaluateMath } = require('../src/utils/safeMath');

test('evaluates basic arithmetic with normal precedence', () => {
    assert.equal(safeEvaluateMath('2 + 3 * 4'), 14);
    assert.equal(safeEvaluateMath('(2 + 3) * 4'), 20);
    assert.equal(safeEvaluateMath('10 / 2 + 1'), 6);
    assert.equal(safeEvaluateMath('10 % 3'), 1);
});

test('supports decimals and unary signs', () => {
    assert.equal(safeEvaluateMath('1.5 + 2.25'), 3.75);
    assert.equal(safeEvaluateMath('-(3 + 2) * 4'), -20);
    assert.equal(safeEvaluateMath('+5 - 2'), 3);
});

test('rejects JavaScript, identifiers, statements and code-injection payloads', () => {
    for (const input of [
        'process.exit()',
        'globalThis.process.exit()',
        '1);process.exit();//',
        'require("fs").writeFileSync("x","y")',
        'this.constructor.constructor("return process")()',
        '2^3'
    ]) {
        assert.ok(Number.isNaN(safeEvaluateMath(input)), 'must reject: ' + input);
    }
});

test('rejects division by zero, malformed input and excessive results', () => {
    assert.ok(Number.isNaN(safeEvaluateMath('1 / 0')));
    assert.ok(Number.isNaN(safeEvaluateMath('1 + (2 * 3')));
    assert.ok(Number.isNaN(safeEvaluateMath('1e9')));
    assert.ok(Number.isNaN(safeEvaluateMath('1000000001')));
    assert.ok(Number.isNaN(safeEvaluateMath('9'.repeat(81))));
});

test('does not evaluate or mutate global state from input', () => {
    globalThis.__starryMathInjectionTest = 0;
    assert.ok(Number.isNaN(safeEvaluateMath('1,globalThis.__starryMathInjectionTest=1')));
    assert.equal(globalThis.__starryMathInjectionTest, 0);
    delete globalThis.__starryMathInjectionTest;
});
