/**
 * Security event logging
 * Provides structured logging for security-relevant events
 */

const SECURITY_EVENTS = {
  LOGIN_SUCCESS: 'LOGIN_SUCCESS',
  LOGIN_FAILED: 'LOGIN_FAILED',
  LOGIN_BLOCKED: 'LOGIN_BLOCKED',
  USER_CREATED: 'USER_CREATED',
  USER_DELETED: 'USER_DELETED',
  USER_DISABLED: 'USER_DISABLED',
  USER_ENABLED: 'USER_ENABLED',
  ROLE_CHANGED: 'ROLE_CHANGED',
  PASSWORD_CHANGED: 'PASSWORD_CHANGED',
  TOKEN_INVALID: 'TOKEN_INVALID',
  ACCESS_DENIED: 'ACCESS_DENIED'
};

/**
 * Log a security event with structured data
 * @param {string} event - One of SECURITY_EVENTS
 * @param {object} details - Event-specific details
 */
function logSecurityEvent(event, details = {}) {
  const entry = {
    timestamp: new Date().toISOString(),
    event,
    ...details
  };

  // Remove sensitive data from logs
  if (entry.password) delete entry.password;
  if (entry.token) entry.token = '[REDACTED]';

  console.log('[SECURITY]', JSON.stringify(entry));
}

module.exports = {
  SECURITY_EVENTS,
  logSecurityEvent
};
