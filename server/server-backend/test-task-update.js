const { Pool } = require('pg');
const pool = new Pool({
  host: 'localhost',
  port: 5432,
  database: 'project_time_manager',
  user: 'postgres',
  password: 'Super@123',
});

async function checkTasksTable() {
  try {
    // Check if tasks is a table or view
    const tableInfo = await pool.query(`
      SELECT table_type 
      FROM information_schema.tables 
      WHERE table_name = 'tasks'
    `);
    console.log('Tasks table type:', tableInfo.rows[0]);
    
    // Try a simple update
    console.log('\nTrying to update one task...');
    const result = await pool.query(`
      UPDATE tasks 
      SET project_id = '0191a9e2-5adc-4837-9025-614197a89c21' 
      WHERE task_id = '9a239d54-6204-4a82-b5f3-70e25dbcb37e'
    `);
    console.log('Update successful! Rows affected:', result.rowCount);
    
  } catch (err) {
    console.error('Error:', err.message);
    console.error('Detail:', err.detail);
    console.error('Hint:', err.hint);
  } finally {
    await pool.end();
  }
}

checkTasksTable();
