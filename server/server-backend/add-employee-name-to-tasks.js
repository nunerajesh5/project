const { Pool } = require('pg');

const pool = new Pool({
  user: 'postgres',
  password: 'Super@123',
  host: 'localhost',
  port: 5432,
  database: 'project_time_manager'
});

async function addEmployeeNameToTasks() {
  const client = await pool.connect();
  
  try {
    console.log('Starting migration: Adding employee_name column to tasks table...\n');

    // Step 1: Check if column already exists
    const checkColumn = await client.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'tasks' AND column_name = 'employee_name'
    `);

    if (checkColumn.rows.length > 0) {
      console.log('✅ Column employee_name already exists in tasks table.');
    } else {
      // Step 2: Add the employee_name column
      await client.query(`
        ALTER TABLE tasks 
        ADD COLUMN employee_name VARCHAR(255)
      `);
      console.log('✅ Added employee_name column to tasks table.');
    }

    // Step 3: Update existing tasks with their employee names (first_name + last_name)
    const updateResult = await client.query(`
      UPDATE tasks t
      SET employee_name = CONCAT(e.first_name, ' ', e.last_name)
      FROM employees e
      WHERE t.assigned_to = e.id
      AND (t.employee_name IS NULL OR t.employee_name != CONCAT(e.first_name, ' ', e.last_name))
    `);
    console.log(`✅ Updated ${updateResult.rowCount} tasks with their employee names.`);

    // Step 4: Create or replace trigger function to auto-populate employee_name
    await client.query(`
      CREATE OR REPLACE FUNCTION set_task_employee_name()
      RETURNS TRIGGER AS $$
      BEGIN
        IF NEW.assigned_to IS NOT NULL THEN
          SELECT CONCAT(first_name, ' ', last_name) INTO NEW.employee_name
          FROM employees
          WHERE id = NEW.assigned_to;
        ELSE
          NEW.employee_name := NULL;
        END IF;
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
    `);
    console.log('✅ Created trigger function set_task_employee_name().');

    // Step 5: Drop existing trigger if exists and create new one
    await client.query(`
      DROP TRIGGER IF EXISTS task_set_employee_name ON tasks;
    `);
    
    await client.query(`
      CREATE TRIGGER task_set_employee_name
      BEFORE INSERT OR UPDATE OF assigned_to ON tasks
      FOR EACH ROW
      EXECUTE FUNCTION set_task_employee_name();
    `);
    console.log('✅ Created trigger task_set_employee_name on tasks table.');

    // Step 6: Verify the changes
    const verifyResult = await client.query(`
      SELECT t.id, t.title, t.assigned_to, t.employee_name, 
             CONCAT(e.first_name, ' ', e.last_name) as actual_employee_name
      FROM tasks t
      LEFT JOIN employees e ON t.assigned_to = e.id
      LIMIT 10
    `);

    console.log('\n📋 Sample of updated tasks:');
    console.log('-'.repeat(90));
    console.log('Task Title'.padEnd(35) + 'Employee Name'.padEnd(25) + 'Match');
    console.log('-'.repeat(90));
    
    verifyResult.rows.forEach(row => {
      const match = row.employee_name === row.actual_employee_name ? '✅' : (row.assigned_to ? '❌' : '➖');
      console.log(
        (row.title || 'N/A').substring(0, 33).padEnd(35) + 
        (row.employee_name || 'Unassigned').substring(0, 23).padEnd(25) + 
        match
      );
    });

    // Step 7: Show total count
    const countResult = await client.query(`
      SELECT 
        COUNT(*) as total,
        COUNT(employee_name) as with_employee_name,
        COUNT(assigned_to) as with_assigned_to
      FROM tasks
    `);
    
    console.log('\n' + '='.repeat(60));
    console.log(`Total tasks: ${countResult.rows[0].total}`);
    console.log(`Tasks with assigned_to: ${countResult.rows[0].with_assigned_to}`);
    console.log(`Tasks with employee_name: ${countResult.rows[0].with_employee_name}`);
    console.log('='.repeat(60));

    // Show a nice table of tasks with both project and employee names
    console.log('\n📋 Tasks with Project and Employee Names:');
    console.log('-'.repeat(100));
    
    const fullResult = await client.query(`
      SELECT title, project_name, employee_name, status
      FROM tasks
      ORDER BY project_name, title
      LIMIT 15
    `);
    
    console.log('Task Title'.padEnd(30) + 'Project'.padEnd(30) + 'Employee'.padEnd(20) + 'Status');
    console.log('-'.repeat(100));
    
    fullResult.rows.forEach(row => {
      console.log(
        (row.title || 'N/A').substring(0, 28).padEnd(30) + 
        (row.project_name || 'N/A').substring(0, 28).padEnd(30) + 
        (row.employee_name || 'Unassigned').substring(0, 18).padEnd(20) +
        (row.status || 'N/A')
      );
    });

    console.log('\n✅ Migration completed successfully!');
    console.log('📌 The employee_name field will now auto-populate when tasks are assigned.');

  } catch (error) {
    console.error('❌ Error during migration:', error.message);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

addEmployeeNameToTasks();
