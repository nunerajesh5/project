const { Pool } = require('pg');

const dbConfig = {
  host: 'localhost',
  port: 5432,
  database: 'project_time_manager',
  user: 'postgres',
  password: 'Super@123'
};

const syncOperations = [
  {
    name: 'Drop extra tables',
    sql: `
      DROP TABLE IF EXISTS audit_logs CASCADE;
      DROP TABLE IF EXISTS employee_documents CASCADE;
      DROP TABLE IF EXISTS employees CASCADE;
      DROP TABLE IF EXISTS organization_memberships CASCADE;
      DROP TABLE IF EXISTS organizations CASCADE;
      DROP TABLE IF EXISTS proof_of_work CASCADE;
      DROP TABLE IF EXISTS task_assignments CASCADE;
    `
  },
  {
    name: 'Migrate clients table',
    sql: `
      ALTER TABLE clients ADD COLUMN IF NOT EXISTS client_id UUID DEFAULT uuid_generate_v4();
      ALTER TABLE clients ADD COLUMN IF NOT EXISTS phone_number VARCHAR(50);
      ALTER TABLE clients ADD COLUMN IF NOT EXISTS onboard_date DATE;
      ALTER TABLE clients ADD COLUMN IF NOT EXISTS salutation VARCHAR(20);
      ALTER TABLE clients ADD COLUMN IF NOT EXISTS gst_number VARCHAR(20);
      
      UPDATE clients SET phone_number = phone WHERE phone_number IS NULL;
      UPDATE clients SET client_id = id WHERE client_id IS NULL;
      
      ALTER TABLE clients DROP COLUMN IF EXISTS id CASCADE;
      ALTER TABLE clients DROP COLUMN IF EXISTS name CASCADE;
      ALTER TABLE clients DROP COLUMN IF EXISTS phone CASCADE;
    `
  },
  {
    name: 'Migrate projects table',
    sql: `
      ALTER TABLE projects ADD COLUMN IF NOT EXISTS project_id UUID DEFAULT uuid_generate_v4();
      ALTER TABLE projects ADD COLUMN IF NOT EXISTS project_name VARCHAR(255);
      ALTER TABLE projects ADD COLUMN IF NOT EXISTS estimated_value NUMERIC;
      ALTER TABLE projects ADD COLUMN IF NOT EXISTS project_location VARCHAR(255);
      
      UPDATE projects SET project_name = name WHERE project_name IS NULL AND name IS NOT NULL;
      UPDATE projects SET project_name = 'Untitled Project' WHERE project_name IS NULL;
      UPDATE projects SET estimated_value = budget WHERE estimated_value IS NULL;
      UPDATE projects SET project_location = location WHERE project_location IS NULL;
      UPDATE projects SET project_id = id WHERE project_id IS NULL;
      
      ALTER TABLE projects ALTER COLUMN project_name SET NOT NULL;
      ALTER TABLE projects DROP COLUMN IF EXISTS id CASCADE;
      ALTER TABLE projects DROP COLUMN IF EXISTS name CASCADE;
      ALTER TABLE projects DROP COLUMN IF EXISTS budget CASCADE;
      ALTER TABLE projects DROP COLUMN IF EXISTS priority CASCADE;
      ALTER TABLE projects DROP COLUMN IF EXISTS team_size CASCADE;
      ALTER TABLE projects DROP COLUMN IF EXISTS progress CASCADE;
      ALTER TABLE projects DROP COLUMN IF EXISTS estimated_hours CASCADE;
      ALTER TABLE projects DROP COLUMN IF EXISTS location CASCADE;
      ALTER TABLE projects DROP COLUMN IF EXISTS team_members CASCADE;
    `
  },
  {
    name: 'Migrate task_attachments table',
    sql: `
      ALTER TABLE task_attachments ADD COLUMN IF NOT EXISTS attachments_id UUID DEFAULT uuid_generate_v4();
      ALTER TABLE task_attachments ADD COLUMN IF NOT EXISTS task_id UUID;
      
      UPDATE task_attachments ta SET task_id = a.task_id 
      FROM project_attachments a 
      WHERE ta.upload_id = a.id AND ta.task_id IS NULL;
      
      UPDATE task_attachments SET attachments_id = id WHERE attachments_id IS NULL;
      
      ALTER TABLE task_attachments DROP COLUMN IF EXISTS id CASCADE;
      ALTER TABLE task_attachments DROP COLUMN IF EXISTS upload_id CASCADE;
      ALTER TABLE task_attachments DROP COLUMN IF EXISTS original_name CASCADE;
      ALTER TABLE task_attachments DROP COLUMN IF EXISTS mime_type CASCADE;
      ALTER TABLE task_attachments DROP COLUMN IF EXISTS is_image CASCADE;
    `
  },
  {
    name: 'Migrate tasks table',
    sql: `
      ALTER TABLE tasks ADD COLUMN IF NOT EXISTS task_id UUID DEFAULT uuid_generate_v4();
      ALTER TABLE tasks ADD COLUMN IF NOT EXISTS task_name VARCHAR(255);
      ALTER TABLE tasks ADD COLUMN IF NOT EXISTS start_date DATE;
      ALTER TABLE tasks ADD COLUMN IF NOT EXISTS end_date DATE;
      ALTER TABLE tasks ADD COLUMN IF NOT EXISTS description TEXT;
      ALTER TABLE tasks ADD COLUMN IF NOT EXISTS attachments_id UUID;
      
      UPDATE tasks SET task_name = title WHERE task_name IS NULL AND title IS NOT NULL;
      UPDATE tasks SET task_name = 'Untitled Task' WHERE task_name IS NULL;
      UPDATE tasks SET end_date = due_date WHERE end_date IS NULL;
      UPDATE tasks SET task_id = id WHERE task_id IS NULL;
      
      ALTER TABLE tasks ALTER COLUMN task_name SET NOT NULL;
      ALTER TABLE tasks DROP COLUMN IF EXISTS id CASCADE;
      ALTER TABLE tasks DROP COLUMN IF EXISTS title CASCADE;
      ALTER TABLE tasks DROP COLUMN IF EXISTS due_date CASCADE;
      ALTER TABLE tasks DROP COLUMN IF EXISTS project_name CASCADE;
      ALTER TABLE tasks DROP COLUMN IF EXISTS employee_name CASCADE;
    `
  },
  {
    name: 'Modify time_entries table',
    sql: `
      ALTER TABLE time_entries DROP COLUMN IF EXISTS cost CASCADE;
    `
  },
  {
    name: 'Migrate users table',
    sql: `
      ALTER TABLE users ADD COLUMN IF NOT EXISTS user_id UUID DEFAULT uuid_generate_v4();
      ALTER TABLE users ADD COLUMN IF NOT EXISTS email_id VARCHAR(255);
      ALTER TABLE users ADD COLUMN IF NOT EXISTS phone_number VARCHAR(50);
      ALTER TABLE users ADD COLUMN IF NOT EXISTS salutation VARCHAR(20);
      ALTER TABLE users ADD COLUMN IF NOT EXISTS date_of_birth DATE;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS address TEXT;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS photograph TEXT;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS aadhaar_number VARCHAR(12);
      ALTER TABLE users ADD COLUMN IF NOT EXISTS aadhaar_image TEXT;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS joining_date DATE;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS employee_type VARCHAR(20);
      ALTER TABLE users ADD COLUMN IF NOT EXISTS pay_calculation VARCHAR(20);
      ALTER TABLE users ADD COLUMN IF NOT EXISTS amount NUMERIC;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS overtime_rate NUMERIC;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS department_id UUID;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS designation_id UUID;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS country_id UUID;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS state_id UUID;
      
      UPDATE users SET email_id = email WHERE email_id IS NULL;
      UPDATE users SET user_id = id WHERE user_id IS NULL;
      
      ALTER TABLE users DROP COLUMN IF EXISTS id CASCADE;
      ALTER TABLE users DROP COLUMN IF EXISTS email CASCADE;
      ALTER TABLE users DROP COLUMN IF EXISTS password_hash CASCADE;
      ALTER TABLE users DROP COLUMN IF EXISTS role CASCADE;
    `
  },
  {
    name: 'Create missing tables',
    sql: `
      CREATE TABLE IF NOT EXISTS countries (
        country_id UUID NOT NULL DEFAULT uuid_generate_v4(),
        name VARCHAR(100) NOT NULL,
        code VARCHAR(10),
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS departments (
        department_id UUID NOT NULL DEFAULT uuid_generate_v4(),
        name VARCHAR(100) NOT NULL,
        description TEXT,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS designations (
        designation_id UUID NOT NULL DEFAULT uuid_generate_v4(),
        name VARCHAR(100) NOT NULL,
        description TEXT,
        department_id UUID,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS states (
        state_id UUID NOT NULL DEFAULT uuid_generate_v4(),
        name VARCHAR(100) NOT NULL,
        code VARCHAR(10),
        country_id UUID,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `
  }
];

async function applySync() {
  const pool = new Pool(dbConfig);

  try {
    console.log('Connecting to project_time_manager database...\n');
    
    console.log('Applying synchronization changes in steps...');
    console.log('This will:');
    console.log('  - Drop 7 extra tables');
    console.log('  - Migrate data and modify 6 existing tables');
    console.log('  - Create 4 new tables');
    console.log('');
    
    for (const operation of syncOperations) {
      console.log(`\n→ ${operation.name}...`);
      try {
        await pool.query(operation.sql);
        console.log(`  ✓ Success`);
      } catch (error) {
        console.error(`  ✗ Error: ${error.message}`);
        throw error;
      }
    }
    
    console.log('\n✓ Synchronization completed successfully!\n');
    
    // Verify the changes
    console.log('Verifying tables...');
    const result = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
        AND table_type = 'BASE TABLE'
      ORDER BY table_name;
    `);
    
    console.log(`\nTables now in project_time_manager: ${result.rows.length}`);
    console.log(result.rows.map(r => r.table_name).join(', '));
    
  } catch (error) {
    console.error('\n✗ Error applying synchronization:', error.message);
  } finally {
    await pool.end();
  }
}

applySync();
