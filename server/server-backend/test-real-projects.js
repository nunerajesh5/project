const pool = require('./src/config/database');

async function checkProjectsQuery() {
  try {
    console.log('Testing actual projects query from routes...\n');
    
    const where = 'WHERE 1=1';
    const params = [];
    const limit = 20;
    const offset = 0;
    
    const list = await pool.query(
      `SELECT p.project_id as id, p.project_name as name, p.description, p.status, p.start_date, p.end_date, p.estimated_value as budget, 
              p.project_location as location, NULL as priority, NULL as team_size, NULL as progress, NULL as estimated_hours,
              p.created_at, p.updated_at, c.first_name || ' ' || c.last_name as client_name, c.client_id as client_id
       FROM projects p
       JOIN clients c ON p.client_id = c.client_id
       ${where}
       ORDER BY p.created_at DESC
       LIMIT ${limit} OFFSET ${offset}`,
      params
    );
    
    console.log('✅ Query successful! Found', list.rows.length, 'projects');
    if (list.rows.length > 0) {
      console.log('First project:', JSON.stringify(list.rows[0], null, 2));
    }
    
    const count = await pool.query(`SELECT COUNT(*) as count FROM projects p ${where}`, params);
    console.log('Total count:', count.rows[0].count);
    
  } catch (err) {
    console.error('❌ Query failed:', err.message);
  } finally {
    await pool.end();
  }
}

checkProjectsQuery();
