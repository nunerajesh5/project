const pool = require('./src/config/database');

async function checkAliceTasks() {
  try {
    // Find Alice's user_id
    const alice = await pool.query(`SELECT user_id, email_id, first_name, last_name FROM users WHERE email_id = 'alice@company.com'`);
    console.log('Alice user:', alice.rows[0]);
    
    if (alice.rows.length === 0) {
      console.log('Alice not found!');
      process.exit(1);
    }
    
    const aliceId = alice.rows[0].user_id;
    
    // Check tasks assigned to Alice
    const tasks = await pool.query(`
      SELECT t.task_id, t.task_name, t.assigned_to, t.status, p.project_name
      FROM tasks t
      JOIN projects p ON t.project_id = p.project_id
      WHERE t.assigned_to = $1
    `, [aliceId]);
    
    console.log('\nTasks assigned to Alice:', tasks.rows.length);
    tasks.rows.forEach(t => console.log(`  - ${t.task_name} (${t.status}) - Project: ${t.project_name}`));
    
    // Check all tasks and who they're assigned to
    const allTasks = await pool.query(`
      SELECT t.task_id, t.task_name, t.assigned_to, u.first_name, u.last_name, u.email_id
      FROM tasks t
      LEFT JOIN users u ON t.assigned_to = u.user_id
      LIMIT 10
    `);
    
    console.log('\nAll tasks (first 10):');
    allTasks.rows.forEach(t => {
      const assignee = t.first_name ? `${t.first_name} ${t.last_name} (${t.email_id})` : 'Unassigned';
      console.log(`  - ${t.task_name} -> ${assignee}`);
    });
    
    // List all users
    const users = await pool.query(`SELECT user_id, first_name, last_name, email_id, role FROM users`);
    console.log('\nAll users:');
    users.rows.forEach(u => console.log(`  - ${u.first_name} ${u.last_name} (${u.email_id}) - ${u.role} - ID: ${u.user_id}`));
    
    process.exit(0);
  } catch (e) {
    console.error('Error:', e);
    process.exit(1);
  }
}

checkAliceTasks();
