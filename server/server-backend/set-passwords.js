const { Pool } = require('pg');
const bcrypt = require('bcryptjs');

const pool = new Pool({
  user: 'postgres',
  password: 'Super@123',
  host: 'localhost',
  port: 5432,
  database: 'project_time_manager'
});

async function setPasswords() {
  try {
    const defaultPassword = 'password123';
    const saltRounds = 10;
    
    // Hash the password
    const hashedPassword = await bcrypt.hash(defaultPassword, saltRounds);
    console.log('Generated hash for "password123":', hashedPassword);

    // Update all users with the hashed password
    const result = await pool.query(`
      UPDATE users 
      SET password_hash = $1 
      WHERE password_hash IS NULL OR password_hash = ''
    `, [hashedPassword]);

    console.log(`\n✅ Updated ${result.rowCount} users with password hash.`);

    // Verify the update
    const users = await pool.query('SELECT email, first_name, last_name, role, password_hash FROM users');
    
    console.log('\n📋 Updated Users:');
    console.log('='.repeat(80));
    console.log('Email'.padEnd(30) + 'Name'.padEnd(20) + 'Role'.padEnd(12) + 'Has Password');
    console.log('='.repeat(80));
    
    users.rows.forEach(u => {
      console.log(
        u.email.padEnd(30) + 
        (u.first_name + ' ' + u.last_name).padEnd(20) + 
        u.role.padEnd(12) + 
        (u.password_hash ? '✅ Yes' : '❌ No')
      );
    });

    console.log('\n💡 All users can now login with password: password123');

  } catch (error) {
    console.error('Error:', error.message);
    if (error.message.includes('bcrypt')) {
      console.log('\nTrying without bcrypt...');
      // If bcrypt is not available, try with a plain hash or check the auth mechanism
      const users = await pool.query('SELECT * FROM users LIMIT 1');
      console.log('User columns:', Object.keys(users.rows[0]));
    }
  } finally {
    await pool.end();
  }
}

setPasswords();
