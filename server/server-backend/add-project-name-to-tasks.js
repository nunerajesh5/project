const { Pool } = require('pg');

const pool = new Pool({
  user: 'postgres',
  password: 'Super@123',
  host: 'localhost',
  port: 5432,
  database: 'project_time_manager'
});

async function addProjectNameToTasks() {
  const client = await pool.connect();
  
  try {
    console.log('Starting migration: Adding project_name column to tasks table...\n');

    // Step 1: Check if column already exists
    const checkColumn = await client.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'tasks' AND column_name = 'project_name'
    `);

    if (checkColumn.rows.length > 0) {
      console.log('✅ Column project_name already exists in tasks table.');
    } else {
      // Step 2: Add the project_name column
      await client.query(`
        ALTER TABLE tasks 
        ADD COLUMN project_name VARCHAR(255)
      `);
      console.log('✅ Added project_name column to tasks table.');
    }

    // Step 3: Update existing tasks with their project names
    const updateResult = await client.query(`
      UPDATE tasks t
      SET project_name = p.name
      FROM projects p
      WHERE t.project_id = p.id
      AND (t.project_name IS NULL OR t.project_name != p.name)
    `);
    console.log(`✅ Updated ${updateResult.rowCount} tasks with their project names.`);

    // Step 4: Create or replace trigger function to auto-populate project_name
    await client.query(`
      CREATE OR REPLACE FUNCTION set_task_project_name()
      RETURNS TRIGGER AS $$
      BEGIN
        IF NEW.project_id IS NOT NULL THEN
          SELECT name INTO NEW.project_name
          FROM projects
          WHERE id = NEW.project_id;
        END IF;
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
    `);
    console.log('✅ Created trigger function set_task_project_name().');

    // Step 5: Drop existing trigger if exists and create new one
    await client.query(`
      DROP TRIGGER IF EXISTS task_set_project_name ON tasks;
    `);
    
    await client.query(`
      CREATE TRIGGER task_set_project_name
      BEFORE INSERT OR UPDATE OF project_id ON tasks
      FOR EACH ROW
      EXECUTE FUNCTION set_task_project_name();
    `);
    console.log('✅ Created trigger task_set_project_name on tasks table.');

    // Step 6: Verify the changes
    const verifyResult = await client.query(`
      SELECT t.id, t.title, t.project_id, t.project_name, p.name as actual_project_name
      FROM tasks t
      LEFT JOIN projects p ON t.project_id = p.id
      LIMIT 10
    `);

    console.log('\n📋 Sample of updated tasks:');
    console.log('-'.repeat(80));
    console.log('Task Title'.padEnd(35) + 'Project Name'.padEnd(35) + 'Match');
    console.log('-'.repeat(80));
    
    verifyResult.rows.forEach(row => {
      const match = row.project_name === row.actual_project_name ? '✅' : '❌';
      console.log(
        (row.title || 'N/A').substring(0, 33).padEnd(35) + 
        (row.project_name || 'N/A').substring(0, 33).padEnd(35) + 
        match
      );
    });

    // Step 7: Show total count
    const countResult = await client.query(`
      SELECT 
        COUNT(*) as total,
        COUNT(project_name) as with_project_name
      FROM tasks
    `);
    
    console.log('\n' + '='.repeat(60));
    console.log(`Total tasks: ${countResult.rows[0].total}`);
    console.log(`Tasks with project_name: ${countResult.rows[0].with_project_name}`);
    console.log('='.repeat(60));

    console.log('\n✅ Migration completed successfully!');
    console.log('📌 The project_name field will now auto-populate when tasks are created or updated.');

  } catch (error) {
    console.error('❌ Error during migration:', error.message);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

addProjectNameToTasks();
