const { Pool } = require('pg');

const pool = new Pool({
  host: 'localhost',
  port: 5432,
  database: 'project_time_manager',
  user: 'postgres',
  password: 'Super@123'
});

async function run() {
  try {
    // Remove columns
    await pool.query(`
      ALTER TABLE projects 
      DROP COLUMN IF EXISTS complexity, 
      DROP COLUMN IF EXISTS technologies, 
      DROP COLUMN IF EXISTS risk_level;
    `);
    console.log('Columns complexity, technologies, risk_level removed from projects table');

    // Check current statuses
    const result = await pool.query('SELECT DISTINCT status FROM projects;');
    console.log('Current statuses:', result.rows.map(r => r.status));

    // Normalize statuses to: To Do, Active, Completed, On Hold, Cancelled
    await pool.query(`UPDATE projects SET status = 'To Do' WHERE LOWER(status) IN ('pending', 'todo', 'to do', 'to_do');`);
    await pool.query(`UPDATE projects SET status = 'Active' WHERE LOWER(status) IN ('active', 'in progress', 'in_progress', 'inprogress');`);
    await pool.query(`UPDATE projects SET status = 'Completed' WHERE LOWER(status) IN ('completed', 'done', 'finished');`);
    await pool.query(`UPDATE projects SET status = 'On Hold' WHERE LOWER(status) IN ('on hold', 'on_hold', 'onhold', 'paused');`);
    await pool.query(`UPDATE projects SET status = 'Cancelled' WHERE LOWER(status) IN ('cancelled', 'canceled', 'cancel');`);

    // Check updated statuses
    const result2 = await pool.query('SELECT DISTINCT status FROM projects;');
    console.log('Updated statuses:', result2.rows.map(r => r.status));

    pool.end();
  } catch (err) {
    console.error('Error:', err.message);
    pool.end();
  }
}

run();
