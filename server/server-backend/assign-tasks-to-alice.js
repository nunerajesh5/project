const pool = require('./src/config/database');

async function assignTasksToAlice() {
  try {
    const aliceId = '5cc11247-1b11-4c02-a5fd-fd39caace556';
    
    // Get first 3 tasks to assign to Alice
    const tasks = await pool.query(`
      SELECT task_id, task_name FROM tasks 
      WHERE assigned_to IS NULL 
      LIMIT 3
    `);
    
    console.log('Assigning tasks to Alice...');
    
    for (const task of tasks.rows) {
      await pool.query(`
        UPDATE tasks SET assigned_to = $1, updated_at = NOW()
        WHERE task_id = $2
      `, [aliceId, task.task_id]);
      console.log(`  ✅ Assigned: ${task.task_name}`);
    }
    
    // Verify
    const assigned = await pool.query(`
      SELECT t.task_name, p.project_name
      FROM tasks t
      JOIN projects p ON t.project_id = p.project_id
      WHERE t.assigned_to = $1
    `, [aliceId]);
    
    console.log(`\n✅ Alice now has ${assigned.rows.length} tasks assigned:`);
    assigned.rows.forEach(t => console.log(`  - ${t.task_name} (${t.project_name})`));
    
    process.exit(0);
  } catch (e) {
    console.error('Error:', e);
    process.exit(1);
  }
}

assignTasksToAlice();
