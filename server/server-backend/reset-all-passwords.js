const { Pool } = require('pg');
const bcrypt = require('bcryptjs');

const pool = new Pool({
  user: 'postgres',
  password: 'Super@123',
  host: 'localhost',
  port: 5432,
  database: 'project_time_manager'
});

async function resetAllPasswords() {
  try {
    const defaultPassword = 'password123';
    const hash = await bcrypt.hash(defaultPassword, 10);
    
    console.log('Resetting ALL user passwords to "password123"...\n');

    // Update all users
    const result = await pool.query(
      'UPDATE users SET password_hash = $1 RETURNING email, first_name, last_name, role', 
      [hash]
    );
    
    console.log('✅ Reset passwords for the following users:\n');
    console.log('='.repeat(75));
    console.log('Email'.padEnd(30) + 'Name'.padEnd(20) + 'Role'.padEnd(12) + 'Password');
    console.log('='.repeat(75));
    
    result.rows.forEach(u => {
      console.log(
        u.email.padEnd(30) + 
        (u.first_name + ' ' + u.last_name).padEnd(20) + 
        u.role.padEnd(12) + 
        'password123'
      );
    });

    console.log('='.repeat(75));
    console.log(`\n✅ Total: ${result.rowCount} users updated.`);
    console.log('\n🔐 All users can now login with password: password123');

  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await pool.end();
  }
}

resetAllPasswords();
