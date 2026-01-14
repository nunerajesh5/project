const { Pool } = require('pg');

const pool = new Pool({
  host: 'localhost',
  user: 'postgres',
  password: 'Super@123',
  database: 'project_time_manager',
  port: 5432
});

async function setupDesignations() {
  try {
    // Check if designations table exists
    const tableCheck = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'designations'
      )
    `);
    
    if (!tableCheck.rows[0].exists) {
      console.log('Creating designations table...');
      await pool.query(`
        CREATE TABLE designations (
          designation_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          name VARCHAR(100) NOT NULL UNIQUE,
          description TEXT,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        )
      `);
      console.log('✅ Designations table created');
    } else {
      console.log('✅ Designations table already exists');
    }
    
    // Define designations
    const designations = [
      { name: 'Manager', description: 'Project Manager responsible for team and project oversight' },
      { name: 'Data Analyst', description: 'Analyzes data and provides insights' },
      { name: 'Software Developer', description: 'Develops and maintains software applications' },
      { name: 'UI/UX Designer', description: 'Designs user interfaces and experiences' },
      { name: 'QA Engineer', description: 'Quality assurance and testing specialist' },
      { name: 'Business Analyst', description: 'Analyzes business requirements and processes' },
      { name: 'System Administrator', description: 'Manages system infrastructure and operations' }
    ];
    
    // Insert designations
    console.log('\nAdding designations...');
    const designationIds = {};
    
    for (const designation of designations) {
      // Check if exists first
      const existing = await pool.query(`
        SELECT designation_id FROM designations WHERE name = $1
      `, [designation.name]);
      
      let designationId;
      if (existing.rows.length > 0) {
        designationId = existing.rows[0].designation_id;
        console.log(`  ✓ ${designation.name} (already exists)`);
      } else {
        const result = await pool.query(`
          INSERT INTO designations (name, description)
          VALUES ($1, $2)
          RETURNING designation_id
        `, [designation.name, designation.description]);
        designationId = result.rows[0].designation_id;
        console.log(`  ✅ ${designation.name} (created)`);
      }
      
      designationIds[designation.name] = designationId;
    }
    
    // Assign designations to employees
    console.log('\nAssigning designations to employees...');
    
    const employeeDesignations = [
      { email: 'admin@company.com', designation: 'System Administrator' },
      { email: 'rajesh@company.com', designation: 'Manager' },
      { email: 'alice@company.com', designation: 'Data Analyst' },
      { email: 'bob@company.com', designation: 'Software Developer' },
      { email: 'charlie@company.com', designation: 'UI/UX Designer' },
      { email: 'diana@company.com', designation: 'QA Engineer' },
      { email: 'ethan@company.com', designation: 'Business Analyst' },
      { email: 'fiona@company.com', designation: 'Software Developer' }
    ];
    
    for (const emp of employeeDesignations) {
      const designationId = designationIds[emp.designation];
      await pool.query(`
        UPDATE users SET designation_id = $1 WHERE email_id = $2
      `, [designationId, emp.email]);
      console.log(`  ✅ ${emp.email} -> ${emp.designation}`);
    }
    
    // Show final result
    console.log('\n=== Final Employee List with Designations ===\n');
    const employees = await pool.query(`
      SELECT u.first_name, u.last_name, u.email_id, u.role, d.name as designation
      FROM users u
      LEFT JOIN designations d ON u.designation_id = d.designation_id
      ORDER BY u.created_at
    `);
    
    employees.rows.forEach((emp, i) => {
      console.log(`${i + 1}. ${emp.first_name} ${emp.last_name}`);
      console.log(`   Email: ${emp.email_id}`);
      console.log(`   Role: ${emp.role}`);
      console.log(`   Designation: ${emp.designation || 'Not assigned'}`);
      console.log('');
    });
    
  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await pool.end();
  }
}

setupDesignations();
