const { Pool } = require('pg');

const pool = new Pool({
  host: 'localhost',
  port: 5432,
  database: 'project_time_manager',
  user: 'postgres',
  password: 'Super@123'
});

async function testEmployeeProjects() {
  try {
    // Get an employee with assigned tasks
    const employeeResult = await pool.query(`
      SELECT DISTINCT e.id, e.first_name, e.last_name, e.email
      FROM employees e
      JOIN tasks t ON t.assigned_to = e.id
      LIMIT 1
    `);
    
    if (employeeResult.rows.length === 0) {
      console.log('No employees with assigned tasks found');
      
      // Check if there are any employees and tasks
      const empCount = await pool.query('SELECT COUNT(*) FROM employees');
      const taskCount = await pool.query('SELECT COUNT(*) FROM tasks');
      console.log('Total employees:', empCount.rows[0].count);
      console.log('Total tasks:', taskCount.rows[0].count);
      
      // Check tasks with assignments
      const assignedTasks = await pool.query('SELECT COUNT(*) FROM tasks WHERE assigned_to IS NOT NULL');
      console.log('Tasks with assignments:', assignedTasks.rows[0].count);
      
      pool.end();
      return;
    }
    
    const employee = employeeResult.rows[0];
    console.log('Testing with employee:', employee.first_name, employee.last_name, `(${employee.id})`);
    
    // Run the same query as /api/projects/assigned endpoint
    const result = await pool.query(
      `SELECT DISTINCT p.id, p.name, p.description, p.status, p.start_date, p.end_date, p.budget,
              p.location, p.priority, p.team_size, p.progress, p.estimated_hours,
              p.created_at, p.updated_at, c.name as client_name, c.id as client_id
       FROM projects p
       JOIN clients c ON p.client_id = c.id
       WHERE p.id IN (
         SELECT DISTINCT t.project_id FROM tasks t WHERE t.assigned_to = $1
         UNION
         SELECT DISTINCT ptm.project_id FROM project_team_memberships ptm WHERE ptm.employee_id = $1
       )
       ORDER BY p.created_at DESC`,
      [employee.id]
    );
    
    console.log(`Found ${result.rows.length} projects for employee:`, result.rows.map(p => ({ name: p.name, status: p.status })));
    
    pool.end();
  } catch (err) {
    console.error('Error:', err.message);
    pool.end();
  }
}

testEmployeeProjects();
