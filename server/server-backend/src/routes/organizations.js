const express = require('express');
const { body } = require('express-validator');
const pool = require('../config/database'); // Primary DB for operational data
const { secondary: registryPool } = require('../config/databases'); // Secondary DB for organization registry
const { handleValidation } = require('../middleware/validation');
const { authenticateToken, requireRole } = require('../middleware/auth');
const { createOrganizationDatabase, listOrganizationDatabases } = require('../services/databaseService');

const router = express.Router();

function generateJoinCode(length = 10) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let out = '';
  for (let i = 0; i < length; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

function generateUniqueId() {
  // Generate unique company ID: ORG-YYYYMMDD-XXXXX
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const random = Math.random().toString(36).substring(2, 7).toUpperCase();
  return `ORG-${date}-${random}`;
}

// POST /api/organizations/register - Register a new organization (public endpoint)
router.post(
  '/register',
  [
    body('name').isString().trim().isLength({ min: 2 }).withMessage('Company name is required'),
    body('address').isString().trim().isLength({ min: 5 }).withMessage('Company address is required'),
    body('licence_key').isString().trim().notEmpty().withMessage('Licence key is required'),
    body('licence_number').optional({ checkFalsy: true }).isString().trim().withMessage('Licence number must be a string'),
    body('max_employees').isInt({ min: 1 }).withMessage('Max employees must be at least 1'),
    body('licence_type').isString().trim().notEmpty().withMessage('Licence type is required'),
    body('admin_email').isEmail().normalizeEmail().withMessage('Valid admin email is required'),
    body('admin_phone').isString().trim().notEmpty().withMessage('Admin phone is required'),
    body('admin_password').isString().isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  ],
  handleValidation,
  async (req, res) => {
    const bcrypt = require('bcryptjs');
    
    // Check if secondary database (project_registry) is configured
    if (!registryPool) {
      return res.status(500).json({ 
        error: 'Organization registry database not configured. Please set DB2_HOST, DB2_NAME, DB2_USER, DB2_PASSWORD in .env' 
      });
    }
    
    try {
      const { name, address, industry, city, state_province, country, zip_code, logo_url, licence_key, licence_number, max_employees, licence_type, admin_email, admin_phone, admin_password } = req.body;
      
      // Use licence_key as licence_number if licence_number is empty (for trial plans)
      const finalLicenceNumber = licence_number && licence_number.trim() ? licence_number.trim() : licence_key;
      
      // Check if email already exists in registry database
      const existingEmail = await registryPool.query('SELECT 1 FROM organizations_registry WHERE admin_email = $1', [admin_email]);
      if (existingEmail.rows.length > 0) {
        return res.status(400).json({ error: 'Email already registered' });
      }

      // Hash password
      const hashedPassword = await bcrypt.hash(admin_password, 10);

      // Generate unique join code
      let code;
      for (let i = 0; i < 5; i++) {
        code = generateJoinCode();
        const exists = await registryPool.query('SELECT 1 FROM organizations_registry WHERE join_code = $1', [code]);
        if (exists.rows.length === 0) break;
      }
      if (!code) return res.status(500).json({ error: 'Failed to generate join code' });

      // Generate unique organization ID
      let organizationId;
      for (let i = 0; i < 5; i++) {
        organizationId = generateUniqueId();
        const exists = await registryPool.query('SELECT 1 FROM organizations_registry WHERE organization_id = $1', [organizationId]);
        if (exists.rows.length === 0) break;
      }
      if (!organizationId) return res.status(500).json({ error: 'Failed to generate unique ID' });

      // Step 1: Create a new database for this organization (project_time_manager{N})
      let orgDatabaseInfo;
      try {
        orgDatabaseInfo = await createOrganizationDatabase({
          organizationId,
          name,
          adminEmail: admin_email,
          adminPasswordHash: hashedPassword,
          adminPhone: admin_phone,
        });
        console.log(`✅ Organization database created: ${orgDatabaseInfo.databaseName}`);
      } catch (dbErr) {
        console.error('Failed to create organization database:', dbErr.message);
        return res.status(500).json({ error: 'Failed to create organization database', details: dbErr.message });
      }

      // Step 2: Insert into project_registry database (organizations_registry table)
      const ins = await registryPool.query(
        `INSERT INTO organizations_registry (organization_id, name, address, industry, city, state_province, country, zip_code, logo_url, licence_key, licence_number, max_employees, licence_type, admin_email, admin_phone, admin_password, join_code, database_name)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
         RETURNING id, organization_id, name, address, industry, city, state_province, country, zip_code, logo_url, licence_key, licence_number, max_employees, licence_type, admin_email, admin_phone, join_code, database_name, created_at`,
        [organizationId, name, address, industry || null, city || null, state_province || null, country || null, zip_code || null, logo_url || null, licence_key, finalLicenceNumber, max_employees, licence_type, admin_email, admin_phone, hashedPassword, code, orgDatabaseInfo.databaseName]
      );
      
      const orgRecord = ins.rows[0];
      console.log(`✅ Organization "${name}" registered in project_registry database with ID: ${organizationId}`);
      console.log(`   Database: ${orgDatabaseInfo.databaseName}`);
      
      // Step 3: Add organization admin to employees_registry table in project_registry database
      try {
        // Extract first and last name from admin_email or use company name
        const emailParts = admin_email.split('@')[0].split(/[._-]/);
        const firstName = emailParts[0] ? emailParts[0].charAt(0).toUpperCase() + emailParts[0].slice(1) : 'Admin';
        const lastName = emailParts[1] ? emailParts[1].charAt(0).toUpperCase() + emailParts[1].slice(1) : name;
        const adminName = `${firstName} ${lastName}`;
        
        // Check if admin already exists in employees_registry
        const existingAdmin = await registryPool.query(
          'SELECT id FROM employees_registry WHERE employee_email = $1 AND organization_id = $2', 
          [admin_email, organizationId]
        );
        
        if (existingAdmin.rows.length === 0) {
          // Add admin to employees_registry in project_registry database (include database_name)
          await registryPool.query(
            `INSERT INTO employees_registry (organization_id, organization_name, employee_email, employee_phone, employee_name, password_hash, role, database_name)
             VALUES ($1, $2, $3, $4, $5, $6, 'admin', $7)`,
            [organizationId, name, admin_email, admin_phone, adminName, hashedPassword, orgDatabaseInfo.databaseName]
          );
          console.log(`✅ Admin "${admin_email}" added to employees_registry in project_registry database`);
        } else {
          console.log(`ℹ️ Admin "${admin_email}" already exists in employees_registry`);
        }
      } catch (adminErr) {
        // Log error but don't fail the registration
        console.error('Warning: Could not add admin to employees_registry:', adminErr.message);
      }
      
      res.json({ 
        organization: {
          ...orgRecord,
          unique_id: orgRecord.organization_id,
          database_name: orgDatabaseInfo.databaseName
        }
      });
    } catch (err) {
      console.error('Error registering organization:', err);
      res.status(500).json({ error: 'Failed to register organization' });
    }
  }
);

// GET /api/organizations/resolve/:code - Resolve an organization by join code (public)
router.get('/resolve/:code', async (req, res) => {
  try {
    const { code } = req.params;
    let org = null;
    
    // Try organizations_registry in secondary database (project_registry) first
    if (registryPool) {
      try {
        org = await registryPool.query(
          `SELECT id, organization_id, 
            COALESCE(name, organization_name) as name, 
            admin_email, 
            admin_phone, 
            join_code,
            logo_url
           FROM organizations_registry 
           WHERE join_code = $1`,
          [code]
        );
      } catch (registryErr) {
        console.log('organizations_registry table query failed:', registryErr.message);
      }
    }
    
    // If not found in registry, try primary database organizations table
    if (!org || org.rows.length === 0) {
      try {
        org = await pool.query(
          'SELECT id, name, admin_email, admin_phone, join_code FROM organizations WHERE join_code = $1',
          [code]
        );
      } catch (orgErr) {
        console.log('organizations table query also failed:', orgErr.message);
      }
    }
    
    if (!org || org.rows.length === 0) {
      return res.status(404).json({ error: 'Organization not found' });
    }
    
    res.json({ organization: org.rows[0] });
  } catch (err) {
    console.error('Error resolving organization:', err);
    console.error('Error details:', err.message);
    console.error('Stack:', err.stack);
    res.status(500).json({ error: 'Failed to resolve organization', details: err.message });
  }
});

// GET /api/organizations/my-organization - Get admin's organization join code (authenticated, admin only)
router.get('/my-organization', authenticateToken, requireRole(['admin']), async (req, res) => {
  try {
    const adminEmail = req.user.email;
    const organizationId = req.user.organization_id; // From employees_registry users
    let org = null;
    
    // If user has organization_id (from employees_registry), use that directly
    if (organizationId && registryPool) {
      try {
        org = await registryPool.query(
          `SELECT id, 
            name, 
            join_code, 
            organization_id as unique_id,
            logo_url
           FROM organizations_registry 
           WHERE organization_id = $1`,
          [organizationId]
        );
        
        if (org.rows.length > 0) {
          const orgData = org.rows[0];
          return res.json({ 
            organization: {
              id: orgData.id,
              name: orgData.name,
              join_code: orgData.join_code,
              unique_id: orgData.unique_id || orgData.organization_id,
              logo_url: orgData.logo_url
            }
          });
        }
      } catch (registryErr) {
        console.log('organizations_registry query by org_id failed:', registryErr.message);
      }
    }
    
    // Fallback: Try organizations_registry by admin_email
    if (registryPool) {
      try {
        org = await registryPool.query(
          `SELECT id, 
            name, 
            join_code, 
            organization_id as unique_id,
            logo_url
           FROM organizations_registry 
           WHERE admin_email = $1`,
          [adminEmail]
        );
      } catch (registryErr) {
        console.log('organizations_registry query failed, trying organizations table:', registryErr.message);
      }
    }
    
    // If not found in registry, try primary database organizations table
    if (!org || org.rows.length === 0) {
      try {
        org = await pool.query(
          'SELECT id, name, join_code, unique_id FROM organizations WHERE admin_email = $1',
          [adminEmail]
        );
      } catch (orgErr) {
        console.log('organizations table query failed (table may not exist):', orgErr.message);
        // Don't throw - return dummy data instead
        org = { rows: [] };
      }
    }
    
    // If still no organization found, return dummy data for demo purposes
    if (!org || org.rows.length === 0) {
      console.log('No organization found, returning dummy organization data');
      return res.json({ 
        organization: {
          id: '00000000-0000-0000-0000-000000000000',
          name: 'Demo Organization',
          join_code: 'DEMO123',
          unique_id: '00000000-0000-0000-0000-000000000000',
          logo_url: null
        }
      });
    }
    
    // Ensure we have the required fields
    const orgData = org.rows[0];
    if (!orgData.join_code) {
      return res.status(500).json({ error: 'Organization found but missing join_code. Please contact support.' });
    }
    
    res.json({ 
      organization: {
        id: orgData.id,
        name: orgData.name,
        join_code: orgData.join_code,
        unique_id: orgData.unique_id || orgData.organization_id,
        logo_url: orgData.logo_url
      }
    });
  } catch (err) {
    console.error('Error fetching admin organization:', err);
    console.error('Error details:', err.message);
    console.error('Stack:', err.stack);
    res.status(500).json({ error: 'Failed to fetch organization', details: err.message });
  }
});

// POST /api/organizations/join - Join an organization via code (public)
router.post(
  '/join',
  [
    body('code').isString().trim().notEmpty(),
    body('first_name').isString().trim().isLength({ min: 1 }),
    body('last_name').optional().isString().trim(),
    body('email').optional().isEmail().normalizeEmail(),
    body('phone').optional().isString().trim(),
    body('department').optional().isString().trim(),
  ],
  handleValidation,
  async (req, res) => {
    const client = await pool.connect();
    try {
      const { code, first_name, last_name = '', email = null, phone = null, department = null } = req.body;
      const org = await client.query('SELECT id FROM organizations WHERE join_code = $1', [code]);
      if (org.rows.length === 0) {
        return res.status(404).json({ error: 'Invalid organization code' });
      }
      const orgId = org.rows[0].id;

      await client.query('BEGIN');
      const emp = await client.query(
        `INSERT INTO employees (employee_id, first_name, last_name, email, phone, department, salary_type, salary_amount, is_active)
         VALUES (uuid_generate_v4()::text, $1, $2, $3, $4, $5, 'monthly', 0, true)
         RETURNING id, first_name, last_name, email` ,
        [first_name, last_name, email, phone, department]
      );
      const employeeId = emp.rows[0].id;
      await client.query(
        `INSERT INTO organization_memberships (organization_id, employee_id) VALUES ($1, $2)
         ON CONFLICT (organization_id, employee_id) DO NOTHING`,
        [orgId, employeeId]
      );
      await client.query('COMMIT');
      res.json({ success: true, employee: emp.rows[0], organization_id: orgId });
    } catch (err) {
      await client.query('ROLLBACK');
      console.error('Error joining organization:', err);
      res.status(500).json({ error: 'Failed to join organization' });
    } finally {
      client.release();
    }
  }
);

module.exports = router;
