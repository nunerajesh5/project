const express = require('express');
const { body } = require('express-validator');
const pool = require('../config/database');
const { authenticateToken, requireRole } = require('../middleware/auth');
const { handleValidation } = require('../middleware/validation');
const multer = require('multer');
const fs = require('fs');
const path = require('path');

const router = express.Router();
router.use(authenticateToken);
// Employee photo upload setup
const photoUploadDir = path.resolve(__dirname, '../../uploads/employee-photos');
fs.mkdirSync(photoUploadDir, { recursive: true });

const photoStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, photoUploadDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const name = path.basename(file.originalname, ext);
    const timestamp = Date.now();
    const random = Math.round(Math.random() * 1e9);
    cb(null, `${timestamp}-${random}-${name}${ext}`);
  }
});

const photoUpload = multer({
  storage: photoStorage,
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = /jpeg|jpg|png/;
    const ext = path.extname(file.originalname).toLowerCase().substring(1);
    if (allowed.test(ext)) cb(null, true);
    else cb(new Error('Only image files (jpg, jpeg, png) are allowed'), false);
  }
});

// POST /api/employees/:id/photo - Upload employee photo
router.post('/:id/photo', photoUpload.single('photo'), async (req, res) => {
  try {
    const { id } = req.params;
    if (!req.file) {
      return res.status(400).json({ error: 'Photo file is required' });
    }
    const file = req.file;

    // Ensure employee exists
    const exists = await pool.query('SELECT id FROM employees WHERE id = $1', [id]);
    if (exists.rows.length === 0) {
      // cleanup file if employee not found
      try { fs.unlinkSync(file.path); } catch {}
      return res.status(404).json({ error: 'Employee not found' });
    }

    // Store file metadata in employee_documents
    const insert = await pool.query(
      `INSERT INTO employee_documents (employee_id, document_type, original_name, file_name, file_path, file_size, mime_type, file_extension, is_image)
       VALUES ($1, 'photo', $2, $3, $4, $5, $6, $7, true)
       RETURNING id`,
      [id, file.originalname, file.filename, file.path, file.size, file.mimetype, path.extname(file.originalname).toLowerCase()]
    );

    res.json({ success: true, documentId: insert.rows[0].id, fileName: file.filename });
  } catch (error) {
    console.error('Error uploading employee photo:', error);
    res.status(500).json({ error: 'Failed to upload photo' });
  }
});

// GET /api/employees - List all employees with pagination and search
router.get('/', async (req, res) => {
  try {
    const { page = 1, limit = 50, search = '', department = '', active = 'true' } = req.query;
    const offset = (page - 1) * limit;
    let where = 'WHERE 1=1';
    const params = [];
    
    if (active === 'true') {
      where += ' AND e.is_active = true';
    } else if (active === 'false') {
      where += ' AND e.is_active = false';
    }
    
    if (search) {
      params.push(`%${search.toLowerCase()}%`);
      where += ` AND (LOWER(e.first_name) LIKE $${params.length} OR LOWER(e.last_name) LIKE $${params.length} OR LOWER(e.employee_id) LIKE $${params.length})`;
    }
    
    if (department) {
      params.push(department);
      where += ` AND e.department = $${params.length}`;
    }
    
    // Determine if user can see salary information (only admin)
    const canViewSalary = req.user && req.user.role === 'admin';
    console.log('User role:', req.user?.role, 'Can view salary:', canViewSalary);
    
    // If user is a manager (NOT admin), exclude other managers from the results
    if (req.user && req.user.role === 'manager') {
      where += ` AND e.department != 'Management'`;
      console.log('Manager role: filtering out Management department');
    } else if (req.user && req.user.role === 'admin') {
      console.log('Admin role: showing ALL employees including Management');
    }
    
    const salaryFields = canViewSalary 
      ? ', e.salary_type, e.salary_amount, e.hourly_rate'
      : '';
    
    const list = await pool.query(
      `SELECT e.id, e.employee_id, e.first_name, e.last_name, e.email, e.phone, e.department, 
              e.salutation, e.date_of_birth, e.joining_date, e.employment_type, e.aadhaar_number,
              e.salary_type, e.salary_amount, e.hourly_rate, e.is_active, e.created_at, e.updated_at
       FROM employees e
       ${where}
       ORDER BY e.created_at DESC
       LIMIT ${limit} OFFSET ${offset}`,
      params
    );
    const count = await pool.query(`SELECT COUNT(*) as count FROM employees e ${where}`, params);
    
    console.log('📊 Query Results:');
    console.log('   Total employees found:', list.rows.length);
    console.log('   Departments:', [...new Set(list.rows.map(e => e.department))]);
    console.log('   Management employees:', list.rows.filter(e => e.department === 'Management').map(e => `${e.first_name} ${e.last_name}`));
    
    res.json({ 
      employees: list.rows, 
      total: parseInt(count.rows[0].count), 
      page: Number(page), 
      limit: Number(limit) 
    });
  } catch (err) {
    console.error('GET /api/employees failed:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/employees/:id - Get specific employee
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    // Determine if user can see salary information (only admin)
    const canViewSalary = req.user && req.user.role === 'admin';
    
    // If user is a manager, check if the employee is not a manager
    let whereClause = 'WHERE id = $1';
    if (req.user && req.user.role === 'manager') {
      whereClause += ` AND department != 'Management'`;
    }
    
    const salaryFields = canViewSalary 
      ? ', salary_type, salary_amount, hourly_rate'
      : '';
    
    const result = await pool.query(
      `SELECT id, employee_id, first_name, last_name, email, phone, department${salaryFields}, is_active, created_at, updated_at FROM employees ${whereClause}`,
      [id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Employee not found' });
    }
    res.json({ employee: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/employees - Create new employee
router.post('/', [
  body('employeeId').trim().notEmpty().withMessage('Employee ID is required'),
  body('firstName').trim().notEmpty().withMessage('First name is required'),
  body('lastName').trim().notEmpty().withMessage('Last name is required'),
  body('email').optional().isEmail().withMessage('Valid email required'),
  body('phone').optional().isString(),
  body('department').optional().isString(),
  body('salutation').optional().isString(),
  body('dateOfBirth').optional().isISO8601().withMessage('Valid date of birth required'),
  body('joiningDate').optional().isISO8601().withMessage('Valid joining date required'),
  body('employmentType').optional().isIn(['Permanent', 'Temp.', 'Contract']),
  body('aadhaarNumber').optional().isString(),
  body('salaryType').isIn(['hourly', 'daily', 'monthly']).withMessage('Valid salary type required'),
  body('salaryAmount').isNumeric().withMessage('Salary amount must be a number'),
  body('hourlyRate').optional().isNumeric().withMessage('Hourly rate must be a number'),
], handleValidation, async (req, res) => {
  try {
    const { employeeId, firstName, lastName, email, phone, department, salutation, dateOfBirth, joiningDate, employmentType, aadhaarNumber, salaryType, salaryAmount, hourlyRate } = req.body;
    
    // Check if employee ID already exists
    const existing = await pool.query('SELECT id FROM employees WHERE employee_id = $1', [employeeId]);
    if (existing.rows.length > 0) {
      return res.status(409).json({ error: 'Employee ID already exists' });
    }

    const result = await pool.query(
      `INSERT INTO employees (employee_id, first_name, last_name, email, phone, department, salutation, date_of_birth, joining_date, employment_type, aadhaar_number, salary_type, salary_amount, hourly_rate) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14) RETURNING *`,
      [employeeId, firstName, lastName, email, phone, department, salutation || null, dateOfBirth || null, joiningDate || null, employmentType || null, aadhaarNumber || null, salaryType, salaryAmount, hourlyRate]
    );
    res.status(201).json({ employee: result.rows[0] });
  } catch (err) {
    if (String(err.message || '').includes('duplicate')) {
      return res.status(409).json({ error: 'Employee with this ID already exists' });
    }
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/employees/:id - Update employee
router.put('/:id', [
  body('employeeId').optional().trim().notEmpty().withMessage('Employee ID cannot be empty'),
  body('firstName').optional().trim().notEmpty().withMessage('First name cannot be empty'),
  body('lastName').optional().trim().notEmpty().withMessage('Last name cannot be empty'),
  body('email').optional().isEmail().withMessage('Valid email required'),
  body('phone').optional().isString(),
  body('department').optional().isString(),
  body('salaryType').optional().isIn(['hourly', 'daily', 'monthly']).withMessage('Valid salary type required'),
  body('salaryAmount').optional().isNumeric().withMessage('Salary amount must be a number'),
  body('hourlyRate').optional().isNumeric().withMessage('Hourly rate must be a number'),
  body('isActive').optional().isBoolean().withMessage('isActive must be boolean'),
], handleValidation, async (req, res) => {
  try {
    const { id } = req.params;
    const { employeeId, firstName, lastName, email, phone, department, salaryType, salaryAmount, hourlyRate, isActive } = req.body;
    
    // Check if employee exists
    const exists = await pool.query('SELECT id FROM employees WHERE id = $1', [id]);
    if (exists.rows.length === 0) {
      return res.status(404).json({ error: 'Employee not found' });
    }

    // Check if employee ID is being changed and if it already exists
    if (employeeId) {
      const existing = await pool.query('SELECT id FROM employees WHERE employee_id = $1 AND id != $2', [employeeId, id]);
      if (existing.rows.length > 0) {
        return res.status(409).json({ error: 'Employee ID already exists' });
      }
    }

    const result = await pool.query(
      'UPDATE employees SET employee_id = COALESCE($1, employee_id), first_name = COALESCE($2, first_name), last_name = COALESCE($3, last_name), email = COALESCE($4, email), phone = COALESCE($5, phone), department = COALESCE($6, department), salary_type = COALESCE($7, salary_type), salary_amount = COALESCE($8, salary_amount), hourly_rate = COALESCE($9, hourly_rate), is_active = COALESCE($10, is_active), updated_at = CURRENT_TIMESTAMP WHERE id = $11 RETURNING *',
      [employeeId, firstName, lastName, email, phone, department, salaryType, salaryAmount, hourlyRate, isActive, id]
    );
    res.json({ employee: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/employees/:id - Soft delete employee
router.delete('/:id', requireRole(['admin', 'manager']), async (req, res) => {
  try {
    const { id } = req.params;
    
    // Check if employee has active time entries
    const timeEntries = await pool.query('SELECT COUNT(*) as count FROM time_entries WHERE employee_id = $1 AND is_active = true', [id]);
    if (parseInt(timeEntries.rows[0].count) > 0) {
      return res.status(400).json({ error: 'Cannot delete employee with active time entries' });
    }

    const result = await pool.query('UPDATE employees SET is_active = false, updated_at = CURRENT_TIMESTAMP WHERE id = $1 RETURNING *', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Employee not found' });
    }
    res.json({ message: 'Employee deactivated successfully' });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/employees/:id/time-entries - Get time entries for an employee
router.get('/:id/time-entries', async (req, res) => {
  try {
    const { id } = req.params;
    const { page = 1, limit = 100, projectId = '' } = req.query;
    const offset = (page - 1) * limit;
    
    // Find employee by ID or by email (for users table compatibility)
    let employeeId = id;
    const employeeCheck = await pool.query('SELECT id, email FROM employees WHERE id = $1', [id]);
    
    if (employeeCheck.rows.length === 0) {
      // If not found by ID, try to find by email using the logged-in user's email
      if (req.user && req.user.email) {
        const empByEmail = await pool.query('SELECT id FROM employees WHERE email = $1', [req.user.email]);
        if (empByEmail.rows.length > 0) {
          employeeId = empByEmail.rows[0].id;
          console.log(`✅ Found employee by email: ${req.user.email} -> ${employeeId}`);
        } else {
          return res.status(404).json({ error: 'Employee not found' });
        }
      } else {
        return res.status(404).json({ error: 'Employee not found' });
      }
    }

    let where = 'WHERE te.employee_id = $1 AND te.is_active = true';
    const params = [employeeId];
    
    if (projectId) {
      params.push(projectId);
      where += ` AND p.id = $${params.length}`;
    }

    const result = await pool.query(
      `SELECT te.id, te.task_id, te.work_date, te.start_time, te.end_time, te.duration_minutes, te.description, te.created_at,
              t.title as task_title, t.status as task_status,
              p.name as project_name, p.status as project_status, p.id as project_id
       FROM time_entries te
       JOIN tasks t ON te.task_id = t.id
       JOIN projects p ON t.project_id = p.id
       ${where}
       ORDER BY te.start_time DESC
       LIMIT ${limit} OFFSET ${offset}`,
      params
    );

    const count = await pool.query(
      `SELECT COUNT(*) as count 
       FROM time_entries te
       JOIN tasks t ON te.task_id = t.id
       JOIN projects p ON t.project_id = p.id
       ${where}`, 
      params
    );
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

// GET /api/employees/:id/summary - Get employee summary with stats
router.get('/:id/summary', async (req, res) => {
  try {
    const { id } = req.params;
    const { startDate, endDate } = req.query;
    
    // Determine if user can see salary information (only admin)
    const canViewSalary = req.user && req.user.role === 'admin';
    
    // If user is a manager, check if the employee is not a manager
    let whereClause = 'WHERE id = $1';
    if (req.user && req.user.role === 'manager') {
      whereClause += ` AND department != 'Management'`;
    }
    
    const salaryFields = canViewSalary 
      ? ', salary_type, salary_amount, hourly_rate'
      : '';
    
    // Verify employee exists
    const employee = await pool.query(`SELECT id, first_name, last_name, employee_id${salaryFields} FROM employees ${whereClause}`, [id]);
    if (employee.rows.length === 0) {
      return res.status(404).json({ error: 'Employee not found' });
    }

    let dateFilter = '';
    const params = [id];
    
    if (startDate && endDate) {
      params.push(startDate, endDate);
      dateFilter = `AND te.start_time >= $${params.length - 1} AND te.start_time <= $${params.length}`;
    }

    const [totalHours, totalCost, projectCount, recentEntries] = await Promise.all([
      pool.query(`SELECT COALESCE(SUM(duration_minutes), 0) as total_minutes FROM time_entries te WHERE te.employee_id = $1 AND te.is_active = true ${dateFilter}`, params),
      pool.query(`SELECT COALESCE(SUM(cost), 0) as total_cost FROM time_entries te WHERE te.employee_id = $1 AND te.is_active = true ${dateFilter}`, params),
      pool.query(`SELECT COUNT(DISTINCT project_id) as project_count FROM time_entries te WHERE te.employee_id = $1 AND te.is_active = true ${dateFilter}`, params),
      pool.query(`SELECT te.id, te.start_time, te.duration_minutes, te.cost, p.name as project_name FROM time_entries te JOIN projects p ON te.project_id = p.id WHERE te.employee_id = $1 AND te.is_active = true ${dateFilter} ORDER BY te.start_time DESC LIMIT 5`, params)
    ]);

    res.json({
      employee: employee.rows[0],
      summary: {
        totalHours: Math.round(parseInt(totalHours.rows[0].total_minutes) / 60 * 100) / 100,
        totalCost: parseFloat(totalCost.rows[0].total_cost),
        projectCount: parseInt(projectCount.rows[0].project_count),
        recentEntries: recentEntries.rows
      }
    });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/employees/:id/projects - Get projects where employee has assigned tasks
router.get('/:id/projects', async (req, res) => {
  try {
    const { id } = req.params;
    const { page = 1, limit = 100, status = '' } = req.query;
    const offset = (page - 1) * limit;

    // Check if employee exists
    const employeeExists = await pool.query('SELECT id FROM employees WHERE id = $1', [id]);
    if (employeeExists.rows.length === 0) {
      return res.status(404).json({ error: 'Employee not found' });
    }

    let where = 'WHERE t.assigned_to = $1';
    const params = [id];

    if (status) {
      params.push(status.toLowerCase());
      where += ` AND LOWER(p.status) = $${params.length}`;
    }

    const result = await pool.query(
      `SELECT DISTINCT p.id, p.name, p.description, p.status, p.start_date, p.end_date, p.budget, 
              p.priority, p.team_size, p.progress, p.estimated_hours,
              p.created_at, p.updated_at, c.name as client_name, c.id as client_id,
              COUNT(t.id) as task_count
       FROM projects p
       JOIN clients c ON p.client_id = c.id
       JOIN tasks t ON p.id = t.project_id
       ${where}
       GROUP BY p.id, p.name, p.description, p.status, p.start_date, p.end_date, p.budget, 
                p.priority, p.team_size, p.progress, p.estimated_hours,
                p.created_at, p.updated_at, c.name, c.id
       ORDER BY p.created_at DESC
       LIMIT ${limit} OFFSET ${offset}`,
      params
    );

    const count = await pool.query(
      `SELECT COUNT(DISTINCT p.id) as count 
       FROM projects p
       JOIN tasks t ON p.id = t.project_id
       ${where}`,
      params
    );

    res.json({
      projects: result.rows,
      total: parseInt(count.rows[0].count),
      page: Number(page),
      limit: Number(limit)
    });
  } catch (err) {
    console.error('Error fetching employee projects:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;

