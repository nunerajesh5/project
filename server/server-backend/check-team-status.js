const { Pool } = require('pg');

const pool = new Pool({
  host: 'localhost',
  port: 5432,
  database: 'project_time_manager',
  user: 'postgres',
  password: 'Super@123'
});

async function checkTeamStatus() {
  try {
    // Check if old junction tables exist
    console.log('Checking for old junction tables...');
    const tables = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name IN ('project_employees', 'project_team_memberships')
    `);
    
    if (tables.rows.length > 0) {
      console.log('⚠️  Found old junction tables:', tables.rows.map(r => r.table_name).join(', '));
    } else {
      console.log('✅ No old junction tables found');
    }

    // Check team_member_ids column
    console.log('\nChecking team_member_ids array column...');
    const projects = await pool.query(`
      SELECT 
        project_id, 
        project_name, 
        array_length(team_member_ids, 1) as team_count,
        team_member_ids
      FROM projects 
      LIMIT 5
    `);
    
    console.log('\nSample projects with team counts:');
    projects.rows.forEach(p => {
      console.log(`  ${p.project_name}: ${p.team_count || 0} members`);
    });

    // Check for any foreign key constraints on old tables
    console.log('\nChecking for foreign key constraints...');
    const constraints = await pool.query(`
      SELECT 
        tc.constraint_name, 
        tc.table_name,
        kcu.column_name
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu 
        ON tc.constraint_name = kcu.constraint_name
      WHERE tc.constraint_type = 'FOREIGN KEY'
      AND tc.table_name IN ('project_employees', 'project_team_memberships')
    `);

    if (constraints.rows.length > 0) {
      console.log('⚠️  Found foreign key constraints on old tables:');
      constraints.rows.forEach(c => {
        console.log(`  ${c.table_name}.${c.column_name} (${c.constraint_name})`);
      });
    } else {
      console.log('✅ No foreign key constraints on old tables');
    }

    console.log('\n✅ Status check complete!');
  } catch (err) {
    console.error('❌ Error:', err.message);
  } finally {
    await pool.end();
  }
}

checkTeamStatus();
