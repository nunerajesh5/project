const express = require('express');
const { body } = require('express-validator');
const pool = require('../config/database');
const { authenticateToken, requireRole } = require('../middleware/auth');
const { handleValidation } = require('../middleware/validation');

const router = express.Router();
router.use(authenticateToken);

// Helper: Check if user is from a real organization (not demo user)
const isOrganizationUser = (req) => req.user?.source === 'registry';

// GET /api/projects - List all projects with pagination and filters
router.get('/', async (req, res) => {
  try {
    // Real organization users see empty data
    if (isOrganizationUser(req)) {
      return res.json({
        projects: [],
        pagination: { total: 0, page: 1, limit: 20, totalPages: 0 }
      });
    }

    const { page = 1, limit = 20, search = '', status = '', clientId = '' } = req.query;
    const offset = (page - 1) * limit;
    
    // Get user info from request
    const userEmail = req.user?.email;
    const userRole = req.user?.role;

    let where = 'WHERE 1=1';
    const params = [];
    
    // Filter projects based on search and status
    
    if (search) {
      params.push(`%${search.toLowerCase()}%`);
      where += ` AND (LOWER(p.project_name) LIKE $${params.length} OR LOWER(p.description) LIKE $${params.length})`;
    }
    if (status) {
      params.push(status.toLowerCase());
      where += ` AND LOWER(p.status) = $${params.length}`;
    }
    if (clientId) {
      params.push(clientId);
      where += ` AND p.client_id = $${params.length}`;
    }

    const list = await pool.query(
      `SELECT p.project_id as id, p.project_name as name, p.description, p.status, p.start_date, p.end_date, p.estimated_value as budget, 
              p.project_location as location, NULL as priority, NULL as team_size, NULL as progress, NULL as estimated_hours,
              p.created_at, p.updated_at, COALESCE(c.first_name || ' ' || c.last_name, 'Unknown Client') as client_name, p.client_id as client_id
       FROM projects p
       LEFT JOIN clients c ON p.client_id = c.client_id
       ${where}
       ORDER BY p.created_at DESC
       LIMIT ${limit} OFFSET ${offset}`,
      params
    );

    const count = await pool.query(`SELECT COUNT(*) as count FROM projects p ${where}`, params);
    if (clientId) {
      console.log(`[GET /api/projects] clientId=${clientId} -> ${list.rows.length} projects`);
    }
    
    res.json({ 
      projects: list.rows, 
      total: parseInt(count.rows[0].count), 
      page: Number(page), 
      limit: Number(limit) 
    });
  } catch (err) {
    console.error('[GET /api/projects] Error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/projects/assigned - Get projects assigned to logged-in employee
// IMPORTANT: This MUST come BEFORE /:id route to avoid route matching issues
router.get('/assigned', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const userEmail = req.user.email;
    
    console.log(`📋 [GET /api/projects/assigned] User: ${userEmail} (${userId})`);
    
    // Find employee by email (since users table ID != employees table ID)
    let employeeId = userId;
    const empCheck = await pool.query('SELECT user_id as id FROM users WHERE user_id = $1', [userId]);
    
    if (empCheck.rows.length === 0 && userEmail) {
      const empByEmail = await pool.query('SELECT user_id as id FROM users WHERE email_id = $1', [userEmail]);
      if (empByEmail.rows.length > 0) {
        employeeId = empByEmail.rows[0].id;
        console.log(`✅ Found employee by email: ${userEmail} -> ${employeeId}`);
      } else {
        console.log(`❌ Employee not found for email: ${userEmail}`);
        return res.json({ projects: [] }); // Return empty array instead of error
      }
    }
    
    // Get distinct projects where employee has tasks assigned OR is a team member
    const result = await pool.query(
      `SELECT DISTINCT p.project_id as id, p.project_name as name, p.description, p.status, p.start_date, p.end_date, p.estimated_value as budget,
              p.project_location as location, NULL as priority, NULL as team_size, NULL as progress, NULL as estimated_hours,
              p.created_at, p.updated_at, COALESCE(c.first_name || ' ' || c.last_name, 'Unknown Client') as client_name, p.client_id as client_id
       FROM projects p
       LEFT JOIN clients c ON p.client_id = c.client_id
       WHERE p.project_id IN (
         -- Projects where employee has assigned tasks (assigned_to is JSONB array)
         SELECT DISTINCT t.project_id
         FROM tasks t
         WHERE t.assigned_to @> to_jsonb($1::uuid)
       )
       ORDER BY p.created_at DESC`,
      [employeeId]
    );
    
    console.log(`✅ Found ${result.rows.length} projects with assigned tasks for employee ${employeeId}`);
    res.json({ projects: result.rows });
  } catch (err) {
    console.error('Error getting assigned projects:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/projects/:id - Get specific project
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      `SELECT p.project_id as id, p.project_name as name, p.description, p.status, p.start_date, p.end_date, p.estimated_value as budget, 
              p.project_location as location, NULL as priority, NULL as team_size, NULL as progress, NULL as estimated_hours,
              p.created_at, p.updated_at, COALESCE(c.first_name || ' ' || c.last_name, 'Unknown Client') as client_name, p.client_id as client_id
       FROM projects p
       LEFT JOIN clients c ON p.client_id = c.client_id
       WHERE p.project_id = $1`,
      [id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Project not found' });
    }
    res.json({ project: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/projects - Create new project
router.post('/', [
  body('name').trim().notEmpty().withMessage('Project name is required'),
  body('clientId').isUUID().withMessage('Valid client ID is required'),
  body('description').optional().isString(),
  body('status').optional().isIn(['active', 'completed', 'on_hold', 'cancelled', 'pending', 'todo', 'Active', 'Completed', 'On Hold', 'Cancelled', 'Pending', 'To Do']),
  body('startDate').optional().isISO8601().withMessage('Valid start date required'),
  body('endDate').optional().isISO8601().withMessage('Valid end date required'),
  body('budget').optional().isNumeric().withMessage('Budget must be a number'),
  body('location').optional().isString(),
  body('coordinates').optional().isString(),
], handleValidation, async (req, res) => {
  try {
    const { name, clientId, description, status = 'To Do', startDate, endDate, budget, location, coordinates } = req.body;
    console.log('[POST /api/projects] Payload:', { name, clientId, status, startDate, endDate, budget, location, coordinates });
    
    // Verify client exists
    const clientExists = await pool.query('SELECT client_id as id, first_name || \' \' || last_name as name FROM clients WHERE client_id = $1', [clientId]);
    if (clientExists.rows.length === 0) {
      return res.status(404).json({ error: 'Client not found' });
    }

    // Insert with correct column names: project_name, project_location, estimated_value, coordinates
    const result = await pool.query(
      `INSERT INTO projects (project_name, client_id, description, status, start_date, end_date, estimated_value, project_location, coordinates) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) 
       RETURNING project_id as id, project_name as name, client_id, description, status, start_date, end_date, estimated_value as budget, project_location as location, coordinates, created_at, updated_at`,
      [name, clientId, description, status, startDate, endDate, budget, location, coordinates]
    );
    console.log('[POST /api/projects] Created:', { id: result.rows[0]?.id, client_id: result.rows[0]?.client_id });

    // Log activity for dashboard visibility (non-blocking)
    try {
      const actorId = req.user?.id || null;
      const actorName = req.user?.first_name ? `${req.user.first_name} ${req.user.last_name}` : null;
      await pool.query(
        `INSERT INTO activity_logs (action_type, actor_id, actor_name, project_id, project_name, description, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP)`,
        [
          'project_created',
          actorId,
          actorName,
          result.rows[0].id,
          result.rows[0].name,
          `Project created for client: ${clientExists.rows[0].name}`
        ]
      );
    } catch (logErr) {
      console.warn('Activity log insert failed (project_created):', logErr.message);
    }
    res.status(201).json({ project: result.rows[0] });
  } catch (err) {
    console.error('Error creating project:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/projects/:id - Update project
router.put('/:id', [
  body('name').optional().trim().notEmpty().withMessage('Project name cannot be empty'),
  body('clientId').optional().isUUID().withMessage('Valid client ID required'),
  body('description').optional().isString(),
  body('status').optional().isIn(['active', 'completed', 'on_hold', 'cancelled', 'pending', 'todo', 'Active', 'Completed', 'On Hold', 'Cancelled', 'Pending', 'To Do']),
  body('startDate').optional().isISO8601().withMessage('Valid start date required'),
  body('endDate').optional().isISO8601().withMessage('Valid end date required'),
  body('budget').optional().isNumeric().withMessage('Budget must be a number'),
  body('location').optional().isString(),
], handleValidation, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, clientId, description, status, startDate, endDate, budget, location } = req.body;
    
    // Check if project exists
    const exists = await pool.query('SELECT project_id as id FROM projects WHERE project_id = $1', [id]);
    if (exists.rows.length === 0) {
      return res.status(404).json({ error: 'Project not found' });
    }

    // Verify client exists if clientId is being updated
    if (clientId) {
      const clientExists = await pool.query('SELECT client_id as id FROM clients WHERE client_id = $1', [clientId]);
      if (clientExists.rows.length === 0) {
        return res.status(404).json({ error: 'Client not found' });
      }
    }

    const result = await pool.query(
      'UPDATE projects SET name = COALESCE($1, name), client_id = COALESCE($2, client_id), description = COALESCE($3, description), status = COALESCE($4, status), start_date = COALESCE($5, start_date), end_date = COALESCE($6, end_date), budget = COALESCE($7, budget), location = COALESCE($8, location), updated_at = CURRENT_TIMESTAMP WHERE id = $9 RETURNING *',
      [name, clientId, description, status, startDate, endDate, budget, location, id]
    );
    res.json({ project: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/projects/:id - Delete project
router.delete('/:id', requireRole(['admin', 'manager']), async (req, res) => {
  try {
    const { id } = req.params;
    
    // Check if project has time entries
    const timeEntries = await pool.query('SELECT COUNT(*) as count FROM time_entries WHERE project_id = $1', [id]);
    if (parseInt(timeEntries.rows[0].count) > 0) {
      return res.status(400).json({ error: 'Cannot delete project with existing time entries' });
    }

    const result = await pool.query('DELETE FROM projects WHERE id = $1 RETURNING *', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Project not found' });
    }
    res.json({ message: 'Project deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/projects/:id/time-entries - Get time entries for a project
router.get('/:id/time-entries', async (req, res) => {
  try {
    const { id } = req.params;
    const { page = 1, limit = 100 } = req.query;
    const offset = (page - 1) * limit;

    // Verify project exists
    const projectExists = await pool.query('SELECT project_id as id FROM projects WHERE project_id = $1', [id]);
    if (projectExists.rows.length === 0) {
      return res.status(404).json({ error: 'Project not found' });
    }

    const result = await pool.query(
      `SELECT te.id, te.employee_id, te.start_time, te.end_time, te.duration_minutes, te.created_at,
              e.first_name, e.last_name, e.user_id as emp_id
       FROM time_entries te
       JOIN users e ON te.employee_id = e.user_id
       JOIN tasks t ON te.task_id = t.task_id
       WHERE t.project_id = $1
       ORDER BY te.start_time DESC
       LIMIT ${limit} OFFSET ${offset}`,
      [id]
    );

    const count = await pool.query('SELECT COUNT(*) as count FROM time_entries te JOIN tasks t ON te.task_id = t.task_id WHERE t.project_id = $1', [id]);
    res.json({ 
      timeEntries: result.rows, 
      total: parseInt(count.rows[0].count), 
      page: Number(page), 
      limit: Number(limit) 
    });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/projects/:id/tasks - List tasks for a project
router.get('/:id/tasks', async (req, res) => {
  try {
    const { id } = req.params;
    const { page = 1, limit = 100 } = req.query;
    const offset = (page - 1) * limit;
    
    console.log(`Fetching tasks for project ${id}, page: ${page}, limit: ${limit}`);
    
    const projectExists = await pool.query('SELECT project_id FROM projects WHERE project_id = $1', [id]);
    if (projectExists.rows.length === 0) {
      console.log(`Project ${id} not found`);
      return res.status(404).json({ error: 'Project not found' });
    }
    
    console.log(`Project ${id} exists, fetching tasks...`);
    const list = await pool.query(
      `SELECT t.task_id as id, t.project_id, t.task_name as title, t.status, t.assigned_to, 
              t.end_date as due_date, t.created_at, t.updated_at,
              p.project_name, p.status as project_status,
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
       JOIN projects p ON t.project_id = p.project_id
       WHERE t.project_id = $1
       ORDER BY t.created_at DESC
       LIMIT ${limit} OFFSET ${offset}`,
      [id]
    );
    
    console.log(`Found ${list.rows.length} tasks for project ${id}`);
    
    const count = await pool.query('SELECT COUNT(*) as count FROM tasks WHERE project_id = $1', [id]);
    const total = parseInt(count.rows[0].count);
    
    console.log(`Total tasks for project ${id}: ${total}`);
    
    res.json({ tasks: list.rows, total, page: Number(page), limit: Number(limit) });
  } catch (err) {
    console.error('Error fetching project tasks:', err);
    console.error('Error stack:', err.stack);
    console.error('Error detail:', err.detail);
    res.status(500).json({ error: 'Internal server error', details: err.message });
  }
});

// GET /api/projects/:id/team-members - Get team members working on a project
router.get('/:id/team-members', async (req, res) => {
  try {
    const { id } = req.params;
    
    // Check if project exists
    const projectExists = await pool.query('SELECT project_id FROM projects WHERE project_id = $1', [id]);
    if (projectExists.rows.length === 0) {
      return res.status(404).json({ error: 'Project not found' });
    }

    // This endpoint is deprecated - use /api/projects/:id/team instead
    res.status(410).json({ 
      error: 'This endpoint is deprecated. Please use GET /api/projects/:id/team',
      redirectTo: `/api/projects/${id}/team`
    });
  } catch (err) {
    console.error('Error fetching project team members:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/projects/:id/tasks - Create a task in a project
router.post('/:id/tasks', [
  body('title').trim().notEmpty().withMessage('Title is required'),
  body('status').optional().isIn(['todo', 'in_progress', 'done', 'overdue']),
  body('assignedTo').optional().isArray(),
  body('assignedTo.*').optional().isUUID(),
  body('dueDate').optional().isISO8601(),
], handleValidation, async (req, res) => {
  try {
    const { id } = req.params;
    const { title, status = 'todo', assignedTo = [], dueDate = null } = req.body;
    
    // Check if project exists and get team members
    const project = await pool.query('SELECT project_id as id, team_member_ids FROM projects WHERE project_id = $1', [id]);
    if (project.rows.length === 0) return res.status(404).json({ error: 'Project not found' });
    
    // Validate assignees are part of project team
    const teamMemberIds = project.rows[0].team_member_ids || [];
    const assignedToArray = Array.isArray(assignedTo) ? assignedTo : (assignedTo ? [assignedTo] : []);
    
    if (assignedToArray.length > 0) {
      const invalidAssignees = assignedToArray.filter(userId => !teamMemberIds.includes(userId));
      if (invalidAssignees.length > 0) {
        return res.status(400).json({ 
          error: 'Some assignees are not part of this project team. Please add them to the project team first.',
          invalidAssignees,
          projectTeamMembers: teamMemberIds
        });
      }
    }
    
    const result = await pool.query(
      `INSERT INTO tasks (project_id, task_name, status, assigned_to, end_date)
       VALUES ($1, $2, $3, $4::jsonb, $5) 
       RETURNING task_id, project_id, task_name as title, status, assigned_to, end_date as due_date, created_at, updated_at`,
      [id, title, status, JSON.stringify(assignedToArray), dueDate]
    );
    res.status(201).json({ task: result.rows[0] });
  } catch (err) {
    console.error('Error creating task:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/projects/:id/stats - Get project statistics
router.get('/:id/stats', async (req, res) => {
  try {
    const { id } = req.params;

    // Verify project exists
    const projectExists = await pool.query('SELECT project_id as id, project_name as name FROM projects WHERE project_id = $1', [id]);
    if (projectExists.rows.length === 0) {
      return res.status(404).json({ error: 'Project not found' });
    }

    // Get project statistics
    const [timeStats, employeeStats, costStats] = await Promise.all([
      // Time statistics
      pool.query(`
        SELECT 
          COUNT(*) as total_entries,
          SUM(te.duration_minutes) as total_minutes,
          0 as total_cost,
          COUNT(DISTINCT te.employee_id) as unique_employees
        FROM time_entries te
        JOIN tasks t ON te.task_id = t.task_id
        WHERE t.project_id = $1
      `, [id]),
      
      // Employee breakdown
      pool.query(`
        SELECT 
          e.user_id as id,
          e.user_id as employee_id,
          e.first_name,
          e.last_name,
          NULL as department,
          NULL as salary_amount,
          NULL as hourly_rate,
          SUM(te.duration_minutes) as total_minutes,
          0 as total_cost,
          COUNT(te.id) as entry_count
        FROM time_entries te
        JOIN users e ON te.employee_id = e.user_id
        JOIN tasks t ON te.task_id = t.task_id
        WHERE t.project_id = $1
        GROUP BY e.user_id, e.first_name, e.last_name
        ORDER BY total_minutes DESC
      `, [id]),
      
      // Cost breakdown by day
      pool.query(`
        SELECT 
          DATE(te.start_time) as date,
          SUM(te.duration_minutes) as daily_minutes,
          0 as daily_cost,
          COUNT(te.id) as daily_entries
        FROM time_entries te
        JOIN tasks t ON te.task_id = t.task_id
        WHERE t.project_id = $1
        GROUP BY DATE(te.start_time)
        ORDER BY date DESC
        LIMIT 30
      `, [id])
    ]);

    const timeData = timeStats.rows[0];
    const employeeBreakdown = employeeStats.rows.map(emp => ({
      id: emp.id,
      employee_id: emp.employee_id,
      first_name: emp.first_name,
      last_name: emp.last_name,
      department: emp.department,
      salary_amount: emp.salary_amount,
      hourly_rate: emp.hourly_rate,
      totalMinutes: parseInt(emp.total_minutes) || 0,
      totalHours: Math.round((parseInt(emp.total_minutes) || 0) / 60 * 100) / 100,
      totalCost: parseFloat(emp.total_cost) || 0,
      entryCount: parseInt(emp.entry_count) || 0
    }));

    const dailyBreakdown = costStats.rows.map(day => ({
      date: day.date,
      totalMinutes: parseInt(day.daily_minutes) || 0,
      totalHours: Math.round((parseInt(day.daily_minutes) || 0) / 60 * 100) / 100,
      totalCost: parseFloat(day.daily_cost) || 0,
      entryCount: parseInt(day.daily_entries) || 0
    }));

    res.json({
      project: {
        id: projectExists.rows[0].id,
        name: projectExists.rows[0].name
      },
      summary: {
        totalEntries: parseInt(timeData.total_entries) || 0,
        totalMinutes: parseInt(timeData.total_minutes) || 0,
        totalHours: Math.round((parseInt(timeData.total_minutes) || 0) / 60 * 100) / 100,
        totalCost: parseFloat(timeData.total_cost) || 0,
        uniqueEmployees: parseInt(timeData.unique_employees) || 0
      },
      employeeBreakdown,
      dailyBreakdown
    });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ============================================
// TEAM MANAGEMENT ENDPOINTS (using team_member_ids array)
// ============================================

// GET /api/projects/:id/team - Get team members using team_member_ids array
router.get('/:id/team', async (req, res) => {
  try {
    const { id } = req.params;
    
    // Get project with team member IDs
    const projectResult = await pool.query(
      'SELECT project_id as id, project_name as name, team_member_ids FROM projects WHERE project_id = $1',
      [id]
    );
    
    if (projectResult.rows.length === 0) {
      return res.status(404).json({ error: 'Project not found' });
    }

    const project = projectResult.rows[0];
    
    // Handle team_member_ids which can be NULL, an array, or need parsing
    let teamMemberIds = [];
    if (project.team_member_ids) {
      if (Array.isArray(project.team_member_ids)) {
        teamMemberIds = project.team_member_ids;
      } else if (typeof project.team_member_ids === 'string') {
        try {
          teamMemberIds = JSON.parse(project.team_member_ids);
        } catch (e) {
          console.warn('Failed to parse team_member_ids:', e);
          teamMemberIds = [];
        }
      }
    }

    // Get team member details
    let teamMembers = [];
    if (teamMemberIds.length > 0) {
      const placeholders = teamMemberIds.map((_, i) => `$${i + 1}`).join(',');
      const result = await pool.query(
        `SELECT u.user_id as id, u.user_id as employee_id, u.first_name, u.last_name, 
                u.email_id as email, u.role
         FROM users u
         WHERE u.user_id::text IN (${placeholders})
         ORDER BY u.first_name, u.last_name`,
        teamMemberIds
      );
      teamMembers = result.rows;
    }

    res.json({ 
      project: { id: project.id, name: project.name },
      teamMembers: teamMembers,
      teamSize: teamMembers.length
    });
  } catch (err) {
    console.error('Error fetching project team:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/projects/:id/team - Add a team member using array column
router.post('/:id/team', [
  body('employeeId').isUUID().withMessage('Valid employee ID is required'),
], handleValidation, async (req, res) => {
  try {
    const { id } = req.params;
    const { employeeId } = req.body;
    
    // Check if project exists
    const projectExists = await pool.query(
      'SELECT project_id as id, project_name as name, team_member_ids FROM projects WHERE project_id = $1',
      [id]
    );
    if (projectExists.rows.length === 0) {
      return res.status(404).json({ error: 'Project not found' });
    }

    // Check if employee exists
    const employeeExists = await pool.query(
      'SELECT user_id as id, first_name, last_name FROM users WHERE user_id = $1',
      [employeeId]
    );
    if (employeeExists.rows.length === 0) {
      return res.status(404).json({ error: 'Employee not found' });
    }

    // Add employee to team_member_ids JSONB array (if not already present)
    // Handle NULL case: initialize with empty array if NULL, then check/append
    await pool.query(
      `UPDATE projects 
       SET team_member_ids = 
         CASE 
           WHEN team_member_ids IS NULL THEN $1::jsonb
           WHEN team_member_ids @> $1::jsonb THEN team_member_ids
           ELSE team_member_ids || $1::jsonb
         END
       WHERE project_id = $2`,
      [JSON.stringify([employeeId]), id]
    );

    res.status(201).json({ 
      message: 'Team member added successfully',
      project_id: id,
      employee_id: employeeId
    });
  } catch (err) {
    console.error('Error adding team member:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/projects/:id/team/:employeeId - Remove a team member from the project
router.delete('/:id/team/:employeeId', async (req, res) => {
  try {
    const { id, employeeId } = req.params;
    
    // Check if project exists and get current team members
    const projectResult = await pool.query(
      'SELECT project_id as id, team_member_ids FROM projects WHERE project_id = $1', 
      [id]
    );
    
    if (projectResult.rows.length === 0) {
      return res.status(404).json({ error: 'Project not found' });
    }

    const currentTeam = Array.isArray(projectResult.rows[0].team_member_ids)
      ? projectResult.rows[0].team_member_ids
      : (projectResult.rows[0].team_member_ids ? JSON.parse(projectResult.rows[0].team_member_ids) : []);
    
    // Check if employee is in the team
    if (!currentTeam.includes(employeeId)) {
      return res.status(404).json({ error: 'Team member not found in this project' });
    }

    // Remove employee from JSONB array using PostgreSQL operation
    await pool.query(
      `UPDATE projects 
       SET team_member_ids = team_member_ids - $1::text
       WHERE project_id = $2`,
      [employeeId, id]
    );

    res.json({ 
      message: 'Team member removed successfully',
      removedEmployeeId: employeeId
    });
  } catch (err) {
    console.error('Error removing team member:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;




