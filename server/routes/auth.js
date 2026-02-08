const express = require('express');
const router = express.Router();
const db = require('../lib/db');
const { comparePassword, generateToken, authMiddleware } = require('../lib/auth');

/**
 * POST /auth/login
 * Authenticate user and return JWT
 */
router.post('/login', async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password required' });
  }

  try {
    const result = await db.query(
      'SELECT id, username, password_hash, is_supervisor, is_active FROM users WHERE username = $1',
      [username]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }

    const user = result.rows[0];

    // Check if user is disabled
    if (user.is_active === false) {
      return res.status(403).json({ error: 'Account is disabled. Contact your supervisor.' });
    }

    const valid = await comparePassword(password, user.password_hash);

    if (!valid) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }

    // Update last_login
    await db.query('UPDATE users SET last_login = NOW() WHERE id = $1', [user.id]);

    const token = generateToken(user);

    res.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        is_supervisor: user.is_supervisor
      }
    });
  } catch (error) {
    console.error('[AUTH] Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

/**
 * GET /auth/me
 * Validate token and return current user info
 */
router.get('/me', authMiddleware, async (req, res) => {
  res.json({
    id: req.user.id,
    username: req.user.username,
    is_supervisor: req.user.is_supervisor
  });
});

module.exports = router;
