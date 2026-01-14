const express = require('express');
const { body } = require('express-validator');
const pool = require('../config/database');
const { authenticateToken, requireRole } = require('../middleware/auth');
const { handleValidation } = require('../middleware/validation');

const router = express.Router();
router.use(authenticateToken);

// Helper: Check if user is from a real organization (not demo user)
const isOrganizationUser = (req) => req.user?.source === 'registry';

// GET /api/clients - List all clients with pagination and search
router.get('/', async (req, res) => {
  try {
    // Real organization users see empty data
    if (isOrganizationUser(req)) {
      return res.json({
        clients: [],
        total: 0,
        page: 1,
        limit: 50
      });
    }

    const { page = 1, limit = 50, search = '' } = req.query;
    const offset = (page - 1) * limit;
    let where = 'WHERE 1=1';
    const params = [];
    if (search) { 
      params.push(`%${search.toLowerCase()}%`); 
      where += ` AND (LOWER(first_name || ' ' || last_name) LIKE $${params.length} OR LOWER(email) LIKE $${params.length})`; 
    }
    const list = await pool.query(
      `SELECT client_id as id, first_name || ' ' || last_name as name, first_name, last_name, email, phone_number as phone, address, salutation, gst_number, onboard_date, created_at, updated_at 
       FROM clients ${where} 
       ORDER BY created_at DESC 
       LIMIT ${limit} OFFSET ${offset}`,
      params
    );
    const count = await pool.query(`SELECT COUNT(*) as count FROM clients ${where}`, params);
    res.json({ 
      clients: list.rows, 
      total: parseInt(count.rows[0].count), 
      page: Number(page), 
      limit: Number(limit) 
    });
  } catch (err) {
    console.error('Clients GET error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/clients/:id - Get specific client
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      'SELECT client_id as id, first_name || \' \' || last_name as name, first_name, last_name, email, phone_number as phone, address, salutation, gst_number, onboard_date, created_at, updated_at FROM clients WHERE client_id = $1',
      [id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Client not found' });
    }
    res.json({ client: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/clients/:id/projects - List projects for a specific client
router.get('/:id/projects', async (req, res) => {
  try {
    const { id } = req.params;
    const { page = 1, limit = 100, status = '' } = req.query;
    const offset = (page - 1) * limit;

    // Verify client exists
    const client = await pool.query('SELECT client_id as id, first_name || \' \' || last_name as name FROM clients WHERE client_id = $1', [id]);
    if (client.rows.length === 0) {
      return res.status(404).json({ error: 'Client not found' });
    }

    let where = 'WHERE p.client_id = $1';
    const params = [id];

    if (status) {
      params.push(String(status).toLowerCase());
      where += ` AND LOWER(p.status) = $${params.length}`;
    }

    const list = await pool.query(
      `SELECT p.project_id as id, p.project_name as name, p.description, p.status, p.start_date, p.end_date, p.estimated_value as budget,
              p.project_location as location, p.created_at, p.updated_at,
              c.first_name || ' ' || c.last_name as client_name, c.client_id as client_id
       FROM projects p
       JOIN clients c ON p.client_id = c.client_id
       ${where}
       ORDER BY p.created_at DESC
       LIMIT ${limit} OFFSET ${offset}`,
      params
    );
    console.log(`[GET /api/clients/${id}/projects] Found ${list.rows.length} projects`);

    const count = await pool.query(
      `SELECT COUNT(*) as count FROM projects p ${where}`,
      params
    );

    res.json({
      client: { id: client.rows[0].id, name: client.rows[0].name },
      projects: list.rows,
      total: parseInt(count.rows[0].count),
      page: Number(page),
      limit: Number(limit),
    });
  } catch (err) {
    console.error('Error fetching client projects:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/clients - Create new client
router.post('/', [
  body('firstName').trim().notEmpty().withMessage('First name is required'),
  body('lastName').trim().notEmpty().withMessage('Last name is required'),
  body('email').isEmail().withMessage('Valid email required'),
  body('phone').optional({ nullable: true, checkFalsy: true }).isString().trim(),
  body('address').optional({ nullable: true, checkFalsy: true }).isString().trim(),
  body('salutation').optional({ nullable: true, checkFalsy: true }).isString().trim(),
  body('gstNumber').optional({ nullable: true, checkFalsy: true }).isString().trim()
    .custom((value) => {
      if (value && value.length !== 15) {
        throw new Error('GST number must be exactly 15 characters');
      }
      // Validate GSTIN format: 2 digit state code + 10 char PAN + 1 entity code + Z + 1 checksum
      if (value && !/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/.test(value)) {
        throw new Error('Invalid GST number format. Format: 27ABCDE1234F1Z5');
      }
      return true;
    }),
], handleValidation, async (req, res) => {
  try {
    const { firstName, lastName, email, phone, address, salutation, gstNumber } = req.body;
    
    // Combine first and last name for logging
    const fullName = `${firstName} ${lastName}`.trim();
    
    // Auto-set onboard_date to current date
    const result = await pool.query(
      'INSERT INTO clients (first_name, last_name, email, phone_number, address, salutation, gst_number, onboard_date) VALUES ($1, $2, $3, $4, $5, $6, $7, CURRENT_DATE) RETURNING client_id as id, first_name, last_name, email, phone_number as phone, address, salutation, gst_number, onboard_date, created_at, updated_at',
      [firstName, lastName, email, phone, address, salutation || null, gstNumber || null]
    );
    // Non-blocking activity log
    try {
      const actorId = req.user?.id || null;
      const actorName = req.user?.first_name ? `${req.user.first_name} ${req.user.last_name}` : null;
      await pool.query(
        `INSERT INTO activity_logs (action_type, actor_id, actor_name, description, created_at)
         VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)`,
        ['client_created', actorId, actorName, `Client created: ${fullName}`]
      );
    } catch (logErr) {
      console.warn('Activity log insert failed (client_created):', logErr.message);
    }
    res.status(201).json({ client: result.rows[0] });
  } catch (err) {
    if (String(err.message || '').includes('duplicate')) {
      return res.status(409).json({ error: 'Client with this email already exists' });
    }
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/clients/:id - Update client
router.put('/:id', [
  body('firstName').optional().trim().notEmpty().withMessage('First name cannot be empty'),
  body('lastName').optional().trim().notEmpty().withMessage('Last name cannot be empty'),
  body('email').optional().isEmail().withMessage('Valid email required'),
  body('phone').optional().isString(),
  body('address').optional().isString(),
  body('salutation').optional().isString(),
  body('gstNumber').optional().isString(),
  body('onboardDate').optional().isString(),
], handleValidation, async (req, res) => {
  try {
    const { id } = req.params;
    const { firstName, lastName, email, phone, address, salutation, gstNumber, onboardDate } = req.body;
    
    // Check if client exists
    const exists = await pool.query('SELECT client_id FROM clients WHERE client_id = $1', [id]);
    if (exists.rows.length === 0) {
      return res.status(404).json({ error: 'Client not found' });
    }

    const result = await pool.query(
      `UPDATE clients SET 
        first_name = COALESCE($1, first_name), 
        last_name = COALESCE($2, last_name), 
        email = COALESCE($3, email), 
        phone_number = COALESCE($4, phone_number), 
        address = COALESCE($5, address),
        salutation = COALESCE($6, salutation),
        gst_number = COALESCE($7, gst_number),
        onboard_date = COALESCE($8, onboard_date),
        updated_at = CURRENT_TIMESTAMP 
       WHERE client_id = $9 
       RETURNING client_id as id, first_name, last_name, email, phone_number as phone, address, salutation, gst_number, onboard_date, created_at, updated_at`,
      [firstName, lastName, email, phone, address, salutation, gstNumber, onboardDate, id]
    );
    res.json({ client: result.rows[0] });
  } catch (err) {
    if (String(err.message || '').includes('duplicate')) {
      return res.status(409).json({ error: 'Client with this email already exists' });
    }
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/clients/:id - Delete client (cascade deletes projects)
router.delete('/:id', requireRole(['admin', 'manager']), async (req, res) => {
  try {
    const { id } = req.params;
    console.log('[DELETE /api/clients/:id] Request to delete client:', id);
    
    // Check how many projects will be deleted
    const projects = await pool.query('SELECT COUNT(*) as count FROM projects WHERE client_id = $1', [id]);
    const projectCount = parseInt(projects.rows[0].count);
    console.log('[DELETE /api/clients/:id] Client has', projectCount, 'project(s) that will also be deleted');
    
    // Delete projects first (cascade will handle related records)
    if (projectCount > 0) {
      await pool.query('DELETE FROM projects WHERE client_id = $1', [id]);
      console.log('[DELETE /api/clients/:id] ✅ Deleted', projectCount, 'project(s)');
    }

    // Now delete the client
    const result = await pool.query('DELETE FROM clients WHERE client_id = $1 RETURNING client_id as id, first_name, last_name', [id]);
    if (result.rows.length === 0) {
      console.log('[DELETE /api/clients/:id] ❌ Client not found');
      return res.status(404).json({ error: 'Client not found' });
    }
    const deletedClient = result.rows[0];
    console.log('[DELETE /api/clients/:id] ✅ Client deleted:', deletedClient.first_name, deletedClient.last_name);
    res.json({ 
      message: 'Client deleted successfully', 
      deletedProjects: projectCount 
    });
  } catch (err) {
    console.error('[DELETE /api/clients/:id] Error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;

