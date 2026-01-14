const { Pool } = require('pg');

const pool = new Pool({
  host: 'localhost',
  port: 5432,
  database: 'project_time_manager',
  user: 'postgres',
  password: 'Super@123',
});

const projectId = '1ee1418f-5222-4509-9cf9-8ddabe954373';

async function test() {
  try {
    console.log('Testing project exists query...');
    const projectExists = await pool.query('SELECT project_id FROM projects WHERE project_id = $1', [projectId]);
    console.log('Project exists result:', projectExists.rows);
    
    console.log('\nTesting tasks query...');
    const list = await pool.query(
      `SELECT t.task_id as id, t.project_id, t.task_name as title, t.status, t.assigned_to, 
              t.end_date as due_date, t.created_at, t.updated_at,
              p.project_name, p.status as project_status,
              CASE 
                WHEN t.assigned_to IS NOT NULL THEN
                  json_build_array(
                    json_build_object(
                      'id', u.user_id,
                      'first_name', u.first_name,
                      'last_name', u.last_name,
                      'email', u.email_id,
                      'department', d.name
                    )
                  )
                ELSE '[]'::json
              END as assigned_employees
       FROM tasks t
       JOIN projects p ON t.project_id = p.project_id
       LEFT JOIN users u ON t.assigned_to = u.user_id
       LEFT JOIN departments d ON u.department_id = d.department_id
       WHERE t.project_id = $1
       ORDER BY t.created_at DESC
       LIMIT 100 OFFSET 0`,
      [projectId]
    );
    
    console.log('Tasks result:', list.rows.length, 'tasks found');
    if (list.rows.length > 0) {
      console.log('\nFirst task:', JSON.stringify(list.rows[0], null, 2));
    }
  } catch (err) {
    console.error('Error:', err.message);
    console.error('Stack:', err.stack);
  } finally {
    await pool.end();
  }
}

test();
