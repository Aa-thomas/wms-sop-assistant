const express = require('express');
const { getPool } = require('../lib/retrieval');
const { hashPassword } = require('../lib/auth');

const router = express.Router();

// List all users (no password hashes)
router.get('/', async (req, res) => {
  try {
    const db = await getPool();
    const result = await db.query(
      'SELECT id, username, is_supervisor, is_active, created_at, last_login FROM users ORDER BY username ASC'
    );
    res.json(result.rows);
  } catch (error) {
    console.error('[USERS] List failed:', error.message);
    res.status(500).json({ error: 'Failed to load users' });
  }
});

// Create new user
router.post('/', async (req, res) => {
  const { username, password, is_supervisor = false } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: 'username and password required' });
  }

  if (username.length < 3 || username.length > 50) {
    return res.status(400).json({ error: 'Username must be 3-50 characters' });
  }

  if (password.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters' });
  }

  try {
    const db = await getPool();
    
    // Check if username exists
    const existing = await db.query('SELECT id FROM users WHERE username = $1', [username]);
    if (existing.rows.length > 0) {
      return res.status(409).json({ error: 'Username already exists' });
    }

    const passwordHash = await hashPassword(password);
    const result = await db.query(
      `INSERT INTO users (username, password_hash, is_supervisor, is_active)
       VALUES ($1, $2, $3, true)
       RETURNING id, username, is_supervisor, is_active, created_at, last_login`,
      [username, passwordHash, is_supervisor]
    );

    console.log(`[USERS] ${req.user.username} created user ${username}`);
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('[USERS] Create failed:', error.message);
    res.status(500).json({ error: 'Failed to create user' });
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

// Toggle user active status (enable/disable)
router.patch('/:id/status', async (req, res) => {
  const { id } = req.params;
  const { is_active } = req.body;

  if (typeof is_active !== 'boolean') {
    return res.status(400).json({ error: 'is_active must be a boolean' });
  }

  // Prevent self-disable
  if (req.user.id.toString() === id && !is_active) {
    return res.status(403).json({ error: 'Cannot disable your own account' });
  }

  try {
    const db = await getPool();
    const result = await db.query(
      'UPDATE users SET is_active = $1 WHERE id = $2 RETURNING id, username, is_supervisor, is_active, created_at, last_login',
      [is_active, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    console.log(`[USERS] ${req.user.username} set is_active=${is_active} for user ${result.rows[0].username}`);
    res.json(result.rows[0]);
  } catch (error) {
    console.error('[USERS] Status update failed:', error.message);
    res.status(500).json({ error: 'Failed to update user status' });
  }
});

// Set user password
router.patch('/:id/password', async (req, res) => {
  const { id } = req.params;
  const { password } = req.body;

  if (!password || password.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters' });
  }

  try {
    const db = await getPool();
    const passwordHash = await hashPassword(password);
    
    const result = await db.query(
      'UPDATE users SET password_hash = $1 WHERE id = $2 RETURNING id, username',
      [passwordHash, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    console.log(`[USERS] ${req.user.username} reset password for user ${result.rows[0].username}`);
    res.json({ success: true, message: 'Password updated' });
  } catch (error) {
    console.error('[USERS] Password update failed:', error.message);
    res.status(500).json({ error: 'Failed to update password' });
  }
});

// Delete user
router.delete('/:id', async (req, res) => {
  const { id } = req.params;

  // Prevent self-delete
  if (req.user.id.toString() === id) {
    return res.status(403).json({ error: 'Cannot delete your own account' });
  }

  try {
    const db = await getPool();
    const result = await db.query(
      'DELETE FROM users WHERE id = $1 RETURNING id, username',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    console.log(`[USERS] ${req.user.username} deleted user ${result.rows[0].username}`);
    res.json({ success: true, message: 'User deleted' });
  } catch (error) {
    console.error('[USERS] Delete failed:', error.message);
    res.status(500).json({ error: 'Failed to delete user' });
  }
});

module.exports = router;
