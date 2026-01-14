const { Pool } = require('pg');
const pool = new Pool({
  host: 'localhost',
  port: 5432,
  database: 'project_time_manager',
  user: 'postgres',
  password: 'Super@123'
});

async function checkUsers() {
  // Check users table structure
  const columns = await pool.query(`
    SELECT column_name, data_type, is_nullable
    FROM information_schema.columns 
    WHERE table_name = 'users' 
    ORDER BY ordinal_position
  `);
  
  console.log('=== Users Table Structure ===');
  columns.rows.forEach(col => {
    console.log(`  ${col.column_name}: ${col.data_type} (${col.is_nullable === 'YES' ? 'nullable' : 'NOT NULL'})`);
  });
  
  // Check sample data for the problem fields
  const sample = await pool.query(`
    SELECT user_id, first_name, last_name, email_id, salutation, date_of_birth, address, photograph, aadhaar_number, joining_date, country_id, state_id
    FROM users LIMIT 5
  `);
  
  console.log('\n=== Sample User Data ===');
  sample.rows.forEach((row, i) => {
    console.log(`\nUser ${i+1}: ${row.first_name} ${row.last_name} (${row.email_id})`);
    console.log(`  salutation: ${row.salutation}`);
    console.log(`  date_of_birth: ${row.date_of_birth}`);
    console.log(`  address: ${row.address}`);
    console.log(`  photograph: ${row.photograph ? 'Has photo' : 'NULL'}`);
    console.log(`  aadhaar_number: ${row.aadhaar_number}`);
    console.log(`  joining_date: ${row.joining_date}`);
    console.log(`  country_id: ${row.country_id}`);
    console.log(`  state_id: ${row.state_id}`);
  });
  
  // Count NULLs
  const nullCounts = await pool.query(`
    SELECT 
      COUNT(*) as total,
      COUNT(*) FILTER (WHERE salutation IS NULL) as salutation_null,
      COUNT(*) FILTER (WHERE date_of_birth IS NULL) as dob_null,
      COUNT(*) FILTER (WHERE address IS NULL) as address_null,
      COUNT(*) FILTER (WHERE photograph IS NULL) as photo_null,
      COUNT(*) FILTER (WHERE aadhaar_number IS NULL) as aadhaar_null,
      COUNT(*) FILTER (WHERE joining_date IS NULL) as joining_null,
      COUNT(*) FILTER (WHERE country_id IS NULL) as country_null,
      COUNT(*) FILTER (WHERE state_id IS NULL) as state_null
    FROM users
  `);
  
  console.log('\n=== NULL Counts ===');
  const nc = nullCounts.rows[0];
  console.log(`Total users: ${nc.total}`);
  console.log(`salutation NULL: ${nc.salutation_null}`);
  console.log(`date_of_birth NULL: ${nc.dob_null}`);
  console.log(`address NULL: ${nc.address_null}`);
  console.log(`photograph NULL: ${nc.photo_null}`);
  console.log(`aadhaar_number NULL: ${nc.aadhaar_null}`);
  console.log(`joining_date NULL: ${nc.joining_null}`);
  console.log(`country_id NULL: ${nc.country_null}`);
  console.log(`state_id NULL: ${nc.state_null}`);
  
  await pool.end();
}
checkUsers().catch(console.error);
