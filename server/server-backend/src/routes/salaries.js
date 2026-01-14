const express = require('express');
const pool = require('../config/database');
const { authenticateToken, requireRole } = require('../middleware/auth');
const { validateSalaryData } = require('../middleware/validation');

const router = express.Router();
router.use(authenticateToken);
router.use(requireRole(['admin'])); // Only admin can access salary information

// Helper to check if user is from organization registry (real org user, not demo)
function isOrganizationUser(req) {
  return req.user && req.user.source === 'registry';
}

// GET /api/salaries - Get all salaries with pagination and filters
router.get('/', async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 50, 
      employee_id, 
      salary_type, 
      is_current,
      start_date,
      end_date,
      search = '' 
    } = req.query;
    
    // Real organization users see empty salaries list (no dummy data)
    if (isOrganizationUser(req)) {
      return res.json({
        salaries: [],
        total: 0,
        page: Number(page),
        limit: Number(limit)
      });
    }
    
    const offset = (page - 1) * limit;
    let where = 'WHERE 1=1';
    const params = [];
    
    if (employee_id) {
      params.push(employee_id);
      where += ` AND s.employee_id = $${params.length}`;
    }
    
    if (salary_type) {
      params.push(salary_type);
      where += ` AND s.salary_type = $${params.length}`;
    }
    
    if (is_current !== undefined) {
      params.push(is_current === 'true');
      where += ` AND s.is_current = $${params.length}`;
    }
    
    if (start_date) {
      params.push(start_date);
      where += ` AND s.effective_date >= $${params.length}`;
    }
    
    if (end_date) {
      params.push(end_date);
      where += ` AND s.effective_date <= $${params.length}`;
    }
    
    if (search) {
      params.push(`%${search.toLowerCase()}%`);
      where += ` AND (LOWER(e.first_name) LIKE $${params.length} OR LOWER(e.last_name) LIKE $${params.length} OR LOWER(u.user_id) LIKE $${params.length})`;
    }
    
    const salariesQuery = `
      SELECT 
        s.id,
        s.employee_id,
        s.salary_type,
        s.salary_amount,
        s.hourly_rate,
        s.effective_date,
        s.end_date,
        s.is_current,
        s.notes,
        s.created_at,
        s.updated_at,
        e.first_name,
        e.last_name,
        u.user_id as emp_id,
        u.department_id
      FROM salaries s
      JOIN users u ON s.employee_id = u.user_id
      ${where}
      ORDER BY s.effective_date DESC, e.first_name ASC
      LIMIT ${limit} OFFSET ${offset}
    `;
    
    const countQuery = `
      SELECT COUNT(*) as count 
      FROM salaries s
      JOIN users u ON s.employee_id = u.user_id
      ${where}
    `;
    
    const [salariesResult, countResult] = await Promise.all([
      pool.query(salariesQuery, params),
      pool.query(countQuery, params)
    ]);
    
    res.json({
      salaries: salariesResult.rows,
      total: parseInt(countResult.rows[0].count),
      page: Number(page),
      limit: Number(limit)
    });
    
  } catch (err) {
    console.error('Error fetching salaries:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/salaries/employee/:employeeId - Get salary history for specific employee
router.get('/employee/:employeeId', async (req, res) => {
  try {
    const { employeeId } = req.params;
    const { include_inactive = 'false' } = req.query;
    
    let where = 'WHERE s.employee_id = $1';
    const params = [employeeId];
    
    if (include_inactive === 'false') {
      where += ' AND s.is_current = true';
    }
    
    const query = `
      SELECT 
        s.id,
        s.salary_type,
        s.salary_amount,
        s.hourly_rate,
        s.effective_date,
        s.end_date,
        s.is_current,
        s.notes,
        s.created_at,
        e.first_name,
        e.last_name,
        u.user_id as emp_id,
        u.department_id
      FROM salaries s
      JOIN users u ON s.employee_id = u.user_id
      ${where}
      ORDER BY s.effective_date DESC
    `;
    
    const result = await pool.query(query, params);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'No salary records found for this employee' });
    }
    
    res.json({
      employee: {
        id: employeeId,
        name: `${result.rows[0].first_name} ${result.rows[0].last_name}`,
        employee_id: result.rows[0].emp_id,
        department: result.rows[0].department
      },
      salaries: result.rows
    });
    
  } catch (err) {
    console.error('Error fetching employee salaries:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/salaries/current - Get current salaries for all employees
router.get('/current', async (req, res) => {
  try {
    const query = `
      SELECT 
        s.id,
        s.employee_id,
        s.salary_type,
        s.salary_amount,
        s.hourly_rate,
        s.effective_date,
        s.notes,
        e.first_name,
        e.last_name,
        u.user_id as emp_id,
        u.department_id
      FROM salaries s
      JOIN users u ON s.employee_id = u.user_id
      WHERE s.is_current = true
      ORDER BY e.first_name ASC
    `;
    
    const result = await pool.query(query);
    
    res.json({
      current_salaries: result.rows,
      total: result.rows.length
    });
    
  } catch (err) {
    console.error('Error fetching current salaries:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/salaries - Create new salary record
router.post('/', validateSalaryData, async (req, res) => {
  try {
    const {
      employee_id,
      salary_type,
      salary_amount,
      hourly_rate,
      effective_date,
      end_date,
      notes
    } = req.body;
    
    // Check if user exists
    const userCheck = await pool.query(
      'SELECT user_id, first_name, last_name FROM users WHERE user_id = $1',
      [employee_id]
    );
    
    if (userCheck.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    // If this is a new current salary, mark previous current salary as inactive
    if (!end_date) {
      await pool.query(
        'UPDATE salaries SET is_current = false WHERE employee_id = $1 AND is_current = true',
        [employee_id]
      );
    }
    
    const query = `
      INSERT INTO salaries (
        employee_id, salary_type, salary_amount, hourly_rate, 
        effective_date, end_date, is_current, notes
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *
    `;
    
    const values = [
      employee_id,
      salary_type,
      salary_amount,
      hourly_rate,
      effective_date,
      end_date || null,
      !end_date, // is_current = true if no end_date
      notes || null
    ];
    
    const result = await pool.query(query, values);
    
    res.status(201).json({
      message: 'Salary record created successfully',
      salary: result.rows[0]
    });
    
  } catch (err) {
    console.error('Error creating salary record:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/salaries/:id - Update salary record
router.put('/:id', validateSalaryData, async (req, res) => {
  try {
    const { id } = req.params;
    const {
      salary_type,
      salary_amount,
      hourly_rate,
      effective_date,
      end_date,
      is_current,
      notes
    } = req.body;
    
    // Check if salary record exists
    const existingSalary = await pool.query(
      'SELECT * FROM salaries WHERE id = $1',
      [id]
    );
    
    if (existingSalary.rows.length === 0) {
      return res.status(404).json({ error: 'Salary record not found' });
    }
    
    // If making this current, mark others as inactive
    if (is_current) {
      await pool.query(
        'UPDATE salaries SET is_current = false WHERE employee_id = $1 AND id != $2',
        [existingSalary.rows[0].employee_id, id]
      );
    }
    
    const query = `
      UPDATE salaries 
      SET 
        salary_type = $1,
        salary_amount = $2,
        hourly_rate = $3,
        effective_date = $4,
        end_date = $5,
        is_current = $6,
        notes = $7,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $8
      RETURNING *
    `;
    
    const values = [
      salary_type,
      salary_amount,
      hourly_rate,
      effective_date,
      end_date || null,
      is_current || false,
      notes || null,
      id
    ];
    
    const result = await pool.query(query, values);
    
    res.json({
      message: 'Salary record updated successfully',
      salary: result.rows[0]
    });
    
  } catch (err) {
    console.error('Error updating salary record:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/salaries/:id - Delete salary record
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const result = await pool.query(
      'DELETE FROM salaries WHERE id = $1 RETURNING *',
      [id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Salary record not found' });
    }
    
    res.json({
      message: 'Salary record deleted successfully',
      salary: result.rows[0]
    });
    
  } catch (err) {
    console.error('Error deleting salary record:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/salaries/stats - Get salary statistics
router.get('/stats', async (req, res) => {
  try {
    const statsQuery = `
      SELECT 
        COUNT(*) as total_salaries,
        COUNT(DISTINCT employee_id) as employees_with_salaries,
        AVG(salary_amount) as average_salary,
        MIN(salary_amount) as min_salary,
        MAX(salary_amount) as max_salary,
        COUNT(CASE WHEN is_current = true THEN 1 END) as current_salaries
      FROM salaries
    `;
    
    const departmentStatsQuery = `
      SELECT 
        u.department_id,
        COUNT(s.id) as salary_count,
        AVG(s.salary_amount) as avg_salary,
        MIN(s.salary_amount) as min_salary,
        MAX(s.salary_amount) as max_salary
      FROM salaries s
      JOIN users u ON s.employee_id = u.user_id
      WHERE s.is_current = true
      GROUP BY u.department_id
      ORDER BY avg_salary DESC
    `;
    
    const [statsResult, departmentResult] = await Promise.all([
      pool.query(statsQuery),
      pool.query(departmentStatsQuery)
    ]);
    
    res.json({
      overall_stats: statsResult.rows[0],
      department_stats: departmentResult.rows
    });
    
  } catch (err) {
    console.error('Error fetching salary statistics:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
