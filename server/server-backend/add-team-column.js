const { Pool } = require('pg');
const pool = new Pool({
  host: 'localhost',
  port: 5432,
  database: 'project_time_manager',
  user: 'postgres',
  password: 'Super@123',
});

async function addTeamColumn() {
  try {
    console.log('Adding team_member_ids column to projects table...');
    await pool.query(`
      ALTER TABLE projects 
      ADD COLUMN IF NOT EXISTS team_member_ids UUID[]
    `);
    console.log('✓ Column added');
    
    // Assign random employees to each project
    console.log('\nAssigning employees to projects...');
    
    // Get all employees (exclude admin)
    const employees = await pool.query(`
      SELECT user_id, first_name, last_name, role 
      FROM users 
      WHERE role IN ('employee', 'manager')
      ORDER BY user_id
    `);
    console.log(`Found ${employees.rows.length} employees/managers`);
    
    // Get all projects
    const projects = await pool.query('SELECT project_id, project_name FROM projects');
    console.log(`Found ${projects.rows.length} projects`);
    
    // Assign 2-4 random employees to each project
    for (const project of projects.rows) {
      const teamSize = Math.floor(Math.random() * 3) + 2; // 2-4 employees
      const teamMembers = [];
      
      // Randomly select employees
      const shuffled = [...employees.rows].sort(() => Math.random() - 0.5);
      for (let i = 0; i < Math.min(teamSize, employees.rows.length); i++) {
        teamMembers.push(shuffled[i].user_id);
      }
      
      await pool.query(
        'UPDATE projects SET team_member_ids = $1 WHERE project_id = $2',
        [teamMembers, project.project_id]
      );
      
      console.log(`  ${project.project_name}: ${teamSize} team members`);
    }
    
    console.log('\n✅ All projects have been assigned team members!');
    
    // Show sample
    const sample = await pool.query(`
      SELECT p.project_name, p.team_member_ids
      FROM projects p
      LIMIT 5
    `);
    console.log('\nSample assignments:');
    sample.rows.forEach(row => {
      console.log(`  ${row.project_name}: ${row.team_member_ids.length} members`);
    });
    
  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await pool.end();
  }
}

addTeamColumn();
