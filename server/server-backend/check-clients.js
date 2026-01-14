const { Pool } = require('pg');
const pool = new Pool({
  host: 'localhost',
  user: 'postgres',
  password: 'Super@123',
  database: 'project_time_manager',
  port: 5432
});

async function checkClients() {
  try {
    // Insert a test client with salutation directly
    const insertResult = await pool.query(`
      INSERT INTO clients (first_name, last_name, email, phone_number, address, salutation, gst_number, onboard_date) 
      VALUES ('TestSal', 'ClientAPI', 'testsal_api@example.com', '1234567890', '123 Test St', 'Mr', 'GST12345', '2024-01-15')
      RETURNING client_id, first_name, last_name, salutation, gst_number, onboard_date
    `);
    console.log('Inserted client:', insertResult.rows[0]);
    
    // Verify salutation is saved
    const verifyResult = await pool.query(`
      SELECT client_id, first_name, last_name, salutation, gst_number, onboard_date 
      FROM clients 
      WHERE email = 'testsal_api@example.com'
    `);
    console.log('Verified client:', verifyResult.rows[0]);
    
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await pool.end();
  }
}

checkClients();
