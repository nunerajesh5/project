const { Pool } = require('pg');

const pool = new Pool({
  user: 'postgres',
  password: 'Super@123',
  host: 'localhost',
  port: 5432,
  database: 'project_time_manager'
});

async function addTeamMembersToProjects() {
  const client = await pool.connect();
  
  try {
    console.log('Starting migration: Adding team_members column to projects table...\n');

    // Step 1: Check if column already exists
    const checkColumn = await client.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'projects' AND column_name = 'team_members'
    `);

    if (checkColumn.rows.length > 0) {
      console.log('✅ Column team_members already exists in projects table.');
    } else {
      // Step 2: Add the team_members column
      await client.query(`
        ALTER TABLE projects 
        ADD COLUMN team_members TEXT
      `);
      console.log('✅ Added team_members column to projects table.');
    }

    // Step 3: Update existing projects with their team member names
    const updateResult = await client.query(`
      UPDATE projects p
      SET team_members = subquery.members
      FROM (
        SELECT 
          p2.id as project_id,
          STRING_AGG(CONCAT(e.first_name, ' ', e.last_name), ', ' ORDER BY e.first_name) as members
        FROM projects p2
        LEFT JOIN project_team_memberships ptm ON p2.id = ptm.project_id
        LEFT JOIN employees e ON ptm.employee_id = e.id
        WHERE e.id IS NOT NULL
        GROUP BY p2.id
      ) subquery
      WHERE p.id = subquery.project_id
      AND (p.team_members IS NULL OR p.team_members != subquery.members)
    `);
    console.log(`✅ Updated ${updateResult.rowCount} projects with their team member names.`);

    // Step 4: Create or replace trigger function to auto-populate team_members
    await client.query(`
      CREATE OR REPLACE FUNCTION update_project_team_members()
      RETURNS TRIGGER AS $$
      BEGIN
        -- Update the team_members field in projects table
        UPDATE projects p
        SET team_members = (
          SELECT STRING_AGG(CONCAT(e.first_name, ' ', e.last_name), ', ' ORDER BY e.first_name)
          FROM project_team_memberships ptm
          JOIN employees e ON ptm.employee_id = e.id
          WHERE ptm.project_id = COALESCE(NEW.project_id, OLD.project_id)
        )
        WHERE p.id = COALESCE(NEW.project_id, OLD.project_id);
        
        RETURN COALESCE(NEW, OLD);
      END;
      $$ LANGUAGE plpgsql;
    `);
    console.log('✅ Created trigger function update_project_team_members().');

    // Step 5: Drop existing trigger if exists and create new one
    await client.query(`
      DROP TRIGGER IF EXISTS project_team_members_update ON project_team_memberships;
    `);
    
    await client.query(`
      CREATE TRIGGER project_team_members_update
      AFTER INSERT OR UPDATE OR DELETE ON project_team_memberships
      FOR EACH ROW
      EXECUTE FUNCTION update_project_team_members();
    `);
    console.log('✅ Created trigger project_team_members_update on project_team_memberships table.');

    // Step 6: Verify the changes
    console.log('\n📋 Projects with Team Members:');
    console.log('='.repeat(110));
    console.log('Project Name'.padEnd(35) + 'Status'.padEnd(15) + 'Team Members');
    console.log('='.repeat(110));
    
    const verifyResult = await client.query(`
      SELECT name, status, team_members
      FROM projects
      ORDER BY name
    `);
    
    verifyResult.rows.forEach(row => {
      console.log(
        (row.name || 'N/A').substring(0, 33).padEnd(35) + 
        (row.status || 'N/A').padEnd(15) + 
        (row.team_members || 'No team members').substring(0, 60)
      );
    });

    // Step 7: Show count summary
    const countResult = await client.query(`
      SELECT 
        COUNT(*) as total,
        COUNT(team_members) as with_team_members
      FROM projects
    `);
    
    console.log('\n' + '='.repeat(60));
    console.log(`Total projects: ${countResult.rows[0].total}`);
    console.log(`Projects with team_members: ${countResult.rows[0].with_team_members}`);
    console.log('='.repeat(60));

    console.log('\n✅ Migration completed successfully!');
    console.log('📌 The team_members field will now auto-update when team memberships change.');

  } catch (error) {
    console.error('❌ Error during migration:', error.message);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

addTeamMembersToProjects();
