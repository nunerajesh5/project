const { Pool } = require('pg');
const pool = new Pool({
  host: 'localhost',
  port: 5432,
  database: 'project_time_manager',
  user: 'postgres',
  password: 'Super@123',
});

async function fixDatabase() {
  try {
    console.log('Checking database structure...\n');
    
    // List all tables first
    const tables = await pool.query(`
      SELECT tablename 
      FROM pg_tables 
      WHERE schemaname='public' 
      ORDER BY tablename
    `);
    console.log('📋 Tables:', tables.rows.map(r => r.tablename).join(', '));
    
    // Check projects table structure
    console.log('\n🔍 Projects table:');
    const projectsColumns = await pool.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name='projects' 
      ORDER BY ordinal_position
    `);
    console.log('   Columns:', projectsColumns.rows.map(r => r.column_name).join(', '));
    
    // Check tasks table structure
    console.log('\n🔍 Tasks table:');
    const tasksColumns = await pool.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name='tasks' 
      ORDER BY ordinal_position
    `);
    console.log('   Columns:', tasksColumns.rows.map(r => r.column_name).join(', '));
    
    // Check time_entries table structure
    console.log('\n🔍 Time_entries table:');
    const timeEntriesColumns = await pool.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name='time_entries' 
      ORDER BY ordinal_position
    `);
    console.log('   Columns:', timeEntriesColumns.rows.map(r => r.column_name).join(', '));
    
    // Check users table structure
    console.log('\n🔍 Users table:');
    const usersColumns = await pool.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name='users' 
      ORDER BY ordinal_position
    `);
    console.log('   Columns:', usersColumns.rows.map(r => r.column_name).join(', '));
    
    // Now check if attachments table exists and create if needed
    console.log('\n🔍 Checking attachments table...');
    const attachmentsCheck = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'attachments'
      )
    `);
    
    if (!attachmentsCheck.rows[0].exists) {
      console.log('   ✗ Table missing - need to fix primary keys first...');
      
      // Check if tasks.task_id is a primary key
      const tasksPK = await pool.query(`
        SELECT constraint_name
        FROM information_schema.table_constraints
        WHERE table_name = 'tasks' AND constraint_type = 'PRIMARY KEY'
      `);
      
      if (tasksPK.rows.length === 0) {
        console.log('   ⚠️  Tasks table has no primary key! Adding it...');
        await pool.query(`
          ALTER TABLE tasks ADD PRIMARY KEY (task_id)
        `);
        console.log('   ✓ Added PRIMARY KEY constraint to tasks.task_id');
      }
      
      // Check if projects.project_id is a primary key
      const projectsPK = await pool.query(`
        SELECT constraint_name
        FROM information_schema.table_constraints
        WHERE table_name = 'projects' AND constraint_type = 'PRIMARY KEY'
      `);
      
      if (projectsPK.rows.length === 0) {
        console.log('   ⚠️  Projects table has no primary key! Adding it...');
        await pool.query(`
          ALTER TABLE projects ADD PRIMARY KEY (project_id)
        `);
        console.log('   ✓ Added PRIMARY KEY constraint to projects.project_id');
      }
      
      // Check if users.user_id is a primary key
      const usersPK = await pool.query(`
        SELECT constraint_name
        FROM information_schema.table_constraints
        WHERE table_name = 'users' AND constraint_type = 'PRIMARY KEY'
      `);
      
      if (usersPK.rows.length === 0) {
        console.log('   ⚠️  Users table has no primary key! Adding it...');
        await pool.query(`
          ALTER TABLE users ADD PRIMARY KEY (user_id)
        `);
        console.log('   ✓ Added PRIMARY KEY constraint to users.user_id');
      }
      
      // Now create project_attachments table
      await pool.query(`
        CREATE TABLE IF NOT EXISTS project_attachments (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          task_id UUID NOT NULL REFERENCES tasks(task_id) ON DELETE CASCADE,
          employee_id UUID REFERENCES users(user_id) ON DELETE CASCADE,
          description TEXT NOT NULL,
          status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
          uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        )
      `);
      console.log('   ✓ project_attachments table created');
    } else {
      console.log('   ✓ Table exists');
    }
    
    console.log('\n✅ Database check complete!');
    
  } catch (err) {
    console.error('❌ Error:', err.message);
  } finally {
    await pool.end();
  }
}

fixDatabase();
