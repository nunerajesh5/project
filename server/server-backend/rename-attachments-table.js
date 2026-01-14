const pool = require('./src/config/database');

async function renameAttachmentsTable() {
  try {
    console.log('🔄 Starting table rename process...\n');

    // Check if attachments table exists
    const checkQuery = `
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'attachments'
      );
    `;
    const checkResult = await pool.query(checkQuery);
    
    if (!checkResult.rows[0].exists) {
      console.log('❌ attachments table does not exist');
      return;
    }

    console.log('✓ Found attachments table');

    // Check if project_attachments already exists
    const checkNewQuery = `
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'project_attachments'
      );
    `;
    const checkNewResult = await pool.query(checkNewQuery);
    
    if (checkNewResult.rows[0].exists) {
      console.log('⚠️  project_attachments table already exists');
      return;
    }

    // Rename the table
    await pool.query('ALTER TABLE attachments RENAME TO project_attachments;');
    console.log('✓ Renamed attachments → project_attachments');

    // Rename indexes
    await pool.query('ALTER INDEX IF EXISTS idx_attachments_task_id RENAME TO idx_project_attachments_task_id;');
    console.log('✓ Renamed index: idx_attachments_task_id → idx_project_attachments_task_id');

    await pool.query('ALTER INDEX IF EXISTS idx_attachments_employee_id RENAME TO idx_project_attachments_employee_id;');
    console.log('✓ Renamed index: idx_attachments_employee_id → idx_project_attachments_employee_id');

    await pool.query('ALTER INDEX IF EXISTS idx_attachments_status RENAME TO idx_project_attachments_status;');
    console.log('✓ Renamed index: idx_attachments_status → idx_project_attachments_status');

    await pool.query('ALTER INDEX IF EXISTS idx_attachments_uploaded_at RENAME TO idx_project_attachments_uploaded_at;');
    console.log('✓ Renamed index: idx_attachments_uploaded_at → idx_project_attachments_uploaded_at');

    // Update foreign key constraint in task_attachments
    // First, get the constraint name
    const fkQuery = `
      SELECT constraint_name
      FROM information_schema.table_constraints
      WHERE table_name = 'task_attachments'
      AND constraint_type = 'FOREIGN KEY'
      AND constraint_name LIKE '%attachments%';
    `;
    const fkResult = await pool.query(fkQuery);
    
    if (fkResult.rows.length > 0) {
      const constraintName = fkResult.rows[0].constraint_name;
      await pool.query(`ALTER TABLE task_attachments DROP CONSTRAINT ${constraintName};`);
      console.log(`✓ Dropped old foreign key constraint: ${constraintName}`);
      
      await pool.query(`
        ALTER TABLE task_attachments 
        ADD CONSTRAINT task_attachments_upload_id_fkey 
        FOREIGN KEY (upload_id) REFERENCES project_attachments(id) ON DELETE CASCADE;
      `);
      console.log('✓ Added new foreign key constraint referencing project_attachments');
    }

    console.log('\n✅ Table rename completed successfully!');
    process.exit(0);

  } catch (error) {
    console.error('❌ Error renaming table:', error);
    process.exit(1);
  }
}

renameAttachmentsTable();
