const { Pool } = require('pg');
const pool = new Pool({
  host: 'localhost',
  port: 5432,
  database: 'project_time_manager',
  user: 'postgres',
  password: 'Super@123',
});

async function checkTaskMapping() {
  try {
    // Check projects table
    console.log('=== PROJECTS TABLE ===');
    const projects = await pool.query('SELECT project_id, project_name FROM projects LIMIT 5');
    console.log('Sample projects:', projects.rows);
    
    // Check tasks table
    console.log('\n=== TASKS TABLE ===');
    const tasks = await pool.query('SELECT task_id, task_name, project_id FROM tasks LIMIT 5');
    console.log('Sample tasks:', tasks.rows);
    
    // Test the JOIN
    console.log('\n=== JOIN TEST ===');
    const joined = await pool.query(`
      SELECT t.task_id, t.task_name, t.project_id, 
             p.project_name,
             p.project_id as matched_project_id
      FROM tasks t
      LEFT JOIN projects p ON t.project_id = p.project_id
      LIMIT 5
    `);
    console.log('Joined result:', joined.rows);
    
    // Check if there are any matching project_ids
    console.log('\n=== CHECKING MATCHES ===');
    const matches = await pool.query(`
      SELECT COUNT(*) as total_tasks,
             COUNT(p.project_id) as matched_tasks
      FROM tasks t
      LEFT JOIN projects p ON t.project_id = p.project_id
    `);
    console.log('Match stats:', matches.rows[0]);
    
    // Show orphaned tasks (tasks without matching projects)
    console.log('\n=== ORPHANED TASKS ===');
    const orphaned = await pool.query(`
      SELECT t.task_id, t.task_name, t.project_id
      FROM tasks t
      LEFT JOIN projects p ON t.project_id = p.project_id
      WHERE p.project_id IS NULL
      LIMIT 10
    `);
    console.log(`Found ${orphaned.rows.length} orphaned tasks:`);
    orphaned.rows.forEach(row => {
      console.log(`  ${row.task_name} -> project_id: ${row.project_id}`);
    });
    
    // Check unique orphaned project_ids
    const uniqueOrphaned = await pool.query(`
      SELECT DISTINCT t.project_id
      FROM tasks t
      LEFT JOIN projects p ON t.project_id = p.project_id
      WHERE p.project_id IS NULL
    `);
    console.log(`\nUnique orphaned project_ids in tasks: ${uniqueOrphaned.rows.length}`);
    uniqueOrphaned.rows.forEach(row => {
      console.log(`  ${row.project_id}`);
    });
    
  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await pool.end();
  }
}

checkTaskMapping();
