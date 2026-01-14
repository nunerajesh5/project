const { Pool } = require('pg');
const pool = new Pool({
  host: 'localhost',
  port: 5432,
  database: 'project_time_manager',
  user: 'postgres',
  password: 'Super@123',
});

async function dropTriggers() {
  try {
    console.log('Dropping trigger task_set_project_name...');
    await pool.query('DROP TRIGGER IF EXISTS task_set_project_name ON tasks');
    console.log('✓ Dropped');
    
    console.log('\nDropping trigger task_set_employee_name...');
    await pool.query('DROP TRIGGER IF EXISTS task_set_employee_name ON tasks');
    console.log('✓ Dropped');
    
    console.log('\n✅ All triggers dropped!');
    
  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await pool.end();
  }
}

dropTriggers();
