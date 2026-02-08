/**
 * Environment variable validation
 * Call this at startup to fail fast if config is missing
 */

function validateEnv() {
  const required = ['DATABASE_URL', 'OPENAI_API_KEY', 'ANTHROPIC_API_KEY'];
  const missing = required.filter(key => !process.env[key]);

  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }

  // JWT_SECRET is required in production
  if (process.env.NODE_ENV === 'production') {
    if (!process.env.JWT_SECRET || process.env.JWT_SECRET === 'change-me-to-a-random-string') {
      throw new Error('JWT_SECRET must be set to a secure value in production');
    }

    if (!process.env.ALLOWED_ORIGINS) {
      console.warn('[SECURITY] ALLOWED_ORIGINS not set - CORS will reject all cross-origin requests in production');
    }
  }

  // Warn about insecure defaults in development
  if (process.env.NODE_ENV !== 'production') {
    if (!process.env.JWT_SECRET || process.env.JWT_SECRET === 'change-me-to-a-random-string') {
      console.warn('[SECURITY] Using default JWT_SECRET - set JWT_SECRET env var for security');
    }
  }
}

module.exports = { validateEnv };
