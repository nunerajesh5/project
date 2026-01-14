const { Pool } = require('pg');
const pool = new Pool({
  host: 'localhost',
  port: 5432,
  database: 'project_time_manager',
  user: 'postgres',
  password: 'Super@123',
});

pool.query("SELECT column_name FROM information_schema.columns WHERE table_name='departments'")
  .then(r => {
    console.log('Departments columns:', r.rows.map(x => x.column_name).join(', '));
    return pool.end();
  });
