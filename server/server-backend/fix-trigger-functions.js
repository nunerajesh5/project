const { Pool } = require('pg');
const pool = new Pool({
  host: 'localhost',
  port: 5432,
  database: 'project_time_manager',
  user: 'postgres',
  password: 'Super@123',
});

async function fixTriggerFunctions() {
  try {
    console.log('Fixing set_task_project_name function...');
    await pool.query(`
      CREATE OR REPLACE FUNCTION public.set_task_project_name()
      RETURNS trigger
      LANGUAGE plpgsql
      AS $function$
      BEGIN
        IF NEW.project_id IS NOT NULL THEN
          SELECT project_name INTO NEW.project_name
          FROM projects
          WHERE project_id = NEW.project_id;
        END IF;
        RETURN NEW;
      END;
      $function$
    `);
    console.log('✓ Fixed set_task_project_name function');
    
    console.log('\nFixing set_task_employee_name function...');
    const empFunc = await pool.query(`
      SELECT pg_get_functiondef(oid) as definition
      FROM pg_proc
      WHERE proname = 'set_task_employee_name'
    `);
    console.log('Current definition:');
    console.log(empFunc.rows[0].definition);
    
    // Fix employee function too
    await pool.query(`
      CREATE OR REPLACE FUNCTION public.set_task_employee_name()
      RETURNS trigger
      LANGUAGE plpgsql
      AS $function$
      BEGIN
        IF NEW.assigned_to IS NOT NULL THEN
          SELECT first_name || ' ' || last_name INTO NEW.employee_name
          FROM users
          WHERE user_id = NEW.assigned_to;
        END IF;
        RETURN NEW;
      END;
      $function$
    `);
    console.log('✓ Fixed set_task_employee_name function');
    
    console.log('\n✅ All trigger functions fixed!');
    
  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await pool.end();
  }
}

fixTriggerFunctions();
