const { Pool } = require('pg');
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });

const pool = new Pool({
  user: process.env.DB_USER || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'project_time_manager',
  password: process.env.DB_PASSWORD || 'Super@123',
  port: process.env.DB_PORT || 5432,
});

async function updateTaskStatuses() {
  const client = await pool.connect();
  
  try {
    console.log('=== Checking and Updating Task Status Enum ===\n');
    
    // Check current enum values
    const enumResult = await client.query(`
      SELECT enumlabel FROM pg_enum 
      WHERE enumtypid = (SELECT oid FROM pg_type WHERE typname = 'task_status')
    `);
    console.log('Current enum values:');
    enumResult.rows.forEach(r => console.log('  - ' + r.enumlabel));
    
    // Drop the enum constraint and recreate with new values
    console.log('\n=== Updating enum type ===');
    
    // First, change column to text temporarily
    await client.query('ALTER TABLE tasks ALTER COLUMN status DROP DEFAULT');
    console.log('✓ Dropped default value');
    
    await client.query('ALTER TABLE tasks ALTER COLUMN status TYPE TEXT');
    console.log('✓ Changed status column to TEXT');
    
    // Drop old enum type with CASCADE
    await client.query('DROP TYPE IF EXISTS task_status CASCADE');
    console.log('✓ Dropped old task_status enum');
    
    // Create new enum with 5 statuses
    await client.query(`
      CREATE TYPE task_status AS ENUM ('To Do', 'Active', 'Completed', 'Cancelled', 'On Hold')
    `);
    console.log('✓ Created new task_status enum with 5 values');
    
    // Get current status distribution
    const currentStatuses = await client.query('SELECT status, COUNT(*) as count FROM tasks GROUP BY status');
    console.log('\nCurrent status distribution (before update):');
    currentStatuses.rows.forEach(r => console.log(`  ${r.status}: ${r.count}`));
    
    // Map old statuses to new ones
    console.log('\n=== Mapping old statuses to new ones ===');
    await client.query(`UPDATE tasks SET status = 'To Do' WHERE status = 'todo'`);
    await client.query(`UPDATE tasks SET status = 'Active' WHERE status = 'in_progress'`);
    await client.query(`UPDATE tasks SET status = 'Completed' WHERE status = 'done'`);
    await client.query(`UPDATE tasks SET status = 'On Hold' WHERE status = 'overdue'`);
    console.log('✓ Mapped: todo -> To Do');
    console.log('✓ Mapped: in_progress -> Active');
    console.log('✓ Mapped: done -> Completed');
    console.log('✓ Mapped: overdue -> On Hold');
    
    // Now redistribute to have all 5 statuses represented
    // Get all tasks and redistribute
    const allTasks = await client.query('SELECT id FROM tasks ORDER BY id');
    const totalTasks = allTasks.rows.length;
    
    // Target distribution: To Do (30), Active (40), Completed (35), Cancelled (16), On Hold (15) = 136
    const distribution = {
      'To Do': 30,
      'Active': 40,
      'Completed': 35,
      'Cancelled': 16,
      'On Hold': 15
    };
    
    let taskIndex = 0;
    for (const [status, count] of Object.entries(distribution)) {
      const ids = allTasks.rows.slice(taskIndex, taskIndex + count).map(t => t.id);
      if (ids.length > 0) {
        await client.query(`UPDATE tasks SET status = $1 WHERE id = ANY($2)`, [status, ids]);
      }
      taskIndex += count;
    }
    console.log('\n✓ Redistributed tasks across all 5 statuses');
    
    // Convert back to enum type
    await client.query(`ALTER TABLE tasks ALTER COLUMN status TYPE task_status USING status::task_status`);
    console.log('✓ Converted status column back to task_status enum');
    
    // Verify the update
    console.log('\n=== Final Status Distribution ===');
    const result = await client.query('SELECT status::text, COUNT(*) as count FROM tasks GROUP BY status ORDER BY status');
    result.rows.forEach(r => console.log(`${r.status}: ${r.count}`));
    
    const total = await client.query('SELECT COUNT(*) as total FROM tasks');
    console.log(`\nTotal tasks: ${total.rows[0].total}`);
    
    console.log('\n✅ Task statuses updated successfully!');
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    client.release();
    pool.end();
  }
}

updateTaskStatuses();
