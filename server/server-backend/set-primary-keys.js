const { Pool } = require('pg');

const pool = new Pool({
  host: 'localhost',
  user: 'postgres',
  password: 'Super@123',
  database: 'project_time_manager',
  port: 5432
});

async function setPrimaryKeys() {
  const tables = [
    { table: 'clients', pk: 'client_id' },
    { table: 'countries', pk: 'country_id' },
    { table: 'departments', pk: 'department_id' },
    { table: 'designations', pk: 'designation_id' },
    { table: 'states', pk: 'state_id' },
    { table: 'projects', pk: 'project_id' },
    { table: 'tasks', pk: 'task_id' },
  ];

  for (const { table, pk } of tables) {
    try {
      // Check if table exists
      const tableExists = await pool.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_name = $1
        )
      `, [table]);

      if (!tableExists.rows[0].exists) {
        console.log(`⚠️  Table '${table}' does not exist, skipping...`);
        continue;
      }

      // Check if primary key already exists
      const pkCheck = await pool.query(`
        SELECT constraint_name FROM information_schema.table_constraints 
        WHERE table_name = $1 AND constraint_type = 'PRIMARY KEY'
      `, [table]);

      if (pkCheck.rows.length > 0) {
        console.log(`✅ ${table}: Primary key already exists (${pkCheck.rows[0].constraint_name})`);
      } else {
        // Add primary key
        await pool.query(`ALTER TABLE ${table} ADD PRIMARY KEY (${pk})`);
        console.log(`✅ ${table}: Primary key added on ${pk}`);
      }
    } catch (err) {
      console.error(`❌ ${table}: Error - ${err.message}`);
    }
  }

  // Show summary
  console.log('\n--- Summary of Primary Keys ---');
  for (const { table, pk } of tables) {
    try {
      const result = await pool.query(`
        SELECT kcu.column_name
        FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu 
          ON tc.constraint_name = kcu.constraint_name
        WHERE tc.table_name = $1 AND tc.constraint_type = 'PRIMARY KEY'
      `, [table]);
      
      if (result.rows.length > 0) {
        console.log(`  ${table}: ${result.rows.map(r => r.column_name).join(', ')}`);
      }
    } catch (err) {
      // Skip if table doesn't exist
    }
  }

  pool.end();
}

setPrimaryKeys();
