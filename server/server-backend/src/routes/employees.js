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

    // Ensure user exists
    const exists = await pool.query('SELECT user_id FROM users WHERE user_id = $1', [id]);
    if (exists.rows.length === 0) {
      // cleanup file if user not found
      try { fs.unlinkSync(file.path); } catch {}
      return res.status(404).json({ error: 'User not found' });
    }

    // Store file metadata in employee_documents
    const insert = await pool.query(
      `INSERT INTO employee_documents (employee_id, document_type, original_name, file_name, file_path, file_size, mime_type, file_extension, is_image)
       VALUES ($1, 'photo', $2, $3, $4, $5, $6, $7, true)
       RETURNING id`,
      [id, file.originalname, file.filename, file.path, file.size, file.mimetype, path.extname(file.originalname).toLowerCase()]
    );

    // Also update the photograph column in users table with the file path
    await pool.query(
      `UPDATE users SET photograph = $1, updated_at = CURRENT_TIMESTAMP WHERE user_id = $2`,
      [file.path, id]
    );

    res.json({ success: true, documentId: insert.rows[0].id, fileName: file.filename });
  } catch (error) {
    console.error('Error uploading employee photo:', error);
    res.status(500).json({ error: 'Failed to upload photo' });
  }
});

// POST /api/employees/:id/aadhaar - Upload employee aadhaar image
router.post('/:id/aadhaar', photoUpload.single('aadhaar'), async (req, res) => {
  try {
    const { id } = req.params;
    if (!req.file) {
      return res.status(400).json({ error: 'Aadhaar image file is required' });
    }
    const file = req.file;

    // Ensure user exists
    const exists = await pool.query('SELECT user_id FROM users WHERE user_id = $1', [id]);
    if (exists.rows.length === 0) {
      // cleanup file if user not found
      try { fs.unlinkSync(file.path); } catch {}
      return res.status(404).json({ error: 'User not found' });
    }

    // Store file metadata in employee_documents
    const insert = await pool.query(
      `INSERT INTO employee_documents (employee_id, document_type, original_name, file_name, file_path, file_size, mime_type, file_extension, is_image)
       VALUES ($1, 'aadhaar', $2, $3, $4, $5, $6, $7, true)
       RETURNING id`,
      [id, file.originalname, file.filename, file.path, file.size, file.mimetype, path.extname(file.originalname).toLowerCase()]
    );

    // Also update the aadhaar_image column in users table with the file path
    await pool.query(
      `UPDATE users SET aadhaar_image = $1, updated_at = CURRENT_TIMESTAMP WHERE user_id = $2`,
      [file.path, id]
    );

    res.json({ success: true, documentId: insert.rows[0].id, fileName: file.filename });
  } catch (error) {
    console.error('Error uploading aadhaar image:', error);
    res.status(500).json({ error: 'Failed to upload aadhaar image' });
  }
});

// GET /api/employees - List all employees with pagination and search
// Helper to check if user is from organization registry (real org user, not demo)
function isOrganizationUser(req) {
  return req.user && req.user.source === 'registry';
}

router.get('/', async (req, res) => {
  try {
    const { page = 1, limit = 50, search = '', department = '', active = 'true' } = req.query;
    
    // Real organization users see empty employee list (no dummy data)
    if (isOrganizationUser(req)) {
      return res.json({
        employees: [],
        total: 0,
        page: 1,
        limit: 50
      });
    }

    // Demo users see users table data
    const offset = (page - 1) * limit;
    let where = 'WHERE 1=1';
    const params = [];
    
    if (search) {
      params.push(`%${search.toLowerCase()}%`);
      where += ` AND (LOWER(first_name || ' ' || last_name) LIKE $${params.length} OR LOWER(email_id) LIKE $${params.length})`;
    }
    
    if (active === 'true') {
      where += ' AND is_active = true';
    } else if (active === 'false') {
      where += ' AND is_active = false';
    }
    
    const list = await pool.query(
      `SELECT user_id as id, user_id as employee_id, first_name, last_name, email_id as email, phone_number as phone,
              NULL as department, NULL as salary_type, NULL as salary_amount, NULL as hourly_rate,
              is_active, created_at, updated_at, role
       FROM users
       ${where}
       ORDER BY created_at DESC
       LIMIT ${limit} OFFSET ${offset}`,
      params
    );
    
    const count = await pool.query(`SELECT COUNT(*) as count FROM users ${where}`, params);
    
    res.json({
      employees: list.rows,
      total: parseInt(count.rows[0].count),
      page: Number(page),
      limit: Number(limit)
    });
  } catch (err) {
    console.error('Employees GET error:', err);
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
    let whereClause = 'WHERE user_id = $1';
    if (req.user && req.user.role === 'manager') {
      whereClause += ` AND department_id != 'Management'`;
    }
    
    const salaryFields = canViewSalary 
      ? ', salary_type, salary_amount, hourly_rate'
      : '';
    
    const result = await pool.query(
      `SELECT user_id as id, user_id as employee_id, first_name, last_name, email_id as email, phone_number as phone, 
              department_id as department${salaryFields}, is_active, created_at, updated_at 
       FROM users ${whereClause}`,
      [id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
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
  body('employmentType').optional().isIn(['Full Time', 'Temporary', 'Contract']),
  body('aadhaarNumber').optional().isString(),
  body('address').optional().isString(),
  body('countryId').optional().isUUID().withMessage('Valid country ID required'),
  body('stateId').optional().isUUID().withMessage('Valid state ID required'),
  body('designationId').optional().isUUID().withMessage('Valid designation ID required'),
  body('salaryType').isIn(['hourly', 'daily', 'monthly']).withMessage('Valid salary type required'),
  body('salaryAmount').isNumeric().withMessage('Salary amount must be a number'),
  body('hourlyRate').optional().isNumeric().withMessage('Hourly rate must be a number'),
  body('overtimeRate').optional().isNumeric().withMessage('Overtime rate must be a number'),
], handleValidation, async (req, res) => {
  try {
    const { 
      employeeId, firstName, lastName, email, phone, department, 
      salutation, dateOfBirth, joiningDate, employmentType, aadhaarNumber, 
      address, countryId, stateId, designationId,
      salaryType, salaryAmount, hourlyRate, overtimeRate 
    } = req.body;
    
    // Check if user with this email already exists
    const existing = await pool.query('SELECT user_id FROM users WHERE email_id = $1', [email]);
    if (existing.rows.length > 0) {
      return res.status(409).json({ error: 'User with this email already exists' });
    }

    // Get IT Department ID (default department)
    let departmentId = null;
    if (department) {
      // Check if it's already a UUID
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (uuidRegex.test(department)) {
        departmentId = department;
      } else {
        // Look up department by name
        const deptResult = await pool.query('SELECT department_id FROM departments WHERE name = $1', [department]);
        if (deptResult.rows.length > 0) {
          departmentId = deptResult.rows[0].department_id;
        }
      }
    }
    
    // If no department found, use IT Department as default
    if (!departmentId) {
      const itDept = await pool.query("SELECT department_id FROM departments WHERE name = 'IT Department'");
      if (itDept.rows.length > 0) {
        departmentId = itDept.rows[0].department_id;
      }
    }

    // Determine role based on designation
    let userRole = 'employee';
    if (designationId) {
      const designationResult = await pool.query(
        'SELECT name FROM designations WHERE designation_id = $1',
        [designationId]
      );
      if (designationResult.rows.length > 0) {
        const designationName = designationResult.rows[0].name;
        // If designation is Manager, set role as manager
        if (designationName.toLowerCase() === 'manager') {
          userRole = 'manager';
        }
      }
    }

    // Generate a random password for new user (they can reset it later)
    const bcrypt = require('bcryptjs');
    const tempPassword = Math.random().toString(36).slice(-8);
    const passwordHash = await bcrypt.hash(tempPassword, 10);

    const result = await pool.query(
      `INSERT INTO users (
        first_name, last_name, email_id, phone_number, department_id, password_hash, role,
        salutation, date_of_birth, joining_date, employee_type, aadhaar_number,
        address, country_id, state_id, designation_id,
        pay_calculation, amount, overtime_rate, is_active
      ) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, true) 
       RETURNING user_id as id, user_id as employee_id, first_name, last_name, email_id as email, 
                 phone_number as phone, department_id as department, salutation, date_of_birth, 
                 joining_date, employee_type, aadhaar_number, address, country_id, state_id, designation_id,
                 role, is_active, created_at, updated_at`,
      [
        firstName, lastName, email, phone, departmentId, passwordHash, userRole,
        salutation || null, dateOfBirth || null, joiningDate || null, employmentType || null, aadhaarNumber || null,
        address || null, countryId || null, stateId || null, designationId || null,
        salaryType, salaryAmount, overtimeRate || null
      ]
    );
    res.status(201).json({ employee: result.rows[0], tempPassword });
  } catch (err) {
    if (String(err.message || '').includes('duplicate')) {
      return res.status(409).json({ error: 'User with this email already exists' });
    }
    console.error('Error creating employee:', err);
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
    
    // Check if user exists
    const exists = await pool.query('SELECT user_id FROM users WHERE user_id = $1', [id]);
    if (exists.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Check if email is being changed and if it already exists
    if (email) {
      const existing = await pool.query('SELECT user_id FROM users WHERE email_id = $1 AND user_id != $2', [email, id]);
      if (existing.rows.length > 0) {
        return res.status(409).json({ error: 'Email already exists' });
      }
    }

    const result = await pool.query(
      `UPDATE users SET first_name = COALESCE($1, first_name), last_name = COALESCE($2, last_name), 
       email_id = COALESCE($3, email_id), phone_number = COALESCE($4, phone_number), 
       department_id = COALESCE($5, department_id), salary_type = COALESCE($6, salary_type), 
       salary_amount = COALESCE($7, salary_amount), hourly_rate = COALESCE($8, hourly_rate), 
       is_active = COALESCE($9, is_active), updated_at = CURRENT_TIMESTAMP 
       WHERE user_id = $10 
       RETURNING user_id as id, user_id as employee_id, first_name, last_name, email_id as email, phone_number as phone, department_id as department, is_active, created_at, updated_at`,
      [firstName, lastName, email, phone, department, salaryType, salaryAmount, hourlyRate, isActive, id]
    );
    res.json({ employee: result.rows[0] });
  } catch (err) {
    console.error('Error updating employee:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/employees/:id - Soft delete employee
router.delete('/:id', requireRole(['admin', 'manager']), async (req, res) => {
  try {
    const { id } = req.params;
    
    // Check if user has time entries
    const timeEntries = await pool.query('SELECT COUNT(*) as count FROM time_entries WHERE employee_id = $1', [id]);
    if (parseInt(timeEntries.rows[0].count) > 0) {
      return res.status(400).json({ error: 'Cannot delete user with time entries' });
    }

    const result = await pool.query('UPDATE users SET is_active = false, updated_at = CURRENT_TIMESTAMP WHERE user_id = $1 RETURNING user_id', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json({ message: 'User deactivated successfully' });
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
    
    // Find user by ID or by email
    let employeeId = id;
    const userCheck = await pool.query('SELECT user_id, email_id FROM users WHERE user_id = $1', [id]);
    
    if (userCheck.rows.length === 0) {
      // If not found by ID, try to find by email using the logged-in user's email
      if (req.user && req.user.email) {
        const userByEmail = await pool.query('SELECT user_id FROM users WHERE email_id = $1', [req.user.email]);
        if (userByEmail.rows.length > 0) {
          employeeId = userByEmail.rows[0].user_id;
          console.log(`✅ Found user by email: ${req.user.email} -> ${employeeId}`);
        } else {
          return res.status(404).json({ error: 'User not found' });
        }
      } else {
        return res.status(404).json({ error: 'User not found' });
      }
    }

    let where = 'WHERE te.employee_id = $1';
    const params = [employeeId];
    
    if (projectId) {
      params.push(projectId);
      where += ` AND p.project_id = $${params.length}`;
    }

    const result = await pool.query(
      `SELECT te.id, te.task_id, te.work_date, te.start_time, te.end_time, te.duration_minutes, te.created_at,
              t.task_name as task_title, t.status as task_status,
              p.project_name as project_name, p.status as project_status, p.project_id as project_id
       FROM time_entries te
       JOIN tasks t ON te.task_id = t.task_id
       JOIN projects p ON t.project_id = p.project_id
       ${where}
       ORDER BY te.start_time DESC
       LIMIT ${limit} OFFSET ${offset}`,
      params
    );

    const count = await pool.query(
      `SELECT COUNT(*) as count 
       FROM time_entries te
       JOIN tasks t ON te.task_id = t.task_id
       JOIN projects p ON t.project_id = p.project_id
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
    let whereClause = 'WHERE user_id = $1';
    if (req.user && req.user.role === 'manager') {
      whereClause += ` AND department_id != 'Management'`;
    }
    
    const salaryFields = canViewSalary 
      ? ', salary_type, salary_amount, hourly_rate'
      : '';
    
    // Verify user exists
    const employee = await pool.query(`SELECT user_id as id, first_name, last_name, user_id as employee_id${salaryFields} FROM users ${whereClause}`, [id]);
    if (employee.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    let dateFilter = '';
    const params = [id];
    
    if (startDate && endDate) {
      params.push(startDate, endDate);
      dateFilter = `AND te.start_time >= $${params.length - 1} AND te.start_time <= $${params.length}`;
    }

    const [totalHours, projectCount, recentEntries] = await Promise.all([
      pool.query(`SELECT COALESCE(SUM(duration_minutes), 0) as total_minutes FROM time_entries te WHERE te.employee_id = $1 ${dateFilter}`, params),
      pool.query(`SELECT COUNT(DISTINCT t.project_id) as project_count FROM time_entries te JOIN tasks t ON te.task_id = t.task_id WHERE te.employee_id = $1 ${dateFilter}`, params),
      pool.query(`SELECT te.id, te.start_time, te.duration_minutes, p.project_name as project_name FROM time_entries te JOIN tasks t ON te.task_id = t.task_id JOIN projects p ON t.project_id = p.project_id WHERE te.employee_id = $1 ${dateFilter} ORDER BY te.start_time DESC LIMIT 5`, params)
    ]);

    res.json({
      employee: employee.rows[0],
      summary: {
        totalHours: Math.round(parseInt(totalHours.rows[0].total_minutes) / 60 * 100) / 100,
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

    // Check if user exists
    const userExists = await pool.query('SELECT user_id FROM users WHERE user_id = $1', [id]);
    if (userExists.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    let where = 'WHERE t.assigned_to = $1';
    const params = [id];

    if (status) {
      params.push(status.toLowerCase());
      where += ` AND LOWER(p.status) = $${params.length}`;
    }

    const result = await pool.query(
      `SELECT DISTINCT p.project_id, p.project_name, p.description, p.status, p.start_date, p.end_date, p.estimated_value, 
              p.priority, p.team_size, p.progress, p.estimated_hours,
              p.created_at, p.updated_at, COALESCE(c.first_name || ' ' || c.last_name, 'Unknown') as client_name, c.client_id as client_id,
              COUNT(t.task_id) as task_count
       FROM projects p
       JOIN clients c ON p.client_id = c.client_id
       JOIN tasks t ON p.project_id = t.project_id
       ${where}
       GROUP BY p.project_id, p.project_name, p.description, p.status, p.start_date, p.end_date, p.estimated_value, 
                p.priority, p.team_size, p.progress, p.estimated_hours,
                p.created_at, p.updated_at, c.first_name, c.last_name, c.client_id
       ORDER BY p.created_at DESC
       LIMIT ${limit} OFFSET ${offset}`,
      params
    );

    const count = await pool.query(
      `SELECT COUNT(DISTINCT p.project_id) as count 
       FROM projects p
       JOIN tasks t ON p.project_id = t.project_id
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

