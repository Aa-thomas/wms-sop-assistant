const express = require('express');
const { getPool } = require('../lib/retrieval');
const { authMiddleware, supervisorMiddleware } = require('../lib/auth');

const router = express.Router();

// All modules in the system (source of truth)
const ALL_MODULES = [
  { value: 'Navigation', label: 'Navigation' },
  { value: 'Inbound', label: 'Inbound' },
  { value: 'Outbound', label: 'Outbound' },
  { value: 'Picking', label: 'Picking' },
  { value: 'Replenishment', label: 'Replenishment' },
  { value: 'Inventory', label: 'Inventory' },
  { value: 'CycleCounts', label: 'Cycle Counts' },
  { value: 'Returns', label: 'Returns' },
  { value: 'Admin', label: 'Admin' }
];

/**
 * GET /modules/assignments
 * Get all module assignments (supervisor only)
 */
router.get('/assignments', supervisorMiddleware, async (req, res) => {
  try {
    const db = await getPool();
    const result = await db.query(
      'SELECT role, module, enabled FROM module_assignments ORDER BY module, role'
    );

    // Transform into a more usable structure
    const assignments = {};
    for (const mod of ALL_MODULES) {
      assignments[mod.value] = {
        label: mod.label,
        operator: true,
        supervisor: true
      };
    }

    for (const row of result.rows) {
      if (assignments[row.module]) {
        assignments[row.module][row.role] = row.enabled;
      }
    }

    res.json(assignments);
  } catch (error) {
    console.error('[MODULES] Get assignments failed:', error.message);
    res.status(500).json({ error: 'Failed to load module assignments' });
  }
});

/**
 * PATCH /modules/assignments
 * Update a module assignment (supervisor only)
 */
router.patch('/assignments', supervisorMiddleware, async (req, res) => {
  const { module, role, enabled } = req.body;

  if (!module || !role || typeof enabled !== 'boolean') {
    return res.status(400).json({ error: 'module, role, and enabled (boolean) required' });
  }

  if (!['operator', 'supervisor'].includes(role)) {
    return res.status(400).json({ error: 'role must be operator or supervisor' });
  }

  try {
    const db = await getPool();
    await db.query(
      `INSERT INTO module_assignments (role, module, enabled, updated_at, updated_by)
       VALUES ($1, $2, $3, NOW(), $4)
       ON CONFLICT (role, module)
       DO UPDATE SET enabled = $3, updated_at = NOW(), updated_by = $4`,
      [role, module, enabled, req.user.id]
    );

    console.log(`[MODULES] ${req.user.username} set ${module} ${role}=${enabled}`);
    res.json({ success: true, module, role, enabled });
  } catch (error) {
    console.error('[MODULES] Update assignment failed:', error.message);
    res.status(500).json({ error: 'Failed to update module assignment' });
  }
});

/**
 * GET /modules/available
 * Get modules available to current user based on their role
 */
router.get('/available', authMiddleware, async (req, res) => {
  const role = req.user.is_supervisor ? 'supervisor' : 'operator';

  try {
    const db = await getPool();
    const result = await db.query(
      'SELECT module FROM module_assignments WHERE role = $1 AND enabled = true',
      [role]
    );

    const enabledModules = new Set(result.rows.map(r => r.module));

    // Return modules that are enabled for this role
    const available = ALL_MODULES.filter(m => enabledModules.has(m.value));

    res.json(available);
  } catch (error) {
    console.error('[MODULES] Get available failed:', error.message);
    // Fallback to all modules if DB error
    res.json(ALL_MODULES);
  }
});

module.exports = router;
