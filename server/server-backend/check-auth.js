const { Pool } = require('pg');

const pool = new Pool({
  user: 'postgres',
  password: 'Super@123',
  host: 'localhost',
  port: 5432,
  database: 'project_time_manager'
});

async function checkAuth() {
  try {
    // Get all tables
    const tables = await pool.query(`
      SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'
    `);
    console.log('Tables in database:');
    tables.rows.forEach(t => console.log('- ' + t.table_name));

    // Check if users table exists
    const usersTable = tables.rows.find(t => t.table_name === 'users');
    
    if (usersTable) {
      console.log('\n📋 Users Table Contents:');
      const users = await pool.query('SELECT * FROM users');
      console.log('Columns:', Object.keys(users.rows[0] || {}).join(', '));
      console.log('\n');
      users.rows.forEach(u => {
        console.log(`Name: ${u.name || u.first_name || 'N/A'}`);
        console.log(`Email: ${u.email}`);
        console.log(`Role: ${u.role || 'N/A'}`);
        console.log(`Password Hash: ${u.password ? u.password.substring(0, 20) + '...' : 'N/A'}`);
        console.log('-'.repeat(50));
      });
    }

  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await pool.end();
  }
}

checkAuth();
