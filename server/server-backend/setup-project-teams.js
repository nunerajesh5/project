const { Pool } = require('pg');
const pool = new Pool({
  host: 'localhost',
  port: 5432,
  database: 'project_time_manager',
  user: 'postgres',
  password: 'Super@123',
});

async function setupProjectTeams() {
  try {
    // Check if project_team_memberships table exists
    const tableCheck = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'project_team_memberships'
      )
    `);
    
    console.log('project_team_memberships table exists:', tableCheck.rows[0].exists);
    
    if (!tableCheck.rows[0].exists) {
      console.log('\nCreating project_team_memberships table...');
      await pool.query(`
        CREATE TABLE project_team_memberships (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          project_id UUID NOT NULL,
          employee_id UUID NOT NULL,
          role VARCHAR(50) DEFAULT 'member',
          added_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(project_id, employee_id)
        )
      `);
      console.log('✓ Table created');
    }
    
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
    
    // Check current team assignments
    const currentAssignments = await pool.query('SELECT COUNT(*) as count FROM project_team_memberships');
    console.log(`Current team assignments: ${currentAssignments.rows[0].count}`);
    
    if (parseInt(currentAssignments.rows[0].count) === 0) {
      console.log('\n=== ASSIGNING TEAM MEMBERS TO PROJECTS ===');
      
      let assignmentCount = 0;
      for (let i = 0; i < projects.rows.length; i++) {
        const project = projects.rows[i];
        
        // Assign 2-4 random team members to each project
        const teamSize = 2 + Math.floor(Math.random() * 3); // 2 to 4 members
        const shuffledUsers = [...users.rows].sort(() => Math.random() - 0.5);
        const teamMembers = shuffledUsers.slice(0, teamSize);
        
        console.log(`\nProject: ${project.project_name}`);
        console.log(`  Assigning ${teamSize} team members:`);
        
        for (const member of teamMembers) {
          const memberRole = member.role === 'manager' ? 'manager' : 'member';
          
          try {
            await pool.query(`
              INSERT INTO project_team_memberships (project_id, employee_id, role)
              VALUES ($1, $2, $3)
              ON CONFLICT (project_id, employee_id) DO NOTHING
            `, [project.project_id, member.user_id, memberRole]);
            
            console.log(`    - ${member.first_name} ${member.last_name} (${memberRole})`);
            assignmentCount++;
          } catch (err) {
            console.log(`    ✗ Error assigning ${member.first_name}: ${err.message}`);
          }
        }
      }
      
      console.log(`\n✅ Assigned ${assignmentCount} team memberships across ${projects.rows.length} projects`);
    }
    
    // Verify assignments
    const verification = await pool.query(`
      SELECT 
        p.project_name,
        COUNT(ptm.employee_id) as team_count
      FROM projects p
      LEFT JOIN project_team_memberships ptm ON p.project_id = ptm.project_id
      GROUP BY p.project_id, p.project_name
      ORDER BY team_count DESC
      LIMIT 10
    `);
    
    console.log('\n=== TEAM SIZE PER PROJECT (TOP 10) ===');
    verification.rows.forEach(row => {
      console.log(`  ${row.project_name}: ${row.team_count} members`);
    });
    
    // Show sample team assignments
    const sample = await pool.query(`
      SELECT 
        p.project_name,
        u.first_name || ' ' || u.last_name as member_name,
        ptm.role
      FROM project_team_memberships ptm
      JOIN projects p ON ptm.project_id = p.project_id
      JOIN users u ON ptm.employee_id = u.user_id
      LIMIT 10
    `);
    
    console.log('\n=== SAMPLE TEAM ASSIGNMENTS ===');
    sample.rows.forEach(row => {
      console.log(`  ${row.project_name} -> ${row.member_name} (${row.role})`);
    });
    
  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await pool.end();
  }
}

setupProjectTeams();
