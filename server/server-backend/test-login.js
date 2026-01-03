const { Pool } = require('pg');
const bcrypt = require('bcryptjs');

const pool = new Pool({
  user: 'postgres',
  password: 'Super@123',
  host: 'localhost',
  port: 5432,
  database: 'project_time_manager'
});

async function testLogin() {
  try {
    const email = 'diana@company.com';
    const password = 'password123';
    
    console.log(`Testing login for: ${email}`);
    console.log(`Password: ${password}\n`);

    const result = await pool.query(
      'SELECT id, email, password_hash, first_name, last_name, role FROM users WHERE email = $1', 
      [email]
    );
    
    if (result.rows.length === 0) {
      console.log('❌ User not found!');
      return;
    }

    const user = result.rows[0];
    console.log('User found:', {
      email: user.email,
      name: user.first_name + ' ' + user.last_name,
      role: user.role,
      hasPasswordHash: !!user.password_hash,
      passwordHashLength: user.password_hash ? user.password_hash.length : 0
    });

    console.log('\nPassword Hash:', user.password_hash);

    if (!user.password_hash) {
      console.log('\n❌ Password hash is NULL - need to set password!');
      
      // Set the password
      const hash = await bcrypt.hash(password, 10);
      await pool.query('UPDATE users SET password_hash = $1 WHERE email = $2', [hash, email]);
      console.log('✅ Password set! Try logging in now.');
      return;
    }

    // Test password comparison
    const isValid = await bcrypt.compare(password, user.password_hash);
    
    if (isValid) {
      console.log('\n✅ Password is CORRECT! Login should work.');
    } else {
      console.log('\n❌ Password is INCORRECT!');
      console.log('Resetting password...');
      const hash = await bcrypt.hash(password, 10);
      await pool.query('UPDATE users SET password_hash = $1 WHERE email = $2', [hash, email]);
      console.log('✅ Password reset! Try logging in now.');
    }

  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await pool.end();
  }
}

testLogin();
