const { Pool } = require('pg');

const pool = new Pool({
  host: 'localhost',
  user: 'postgres',
  password: 'Super@123',
  database: 'project_time_manager',
  port: 5432
});

async function checkAuditLogs() {
  try {
    // Get table structure
    const columns = await pool.query(`
      SELECT column_name, data_type, is_nullable 
      FROM information_schema.columns 
      WHERE table_name = 'audit_logs' 
      ORDER BY ordinal_position
    `);
    
    console.log('=== audit_logs Table Structure ===\n');
    if (columns.rows.length === 0) {
      console.log('Table does not exist!');
    } else {
      columns.rows.forEach(row => {
        console.log(`  ${row.column_name}: ${row.data_type}${row.is_nullable === 'NO' ? ' (required)' : ''}`);
      });
      
      // Get sample data
      const sample = await pool.query(`SELECT * FROM audit_logs LIMIT 5`);
      console.log('\n=== Sample Data ===\n');
      console.log('Total rows:', sample.rowCount);
      if (sample.rows.length > 0) {
        sample.rows.forEach((row, i) => {
          console.log(`\nRecord ${i + 1}:`, JSON.stringify(row, null, 2));
        });
      } else {
        console.log('No data in the table yet.');
      }
    }
    
  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await pool.end();
  }
}

checkAuditLogs();
