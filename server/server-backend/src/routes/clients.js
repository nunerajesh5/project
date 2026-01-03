const express = require('express');
const { body } = require('express-validator');
const pool = require('../config/database');
const { authenticateToken, requireRole } = require('../middleware/auth');
const { handleValidation } = require('../middleware/validation');

const router = express.Router();
router.use(authenticateToken);

// GET /api/clients - List all clients with pagination and search
router.get('/', async (req, res) => {
  try {
    const { page = 1, limit = 50, search = '' } = req.query;
    const offset = (page - 1) * limit;
    let where = 'WHERE 1=1';
    const params = [];
    if (search) { 
      params.push(`%${search.toLowerCase()}%`); 
      where += ` AND (LOWER(name) LIKE $${params.length} OR LOWER(email) LIKE $${params.length})`; 
    }
    const list = await pool.query(
      `SELECT id, name, first_name, last_name, email, phone, address, created_at, updated_at 
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
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/clients/:id - Get specific client
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      'SELECT id, name, first_name, last_name, email, phone, address, created_at, updated_at FROM clients WHERE id = $1',
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
    const client = await pool.query('SELECT id, name FROM clients WHERE id = $1', [id]);
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
      `SELECT p.id, p.name, p.description, p.status, p.start_date, p.end_date, p.budget,
              p.location, p.created_at, p.updated_at,
              c.name as client_name, c.id as client_id
       FROM projects p
       JOIN clients c ON p.client_id = c.id
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
], handleValidation, async (req, res) => {
  try {
    const { firstName, lastName, email, phone, address } = req.body;
    
    // Combine first and last name for the name field
    const fullName = `${firstName} ${lastName}`.trim();
    
    const result = await pool.query(
      'INSERT INTO clients (name, first_name, last_name, email, phone, address) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
      [fullName, firstName, lastName, email, phone, address]
    );
    // Non-blocking activity log
    try {
      await pool.query(
        `INSERT INTO activity_logs (type, actor_id, actor_name, description, created_at)
         VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)`,
        ['client_created', null, null, `Client created: ${fullName}`]
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
], handleValidation, async (req, res) => {
  try {
    const { id } = req.params;
    const { firstName, lastName, email, phone, address } = req.body;
    
    // Check if client exists
    const exists = await pool.query('SELECT id FROM clients WHERE id = $1', [id]);
    if (exists.rows.length === 0) {
      return res.status(404).json({ error: 'Client not found' });
    }

    // If first name or last name is provided, update the full name
    let updateName = '';
    if (firstName || lastName) {
      if (firstName && lastName) {
        updateName = `${firstName} ${lastName}`.trim();
      } else {
        // Get existing name parts if not all provided
        const existing = await pool.query('SELECT name FROM clients WHERE id = $1', [id]);
        if (existing.rows.length > 0) {
          const parts = existing.rows[0].name.split(' ');
          updateName = firstName ? `${firstName} ${parts.slice(1).join(' ')}`.trim() : `${parts[0]} ${lastName}`.trim();
        }
      }
    }

    const result = await pool.query(
      'UPDATE clients SET name = COALESCE($1, name), first_name = COALESCE($2, first_name), last_name = COALESCE($3, last_name), email = COALESCE($4, email), phone = COALESCE($5, phone), address = COALESCE($6, address), updated_at = CURRENT_TIMESTAMP WHERE id = $7 RETURNING *',
      [updateName, firstName, lastName, email, phone, address, id]
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
    const result = await pool.query('DELETE FROM clients WHERE id = $1 RETURNING *', [id]);
    if (result.rows.length === 0) {
      console.log('[DELETE /api/clients/:id] ❌ Client not found');
      return res.status(404).json({ error: 'Client not found' });
    }
    console.log('[DELETE /api/clients/:id] ✅ Client deleted:', result.rows[0].name);
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

