const { Pool } = require('pg');
const pool = new Pool({
  user: 'postgres',
  password: 'Super@123',
  host: 'localhost',
  port: 5432,
  database: 'project_time_manager'
});

async function checkTable(tableName) {
  console.log(`\n${'='.repeat(50)}`);
  console.log(`=== ${tableName} Table Analysis ===`);
  console.log('='.repeat(50));
  
  try {
    // Get table structure
    const cols = await pool.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns 
      WHERE table_name = $1 
      ORDER BY ordinal_position
    `, [tableName]);
    
    if (cols.rows.length === 0) {
      console.log(`Table '${tableName}' does not exist!`);
      return;
    }
    
    console.log('\nColumns:');
    cols.rows.forEach(c => console.log('  ', c.column_name, '-', c.data_type, c.is_nullable === 'YES' ? '(nullable)' : '(NOT NULL)'));
    
    // Get total count
    const count = await pool.query(`SELECT COUNT(*) as total FROM ${tableName}`);
    const total = parseInt(count.rows[0].total);
    console.log('\nTotal rows:', total);
    
    if (total > 0) {
      // Count NULLs for each column
      const countQuery = cols.rows.map(c => `COUNT("${c.column_name}") as "${c.column_name}"`).join(', ');
      const r = await pool.query(`SELECT ${countQuery} FROM ${tableName}`);
      
      console.log('\nNULL Analysis:');
      cols.rows.forEach(c => {
        const notNull = parseInt(r.rows[0][c.column_name]);
        const nullCount = total - notNull;
        const pct = Math.round(nullCount / total * 100);
        const status = nullCount > 0 ? '⚠️' : '✅';
        console.log('  ', status, c.column_name + ':', notNull, 'values,', nullCount, 'nulls (' + pct + '%)');
      });
      
      // Sample data
      console.log('\nSample Data (first 5 rows):');
      const sample = await pool.query(`SELECT * FROM ${tableName} LIMIT 5`);
      sample.rows.forEach((row, i) => {
        console.log((i + 1) + '.', JSON.stringify(row));
      });
    } else {
      console.log('Table is empty!');
    }
  } catch (e) {
    console.error('Error:', e.message);
  }
}

async function main() {
  await checkTable('countries');
  await checkTable('states');
  pool.end();
}

main();
