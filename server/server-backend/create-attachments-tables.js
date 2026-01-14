const { Pool } = require('pg');

const pool = new Pool({
  host: 'localhost',
  user: 'postgres',
  password: 'Super@123',
  database: 'project_time_manager',
  port: 5432
});

async function createAttachmentsTables() {
  try {
    // Drop existing tables if they exist
    console.log('Dropping existing tables...');
    await pool.query('DROP TABLE IF EXISTS project_attachments CASCADE');
    console.log('✅ Dropped project_attachments (if existed)');
    
    await pool.query('DROP TABLE IF EXISTS task_attachments CASCADE');
    console.log('✅ Dropped task_attachments (if existed)');

    // Create project_attachments table
    console.log('\nCreating project_attachments table...');
    await pool.query(`
      CREATE TABLE project_attachments (
        attachment_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        project_id UUID NOT NULL REFERENCES projects(project_id) ON DELETE CASCADE,
        file_name VARCHAR(255) NOT NULL,
        file_path TEXT NOT NULL,
        file_type VARCHAR(100),
        file_size BIGINT,
        file_extension VARCHAR(20),
        category VARCHAR(50),
        description TEXT,
        uploaded_by UUID REFERENCES users(user_id) ON DELETE SET NULL,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ Created project_attachments table');

    // Create indexes for project_attachments
    await pool.query('CREATE INDEX idx_project_attachments_project_id ON project_attachments(project_id)');
    await pool.query('CREATE INDEX idx_project_attachments_uploaded_by ON project_attachments(uploaded_by)');
    await pool.query('CREATE INDEX idx_project_attachments_file_type ON project_attachments(file_type)');
    console.log('✅ Created indexes for project_attachments');

    // Create task_attachments table
    console.log('\nCreating task_attachments table...');
    await pool.query(`
      CREATE TABLE task_attachments (
        attachment_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        task_id UUID NOT NULL REFERENCES tasks(task_id) ON DELETE CASCADE,
        file_name VARCHAR(255) NOT NULL,
        file_path TEXT NOT NULL,
        file_type VARCHAR(100),
        file_size BIGINT,
        file_extension VARCHAR(20),
        category VARCHAR(50),
        description TEXT,
        uploaded_by UUID REFERENCES users(user_id) ON DELETE SET NULL,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ Created task_attachments table');

    // Create indexes for task_attachments
    await pool.query('CREATE INDEX idx_task_attachments_task_id ON task_attachments(task_id)');
    await pool.query('CREATE INDEX idx_task_attachments_uploaded_by ON task_attachments(uploaded_by)');
    await pool.query('CREATE INDEX idx_task_attachments_file_type ON task_attachments(file_type)');
    console.log('✅ Created indexes for task_attachments');

    // Show table structures
    console.log('\n--- project_attachments columns ---');
    const projCols = await pool.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns 
      WHERE table_name = 'project_attachments' 
      ORDER BY ordinal_position
    `);
    projCols.rows.forEach(row => {
      console.log(`  ${row.column_name}: ${row.data_type} ${row.is_nullable === 'NO' ? 'NOT NULL' : ''}`);
    });

    console.log('\n--- task_attachments columns ---');
    const taskCols = await pool.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns 
      WHERE table_name = 'task_attachments' 
      ORDER BY ordinal_position
    `);
    taskCols.rows.forEach(row => {
      console.log(`  ${row.column_name}: ${row.data_type} ${row.is_nullable === 'NO' ? 'NOT NULL' : ''}`);
    });

    console.log('\n✅ All done!');

  } catch (err) {
    console.error('❌ Error:', err.message);
  } finally {
    pool.end();
  }
}

createAttachmentsTables();
