const { Pool } = require('pg');

const pool = new Pool({
  host: 'localhost',
  port: 5432,
  database: 'project_time_manager',
  user: 'postgres',
  password: 'Super@123'
});

async function checkSchema() {
  try {
    console.log('Salaries table columns:');
    const salaries = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'salaries' 
      ORDER BY ordinal_position
    `);
    salaries.rows.forEach(c => console.log('  ' + c.column_name + ': ' + c.data_type));
    
  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await pool.end();
  }
}

checkSchema();
