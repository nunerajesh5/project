const { Pool } = require('pg');

const pool = new Pool({
  host: 'localhost',
  port: 5432,
  database: 'project_time_manager',
  user: 'postgres',
  password: 'Super@123'
});

async function check() {
  try {
    // Check column types
    const colTypes = await pool.query(`
      SELECT table_name, column_name, data_type, udt_name 
      FROM information_schema.columns 
      WHERE table_name IN ('projects', 'tasks') 
      AND column_name IN ('team_member_ids', 'assigned_to')
    `);
    
    console.log('\n=== Column Data Types ===');
    console.table(colTypes.rows);
    
    // Check actual data
    console.log('\n=== Projects team_member_ids (sample) ===');
    const projects = await pool.query('SELECT project_name, team_member_ids FROM projects LIMIT 2');
    projects.rows.forEach(row => {
      console.log(`${row.project_name}:`, row.team_member_ids);
    });
    
    console.log('\n=== Tasks assigned_to (sample) ===');
    const tasks = await pool.query('SELECT task_name, assigned_to FROM tasks LIMIT 2');
    tasks.rows.forEach(row => {
      console.log(`${row.task_name}:`, row.assigned_to);
    });
    
  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await pool.end();
  }
}

check();
