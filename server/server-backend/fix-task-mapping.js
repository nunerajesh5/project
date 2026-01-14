const { Pool } = require('pg');
const pool = new Pool({
  host: 'localhost',
  port: 5432,
  database: 'project_time_manager',
  user: 'postgres',
  password: 'Super@123',
});

async function fixTaskMapping() {
  try {
    // Get all projects
    const projects = await pool.query('SELECT project_id, project_name FROM projects ORDER BY project_id');
    console.log(`Found ${projects.rows.length} projects`);
    
    if (projects.rows.length === 0) {
      console.log('No projects found!');
      return;
    }
    
    // Get all unique project_ids from tasks that don't exist in projects
    const orphanedProjects = await pool.query(`
      SELECT DISTINCT t.project_id, COUNT(*) as task_count
      FROM tasks t
      LEFT JOIN projects p ON t.project_id = p.project_id
      WHERE p.project_id IS NULL
      GROUP BY t.project_id
      ORDER BY task_count DESC
    `);
    
    console.log(`\nFound ${orphanedProjects.rows.length} orphaned project references in tasks`);
    console.log(`Total orphaned tasks: ${orphanedProjects.rows.reduce((sum, row) => sum + parseInt(row.task_count), 0)}`);
    
    // Map each orphaned project_id to an actual project (distribute evenly)
    let projectIndex = 0;
    for (const orphan of orphanedProjects.rows) {
      const targetProject = projects.rows[projectIndex % projects.rows.length];
      
      console.log(`\nUpdating ${orphan.task_count} tasks with project_id ${orphan.project_id}`);
      console.log(`  -> Mapping to: ${targetProject.project_name} (${targetProject.project_id})`);
      
      const result = await pool.query(
        'UPDATE tasks SET project_id = $1 WHERE project_id = $2',
        [targetProject.project_id, orphan.project_id]
      );
      
      console.log(`  Updated ${result.rowCount} tasks`);
      projectIndex++;
    }
    
    // Verify the fix
    console.log('\n=== VERIFICATION ===');
    const verification = await pool.query(`
      SELECT COUNT(*) as total_tasks,
             COUNT(p.project_id) as matched_tasks
      FROM tasks t
      LEFT JOIN projects p ON t.project_id = p.project_id
    `);
    console.log('After fix:', verification.rows[0]);
    
    // Show sample tasks with project names
    const sample = await pool.query(`
      SELECT t.task_name, 
             COALESCE(p.project_name, 'Unknown Project') as project_name
      FROM tasks t
      LEFT JOIN projects p ON t.project_id = p.project_id
      LIMIT 10
    `);
    console.log('\nSample tasks with projects:');
    sample.rows.forEach(row => {
      console.log(`  ${row.task_name} -> ${row.project_name}`);
    });
    
    // Show tasks per project
    console.log('\n=== TASKS PER PROJECT ===');
    const tasksPerProject = await pool.query(`
      SELECT p.project_name, COUNT(t.task_id) as task_count
      FROM projects p
      LEFT JOIN tasks t ON p.project_id = t.project_id
      GROUP BY p.project_id, p.project_name
      ORDER BY task_count DESC
      LIMIT 10
    `);
    tasksPerProject.rows.forEach(row => {
      console.log(`  ${row.project_name}: ${row.task_count} tasks`);
    });
    
  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await pool.end();
  }
}

fixTaskMapping();
