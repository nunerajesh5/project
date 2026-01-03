const express = require('express');
const { body } = require('express-validator');
const pool = require('../config/database');
const { authenticateToken, requireRole } = require('../middleware/auth');
const { handleValidation } = require('../middleware/validation');

const router = express.Router();
router.use(authenticateToken);

// GET /api/projects - List all projects with pagination and filters
router.get('/', async (req, res) => {
  try {
    const { page = 1, limit = 20, search = '', status = '', clientId = '' } = req.query;
    const offset = (page - 1) * limit;
    
    // Get user info from request
    const userEmail = req.user?.email;
    const userRole = req.user?.role;

    let where = 'WHERE 1=1';
    const params = [];
    
    // If user is NOT admin, only show projects they're a team member of
    if (userRole !== 'admin' && userEmail) {
      // Get employee ID from user email
      const employeeResult = await pool.query(
        'SELECT id FROM employees WHERE email = $1',
        [userEmail]
      );
      
      if (employeeResult.rows.length > 0) {
        const employeeId = employeeResult.rows[0].id;
        params.push(employeeId);
        where += ` AND p.id IN (
          SELECT project_id FROM project_team_memberships WHERE employee_id = $${params.length}
        )`;
        console.log(`[GET /api/projects] ${userRole} filter: employee_id=${employeeId}`);
      }
    }
    
    if (search) {
      params.push(`%${search.toLowerCase()}%`);
      where += ` AND (LOWER(p.name) LIKE $${params.length} OR LOWER(p.description) LIKE $${params.length})`;
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
      `SELECT p.id, p.name, p.description, p.status, p.start_date, p.end_date, p.budget, 
              p.location, p.priority, p.team_size, p.progress, p.estimated_hours,
              p.created_at, p.updated_at, c.name as client_name, c.id as client_id
       FROM projects p
       JOIN clients c ON p.client_id = c.id
       ${where}
       ORDER BY p.created_at DESC
       LIMIT ${limit} OFFSET ${offset}`,
      params
    );

    const count = await pool.query(`SELECT COUNT(*) as count FROM projects p ${where}`, params);
    if (clientId) {
      console.log(`[GET /api/projects] clientId=${clientId} -> ${list.rows.length} projects`);
    }
    
    if (userRole !== 'admin' && userEmail) {
      console.log(`[GET /api/projects] ${userRole} ${userEmail} -> ${list.rows.length} projects (filtered by team membership)`);
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
    const empCheck = await pool.query('SELECT id FROM employees WHERE id = $1', [userId]);
    
    if (empCheck.rows.length === 0 && userEmail) {
      const empByEmail = await pool.query('SELECT id FROM employees WHERE email = $1', [userEmail]);
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
      `SELECT DISTINCT p.id, p.name, p.description, p.status, p.start_date, p.end_date, p.budget,
              p.location, p.priority, p.team_size, p.progress, p.estimated_hours,
              p.created_at, p.updated_at, c.name as client_name, c.id as client_id
       FROM projects p
       JOIN clients c ON p.client_id = c.id
       WHERE p.id IN (
         -- Projects where employee has assigned tasks
         SELECT DISTINCT t.project_id
         FROM tasks t
         WHERE t.assigned_to = $1
         UNION
         -- Projects where employee is a team member
         SELECT DISTINCT ptm.project_id
         FROM project_team_memberships ptm
         WHERE ptm.employee_id = $1
       )
       ORDER BY p.created_at DESC`,
      [employeeId]
    );
    
    console.log(`✅ Found ${result.rows.length} projects (with tasks or team membership) for employee ${employeeId}`);
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
      `SELECT p.id, p.name, p.description, p.status, p.start_date, p.end_date, p.budget, 
              p.location, p.priority, p.team_size, p.progress, p.estimated_hours,
              p.created_at, p.updated_at, c.name as client_name, c.id as client_id
       FROM projects p
       JOIN clients c ON p.client_id = c.id
       WHERE p.id = $1`,
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
  body('status').optional().isIn(['active', 'completed', 'on_hold', 'cancelled', 'pending', 'todo']),
  body('startDate').optional().isISO8601().withMessage('Valid start date required'),
  body('endDate').optional().isISO8601().withMessage('Valid end date required'),
  body('budget').optional().isNumeric().withMessage('Budget must be a number'),
  body('location').optional().isString(),
], handleValidation, async (req, res) => {
  try {
    const { name, clientId, description, status = 'active', startDate, endDate, budget, location } = req.body;
    console.log('[POST /api/projects] Payload:', { name, clientId, status, startDate, endDate, budget, location });
    
    // Verify client exists
    const clientExists = await pool.query('SELECT id, name FROM clients WHERE id = $1', [clientId]);
    if (clientExists.rows.length === 0) {
      return res.status(404).json({ error: 'Client not found' });
    }

    const result = await pool.query(
      'INSERT INTO projects (name, client_id, description, status, start_date, end_date, budget, location) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *',
      [name, clientId, description, status, startDate, endDate, budget, location]
    );
    console.log('[POST /api/projects] Created:', { id: result.rows[0]?.id, client_id: result.rows[0]?.client_id });

    // Log activity for dashboard visibility (non-blocking)
    try {
      await pool.query(
        `INSERT INTO activity_logs (type, actor_id, actor_name, project_id, project_name, description, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP)`,
        [
          'project_created',
          null,
          null,
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
  body('status').optional().isIn(['active', 'completed', 'on_hold', 'cancelled', 'pending', 'todo']),
  body('startDate').optional().isISO8601().withMessage('Valid start date required'),
  body('endDate').optional().isISO8601().withMessage('Valid end date required'),
  body('budget').optional().isNumeric().withMessage('Budget must be a number'),
  body('location').optional().isString(),
], handleValidation, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, clientId, description, status, startDate, endDate, budget, location } = req.body;
    
    // Check if project exists
    const exists = await pool.query('SELECT id FROM projects WHERE id = $1', [id]);
    if (exists.rows.length === 0) {
      return res.status(404).json({ error: 'Project not found' });
    }

    // Verify client exists if clientId is being updated
    if (clientId) {
      const clientExists = await pool.query('SELECT id FROM clients WHERE id = $1', [clientId]);
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
    const projectExists = await pool.query('SELECT id FROM projects WHERE id = $1', [id]);
    if (projectExists.rows.length === 0) {
      return res.status(404).json({ error: 'Project not found' });
    }

    const result = await pool.query(
      `SELECT te.id, te.employee_id, te.manager_id, te.start_time, te.end_time, te.duration_minutes, te.cost, te.description, te.created_at,
              e.first_name, e.last_name, e.employee_id as emp_id
       FROM time_entries te
       JOIN employees e ON te.employee_id = e.id
       WHERE te.project_id = $1 AND te.is_active = true
       ORDER BY te.start_time DESC
       LIMIT ${limit} OFFSET ${offset}`,
      [id]
    );

    const count = await pool.query('SELECT COUNT(*) as count FROM time_entries WHERE project_id = $1 AND is_active = true', [id]);
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
    
    const projectExists = await pool.query('SELECT id FROM projects WHERE id = $1', [id]);
    if (projectExists.rows.length === 0) {
      console.log(`Project ${id} not found`);
      return res.status(404).json({ error: 'Project not found' });
    }
    
    console.log(`Project ${id} exists, fetching tasks...`);
    const list = await pool.query(
      `SELECT t.id, t.project_id, t.title, t.status, t.assigned_to, t.due_date, t.created_at, t.updated_at,
              p.name as project_name, p.status as project_status,
              COALESCE(
                json_agg(
                  json_build_object(
                    'id', e.id,
                    'first_name', e.first_name,
                    'last_name', e.last_name,
                    'email', e.email,
                    'department', e.department
                  )
                ) FILTER (WHERE e.id IS NOT NULL),
                '[]'
              ) as assigned_employees
       FROM tasks t
       JOIN projects p ON t.project_id = p.id
       LEFT JOIN task_assignments ta ON t.id = ta.task_id
       LEFT JOIN employees e ON ta.employee_id = e.id
       WHERE t.project_id = $1
       GROUP BY t.id, p.name, p.status
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
    res.status(500).json({ error: 'Internal server error', details: err.message });
  }
});

// GET /api/projects/:id/team-members - Get team members working on a project
router.get('/:id/team-members', async (req, res) => {
  try {
    const { id } = req.params;
    
    // Check if project exists
    const projectExists = await pool.query('SELECT id FROM projects WHERE id = $1', [id]);
    if (projectExists.rows.length === 0) {
      return res.status(404).json({ error: 'Project not found' });
    }

    // Get team members who have tasks in this project (including unassigned tasks)
    const result = await pool.query(
      `SELECT DISTINCT e.id, e.first_name, e.last_name, e.email, e.employee_id
       FROM employees e
       JOIN tasks t ON e.id = t.assigned_to
       WHERE t.project_id = $1
       ORDER BY e.first_name, e.last_name`,
      [id]
    );

    res.json({ teamMembers: result.rows });
  } catch (err) {
    console.error('Error fetching project team members:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/projects/:id/tasks - Create a task in a project
router.post('/:id/tasks', [
  body('title').trim().notEmpty().withMessage('Title is required'),
  body('status').optional().isIn(['todo', 'in_progress', 'done', 'overdue']),
  body('assignedTo').optional().isUUID(),
  body('dueDate').optional().isISO8601(),
], handleValidation, async (req, res) => {
  try {
    const { id } = req.params;
    const { title, status = 'todo', assignedTo = null, dueDate = null } = req.body;
    const projectExists = await pool.query('SELECT id FROM projects WHERE id = $1', [id]);
    if (projectExists.rows.length === 0) return res.status(404).json({ error: 'Project not found' });
    const result = await pool.query(
      `INSERT INTO tasks (project_id, title, status, assigned_to, due_date)
       VALUES ($1, $2, $3, $4, $5) RETURNING id, project_id, title, status, assigned_to, due_date, created_at, updated_at`,
      [id, title, status, assignedTo, dueDate]
    );
    res.status(201).json({ task: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/projects/:id/stats - Get project statistics
router.get('/:id/stats', async (req, res) => {
  try {
    const { id } = req.params;

    // Verify project exists
    const projectExists = await pool.query('SELECT id, name FROM projects WHERE id = $1', [id]);
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
        JOIN tasks t ON te.task_id = t.id
        WHERE t.project_id = $1 AND te.is_active = true
      `, [id]),
      
      // Employee breakdown
      pool.query(`
        SELECT 
          e.id,
          e.employee_id,
          e.first_name,
          e.last_name,
          e.department,
          e.salary_amount,
          e.hourly_rate,
          SUM(te.duration_minutes) as total_minutes,
          0 as total_cost,
          COUNT(te.id) as entry_count
        FROM time_entries te
        JOIN employees e ON te.employee_id = e.id
        JOIN tasks t ON te.task_id = t.id
        WHERE t.project_id = $1 AND te.is_active = true
        GROUP BY e.id, e.employee_id, e.first_name, e.last_name, e.department, e.salary_amount, e.hourly_rate
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
        JOIN tasks t ON te.task_id = t.id
        WHERE t.project_id = $1 AND te.is_active = true
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
// TEAM MANAGEMENT ENDPOINTS (new table-based)
// ============================================

// GET /api/projects/:id/team - Get team members from project_team_memberships table
router.get('/:id/team', async (req, res) => {
  try {
    const { id } = req.params;
    
    // Check if project exists
    const projectExists = await pool.query('SELECT id, name FROM projects WHERE id = $1', [id]);
    if (projectExists.rows.length === 0) {
      return res.status(404).json({ error: 'Project not found' });
    }

    // Get team members from the new table
    const result = await pool.query(
      `SELECT ptm.id as membership_id, ptm.role, ptm.added_at,
              e.id, e.employee_id, e.first_name, e.last_name, e.email, e.department
       FROM project_team_memberships ptm
       JOIN employees e ON ptm.employee_id = e.id
       WHERE ptm.project_id = $1
       ORDER BY ptm.added_at ASC`,
      [id]
    );

    res.json({ 
      project: { id: projectExists.rows[0].id, name: projectExists.rows[0].name },
      teamMembers: result.rows,
      teamSize: result.rows.length
    });
  } catch (err) {
    console.error('Error fetching project team:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/projects/:id/team - Add a team member to the project
router.post('/:id/team', [
  body('employeeId').isUUID().withMessage('Valid employee ID is required'),
  body('role').optional().isString().withMessage('Role must be a string'),
], handleValidation, async (req, res) => {
  try {
    const { id } = req.params;
    const { employeeId, role = 'member' } = req.body;
    
    // Check if project exists
    const projectExists = await pool.query('SELECT id, name FROM projects WHERE id = $1', [id]);
    if (projectExists.rows.length === 0) {
      return res.status(404).json({ error: 'Project not found' });
    }

    // Check if employee exists
    const employeeExists = await pool.query('SELECT id, first_name, last_name FROM employees WHERE id = $1', [employeeId]);
    if (employeeExists.rows.length === 0) {
      return res.status(404).json({ error: 'Employee not found' });
    }

    // Check if already a team member
    const existingMembership = await pool.query(
      'SELECT id FROM project_team_memberships WHERE project_id = $1 AND employee_id = $2',
      [id, employeeId]
    );
    if (existingMembership.rows.length > 0) {
      return res.status(400).json({ error: 'Employee is already a team member of this project' });
    }

    // Add team member
    const result = await pool.query(
      `INSERT INTO project_team_memberships (project_id, employee_id, role)
       VALUES ($1, $2, $3)
       RETURNING id, project_id, employee_id, role, added_at`,
      [id, employeeId, role]
    );

    res.status(201).json({ 
      message: 'Team member added successfully',
      membership: result.rows[0]
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
    
    // Check if project exists
    const projectExists = await pool.query('SELECT id FROM projects WHERE id = $1', [id]);
    if (projectExists.rows.length === 0) {
      return res.status(404).json({ error: 'Project not found' });
    }

    // Remove team member
    const result = await pool.query(
      'DELETE FROM project_team_memberships WHERE project_id = $1 AND employee_id = $2 RETURNING *',
      [id, employeeId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Team member not found in this project' });
    }

    res.json({ 
      message: 'Team member removed successfully',
      removed: result.rows[0]
    });
  } catch (err) {
    console.error('Error removing team member:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;




