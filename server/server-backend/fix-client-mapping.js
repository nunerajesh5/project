const { Pool } = require('pg');
const pool = new Pool({
  host: 'localhost',
  port: 5432,
  database: 'project_time_manager',
  user: 'postgres',
  password: 'Super@123',
});

async function fixClientMapping() {
  try {
    // Get all clients
    const clients = await pool.query('SELECT client_id, first_name, last_name FROM clients ORDER BY client_id');
    console.log(`Found ${clients.rows.length} clients`);
    
    if (clients.rows.length === 0) {
      console.log('No clients found! Need to create clients first.');
      return;
    }
    
    // Get all unique client_ids from projects that don't exist in clients
    const orphanedClients = await pool.query(`
      SELECT DISTINCT p.client_id
      FROM projects p
      LEFT JOIN clients c ON p.client_id = c.client_id
      WHERE c.client_id IS NULL
    `);
    
    console.log(`\nFound ${orphanedClients.rows.length} orphaned client references in projects`);
    
    // Map each orphaned client_id to an actual client (round-robin)
    let clientIndex = 0;
    for (const orphan of orphanedClients.rows) {
      const targetClient = clients.rows[clientIndex % clients.rows.length];
      
      console.log(`\nUpdating projects with client_id ${orphan.client_id}`);
      console.log(`  -> Mapping to: ${targetClient.first_name} ${targetClient.last_name} (${targetClient.client_id})`);
      
      const result = await pool.query(
        'UPDATE projects SET client_id = $1 WHERE client_id = $2',
        [targetClient.client_id, orphan.client_id]
      );
      
      console.log(`  Updated ${result.rowCount} projects`);
      clientIndex++;
    }
    
    // Verify the fix
    console.log('\n=== VERIFICATION ===');
    const verification = await pool.query(`
      SELECT COUNT(*) as total_projects,
             COUNT(c.client_id) as matched_projects
      FROM projects p
      LEFT JOIN clients c ON p.client_id = c.client_id
    `);
    console.log('After fix:', verification.rows[0]);
    
    // Show sample projects with client names
    const sample = await pool.query(`
      SELECT p.project_name, 
             COALESCE(c.first_name || ' ' || c.last_name, 'Unknown Client') as client_name
      FROM projects p
      LEFT JOIN clients c ON p.client_id = c.client_id
      LIMIT 5
    `);
    console.log('\nSample projects with clients:');
    sample.rows.forEach(row => {
      console.log(`  ${row.project_name} -> ${row.client_name}`);
    });
    
  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await pool.end();
  }
}

fixClientMapping();
