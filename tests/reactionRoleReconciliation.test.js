'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { planUserRepairs } = require('../src/modules/reactionRoleReconciliation');

test('multiple-select reconciliation restores every selected missing role only', () => {
  assert.deepEqual(
    planUserRepairs({ mode: 'multiple' }, ['role-a', 'role-b'], ['role-a']),
    ['role-b']
  );
});

test('single-select reconciliation restores the one active selection', () => {
  assert.deepEqual(
    planUserRepairs({ mode: 'single' }, ['role-a'], []),
    ['role-a']
  );
});

test('single-select reconciliation does not guess when multiple reactions remain', () => {
  assert.deepEqual(
    planUserRepairs({ mode: 'single' }, ['role-a', 'role-b'], []),
    []
  );
});

test('reconciliation never removes roles or assigns roles without a current reaction', () => {
  assert.deepEqual(planUserRepairs({ mode: 'multiple' }, [], ['role-a']), []);
  assert.deepEqual(planUserRepairs({ mode: 'multiple' }, ['role-a'], ['role-a']), []);
});
