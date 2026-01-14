const { Pool } = require('pg');
const pool = new Pool({
  host: 'localhost',
  port: 5432,
  database: 'project_time_manager',
  user: 'postgres',
  password: 'Super@123',
});

async function checkAndFixTeamMembers() {
  try {
    // Check current data type
    const typeCheck = await pool.query(`
      SELECT column_name, data_type, udt_name 
      FROM information_schema.columns 
      WHERE table_name='projects' AND column_name='team_member_ids'
    `);
    
    console.log('Current team_member_ids column:', typeCheck.rows[0]);
    
    // Check if column exists and what type it is
    if (typeCheck.rows.length === 0) {
      console.log('\n⚠️  team_member_ids column does not exist!');
      console.log('Creating as JSONB array...');
      await pool.query(`
        ALTER TABLE projects ADD COLUMN team_member_ids JSONB DEFAULT '[]'::jsonb
      `);
      console.log('✓ Column created as JSONB');
    } else if (typeCheck.rows[0].data_type !== 'jsonb' && typeCheck.rows[0].udt_name !== 'jsonb') {
      console.log('\n⚠️  team_member_ids is not JSONB, converting...');
      console.log(`   Current type: ${typeCheck.rows[0].data_type} (${typeCheck.rows[0].udt_name})`);
      
      // For UUID array, we need to convert to text array first, then to JSONB
      if (typeCheck.rows[0].udt_name === '_uuid') {
        console.log('   Converting UUID[] -> TEXT[] -> JSONB...');
        
        // Step 1: Rename old column
        await pool.query(`ALTER TABLE projects RENAME COLUMN team_member_ids TO team_member_ids_old`);
        
        // Step 2: Create new JSONB column
        await pool.query(`ALTER TABLE projects ADD COLUMN team_member_ids JSONB DEFAULT '[]'::jsonb`);
        
        // Step 3: Migrate data
        await pool.query(`
          UPDATE projects 
          SET team_member_ids = COALESCE(
            (SELECT jsonb_agg(elem::text) FROM unnest(team_member_ids_old) AS elem),
            '[]'::jsonb
          )
        `);
        
        // Step 4: Drop old column
        await pool.query(`ALTER TABLE projects DROP COLUMN team_member_ids_old`);
        
        console.log('✓ Successfully converted UUID[] to JSONB array');
      } else {
        // For other types, try direct conversion
        await pool.query(`
          ALTER TABLE projects 
          ALTER COLUMN team_member_ids TYPE JSONB 
          USING CASE 
            WHEN team_member_ids IS NULL THEN '[]'::jsonb
            WHEN team_member_ids::text = '' THEN '[]'::jsonb
            ELSE team_member_ids::jsonb
          END
        `);
        console.log('✓ Column converted to JSONB');
      }
    } else {
      console.log('✓ Column is already JSONB');
    }
    
    // Check sample data
    const sampleData = await pool.query(`
      SELECT project_id, project_name, team_member_ids, 
             jsonb_typeof(team_member_ids) as type
      FROM projects 
      WHERE team_member_ids IS NOT NULL 
      LIMIT 5
    `);
    
    console.log('\nSample projects with team members:');
    sampleData.rows.forEach(p => {
      console.log(`  ${p.project_name}: ${JSON.stringify(p.team_member_ids)} (type: ${p.type})`);
    });
    
    // Ensure all NULL values are set to empty array
    const updateResult = await pool.query(`
      UPDATE projects 
      SET team_member_ids = '[]'::jsonb 
      WHERE team_member_ids IS NULL
    `);
    console.log(`\n✓ Updated ${updateResult.rowCount} projects with NULL team_member_ids to []`);
    
  } catch (err) {
    console.error('❌ Error:', err.message);
  } finally {
    await pool.end();
  }
}

checkAndFixTeamMembers();
