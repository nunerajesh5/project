const { Pool } = require('pg');

const pool = new Pool({
  user: 'postgres',
  password: 'Super@123',
  host: 'localhost',
  port: 5432,
  database: 'project_time_manager'
});

async function checkProjectStructure() {
  try {
    // Check projects table columns
    const projectCols = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'projects'
      ORDER BY ordinal_position
    `);
    
    console.log('📋 Projects Table Columns:');
    console.log('-'.repeat(50));
    projectCols.rows.forEach(c => console.log(`  ${c.column_name.padEnd(25)} ${c.data_type}`));

    // Check if there's a project_team_memberships table
    const teamTable = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'project_team_memberships'
      ORDER BY ordinal_position
    `);
    
    if (teamTable.rows.length > 0) {
      console.log('\n📋 Project Team Memberships Table Columns:');
      console.log('-'.repeat(50));
      teamTable.rows.forEach(c => console.log(`  ${c.column_name.padEnd(25)} ${c.data_type}`));
    }

    // Check task_assignments table
    const taskAssignTable = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'task_assignments'
      ORDER BY ordinal_position
    `);
    
    if (taskAssignTable.rows.length > 0) {
      console.log('\n📋 Task Assignments Table Columns:');
      console.log('-'.repeat(50));
      taskAssignTable.rows.forEach(c => console.log(`  ${c.column_name.padEnd(25)} ${c.data_type}`));
    }

    // Show sample projects with their team members
    console.log('\n📋 Projects with Team Members:');
    console.log('='.repeat(100));
    
    const projectsWithTeams = await pool.query(`
      SELECT 
        p.id,
        p.name as project_name,
        p.status,
        COALESCE(
          STRING_AGG(DISTINCT CONCAT(e.first_name, ' ', e.last_name), ', '),
          'No team members'
        ) as team_members
      FROM projects p
      LEFT JOIN project_team_memberships ptm ON p.id = ptm.project_id
      LEFT JOIN employees e ON ptm.employee_id = e.id
      GROUP BY p.id, p.name, p.status
      ORDER BY p.name
      LIMIT 15
    `);

    console.log('Project Name'.padEnd(35) + 'Status'.padEnd(15) + 'Team Members');
    console.log('-'.repeat(100));
    
    projectsWithTeams.rows.forEach(p => {
      console.log(
        (p.project_name || 'N/A').substring(0, 33).padEnd(35) +
        (p.status || 'N/A').padEnd(15) +
        (p.team_members || 'None').substring(0, 50)
      );
    });

  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await pool.end();
  }
}

checkProjectStructure();
