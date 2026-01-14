const { Pool } = require('pg');
const pool = new Pool({
  host: 'localhost',
  port: 5432,
  database: 'project_time_manager',
  user: 'postgres',
  password: 'Super@123'
});

async function check() {
  // Check employee_documents table structure
  const cols = await pool.query(`
    SELECT column_name, data_type, is_nullable
    FROM information_schema.columns 
    WHERE table_name = 'employee_documents' 
    ORDER BY ordinal_position
  `);
  
  console.log('=== employee_documents Table Structure ===');
  cols.rows.forEach(col => {
    console.log(`  ${col.column_name}: ${col.data_type}`);
  });
  
  // Check if there's any data
  const count = await pool.query('SELECT COUNT(*) as count FROM employee_documents');
  console.log('\nTotal rows in employee_documents:', count.rows[0].count);
  
  // Sample data if any
  if (parseInt(count.rows[0].count) > 0) {
    const sample = await pool.query('SELECT * FROM employee_documents LIMIT 3');
    console.log('\nSample data:');
    sample.rows.forEach((row, i) => {
      console.log(`Row ${i+1}:`, JSON.stringify(row, null, 2));
    });
  }
  
  // Check users table photograph and aadhaar_image columns
  console.log('\n=== Users Table - photograph & aadhaar_image ===');
  const users = await pool.query(`
    SELECT user_id, first_name, last_name, photograph, aadhaar_image 
    FROM users LIMIT 5
  `);
  users.rows.forEach(u => {
    console.log(`${u.first_name} ${u.last_name}:`);
    console.log(`  photograph: ${u.photograph || 'NULL'}`);
    console.log(`  aadhaar_image: ${u.aadhaar_image || 'NULL'}`);
  });
  
  await pool.end();
}
check().catch(console.error);
