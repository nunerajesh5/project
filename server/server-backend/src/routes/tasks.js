const express = require('express');
const { body } = require('express-validator');
const pool = require('../config/database');
const { authenticateToken } = require('../middleware/auth');
const { handleValidation } = require('../middleware/validation');

const router = express.Router();
router.use(authenticateToken);

// Helper to check if user is from organization registry (real org user, not demo)
function isOrganizationUser(req) {
  return req.user && req.user.source === 'registry';
}

// GET /api/tasks - Get all tasks with employee and project information
router.get('/', async (req, res) => {
  try {
    const { page = 1, limit = 100, status = '', projectId = '', assignedTo = '' } = req.query;
    const offset = (page - 1) * limit;

    // Real organization users see empty tasks list (no dummy data)
    if (isOrganizationUser(req)) {
      return res.json({
        tasks: [],
        total: 0,
        page: Number(page),
        limit: Number(limit)
      });
    }

    let where = 'WHERE 1=1';
    const params = [];

    if (status) {
      params.push(status.toLowerCase());
      where += ` AND LOWER(t.status) = $${params.length}`;
    }

    if (projectId) {
      params.push(projectId);
      where += ` AND t.project_id = $${params.length}`;
    }

    if (assignedTo) {
      params.push(assignedTo);
      where += ` AND t.assigned_to @> to_jsonb($${params.length}::uuid)`;
    }

    const result = await pool.query(
      `SELECT t.task_id, t.project_id, t.task_name, t.status, t.assigned_to, t.start_date, t.end_date, t.created_at, t.updated_at,
              t.approved, t.approved_at, t.approval_notes,
              p.project_name as project_name, p.status as project_status,
              COALESCE(
                json_agg(
                  json_build_object(
                    'id', u.user_id,
                    'first_name', u.first_name,
                    'last_name', u.last_name,
                    'email', u.email_id
                  )
                ) FILTER (WHERE u.user_id IS NOT NULL),
                '[]'
              ) as assigned_employees
       FROM tasks t
       JOIN projects p ON t.project_id = p.project_id
       LEFT JOIN users u ON t.assigned_to = u.user_id
       ${where}
       GROUP BY t.task_id, t.project_id, t.task_name, t.status, t.assigned_to, t.start_date, t.end_date, t.created_at, t.updated_at,
                t.approved, t.approved_at, t.approval_notes, p.project_name, p.status
       ORDER BY t.start_date ASC, t.created_at DESC
       LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, parseInt(limit), parseInt(offset)]
    );

    const count = await pool.query(`SELECT COUNT(*) as count FROM tasks t ${where}`, params);

    res.json({
      tasks: result.rows,
      total: parseInt(count.rows[0].count),
      page: Number(page),
      limit: Number(limit)
    });
  } catch (err) {
    console.error('Error fetching all tasks:', err);
    console.error('Error details:', {
      message: err.message,
      stack: err.stack,
      query: req.query
    });
    res.status(500).json({ 
      error: 'Internal server error',
      message: err.message 
    });
  }
});

// POST /api/tasks - Create a task (project_id in body)
router.post('/', [
  body('project_id').isUUID().withMessage('Valid project ID is required'),
  body('title').trim().notEmpty().withMessage('Title is required'),
  body('status').optional().isIn(['todo', 'in_progress', 'done', 'overdue', 'To Do', 'Active', 'Completed', 'Cancelled', 'On Hold']),
  body('assigned_to').optional(),
  body('description').optional().isString(),
  body('start_date').optional().isISO8601(),
  body('end_date').optional().isISO8601(),
  body('high_priority').optional().isBoolean(),
  body('location').optional().isString(),
], handleValidation, async (req, res) => {
  try {
    const { 
      project_id, 
      title, 
      status = 'todo', 
      assigned_to = null, 
      description = null,
      start_date = null,
      end_date = null,
      high_priority = false,
      location = null
    } = req.body;
    
    // Get project with team members
    const project = await pool.query('SELECT project_id as id, team_member_ids FROM projects WHERE project_id = $1', [project_id]);
    if (project.rows.length === 0) return res.status(404).json({ error: 'Project not found' });
    
    // Handle assigned_to - can be single UUID or array
    let assignedToArray = [];
    if (assigned_to) {
      if (Array.isArray(assigned_to)) {
        assignedToArray = assigned_to;
      } else if (typeof assigned_to === 'string' && assigned_to.trim()) {
        assignedToArray = [assigned_to];
      }
    }
    
    // Require at least 2 team members for each task
    if (assignedToArray.length < 2) {
      return res.status(400).json({ 
        error: 'Each task must have at least 2 team members assigned'
      });
    }
    
    // Validate assignees are part of project team
    const teamMemberIds = project.rows[0].team_member_ids || [];
    if (teamMemberIds.length > 0) {
      const invalidAssignees = assignedToArray.filter(userId => !teamMemberIds.includes(userId));
      if (invalidAssignees.length > 0) {
        return res.status(400).json({ 
          error: 'All assignees must be part of this project team',
          invalidAssignees 
        });
      }
    }
    
    // Map lowercase/API status to database enum values
    // Valid enum values: 'To Do', 'Active', 'Completed', 'Cancelled', 'On Hold'
    const statusMap = {
      'todo': 'To Do',
      'in_progress': 'Active',
      'done': 'Completed',
      'overdue': 'On Hold',
      'completed': 'Completed',
      'active': 'Active',
      'cancelled': 'Cancelled',
      'on_hold': 'On Hold',
      // Already correct enum values pass through
      'To Do': 'To Do',
      'Active': 'Active',
      'Completed': 'Completed',
      'Cancelled': 'Cancelled',
      'On Hold': 'On Hold'
    };
    const dbStatus = statusMap[status] || 'To Do';
    
    const result = await pool.query(
      `INSERT INTO tasks (project_id, task_name, status, assigned_to, description, start_date, end_date, high_priority, location)
       VALUES ($1, $2, $3, $4::jsonb, $5, $6, $7, $8, $9) 
       RETURNING task_id as id, project_id, task_name as title, status, assigned_to, start_date, end_date as due_date, high_priority, location, created_at, updated_at`,
      [project_id, title, dbStatus, JSON.stringify(assignedToArray), description, start_date, end_date, high_priority, location]
    );
    
    res.status(201).json({ task: result.rows[0] });
  } catch (err) {
    console.error('Error creating task:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/projects/:id/tasks - list tasks for a project
router.get('/project/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { page = 1, limit = 100 } = req.query;
    const offset = (page - 1) * limit;
    const project = await pool.query('SELECT project_id FROM projects WHERE project_id = $1', [id]);
    if (project.rows.length === 0) return res.status(404).json({ error: 'Project not found' });
    const list = await pool.query(
      `SELECT t.task_id as id, t.project_id, t.task_name as title, t.status, t.assigned_to, 
              t.end_date as due_date, t.created_at, t.updated_at,
              COALESCE(
                (SELECT json_agg(
                  json_build_object(
                    'id', u.user_id,
                    'first_name', u.first_name,
                    'last_name', u.last_name,
                    'email', u.email_id,
                    'department', d.name
                  )
                )
                FROM users u
                LEFT JOIN departments d ON u.department_id = d.department_id
                WHERE t.assigned_to @> to_jsonb(u.user_id)),
                '[]'::json
              ) as assigned_employees
       FROM tasks t
       WHERE t.project_id = $1
       ORDER BY t.created_at DESC
       LIMIT ${limit} OFFSET ${offset}`,
      [id]
    );
    const count = await pool.query('SELECT COUNT(*) as count FROM tasks WHERE project_id = $1', [id]);
    res.json({ tasks: list.rows, total: parseInt(count.rows[0].count), page: Number(page), limit: Number(limit) });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/projects/:id/tasks - create a task
router.post('/project/:id', [
  body('title').trim().notEmpty().withMessage('Title is required'),
  body('status').optional().isIn(['todo', 'in_progress', 'done', 'overdue']),
  body('assignedTo').optional().isArray(),
  body('assignedTo.*').optional().isUUID(),
  body('dueDate').optional().isISO8601(),
], handleValidation, async (req, res) => {
  try {
    const { id } = req.params;
    const { title, status = 'todo', assignedTo = [], dueDate = null } = req.body;
    
    // Get project with team members
    const project = await pool.query('SELECT project_id as id, team_member_ids FROM projects WHERE project_id = $1', [id]);
    if (project.rows.length === 0) return res.status(404).json({ error: 'Project not found' });
    
    // Validate assignees are part of project team
    const teamMemberIds = project.rows[0].team_member_ids || [];
    const assignedToArray = Array.isArray(assignedTo) ? assignedTo : (assignedTo ? [assignedTo] : []);
    
    if (assignedToArray.length > 0) {
      const invalidAssignees = assignedToArray.filter(userId => !teamMemberIds.includes(userId));
      if (invalidAssignees.length > 0) {
        return res.status(400).json({ 
          error: 'Some assignees are not part of this project team',
          invalidAssignees 
        });
      }
    }
    
    const result = await pool.query(
      `INSERT INTO tasks (project_id, task_name, status, assigned_to, end_date)
       VALUES ($1, $2, $3, $4::jsonb, $5) RETURNING task_id, project_id, task_name, status, assigned_to, end_date, created_at, updated_at`,
      [id, title, status, JSON.stringify(assignedToArray), dueDate]
    );
    // Log activity: task_created (by manager)
    try {
      const actorId = req.user?.id || null;
      const actorName = req.user?.first_name ? `${req.user.first_name} ${req.user.last_name}` : null;
      
      // Fetch project name
      const projectInfo = await pool.query('SELECT project_name FROM projects WHERE project_id = $1', [id]);
      const projectName = projectInfo.rows[0]?.project_name || null;
      
      // Fetch employee name for first assignee
      let employeeName = null;
      if (assignedTo[0]) {
        const empInfo = await pool.query('SELECT first_name, last_name FROM users WHERE user_id = $1', [assignedTo[0]]);
        if (empInfo.rows[0]) {
          employeeName = `${empInfo.rows[0].first_name} ${empInfo.rows[0].last_name}`;
        }
      }
      
      await pool.query(
        `INSERT INTO activity_logs (action_type, actor_id, actor_name, employee_id, employee_name, project_id, project_name, task_id, task_title, description)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [
          'task_created',
          actorId,
          actorName,
          assignedTo[0], // Log first assignee
          employeeName,
          id,
          projectName,
          result.rows[0].task_id,
          title,
          `Task created and assigned to ${assignedTo.length} team member(s).`
        ]
      );
    } catch (e) { /* ignore logging errors */ }
    res.status(201).json({ task: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/tasks/employee/:employeeId - get tasks assigned to an employee
router.get('/employee/:employeeId', async (req, res) => {
  try {
    const { employeeId } = req.params;
    const { page = 1, limit = 100, status = '' } = req.query;
    const offset = (page - 1) * limit;
    
    // Find user by ID or by email
    let finalEmployeeId = employeeId;
    const userCheck = await pool.query('SELECT user_id FROM users WHERE user_id = $1', [employeeId]);
    
    if (userCheck.rows.length === 0) {
      // If not found by ID, try to find by email using the logged-in user's email
      if (req.user && req.user.email) {
        const userByEmail = await pool.query('SELECT user_id FROM users WHERE email_id = $1', [req.user.email]);
        if (userByEmail.rows.length > 0) {
          finalEmployeeId = userByEmail.rows[0].user_id;
          console.log(`✅ Found user by email for tasks: ${req.user.email} -> ${finalEmployeeId}`);
        } else {
          console.log(`❌ User not found for email: ${req.user.email}, returning empty tasks`);
          return res.json({ tasks: [], total: 0, page: Number(page), limit: Number(limit) });
        }
      } else {
        console.log(`❌ User not found for ID: ${employeeId}, returning empty tasks`);
        return res.json({ tasks: [], total: 0, page: Number(page), limit: Number(limit) });
      }
    }

    let where = 'WHERE t.assigned_to @> to_jsonb($1::uuid)';
    const params = [finalEmployeeId];
    
    if (status) {
      params.push(status.toLowerCase());
      where += ` AND LOWER(t.status) = $${params.length}`;
    }

    // Get tasks assigned to this user using tasks.assigned_to array column
    const result = await pool.query(
      `SELECT t.task_id as id, t.task_id, t.project_id, t.task_name as title, t.task_name, t.status, 
              t.start_date, t.end_date as due_date, t.created_at, t.updated_at,
              p.project_name as project_name, p.status as project_status, p.project_location,
              COALESCE(
                (SELECT json_agg(
                  json_build_object(
                    'id', u.user_id,
                    'first_name', u.first_name,
                    'last_name', u.last_name,
                    'email', u.email_id,
                    'department', u.department_id
                  )
                )
                FROM users u
                WHERE t.assigned_to @> to_jsonb(u.user_id)),
                '[]'::json
              ) as assigned_employees
       FROM tasks t
       JOIN projects p ON t.project_id = p.project_id
       ${where}
       ORDER BY t.start_date ASC NULLS LAST, t.created_at DESC
       LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, parseInt(limit), parseInt(offset)]
    );

    const count = await pool.query(
      `SELECT COUNT(*) as count FROM tasks t ${where}`, 
      params
    );
    
    console.log(`✅ Found ${result.rows.length} tasks for user ${finalEmployeeId}`);
    
    res.json({ 
      tasks: result.rows, 
      total: parseInt(count.rows[0].count), 
      page: Number(page), 
      limit: Number(limit) 
    });
  } catch (err) {
    console.error('Error fetching employee tasks:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PATCH /api/tasks/:taskId - update task fields
router.patch('/:taskId', [
  body('title').optional().trim().notEmpty(),
  body('status').optional().isIn(['todo', 'in_progress', 'done', 'overdue']),
  body('assignedTo').optional().isArray(),
  body('assignedTo.*').optional().isUUID(),
  body('dueDate').optional().isISO8601(),
], handleValidation, async (req, res) => {
  try {
    const { taskId } = req.params;
    const { title, status, assignedTo, dueDate } = req.body;
    
    // Get task with its project
    const taskData = await pool.query('SELECT task_id as id, project_id FROM tasks WHERE task_id = $1', [taskId]);
    if (taskData.rows.length === 0) return res.status(404).json({ error: 'Task not found' });
    
    // If assignedTo is provided, validate against project team
    let assignedToArray = null;
    if (assignedTo !== undefined) {
      const project = await pool.query('SELECT team_member_ids FROM projects WHERE project_id = $1', [taskData.rows[0].project_id]);
      const teamMemberIds = project.rows[0]?.team_member_ids || [];
      assignedToArray = Array.isArray(assignedTo) ? assignedTo : (assignedTo ? [assignedTo] : []);
      
      if (assignedToArray.length > 0) {
        const invalidAssignees = assignedToArray.filter(userId => !teamMemberIds.includes(userId));
        if (invalidAssignees.length > 0) {
          return res.status(400).json({ 
            error: 'Some assignees are not part of this project team',
            invalidAssignees 
          });
        }
      }
    }
    
    const result = await pool.query(
      `UPDATE tasks
       SET task_name = COALESCE($1, task_name),
           status = COALESCE($2, status),
           assigned_to = COALESCE($3::jsonb, assigned_to),
           end_date = COALESCE($4, end_date),
           updated_at = CURRENT_TIMESTAMP
       WHERE task_id = $5
       RETURNING task_id, project_id, task_name, status, assigned_to, end_date, created_at, updated_at`,
      [title, status, assignedToArray ? JSON.stringify(assignedToArray) : null, dueDate, taskId]
    );
    // Log activity: task_assigned (if assignedTo changed)
    if (assignedToArray && assignedToArray.length > 0) {
      try {
        const actorId = req.user?.id || null;
        const actorName = req.user?.first_name ? `${req.user.first_name} ${req.user.last_name}` : null;
        
        // Fetch project name
        const projectInfo = await pool.query('SELECT project_name FROM projects WHERE project_id = $1', [result.rows[0].project_id]);
        const projectName = projectInfo.rows[0]?.project_name || null;
        
        // Fetch employee name for first assignee
        let employeeName = null;
        if (assignedToArray[0]) {
          const empInfo = await pool.query('SELECT first_name, last_name FROM users WHERE user_id = $1', [assignedToArray[0]]);
          if (empInfo.rows[0]) {
            employeeName = `${empInfo.rows[0].first_name} ${empInfo.rows[0].last_name}`;
          }
        }
        
        await pool.query(
          `INSERT INTO activity_logs (action_type, actor_id, actor_name, employee_id, employee_name, project_id, project_name, task_id, task_title, description)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
          [
            'task_assigned',
            actorId,
            actorName,
            assignedToArray[0], // Log first assignee
            employeeName,
            result.rows[0].project_id,
            projectName,
            result.rows[0].task_id,
            result.rows[0].task_name,
            `Task assigned to ${assignedToArray.length} team member(s).`
          ]
        );
      } catch (e) { /* ignore logging errors */ }
    }
    res.json({ task: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PATCH /api/tasks/:id/assign - Assign team members to a task (validates against project team)
router.patch('/:id/assign', [
  body('assignedTo').isArray().withMessage('assignedTo must be an array of user IDs'),
  body('assignedTo.*').isUUID().withMessage('Each assignee must be a valid UUID'),
], handleValidation, async (req, res) => {
  try {
    const { id } = req.params;
    const { assignedTo } = req.body;
    
    // Check if task exists and get project_id
    const taskExists = await pool.query('SELECT task_id as id, project_id FROM tasks WHERE task_id = $1', [id]);
    if (taskExists.rows.length === 0) {
      return res.status(404).json({ error: 'Task not found' });
    }
    
    const projectId = taskExists.rows[0].project_id;
    
    // Get project team members
    const project = await pool.query('SELECT team_member_ids FROM projects WHERE project_id = $1', [projectId]);
    const teamMemberIds = project.rows[0]?.team_member_ids || [];
    
    // Validate all assignees are part of the project team
    const invalidAssignees = assignedTo.filter(userId => !teamMemberIds.includes(userId));
    if (invalidAssignees.length > 0) {
      return res.status(400).json({ 
        error: 'Some assignees are not part of this project team. Only project team members can be assigned to tasks.',
        invalidAssignees,
        projectTeamMembers: teamMemberIds
      });
    }
    
    // Check if all users exist
    const usersCheck = await pool.query('SELECT user_id, first_name, last_name FROM users WHERE user_id = ANY($1::uuid[])', [assignedTo]);
    if (usersCheck.rows.length !== assignedTo.length) {
      const foundIds = usersCheck.rows.map(u => u.user_id);
      const notFoundIds = assignedTo.filter(id => !foundIds.includes(id));
      return res.status(404).json({ error: 'Some users not found', notFoundIds });
    }

    // Update the task assignment
    const result = await pool.query(
      `UPDATE tasks SET assigned_to = $1::jsonb, updated_at = NOW() 
       WHERE task_id = $2 
       RETURNING task_id, project_id, task_name, status, assigned_to, end_date as due_date, created_at, updated_at`,
      [JSON.stringify(assignedTo), id]
    );

    // Format assignees info for response
    const assigneesInfo = usersCheck.rows.map(user => ({
      id: user.user_id,
      first_name: user.first_name,
      last_name: user.last_name,
      name: `${user.first_name} ${user.last_name}`
    }));

    res.json({ 
      task: result.rows[0],
      assignedTo: assigneesInfo
    });
  } catch (err) {
    console.error('Error assigning task:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/tasks/:taskId/approve - Approve a completed task
router.put('/:taskId/approve', [
  body('approved').isBoolean().withMessage('Approved status is required'),
  body('approvalNotes').optional().isString().trim(),
], handleValidation, async (req, res) => {
  try {
    const { taskId } = req.params;
    const { approved, approvalNotes } = req.body;
    const approverId = req.user.id;

    // Check if task exists and get current status
    const taskQuery = `
      SELECT t.task_id, t.task_name, t.status, t.assigned_to,
             p.project_name as project_name,
             (SELECT json_agg(json_build_object('id', u.user_id, 'first_name', u.first_name, 'last_name', u.last_name))
              FROM users u WHERE t.assigned_to @> to_jsonb(u.user_id)) as assignees
      FROM tasks t
      JOIN projects p ON t.project_id = p.project_id
      WHERE t.task_id = $1
    `;
    const taskResult = await pool.query(taskQuery, [taskId]);
    
    if (taskResult.rows.length === 0) {
      return res.status(404).json({ error: 'Task not found' });
    }

    const task = taskResult.rows[0];

    // Only allow approval of completed tasks
    if (task.status !== 'done') {
      return res.status(400).json({ 
        error: 'Only completed tasks can be approved',
        currentStatus: task.status
      });
    }

    // Update task approval status
    const updateQuery = `
      UPDATE tasks 
      SET approved = $1, 
          approved_at = CASE WHEN $1 = true THEN CURRENT_TIMESTAMP ELSE NULL END,
          approval_notes = $2,
          updated_at = CURRENT_TIMESTAMP
      WHERE task_id = $3
      RETURNING task_id, task_name, status, approved, approved_at, approval_notes, updated_at
    `;

    const result = await pool.query(updateQuery, [
      approved, 
      approvalNotes, 
      taskId
    ]);

    res.json({
      success: true,
      task: result.rows[0],
      message: approved ? 'Task approved successfully' : 'Task approval removed'
    });

  } catch (err) {
    console.error('Error approving task:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/tasks/pending-approval - Get tasks pending approval
router.get('/pending-approval', async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;

    const query = `
      SELECT t.task_id, t.project_id, t.task_name, t.status, t.assigned_to, t.start_date, 
             t.created_at, t.updated_at, t.approved, t.approved_at, t.approval_notes,
             p.project_name as project_name, p.status as project_status,
             e.first_name, e.last_name, u.email_id as employee_email
      FROM tasks t
      JOIN projects p ON t.project_id = p.project_id
      JOIN users u ON t.assigned_to = u.user_id
      WHERE t.status = 'done' AND t.approved = false
      ORDER BY t.updated_at DESC
      LIMIT $1 OFFSET $2
    `;

    const countQuery = `
      SELECT COUNT(*) as total
      FROM tasks 
      WHERE status = 'done' AND approved = false
    `;

    const [result, countResult] = await Promise.all([
      pool.query(query, [limit, offset]),
      pool.query(countQuery)
    ]);

    res.json({
      tasks: result.rows,
      total: parseInt(countResult.rows[0].total),
      page: Number(page),
      limit: Number(limit)
    });

  } catch (err) {
    console.error('Error fetching pending approval tasks:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/tasks/approved - Get approved tasks
router.get('/approved', async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;

    const query = `
      SELECT t.task_id, t.project_id, t.task_name, t.status, t.assigned_to, t.start_date, 
             t.created_at, t.updated_at, t.approved, t.approved_at, t.approval_notes,
             p.project_name as project_name, p.status as project_status,
             e.first_name, e.last_name, u.email_id as employee_email
      FROM tasks t
      JOIN projects p ON t.project_id = p.project_id
      JOIN users u ON t.assigned_to = u.user_id
      WHERE t.status = 'done' AND t.approved = true
      ORDER BY t.approved_at DESC
      LIMIT $1 OFFSET $2
    `;

    const countQuery = `
      SELECT COUNT(*) as total
      FROM tasks 
      WHERE status = 'done' AND approved = true
    `;

    const [result, countResult] = await Promise.all([
      pool.query(query, [limit, offset]),
      pool.query(countQuery)
    ]);

    res.json({
      tasks: result.rows,
      total: parseInt(countResult.rows[0].total),
      page: Number(page),
      limit: Number(limit)
    });

  } catch (err) {
    console.error('Error fetching approved tasks:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/tasks/:id - Get a specific task by ID (must be last due to wildcard)
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    // Get task details with multiple assignees
    const result = await pool.query(
      `SELECT t.task_id, t.project_id, t.task_name, t.status, t.assigned_to, t.start_date, 
              t.end_date as due_date, t.created_at, t.updated_at, t.approved, t.approved_at, t.approval_notes,
              p.project_name as project_name, p.status as project_status, p.project_location,
              COALESCE(c.first_name || ' ' || c.last_name, 'Unknown Client') as client_name,
              COALESCE(
                (SELECT json_agg(
                  json_build_object(
                    'id', u.user_id,
                    'first_name', u.first_name,
                    'last_name', u.last_name,
                    'email', u.email_id,
                    'department', u.department_id
                  )
                )
                FROM users u
                WHERE t.assigned_to @> to_jsonb(u.user_id)),
                '[]'::json
              ) as assigned_employees
       FROM tasks t
       JOIN projects p ON t.project_id = p.project_id
       LEFT JOIN clients c ON p.client_id = c.client_id
       WHERE t.task_id = $1`,
      [id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Task not found' });
    }
    
    // Get total time from time entries
    const timeStats = await pool.query(
      `SELECT 
         COALESCE(SUM(te.duration_minutes), 0) as total_time_minutes
       FROM time_entries te
       WHERE te.task_id = $1`,
      [id]
    );
    
    const task = result.rows[0];
    const stats = timeStats.rows[0];
    
    // Add total time to task object
    task.total_time_minutes = parseInt(stats.total_time_minutes) || 0;
    
    res.json({ task });
  } catch (err) {
    console.error('Error fetching task:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;


