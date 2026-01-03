const { Pool } = require('pg');

const pool = new Pool({
  user: 'postgres',
  password: 'Super@123',
  host: 'localhost',
  port: 5432,
  database: 'project_time_manager'
});

async function listEmployees() {
  try {
    // First get the columns to understand the table structure
    const colResult = await pool.query(`
      SELECT column_name FROM information_schema.columns WHERE table_name = 'employees'
    `);
    console.log('Available columns:', colResult.rows.map(c => c.column_name).join(', '));

    const result = await pool.query(`
      SELECT * FROM employees ORDER BY first_name
    `);

    console.log('\n📋 Employee Credentials:\n');
    console.log('='.repeat(85));
    console.log('Name'.padEnd(22) + 'Email'.padEnd(35) + 'Department');
    console.log('='.repeat(85));
    
    result.rows.forEach(e => {
      console.log(
        (e.first_name + ' ' + e.last_name).padEnd(22) + 
        e.email.padEnd(35) + 
        (e.department || 'N/A')
      );
    });

    console.log('='.repeat(85));
    console.log(`\nTotal Employees: ${result.rows.length}`);
    console.log('\n💡 Default password for all employees: password123');
    
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await pool.end();
  }
}

listEmployees();
