const pool = require('./src/config/database');

async function checkColumns() {
  try {
    const clients = await pool.query(`
      SELECT column_name FROM information_schema.columns 
      WHERE table_name = 'clients' ORDER BY ordinal_position
    `);
    console.log('Clients columns:', clients.rows.map(x => x.column_name));

    const users = await pool.query(`
      SELECT column_name FROM information_schema.columns 
      WHERE table_name = 'users' ORDER BY ordinal_position
    `);
    console.log('Users columns:', users.rows.map(x => x.column_name));

    const tasks = await pool.query(`
      SELECT column_name FROM information_schema.columns 
      WHERE table_name = 'tasks' ORDER BY ordinal_position
    `);
    console.log('Tasks columns:', tasks.rows.map(x => x.column_name));

    const projects = await pool.query(`
      SELECT column_name FROM information_schema.columns 
      WHERE table_name = 'projects' ORDER BY ordinal_position
    `);
    console.log('Projects columns:', projects.rows.map(x => x.column_name));

    process.exit(0);
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
}

checkColumns();
