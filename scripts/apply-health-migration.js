#!/usr/bin/env node
require('dotenv').config();
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });

  try {
    console.log('Applying supervisor health migration...');

    const sql = fs.readFileSync(
      path.join(__dirname, 'migrate_supervisor_health.sql'),
      'utf8'
    );

    await pool.query(sql);

    console.log('✅ Migration applied successfully!');
    console.log('Created views: user_learning_health, user_knowledge_weaknesses');
    console.log('Created function: get_team_strength_overview()');
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();
