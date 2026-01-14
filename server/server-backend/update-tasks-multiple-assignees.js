const { Pool } = require('pg');

const pool = new Pool({
  host: 'localhost',
  port: 5432,
  database: 'project_time_manager',
  user: 'postgres',
  password: 'Super@123'
});

async function updateTasksForMultipleAssignees() {
  try {
    console.log('=== Updating Tasks for Multiple Assignees ===\n');

    // Step 1: Check current assigned_to column type
    console.log('1. Checking current assigned_to column type...');
    const currentType = await pool.query(`
      SELECT column_name, data_type, udt_name 
      FROM information_schema.columns 
      WHERE table_name = 'tasks' AND column_name = 'assigned_to'
    `);
    console.log('   Current type:', currentType.rows[0]);

    // Step 2: Check sample existing data
    console.log('\n2. Checking existing assigned_to data...');
    const existingData = await pool.query(`
      SELECT task_id, task_name, assigned_to 
      FROM tasks 
      WHERE assigned_to IS NOT NULL 
      LIMIT 5
    `);
    console.log('   Sample existing data:');
    existingData.rows.forEach(r => console.log(`   - ${r.task_name}: ${r.assigned_to}`));

    // Step 3: Create backup of assigned_to values
    console.log('\n3. Creating backup of current assignments...');
    await pool.query(`
      ALTER TABLE tasks ADD COLUMN IF NOT EXISTS assigned_to_backup UUID
    `);
    await pool.query(`
      UPDATE tasks SET assigned_to_backup = assigned_to WHERE assigned_to IS NOT NULL
    `);
    console.log('   ✓ Backup created in assigned_to_backup column');

    // Step 4: Drop the old column and create new array column
    console.log('\n4. Converting assigned_to to UUID array...');
    await pool.query(`ALTER TABLE tasks DROP COLUMN assigned_to`);
    await pool.query(`ALTER TABLE tasks ADD COLUMN assigned_to UUID[]`);
    console.log('   ✓ Column converted to UUID[]');

    // Step 5: Restore data as arrays
    console.log('\n5. Restoring assignments as arrays...');
    await pool.query(`
      UPDATE tasks 
      SET assigned_to = ARRAY[assigned_to_backup]
      WHERE assigned_to_backup IS NOT NULL
    `);
    console.log('   ✓ Existing assignments restored');

    // Step 6: Clean up backup column
    console.log('\n6. Cleaning up backup column...');
    await pool.query(`ALTER TABLE tasks DROP COLUMN assigned_to_backup`);
    console.log('   ✓ Backup column removed');

    // Step 7: Verify the change
    console.log('\n7. Verifying new structure...');
    const newType = await pool.query(`
      SELECT column_name, data_type, udt_name 
      FROM information_schema.columns 
      WHERE table_name = 'tasks' AND column_name = 'assigned_to'
    `);
    console.log('   New type:', newType.rows[0]);

    // Step 8: Verify sample data
    console.log('\n8. Verifying sample data...');
    const verifyData = await pool.query(`
      SELECT task_id, task_name, assigned_to, array_length(assigned_to, 1) as assignee_count
      FROM tasks 
      WHERE assigned_to IS NOT NULL 
      LIMIT 5
    `);
    verifyData.rows.forEach(r => {
      console.log(`   - ${r.task_name}: ${r.assignee_count || 0} assignee(s)`);
    });

    console.log('\n✅ Tasks table updated successfully for multiple assignees!');

  } catch (err) {
    console.error('❌ Error:', err.message);
  } finally {
    await pool.end();
  }
}

updateTasksForMultipleAssignees();
