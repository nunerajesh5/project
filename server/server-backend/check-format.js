const { Pool } = require('pg');

const pool = new Pool({
  user: 'postgres',
  password: 'Super@123',
  host: 'localhost',
  port: 5432,
  database: 'project_time_manager'
});

async function checkFormat() {
  try {
    // Check column data type
    const typeResult = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'projects' AND column_name = 'team_members'
    `);
    console.log('Column Type:', typeResult.rows[0]);

    // Check sample data
    const dataResult = await pool.query('SELECT name, team_members FROM projects LIMIT 2');
    console.log('\nSample Data:');
    dataResult.rows.forEach(row => {
      console.log('Project:', row.name);
      console.log('team_members:', row.team_members);
      console.log('Type of team_members:', typeof row.team_members);
      console.log('');
    });
  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await pool.end();
  }
}

checkFormat();
