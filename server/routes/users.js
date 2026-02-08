const express = require('express');
const { body, param, validationResult } = require('express-validator');
const { getPool } = require('../lib/retrieval');
const { hashPassword } = require('../lib/auth');
const { logSecurityEvent, SECURITY_EVENTS } = require('../lib/securityLogger');

const router = express.Router();

// Password must be 8+ chars with at least one uppercase letter, one number, and one special character
const PASSWORD_REGEX = /^(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]).{8,}$/;
const USERNAME_REGEX = /^[a-zA-Z0-9_.]+$/;

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
router.post('/',
  body('username')
    .trim()
    .isLength({ min: 3, max: 50 }).withMessage('Username must be 3-50 characters')
    .matches(USERNAME_REGEX).withMessage('Username can only contain letters, numbers, underscores, and periods'),
  body('password')
    .isLength({ min: 8 }).withMessage('Password must be at least 8 characters')
    .matches(PASSWORD_REGEX).withMessage('Password must contain at least one uppercase letter, one number, and one special character'),
  body('is_supervisor').optional().isBoolean(),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { username, password, is_supervisor = false } = req.body;

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

      logSecurityEvent(SECURITY_EVENTS.USER_CREATED, {
        actor: req.user.username,
        targetUser: username,
        is_supervisor
      });
      res.status(201).json(result.rows[0]);
    } catch (error) {
      console.error('[USERS] Create failed:', error.message);
      res.status(500).json({ error: 'Failed to create user' });
    }
  }
);

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

    logSecurityEvent(SECURITY_EVENTS.ROLE_CHANGED, {
      actor: req.user.username,
      targetUser: result.rows[0].username,
      is_supervisor
    });
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

    logSecurityEvent(is_active ? SECURITY_EVENTS.USER_ENABLED : SECURITY_EVENTS.USER_DISABLED, {
      actor: req.user.username,
      targetUser: result.rows[0].username
    });
    res.json(result.rows[0]);
  } catch (error) {
    console.error('[USERS] Status update failed:', error.message);
    res.status(500).json({ error: 'Failed to update user status' });
  }
});

// Set user password
router.patch('/:id/password',
  body('password')
    .isLength({ min: 8 }).withMessage('Password must be at least 8 characters')
    .matches(PASSWORD_REGEX).withMessage('Password must contain at least one uppercase letter, one number, and one special character'),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { id } = req.params;
    const { password } = req.body;

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

    logSecurityEvent(SECURITY_EVENTS.PASSWORD_CHANGED, {
      actor: req.user.username,
      targetUser: result.rows[0].username
    });
    res.json({ success: true, message: 'Password updated' });
  } catch (error) {
    console.error('[USERS] Password update failed:', error.message);
    res.status(500).json({ error: 'Failed to update password' });
  }
});

// Reset welcome tour for a user
router.patch('/:id/welcome-reset', async (req, res) => {
  const { id } = req.params;

  try {
    const db = await getPool();
    const result = await db.query(
      'UPDATE users SET has_seen_welcome = FALSE WHERE id = $1 RETURNING id, username',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ success: true, message: `Welcome tour reset for ${result.rows[0].username}` });
  } catch (error) {
    console.error('[USERS] Welcome reset failed:', error.message);
    res.status(500).json({ error: 'Failed to reset welcome tour' });
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

    logSecurityEvent(SECURITY_EVENTS.USER_DELETED, {
      actor: req.user.username,
      targetUser: result.rows[0].username
    });
    res.json({ success: true, message: 'User deleted' });
  } catch (error) {
    console.error('[USERS] Delete failed:', error.message);
    res.status(500).json({ error: 'Failed to delete user' });
  }
});

module.exports = router;
