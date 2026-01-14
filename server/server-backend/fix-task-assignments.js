const pool = require('./src/config/database');

async function fixTaskAssignments() {
  try {
    const aliceId = '5cc11247-1b11-4c02-a5fd-fd39caace556';
    const bobId = '853985b5-85f3-4010-8a36-828aed084b10';
    const charlieId = '4490d5ec-2c87-4792-8d90-53ddc585ed7c';
    
    // Get all tasks
    const tasks = await pool.query('SELECT task_id, task_name FROM tasks LIMIT 9');
    
    console.log('Assigning tasks to employees...\n');
    
    // Assign first 3 to Alice
    for (let i = 0; i < 3 && i < tasks.rows.length; i++) {
      await pool.query('UPDATE tasks SET assigned_to = $1 WHERE task_id = $2', [aliceId, tasks.rows[i].task_id]);
      console.log(`✅ Assigned to Alice: ${tasks.rows[i].task_name}`);
    }
    
    // Assign next 3 to Bob
    for (let i = 3; i < 6 && i < tasks.rows.length; i++) {
      await pool.query('UPDATE tasks SET assigned_to = $1 WHERE task_id = $2', [bobId, tasks.rows[i].task_id]);
      console.log(`✅ Assigned to Bob: ${tasks.rows[i].task_name}`);
    }
    
    // Assign next 3 to Charlie
    for (let i = 6; i < 9 && i < tasks.rows.length; i++) {
      await pool.query('UPDATE tasks SET assigned_to = $1 WHERE task_id = $2', [charlieId, tasks.rows[i].task_id]);
      console.log(`✅ Assigned to Charlie: ${tasks.rows[i].task_name}`);
    }
    
    // Verify Alice's tasks
    const aliceTasks = await pool.query(`
      SELECT t.task_name, p.project_name
      FROM tasks t
      JOIN projects p ON t.project_id = p.project_id
      WHERE t.assigned_to = $1
    `, [aliceId]);
    
    console.log(`\n✅ Alice now has ${aliceTasks.rows.length} tasks:`);
    aliceTasks.rows.forEach(t => console.log(`  - ${t.task_name} (${t.project_name})`));
    
    process.exit(0);
  } catch (e) {
    console.error('Error:', e);
    process.exit(1);
  }
}

fixTaskAssignments();
