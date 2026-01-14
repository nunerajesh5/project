const { Pool } = require('pg');
const pool = new Pool({
  host: 'localhost',
  port: 5432,
  database: 'project_time_manager',
  user: 'postgres',
  password: 'Super@123',
});

async function checkClientMapping() {
  try {
    // Check clients table
    console.log('=== CLIENTS TABLE ===');
    const clients = await pool.query('SELECT client_id, first_name, last_name FROM clients LIMIT 5');
    console.log('Sample clients:', clients.rows);
    
    // Check projects table
    console.log('\n=== PROJECTS TABLE ===');
    const projects = await pool.query('SELECT project_id, project_name, client_id FROM projects LIMIT 5');
    console.log('Sample projects:', projects.rows);
    
    // Test the JOIN
    console.log('\n=== JOIN TEST ===');
    const joined = await pool.query(`
      SELECT p.project_id, p.project_name, p.client_id, 
             COALESCE(c.first_name || ' ' || c.last_name, 'Unknown Client') as client_name,
             c.client_id as matched_client_id
      FROM projects p
      LEFT JOIN clients c ON p.client_id = c.client_id
      LIMIT 5
    `);
    console.log('Joined result:', joined.rows);
    
    // Check if there are any matching client_ids
    console.log('\n=== CHECKING MATCHES ===');
    const matches = await pool.query(`
      SELECT COUNT(*) as total_projects,
             COUNT(c.client_id) as matched_projects
      FROM projects p
      LEFT JOIN clients c ON p.client_id = c.client_id
    `);
    console.log('Match stats:', matches.rows[0]);
    
  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await pool.end();
  }
}

checkClientMapping();
