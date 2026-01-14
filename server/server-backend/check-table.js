const { Pool } = require('pg');
const pool = new Pool({ 
  host: 'localhost', 
  port: 5432, 
  database: 'project_time_manager', 
  user: 'postgres', 
  password: 'Super@123' 
});

async function checkTable() {
  try {
    const res = await pool.query(`
      SELECT column_name, data_type, is_nullable, column_default, character_maximum_length 
      FROM information_schema.columns 
      WHERE table_name = 'time_entries' 
      ORDER BY ordinal_position
    `);
    console.log('=== project_attachments Table Columns ===\n');
    res.rows.forEach(c => {
      console.log(`Column: ${c.column_name}`);
      console.log(`  Type: ${c.data_type}${c.character_maximum_length ? `(${c.character_maximum_length})` : ''}`);
      console.log(`  Nullable: ${c.is_nullable}`);
      console.log(`  Default: ${c.column_default || 'None'}`);
      console.log('');
    });
  } catch (e) {
    console.error(e);
  } finally {
    pool.end();
  }
}

checkTable();
