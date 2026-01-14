const { Pool } = require('pg');

const pool = new Pool({
  host: 'localhost',
  user: 'postgres',
  password: 'Super@123',
  database: 'project_time_manager',
  port: 5432
});

async function addClientIdToTasks() {
  try {
    // Add primary key to clients table if not exists
    const pkCheck = await pool.query(`
      SELECT constraint_name FROM information_schema.table_constraints 
      WHERE table_name = 'clients' AND constraint_type = 'PRIMARY KEY'
    `);
    
    if (pkCheck.rows.length === 0) {
      await pool.query(`ALTER TABLE clients ADD PRIMARY KEY (client_id)`);
      console.log('✅ Primary key added to clients table on client_id');
    } else {
      console.log('Primary key already exists on clients table');
    }

    // Now add foreign key constraint to tasks.client_id
    try {
      await pool.query(`
        ALTER TABLE tasks 
        ADD CONSTRAINT fk_tasks_client_id 
        FOREIGN KEY (client_id) REFERENCES clients(client_id) ON DELETE SET NULL
      `);
      console.log('✅ Foreign key constraint added to tasks.client_id');
    } catch (fkErr) {
      if (fkErr.message.includes('already exists')) {
        console.log('Foreign key constraint already exists');
      } else {
        console.log('Note:', fkErr.message);
      }
    }

    // Show updated table structure
    const result = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'tasks' 
      ORDER BY ordinal_position
    `);
    
    console.log('\nTasks table columns:');
    result.rows.forEach(row => {
      console.log(`  ${row.column_name}: ${row.data_type}`);
    });

  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    pool.end();
  }
}

addClientIdToTasks();
