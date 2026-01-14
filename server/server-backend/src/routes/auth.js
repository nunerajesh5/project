const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { body } = require('express-validator');
const pool = require('../config/database');
const { secondary: registryPool } = require('../config/databases');
const { handleValidation } = require('../middleware/validation');

const router = express.Router();

router.post('/register', [
  body('email').isEmail(),
  body('password').isLength({ min: 6 }),
  body('firstName').trim().notEmpty(),
  body('lastName').trim().notEmpty(),
  body('organizationCode').optional().isString().trim(),
  body('role').optional().isIn(['admin', 'manager', 'employee']),
], handleValidation, async (req, res) => {
  const client = await pool.connect();
  try {
    const { email, password, firstName, lastName, organizationCode, role = 'employee' } = req.body;
    const hash = await bcrypt.hash(password, 10);
    
    await client.query('BEGIN');
    
    // Create user
    const userResult = await client.query(
      'INSERT INTO users (email, password_hash, first_name, last_name, role) VALUES ($1, $2, $3, $4, $5) RETURNING id, email, first_name, last_name, role',
      [email, hash, firstName, lastName, role]
    );
    const user = userResult.rows[0];
    
    // If organizationCode is provided, link user to organization
    if (organizationCode) {
      // Find organization by join code
      let org = null;
      try {
        const orgResult = await client.query(
          'SELECT id FROM organizations WHERE join_code = $1',
          [organizationCode]
        );
        if (orgResult.rows.length > 0) {
          org = orgResult.rows[0];
        }
      } catch (orgErr) {
        console.log('Error finding organization:', orgErr.message);
      }
      
      // If organization found, create employee and link to organization
      if (org) {
        // Create employee record
        const empResult = await client.query(
          `INSERT INTO employees (employee_id, first_name, last_name, email, salary_type, salary_amount, is_active)
           VALUES (uuid_generate_v4()::text, $1, $2, $3, 'monthly', 0, true)
           RETURNING id`,
          [firstName, lastName, email]
        );
        const employeeId = empResult.rows[0].id;
        
        // Link employee to organization
        await client.query(
          `INSERT INTO organization_memberships (organization_id, employee_id, role)
           VALUES ($1, $2, $3)
           ON CONFLICT (organization_id, employee_id) DO UPDATE SET role = EXCLUDED.role`,
          [org.id, employeeId, role]
        );
      }
    }
    
    await client.query('COMMIT');
    const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET, { expiresIn: '7d' });
    res.json({ message: 'Registered', user, token });
  } catch (err) {
    await client.query('ROLLBACK');
    if (String(err.message || '').includes('duplicate')) {
      return res.status(409).json({ error: 'Email already exists' });
    }
    console.error('Registration error:', err);
    res.status(500).json({ error: 'Internal server error', details: err.message });
  } finally {
    client.release();
  }
});

router.post('/login', [
  body('email').isEmail(),
  body('password').isString(),
], handleValidation, async (req, res) => {
  try {
    const { email, password } = req.body;
    
    // Demo accounts (for development) - these are in users table
    // Check users table FIRST for demo accounts (admin@company.com, rajesh@company.com, etc.)
    // Note: Using email_id and user_id column names to match actual database schema
    const demoResult = await pool.query('SELECT user_id as id, email_id as email, password_hash, first_name, last_name, role FROM users WHERE email_id = $1', [email]);
    
    if (demoResult.rows.length > 0) {
      const row = demoResult.rows[0];
      const ok = await bcrypt.compare(password, row.password_hash);
      if (!ok) return res.status(401).json({ error: 'Invalid credentials' });
      
      // Demo accounts use 'local' source - they see demo data
      const token = jwt.sign({ userId: row.id, source: 'local' }, process.env.JWT_SECRET, { expiresIn: '7d' });
      const { password_hash, ...user } = row;
      console.log(`✅ Demo user logged in: ${email} (${row.role})`);
      return res.json({ message: 'Logged in', user, token });
    }
    
    // Real organization users - check employees_registry in project_registry database
    if (registryPool) {
      try {
        const registryResult = await registryPool.query(
          `SELECT er.id, er.employee_email as email, er.password_hash, er.employee_name, er.role, er.organization_id, er.organization_name
           FROM employees_registry er
           WHERE er.employee_email = $1 AND er.is_active = true`,
          [email]
        );
        
        if (registryResult.rows.length > 0) {
          const row = registryResult.rows[0];
          
          // Check if password_hash exists
          if (!row.password_hash) {
            return res.status(401).json({ error: 'Password not set. Please contact your organization admin.' });
          }
          
          const ok = await bcrypt.compare(password, row.password_hash);
          if (!ok) return res.status(401).json({ error: 'Invalid credentials' });
          
          // Parse name into first and last name
          const nameParts = (row.employee_name || '').split(' ');
          const firstName = nameParts[0] || '';
          const lastName = nameParts.slice(1).join(' ') || '';
          
          // Real organization users use 'registry' source - they see their organization's data
          const token = jwt.sign({ 
            userId: row.id, 
            organizationId: row.organization_id,
            role: row.role,
            source: 'registry'
          }, process.env.JWT_SECRET, { expiresIn: '7d' });
          
          const user = {
            id: row.id,
            email: row.email,
            first_name: firstName,
            last_name: lastName,
            role: row.role,
            organization_id: row.organization_id,
            organization_name: row.organization_name
          };
          
          console.log(`✅ Organization user logged in: ${email} (${row.role}) - Org: ${row.organization_name}`);
          return res.json({ message: 'Logged in', user, token });
        }
      } catch (registryErr) {
        console.log('employees_registry lookup failed:', registryErr.message);
      }
    }
    
    // No user found in either table
    return res.status(401).json({ error: 'Invalid credentials' });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/profile', async (req, res) => {
  try {
    const auth = req.headers['authorization'];
    const token = auth && auth.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'Access token required' });
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // If user is from employees_registry (organization admin/employee)
    if (decoded.source === 'registry' && registryPool) {
      try {
        const result = await registryPool.query(
          `SELECT id, employee_email as email, employee_name, role, organization_id, organization_name
           FROM employees_registry WHERE id = $1`,
          [decoded.userId]
        );
        if (result.rows.length > 0) {
          const row = result.rows[0];
          const nameParts = (row.employee_name || '').split(' ');
          const firstName = nameParts[0] || '';
          const lastName = nameParts.slice(1).join(' ') || '';
          
          return res.json({ 
            user: {
              id: row.id,
              email: row.email,
              first_name: firstName,
              last_name: lastName,
              role: row.role,
              organization_id: row.organization_id,
              organization_name: row.organization_name
            }
          });
        }
      } catch (registryErr) {
        console.log('Registry profile lookup failed:', registryErr.message);
      }
    }
    
    // Fallback: check users table (using email_id and user_id column names)
    const result = await pool.query('SELECT user_id as id, email_id as email, first_name, last_name, role FROM users WHERE user_id = $1', [decoded.userId]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'User not found' });
    res.json({ user: result.rows[0] });
  } catch (err) {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
});

module.exports = router;

