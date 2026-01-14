const { Pool } = require('pg');

const pool = new Pool({
  host: 'localhost',
  port: 5432,
  database: 'project_time_manager',
  user: 'postgres',
  password: 'Super@123'
});

async function convertToJsonb() {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    console.log('Step 1: Backing up current assigned_to values...');
    const backup = await client.query('SELECT task_id, assigned_to FROM tasks WHERE assigned_to IS NOT NULL');
    console.log(`Found ${backup.rows.length} tasks with assignments`);
    
    console.log('\nStep 2: Converting assigned_to column from UUID[] to JSONB...');
    
    // Convert UUID array to JSONB array
    await client.query(`
      ALTER TABLE tasks 
      ALTER COLUMN assigned_to TYPE JSONB 
      USING to_jsonb(assigned_to)
    `);
    
    console.log('✅ Column type changed to JSONB');
    
    // Set default to empty array
    await client.query(`
      ALTER TABLE tasks 
      ALTER COLUMN assigned_to SET DEFAULT '[]'::jsonb
    `);
    
    console.log('✅ Default value set to empty array []');
    
    // Update null values to empty array
    await client.query(`
      UPDATE tasks SET assigned_to = '[]'::jsonb WHERE assigned_to IS NULL
    `);
    
    console.log('✅ NULL values updated to empty array');
    
    await client.query('COMMIT');
    
    // Verify the change
    console.log('\nStep 3: Verifying changes...');
    const verify = await client.query(`
      SELECT column_name, data_type, udt_name 
      FROM information_schema.columns 
      WHERE table_name = 'tasks' AND column_name = 'assigned_to'
    `);
    console.table(verify.rows);
    
    const sample = await client.query('SELECT task_name, assigned_to FROM tasks LIMIT 3');
    console.log('\nSample data after conversion:');
    sample.rows.forEach(row => {
      console.log(`${row.task_name}:`, row.assigned_to);
    });
    
    console.log('\n✅ Tasks table assigned_to column is now JSONB (same as projects.team_member_ids)!');
    
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error:', err.message);
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

convertToJsonb();
