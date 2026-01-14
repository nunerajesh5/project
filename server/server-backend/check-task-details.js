const { Pool } = require('pg');

const pool = new Pool({
  host: 'localhost',
  port: 5432,
  database: 'project_time_manager',
  user: 'postgres',
  password: 'Super@123'
});

async function getTaskDetails() {
  try {
    // Get a sample task with all its details
    console.log('Fetching task details...\n');
    
    const result = await pool.query(`
      SELECT 
        t.task_id,
        t.task_name,
        t.description,
        t.status,
        t.priority,
        t.due_date,
        t.estimated_hours,
        t.actual_hours,
        t.project_id,
        p.project_name,
        t.assigned_to,
        u.first_name || ' ' || u.last_name as assigned_to_name,
        t.created_at,
        t.updated_at
      FROM tasks t
      LEFT JOIN projects p ON t.project_id = p.project_id
      LEFT JOIN users u ON t.assigned_to = u.user_id
      LIMIT 5
    `);

    console.log('Sample Tasks with Details:');
    console.log('='.repeat(60));
    
    result.rows.forEach((task, idx) => {
      console.log(`\n${idx + 1}. ${task.task_name}`);
      console.log(`   Task ID: ${task.task_id}`);
      console.log(`   Project: ${task.project_name || 'N/A'}`);
      console.log(`   Status: ${task.status}`);
      console.log(`   Priority: ${task.priority || 'N/A'}`);
      console.log(`   Assigned To: ${task.assigned_to_name || 'Unassigned'}`);
      console.log(`   Due Date: ${task.due_date || 'N/A'}`);
    });

    // Check columns in tasks table
    console.log('\n\nTasks Table Columns:');
    console.log('='.repeat(60));
    
    const columns = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'tasks' 
      ORDER BY ordinal_position
    `);
    
    columns.rows.forEach(col => {
      console.log(`   ${col.column_name}: ${col.data_type}`);
    });

  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await pool.end();
  }
}

getTaskDetails();
