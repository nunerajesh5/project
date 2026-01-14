const { Pool } = require('pg');

const pool = new Pool({
  host: 'localhost',
  user: 'postgres',
  password: 'Super@123',
  database: 'project_time_manager',
  port: 5432
});

async function checkEmployees() {
  try {
    // Check users table structure
    const columns = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'users' 
      ORDER BY ordinal_position
    `);
    
    console.log('=== Users Table Columns ===\n');
    columns.rows.forEach(row => {
      console.log(`  ${row.column_name}: ${row.data_type}`);
    });
    
    // Get all users/employees
    const users = await pool.query(`
      SELECT user_id, first_name, last_name, email_id, role, department_id 
      FROM users 
      ORDER BY created_at
    `);
    
    console.log('\n=== Current Employees ===\n');
    users.rows.forEach((user, i) => {
      console.log(`${i + 1}. ${user.first_name} ${user.last_name}`);
      console.log(`   ID: ${user.user_id}`);
      console.log(`   Email: ${user.email_id}`);
      console.log(`   Role: ${user.role}`);
      console.log('');
    });
    
    console.log(`Total: ${users.rows.length} employees`);
    
  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await pool.end();
  }
}

checkEmployees();
