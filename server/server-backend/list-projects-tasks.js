const { Pool } = require('pg');

const pool = new Pool({
  user: 'postgres',
  password: 'Super@123',
  host: 'localhost',
  port: 5432,
  database: 'project_time_manager'
});

async function listProjectsAndTasks() {
  try {
    const result = await pool.query(`
      SELECT 
        p.name AS project_name, 
        t.id AS task_id, 
        t.title AS task_title, 
        t.status 
      FROM projects p 
      LEFT JOIN tasks t ON p.id = t.project_id 
      ORDER BY p.name, t.title
    `);

    console.log('='.repeat(60));
    console.log('PROJECTS AND THEIR TASKS');
    console.log('='.repeat(60));

    let currentProject = '';
    let taskCount = 0;

    result.rows.forEach(row => {
      if (row.project_name !== currentProject) {
        currentProject = row.project_name;
        console.log(`\n📁 ${currentProject}`);
        console.log('-'.repeat(40));
      }
      if (row.task_id) {
        taskCount++;
        console.log(`   [${row.status}] ${row.task_title}`);
      } else {
        console.log('   (No tasks)');
      }
    });

    console.log('\n' + '='.repeat(60));
    console.log(`Total tasks: ${taskCount}`);
    console.log('='.repeat(60));

  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await pool.end();
  }
}

listProjectsAndTasks();
