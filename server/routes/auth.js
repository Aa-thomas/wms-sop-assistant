const express = require('express');
const router = express.Router();
const db = require('../lib/db');
const { comparePassword, generateToken, authMiddleware } = require('../lib/auth');
const { logSecurityEvent, SECURITY_EVENTS } = require('../lib/securityLogger');

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
      'SELECT id, username, password_hash, is_supervisor, is_active, has_seen_welcome FROM users WHERE username = $1',
      [username]
    );

    if (result.rows.length === 0) {
      logSecurityEvent(SECURITY_EVENTS.LOGIN_FAILED, {
        username,
        ip: req.ip,
        reason: 'user_not_found'
      });
      return res.status(401).json({ error: 'Invalid username or password' });
    }

    const user = result.rows[0];

    // Check if user is disabled
    if (user.is_active === false) {
      logSecurityEvent(SECURITY_EVENTS.LOGIN_BLOCKED, {
        username,
        ip: req.ip,
        reason: 'account_disabled'
      });
      return res.status(403).json({ error: 'Account is disabled. Contact your supervisor.' });
    }

    const valid = await comparePassword(password, user.password_hash);

    if (!valid) {
      logSecurityEvent(SECURITY_EVENTS.LOGIN_FAILED, {
        username,
        ip: req.ip,
        reason: 'invalid_password'
      });
      return res.status(401).json({ error: 'Invalid username or password' });
    }

    // Update last_login
    await db.query('UPDATE users SET last_login = NOW() WHERE id = $1', [user.id]);

    const token = generateToken(user);

    logSecurityEvent(SECURITY_EVENTS.LOGIN_SUCCESS, {
      username,
      ip: req.ip
    });

    res.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        is_supervisor: user.is_supervisor,
        has_seen_welcome: user.has_seen_welcome
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
  try {
    const result = await db.query(
      'SELECT has_seen_welcome FROM users WHERE id = $1',
      [req.user.id]
    );
    const hasSeenWelcome = result.rows[0]?.has_seen_welcome ?? true;

    res.json({
      id: req.user.id,
      username: req.user.username,
      is_supervisor: req.user.is_supervisor,
      has_seen_welcome: hasSeenWelcome
    });
  } catch (error) {
    console.error('[AUTH] /me error:', error);
    res.json({
      id: req.user.id,
      username: req.user.username,
      is_supervisor: req.user.is_supervisor,
      has_seen_welcome: true
    });
  }
});

/**
 * POST /auth/welcome-complete
 * Mark the welcome tour as seen for the authenticated user
 */
router.post('/welcome-complete', authMiddleware, async (req, res) => {
  try {
    await db.query(
      'UPDATE users SET has_seen_welcome = TRUE WHERE id = $1',
      [req.user.id]
    );
    res.json({ ok: true });
  } catch (error) {
    console.error('[AUTH] Welcome complete error:', error);
    res.status(500).json({ error: 'Failed to update welcome status' });
  }
});

module.exports = router;
