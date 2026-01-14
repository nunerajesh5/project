const { Pool } = require('pg');

const pool = new Pool({
  host: 'localhost',
  port: 5432,
  database: 'project_time_manager',
  user: 'postgres',
  password: 'Super@123'
});

async function testTaskQueries() {
  try {
    console.log('Testing task queries directly...\n');
    
    // Test 1: Get a sample task
    console.log('1. Fetching a sample task with all details...');
    const taskResult = await pool.query(`
      SELECT t.task_id, t.project_id, t.task_name, t.status, t.assigned_to, t.start_date, 
             t.created_at, t.updated_at, t.approved, t.approved_at, t.approval_notes,
             p.project_name as project_name, p.status as project_status, p.project_location,
             COALESCE(c.first_name || ' ' || c.last_name, 'Unknown Client') as client_name,
             COALESCE(u.first_name, '') as first_name, 
             COALESCE(u.last_name, '') as last_name, 
             COALESCE(u.email_id, '') as employee_email,
             COALESCE(u.department_id::text, '') as department
      FROM tasks t
      JOIN projects p ON t.project_id = p.project_id
      LEFT JOIN clients c ON p.client_id = c.client_id
      LEFT JOIN users u ON t.assigned_to = u.user_id
      LIMIT 1
    `);
    
    if (taskResult.rows.length > 0) {
      const task = taskResult.rows[0];
      console.log('✅ Task fetched successfully:');
      console.log(`   Task Name: ${task.task_name}`);
      console.log(`   Project: ${task.project_name}`);
      console.log(`   Status: ${task.status}`);
      console.log(`   Client: ${task.client_name}`);
      console.log(`   Assigned To: ${task.first_name} ${task.last_name}`);
    } else {
      console.log('❌ No tasks found');
    }

    // Test 2: Get tasks for a project
    console.log('\n2. Fetching tasks for a project...');
    const projectTasks = await pool.query(`
      SELECT t.task_id as id, t.project_id, t.task_name as title, t.status, t.assigned_to, 
             t.end_date as due_date, t.created_at, t.updated_at,
             p.project_name,
             u.first_name || ' ' || u.last_name as assigned_to_name
      FROM tasks t
      LEFT JOIN projects p ON t.project_id = p.project_id
      LEFT JOIN users u ON t.assigned_to = u.user_id
      WHERE t.project_id = (SELECT project_id FROM projects LIMIT 1)
      ORDER BY t.created_at DESC
      LIMIT 5
    `);

    console.log(`✅ Found ${projectTasks.rows.length} tasks for project`);
    projectTasks.rows.forEach((task, idx) => {
      console.log(`   ${idx + 1}. ${task.title} [${task.status}] - Assigned to: ${task.assigned_to_name || 'Unassigned'}`);
    });

    // Test 3: Get tasks for an employee
    console.log('\n3. Fetching tasks assigned to an employee...');
    const employeeTasks = await pool.query(`
      SELECT t.task_id as id, t.task_id, t.project_id, t.task_name as title, t.task_name, t.status, 
             t.start_date, t.end_date as due_date, t.created_at, t.updated_at,
             p.project_name as project_name, p.status as project_status
      FROM tasks t
      JOIN projects p ON t.project_id = p.project_id
      WHERE t.assigned_to IS NOT NULL
      LIMIT 5
    `);

    console.log(`✅ Found ${employeeTasks.rows.length} assigned tasks`);
    employeeTasks.rows.forEach((task, idx) => {
      console.log(`   ${idx + 1}. ${task.title} - Project: ${task.project_name}`);
    });

    // Test 4: Time entries for a task
    console.log('\n4. Checking time entries query...');
    const timeStats = await pool.query(`
      SELECT 
        COALESCE(SUM(te.duration_minutes), 0) as total_time_minutes
      FROM time_entries te
      WHERE te.task_id = (SELECT task_id FROM tasks LIMIT 1) AND te.is_active = true
    `);
    console.log(`✅ Time stats query successful: ${timeStats.rows[0].total_time_minutes} minutes`);

    console.log('\n✅ All task queries are working correctly!');
    
  } catch (err) {
    console.error('❌ Error:', err.message);
    console.error('   Query details:', err.query || 'N/A');
  } finally {
    await pool.end();
  }
}

testTaskQueries();
