/**
 * Test database helpers for integration tests.
 * Uses the real Postgres database — cleans up test data with a unique prefix.
 */
require('dotenv').config();
const { Pool } = require('pg');

const TEST_USER_PREFIX = 'vitest_';

let pool;

function getPool() {
  if (!pool) {
    pool = new Pool({ connectionString: process.env.DATABASE_URL });
  }
  return pool;
}

/** Generate a unique test user ID */
function testUserId(suffix = 'user') {
  return `${TEST_USER_PREFIX}${suffix}_${Date.now()}`;
}

/** Clean up all test data created by integration tests */
async function cleanupTestData(userIds) {
  const db = getPool();
  if (!userIds || userIds.length === 0) return;

  const placeholders = userIds.map((_, i) => `$${i + 1}`).join(', ');
  await db.query(
    `DELETE FROM onboarding_quiz_attempts WHERE user_id IN (${placeholders})`,
    userIds
  );
  await db.query(
    `DELETE FROM onboarding_progress WHERE user_id IN (${placeholders})`,
    userIds
  );
}

/** Clean up ALL vitest_ prefixed data (safety net) */
async function cleanupAllTestData() {
  const db = getPool();
  await db.query(
    `DELETE FROM onboarding_quiz_attempts WHERE user_id LIKE $1`,
    [`${TEST_USER_PREFIX}%`]
  );
  await db.query(
    `DELETE FROM onboarding_progress WHERE user_id LIKE $1`,
    [`${TEST_USER_PREFIX}%`]
  );
}

async function closePool() {
  if (pool) {
    await pool.end();
    pool = null;
  }
}

module.exports = {
  getPool,
  testUserId,
  cleanupTestData,
  cleanupAllTestData,
  closePool,
  TEST_USER_PREFIX,
};
