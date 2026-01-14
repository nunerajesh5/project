const { Pool } = require('pg');

const pool = new Pool({
  host: 'localhost',
  user: 'postgres',
  password: 'Super@123',
  database: 'project_time_manager',
  port: 5432
});

async function setupITDepartment() {
  try {
    // Check departments table structure
    const columns = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'departments' 
      ORDER BY ordinal_position
    `);
    
    console.log('=== Departments Table Columns ===\n');
    columns.rows.forEach(row => {
      console.log(`  ${row.column_name}: ${row.data_type}`);
    });
    
    // Check existing departments
    const existingDepts = await pool.query(`SELECT * FROM departments`);
    console.log('\n=== Existing Departments ===\n');
    existingDepts.rows.forEach(dept => {
      console.log(`  - ${dept.name} (${dept.department_id})`);
    });
    
    // Add IT Department if not exists
    console.log('\n=== Adding IT Department ===\n');
    let itDeptId;
    const existingIT = await pool.query(`SELECT department_id FROM departments WHERE name = 'IT Department'`);
    
    if (existingIT.rows.length > 0) {
      itDeptId = existingIT.rows[0].department_id;
      console.log(`✓ IT Department already exists (ID: ${itDeptId})`);
    } else {
      const result = await pool.query(`
        INSERT INTO departments (name, description)
        VALUES ('IT Department', 'Information Technology Department - handles software development, data analysis, system administration, and technical operations')
        RETURNING department_id
      `);
      itDeptId = result.rows[0].department_id;
      console.log(`✅ IT Department created (ID: ${itDeptId})`);
    }
    
    // Check designations table structure
    const desigColumns = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'designations' 
      ORDER BY ordinal_position
    `);
    
    console.log('\n=== Designations Table Columns ===\n');
    desigColumns.rows.forEach(row => {
      console.log(`  ${row.column_name}: ${row.data_type}`);
    });
    
    // Check if department_id column exists in designations
    const hasDeptColumn = desigColumns.rows.some(col => col.column_name === 'department_id');
    
    if (!hasDeptColumn) {
      console.log('\nAdding department_id column to designations table...');
      await pool.query(`ALTER TABLE designations ADD COLUMN department_id UUID REFERENCES departments(department_id)`);
      console.log('✅ department_id column added to designations');
    }
    
    // IT-related designations
    const itDesignations = [
      'Software Developer',
      'Data Analyst',
      'System Administrator',
      'QA Engineer',
      'UI/UX Designer',
      'Business Analyst',
      'Manager'  // IT Manager
    ];
    
    console.log('\n=== Linking IT Designations to IT Department ===\n');
    
    for (const desigName of itDesignations) {
      const result = await pool.query(`
        UPDATE designations 
        SET department_id = $1 
        WHERE name = $2
        RETURNING name
      `, [itDeptId, desigName]);
      
      if (result.rows.length > 0) {
        console.log(`  ✅ ${desigName} -> IT Department`);
      }
    }
    
    // Also update users to have IT Department
    console.log('\n=== Updating Users to IT Department ===\n');
    await pool.query(`UPDATE users SET department_id = $1 WHERE department_id IS NULL`, [itDeptId]);
    
    // Show final result
    console.log('\n=== Final Designations with Departments ===\n');
    const designations = await pool.query(`
      SELECT d.name as designation, dep.name as department
      FROM designations d
      LEFT JOIN departments dep ON d.department_id = dep.department_id
      ORDER BY d.name
    `);
    
    designations.rows.forEach(d => {
      console.log(`  ${d.designation}: ${d.department || 'No department'}`);
    });
    
    // Show employees with departments
    console.log('\n=== Employees with Departments ===\n');
    const employees = await pool.query(`
      SELECT u.first_name, u.last_name, des.name as designation, dep.name as department
      FROM users u
      LEFT JOIN designations des ON u.designation_id = des.designation_id
      LEFT JOIN departments dep ON u.department_id = dep.department_id
      ORDER BY u.created_at
    `);
    
    employees.rows.forEach((emp, i) => {
      console.log(`${i + 1}. ${emp.first_name} ${emp.last_name}`);
      console.log(`   Designation: ${emp.designation || 'Not assigned'}`);
      console.log(`   Department: ${emp.department || 'Not assigned'}`);
      console.log('');
    });
    
  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await pool.end();
  }
}

setupITDepartment();
