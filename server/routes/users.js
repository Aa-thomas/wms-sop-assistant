const express = require('express');
const { getPool } = require('../lib/retrieval');

const router = express.Router();

// List all users (no password hashes)
router.get('/', async (req, res) => {
  try {
    const db = await getPool();
    const result = await db.query(
      'SELECT id, username, is_supervisor, created_at, last_login FROM users ORDER BY username ASC'
    );
    res.json(result.rows);
  } catch (error) {
    console.error('[USERS] List failed:', error.message);
    res.status(500).json({ error: 'Failed to load users' });
  }
});

// Update user role (supervisor flag)
router.patch('/:id/role', async (req, res) => {
  const { id } = req.params;
  const { is_supervisor } = req.body;

  if (typeof is_supervisor !== 'boolean') {
    return res.status(400).json({ error: 'is_supervisor must be a boolean' });
  }

  // Prevent self-demotion
  if (req.user.id.toString() === id && !is_supervisor) {
    return res.status(403).json({ error: 'Cannot remove your own supervisor privileges' });
  }

  try {
    const db = await getPool();
    const result = await db.query(
      'UPDATE users SET is_supervisor = $1 WHERE id = $2 RETURNING id, username, is_supervisor, created_at, last_login',
      [is_supervisor, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    console.log(`[USERS] ${req.user.username} set is_supervisor=${is_supervisor} for user ${result.rows[0].username}`);
    res.json(result.rows[0]);
  } catch (error) {
    console.error('[USERS] Role update failed:', error.message);
    res.status(500).json({ error: 'Failed to update user role' });
  }
});

module.exports = router;
