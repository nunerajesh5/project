const { Pool } = require('pg');

const pool = new Pool({
  host: 'localhost',
  user: 'postgres',
  password: 'Super@123',
  database: 'project_time_manager',
  port: 5432
});

async function checkEmployeeDocuments() {
  try {
    const result = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'employee_documents' 
      ORDER BY ordinal_position
    `);
    
    if (result.rows.length === 0) {
      console.log('employee_documents table does NOT exist!');
      console.log('\nCreating table...');
      
      await pool.query(`
        CREATE TABLE employee_documents (
          id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          employee_id UUID REFERENCES users(user_id) ON DELETE CASCADE,
          document_type VARCHAR(50) NOT NULL,
          original_name VARCHAR(255),
          file_name VARCHAR(255),
          file_path TEXT,
          file_size INTEGER,
          mime_type VARCHAR(100),
          file_extension VARCHAR(20),
          is_image BOOLEAN DEFAULT false,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        )
      `);
      console.log('✅ employee_documents table created!');
    } else {
      console.log('employee_documents table exists with columns:');
      result.rows.forEach(row => {
        console.log(`  ${row.column_name}: ${row.data_type}`);
      });
    }
  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await pool.end();
  }
}

checkEmployeeDocuments();
