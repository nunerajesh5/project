const { Pool } = require('pg');

const pool = new Pool({
  host: 'localhost',
  user: 'postgres',
  password: 'Super@123',
  database: 'project_time_manager',
  port: 5432
});

async function updateTasks() {
  try {
    // Get all tasks with their project's team members
    const tasks = await pool.query(`
      SELECT t.task_id, t.task_name, t.assigned_to, t.project_id, p.team_member_ids
      FROM tasks t
      JOIN projects p ON t.project_id = p.project_id
    `);
    
    console.log('Found', tasks.rows.length, 'tasks to check\n');
    
    let updated = 0;
    let alreadyOk = 0;
    let notEnoughMembers = 0;
    
    for (const task of tasks.rows) {
      const currentAssigned = task.assigned_to || [];
      const teamMembers = task.team_member_ids || [];
      
      console.log('Task:', task.task_name);
      console.log('  Current assigned:', currentAssigned.length, 'members');
      console.log('  Project team has:', teamMembers.length, 'members');
      
      // If less than 2 assigned, add from project team
      if (currentAssigned.length < 2 && teamMembers.length >= 2) {
        // Get members not already assigned
        const availableMembers = teamMembers.filter(m => !currentAssigned.includes(m));
        const neededCount = 2 - currentAssigned.length;
        const toAdd = availableMembers.slice(0, neededCount);
        const newAssigned = [...currentAssigned, ...toAdd];
        
        if (newAssigned.length >= 2) {
          await pool.query(
            'UPDATE tasks SET assigned_to = $1::jsonb WHERE task_id = $2',
            [JSON.stringify(newAssigned), task.task_id]
          );
          console.log('  ✅ Updated to', newAssigned.length, 'members');
          updated++;
        } else {
          console.log('  ⚠️ Not enough available members to assign 2');
          notEnoughMembers++;
        }
      } else if (currentAssigned.length >= 2) {
        console.log('  ✓ Already has 2+ members');
        alreadyOk++;
      } else {
        console.log('  ⚠️ Project has fewer than 2 team members');
        notEnoughMembers++;
      }
      console.log('');
    }
    
    console.log('========== Summary ==========');
    console.log('Total tasks:', tasks.rows.length);
    console.log('Updated:', updated);
    console.log('Already OK:', alreadyOk);
    console.log('Not enough members:', notEnoughMembers);
    
  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await pool.end();
  }
}

updateTasks();
