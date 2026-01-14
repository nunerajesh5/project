const { Pool } = require('pg');
const pool = new Pool({
  host: 'localhost',
  port: 5432,
  database: 'project_time_manager',
  user: 'postgres',
  password: 'Super@123',
});

async function dropAndRecreate() {
  try {
    console.log('Dropping old project_employees table...');
    await pool.query('DROP TABLE IF EXISTS project_employees CASCADE');
    console.log('✓ Dropped');
    
    console.log('\nCreating project_employees table with UUID types...');
    await pool.query(`
      CREATE TABLE project_employees (
        project_id UUID NOT NULL,
        user_id UUID NOT NULL,
        added_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (project_id, user_id)
      )
    `);
    console.log('✓ Created project_employees table');
    
    // Get all users (employees)
    const users = await pool.query(`
      SELECT user_id, first_name, last_name, role 
      FROM users 
      WHERE is_active = true 
      ORDER BY user_id
    `);
    console.log(`\nFound ${users.rows.length} active users`);
    
    // Get all projects
    const projects = await pool.query('SELECT project_id, project_name FROM projects ORDER BY project_id');
    console.log(`Found ${projects.rows.length} projects`);
    
    // Assign 3-5 employees to each project
    console.log('\nAssigning employees to projects...');
    for (const project of projects.rows) {
      const teamSize = 3 + Math.floor(Math.random() * 3); // 3-5 employees per project
      const shuffled = [...users.rows].sort(() => Math.random() - 0.5);
      const teamMembers = shuffled.slice(0, Math.min(teamSize, users.rows.length));
      
      for (const member of teamMembers) {
        await pool.query(
          'INSERT INTO project_employees (project_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
          [project.project_id, member.user_id]
        );
      }
      
      console.log(`  ${project.project_name}: ${teamMembers.length} members`);
    }
    
    // Show summary
    console.log('\n=== SUMMARY ===');
    const summary = await pool.query(`
      SELECT p.project_name, COUNT(pe.user_id) as team_count,
             STRING_AGG(u.first_name || ' ' || u.last_name, ', ') as team_members
      FROM projects p
      LEFT JOIN project_employees pe ON p.project_id = pe.project_id
      LEFT JOIN users u ON pe.user_id = u.user_id
      GROUP BY p.project_id, p.project_name
      ORDER BY team_count DESC
      LIMIT 10
    `);
    
    console.log('\nTop 10 projects with team members:');
    summary.rows.forEach(row => {
      console.log(`\n${row.project_name} (${row.team_count} members):`);
      console.log(`  ${row.team_members || 'No team members'}`);
    });
    
  } catch (err) {
    console.error('Error:', err.message);
    console.error(err.stack);
  } finally {
    await pool.end();
  }
}

dropAndRecreate();
