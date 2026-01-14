const { Pool } = require('pg');

const pool = new Pool({
  host: 'localhost',
  port: 5432,
  database: 'project_time_manager',
  user: 'postgres',
  password: 'Super@123',
});

async function checkAllTables() {
  try {
    // Get all tables
    console.log('=== ALL TABLES IN project_time_manager ===\n');
    const tables = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_type = 'BASE TABLE'
      ORDER BY table_name
    `);
    
    console.log('Tables found:', tables.rows.length);
    tables.rows.forEach(row => console.log(`  - ${row.table_name}`));
    
    // Check each important table structure
    for (const table of ['users', 'clients', 'projects', 'tasks', 'employees']) {
      console.log(`\n=== ${table.toUpperCase()} TABLE ===`);
      try {
        const columns = await pool.query(`
          SELECT column_name, data_type, is_nullable
          FROM information_schema.columns
          WHERE table_name = $1
          ORDER BY ordinal_position
        `, [table]);
        
        if (columns.rows.length > 0) {
          columns.rows.forEach(row => {
            console.log(`  ${row.column_name}: ${row.data_type} (nullable: ${row.is_nullable})`);
          });
        } else {
          console.log('  Table not found');
        }
      } catch (err) {
        console.log(`  Error: ${err.message}`);
      }
    }
  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await pool.end();
  }
}

checkAllTables();
