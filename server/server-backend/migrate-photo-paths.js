const { Pool } = require('pg');
const pool = new Pool({
  host: 'localhost',
  port: 5432,
  database: 'project_time_manager',
  user: 'postgres',
  password: 'Super@123'
});

async function migratePhotoPaths() {
  console.log('Migrating photo paths from employee_documents to users table...\n');

  // Get all photo documents
  const photos = await pool.query(`
    SELECT ed.employee_id, ed.file_path, ed.document_type
    FROM employee_documents ed
    WHERE ed.document_type IN ('photo', 'aadhaar')
    ORDER BY ed.created_at DESC
  `);

  console.log(`Found ${photos.rows.length} document(s) to migrate\n`);

  let photoUpdates = 0;
  let aadhaarUpdates = 0;

  for (const doc of photos.rows) {
    if (doc.document_type === 'photo') {
      // Check if user's photograph is NULL
      const user = await pool.query(
        'SELECT photograph FROM users WHERE user_id = $1',
        [doc.employee_id]
      );
      
      if (user.rows.length > 0 && !user.rows[0].photograph) {
        await pool.query(
          'UPDATE users SET photograph = $1, updated_at = CURRENT_TIMESTAMP WHERE user_id = $2',
          [doc.file_path, doc.employee_id]
        );
        photoUpdates++;
        console.log(`✓ Updated photograph for employee ${doc.employee_id}`);
      }
    } else if (doc.document_type === 'aadhaar') {
      // Check if user's aadhaar_image is NULL
      const user = await pool.query(
        'SELECT aadhaar_image FROM users WHERE user_id = $1',
        [doc.employee_id]
      );
      
      if (user.rows.length > 0 && !user.rows[0].aadhaar_image) {
        await pool.query(
          'UPDATE users SET aadhaar_image = $1, updated_at = CURRENT_TIMESTAMP WHERE user_id = $2',
          [doc.file_path, doc.employee_id]
        );
        aadhaarUpdates++;
        console.log(`✓ Updated aadhaar_image for employee ${doc.employee_id}`);
      }
    }
  }

  console.log(`\n=== Migration Complete ===`);
  console.log(`Photo updates: ${photoUpdates}`);
  console.log(`Aadhaar updates: ${aadhaarUpdates}`);

  // Verify the migration
  console.log('\n=== Verification ===');
  const verification = await pool.query(`
    SELECT user_id, first_name, last_name, 
           CASE WHEN photograph IS NOT NULL THEN 'Yes' ELSE 'No' END as has_photo,
           CASE WHEN aadhaar_image IS NOT NULL THEN 'Yes' ELSE 'No' END as has_aadhaar
    FROM users
    WHERE photograph IS NOT NULL OR aadhaar_image IS NOT NULL
  `);
  
  if (verification.rows.length > 0) {
    console.log('Users with photos/aadhaar images:');
    verification.rows.forEach(u => {
      console.log(`  ${u.first_name} ${u.last_name}: Photo=${u.has_photo}, Aadhaar=${u.has_aadhaar}`);
    });
  } else {
    console.log('No users have photos or aadhaar images in the users table yet.');
  }

  await pool.end();
}

migratePhotoPaths().catch(console.error);
