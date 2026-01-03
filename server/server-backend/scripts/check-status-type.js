const { Pool } = require('pg');

const pool = new Pool({
  host: 'localhost',
  port: 5432,
  database: 'project_time_manager',
  user: 'postgres',
  password: 'Super@123'
});

async function checkStatusType() {
  try {
    // Check column type
    const colResult = await pool.query(`
      SELECT column_name, data_type, udt_name 
      FROM information_schema.columns 
      WHERE table_name = 'projects' AND column_name = 'status'
    `);
    console.log('Status column type:', JSON.stringify(colResult.rows, null, 2));

    // Check current statuses
    const statusResult = await pool.query(`SELECT DISTINCT status FROM projects ORDER BY status`);
    console.log('Current statuses:', statusResult.rows.map(r => r.status));

    pool.end();
  } catch (err) {
    console.error('Error:', err.message);
    pool.end();
  }
}

checkStatusType();
