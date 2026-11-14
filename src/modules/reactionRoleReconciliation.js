'use strict';

/**
 * Build safe role repairs from the reactions currently present on a panel.
 * This intentionally only restores missing roles; it never removes roles,
 * because a role may also have been granted manually or by another system.
 */
function planUserRepairs(panel, selectedRoleIds, existingRoleIds) {
  const selected = [...new Set((selectedRoleIds || []).filter(Boolean))];
  const existing = new Set(existingRoleIds || []);
  if (!selected.length) return [];

  if (panel?.mode === 'single') {
    // A single-select panel should have one active mapped reaction. If old
    // state contains multiple reactions, do not guess which one was intended.
    if (selected.length !== 1) return [];
    return existing.has(selected[0]) ? [] : [selected[0]];
  }

  return selected.filter(roleId => !existing.has(roleId));
}

module.exports = { planUserRepairs };
