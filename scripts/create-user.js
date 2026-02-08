#!/usr/bin/env node
require('dotenv').config();
const { Pool } = require('pg');
const { hashPassword } = require('../server/lib/auth');

const args = process.argv.slice(2);

function getArg(name) {
  const idx = args.indexOf(`--${name}`);
  if (idx === -1) return null;
  return args[idx + 1] || null;
}

const username = getArg('username');
const password = getArg('password');
const isSupervisor = args.includes('--supervisor');

if (!username || !password) {
  console.error('Usage: node scripts/create-user.js --username <name> --password <pass> [--supervisor]');
  process.exit(1);
}

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });

  try {
    const existing = await pool.query('SELECT id FROM users WHERE username = $1', [username]);
    if (existing.rows.length > 0) {
      console.error(`User "${username}" already exists.`);
      process.exit(1);
    }

    const hash = await hashPassword(password);
    const result = await pool.query(
      'INSERT INTO users (username, password_hash, is_supervisor) VALUES ($1, $2, $3) RETURNING id, username, is_supervisor',
      [username, hash, isSupervisor]
    );

    const user = result.rows[0];
    console.log(`Created user: ${user.username} (id: ${user.id}, supervisor: ${user.is_supervisor})`);
  } catch (error) {
    console.error('Failed to create user:', error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();
