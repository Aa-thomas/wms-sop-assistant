const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { logSecurityEvent, SECURITY_EVENTS } = require('./securityLogger');

// JWT_SECRET validation moved to validateEnv.js
// In development, fallback to insecure default (with warning)
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-me';
const JWT_EXPIRY = '8h';

async function hashPassword(password) {
  return bcrypt.hash(password, 10);
}

async function comparePassword(password, hash) {
  return bcrypt.compare(password, hash);
}

function generateToken(user) {
  return jwt.sign(
    { id: user.id, username: user.username, is_supervisor: user.is_supervisor },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRY }
  );
}

function authMiddleware(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const token = header.slice(7);
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    logSecurityEvent(SECURITY_EVENTS.TOKEN_INVALID, {
      ip: req.ip,
      path: req.path
    });
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

function supervisorMiddleware(req, res, next) {
  authMiddleware(req, res, () => {
    if (!req.user.is_supervisor) {
      logSecurityEvent(SECURITY_EVENTS.ACCESS_DENIED, {
        user: req.user.username,
        path: req.path,
        reason: 'supervisor_required'
      });
      return res.status(403).json({ error: 'Supervisor access required' });
    }
    next();
  });
}

module.exports = {
  hashPassword,
  comparePassword,
  generateToken,
  authMiddleware,
  supervisorMiddleware
};
